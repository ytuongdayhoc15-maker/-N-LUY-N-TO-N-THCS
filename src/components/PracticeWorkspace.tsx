import React, { useEffect, useMemo, useState } from 'react';
import {
  Award,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Flag,
  Play,
  Printer,
  RotateCcw,
  SlidersHorizontal
} from 'lucide-react';
import {
  Assignment,
  Attempt,
  Badge,
  CurriculumData,
  PracticeMode,
  Question,
  TextbookId,
  User
} from '../types';
import { apiRequest } from '../lib/api';
import { QuestionCard } from './QuestionCard';
import { MathText } from './MathText';

interface PracticeWorkspaceProps {
  curriculum: CurriculumData;
  user: User | null;
  initialGrade?: number;
  initialTextbook?: TextbookId;
  initialTopic?: string;
  initialMode?: PracticeMode;
  activeAssignment?: Assignment | null;
  onClearAssignment?: () => void;
  onAttemptCompleted?: () => void;
}

const MODE_OPTIONS: { id: PracticeMode; label: string; isExam: boolean; defaultCount: number; defaultMinutes: number }[] = [
  { id: 'lesson', label: 'Luyện tập từng bài học', isExam: false, defaultCount: 10, defaultMinutes: 0 },
  { id: 'chapter', label: 'Ôn tập theo chương', isExam: false, defaultCount: 15, defaultMinutes: 0 },
  { id: 'midterm', label: 'Ôn tập giữa học kỳ', isExam: true, defaultCount: 20, defaultMinutes: 30 },
  { id: 'final', label: 'Ôn tập cuối học kỳ', isExam: true, defaultCount: 30, defaultMinutes: 45 },
  { id: 'test_15m', label: 'Kiểm tra 15 phút', isExam: true, defaultCount: 10, defaultMinutes: 15 },
  { id: 'test_45m', label: 'Kiểm tra 45 phút', isExam: true, defaultCount: 20, defaultMinutes: 45 },
  { id: 'mock_exam', label: 'Thi thử tổng hợp', isExam: true, defaultCount: 40, defaultMinutes: 60 },
  { id: 'wrong_only', label: 'Luyện lại các câu từng làm sai', isExam: false, defaultCount: 10, defaultMinutes: 0 }
];

