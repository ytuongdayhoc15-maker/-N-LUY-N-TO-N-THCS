import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password, storedHash) {
  if (!storedHash || typeof storedHash !== 'string' || !storedHash.includes(':')) return false;
  const [salt, expectedHex] = storedHash.split(':');
  try {
    const derived = crypto.scryptSync(String(password), salt, 64);
    const expected = Buffer.from(expectedHex, 'hex');
    if (derived.length !== expected.length) return false;
    return crypto.timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

export function sanitizeCsvCell(val) {
  let s = String(val ?? '').replace(/\r?\n/g, ' ');
  // Chong loi CSV formula injection tren Excel
  if (/^[=+\-@\t\r]/.test(s)) {
    s = "'" + s;
  }
  if (s.includes('"') || s.includes(',')) {
    s = '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

export function normalizeQuestionRecord(q, fallbackCreator = 'system') {
  const now = new Date().toISOString();
  return {
    id: q.id || crypto.randomUUID(),
    code: String(q.code || `Q-${Date.now().toString(36).toUpperCase()}`).trim(),
    grade: Number(q.grade) || 6,
    textbooks: Array.isArray(q.textbooks) && q.textbooks.length > 0 ? q.textbooks : ['kntt', 'ctst', 'cd'],
    semester: Number(q.semester) || 1,
    topic: String(q.topic || 'so-tu-nhien').trim(),
    lessonTitle: String(q.lessonTitle || '').trim(),
    level: Math.min(3, Math.max(1, Number(q.level) || 1)),
    type: String(q.type || 'mcq').trim(),
    inputType: q.inputType || undefined,
    prompt: String(q.prompt || '').trim(),
    svgSpec: q.svgSpec || null,
    options: Array.isArray(q.options) ? q.options : undefined,
    statements: Array.isArray(q.statements) ? q.statements : undefined,
    pairs: Array.isArray(q.pairs) ? q.pairs : undefined,
    steps: Array.isArray(q.steps) ? q.steps : undefined,
    workSteps: Array.isArray(q.workSteps) ? q.workSteps : undefined,
    rubricKeywords: Array.isArray(q.rubricKeywords) ? q.rubricKeywords : undefined,
    acceptedAnswers: Array.isArray(q.acceptedAnswers) ? q.acceptedAnswers : undefined,
    answer: q.answer,
    maxScore: q.maxScore ? Number(q.maxScore) : undefined,
    solutionSteps: Array.isArray(q.solutionSteps) ? q.solutionSteps : [],
    commonMistake: String(q.commonMistake || '').trim(),
    points: Number(q.points) || 10,
    estimatedSeconds: Number(q.estimatedSeconds) || 45,
    createdBy: q.createdBy || fallbackCreator,
    updatedAt: q.updatedAt || now
  };
}

export async function createStorage(baseDir) {
  const dataDir = path.join(baseDir, 'data');
  fs.mkdirSync(dataDir, { recursive: true });

  const curriculumPath = path.join(dataDir, 'curriculum.json');
  const seedQuestionsPath = path.join(dataDir, 'questions.json');
  const curriculum = fs.existsSync(curriculumPath)
    ? JSON.parse(fs.readFileSync(curriculumPath, 'utf8'))
    : { textbooks: [], grades: {}, topics: [] };

  const seedQuestionsRaw = fs.existsSync(seedQuestionsPath)
    ? JSON.parse(fs.readFileSync(seedQuestionsPath, 'utf8'))
    : [];

  let sqliteMod = null;
  if (!process.env.FORCE_JSON_STORAGE) {
    try {
      sqliteMod = await import('node:sqlite');
    } catch {
      sqliteMod = null;
    }
  }

  const secretPath = path.join(dataDir, '.session_secret');
  let sessionSecret = process.env.SESSION_SECRET || '';
  if (!sessionSecret) {
    if (fs.existsSync(secretPath)) {
      sessionSecret = fs.readFileSync(secretPath, 'utf8').trim();
    } else {
      sessionSecret = crypto.randomBytes(32).toString('hex');
      fs.writeFileSync(secretPath, sessionSecret, { mode: 0o600 });
    }
  }

  const defaultSeedData = () => {
    const now = new Date().toISOString();
    const classes = [
      { id: 'cls-6a1', name: '6A1', grade: 6, textbook: 'kntt', teacherId: 'usr-teacher-1', schoolYear: '2026-2027' },
      { id: 'cls-7a1', name: '7A1', grade: 7, textbook: 'kntt', teacherId: 'usr-teacher-1', schoolYear: '2026-2027' },
      { id: 'cls-8a1', name: '8A1', grade: 8, textbook: 'ctst', teacherId: 'usr-teacher-1', schoolYear: '2026-2027' },
      { id: 'cls-9a1', name: '9A1', grade: 9, textbook: 'cd', teacherId: 'usr-teacher-1', schoolYear: '2026-2027' }
    ];

    // Tai khoan khoi tao de kiem thu 3 vai tro (mat khau duoc bam bang scrypt)
    const users = [
      {
        id: 'usr-admin-1',
        username: 'admin',
        studentCode: 'QT-001',
        fullName: 'Quản trị hệ thống',
        role: 'admin',
        classId: null,
        passwordHash: hashPassword('Admin@2026'),
        mustChangePassword: 0,
        createdAt: now
      },
      {
        id: 'usr-teacher-1',
        username: 'gv_toan',
        studentCode: 'GV-001',
        fullName: 'Cô Nguyễn Minh Anh',
        role: 'teacher',
        classId: null,
        passwordHash: hashPassword('GiaoVien@2026'),
        mustChangePassword: 0,
        createdAt: now
      },
      {
        id: 'usr-student-1',
        username: 'hs_an',
        studentCode: 'HS6A101',
        fullName: 'Trần Gia An',
        role: 'student',
        classId: 'cls-6a1',
        passwordHash: hashPassword('HocSinh@2026'),
        mustChangePassword: 0,
        createdAt: now
      },
      {
        id: 'usr-student-2',
        username: 'hs_binh',
        studentCode: 'HS8A102',
        fullName: 'Lê Thanh Bình',
        role: 'student',
        classId: 'cls-8a1',
        passwordHash: hashPassword('HocSinh@2026'),
        mustChangePassword: 0,
        createdAt: now
      },
      {
        id: 'usr-student-3',
        username: 'hs_chi',
        studentCode: 'HS9A103',
        fullName: 'Phạm Bảo Chi',
        role: 'student',
        classId: 'cls-9a1',
        passwordHash: hashPassword('HocSinh@2026'),
        mustChangePassword: 0,
        createdAt: now
      }
    ];

    const questions = seedQuestionsRaw.map((q) => normalizeQuestionRecord(q, 'system'));

    // Giao 2 bai mau co that (khong gia lap ket qua lam bai cua hoc sinh)
    const assignments = [
      {
        id: 'asg-demo-6',
        title: 'Phiếu ôn tập Chương I–III Toán 6',
        teacherId: 'usr-teacher-1',
        classId: 'cls-6a1',
        mode: 'chapter',
        grade: 6,
        textbook: 'kntt',
        topic: '',
        level: 0,
        questionIds: questions.filter((q) => q.grade === 6).slice(0, 5).map((q) => q.id),
        durationMinutes: 15,
        revealSolutionMode: 'after_submit',
        dueDate: '2026-12-30',
        createdAt: now
      },
      {
        id: 'asg-demo-9',
        title: 'Kiểm tra 15 phút – Căn thức & Hệ phương trình',
        teacherId: 'usr-teacher-1',
        classId: 'cls-9a1',
        mode: 'test_15m',
        grade: 9,
        textbook: 'cd',
        topic: '',
        level: 0,
        questionIds: questions.filter((q) => q.grade === 9).slice(0, 5).map((q) => q.id),
        durationMinutes: 15,
        revealSolutionMode: 'after_submit',
        dueDate: '2026-12-30',
        createdAt: now
      }
    ];

    return { users, classes, questions, assignments, attempts: [], badges: [], auditLogs: [] };
  };

  // ============================================================================
  // BACKEND 1: SQLITE (node:sqlite DatabaseSync - Node 22.5+)
  // ============================================================================
  if (sqliteMod && sqliteMod.DatabaseSync) {
    const dbPath = path.join(dataDir, 'toan_thcs.db');
    const db = new sqliteMod.DatabaseSync(dbPath);
    db.exec('PRAGMA journal_mode = WAL;');
    db.exec('PRAGMA foreign_keys = ON;');

    db.exec(`
      CREATE TABLE IF NOT EXISTS classes (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        grade INTEGER NOT NULL,
        textbook TEXT NOT NULL,
        teacherId TEXT,
        schoolYear TEXT
      );
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        studentCode TEXT NOT NULL,
        fullName TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('admin','teacher','student')),
        classId TEXT,
        passwordHash TEXT NOT NULL,
        mustChangePassword INTEGER DEFAULT 0,
        createdAt TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS questions (
        id TEXT PRIMARY KEY,
        code TEXT UNIQUE NOT NULL,
        grade INTEGER NOT NULL,
        textbooksJson TEXT NOT NULL,
        semester INTEGER NOT NULL,
        topic TEXT NOT NULL,
        lessonTitle TEXT,
        level INTEGER NOT NULL,
        type TEXT NOT NULL,
        prompt TEXT NOT NULL,
        dataJson TEXT NOT NULL,
        points INTEGER NOT NULL,
        estimatedSeconds INTEGER NOT NULL,
        createdBy TEXT,
        updatedAt TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS assignments (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        teacherId TEXT NOT NULL,
        classId TEXT,
        mode TEXT NOT NULL,
        grade INTEGER NOT NULL,
        textbook TEXT NOT NULL,
        topic TEXT,
        level INTEGER DEFAULT 0,
        questionIdsJson TEXT NOT NULL,
        durationMinutes INTEGER NOT NULL,
        revealSolutionMode TEXT NOT NULL,
        dueDate TEXT,
        createdAt TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS attempts (
        id TEXT PRIMARY KEY,
        userId TEXT NOT NULL,
        assignmentId TEXT,
        mode TEXT NOT NULL,
        grade INTEGER NOT NULL,
        textbook TEXT NOT NULL,
        topic TEXT,
        level INTEGER DEFAULT 0,
        adaptiveEnabled INTEGER DEFAULT 0,
        startedAt TEXT NOT NULL,
        submittedAt TEXT NOT NULL,
        durationSeconds INTEGER NOT NULL,
        score REAL NOT NULL,
        maxScore REAL NOT NULL,
        percentage REAL NOT NULL,
        correctCount INTEGER NOT NULL,
        totalCount INTEGER NOT NULL,
        status TEXT NOT NULL,
        answersJson TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS badges (
        id TEXT PRIMARY KEY,
        userId TEXT NOT NULL,
        badgeCode TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        awardedAt TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS audit_logs (
        id TEXT PRIMARY KEY,
        userId TEXT,
        action TEXT NOT NULL,
        detail TEXT,
        createdAt TEXT NOT NULL
      );
    `);

    const countRow = db.prepare('SELECT COUNT(*) AS cnt FROM users').get();
    if (!countRow || countRow.cnt === 0) {
      const seed = defaultSeedData();
      db.exec('BEGIN');
      try {
        const insClass = db.prepare('INSERT INTO classes (id, name, grade, textbook, teacherId, schoolYear) VALUES (?, ?, ?, ?, ?, ?)');
        for (const c of seed.classes) insClass.run(c.id, c.name, c.grade, c.textbook, c.teacherId, c.schoolYear);

        const insUser = db.prepare('INSERT INTO users (id, username, studentCode, fullName, role, classId, passwordHash, mustChangePassword, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
        for (const u of seed.users) insUser.run(u.id, u.username, u.studentCode, u.fullName, u.role, u.classId, u.passwordHash, u.mustChangePassword, u.createdAt);

        const insQ = db.prepare('INSERT INTO questions (id, code, grade, textbooksJson, semester, topic, lessonTitle, level, type, prompt, dataJson, points, estimatedSeconds, createdBy, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
        for (const q of seed.questions) {
          const { id, code, grade, textbooks, semester, topic, lessonTitle, level, type, prompt, points, estimatedSeconds, createdBy, updatedAt, ...rest } = q;
          insQ.run(id, code, grade, JSON.stringify(textbooks), semester, topic, lessonTitle, level, type, prompt, JSON.stringify(rest), points, estimatedSeconds, createdBy, updatedAt);
        }

        const insA = db.prepare('INSERT INTO assignments (id, title, teacherId, classId, mode, grade, textbook, topic, level, questionIdsJson, durationMinutes, revealSolutionMode, dueDate, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
        for (const a of seed.assignments) {
          insA.run(a.id, a.title, a.teacherId, a.classId, a.mode, a.grade, a.textbook, a.topic, a.level, JSON.stringify(a.questionIds), a.durationMinutes, a.revealSolutionMode, a.dueDate, a.createdAt);
        }
        db.exec('COMMIT');
      } catch (err) {
        db.exec('ROLLBACK');
        throw err;
      }
    }

    const rowToQuestion = (r) => {
      const extra = JSON.parse(r.dataJson || '{}');
      return {
        id: r.id,
        code: r.code,
        grade: r.grade,
        textbooks: JSON.parse(r.textbooksJson || '[]'),
        semester: r.semester,
        topic: r.topic,
        lessonTitle: r.lessonTitle,
        level: r.level,
        type: r.type,
        prompt: r.prompt,
        ...extra,
        points: r.points,
        estimatedSeconds: r.estimatedSeconds,
        createdBy: r.createdBy,
        updatedAt: r.updatedAt
      };
    };

    const sanitizeUser = (u) => u ? ({
      id: u.id,
      username: u.username,
      studentCode: u.studentCode,
      fullName: u.fullName,
      role: u.role,
      classId: u.classId,
      mustChangePassword: Boolean(u.mustChangePassword),
      createdAt: u.createdAt
    }) : null;

    return {
      engine: 'sqlite',
      sessionSecret,
      curriculum,
      dbPath,

      getUserByUsername(username) {
        return db.prepare('SELECT * FROM users WHERE username = ?').get(String(username).trim()) || null;
      },
      getUserById(id) {
        return sanitizeUser(db.prepare('SELECT * FROM users WHERE id = ?').get(id));
      },
      listUsers() {
        return db.prepare('SELECT * FROM users ORDER BY role, fullName').all().map(sanitizeUser);
      },
      createUser(input) {
        const id = input.id || crypto.randomUUID();
        const now = new Date().toISOString();
        db.prepare('INSERT INTO users (id, username, studentCode, fullName, role, classId, passwordHash, mustChangePassword, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
          .run(id, input.username.trim(), input.studentCode.trim(), input.fullName.trim(), input.role, input.classId || null, hashPassword(input.password), input.mustChangePassword ? 1 : 0, now);
        return this.getUserById(id);
      },
      updateUser(id, patch) {
        const cur = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
        if (!cur) return null;
        const nextPass = patch.password ? hashPassword(patch.password) : cur.passwordHash;
        db.prepare('UPDATE users SET studentCode = ?, fullName = ?, role = ?, classId = ?, passwordHash = ?, mustChangePassword = ? WHERE id = ?')
          .run(
            patch.studentCode !== undefined ? String(patch.studentCode).trim() : cur.studentCode,
            patch.fullName !== undefined ? String(patch.fullName).trim() : cur.fullName,
            patch.role !== undefined ? patch.role : cur.role,
            patch.classId !== undefined ? patch.classId : cur.classId,
            nextPass,
            patch.mustChangePassword !== undefined ? (patch.mustChangePassword ? 1 : 0) : cur.mustChangePassword,
            id
          );
        return this.getUserById(id);
      },
      deleteUser(id) {
        db.prepare('DELETE FROM badges WHERE userId = ?').run(id);
        db.prepare('DELETE FROM attempts WHERE userId = ?').run(id);
        const info = db.prepare('DELETE FROM users WHERE id = ?').run(id);
        return info.changes > 0;
      },

      listClasses() {
        return db.prepare('SELECT * FROM classes ORDER BY grade, name').all();
      },
      createClass(input) {
        const id = input.id || crypto.randomUUID();
        db.prepare('INSERT INTO classes (id, name, grade, textbook, teacherId, schoolYear) VALUES (?, ?, ?, ?, ?, ?)')
          .run(id, input.name.trim(), Number(input.grade), input.textbook || 'kntt', input.teacherId || null, input.schoolYear || '2026-2027');
        return db.prepare('SELECT * FROM classes WHERE id = ?').get(id);
      },
      deleteClass(id) {
        db.prepare('UPDATE users SET classId = NULL WHERE classId = ?').run(id);
        const info = db.prepare('DELETE FROM classes WHERE id = ?').run(id);
        return info.changes > 0;
      },

      listQuestions(filters = {}) {
        const clauses = [];
        const params = [];
        if (filters.grade) { clauses.push('grade = ?'); params.push(Number(filters.grade)); }
        if (filters.semester) { clauses.push('semester = ?'); params.push(Number(filters.semester)); }
        if (filters.topic) { clauses.push('topic = ?'); params.push(String(filters.topic)); }
        if (filters.level) { clauses.push('level = ?'); params.push(Number(filters.level)); }
        if (filters.type) { clauses.push('type = ?'); params.push(String(filters.type)); }
        if (filters.search) {
          clauses.push('(prompt LIKE ? OR code LIKE ? OR lessonTitle LIKE ?)');
          const kw = `%${String(filters.search).trim()}%`;
          params.push(kw, kw, kw);
        }
        const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
        let rows = db.prepare(`SELECT * FROM questions ${where} ORDER BY grade, semester, code`).all(...params).map(rowToQuestion);
        if (filters.textbook) {
          rows = rows.filter((q) => q.textbooks.includes(filters.textbook));
        }
        return rows;
      },
      getQuestionById(id) {
        const row = db.prepare('SELECT * FROM questions WHERE id = ?').get(id);
        return row ? rowToQuestion(row) : null;
      },
      upsertQuestion(raw, creatorId) {
        const q = normalizeQuestionRecord(raw, creatorId);
        const existing = db.prepare('SELECT id FROM questions WHERE id = ? OR code = ?').get(q.id, q.code);
        if (existing) q.id = existing.id;
        const { id, code, grade, textbooks, semester, topic, lessonTitle, level, type, prompt, points, estimatedSeconds, createdBy, updatedAt, ...rest } = q;
        db.prepare(`
          INSERT INTO questions (id, code, grade, textbooksJson, semester, topic, lessonTitle, level, type, prompt, dataJson, points, estimatedSeconds, createdBy, updatedAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            code=excluded.code, grade=excluded.grade, textbooksJson=excluded.textbooksJson, semester=excluded.semester,
            topic=excluded.topic, lessonTitle=excluded.lessonTitle, level=excluded.level, type=excluded.type,
            prompt=excluded.prompt, dataJson=excluded.dataJson, points=excluded.points, estimatedSeconds=excluded.estimatedSeconds,
            updatedAt=excluded.updatedAt
        `).run(id, code, grade, JSON.stringify(textbooks), semester, topic, lessonTitle, level, type, prompt, JSON.stringify(rest), points, estimatedSeconds, createdBy, new Date().toISOString());
        return this.getQuestionById(id);
      },
      deleteQuestion(id) {
        const info = db.prepare('DELETE FROM questions WHERE id = ?').run(id);
        return info.changes > 0;
      },

      listAssignments(filter = {}) {
        const rows = db.prepare('SELECT * FROM assignments ORDER BY createdAt DESC').all().map((a) => ({
          ...a,
          questionIds: JSON.parse(a.questionIdsJson || '[]')
        }));
        if (filter.classId) return rows.filter((a) => !a.classId || a.classId === filter.classId);
        return rows;
      },
      createAssignment(input, teacherId) {
        const id = crypto.randomUUID();
        const now = new Date().toISOString();
        db.prepare('INSERT INTO assignments (id, title, teacherId, classId, mode, grade, textbook, topic, level, questionIdsJson, durationMinutes, revealSolutionMode, dueDate, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
          .run(id, input.title.trim(), teacherId, input.classId || null, input.mode || 'lesson', Number(input.grade) || 6, input.textbook || 'kntt', input.topic || '', Number(input.level) || 0, JSON.stringify(input.questionIds || []), Number(input.durationMinutes) || 15, input.revealSolutionMode || 'after_submit', input.dueDate || null, now);
        const a = db.prepare('SELECT * FROM assignments WHERE id = ?').get(id);
        return { ...a, questionIds: JSON.parse(a.questionIdsJson || '[]') };
      },
      deleteAssignment(id) {
        return db.prepare('DELETE FROM assignments WHERE id = ?').run(id).changes > 0;
      },

      saveAttempt(attempt) {
        const id = attempt.id || crypto.randomUUID();
        db.prepare(`
          INSERT INTO attempts (id, userId, assignmentId, mode, grade, textbook, topic, level, adaptiveEnabled, startedAt, submittedAt, durationSeconds, score, maxScore, percentage, correctCount, totalCount, status, answersJson)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          id, attempt.userId, attempt.assignmentId || null, attempt.mode, Number(attempt.grade), attempt.textbook, attempt.topic || '',
          Number(attempt.level) || 0, attempt.adaptiveEnabled ? 1 : 0, attempt.startedAt, attempt.submittedAt,
          Number(attempt.durationSeconds) || 0, Number(attempt.score) || 0, Number(attempt.maxScore) || 0,
          Number(attempt.percentage) || 0, Number(attempt.correctCount) || 0, Number(attempt.totalCount) || 0,
          attempt.status || 'submitted', JSON.stringify(attempt.answers || [])
        );
        return this.getAttemptById(id);
      },
      getAttemptById(id) {
        const r = db.prepare('SELECT * FROM attempts WHERE id = ?').get(id);
        return r ? { ...r, adaptiveEnabled: Boolean(r.adaptiveEnabled), answers: JSON.parse(r.answersJson || '[]') } : null;
      },
      listAttempts(filter = {}) {
        const clauses = [];
        const params = [];
        if (filter.userId) { clauses.push('userId = ?'); params.push(filter.userId); }
        if (filter.status) { clauses.push('status = ?'); params.push(filter.status); }
        const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
        return db.prepare(`SELECT * FROM attempts ${where} ORDER BY submittedAt DESC`).all(...params).map((r) => ({
          ...r,
          adaptiveEnabled: Boolean(r.adaptiveEnabled),
          answers: JSON.parse(r.answersJson || '[]')
        }));
      },
      updateAttemptGrading(id, updatedAnswers, score, maxScore, status) {
        const pct = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
        const correctCount = updatedAnswers.filter((a) => a.isCorrect).length;
        db.prepare('UPDATE attempts SET answersJson = ?, score = ?, percentage = ?, correctCount = ?, status = ? WHERE id = ?')
          .run(JSON.stringify(updatedAnswers), score, pct, correctCount, status, id);
        return this.getAttemptById(id);
      },
      deleteAttemptsForUser(userId) {
        return db.prepare('DELETE FROM attempts WHERE userId = ?').run(userId).changes;
      },

      listBadges(userId) {
        return db.prepare('SELECT * FROM badges WHERE userId = ? ORDER BY awardedAt DESC').all(userId);
      },
      awardBadgeIfNew(userId, badgeCode, title, description) {
        const exists = db.prepare('SELECT id FROM badges WHERE userId = ? AND badgeCode = ?').get(userId, badgeCode);
        if (exists) return null;
        const id = crypto.randomUUID();
        const awardedAt = new Date().toISOString();
        db.prepare('INSERT INTO badges (id, userId, badgeCode, title, description, awardedAt) VALUES (?, ?, ?, ?, ?, ?)')
          .run(id, userId, badgeCode, title, description, awardedAt);
        return { id, userId, badgeCode, title, description, awardedAt };
      },

      logAction(userId, action, detail) {
        db.prepare('INSERT INTO audit_logs (id, userId, action, detail, createdAt) VALUES (?, ?, ?, ?, ?)')
          .run(crypto.randomUUID(), userId || null, action, detail || '', new Date().toISOString());
      },
      listAuditLogs(limit = 50) {
        return db.prepare('SELECT * FROM audit_logs ORDER BY createdAt DESC LIMIT ?').all(Number(limit) || 50);
      },

      exportBackup() {
        return {
          schemaVersion: 1,
          exportedAt: new Date().toISOString(),
          engine: 'sqlite',
          classes: db.prepare('SELECT * FROM classes').all(),
          users: db.prepare('SELECT * FROM users').all(),
          questions: db.prepare('SELECT * FROM questions').all().map(rowToQuestion),
          assignments: this.listAssignments(),
          attempts: this.listAttempts(),
          badges: db.prepare('SELECT * FROM badges').all()
        };
      },

      restoreBackup(payload) {
        if (!payload || !Array.isArray(payload.users) || !Array.isArray(payload.questions)) {
          throw new Error('File sao lưu không hợp lệ.');
        }
        db.exec('BEGIN');
        try {
          db.exec('DELETE FROM badges; DELETE FROM attempts; DELETE FROM assignments; DELETE FROM questions; DELETE FROM users; DELETE FROM classes;');
          const insClass = db.prepare('INSERT INTO classes (id, name, grade, textbook, teacherId, schoolYear) VALUES (?, ?, ?, ?, ?, ?)');
          for (const c of payload.classes || []) insClass.run(c.id, c.name, c.grade, c.textbook, c.teacherId || null, c.schoolYear || '2026-2027');

          const insUser = db.prepare('INSERT INTO users (id, username, studentCode, fullName, role, classId, passwordHash, mustChangePassword, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
          for (const u of payload.users) insUser.run(u.id, u.username, u.studentCode, u.fullName, u.role, u.classId || null, u.passwordHash, u.mustChangePassword ? 1 : 0, u.createdAt || new Date().toISOString());

          const insQ = db.prepare('INSERT INTO questions (id, code, grade, textbooksJson, semester, topic, lessonTitle, level, type, prompt, dataJson, points, estimatedSeconds, createdBy, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
          for (const rawQ of payload.questions) {
            const q = normalizeQuestionRecord(rawQ);
            const { id, code, grade, textbooks, semester, topic, lessonTitle, level, type, prompt, points, estimatedSeconds, createdBy, updatedAt, ...rest } = q;
            insQ.run(id, code, grade, JSON.stringify(textbooks), semester, topic, lessonTitle, level, type, prompt, JSON.stringify(rest), points, estimatedSeconds, createdBy, updatedAt);
          }

          const insA = db.prepare('INSERT INTO assignments (id, title, teacherId, classId, mode, grade, textbook, topic, level, questionIdsJson, durationMinutes, revealSolutionMode, dueDate, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
          for (const a of payload.assignments || []) {
            insA.run(a.id, a.title, a.teacherId, a.classId || null, a.mode, a.grade, a.textbook, a.topic || '', a.level || 0, JSON.stringify(a.questionIds || []), a.durationMinutes || 15, a.revealSolutionMode || 'after_submit', a.dueDate || null, a.createdAt || new Date().toISOString());
          }

          const insAt = db.prepare('INSERT INTO attempts (id, userId, assignmentId, mode, grade, textbook, topic, level, adaptiveEnabled, startedAt, submittedAt, durationSeconds, score, maxScore, percentage, correctCount, totalCount, status, answersJson) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
          for (const at of payload.attempts || []) {
            insAt.run(at.id, at.userId, at.assignmentId || null, at.mode, at.grade, at.textbook, at.topic || '', at.level || 0, at.adaptiveEnabled ? 1 : 0, at.startedAt, at.submittedAt, at.durationSeconds, at.score, at.maxScore, at.percentage, at.correctCount, at.totalCount, at.status, JSON.stringify(at.answers || []));
          }

          const insB = db.prepare('INSERT INTO badges (id, userId, badgeCode, title, description, awardedAt) VALUES (?, ?, ?, ?, ?, ?)');
          for (const b of payload.badges || []) {
            insB.run(b.id, b.userId, b.badgeCode, b.title, b.description, b.awardedAt);
          }
          db.exec('COMMIT');
        } catch (err) {
          db.exec('ROLLBACK');
          throw err;
        }
      }
    };
  }

  // ============================================================================
  // BACKEND 2: ATOMIC JSON STORE FALLBACK (Node 18/20 compatible, zero deps)
  // ============================================================================
  const storePath = path.join(dataDir, 'toan_thcs_store.json');
  let store = fs.existsSync(storePath) ? JSON.parse(fs.readFileSync(storePath, 'utf8')) : defaultSeedData();
  const persist = () => {
    const tmp = `${storePath}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(store, null, 2), 'utf8');
    fs.renameSync(tmp, storePath);
  };
  if (!fs.existsSync(storePath)) persist();

  const sanitizeUser = (u) => u ? ({
    id: u.id, username: u.username, studentCode: u.studentCode, fullName: u.fullName,
    role: u.role, classId: u.classId, mustChangePassword: Boolean(u.mustChangePassword), createdAt: u.createdAt
  }) : null;

  return {
    engine: 'json-atomic',
    sessionSecret,
    curriculum,
    dbPath: storePath,

    getUserByUsername(username) {
      return store.users.find((u) => u.username === String(username).trim()) || null;
    },
    getUserById(id) {
      return sanitizeUser(store.users.find((u) => u.id === id));
    },
    listUsers() {
      return store.users.map(sanitizeUser);
    },
    createUser(input) {
      if (store.users.some((u) => u.username === input.username.trim())) {
        throw new Error('Tên đăng nhập đã tồn tại.');
      }
      const user = {
        id: input.id || crypto.randomUUID(),
        username: input.username.trim(),
        studentCode: input.studentCode.trim(),
        fullName: input.fullName.trim(),
        role: input.role,
        classId: input.classId || null,
        passwordHash: hashPassword(input.password),
        mustChangePassword: Boolean(input.mustChangePassword),
        createdAt: new Date().toISOString()
      };
      store.users.push(user);
      persist();
      return sanitizeUser(user);
    },
    updateUser(id, patch) {
      const idx = store.users.findIndex((u) => u.id === id);
      if (idx === -1) return null;
      const cur = store.users[idx];
      store.users[idx] = {
        ...cur,
        studentCode: patch.studentCode !== undefined ? String(patch.studentCode).trim() : cur.studentCode,
        fullName: patch.fullName !== undefined ? String(patch.fullName).trim() : cur.fullName,
        role: patch.role !== undefined ? patch.role : cur.role,
        classId: patch.classId !== undefined ? patch.classId : cur.classId,
        passwordHash: patch.password ? hashPassword(patch.password) : cur.passwordHash,
        mustChangePassword: patch.mustChangePassword !== undefined ? Boolean(patch.mustChangePassword) : cur.mustChangePassword
      };
      persist();
      return sanitizeUser(store.users[idx]);
    },
    deleteUser(id) {
      const prev = store.users.length;
      store.users = store.users.filter((u) => u.id !== id);
      store.attempts = store.attempts.filter((a) => a.userId !== id);
      store.badges = store.badges.filter((b) => b.userId !== id);
      persist();
      return store.users.length < prev;
    },

    listClasses() { return store.classes; },
    createClass(input) {
      const cls = {
        id: input.id || crypto.randomUUID(),
        name: input.name.trim(),
        grade: Number(input.grade),
        textbook: input.textbook || 'kntt',
        teacherId: input.teacherId || null,
        schoolYear: input.schoolYear || '2026-2027'
      };
      store.classes.push(cls);
      persist();
      return cls;
    },
    deleteClass(id) {
      const prev = store.classes.length;
      store.classes = store.classes.filter((c) => c.id !== id);
      store.users = store.users.map((u) => u.classId === id ? { ...u, classId: null } : u);
      persist();
      return store.classes.length < prev;
    },

    listQuestions(filters = {}) {
      let rows = store.questions;
      if (filters.grade) rows = rows.filter((q) => q.grade === Number(filters.grade));
      if (filters.semester) rows = rows.filter((q) => q.semester === Number(filters.semester));
      if (filters.topic) rows = rows.filter((q) => q.topic === filters.topic);
      if (filters.level) rows = rows.filter((q) => q.level === Number(filters.level));
      if (filters.type) rows = rows.filter((q) => q.type === filters.type);
      if (filters.textbook) rows = rows.filter((q) => q.textbooks.includes(filters.textbook));
      if (filters.search) {
        const kw = String(filters.search).toLowerCase();
        rows = rows.filter((q) => q.prompt.toLowerCase().includes(kw) || q.code.toLowerCase().includes(kw) || (q.lessonTitle || '').toLowerCase().includes(kw));
      }
      return rows;
    },
    getQuestionById(id) {
      return store.questions.find((q) => q.id === id) || null;
    },
    upsertQuestion(raw, creatorId) {
      const q = normalizeQuestionRecord(raw, creatorId);
      const idx = store.questions.findIndex((item) => item.id === q.id || item.code === q.code);
      if (idx >= 0) {
        q.id = store.questions[idx].id;
        store.questions[idx] = { ...q, updatedAt: new Date().toISOString() };
      } else {
        store.questions.push(q);
      }
      persist();
      return q;
    },
    deleteQuestion(id) {
      const prev = store.questions.length;
      store.questions = store.questions.filter((q) => q.id !== id);
      persist();
      return store.questions.length < prev;
    },

    listAssignments(filter = {}) {
      const rows = [...store.assignments].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      if (filter.classId) return rows.filter((a) => !a.classId || a.classId === filter.classId);
      return rows;
    },
    createAssignment(input, teacherId) {
      const asg = {
        id: crypto.randomUUID(),
        title: input.title.trim(),
        teacherId,
        classId: input.classId || null,
        mode: input.mode || 'lesson',
        grade: Number(input.grade) || 6,
        textbook: input.textbook || 'kntt',
        topic: input.topic || '',
        level: Number(input.level) || 0,
        questionIds: input.questionIds || [],
        durationMinutes: Number(input.durationMinutes) || 15,
        revealSolutionMode: input.revealSolutionMode || 'after_submit',
        dueDate: input.dueDate || null,
        createdAt: new Date().toISOString()
      };
      store.assignments.push(asg);
      persist();
      return asg;
    },
    deleteAssignment(id) {
      const prev = store.assignments.length;
      store.assignments = store.assignments.filter((a) => a.id !== id);
      persist();
      return store.assignments.length < prev;
    },

    saveAttempt(attempt) {
      const rec = { ...attempt, id: attempt.id || crypto.randomUUID() };
      store.attempts.unshift(rec);
      persist();
      return rec;
    },
    getAttemptById(id) {
      return store.attempts.find((a) => a.id === id) || null;
    },
    listAttempts(filter = {}) {
      let rows = store.attempts;
      if (filter.userId) rows = rows.filter((a) => a.userId === filter.userId);
      if (filter.status) rows = rows.filter((a) => a.status === filter.status);
      return rows;
    },
    updateAttemptGrading(id, updatedAnswers, score, maxScore, status) {
      const idx = store.attempts.findIndex((a) => a.id === id);
      if (idx === -1) return null;
      const pct = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
      const correctCount = updatedAnswers.filter((a) => a.isCorrect).length;
      store.attempts[idx] = { ...store.attempts[idx], answers: updatedAnswers, score, percentage: pct, correctCount, status };
      persist();
      return store.attempts[idx];
    },
    deleteAttemptsForUser(userId) {
      const prev = store.attempts.length;
      store.attempts = store.attempts.filter((a) => a.userId !== userId);
      persist();
      return prev - store.attempts.length;
    },

    listBadges(userId) {
      return store.badges.filter((b) => b.userId === userId);
    },
    awardBadgeIfNew(userId, badgeCode, title, description) {
      if (store.badges.some((b) => b.userId === userId && b.badgeCode === badgeCode)) return null;
      const b = { id: crypto.randomUUID(), userId, badgeCode, title, description, awardedAt: new Date().toISOString() };
      store.badges.push(b);
      persist();
      return b;
    },

    logAction(userId, action, detail) {
      store.auditLogs.unshift({ id: crypto.randomUUID(), userId: userId || null, action, detail: detail || '', createdAt: new Date().toISOString() });
      if (store.auditLogs.length > 200) store.auditLogs.length = 200;
      persist();
    },
    listAuditLogs(limit = 50) {
      return store.auditLogs.slice(0, limit);
    },

    exportBackup() {
      return {
        schemaVersion: 1,
        exportedAt: new Date().toISOString(),
        engine: 'json-atomic',
        ...store
      };
    },
    restoreBackup(payload) {
      if (!payload || !Array.isArray(payload.users) || !Array.isArray(payload.questions)) {
        throw new Error('File sao lưu không hợp lệ.');
      }
      store = {
        classes: payload.classes || [],
        users: payload.users,
        questions: payload.questions.map((q) => normalizeQuestionRecord(q)),
        assignments: payload.assignments || [],
        attempts: payload.attempts || [],
        badges: payload.badges || [],
        auditLogs: payload.auditLogs || []
      };
      persist();
    }
  };
}
