import React, { useEffect, useState } from 'react';
import {
  CheckSquare,
  Download,
  FileSpreadsheet,
  FolderPlus,
  Plus,
  Printer,
  ShieldCheck,
  Trash2,
  Upload,
  Users
} from 'lucide-react';
import { Assignment, Attempt, ClassItem, CurriculumData, Question, QuestionType, TextbookId, User } from '../types';
import { apiRequest } from '../lib/api';
import { MathText } from './MathText';
import { QUESTION_TYPE_LABELS } from './QuestionCard';

interface TeacherAdminConsoleProps {
  user: User;
  curriculum: CurriculumData;
}

export const TeacherAdminConsole: React.FC<TeacherAdminConsoleProps> = ({ user, curriculum }) => {
  const [tab, setTab] = useState<'analytics' | 'questions' | 'classes' | 'admin'>('analytics');
  const [dashboard, setDashboard] = useState<any>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [usersList, setUsersList] = useState<User[]>([]);
  const [statusMsg, setStatusMsg] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');

  // Bo loc ngan hang cau hoi
  const [qGrade, setQGrade] = useState<number>(0);
  const [qType, setQType] = useState<string>('');
  const [qSearch, setQSearch] = useState<string>('');
  const [editingQ, setEditingQ] = useState<Partial<Question> | null>(null);

  // Form tao lop & giao bai
  const [newClassName, setNewClassName] = useState('');
  const [newClassGrade, setNewClassGrade] = useState(6);
  const [newClassBook, setNewClassBook] = useState<TextbookId>('kntt');
  const [asgTitle, setAsgTitle] = useState('');
  const [asgClassId, setAsgClassId] = useState('');
  const [asgGrade, setAsgGrade] = useState(6);
  const [asgDuration, setAsgDuration] = useState(15);
  const [asgReveal, setAsgReveal] = useState<'after_submit' | 'immediate' | 'hidden'>('after_submit');

  // Form tao tai khoan
  const [newUsername, setNewUsername] = useState('');
  const [newFullName, setNewFullName] = useState('');
  const [newCode, setNewCode] = useState('');
  const [newPass, setNewPass] = useState('');
  const [newRole, setNewRole] = useState<'student' | 'teacher'>('student');
  const [newClassId, setNewClassId] = useState('');

  // Cham tu luan
  const [gradingAttempt, setGradingAttempt] = useState<Attempt | null>(null);
  const [manualScores, setManualScores] = useState<Record<string, { score: number; comment: string }>>({});

  const loadAll = async () => {
    try {
      const [dash, qRes, aRes, uRes] = await Promise.all([
        apiRequest<any>('/api/teacher/dashboard'),
        apiRequest<{ questions: Question[] }>('/api/questions?includeAnswer=1'),
        apiRequest<{ assignments: Assignment[] }>('/api/assignments'),
        apiRequest<{ users: User[] }>('/api/users')
      ]);
      setDashboard(dash);
      setQuestions(qRes.questions || []);
      setAssignments(aRes.assignments || []);
      setUsersList(uRes.users || []);
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const filteredQuestions = questions.filter((q) => {
    if (qGrade > 0 && q.grade !== qGrade) return false;
    if (qType && q.type !== qType) return false;
    if (qSearch.trim()) {
      const kw = qSearch.toLowerCase();
      return q.prompt.toLowerCase().includes(kw) || q.code.toLowerCase().includes(kw) || (q.lessonTitle || '').toLowerCase().includes(kw);
    }
    return true;
  });

  const handleSaveQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingQ) return;
    setErrorMsg('');
    setStatusMsg('');
    try {
      await apiRequest('/api/questions', {
        method: 'POST',
        body: JSON.stringify(editingQ)
      });
      setEditingQ(null);
      setStatusMsg('Đã lưu câu hỏi vào cơ sở dữ liệu.');
      await loadAll();
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  const handleDeleteQuestion = async (id: string) => {
    try {
      await apiRequest(`/api/questions/${id}`, { method: 'DELETE' });
      setStatusMsg('Đã xóa câu hỏi.');
      await loadAll();
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  const handleImportJson = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const list = Array.isArray(parsed) ? parsed : parsed.questions || [];
      const res = await apiRequest<{ imported: number }>('/api/teacher/questions/import', {
        method: 'POST',
        body: JSON.stringify({ questions: list })
      });
      setStatusMsg(`Đã nhập thành công ${res.imported} câu hỏi từ file JSON.`);
      await loadAll();
    } catch (err: any) {
      setErrorMsg(err.message || 'File JSON câu hỏi không hợp lệ.');
    }
    e.target.value = '';
  };

  const handleExportQuestionsJson = () => {
    const blob = new Blob([JSON.stringify(filteredQuestions, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ngan-hang-cau-hoi-toan-thcs.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/api/classes', {
        method: 'POST',
        body: JSON.stringify({ name: newClassName, grade: newClassGrade, textbook: newClassBook })
      });
      setNewClassName('');
      setStatusMsg('Đã tạo lớp học mới.');
      await loadAll();
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  const handleCreateAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const pickedIds = questions.filter((q) => q.grade === asgGrade).slice(0, 10).map((q) => q.id);
      await apiRequest('/api/assignments', {
        method: 'POST',
        body: JSON.stringify({
          title: asgTitle,
          classId: asgClassId || null,
          mode: asgDuration <= 15 ? 'test_15m' : 'test_45m',
          grade: asgGrade,
          textbook: 'kntt',
          questionIds: pickedIds,
          durationMinutes: asgDuration,
          revealSolutionMode: asgReveal
        })
      });
      setAsgTitle('');
      setStatusMsg('Đã giao bài kiểm tra cho lớp.');
      await loadAll();
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/api/users', {
        method: 'POST',
        body: JSON.stringify({
          username: newUsername,
          fullName: newFullName,
          studentCode: newCode,
          password: newPass,
          role: newRole,
          classId: newClassId || null
        })
      });
      setNewUsername('');
      setNewFullName('');
      setNewCode('');
      setNewPass('');
      setStatusMsg('Đã tạo tài khoản mới.');
      await loadAll();
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  const handleRestoreBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      await apiRequest('/api/admin/restore', {
        method: 'POST',
        body: JSON.stringify(parsed)
      });
      setStatusMsg('Đã khôi phục toàn bộ dữ liệu từ file sao lưu.');
      await loadAll();
    } catch (err: any) {
      setErrorMsg(err.message);
    }
    e.target.value = '';
  };

  const handleSubmitManualGrading = async () => {
    if (!gradingAttempt) return;
    try {
      const updates = Object.entries(manualScores).map(([questionId, val]) => ({
        questionId,
        score: val.score,
        teacherComment: val.comment
      }));
      await apiRequest(`/api/teacher/grade/${gradingAttempt.id}`, {
        method: 'POST',
        body: JSON.stringify({ updates })
      });
      setGradingAttempt(null);
      setStatusMsg('Đã cập nhật điểm chấm tự luận.');
      await loadAll();
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Thanh tab dieu huong giao vien */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap gap-1.5 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
          {[
            { id: 'analytics', label: 'Thống kê & Báo cáo' },
            { id: 'questions', label: `Ngân hàng câu hỏi (${questions.length})` },
            { id: 'classes', label: 'Lớp học & Giao bài' },
            { id: 'admin', label: user.role === 'admin' ? 'Quản trị & Sao lưu' : 'Học sinh lớp' }
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id as any)}
              className={`min-h-[38px] rounded-lg px-3.5 py-1.5 text-sm font-semibold transition-colors whitespace-nowrap ${
                tab === t.id
                  ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-slate-50'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="no-print flex flex-wrap items-center gap-2">
          <a
            href="/api/teacher/export-csv"
            className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
            <span>Xuất Excel / CSV</span>
          </a>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            <Printer className="h-4 w-4" />
            <span>In báo cáo</span>
          </button>
        </div>
      </div>

      {statusMsg && (
        <div className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
          {statusMsg}
        </div>
      )}
      {errorMsg && (
        <div className="rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-900 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200">
          {errorMsg}
        </div>
      )}

      {/* TAB 1: THONG KE & BAO CAO */}
      {tab === 'analytics' && dashboard && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
            {[
              { label: 'Tổng học sinh', value: dashboard.totalStudents },
              { label: 'Lượt làm bài', value: dashboard.totalAttempts },
              { label: 'Tỉ lệ hoàn thành bài giao', value: `${dashboard.completionRate}%` },
              { label: 'Điểm trung bình', value: `${dashboard.avgPercentage}%` },
              { label: 'Cao nhất / Thấp nhất', value: `${dashboard.maxPercentage}% / ${dashboard.minPercentage}%` }
            ].map((kpi) => (
              <div key={kpi.label} className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                <div className="text-xs font-medium text-slate-500 dark:text-slate-400">{kpi.label}</div>
                <div className="mt-1.5 font-mono text-2xl font-bold text-slate-900 dark:text-slate-50">{kpi.value}</div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Bieu do ti le dung theo chu de */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-50">
                Tỉ lệ trả lời đúng theo chủ đề
              </h3>
              {dashboard.topicStats.length === 0 ? (
                <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
                  Chưa có lượt làm bài thực tế nào được ghi nhận. Khi học sinh nộp bài, biểu đồ sẽ tự động hiển thị số liệu thật.
                </p>
              ) : (
                <div className="mt-4 space-y-3">
                  {dashboard.topicStats.map((t: any) => (
                    <div key={t.topic} className="space-y-1">
                      <div className="flex justify-between text-xs font-medium">
                        <span className="text-slate-800 dark:text-slate-200">{t.topicName}</span>
                        <span className="font-mono text-slate-600 dark:text-slate-400">
                          {t.accuracy}% ({t.correct}/{t.total})
                        </span>
                      </div>
                      <div className="h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                        <div
                          className={`h-full rounded-full ${t.accuracy >= 65 ? 'bg-emerald-600' : 'bg-amber-500'}`}
                          style={{ width: `${t.accuracy}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Bai tu luan cho giao vien cham */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-50">
                Bài tự luận chờ chấm điểm ({dashboard.pendingGrading.length})
              </h3>
              {dashboard.pendingGrading.length === 0 ? (
                <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
                  Hiện không có bài tự luận ngắn nào đang chờ chấm.
                </p>
              ) : (
                <div className="mt-4 space-y-3">
                  {dashboard.pendingGrading.map((att: Attempt) => (
                    <div key={att.id} className="flex items-center justify-between rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                      <div>
                        <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                          Bài làm Toán {att.grade} · {new Date(att.submittedAt).toLocaleString('vi-VN')}
                        </div>
                        <div className="text-xs text-slate-500">Điểm tạm tính: {att.score}/{att.maxScore}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setGradingAttempt(att);
                          const init: Record<string, { score: number; comment: string }> = {};
                          for (const ans of att.answers) {
                            if (ans.needsManualGrading) {
                              init[ans.questionId] = { score: ans.score, comment: ans.teacherComment || '' };
                            }
                          }
                          setManualScores(init);
                        }}
                        className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
                      >
                        Chấm bài
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Bang theo doi hoc sinh & hoc sinh can ho tro */}
          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <h3 className="mb-4 text-base font-bold text-slate-900 dark:text-slate-50">
              Kết quả học tập của từng học sinh
            </h3>
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-slate-200 text-xs font-semibold text-slate-500 dark:border-slate-800">
                <tr>
                  <th className="py-2.5 pr-4">Mã HS</th>
                  <th className="py-2.5 pr-4">Họ và tên</th>
                  <th className="py-2.5 pr-4">Số lượt</th>
                  <th className="py-2.5 pr-4">Số câu đã làm</th>
                  <th className="py-2.5 pr-4">Điểm TB</th>
                  <th className="py-2.5">Nhận xét hệ thống</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {dashboard.studentSummaries.map((st: any) => (
                  <tr key={st.id}>
                    <td className="py-3 pr-4 font-mono text-xs text-slate-600 dark:text-slate-400">{st.studentCode}</td>
                    <td className="py-3 pr-4 font-semibold text-slate-900 dark:text-slate-100">{st.fullName}</td>
                    <td className="py-3 pr-4 font-mono">{st.attemptsCount}</td>
                    <td className="py-3 pr-4 font-mono">{st.answeredCount}</td>
                    <td className="py-3 pr-4 font-mono font-bold">
                      {st.avgPercentage !== null ? `${st.avgPercentage}%` : '—'}
                    </td>
                    <td className="py-3 text-xs">
                      {st.answeredCount < 5
                        ? 'Chưa đủ dữ liệu (< 5 câu)'
                        : st.needsSupport
                        ? <span className="font-semibold text-rose-600 dark:text-rose-400">Cần hỗ trợ thêm (dưới 60%)</span>
                        : <span className="font-semibold text-emerald-600 dark:text-emerald-400">Tiến độ ổn định</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: QUAN LY NGAN HANG CAU HOI */}
      {tab === 'questions' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-wrap items-center gap-2.5">
              <input
                type="text"
                value={qSearch}
                onChange={(e) => setQSearch(e.target.value)}
                placeholder="Tìm mã hoặc nội dung câu hỏi..."
                className="min-h-[40px] rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-800"
              />
              <select
                value={qGrade}
                onChange={(e) => setQGrade(Number(e.target.value))}
                className="min-h-[40px] rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-800"
              >
                <option value={0}>Mọi lớp</option>
                {[6, 7, 8, 9].map((g) => <option key={g} value={g}>Lớp {g}</option>)}
              </select>
              <select
                value={qType}
                onChange={(e) => setQType(e.target.value)}
                className="min-h-[40px] rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-800"
              >
                <option value="">Mọi dạng</option>
                {Object.entries(QUESTION_TYPE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleExportQuestionsJson}
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-slate-300 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200"
              >
                <Download className="h-4 w-4" />
                <span>Xuất JSON</span>
              </button>
              <label className="inline-flex min-h-[40px] cursor-pointer items-center gap-1.5 rounded-xl border border-slate-300 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200">
                <Upload className="h-4 w-4" />
                <span>Nhập JSON</span>
                <input type="file" accept=".json" onChange={handleImportJson} className="hidden" />
              </label>
              <button
                type="button"
                onClick={() => setEditingQ({
                  code: `GV-${Date.now().toString(36).toUpperCase()}`,
                  grade: 6,
                  textbooks: ['kntt', 'ctst', 'cd'],
                  semester: 1,
                  topic: 'so-tu-nhien',
                  lessonTitle: '',
                  level: 1,
                  type: 'mcq',
                  prompt: '',
                  options: ['', '', '', ''],
                  answer: 0,
                  solutionSteps: ['Bước 1: ', 'Bước 2: ', 'Bước 3: ', 'Bước 4: '],
                  commonMistake: '',
                  points: 10,
                  estimatedSeconds: 45
                })}
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-blue-600 px-4 text-xs font-semibold text-white hover:bg-blue-700"
              >
                <Plus className="h-4 w-4" />
                <span>Thêm câu hỏi</span>
              </button>
            </div>
          </div>

          <div className="divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
            {filteredQuestions.map((q) => (
              <div key={q.id} className="flex flex-col justify-between gap-3 p-4 sm:flex-row sm:items-center">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span className="font-mono font-bold text-blue-700 dark:text-blue-400">{q.code}</span>
                    <span>·</span>
                    <span>Toán {q.grade}</span>
                    <span>·</span>
                    <span>{QUESTION_TYPE_LABELS[q.type] || q.type}</span>
                    <span>·</span>
                    <span>Mức {q.level}</span>
                  </div>
                  <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                    <MathText text={q.prompt} />
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingQ(q)}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200"
                  >
                    Sửa
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteQuestion(q.id)}
                    className="rounded-lg border border-rose-200 px-2.5 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:border-rose-900 dark:text-rose-400"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: LOP HOC & GIAO BAI */}
      {tab === 'classes' && dashboard && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <h3 className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-slate-50">
              <FolderPlus className="h-5 w-5 text-blue-600" />
              <span>Quản lý lớp học</span>
            </h3>
            <form onSubmit={handleCreateClass} className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <input
                required
                value={newClassName}
                onChange={(e) => setNewClassName(e.target.value)}
                placeholder="Tên lớp (vd: 7A2)"
                className="min-h-[40px] rounded-xl border border-slate-300 px-3 text-sm dark:border-slate-700 dark:bg-slate-800"
              />
              <select
                value={newClassGrade}
                onChange={(e) => setNewClassGrade(Number(e.target.value))}
                className="min-h-[40px] rounded-xl border border-slate-300 px-3 text-sm dark:border-slate-700 dark:bg-slate-800"
              >
                {[6, 7, 8, 9].map((g) => <option key={g} value={g}>Khối {g}</option>)}
              </select>
              <button type="submit" className="min-h-[40px] rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700">
                Thêm lớp
              </button>
            </form>
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {dashboard.classes.map((c: ClassItem) => (
                <div key={c.id} className="flex items-center justify-between py-2.5 text-sm">
                  <span className="font-semibold text-slate-900 dark:text-slate-100">Lớp {c.name} · Khối {c.grade}</span>
                  <span className="text-xs text-slate-500">{c.textbook.toUpperCase()} · {c.schoolYear}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <h3 className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-slate-50">
              <CheckSquare className="h-5 w-5 text-emerald-600" />
              <span>Giao bài tập / Đề kiểm tra</span>
            </h3>
            <form onSubmit={handleCreateAssignment} className="space-y-3">
              <input
                required
                value={asgTitle}
                onChange={(e) => setAsgTitle(e.target.value)}
                placeholder="Tiêu đề bài kiểm tra hoặc phiếu ôn tập"
                className="min-h-[40px] w-full rounded-xl border border-slate-300 px-3 text-sm dark:border-slate-700 dark:bg-slate-800"
              />
              <div className="grid grid-cols-2 gap-3">
                <select
                  value={asgClassId}
                  onChange={(e) => setAsgClassId(e.target.value)}
                  className="min-h-[40px] rounded-xl border border-slate-300 px-3 text-sm dark:border-slate-700 dark:bg-slate-800"
                >
                  <option value="">Tất cả các lớp</option>
                  {dashboard.classes.map((c: ClassItem) => <option key={c.id} value={c.id}>Lớp {c.name}</option>)}
                </select>
                <select
                  value={asgGrade}
                  onChange={(e) => setAsgGrade(Number(e.target.value))}
                  className="min-h-[40px] rounded-xl border border-slate-300 px-3 text-sm dark:border-slate-700 dark:bg-slate-800"
                >
                  {[6, 7, 8, 9].map((g) => <option key={g} value={g}>Đề Lớp {g}</option>)}
                </select>
                <select
                  value={asgDuration}
                  onChange={(e) => setAsgDuration(Number(e.target.value))}
                  className="min-h-[40px] rounded-xl border border-slate-300 px-3 text-sm dark:border-slate-700 dark:bg-slate-800"
                >
                  <option value={15}>Kiểm tra 15 phút</option>
                  <option value={45}>Kiểm tra 45 phút</option>
                </select>
                <select
                  value={asgReveal}
                  onChange={(e) => setAsgReveal(e.target.value as any)}
                  className="min-h-[40px] rounded-xl border border-slate-300 px-3 text-sm dark:border-slate-700 dark:bg-slate-800"
                >
                  <option value="after_submit">Hiện lời giải sau khi nộp</option>
                  <option value="hidden">Ẩn lời giải sau khi nộp</option>
                  <option value="immediate">Xem lời giải từng câu</option>
                </select>
              </div>
              <button type="submit" className="min-h-[40px] w-full rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700">
                Giao bài cho lớp
              </button>
            </form>

            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {assignments.map((a) => (
                <div key={a.id} className="flex items-center justify-between py-2.5 text-sm">
                  <div>
                    <div className="font-semibold text-slate-900 dark:text-slate-100">{a.title}</div>
                    <div className="text-xs text-slate-500">Toán {a.grade} · {a.durationMinutes} phút · {a.questionIds.length} câu</div>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      await apiRequest(`/api/assignments/${a.id}`, { method: 'DELETE' });
                      await loadAll();
                    }}
                    className="text-xs font-semibold text-rose-600 hover:underline"
                  >
                    Xóa
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: QUAN TRI TAI KHOAN & SAO LUU / KHOI PHUC */}
      {tab === 'admin' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <h3 className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-slate-50">
              <Users className="h-5 w-5 text-blue-600" />
              <span>Thêm tài khoản học sinh / giáo viên</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Bảo vệ dữ liệu trẻ em: Hệ thống chỉ lưu Mã học sinh, Họ tên và Lớp học; mật khẩu được băm scrypt an toàn.
            </p>
            <form onSubmit={handleCreateUser} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <input required value={newCode} onChange={(e) => setNewCode(e.target.value)} placeholder="Mã HS/GV (vd: HS6A105)" className="min-h-[40px] rounded-xl border border-slate-300 px-3 text-sm dark:border-slate-700 dark:bg-slate-800" />
              <input required value={newFullName} onChange={(e) => setNewFullName(e.target.value)} placeholder="Họ và tên" className="min-h-[40px] rounded-xl border border-slate-300 px-3 text-sm dark:border-slate-700 dark:bg-slate-800" />
              <input required value={newUsername} onChange={(e) => setNewUsername(e.target.value)} placeholder="Tên đăng nhập" className="min-h-[40px] rounded-xl border border-slate-300 px-3 text-sm dark:border-slate-700 dark:bg-slate-800" />
              <input required type="password" value={newPass} onChange={(e) => setNewPass(e.target.value)} placeholder="Mật khẩu (>= 6 ký tự)" className="min-h-[40px] rounded-xl border border-slate-300 px-3 text-sm dark:border-slate-700 dark:bg-slate-800" />
              {user.role === 'admin' && (
                <select value={newRole} onChange={(e) => setNewRole(e.target.value as any)} className="min-h-[40px] rounded-xl border border-slate-300 px-3 text-sm dark:border-slate-700 dark:bg-slate-800">
                  <option value="student">Học sinh</option>
                  <option value="teacher">Giáo viên</option>
                </select>
              )}
              <select value={newClassId} onChange={(e) => setNewClassId(e.target.value)} className="min-h-[40px] rounded-xl border border-slate-300 px-3 text-sm dark:border-slate-700 dark:bg-slate-800">
                <option value="">-- Chọn lớp --</option>
                {(dashboard?.classes || []).map((c: ClassItem) => <option key={c.id} value={c.id}>Lớp {c.name}</option>)}
              </select>
              <button type="submit" className="min-h-[40px] rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 sm:col-span-2">
                Tạo tài khoản
              </button>
            </form>

            <div className="divide-y divide-slate-100 pt-2 dark:divide-slate-800">
              {usersList.map((u) => (
                <div key={u.id} className="flex items-center justify-between py-2.5 text-sm">
                  <div>
                    <div className="font-semibold text-slate-900 dark:text-slate-100">
                      {u.fullName} <span className="font-mono text-xs text-slate-500">({u.username})</span>
                    </div>
                    <div className="text-xs text-slate-500">{u.studentCode} · Vai trò: {u.role}</div>
                  </div>
                  {user.role === 'admin' && u.id !== user.id && (
                    <button
                      type="button"
                      onClick={async () => {
                        await apiRequest(`/api/users/${u.id}`, { method: 'DELETE' });
                        await loadAll();
                      }}
                      className="text-xs font-semibold text-rose-600 hover:underline"
                    >
                      Xóa tài khoản
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {user.role === 'admin' && (
            <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
              <h3 className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-slate-50">
                <ShieldCheck className="h-5 w-5 text-emerald-600" />
                <span>Sao lưu và khôi phục toàn hệ thống</span>
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Tải bản sao lưu toàn bộ lớp học, tài khoản (đã băm mật khẩu), ngân hàng câu hỏi và lịch sử kết quả thành 1 file JSON an toàn, hoặc khôi phục lại khi chuyển máy giáo viên.
              </p>
              <div className="flex flex-wrap gap-3">
                <a
                  href="/api/admin/backup"
                  className="inline-flex min-h-[42px] items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
                >
                  <Download className="h-4 w-4" />
                  <span>Tải bản sao lưu (.json)</span>
                </a>
                <label className="inline-flex min-h-[42px] cursor-pointer items-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200">
                  <Upload className="h-4 w-4" />
                  <span>Khôi phục từ file sao lưu</span>
                  <input type="file" accept=".json" onChange={handleRestoreBackup} className="hidden" />
                </label>
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODAL THEM / SUA CAU HOI */}
      {editingQ && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/60 p-4">
          <form
            onSubmit={handleSaveQuestion}
            className="w-full max-w-2xl space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900"
          >
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-50">
              {editingQ.id ? 'Chỉnh sửa câu hỏi' : 'Thêm câu hỏi mới'}
            </h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <input
                required
                value={editingQ.code || ''}
                onChange={(e) => setEditingQ({ ...editingQ, code: e.target.value })}
                placeholder="Mã câu hỏi"
                className="min-h-[38px] rounded-lg border border-slate-300 px-3 text-sm dark:border-slate-700 dark:bg-slate-800"
              />
              <select
                value={editingQ.grade || 6}
                onChange={(e) => setEditingQ({ ...editingQ, grade: Number(e.target.value) })}
                className="min-h-[38px] rounded-lg border border-slate-300 px-3 text-sm dark:border-slate-700 dark:bg-slate-800"
              >
                {[6, 7, 8, 9].map((g) => <option key={g} value={g}>Lớp {g}</option>)}
              </select>
              <select
                value={editingQ.level || 1}
                onChange={(e) => setEditingQ({ ...editingQ, level: Number(e.target.value) as any })}
                className="min-h-[38px] rounded-lg border border-slate-300 px-3 text-sm dark:border-slate-700 dark:bg-slate-800"
              >
                <option value={1}>Mức 1 (Cơ bản)</option>
                <option value={2}>Mức 2 (Nâng cao)</option>
                <option value={3}>Mức 3 (Thử thách)</option>
              </select>
              <select
                value={editingQ.type || 'mcq'}
                onChange={(e) => setEditingQ({ ...editingQ, type: e.target.value as QuestionType })}
                className="min-h-[38px] rounded-lg border border-slate-300 px-3 text-sm dark:border-slate-700 dark:bg-slate-800"
              >
                {Object.entries(QUESTION_TYPE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                Đề bài (hỗ trợ công thức KaTeX đặt trong $...$)
              </label>
              <textarea
                required
                rows={3}
                value={editingQ.prompt || ''}
                onChange={(e) => setEditingQ({ ...editingQ, prompt: e.target.value })}
                className="w-full rounded-xl border border-slate-300 p-3 text-sm dark:border-slate-700 dark:bg-slate-800"
              />
              {editingQ.prompt && (
                <div className="mt-1.5 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  Xem trước: <MathText text={editingQ.prompt} />
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <select
                value={editingQ.topic || ''}
                onChange={(e) => setEditingQ({ ...editingQ, topic: e.target.value })}
                className="min-h-[38px] rounded-lg border border-slate-300 px-3 text-sm dark:border-slate-700 dark:bg-slate-800"
              >
                {curriculum.topics
                  .filter((t) => t.grade === (editingQ.grade || 6))
                  .map((t) => <option key={t.key} value={t.key}>{t.name}</option>)}
              </select>
              <input
                value={String(editingQ.answer ?? '')}
                onChange={(e) => setEditingQ({
                  ...editingQ,
                  answer: editingQ.type === 'mcq' ? Number(e.target.value) : e.target.value
                })}
                placeholder={editingQ.type === 'mcq' ? 'Chỉ số đáp án đúng (0=A, 1=B, 2=C, 3=D)' : 'Đáp án đúng'}
                className="min-h-[38px] rounded-lg border border-slate-300 px-3 text-sm dark:border-slate-700 dark:bg-slate-800"
              />
            </div>

            {editingQ.type === 'mcq' && (
              <div className="grid grid-cols-2 gap-2">
                {[0, 1, 2, 3].map((idx) => (
                  <input
                    key={idx}
                    value={(editingQ.options || [])[idx] || ''}
                    onChange={(e) => {
                      const next = [...(editingQ.options || ['', '', '', ''])];
                      next[idx] = e.target.value;
                      setEditingQ({ ...editingQ, options: next });
                    }}
                    placeholder={`Phương án ${'ABCD'[idx]}`}
                    className="min-h-[36px] rounded-lg border border-slate-300 px-3 text-sm dark:border-slate-700 dark:bg-slate-800"
                  />
                ))}
              </div>
            )}

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                Lời giải chi tiết (mỗi bước trên 1 dòng)
              </label>
              <textarea
                rows={4}
                value={(editingQ.solutionSteps || []).join('\n')}
                onChange={(e) => setEditingQ({ ...editingQ, solutionSteps: e.target.value.split('\n') })}
                className="w-full rounded-xl border border-slate-300 p-3 text-sm dark:border-slate-700 dark:bg-slate-800"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setEditingQ(null)} className="min-h-[40px] rounded-xl border border-slate-300 px-4 text-sm font-semibold">
                Hủy
              </button>
              <button type="submit" className="min-h-[40px] rounded-xl bg-blue-600 px-5 text-sm font-semibold text-white hover:bg-blue-700">
                Lưu câu hỏi
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL CHAM BAI TU LUAN */}
      {gradingAttempt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/60 p-4">
          <div className="w-full max-w-xl space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900">
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-50">Chấm bài tự luận</h3>
            {gradingAttempt.answers.filter((a) => a.needsManualGrading).map((ans) => (
              <div key={ans.questionId} className="space-y-2 rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                <div className="text-sm font-semibold"><MathText text={ans.prompt} /></div>
                <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-800 dark:bg-slate-800 dark:text-slate-200">
                  <strong>Bài làm học sinh:</strong> {String(ans.userAnswer || '(Bỏ trống)')}
                </div>
                <div className="text-xs text-slate-500">Đáp án chuẩn: {ans.expectedDisplay}</div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-[120px_1fr]">
                  <input
                    type="number"
                    min={0}
                    max={ans.maxScore}
                    step={0.5}
                    value={manualScores[ans.questionId]?.score ?? ans.score}
                    onChange={(e) => setManualScores((prev) => ({
                      ...prev,
                      [ans.questionId]: { ...prev[ans.questionId], score: Number(e.target.value) }
                    }))}
                    className="min-h-[38px] rounded-lg border border-slate-300 px-3 text-sm dark:border-slate-700 dark:bg-slate-800"
                  />
                  <input
                    value={manualScores[ans.questionId]?.comment ?? ''}
                    onChange={(e) => setManualScores((prev) => ({
                      ...prev,
                      [ans.questionId]: { ...prev[ans.questionId], comment: e.target.value }
                    }))}
                    placeholder="Nhận xét của giáo viên..."
                    className="min-h-[38px] rounded-lg border border-slate-300 px-3 text-sm dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>
              </div>
            ))}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setGradingAttempt(null)} className="min-h-[40px] rounded-xl border border-slate-300 px-4 text-sm font-semibold">
                Đóng
              </button>
              <button type="button" onClick={handleSubmitManualGrading} className="min-h-[40px] rounded-xl bg-emerald-600 px-5 text-sm font-semibold text-white hover:bg-emerald-700">
                Lưu kết quả chấm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