export const PracticeWorkspace: React.FC<PracticeWorkspaceProps> = ({
  curriculum,
  user,
  initialGrade = 6,
  initialTextbook = 'kntt',
  initialTopic = '',
  initialMode = 'lesson',
  activeAssignment = null,
  onClearAssignment,
  onAttemptCompleted
}) => {
  const [grade, setGrade] = useState<number>(initialGrade);
  const [textbook, setTextbook] = useState<TextbookId>(initialTextbook);
  const [topic, setTopic] = useState<string>(initialTopic);
  const [level, setLevel] = useState<number>(0); // 0 = Tat ca muc do
  const [mode, setMode] = useState<PracticeMode>(initialMode);
  const [questionCount, setQuestionCount] = useState<number>(10);
  const [adaptiveEnabled, setAdaptiveEnabled] = useState<boolean>(true);

  const [phase, setPhase] = useState<'setup' | 'running' | 'result'>('setup');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [flaggedIds, setFlaggedIds] = useState<Set<string>>(new Set());
  const [practiceFeedback, setPracticeFeedback] = useState<Record<string, any>>({});
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [timeLimitSeconds, setTimeLimitSeconds] = useState<number>(0);
  const [startedAt, setStartedAt] = useState<string>('');
  const [confirmSubmitOpen, setConfirmSubmitOpen] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [resultAttempt, setResultAttempt] = useState<Attempt | null>(null);
  const [newBadges, setNewBadges] = useState<Badge[]>([]);

  useEffect(() => {
    setGrade(initialGrade);
  }, [initialGrade]);
  useEffect(() => {
    setTextbook(initialTextbook);
  }, [initialTextbook]);
  useEffect(() => {
    setTopic(initialTopic);
  }, [initialTopic]);
  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  const gradeTopics = useMemo(
    () => curriculum.topics.filter((t) => t.grade === grade),
    [curriculum.topics, grade]
  );

  const modeMeta = useMemo(
    () => MODE_OPTIONS.find((m) => m.id === mode) || MODE_OPTIONS[0],
    [mode]
  );

  const isExamMode = activeAssignment ? true : modeMeta.isExam;

  // Dong bo neu nguoi dung chon lam bai duoc giao tu giao vien
  useEffect(() => {
    if (activeAssignment) {
      startSession(activeAssignment);
    }
  }, [activeAssignment?.id]);

  // Bo dem thoi gian
  useEffect(() => {
    if (phase !== 'running') return;
    const timer = window.setInterval(() => {
      setElapsedSeconds((prev) => {
        const next = prev + 1;
        if (timeLimitSeconds > 0 && next >= timeLimitSeconds) {
          window.clearInterval(timer);
          handleFinalSubmit(true);
        }
        return next;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [phase, timeLimitSeconds, questions, answers]);

  const startSession = async (assignment?: Assignment | null) => {
    setErrorMsg('');
    try {
      const targetGrade = assignment ? assignment.grade : grade;
      const targetBook = assignment ? assignment.textbook : textbook;
      const targetMode = assignment ? assignment.mode : mode;
      const params = new URLSearchParams();
      if (targetMode !== 'mock_exam') {
        params.set('grade', String(targetGrade));
        params.set('textbook', targetBook);
      }
      if (!assignment && topic) params.set('topic', topic);
      if (!assignment && level > 0 && !adaptiveEnabled) params.set('level', String(level));
      if (targetMode === 'wrong_only') params.set('wrongOnly', '1');
      if (assignment || MODE_OPTIONS.find((m) => m.id === targetMode)?.isExam) {
        params.set('mode', 'exam');
      }

      const data = await apiRequest<{ questions: Question[] }>(`/api/questions?${params.toString()}`);
      let pool = data.questions || [];

      if (assignment && assignment.questionIds.length > 0) {
        const idSet = new Set(assignment.questionIds);
        const exact = pool.filter((q) => idSet.has(q.id));
        if (exact.length > 0) pool = exact;
      }

      if (pool.length === 0 && !assignment && topic) {
        // Mo rong lay trong ca khoi lop neu chu de cu the chua co du cau trong bo loc thu hep
        const fallback = await apiRequest<{ questions: Question[] }>(`/api/questions?grade=${targetGrade}`);
        pool = fallback.questions || [];
      }

      if (pool.length === 0) {
        setErrorMsg(
          targetMode === 'wrong_only'
            ? 'Bạn chưa có câu trả lời sai nào được lưu lại để luyện tập.'
            : 'Chưa có câu hỏi phù hợp với bộ lọc đã chọn.'
        );
        return;
      }

      // Tron cau hoi va lay dung so luong nguoi dung chon (hoac toi da ngan hang hien co)
      const shuffled = [...pool].sort(() => Math.random() - 0.5);
      const selected = assignment ? shuffled : shuffled.slice(0, Math.min(questionCount, shuffled.length));

      // Neu bat che do thich ung o luyen tap, sap xep uu tien muc co ban -> nang cao -> thu thach
      if (!assignment && adaptiveEnabled) {
        selected.sort((a, b) => a.level - b.level);
      }

      const limitMins = assignment
        ? assignment.durationMinutes
        : (MODE_OPTIONS.find((m) => m.id === targetMode)?.defaultMinutes || 0);

      setQuestions(selected);
      setCurrentIndex(0);
      setAnswers({});
      setFlaggedIds(new Set());
      setPracticeFeedback({});
      setElapsedSeconds(0);
      setTimeLimitSeconds(limitMins * 60);
      setStartedAt(new Date().toISOString());
      setResultAttempt(null);
      setNewBadges([]);
      setPhase('running');
    } catch (err: any) {
      setErrorMsg(err.message || 'Không thể tải danh sách câu hỏi.');
    }
  };

  const handleCheckCurrentPractice = async () => {
    const q = questions[currentIndex];
    if (!q) return;
    const val = answers[q.id];
    if (val === undefined || val === null || val === '') {
      setErrorMsg('Hãy chọn hoặc nhập câu trả lời trước khi kiểm tra.');
      return;
    }
    setErrorMsg('');
    try {
      const res = await apiRequest<any>('/api/practice/check', {
        method: 'POST',
        body: JSON.stringify({ questionId: q.id, answer: val })
      });
      setPracticeFeedback((prev) => ({ ...prev, [q.id]: res }));
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  const handleFinalSubmit = async (autoTimeout = false) => {
    if (submitting || questions.length === 0) return;
    setConfirmSubmitOpen(false);
    setSubmitting(true);
    setErrorMsg('');
    try {
      const items = questions.map((q) => ({
        questionId: q.id,
        answer: answers[q.id] ?? null
      }));
      const res = await apiRequest<{ attempt: Attempt; newlyEarnedBadges: Badge[] }>('/api/attempts', {
        method: 'POST',
        body: JSON.stringify({
          assignmentId: activeAssignment?.id || null,
          mode: activeAssignment ? activeAssignment.mode : mode,
          grade: activeAssignment ? activeAssignment.grade : grade,
          textbook: activeAssignment ? activeAssignment.textbook : textbook,
          topic: activeAssignment ? activeAssignment.topic : topic,
          level,
          adaptiveEnabled,
          startedAt,
          durationSeconds: Math.max(1, elapsedSeconds),
          items
        })
      });
      setResultAttempt(res.attempt);
      setNewBadges(res.newlyEarnedBadges || []);
      setPhase('result');
      onAttemptCompleted?.();
      if (autoTimeout) {
        setErrorMsg('Đã hết thời gian làm bài. Hệ thống đã tự động nộp bài của bạn.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Không thể nộp bài.');
    } finally {
      setSubmitting(false);
    }
  };

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const currentQuestion = questions[currentIndex];
  const answeredCount = questions.filter((q) => {
    const v = answers[q.id];
    if (v === undefined || v === null || v === '') return false;
    if (Array.isArray(v)) return v.some((item) => item !== null && item !== -1);
    return true;
  }).length;

  // =========================================================================
  // MAN HINH CAU HINH BAI ON LUYEN / KIEM TRA
  // =========================================================================
  if (phase === 'setup') {
    return (
      <div className="space-y-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-6 flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-4 dark:border-slate-800">
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-50">
                Thiết lập bài ôn luyện & kiểm tra
              </h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                Chọn đúng lớp, bộ sách giáo khoa, chủ đề, mức độ nhận thức và chế độ làm bài.
              </p>
            </div>
            {!user && (
              <p className="text-xs text-amber-700 dark:text-amber-400">
                Bạn đang luyện tập tự do. Đăng nhập tài khoản Học sinh để lưu lịch sử và nhận lộ trình cá nhân.
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Khối lớp
              </label>
              <select
                value={grade}
                onChange={(e) => {
                  setGrade(Number(e.target.value));
                  setTopic('');
                }}
                className="min-h-[42px] w-full rounded-xl border border-slate-300 bg-white px-3.5 text-sm font-medium text-slate-900 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              >
                {[6, 7, 8, 9].map((g) => (
                  <option key={g} value={g}>Toán Lớp {g}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Bộ sách giáo khoa (GDPT 2018)
              </label>
              <select
                value={textbook}
                onChange={(e) => setTextbook(e.target.value as TextbookId)}
                className="min-h-[42px] w-full rounded-xl border border-slate-300 bg-white px-3.5 text-sm font-medium text-slate-900 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              >
                {curriculum.textbooks.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Chủ đề kiến thức
              </label>
              <select
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                className="min-h-[42px] w-full rounded-xl border border-slate-300 bg-white px-3.5 text-sm font-medium text-slate-900 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              >
                <option value="">Tất cả chủ đề Lớp {grade}</option>
                {gradeTopics.map((t) => (
                  <option key={t.key} value={t.key}>{t.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Hình thức luyện tập / kiểm tra
              </label>
              <select
                value={mode}
                onChange={(e) => {
                  const m = e.target.value as PracticeMode;
                  setMode(m);
                  const found = MODE_OPTIONS.find((item) => item.id === m);
                  if (found) setQuestionCount(found.defaultCount);
                }}
                className="min-h-[42px] w-full rounded-xl border border-slate-300 bg-white px-3.5 text-sm font-medium text-slate-900 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              >
                {MODE_OPTIONS.map((m) => (
                  <option key={m.id} value={m.id}>{m.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Mức độ nhận thức
              </label>
              <select
                value={level}
                onChange={(e) => setLevel(Number(e.target.value))}
                className="min-h-[42px] w-full rounded-xl border border-slate-300 bg-white px-3.5 text-sm font-medium text-slate-900 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              >
                <option value={0}>Tổng hợp cả 3 mức độ</option>
                <option value={1}>Mức 1 – Cơ bản (Nhận biết, Thông hiểu)</option>
                <option value={2}>Mức 2 – Nâng cao (Vận dụng)</option>
                <option value={3}>Mức 3 – Thử thách (Vận dụng cao)</option>
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Số lượng câu hỏi
              </label>
              <select
                value={questionCount}
                onChange={(e) => setQuestionCount(Number(e.target.value))}
                className="min-h-[42px] w-full rounded-xl border border-slate-300 bg-white px-3.5 text-sm font-medium text-slate-900 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              >
                {[5, 10, 15, 20, 30, 40].map((c) => (
                  <option key={c} value={c}>{c} câu hỏi</option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 pt-5 dark:border-slate-800">
            <label className="flex cursor-pointer items-center gap-2.5 text-sm text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={adaptiveEnabled}
                onChange={(e) => setAdaptiveEnabled(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <SlidersHorizontal className="h-4 w-4 text-slate-500" />
              <span>Bật chế độ thích ứng độ khó theo tiến trình làm bài</span>
            </label>

            <button
              type="button"
              onClick={() => startSession(null)}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 whitespace-nowrap"
            >
              <Play className="h-4 w-4" />
              <span>Bắt đầu làm bài</span>
            </button>
          </div>

          {errorMsg && (
            <div className="mt-4 rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200">
              {errorMsg}
            </div>
          )}
        </div>
      </div>
    );
  }

  // =========================================================================
  // MAN HINH DANG LAM BAI (LUYEN TAP HOAC KIEM TRA)
  // =========================================================================
  if (phase === 'running' && currentQuestion) {
    const remainingSec = timeLimitSeconds > 0 ? Math.max(0, timeLimitSeconds - elapsedSeconds) : elapsedSeconds;
    const progressPct = Math.round(((currentIndex + 1) / questions.length) * 100);
    const currentFeedback = practiceFeedback[currentQuestion.id] || null;
    const revealSolutionsNow = activeAssignment
      ? activeAssignment.revealSolutionMode === 'immediate' && Boolean(currentFeedback)
      : !isExamMode && Boolean(currentFeedback);

    return (
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_290px]">
        <div className="space-y-5">
          {/* Thanh trang thai & Tien do */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                {activeAssignment ? activeAssignment.title : `${modeMeta.label} · Toán ${grade}`}
              </div>
              <div className="flex items-center gap-4 font-mono text-sm font-semibold">
                <span className={`inline-flex items-center gap-1.5 ${timeLimitSeconds > 0 && remainingSec < 120 ? 'text-rose-600 dark:text-rose-400' : 'text-blue-700 dark:text-blue-400'}`}>
                  <Clock className="h-4 w-4" />
                  {timeLimitSeconds > 0 ? `Còn ${formatTime(remainingSec)}` : formatTime(elapsedSeconds)}
                </span>
                <span className="text-slate-600 dark:text-slate-400">
                  Đã làm {answeredCount}/{questions.length}
                </span>
              </div>
            </div>
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div
                className="h-full bg-blue-600 transition-transform duration-200"
                style={{ transform: `scaleX(${progressPct / 100})`, transformOrigin: 'left' }}
              />
            </div>
          </div>

          {/* Noi dung cau hoi */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
            <QuestionCard
              question={currentQuestion}
              index={currentIndex}
              total={questions.length}
              value={answers[currentQuestion.id]}
              onChange={(val) => setAnswers((prev) => ({ ...prev, [currentQuestion.id]: val }))}
              locked={revealSolutionsNow}
              showSolution={revealSolutionsNow}
              feedback={currentFeedback}
            />

            {errorMsg && (
              <div className="mt-4 rounded-xl border border-rose-300 bg-rose-50 px-4 py-2.5 text-sm text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200">
                {errorMsg}
              </div>
            )}

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={currentIndex === 0}
                  onClick={() => {
                    setErrorMsg('');
                    setCurrentIndex((i) => Math.max(0, i - 1));
                  }}
                  className="inline-flex min-h-[42px] items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 whitespace-nowrap"
                >
                  <ChevronLeft className="h-4 w-4" />
                  <span>Câu trước</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFlaggedIds((prev) => {
                      const next = new Set(prev);
                      if (next.has(currentQuestion.id)) next.delete(currentQuestion.id);
                      else next.add(currentQuestion.id);
                      return next;
                    });
                  }}
                  className={`inline-flex min-h-[42px] items-center gap-1.5 rounded-xl border px-3.5 py-2 text-sm font-semibold whitespace-nowrap ${
                    flaggedIds.has(currentQuestion.id)
                      ? 'border-amber-500 bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
                      : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                  }`}
                >
                  <Flag className="h-4 w-4" />
                  <span>Đánh dấu xem lại</span>
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {!isExamMode && !currentFeedback && (
                  <button
                    type="button"
                    onClick={handleCheckCurrentPractice}
                    className="inline-flex min-h-[42px] items-center gap-1.5 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 whitespace-nowrap"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Kiểm tra đáp án</span>
                  </button>
                )}

                {currentIndex < questions.length - 1 ? (
                  <button
                    type="button"
                    onClick={() => {
                      setErrorMsg('');
                      setCurrentIndex((i) => i + 1);
                    }}
                    className="inline-flex min-h-[42px] items-center gap-1.5 rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 whitespace-nowrap"
                  >
                    <span>Câu tiếp theo</span>
                    <ChevronRight className="h-4 w-4" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmSubmitOpen(true)}
                    className="inline-flex min-h-[42px] items-center gap-1.5 rounded-xl bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700 whitespace-nowrap"
                  >
                    <span>Nộp bài</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Bang dieu huong cau hoi */}
        <aside className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Danh sách câu hỏi</h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Chọn số để chuyển nhanh giữa các câu.
            </p>
            <div className="mt-4 grid grid-cols-5 gap-2">
              {questions.map((q, idx) => {
                const v = answers[q.id];
                const hasAns = v !== undefined && v !== null && v !== '' && (!Array.isArray(v) || v.some((x) => x !== null && x !== -1));
                const isCur = idx === currentIndex;
                const isFlagged = flaggedIds.has(q.id);
                return (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => setCurrentIndex(idx)}
                    className={`relative flex h-10 items-center justify-center rounded-lg border font-mono text-xs font-bold transition-colors ${
                      isCur
                        ? 'border-blue-600 bg-blue-600 text-white'
                        : hasAns
                        ? 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300'
                        : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                    }`}
                  >
                    {idx + 1}
                    {isFlagged && (
                      <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-amber-500" />
                    )}
                  </button>
                );
              })}
            </div>

            <div className="mt-4 space-y-1.5 border-t border-slate-100 pt-3 text-xs text-slate-600 dark:border-slate-800 dark:text-slate-400">
              <div className="flex justify-between">
                <span>Đã trả lời:</span>
                <span className="font-mono font-semibold">{answeredCount}</span>
              </div>
              <div className="flex justify-between">
                <span>Chưa trả lời:</span>
                <span className="font-mono font-semibold text-amber-600 dark:text-amber-400">
                  {questions.length - answeredCount}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setConfirmSubmitOpen(true)}
              className="mt-4 min-h-[42px] w-full rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              Nộp bài và chấm điểm
            </button>
            <button
              type="button"
              onClick={() => {
                setPhase('setup');
                onClearAssignment?.();
              }}
              className="mt-2 min-h-[38px] w-full rounded-xl border border-slate-200 px-4 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
            >
              Thoát về màn hình chọn bài
            </button>
          </div>
        </aside>

        {/* Hop thoai xac nhan truoc khi nop bai */}
        {confirmSubmitOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
            <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900">
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-50">Xác nhận nộp bài</h3>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                Bạn đã trả lời <strong className="font-mono">{answeredCount}/{questions.length}</strong> câu hỏi.
                {answeredCount < questions.length
                  ? ` Vẫn còn ${questions.length - answeredCount} câu chưa trả lời.`
                  : ' Tất cả câu hỏi đã có câu trả lời.'}
              </p>
              <div className="mt-6 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setConfirmSubmitOpen(false)}
                  className="min-h-[40px] rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200"
                >
                  Làm tiếp
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => handleFinalSubmit(false)}
                  className="min-h-[40px] rounded-xl bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
                >
                  {submitting ? 'Đang chấm...' : 'Chắc chắn nộp bài'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // MAN HINH KET QUA & XEM LAI LOI GIAI
  // =========================================================================
  if (phase === 'result' && resultAttempt) {
    const canRevealSolutions = !activeAssignment || activeAssignment.revealSolutionMode !== 'hidden';

    return (
      <div className="space-y-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-5 dark:border-slate-800">
            <div>
              <div className="text-xs font-semibold text-blue-700 dark:text-blue-400">
                Phiếu kết quả bài làm
              </div>
              <h2 className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-50">
                Điểm số: <span className="font-mono text-blue-600 dark:text-blue-400">{resultAttempt.score}/{resultAttempt.maxScore}</span> ({resultAttempt.percentage}%)
              </h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                Đúng {resultAttempt.correctCount}/{resultAttempt.totalCount} câu · Thời gian: {formatTime(resultAttempt.durationSeconds)}
                {resultAttempt.status === 'needs_grading' && ' · Có câu tự luận đang chờ giáo viên chấm bổ sung'}
              </p>
            </div>

            <div className="no-print flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                <Printer className="h-4 w-4" />
                <span>In phiếu / Lưu PDF</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setPhase('setup');
                  onClearAssignment?.();
                }}
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
              >
                <RotateCcw className="h-4 w-4" />
                <span>Làm bài khác</span>
              </button>
            </div>
          </div>

          {newBadges.length > 0 && (
            <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/30">
              <div className="flex items-center gap-2 font-bold text-amber-900 dark:text-amber-200">
                <Award className="h-5 w-5 text-amber-600" />
                <span>Chúc mừng! Bạn vừa đạt huy hiệu mới:</span>
              </div>
              <ul className="mt-2 list-disc space-y-1 pl-6 text-sm text-amber-800 dark:text-amber-300">
                {newBadges.map((b) => (
                  <li key={b.id}><strong>{b.title}</strong> — {b.description}</li>
                ))}
              </ul>
            </div>
          )}

          {canRevealSolutions ? (
            <div className="mt-6 space-y-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Chi tiết từng câu và lời giải 5 bước
              </h3>
              {resultAttempt.answers.map((ans, idx) => (
                <div
                  key={ans.questionId}
                  className="rounded-xl border border-slate-200 p-4 dark:border-slate-800"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold">
                    <span className="font-mono text-slate-500">Câu {idx + 1} · {ans.code}</span>
                    <span className={ans.isCorrect ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}>
                      {ans.isCorrect ? 'Đúng' : ans.needsManualGrading ? 'Chờ giáo viên chấm' : 'Chưa đúng'} ({ans.score}/{ans.maxScore} điểm)
                    </span>
                  </div>
                  <div className="mt-2 font-medium text-slate-900 dark:text-slate-100">
                    <MathText text={ans.prompt} />
                  </div>
                  <div className="mt-2 text-xs text-slate-600 dark:text-slate-400">
                    Đáp án chuẩn: <MathText text={ans.expectedDisplay} />
                  </div>
                  {ans.solutionSteps?.length > 0 && (
                    <div className="mt-3 space-y-1 border-t border-slate-100 pt-2.5 text-sm text-slate-700 dark:border-slate-800 dark:text-slate-300">
                      {ans.solutionSteps.map((s, sIdx) => (
                        <div key={sIdx}><MathText text={s} /></div>
                      ))}
                      {ans.commonMistake && (
                        <div className="pt-1 text-xs text-amber-700 dark:text-amber-400">
                          <strong>Bước 5 (Lỗi dễ mắc):</strong> <MathText text={ans.commonMistake} />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-5 text-sm text-slate-600 dark:text-slate-400">
              Giáo viên đang cấu hình ẩn đáp án chi tiết cho bài kiểm tra này sau khi nộp.
            </p>
          )}
        </div>
      </div>
    );
  }

  return null;
};
