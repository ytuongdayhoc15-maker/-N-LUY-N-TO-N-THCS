import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createStorage, hashPassword, verifyPassword } from '../core/storage.mjs';
import { gradeQuestion, nextAdaptiveLevel, buildPersonalizedRecommendations } from '../core/math-verifier.mjs';
import { startServer } from '../on-luyen-toan-thcs.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

test('1. Kiem tra tinh dung dan va day du cua ngan hang cau hoi mau', () => {
  const questions = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'data', 'questions.json'), 'utf8'));
  assert.ok(questions.length >= 40, 'Ngan hang cau hoi mau phai co it nhat 40 cau');

  const gradesSeen = new Set();
  const typesSeen = new Set();
  const levelsSeen = new Set();

  for (const q of questions) {
    assert.ok(q.code && q.prompt, `Thieu ma hoac de bai o cau ${q.code}`);
    assert.ok([6, 7, 8, 9].includes(q.grade), `Khoi lop khong hop le o cau ${q.code}`);
    assert.ok([1, 2, 3].includes(q.level), `Muc do khong hop le o cau ${q.code}`);
    assert.ok(Array.isArray(q.solutionSteps) && q.solutionSteps.length >= 4, `Loi giai chi tiet thieu buoc o cau ${q.code}`);
    assert.ok(q.points > 0, `Diem so phai duong o cau ${q.code}`);
    gradesSeen.add(q.grade);
    typesSeen.add(q.type);
    levelsSeen.add(q.level);
  }

  assert.equal(gradesSeen.size, 4, 'Phai bao phu ca 4 khoi lop 6, 7, 8, 9');
  assert.equal(levelsSeen.size, 3, 'Phai bao phu ca 3 muc do 1, 2, 3');
  assert.ok(typesSeen.size >= 8, 'Phai bao phu da dang cac dang cau hoi');
});

test('2. Kiem tra bo cham diem cho ca 10 dang cau hoi Toan THCS', () => {
  const questions = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'data', 'questions.json'), 'utf8'));

  const mcq = questions.find((q) => q.type === 'mcq');
  assert.equal(gradeQuestion(mcq, mcq.answer).isCorrect, true);
  assert.equal(gradeQuestion(mcq, (mcq.answer + 1) % 4).isCorrect, false);

  const fill = questions.find((q) => q.code === 'T7-ST-011');
  assert.equal(gradeQuestion(fill, '12,5').isCorrect, true);
  assert.equal(gradeQuestion(fill, '12.5').isCorrect, true);
  assert.equal(gradeQuestion(fill, '12.4').isCorrect, false);

  const tf = questions.find((q) => q.type === 'true_false');
  const fullTf = gradeQuestion(tf, tf.answer);
  assert.equal(fullTf.isCorrect, true);
  assert.equal(fullTf.score, tf.points);
  const partialTf = gradeQuestion(tf, [tf.answer[0], tf.answer[1], !tf.answer[2], !tf.answer[3]]);
  assert.equal(partialTf.isCorrect, false);
  assert.equal(partialTf.score, tf.points * 0.25);

  const matching = questions.find((q) => q.type === 'matching');
  assert.equal(gradeQuestion(matching, [0, 1, 2, 3]).isCorrect, true);
  assert.equal(gradeQuestion(matching, [0, 1, 3, 2]).score, matching.points * 0.5);

  const ordering = questions.find((q) => q.type === 'ordering');
  assert.equal(gradeQuestion(ordering, [0, 1, 2, 3]).isCorrect, true);
  assert.equal(gradeQuestion(ordering, [1, 0, 2, 3]).isCorrect, false);

  const essay = questions.find((q) => q.code === 'T9-PTBH-010');
  const essayRes = gradeQuestion(essay, 'Goi chieu rong x, ta co x(x + 4) = 96 hay x^2 + 4x - 96 = 0 giai ra 8 va 12');
  assert.equal(essayRes.needsManualGrading, true);
  assert.equal(essayRes.score, essay.points);
});

