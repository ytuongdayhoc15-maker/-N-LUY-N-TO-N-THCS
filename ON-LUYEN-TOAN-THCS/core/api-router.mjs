import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { verifyPassword, sanitizeCsvCell } from './storage.mjs';
import { gradeQuestion, buildPersonalizedRecommendations } from './math-verifier.mjs';

const MAX_BODY_BYTES = 2 * 1024 * 1024; // 2MB cho import/backup JSON

function parseCookies(cookieHeader) {
  const out = {};
  if (!cookieHeader) return out;
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    out[k] = decodeURIComponent(v);
  }
  return out;
}

function signToken(payloadObj, secret) {
  const data = Buffer.from(JSON.stringify(payloadObj)).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(data).digest('base64url');
  return `${data}.${sig}`;
}

function verifyToken(token, secret) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const [data, sig] = token.split('.');
  const expectedSig = crypto.createHmac('sha256', secret).update(data).digest('base64url');
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expectedSig);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    const parsed = JSON.parse(Buffer.from(data, 'base64url').toString('utf8'));
    if (!parsed.exp || Date.now() > parsed.exp) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    if (req.body && typeof req.body === 'object') {
      resolve(req.body);
      return;
    }
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error('Dữ liệu gửi lên vượt quá giới hạn 2MB.'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8').trim();
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error('Dữ liệu JSON không hợp lệ.'));
      }
    });
    req.on('error', reject);
  });
}

export function sendJson(res, statusCode, payload, extraHeaders = {}) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    ...extraHeaders
  });
  res.end(body);
}

