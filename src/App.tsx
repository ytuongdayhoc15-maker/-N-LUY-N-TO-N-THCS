import React, { useEffect, useMemo, useState } from 'react';
import {
  Award,
  BookOpen,
  ChevronRight,
  Compass,
  LogOut,
  Monitor,
  Moon,
  Play,
  Sun,
  TrendingUp,
  User as UserIcon
} from 'lucide-react';
import {
  Assignment,
  Attempt,
  Badge,
  CurriculumData,
  PersonalizedRecommendations,
  PracticeMode,
  TextbookId,
  User
} from './types';
import { apiRequest, setCsrfToken } from './lib/api';
import { HeroGeometrySandbox } from './components/HeroGeometrySandbox';
import { PracticeWorkspace } from './components/PracticeWorkspace';
import { GamesHub } from './components/GamesHub';
import { TeacherAdminConsole } from './components/TeacherAdminConsole';
import { GuideAndDownload } from './components/GuideAndDownload';

type ActiveView = 'home' | 'practice' | 'games' | 'teacher' | 'guide';

export default function App() {
  const [view, setView] = useState<ActiveView>('home');
  const [darkMode, setDarkMode] = useState<boolean>(false);
  const [projectorMode, setProjectorMode] = useState<boolean>(false);

  const [curriculum, setCurriculum] = useState<CurriculumData | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [studentData, setStudentData] = useState<{
    attempts: Attempt[];
    badges: Badge[];
    assignments: Assignment[];
    recommendations: PersonalizedRecommendations;
  } | null>(null);

  // Lua chon tren trang chu de chuyen thang vao bai luyen tap
  const [selectedGrade, setSelectedGrade] = useState<number>(6);
  const [selectedBook, setSelectedBook] = useState<TextbookId>('kntt');
  const [selectedSemester, setSelectedSemester] = useState<number>(1);
  const [practiceTarget, setPracticeTarget] = useState<{
    grade: number;
    textbook: TextbookId;
    topic: string;
    mode: PracticeMode;
    assignment?: Assignment | null;
  }>({
    grade: 6,
    textbook: 'kntt',
    topic: '',
    mode: 'lesson',
    assignment: null
  });

  // Modal dang nhap & doi mat khau
  const [authModalOpen, setAuthModalOpen] = useState<boolean>(false);
  const [loginUser, setLoginUser] = useState<string>('');
  const [loginPass, setLoginPass] = useState<string>('');
  const [authError, setAuthError] = useState<string>('');
  const [changePassOpen, setChangePassOpen] = useState<boolean>(false);
  const [oldPass, setOldPass] = useState<string>('');
  const [newPass, setNewPass] = useState<string>('');
  const [passMsg, setPassMsg] = useState<string>('');

  // Dong bo dark mode voi class .dark tren <html>
  useEffect(() => {
    const saved = localStorage.getItem('toan-thcs-theme');
    if (saved === 'dark') {
      setDarkMode(true);
      document.documentElement.classList.add('dark');
    }
  }, []);

  const toggleDarkMode = () => {
    setDarkMode((prev) => {
      const next = !prev;
      document.documentElement.classList.toggle('dark', next);
      localStorage.setItem('toan-thcs-theme', next ? 'dark' : 'light');
      return next;
    });
  };

  const refreshStudentOverview = async () => {
    try {
      const data = await apiRequest<any>('/api/student/overview');
      setStudentData(data);
    } catch {
      setStudentData(null);
    }
  };

  useEffect(() => {
    apiRequest<CurriculumData>('/api/curriculum').then(setCurriculum).catch(() => {});
    apiRequest<{ user: User | null; csrfToken: string | null }>('/api/auth/me')
      .then((res) => {
        setUser(res.user);
        setCsrfToken(res.csrfToken);
        if (res.user) refreshStudentOverview();
      })
      .catch(() => {});
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    try {
      const res = await apiRequest<{ user: User; csrfToken: string }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username: loginUser, password: loginPass })
      });
      setUser(res.user);
      setCsrfToken(res.csrfToken);
      setAuthModalOpen(false);
      setLoginPass('');
      await refreshStudentOverview();
      if (res.user.role === 'teacher' || res.user.role === 'admin') {
        setView('teacher');
      }
    } catch (err: any) {
      setAuthError(err.message);
    }
  };

  const handleLogout = async () => {
    await apiRequest('/api/auth/logout', { method: 'POST' }).catch(() => {});
    setUser(null);
    setCsrfToken(null);
    setStudentData(null);
    if (view === 'teacher') setView('home');
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPassMsg('');
    try {
      await apiRequest('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ oldPassword: oldPass, newPassword: newPass })
      });
      setPassMsg('Đổi mật khẩu thành công.');
      setOldPass('');
      setNewPass('');
    } catch (err: any) {
      setPassMsg(err.message);
    }
  };

  const startPracticeFromHome = (topicKey: string, mode: PracticeMode = 'lesson', assignment?: Assignment | null) => {
    setPracticeTarget({
      grade: assignment ? assignment.grade : selectedGrade,
      textbook: assignment ? assignment.textbook : selectedBook,
      topic: topicKey,
      mode,
      assignment: assignment || null
    });
    setView('practice');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const chaptersForSelection = useMemo(() => {
    if (!curriculum) return [];
    const gradeBlock = curriculum.grades[String(selectedGrade)];
    if (!gradeBlock) return [];
    const list = gradeBlock.books[selectedBook] || [];
    return list.filter((c) => c.semester === selectedSemester);
  }, [curriculum, selectedGrade, selectedBook, selectedSemester]);

  // Chi so thuc te cua nguoi dung (0 neu chua lam bai nao - tuyet doi khong dung so lieu gia)
  const kpiStats = useMemo(() => {
    const attempts = studentData?.attempts || [];
    const totalAttempts = attempts.length;
    const totalCorrect = attempts.reduce((s, a) => s + a.correctCount, 0);
    const totalQ = attempts.reduce((s, a) => s + a.totalCount, 0);
    const accuracy = totalQ > 0 ? Math.round((totalCorrect / totalQ) * 100) : 0;
    const bestPct = totalAttempts > 0 ? Math.max(...attempts.map((a) => a.percentage)) : 0;
    return { totalAttempts, totalCorrect, accuracy, bestPct };
  }, [studentData]);

  return (
    <div className={`min-h-screen bg-slate-50 text-slate-900 transition-colors dark:bg-slate-950 dark:text-slate-100 ${projectorMode ? 'projector-mode' : ''}`}>
      {/* TOP BAR CONTRACT: 3 vung ro rang [Wordmark] — [5 Nav Links] — [1 Primary Action] */}
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur-xs dark:border-slate-800 dark:bg-slate-950/95">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-8 px-4 py-3.5 sm:px-6">
          <button
            type="button"
            onClick={() => setView('home')}
            className="font-display text-lg font-extrabold tracking-tight text-slate-900 whitespace-nowrap shrink-0 dark:text-slate-50"
          >
            Toán THCS
          </button>

          <nav className="hidden items-center gap-6 md:flex" aria-label="Điều hướng chính">
            {[
              { id: 'home', label: 'Trang chủ' },
              { id: 'practice', label: 'Luyện tập & Thi' },
              { id: 'games', label: 'Trò chơi' },
              { id: 'teacher', label: 'Giáo viên' },
              { id: 'guide', label: 'Tài liệu' }
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setView(item.id as ActiveView)}
                className={`border-b-2 py-1 text-sm font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  view === item.id
                    ? 'border-blue-600 text-blue-700 dark:border-blue-400 dark:text-blue-400'
                    : 'border-transparent text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>

          <div className="shrink-0">
            {user ? (
              <button
                type="button"
                onClick={() => setChangePassOpen(true)}
                className="inline-flex min-h-[40px] items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 whitespace-nowrap dark:bg-blue-600 dark:hover:bg-blue-700"
              >
                <UserIcon className="h-3.5 w-3.5" />
                <span className="max-w-[140px] truncate">{user.fullName}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setAuthModalOpen(true)}
                className="inline-flex min-h-[40px] items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 whitespace-nowrap"
              >
                Đăng nhập
              </button>
            )}
          </div>
        </div>

        {/* Dieu huong tren man hinh nho */}
        <div className="flex items-center gap-4 overflow-x-auto border-t border-slate-100 px-4 py-2 md:hidden dark:border-slate-800">
          {[
            { id: 'home', label: 'Trang chủ' },
            { id: 'practice', label: 'Luyện tập' },
            { id: 'games', label: 'Trò chơi' },
            { id: 'teacher', label: 'Giáo viên' },
            { id: 'guide', label: 'Tài liệu' }
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setView(item.id as ActiveView)}
              className={`text-xs font-semibold whitespace-nowrap shrink-0 ${
                view === item.id ? 'text-blue-600 dark:text-blue-400' : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </header>

      {/* THANH CONG CU WORKSPACE: Che do Sang/Toi, Trinh chieu lop hoc, Dang xuat */}
      <div className="no-print border-b border-slate-200/80 bg-white/60 dark:border-slate-800/80 dark:bg-slate-900/50">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-2 text-xs sm:px-6">
          <div className="text-slate-600 dark:text-slate-400">
            <span>Hệ thống Ôn luyện Toán THCS (Lớp 6–9)</span>
            <span className="mx-2" aria-hidden="true">·</span>
            <span>GDPT 2018</span>
            {user && (
              <>
                <span className="mx-2" aria-hidden="true">·</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {user.studentCode} ({user.role === 'admin' ? 'Quản trị viên' : user.role === 'teacher' ? 'Giáo viên' : 'Học sinh'})
                </span>
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setProjectorMode((p) => !p)}
              className={`inline-flex min-h-[34px] items-center gap-1.5 rounded-lg border px-2.5 font-medium transition-colors whitespace-nowrap ${
                projectorMode
                  ? 'border-blue-600 bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
              }`}
            >
              <Monitor className="h-3.5 w-3.5" />
              <span>{projectorMode ? 'Đang bật trình chiếu' : 'Trình chiếu lớp học'}</span>
            </button>

            <button
              type="button"
              onClick={toggleDarkMode}
              className="inline-flex min-h-[34px] items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              {darkMode ? <Sun className="h-3.5 w-3.5 text-amber-400" /> : <Moon className="h-3.5 w-3.5 text-slate-600" />}
              <span>{darkMode ? 'Chế độ sáng' : 'Chế độ tối'}</span>
            </button>

            {user && (
              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex min-h-[34px] items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 font-medium text-rose-600 hover:bg-rose-50 whitespace-nowrap dark:border-slate-700 dark:bg-slate-800 dark:text-rose-400"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Đăng xuất</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* NOI DUNG CHINH */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        {view === 'home' && curriculum && (
          <div className="space-y-10">
            {/* HERO 2 COT CAN BANG */}
            <section className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-[1.15fr_0.85fr]">
              <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-7 shadow-xs dark:border-slate-800 dark:bg-slate-900">
                <div>
                  <p className="text-xs font-semibold text-blue-700 dark:text-blue-400">
                    Chương trình GDPT 2018 · Kết nối tri thức · Chân trời sáng tạo · Cánh diều
                  </p>
                  <h1 className="mt-2.5 text-3xl font-extrabold tracking-tight text-balance text-slate-900 sm:text-4xl dark:text-slate-50">
                    Hệ thống Ôn luyện Toán THCS
                  </h1>
                  <p className="mt-3 max-w-xl text-base leading-relaxed text-slate-600 dark:text-slate-300">
                    Học thông minh – Luyện tập mỗi ngày – Chinh phục Toán học. Luyện 10 dạng bài tập theo từng bộ sách, lời giải chi tiết 5 bước và 10 trò chơi trình chiếu lớp học.
                  </p>
                </div>

                <div className="mt-6 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => startPracticeFromHome('', 'lesson')}
                    className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 whitespace-nowrap"
                  >
                    <Play className="h-4 w-4" />
                    <span>Luyện tập Lớp {selectedGrade} ngay</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setView('games')}
                    className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                  >
                    <Compass className="h-4 w-4 text-violet-600" />
                    <span>Khám phá 10 Trò chơi</span>
                  </button>
                </div>
              </div>

              <HeroGeometrySandbox />
            </section>

            {/* DAI KPI THONG KE THUC TE (4 COT) */}
            <section aria-label="Thống kê học tập cá nhân" className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Lượt đã hoàn thành</div>
                <div className="mt-1 font-mono text-2xl font-bold text-slate-900 dark:text-slate-50">
                  {kpiStats.totalAttempts}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Số câu trả lời đúng</div>
                <div className="mt-1 font-mono text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                  {kpiStats.totalCorrect}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Tỉ lệ chính xác</div>
                <div className="mt-1 font-mono text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {kpiStats.accuracy}%
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Điểm cao nhất</div>
                <div className="mt-1 font-mono text-2xl font-bold text-violet-600 dark:text-violet-400">
                  {kpiStats.bestPct}%
                </div>
              </div>
            </section>

            {/* THU VIEN CHU DE THEO LOP - BO SACH - HOC KY - CHUONG - BAI HOC */}
            <section className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-5 dark:border-slate-800">
                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-slate-50">
                    Thư viện Kiến thức & Mục lục Sách giáo khoa
                  </h2>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                    {curriculum.grades[String(selectedGrade)]?.overview}
                  </p>
                </div>

                {/* Chon Khoi lop */}
                <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
                  {[6, 7, 8, 9].map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setSelectedGrade(g)}
                      className={`min-h-[38px] rounded-lg px-4 py-1.5 text-sm font-semibold transition-colors whitespace-nowrap ${
                        selectedGrade === g
                          ? 'bg-white text-blue-700 shadow-xs dark:bg-slate-900 dark:text-blue-400'
                          : 'text-slate-600 hover:text-slate-900 dark:text-slate-400'
                      }`}
                    >
                      Lớp {g}
                    </button>
                  ))}
                </div>
              </div>

              {/* Chon Bo sach va Hoc ky */}
              <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap gap-1.5 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
                  {curriculum.textbooks.map((book) => (
                    <button
                      key={book.id}
                      type="button"
                      onClick={() => setSelectedBook(book.id)}
                      className={`min-h-[36px] rounded-lg px-3.5 py-1 text-xs font-semibold transition-colors whitespace-nowrap ${
                        selectedBook === book.id
                          ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-slate-50'
                          : 'text-slate-600 hover:text-slate-900 dark:text-slate-400'
                      }`}
                    >
                      {book.name}
                    </button>
                  ))}
                </div>

                <div className="flex gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
                  {[1, 2].map((sem) => (
                    <button
                      key={sem}
                      type="button"
                      onClick={() => setSelectedSemester(sem)}
                      className={`min-h-[36px] rounded-lg px-3.5 py-1 text-xs font-semibold transition-colors whitespace-nowrap ${
                        selectedSemester === sem
                          ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-slate-50'
                          : 'text-slate-600 hover:text-slate-900 dark:text-slate-400'
                      }`}
                    >
                      Học kì {sem === 1 ? 'I' : 'II'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Danh sach Chuong & Bai hoc */}
              <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
                {chaptersForSelection.map((ch) => (
                  <div
                    key={ch.id}
                    className="flex flex-col justify-between rounded-xl border border-slate-200 p-4 dark:border-slate-800"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-blue-700 dark:text-blue-400">{ch.code}</span>
                        <button
                          type="button"
                          onClick={() => startPracticeFromHome(ch.topicKey, 'chapter')}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400"
                        >
                          <span>Ôn tập chương</span>
                          <ChevronRight className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <h3 className="mt-1 font-bold text-slate-900 dark:text-slate-100">{ch.title}</h3>
                      <ul className="mt-3 space-y-1.5 text-sm text-slate-600 dark:text-slate-300">
                        {ch.lessons.map((lesson) => (
                          <li key={lesson.id}>
                            <button
                              type="button"
                              onClick={() => startPracticeFromHome(ch.topicKey, 'lesson')}
                              className="flex w-full items-center justify-between rounded-lg px-2 py-1 text-left hover:bg-slate-50 dark:hover:bg-slate-800/60"
                            >
                              <span>
                                <strong className="font-semibold text-slate-800 dark:text-slate-200">{lesson.code}:</strong>{' '}
                                {lesson.title}
                              </span>
                              <span className="text-xs text-blue-600 dark:text-blue-400">Luyện</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* BAI DUOC GIAO & LO TRINH HOC TAP CA NHAN (HIEN THI KHI DANG NHAP) */}
            {user && studentData && (
              <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
                  <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-slate-50">
                    <BookOpen className="h-5 w-5 text-blue-600" />
                    <span>Bài tập & Kiểm tra được giao</span>
                  </h2>
                  {studentData.assignments.length === 0 ? (
                    <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                      Hiện chưa có bài giao nào dành riêng cho lớp của bạn.
                    </p>
                  ) : (
                    <div className="mt-4 space-y-3">
                      {studentData.assignments.map((asg) => (
                        <div
                          key={asg.id}
                          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-4 dark:border-slate-800"
                        >
                          <div>
                            <div className="font-semibold text-slate-900 dark:text-slate-100">{asg.title}</div>
                            <div className="text-xs text-slate-500">
                              Toán {asg.grade} · {asg.durationMinutes} phút · {asg.questionIds.length} câu
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => startPracticeFromHome(asg.topic, asg.mode, asg)}
                            className="min-h-[38px] rounded-xl bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
                          >
                            Làm bài ngay
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
                  <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-slate-50">
                    <TrendingUp className="h-5 w-5 text-emerald-600" />
                    <span>Đề xuất lộ trình & Thành tích</span>
                  </h2>
                  <div className="mt-4 space-y-3">
                    {studentData.recommendations.weeklyPlan.map((step, i) => (
                      <div key={i} className="rounded-xl border border-slate-200 p-3.5 dark:border-slate-800">
                        <div className="text-xs font-bold text-blue-700 dark:text-blue-400">{step.day}</div>
                        <div className="mt-0.5 text-sm font-semibold text-slate-900 dark:text-slate-100">{step.focus}</div>
                        <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{step.action}</p>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Căn cứ: {step.reason}</p>
                      </div>
                    ))}
                  </div>
                  {studentData.badges.length > 0 && (
                    <div className="mt-4 border-t border-slate-100 pt-4 dark:border-slate-800">
                      <div className="mb-2 flex items-center gap-1.5 text-xs font-bold text-amber-700 dark:text-amber-400">
                        <Award className="h-4 w-4" />
                        <span>Huy hiệu đã đạt ({studentData.badges.length})</span>
                      </div>
                      <div className="space-y-1.5 text-xs text-slate-700 dark:text-slate-300">
                        {studentData.badges.map((b) => (
                          <div key={b.id}><strong>{b.title}</strong> — {b.description}</div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </section>
            )}
          </div>
        )}

        {view === 'practice' && curriculum && (
          <PracticeWorkspace
            curriculum={curriculum}
            user={user}
            initialGrade={practiceTarget.grade}
            initialTextbook={practiceTarget.textbook}
            initialTopic={practiceTarget.topic}
            initialMode={practiceTarget.mode}
            activeAssignment={practiceTarget.assignment}
            onClearAssignment={() => setPracticeTarget((p) => ({ ...p, assignment: null }))}
            onAttemptCompleted={() => {
              if (user) refreshStudentOverview();
            }}
          />
        )}

        {view === 'games' && curriculum && <GamesHub curriculum={curriculum} />}

        {view === 'teacher' && curriculum && (
          user && (user.role === 'teacher' || user.role === 'admin') ? (
            <TeacherAdminConsole user={user} curriculum={curriculum} />
          ) : (
            <div className="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-8 text-center dark:border-slate-800 dark:bg-slate-900">
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-50">
                Khu vực dành cho Giáo viên & Quản trị viên
              </h2>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                Vui lòng đăng nhập bằng tài khoản Giáo viên (<code className="font-mono">gv_toan</code>) hoặc Quản trị viên (<code className="font-mono">admin</code>) để quản lý ngân hàng câu hỏi, giao bài và xem báo cáo lớp học.
              </p>
              <button
                type="button"
                onClick={() => setAuthModalOpen(true)}
                className="mt-5 min-h-[42px] rounded-xl bg-blue-600 px-6 py-2 text-sm font-semibold text-white hover:bg-blue-700"
              >
                Đăng nhập ngay
              </button>
            </div>
          )
        )}

        {view === 'guide' && <GuideAndDownload />}
      </main>

      <footer className="no-print mt-12 border-t border-slate-200 bg-white py-6 text-center text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
        Hệ thống Ôn luyện Toán THCS (Lớp 6–9) · Chương trình GDPT 2018 · Vận hành cục bộ bảo mật trên Windows & trình duyệt
      </footer>

      {/* MODAL DANG NHAP */}
      {authModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <form
            onSubmit={handleLogin}
            className="w-full max-w-md space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900"
          >
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-50">Đăng nhập hệ thống</h2>
            <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              <div><strong>Học sinh mẫu:</strong> <span className="font-mono">hs_an</span> / <span className="font-mono">HocSinh@2026</span></div>
              <div><strong>Giáo viên:</strong> <span className="font-mono">gv_toan</span> / <span className="font-mono">GiaoVien@2026</span></div>
              <div><strong>Quản trị:</strong> <span className="font-mono">admin</span> / <span className="font-mono">Admin@2026</span></div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">Tên đăng nhập</label>
              <input
                required
                value={loginUser}
                onChange={(e) => setLoginUser(e.target.value)}
                className="min-h-[42px] w-full rounded-xl border border-slate-300 px-3.5 text-sm dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">Mật khẩu</label>
              <input
                required
                type="password"
                value={loginPass}
                onChange={(e) => setLoginPass(e.target.value)}
                className="min-h-[42px] w-full rounded-xl border border-slate-300 px-3.5 text-sm dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            {authError && <p className="text-xs font-semibold text-rose-600">{authError}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setAuthModalOpen(false)}
                className="min-h-[40px] rounded-xl border border-slate-300 px-4 text-sm font-semibold dark:border-slate-700"
              >
                Đóng
              </button>
              <button
                type="submit"
                className="min-h-[40px] rounded-xl bg-blue-600 px-5 text-sm font-semibold text-white hover:bg-blue-700"
              >
                Đăng nhập
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL DOI MAT KHAU CA NHAN */}
      {changePassOpen && user && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <form
            onSubmit={handleChangePassword}
            className="w-full max-w-md space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900"
          >
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-50">Tài khoản: {user.fullName}</h2>
            <p className="text-xs text-slate-500">Mã định danh: {user.studentCode} · Đổi mật khẩu bảo mật</p>
            <input
              required
              type="password"
              value={oldPass}
              onChange={(e) => setOldPass(e.target.value)}
              placeholder="Mật khẩu hiện tại"
              className="min-h-[42px] w-full rounded-xl border border-slate-300 px-3.5 text-sm dark:border-slate-700 dark:bg-slate-800"
            />
            <input
              required
              type="password"
              value={newPass}
              onChange={(e) => setNewPass(e.target.value)}
              placeholder="Mật khẩu mới (tối thiểu 6 ký tự)"
              className="min-h-[42px] w-full rounded-xl border border-slate-300 px-3.5 text-sm dark:border-slate-700 dark:bg-slate-800"
            />
            {passMsg && <p className="text-xs font-semibold text-blue-600 dark:text-blue-400">{passMsg}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setChangePassOpen(false)} className="min-h-[40px] rounded-xl border border-slate-300 px-4 text-sm font-semibold dark:border-slate-700">
                Đóng
              </button>
              <button type="submit" className="min-h-[40px] rounded-xl bg-blue-600 px-5 text-sm font-semibold text-white hover:bg-blue-700">
                Cập nhật mật khẩu
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