test('3. Kiem tra co che thich ung do kho va nguong toi thieu 5 cau khi de xuat lo trinh', () => {
  assert.equal(nextAdaptiveLevel(1, [true, true, true]), 2);
  assert.equal(nextAdaptiveLevel(2, [false, false]), 1);
  assert.equal(nextAdaptiveLevel(3, [true, true, true]), 3);

  const tooFewAttempts = [
    { topic: 'phan-so', answers: [{ topic: 'phan-so', isCorrect: false }, { topic: 'phan-so', isCorrect: false }] }
  ];
  const recShort = buildPersonalizedRecommendations(tooFewAttempts, [{ key: 'phan-so', name: 'Phân số', grade: 6 }]);
  assert.equal(recShort.weakTopics.length, 0, 'Khong ket luan yeu khi chua du 5 cau');
  assert.equal(recShort.insufficientDataTopics.length, 1);

  const enoughAttempts = [
    {
      topic: 'phan-so',
      answers: [
        { topic: 'phan-so', isCorrect: false },
        { topic: 'phan-so', isCorrect: false },
        { topic: 'phan-so', isCorrect: true },
        { topic: 'phan-so', isCorrect: false },
        { topic: 'phan-so', isCorrect: false }
      ]
    }
  ];
  const recEnough = buildPersonalizedRecommendations(enoughAttempts, [{ key: 'phan-so', name: 'Phân số', grade: 6 }]);
  assert.equal(recEnough.weakTopics.length, 1);
  assert.equal(recEnough.weakTopics[0].accuracy, 20);
});

test('4. Kiem tra bam mat khau scrypt, luu tru va sao luu/khoi phuc', async () => {
  const hash = hashPassword('MatKhauTest@123');
  assert.ok(!hash.includes('MatKhauTest@123'));
  assert.equal(verifyPassword('MatKhauTest@123', hash), true);
  assert.equal(verifyPassword('SaiMatKhau', hash), false);

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'toan-thcs-test-'));
  fs.cpSync(path.join(ROOT_DIR, 'data'), path.join(tmpDir, 'data'), { recursive: true });
  const storage = await createStorage(tmpDir);

  const createdUser = storage.createUser({
    username: 'hs_kiemthu',
    studentCode: 'HS-TEST-01',
    fullName: 'Nguyễn Kiểm Thử',
    role: 'student',
    password: 'Password123'
  });
  assert.equal(createdUser.username, 'hs_kiemthu');
  assert.equal(storage.listUsers().some((u) => u.username === 'hs_kiemthu'), true);

  const backup = storage.exportBackup();
  storage.deleteUser(createdUser.id);
  assert.equal(storage.listUsers().some((u) => u.username === 'hs_kiemthu'), false);

  storage.restoreBackup(backup);
  assert.equal(storage.listUsers().some((u) => u.username === 'hs_kiemthu'), true);
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('5. Kiem tra may chu HTTP, dang nhap, phan quyen RBAC va nop bai', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'toan-thcs-srv-'));
  fs.cpSync(path.join(ROOT_DIR, 'data'), path.join(tmpDir, 'data'), { recursive: true });
  fs.mkdirSync(path.join(tmpDir, 'public'), { recursive: true });
  fs.writeFileSync(path.join(tmpDir, 'public', 'index.html'), '<!doctype html><html><body>Toan THCS Test</body></html>');

  const { server, port } = await startServer({ baseDir: tmpDir, port: 0, host: '127.0.0.1' });
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    const health = await fetch(`${baseUrl}/api/health`).then((r) => r.json());
    assert.equal(health.ok, true);

    // Hoc sinh khong duoc phep goi API giao vien
    const loginStudent = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'hs_an', password: 'HocSinh@2026' })
    });
    assert.equal(loginStudent.status, 200);
    const cookieStudent = loginStudent.headers.get('set-cookie').split(';')[0];
    const studentJson = await loginStudent.json();

    const forbidden = await fetch(`${baseUrl}/api/teacher/dashboard`, {
      headers: { Cookie: cookieStudent }
    });
    assert.equal(forbidden.status, 403);

    // Giao vien dang nhap thanh cong va xem duoc dashboard
    const loginTeacher = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'gv_toan', password: 'GiaoVien@2026' })
    });
    assert.equal(loginTeacher.status, 200);
    const cookieTeacher = loginTeacher.headers.get('set-cookie').split(';')[0];
    const teacherDash = await fetch(`${baseUrl}/api/teacher/dashboard`, {
      headers: { Cookie: cookieTeacher }
    });
    assert.equal(teacherDash.status, 200);

    // Hoc sinh nop bai kiem tra va duoc luu diem
    const qRes = await fetch(`${baseUrl}/api/questions?grade=6`).then((r) => r.json());
    const q1 = qRes.questions[0];
    const submitRes = await fetch(`${baseUrl}/api/attempts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookieStudent,
        'X-CSRF-Token': studentJson.csrfToken
      },
      body: JSON.stringify({
        mode: 'lesson',
        grade: 6,
        textbook: 'kntt',
        durationSeconds: 30,
        items: [{ questionId: q1.id, answer: q1.answer }]
      })
    });
    assert.equal(submitRes.status, 200);
    const submitted = await submitRes.json();
    assert.equal(submitted.attempt.correctCount, 1);
  } finally {
    server.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