export function createApiHandler(storage, options = {}) {
  const zipPath = options.zipPath || null;

  function getSession(req) {
    const cookies = parseCookies(req.headers.cookie);
    const token = cookies.toan_thcs_sid;
    const payload = verifyToken(token, storage.sessionSecret);
    if (!payload) return null;
    const user = storage.getUserById(payload.uid);
    if (!user) return null;
    return { user, csrf: payload.csrf };
  }

  function verifyCsrf(req, session) {
    if (!session) return true;
    const method = (req.method || 'GET').toUpperCase();
    if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return true;
    const headerToken = req.headers['x-csrf-token'];
    return typeof headerToken === 'string' && headerToken === session.csrf;
  }

  return async function handleApi(req, res) {
    const urlObj = new URL(req.url || '/', 'http://127.0.0.1');
    const pathname = urlObj.pathname;
    const method = (req.method || 'GET').toUpperCase();
    const session = getSession(req);

    try {
      // Kiem tra trang thai he thong
      if (pathname === '/api/health' && method === 'GET') {
        return sendJson(res, 200, {
          ok: true,
          engine: storage.engine,
          questionsCount: storage.listQuestions().length,
          zipAvailable: Boolean(zipPath && fs.existsSync(zipPath))
        });
      }

      // Tai goi ZIP cho Windows
      if (pathname === '/api/download-zip' && method === 'GET') {
        if (!zipPath || !fs.existsSync(zipPath)) {
          return sendJson(res, 404, { error: 'Chưa tìm thấy gói ON-LUYEN-TOAN-THCS.zip.' });
        }
        const stat = fs.statSync(zipPath);
        res.writeHead(200, {
          'Content-Type': 'application/zip',
          'Content-Length': stat.size,
          'Content-Disposition': 'attachment; filename="ON-LUYEN-TOAN-THCS.zip"',
          'Cache-Control': 'no-store'
        });
        fs.createReadStream(zipPath).pipe(res);
        return;
      }

      // Dang nhap
      if (pathname === '/api/auth/login' && method === 'POST') {
        const body = await readJsonBody(req);
        const username = String(body.username || '').trim();
        const password = String(body.password || '');
        if (!username || !password) {
          return sendJson(res, 400, { error: 'Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu.' });
        }
        const userRecord = storage.getUserByUsername(username);
        if (!userRecord || !verifyPassword(password, userRecord.passwordHash)) {
          return sendJson(res, 401, { error: 'Tên đăng nhập hoặc mật khẩu chưa chính xác.' });
        }
        const csrf = crypto.randomBytes(16).toString('hex');
        const exp = Date.now() + 1000 * 60 * 60 * 12; // 12 gio
        const sid = signToken({ uid: userRecord.id, role: userRecord.role, csrf, exp }, storage.sessionSecret);
        storage.logAction(userRecord.id, 'LOGIN', `Đăng nhập vai trò ${userRecord.role}`);
        const user = storage.getUserById(userRecord.id);
        return sendJson(res, 200, { user, csrfToken: csrf }, {
          'Set-Cookie': `toan_thcs_sid=${encodeURIComponent(sid)}; HttpOnly; Path=/; SameSite=Lax; Max-Age=43200`
        });
      }

      // Dang xuat
      if (pathname === '/api/auth/logout' && method === 'POST') {
        if (!verifyCsrf(req, session)) return sendJson(res, 403, { error: 'Yêu cầu không hợp lệ (CSRF).' });
        return sendJson(res, 200, { ok: true }, {
          'Set-Cookie': 'toan_thcs_sid=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0'
        });
      }

      // Thong tin phien hien tai
      if (pathname === '/api/auth/me' && method === 'GET') {
        if (!session) return sendJson(res, 200, { user: null, csrfToken: null });
        return sendJson(res, 200, { user: session.user, csrfToken: session.csrf });
      }

      // Doi mat khau ca nhan
      if (pathname === '/api/auth/change-password' && method === 'POST') {
        if (!session) return sendJson(res, 401, { error: 'Bạn cần đăng nhập.' });
        if (!verifyCsrf(req, session)) return sendJson(res, 403, { error: 'CSRF token không hợp lệ.' });
        const body = await readJsonBody(req);
        const oldPass = String(body.oldPassword || '');
        const newPass = String(body.newPassword || '');
        if (newPass.length < 6) {
          return sendJson(res, 400, { error: 'Mật khẩu mới phải có ít nhất 6 ký tự.' });
        }
        const rawUser = storage.getUserByUsername(session.user.username);
        if (!rawUser || !verifyPassword(oldPass, rawUser.passwordHash)) {
          return sendJson(res, 400, { error: 'Mật khẩu hiện tại không đúng.' });
        }
        storage.updateUser(session.user.id, { password: newPass, mustChangePassword: false });
        storage.logAction(session.user.id, 'CHANGE_PASSWORD', 'Tự đổi mật khẩu');
        return sendJson(res, 200, { ok: true });
      }

      // Chuong trinh GDPT 2018
      if (pathname === '/api/curriculum' && method === 'GET') {
        return sendJson(res, 200, storage.curriculum);
      }

      // Lay danh sach cau hoi luyen tap / kiem tra
      if (pathname === '/api/questions' && method === 'GET') {
        const filters = {
          grade: urlObj.searchParams.get('grade'),
          textbook: urlObj.searchParams.get('textbook'),
          semester: urlObj.searchParams.get('semester'),
          topic: urlObj.searchParams.get('topic'),
          level: urlObj.searchParams.get('level'),
          type: urlObj.searchParams.get('type'),
          search: urlObj.searchParams.get('search')
        };
        const includeAnswer = urlObj.searchParams.get('includeAnswer') === '1';
        const isStaff = session && (session.user.role === 'teacher' || session.user.role === 'admin');
        let list = storage.listQuestions(filters);

        // Loc cau tung lam sai neu hoc sinh dang nhap chon che do "wrong_only"
        if (urlObj.searchParams.get('wrongOnly') === '1' && session) {
          const myAttempts = storage.listAttempts({ userId: session.user.id });
          const wrongIds = new Set();
          for (const at of myAttempts) {
            for (const ans of at.answers || []) {
              if (!ans.isCorrect && ans.questionId) wrongIds.add(ans.questionId);
            }
          }
          list = list.filter((q) => wrongIds.has(q.id));
        }

        if (includeAnswer && isStaff) {
          return sendJson(res, 200, { questions: list });
        }
        // Khi tra ve cho hoc sinh luyen tap hoac thi, an dap an o che do exam neu client yeu cau
        const sanitized = list.map((q) => {
          if (urlObj.searchParams.get('mode') === 'exam') {
            const { answer, acceptedAnswers, solutionSteps, commonMistake, rubricKeywords, ...rest } = q;
            if (rest.statements) {
              rest.statements = rest.statements.map(({ isTrue, ...s }) => s);
            }
            return rest;
          }
          return q;
        });
        return sendJson(res, 200, { questions: sanitized });
      }

      // Kiem tra tung cau ngay lap tuc (che do luyen tap / tro choi)
      if (pathname === '/api/practice/check' && method === 'POST') {
        const body = await readJsonBody(req);
        const q = storage.getQuestionById(body.questionId);
        if (!q) return sendJson(res, 404, { error: 'Không tìm thấy câu hỏi.' });
        const result = gradeQuestion(q, body.answer);
        return sendJson(res, 200, {
          ...result,
          solutionSteps: q.solutionSteps,
          commonMistake: q.commonMistake
        });
      }

      // Nop bai luyen tap hoac kiem tra (cham diem phia may chu + luu lich su neu da dang nhap)
      if (pathname === '/api/attempts' && method === 'POST') {
        if (!verifyCsrf(req, session)) return sendJson(res, 403, { error: 'CSRF token không hợp lệ.' });
        const body = await readJsonBody(req);
        const items = Array.isArray(body.items) ? body.items : [];
        if (items.length === 0) return sendJson(res, 400, { error: 'Không có câu trả lời nào để nộp.' });

        let totalScore = 0;
        let maxScore = 0;
        let correctCount = 0;
        let needsManual = false;
        const gradedAnswers = [];

        for (const item of items) {
          const q = storage.getQuestionById(item.questionId);
          if (!q) continue;
          const resGrade = gradeQuestion(q, item.answer);
          totalScore += resGrade.score;
          maxScore += resGrade.maxScore;
          if (resGrade.isCorrect) correctCount++;
          if (resGrade.needsManualGrading) needsManual = true;
          gradedAnswers.push({
            questionId: q.id,
            code: q.code,
            topic: q.topic,
            type: q.type,
            prompt: q.prompt,
            userAnswer: item.answer,
            isCorrect: resGrade.isCorrect,
            score: resGrade.score,
            maxScore: resGrade.maxScore,
            needsManualGrading: resGrade.needsManualGrading,
            expectedDisplay: resGrade.expectedDisplay,
            solutionSteps: q.solutionSteps,
            commonMistake: q.commonMistake,
            teacherComment: ''
          });
        }

        const percentage = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;
        const attemptRecord = {
          userId: session ? session.user.id : 'guest',
          assignmentId: body.assignmentId || null,
          mode: String(body.mode || 'practice'),
          grade: Number(body.grade) || 6,
          textbook: String(body.textbook || 'kntt'),
          topic: String(body.topic || ''),
          level: Number(body.level) || 0,
          adaptiveEnabled: Boolean(body.adaptiveEnabled),
          startedAt: body.startedAt || new Date().toISOString(),
          submittedAt: new Date().toISOString(),
          durationSeconds: Math.max(1, Number(body.durationSeconds) || 1),
          score: Math.round(totalScore * 10) / 10,
          maxScore,
          percentage,
          correctCount,
          totalCount: gradedAnswers.length,
          status: needsManual ? 'needs_grading' : 'graded',
          answers: gradedAnswers
        };

        let saved = attemptRecord;
        const newlyEarnedBadges = [];
        if (session) {
          saved = storage.saveAttempt(attemptRecord);
          const allMine = storage.listAttempts({ userId: session.user.id });
          if (allMine.length >= 1) {
            const b = storage.awardBadgeIfNew(session.user.id, 'FIRST_STEP', 'Khởi đầu vững chắc', 'Hoàn thành bài ôn luyện đầu tiên trên hệ thống.');
            if (b) newlyEarnedBadges.push(b);
          }
          if (percentage === 100 && gradedAnswers.length >= 5) {
            const b = storage.awardBadgeIfNew(session.user.id, 'PERFECT_100', 'Điểm 10 tuyệt đối', 'Đạt 100% số điểm trong bài từ 5 câu trở lên.');
            if (b) newlyEarnedBadges.push(b);
          }
          if (allMine.length >= 5) {
            const b = storage.awardBadgeIfNew(session.user.id, 'PERSISTENT_5', 'Chăm chỉ mỗi ngày', 'Hoàn thành từ 5 lượt ôn luyện trở lên.');
            if (b) newlyEarnedBadges.push(b);
          }
        }

        return sendJson(res, 200, { attempt: saved, newlyEarnedBadges });
      }

      // Lich su lam bai va lo trinh ca nhan cua hoc sinh dang nhap
      if (pathname === '/api/student/overview' && method === 'GET') {
        if (!session) return sendJson(res, 401, { error: 'Vui lòng đăng nhập để xem hồ sơ học tập.' });
        const attempts = storage.listAttempts({ userId: session.user.id });
        const badges = storage.listBadges(session.user.id);
        const assignments = storage.listAssignments({ classId: session.user.classId });
        const recommendations = buildPersonalizedRecommendations(attempts, storage.curriculum.topics);
        return sendJson(res, 200, { attempts, badges, assignments, recommendations });
      }

      // ======================================================================
      // CAC API DANH CHO GIAO VIEN & QUAN TRI VIEN (RBAC BAT BUOC)
      // ======================================================================
      if (pathname.startsWith('/api/teacher/') || (pathname === '/api/questions' && method !== 'GET') || pathname.startsWith('/api/questions/') || pathname.startsWith('/api/assignments') || pathname.startsWith('/api/classes')) {
        if (!session) return sendJson(res, 401, { error: 'Bạn cần đăng nhập tài khoản Giáo viên hoặc Quản trị.' });
        if (!verifyCsrf(req, session)) return sendJson(res, 403, { error: 'CSRF token không hợp lệ.' });
        if (method !== 'GET' && session.user.role !== 'teacher' && session.user.role !== 'admin') {
          return sendJson(res, 403, { error: 'Tài khoản học sinh không có quyền thực hiện thao tác này.' });
        }
      }

      // Them / Sua cau hoi
      if (pathname === '/api/questions' && method === 'POST') {
        const body = await readJsonBody(req);
        if (!body.prompt || !body.type) return sendJson(res, 400, { error: 'Thiếu nội dung đề bài hoặc dạng câu hỏi.' });
        const saved = storage.upsertQuestion(body, session.user.id);
        storage.logAction(session.user.id, 'UPSERT_QUESTION', `Lưu câu hỏi ${saved.code}`);
        return sendJson(res, 200, { question: saved });
      }

      if (pathname.startsWith('/api/questions/') && method === 'DELETE') {
        const qId = pathname.split('/').pop();
        const ok = storage.deleteQuestion(qId);
        if (!ok) return sendJson(res, 404, { error: 'Không tìm thấy câu hỏi cần xóa.' });
        storage.logAction(session.user.id, 'DELETE_QUESTION', `Xóa câu hỏi ${qId}`);
        return sendJson(res, 200, { ok: true });
      }

      if (pathname === '/api/teacher/questions/import' && method === 'POST') {
        const body = await readJsonBody(req);
        const list = Array.isArray(body.questions) ? body.questions : [];
        if (list.length === 0) return sendJson(res, 400, { error: 'Danh sách câu hỏi nhập vào đang trống.' });
        let count = 0;
        for (const item of list) {
          if (item && item.prompt) {
            storage.upsertQuestion(item, session.user.id);
            count++;
          }
        }
        storage.logAction(session.user.id, 'IMPORT_QUESTIONS', `Nhập ${count} câu hỏi`);
        return sendJson(res, 200, { imported: count });
      }

      // Danh sach lop hoc (cho phep doc voi tat ca nguoi da dang nhap hoac giao vien)
      if (pathname === '/api/classes' && method === 'GET') {
        return sendJson(res, 200, { classes: storage.listClasses() });
      }
      if (pathname === '/api/classes' && method === 'POST') {
        const body = await readJsonBody(req);
        if (!body.name || !body.grade) return sendJson(res, 400, { error: 'Thiếu tên lớp hoặc khối lớp.' });
        const cls = storage.createClass({ ...body, teacherId: session.user.id });
        storage.logAction(session.user.id, 'CREATE_CLASS', `Tạo lớp ${cls.name}`);
        return sendJson(res, 200, { classItem: cls });
      }
      if (pathname.startsWith('/api/classes/') && method === 'DELETE') {
        const clsId = pathname.split('/').pop();
        const ok = storage.deleteClass(clsId);
        return sendJson(res, ok ? 200 : 404, ok ? { ok: true } : { error: 'Không tìm thấy lớp.' });
      }

      // Giao bai tap & de kiem tra
      if (pathname === '/api/assignments' && method === 'GET') {
        return sendJson(res, 200, { assignments: storage.listAssignments() });
      }
      if (pathname === '/api/assignments' && method === 'POST') {
        const body = await readJsonBody(req);
        if (!body.title) return sendJson(res, 400, { error: 'Vui lòng nhập tiêu đề bài giao.' });
        const asg = storage.createAssignment(body, session.user.id);
        storage.logAction(session.user.id, 'CREATE_ASSIGNMENT', `Giao bài "${asg.title}"`);
        return sendJson(res, 200, { assignment: asg });
      }
      if (pathname.startsWith('/api/assignments/') && method === 'DELETE') {
        const id = pathname.split('/').pop();
        const ok = storage.deleteAssignment(id);
        return sendJson(res, ok ? 200 : 404, ok ? { ok: true } : { error: 'Không tìm thấy bài giao.' });
      }

      // Bang dieu khien thong ke giao vien
      if (pathname === '/api/teacher/dashboard' && method === 'GET') {
        if (session.user.role !== 'teacher' && session.user.role !== 'admin') {
          return sendJson(res, 403, { error: 'Không có quyền truy cập thống kê giáo viên.' });
        }
        const students = storage.listUsers().filter((u) => u.role === 'student');
        const classes = storage.listClasses();
        const attempts = storage.listAttempts();
        const assignments = storage.listAssignments();

        const scores = attempts.map((a) => a.percentage);
        const avgPct = scores.length ? Math.round(scores.reduce((s, v) => s + v, 0) / scores.length) : 0;
        const maxPct = scores.length ? Math.max(...scores) : 0;
        const minPct = scores.length ? Math.min(...scores) : 0;

        const topicAgg = new Map();
        const studentAgg = new Map();
        for (const s of students) {
          studentAgg.set(s.id, { user: s, attemptsCount: 0, answeredCount: 0, correctCount: 0, scores: [] });
        }
        for (const at of attempts) {
          const stEntry = studentAgg.get(at.userId);
          if (stEntry) {
            stEntry.attemptsCount += 1;
            stEntry.answeredCount += at.totalCount;
            stEntry.correctCount += at.correctCount;
            stEntry.scores.push(at.percentage);
          }
          for (const ans of at.answers || []) {
            if (!ans.topic) continue;
            if (!topicAgg.has(ans.topic)) topicAgg.set(ans.topic, { topic: ans.topic, total: 0, correct: 0 });
            const tEntry = topicAgg.get(ans.topic);
            tEntry.total += 1;
            if (ans.isCorrect) tEntry.correct += 1;
          }
        }

        const topicMap = new Map((storage.curriculum.topics || []).map((t) => [t.key, t.name]));
        const topicStats = [...topicAgg.values()].map((t) => ({
          topic: t.topic,
          topicName: topicMap.get(t.topic) || t.topic,
          total: t.total,
          correct: t.correct,
          accuracy: t.total > 0 ? Math.round((t.correct / t.total) * 100) : 0
        }));

        const studentSummaries = [...studentAgg.values()].map((s) => {
          const avg = s.scores.length ? Math.round(s.scores.reduce((a, b) => a + b, 0) / s.scores.length) : null;
          return {
            ...s.user,
            attemptsCount: s.attemptsCount,
            answeredCount: s.answeredCount,
            correctCount: s.correctCount,
            avgPercentage: avg,
            needsSupport: s.answeredCount >= 5 && avg !== null && avg < 60
          };
        });

        const assignedStudentIds = new Set();
        for (const a of assignments) {
          for (const s of students) {
            if (!a.classId || a.classId === s.classId) assignedStudentIds.add(s.id);
          }
        }
        const studentsCompleted = new Set(attempts.filter((a) => a.assignmentId).map((a) => a.userId)).size;
        const completionRate = assignedStudentIds.size > 0 ? Math.round((studentsCompleted / assignedStudentIds.size) * 100) : 0;

        return sendJson(res, 200, {
          totalStudents: students.length,
          totalAttempts: attempts.length,
          completionRate,
          avgPercentage: avgPct,
          maxPercentage: maxPct,
          minPercentage: minPct,
          topicStats,
          studentSummaries,
          pendingGrading: attempts.filter((a) => a.status === 'needs_grading'),
          recentAttempts: attempts.slice(0, 30),
          classes
        });
      }

      // Giao vien cham bai tu luan ngan
      if (pathname.startsWith('/api/teacher/grade/') && method === 'POST') {
        const attemptId = pathname.split('/').pop();
        const attempt = storage.getAttemptById(attemptId);
        if (!attempt) return sendJson(res, 404, { error: 'Không tìm thấy bài làm.' });
        const body = await readJsonBody(req);
        const updates = Array.isArray(body.updates) ? body.updates : [];
        const updatedAnswers = attempt.answers.map((ans) => {
          const patch = updates.find((u) => u.questionId === ans.questionId);
          if (!patch) return ans;
          const nextScore = Math.min(ans.maxScore, Math.max(0, Number(patch.score) || 0));
          return {
            ...ans,
            score: nextScore,
            isCorrect: nextScore >= ans.maxScore * 0.6,
            needsManualGrading: false,
            teacherComment: String(patch.teacherComment || '').trim()
          };
        });
        const totalScore = Math.round(updatedAnswers.reduce((s, a) => s + Number(a.score || 0), 0) * 10) / 10;
        const stillPending = updatedAnswers.some((a) => a.needsManualGrading);
        const saved = storage.updateAttemptGrading(attemptId, updatedAnswers, totalScore, attempt.maxScore, stillPending ? 'needs_grading' : 'graded');
        storage.logAction(session.user.id, 'GRADE_ATTEMPT', `Chấm bài ${attemptId}: ${totalScore}/${attempt.maxScore}`);
        return sendJson(res, 200, { attempt: saved });
      }

      // Xuat bao cao CSV (mo bang Excel co dau tieng Viet chuan UTF-8 BOM)
      if (pathname === '/api/teacher/export-csv' && method === 'GET') {
        if (session.user.role !== 'teacher' && session.user.role !== 'admin') {
          return sendJson(res, 403, { error: 'Không có quyền xuất báo cáo.' });
        }
        const usersMap = new Map(storage.listUsers().map((u) => [u.id, u]));
        const classMap = new Map(storage.listClasses().map((c) => [c.id, c.name]));
        const attempts = storage.listAttempts();
        const header = ['Mã HS', 'Họ và tên', 'Lớp', 'Khối', 'Bộ sách', 'Chế độ', 'Số câu đúng', 'Tổng câu', 'Điểm', 'Điểm tối đa', 'Tỉ lệ (%)', 'Thời gian (giây)', 'Ngày nộp'];
        const lines = [header.map(sanitizeCsvCell).join(',')];
        for (const a of attempts) {
          const u = usersMap.get(a.userId) || { studentCode: 'KHACH', fullName: 'Học sinh tự luyện', classId: null };
          const clsName = u.classId ? (classMap.get(u.classId) || '') : '';
          lines.push([
            u.studentCode, u.fullName, clsName, a.grade, a.textbook.toUpperCase(), a.mode,
            a.correctCount, a.totalCount, a.score, a.maxScore, a.percentage, a.durationSeconds, a.submittedAt
          ].map(sanitizeCsvCell).join(','));
        }
        const csvContent = '\uFEFF' + lines.join('\r\n');
        res.writeHead(200, {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="bao-cao-on-luyen-toan-thcs.csv"',
          'Cache-Control': 'no-store'
        });
        res.end(csvContent);
        return;
      }

      // ======================================================================
      // QUAN TRI TAI KHOAN, SAO LUU & KHOI PHUC DU LIEU
      // ======================================================================
      if (pathname === '/api/users' && method === 'GET') {
        if (!session || (session.user.role !== 'admin' && session.user.role !== 'teacher')) {
          return sendJson(res, 403, { error: 'Không có quyền xem danh sách tài khoản.' });
        }
        const users = storage.listUsers();
        return sendJson(res, 200, {
          users: session.user.role === 'admin' ? users : users.filter((u) => u.role === 'student')
        });
      }

      if (pathname === '/api/users' && method === 'POST') {
        if (!session || (session.user.role !== 'admin' && session.user.role !== 'teacher')) {
          return sendJson(res, 403, { error: 'Không có quyền tạo tài khoản.' });
        }
        if (!verifyCsrf(req, session)) return sendJson(res, 403, { error: 'CSRF token không hợp lệ.' });
        const body = await readJsonBody(req);
        if (!body.username || !body.fullName || !body.password) {
          return sendJson(res, 400, { error: 'Vui lòng nhập tên đăng nhập, họ tên và mật khẩu.' });
        }
        if (String(body.password).length < 6) {
          return sendJson(res, 400, { error: 'Mật khẩu tối thiểu 6 ký tự.' });
        }
        const targetRole = session.user.role === 'admin' ? (body.role || 'student') : 'student';
        const created = storage.createUser({
          username: body.username,
          studentCode: body.studentCode || `HS-${Date.now().toString(36).toUpperCase()}`,
          fullName: body.fullName,
          role: targetRole,
          classId: body.classId || null,
          password: body.password,
          mustChangePassword: true
        });
        storage.logAction(session.user.id, 'CREATE_USER', `Tạo tài khoản ${created.username} (${created.role})`);
        return sendJson(res, 200, { user: created });
      }

      if (pathname.startsWith('/api/users/') && method === 'DELETE') {
        if (!session || session.user.role !== 'admin') {
          return sendJson(res, 403, { error: 'Chỉ Quản trị viên mới được xóa tài khoản.' });
        }
        if (!verifyCsrf(req, session)) return sendJson(res, 403, { error: 'CSRF token không hợp lệ.' });
        const targetId = pathname.split('/').pop();
        if (targetId === session.user.id) {
          return sendJson(res, 400, { error: 'Không thể tự xóa tài khoản đang đăng nhập.' });
        }
        const ok = storage.deleteUser(targetId);
        storage.logAction(session.user.id, 'DELETE_USER', `Xóa tài khoản ${targetId}`);
        return sendJson(res, ok ? 200 : 404, ok ? { ok: true } : { error: 'Không tìm thấy tài khoản.' });
      }

      if (pathname.startsWith('/api/users/') && pathname.endsWith('/attempts') && method === 'DELETE') {
        if (!session || (session.user.role !== 'admin' && session.user.role !== 'teacher')) {
          return sendJson(res, 403, { error: 'Không có quyền xóa lịch sử làm bài.' });
        }
        if (!verifyCsrf(req, session)) return sendJson(res, 403, { error: 'CSRF token không hợp lệ.' });
        const parts = pathname.split('/');
        const targetId = parts[3];
        const removed = storage.deleteAttemptsForUser(targetId);
        storage.logAction(session.user.id, 'PURGE_ATTEMPTS', `Xóa ${removed} lượt làm bài của ${targetId}`);
        return sendJson(res, 200, { removed });
      }

      if (pathname === '/api/admin/backup' && method === 'GET') {
        if (!session || session.user.role !== 'admin') {
          return sendJson(res, 403, { error: 'Chỉ Quản trị viên mới được sao lưu toàn hệ thống.' });
        }
        const snapshot = storage.exportBackup();
        storage.logAction(session.user.id, 'EXPORT_BACKUP', 'Xuất bản sao lưu toàn hệ thống');
        res.writeHead(200, {
          'Content-Type': 'application/json; charset=utf-8',
          'Content-Disposition': `attachment; filename="backup-toan-thcs-${new Date().toISOString().slice(0, 10)}.json"`,
          'Cache-Control': 'no-store'
        });
        res.end(JSON.stringify(snapshot, null, 2));
        return;
      }

      if (pathname === '/api/admin/restore' && method === 'POST') {
        if (!session || session.user.role !== 'admin') {
          return sendJson(res, 403, { error: 'Chỉ Quản trị viên mới được khôi phục dữ liệu.' });
        }
        if (!verifyCsrf(req, session)) return sendJson(res, 403, { error: 'CSRF token không hợp lệ.' });
        const body = await readJsonBody(req);
        storage.restoreBackup(body);
        storage.logAction(session.user.id, 'RESTORE_BACKUP', 'Khôi phục dữ liệu từ file sao lưu');
        return sendJson(res, 200, { ok: true });
      }

      if (pathname === '/api/admin/logs' && method === 'GET') {
        if (!session || session.user.role !== 'admin') {
          return sendJson(res, 403, { error: 'Không có quyền xem nhật ký.' });
        }
        return sendJson(res, 200, { logs: storage.listAuditLogs(50) });
      }

      return sendJson(res, 404, { error: 'API không tồn tại.' });
    } catch (err) {
      return sendJson(res, 500, { error: err?.message || 'Lỗi máy chủ nội bộ.' });
    }
  };
}
