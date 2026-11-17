import React, { useEffect, useMemo, useState } from 'react';
import {
  Bell,
  Compass,
  Flame,
  Gamepad2,
  Grid3X3,
  Heart,
  HelpCircle,
  Play,
  RotateCcw,
  ShieldAlert,
  Swords,
  Timer,
  Trophy,
  Volume2,
  VolumeX
} from 'lucide-react';
import { CurriculumData, Question } from '../types';
import { apiRequest } from '../lib/api';
import { MathText } from './MathText';
import { MathDiagram } from './MathDiagram';

type GameId =
  | 'millionaire'
  | 'golden_bell'
  | 'lucky_wheel'
  | 'rescue_hero'
  | 'knowledge_race'
  | 'sprint_60s'
  | 'spot_error'
  | 'secret_tiles'
  | 'obstacle_course'
  | 'math_arena';

interface GameInfo {
  id: GameId;
  title: string;
  subtitle: string;
  rules: string;
  icon: React.FC<{ className?: string }>;
}

const GAMES: GameInfo[] = [
  {
    id: 'millionaire',
    title: 'Ai là triệu phú Toán học',
    subtitle: 'Chinh phục 10 bậc thang tri thức',
    rules: 'Trả lời đúng liên tiếp để leo thang điểm thưởng. Có quyền trợ giúp 50:50 (loại bỏ 2 phương án nhiễu).',
    icon: Trophy
  },
  {
    id: 'golden_bell',
    title: 'Rung chuông vàng',
    subtitle: 'Trả lời nhanh trước khi hết 25 giây/câu',
    rules: 'Mỗi câu có 25 giây đếm ngược. Trả lời đúng liên tiếp để nhân hệ số chuỗi thắng (Combo).',
    icon: Bell
  },
  {
    id: 'lucky_wheel',
    title: 'Vòng quay Toán học',
    subtitle: 'Quay nhận hệ số điểm rồi giải toán',
    rules: 'Nhấn quay vòng tròn để nhận hệ số (+10, +20, ×2 điểm hoặc Khiên bảo vệ), sau đó giải câu hỏi.',
    icon: Compass
  },
  {
    id: 'rescue_hero',
    title: 'Giải cứu nhân vật',
    subtitle: 'Vượt 6 chốt mở cổng giải cứu',
    rules: 'Bắt đầu với 3 trái tim năng lượng. Trả lời đúng mở 1 chốt khóa; trả lời sai mất 1 tim.',
    icon: Heart
  },
  {
    id: 'knowledge_race',
    title: 'Đường đua tri thức',
    subtitle: 'Đua tốc độ về đích cùng đối thủ ảo',
    rules: 'Mỗi câu đúng giúp xe của bạn tiến 1 bước. Hãy cán đích 8 bước trước khi đối thủ hoàn thành!',
    icon: Flame
  },
  {
    id: 'sprint_60s',
    title: 'Thử thách 60 giây',
    subtitle: 'Giải tối đa số câu trong đúng 60 giây',
    rules: 'Đồng hồ đếm ngược 60 giây. Trả lời đúng +10 điểm, trả lời nhanh giúp tăng kỷ lục cá nhân.',
    icon: Timer
  },
  {
    id: 'spot_error',
    title: 'Tìm lỗi sai',
    subtitle: 'Soi bước giải và phát hiện lỗi toán học',
    rules: 'Tập trung vào các bài toán tìm bước biến đổi sai hoặc kiểm tra khẳng định đúng/sai.',
    icon: ShieldAlert
  },
  {
    id: 'secret_tiles',
    title: 'Lật ô bí mật',
    subtitle: 'Mở 6 ô ghép thành thông điệp Toán học',
    rules: 'Chọn từng ô số trên bảng. Giải đúng câu hỏi để mở ô và hé lộ câu danh ngôn Toán học ẩn giấu.',
    icon: Grid3X3
  },
  {
    id: 'obstacle_course',
    title: 'Vượt chướng ngại vật',
    subtitle: '4 chặng từ Cơ bản đến Vận dụng cao',
    rules: 'Hoàn thành lần lượt 4 chướng ngại vật tăng dần độ khó để nhận cúp Vượt chướng ngại vật.',
    icon: HelpCircle
  },
  {
    id: 'math_arena',
    title: 'Đấu trường Toán học',
    subtitle: 'Thi đấu 2 đội trực tiếp trên bảng lớp',
    rules: 'Phù hợp trình chiếu lớp học: Đội A và Đội B luân phiên hoặc bấm chuông giành quyền trả lời.',
    icon: Swords
  }
];

const WHEEL_WEDGES = [
  { label: '+10 đ', points: 10, color: '#2563eb' },
  { label: '+20 đ', points: 20, color: '#7c3aed' },
  { label: '+30 đ', points: 30, color: '#059669' },
  { label: '×2 điểm', points: 40, color: '#ea580c' },
  { label: '+15 đ', points: 15, color: '#0284c7' },
  { label: '+25 đ', points: 25, color: '#db2777' }
];

function playTone(ok: boolean, soundOn: boolean) {
  if (!soundOn || typeof window === 'undefined') return;
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = ok ? 'sine' : 'triangle';
    osc.frequency.setValueAtTime(ok ? 587.33 : 220, ctx.currentTime);
    if (ok) osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.14);
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.24);
  } catch {
    // Bo qua neu trinh duyet chan autoplay audio
  }
}

interface GamesHubProps {
  curriculum: CurriculumData;
}

export const GamesHub: React.FC<GamesHubProps> = ({ curriculum }) => {
  const [grade, setGrade] = useState<number>(0); // 0 = Tat ca lop 6-9
  const [topic, setTopic] = useState<string>('');
  const [soundOn, setSoundOn] = useState<boolean>(true);
  const [activeGame, setActiveGame] = useState<GameId | null>(null);

  const [pool, setPool] = useState<Question[]>([]);
  const [qIdx, setQIdx] = useState<number>(0);
  const [score, setScore] = useState<number>(0);
  const [streak, setStreak] = useState<number>(0);
  const [lives, setLives] = useState<number>(3);
  const [botProgress, setBotProgress] = useState<number>(0);
  const [playerProgress, setPlayerProgress] = useState<number>(0);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [eliminatedOpts, setEliminatedOpts] = useState<number[]>([]);
  const [lifeline5050Used, setLifeline5050Used] = useState<boolean>(false);
  const [wheelAngle, setWheelAngle] = useState<number>(0);
  const [wheelPoints, setWheelPoints] = useState<number>(10);
  const [wheelReady, setWheelReady] = useState<boolean>(false);
  const [revealedTiles, setRevealedTiles] = useState<boolean[]>([false, false, false, false, false, false]);
  const [selectedTile, setSelectedTile] = useState<number | null>(null);
  const [arenaScores, setArenaScores] = useState<{ A: number; B: number }>({ A: 0, B: 0 });
  const [arenaTurn, setArenaTurn] = useState<'A' | 'B'>('A');
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);
  const [gameOver, setGameOver] = useState<boolean>(false);

  const filteredTopics = useMemo(
    () => (grade === 0 ? curriculum.topics : curriculum.topics.filter((t) => t.grade === grade)),
    [curriculum.topics, grade]
  );

  const currentGameMeta = GAMES.find((g) => g.id === activeGame) || null;
  const currentQuestion = pool[qIdx] || null;

  // Loc cau hoi thich hop cho tro choi (uu tien dang MCQ / hinh ve / tim loi sai de choi nhanh muot)
  const launchGame = async (gameId: GameId) => {
    const params = new URLSearchParams();
    if (grade > 0) params.set('grade', String(grade));
    if (topic) params.set('topic', topic);

    const data = await apiRequest<{ questions: Question[] }>(`/api/questions?${params.toString()}`);
    let candidates = (data.questions || []).filter(
      (q) => Array.isArray(q.options) || (gameId === 'spot_error' && Array.isArray(q.workSteps))
    );

    if (gameId === 'spot_error') {
      const errOnly = candidates.filter((q) => q.type === 'find_error');
      if (errOnly.length >= 2) candidates = errOnly;
    }
    if (candidates.length === 0) {
      const all = await apiRequest<{ questions: Question[] }>('/api/questions');
      candidates = (all.questions || []).filter((q) => Array.isArray(q.options));
    }

    const shuffled = [...candidates].sort(() => Math.random() - 0.5);
    setPool(shuffled);
    setActiveGame(gameId);
    setQIdx(0);
    setScore(0);
    setStreak(0);
    setLives(3);
    setBotProgress(0);
    setPlayerProgress(0);
    setEliminatedOpts([]);
    setLifeline5050Used(false);
    setWheelPoints(10);
    setWheelReady(gameId !== 'lucky_wheel');
    setRevealedTiles([false, false, false, false, false, false]);
    setSelectedTile(gameId === 'secret_tiles' ? 0 : null);
    setArenaScores({ A: 0, B: 0 });
    setArenaTurn('A');
    setFeedback(null);
    setGameOver(false);

    if (gameId === 'sprint_60s') setTimeLeft(60);
    else if (gameId === 'golden_bell') setTimeLeft(25);
    else setTimeLeft(0);
  };

  // Bo dem gio cho Rung chuong vang va Thu thach 60 giay
  useEffect(() => {
    if (!activeGame || gameOver) return;
    if (activeGame !== 'sprint_60s' && activeGame !== 'golden_bell') return;
    if (feedback && activeGame === 'golden_bell') return;

    const timer = window.setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          if (activeGame === 'sprint_60s') {
            setGameOver(true);
            return 0;
          }
          if (activeGame === 'golden_bell') {
            playTone(false, soundOn);
            setFeedback({ ok: false, msg: 'Hết 25 giây! Bạn bị loại khỏi sàn đấu Rung chuông vàng.' });
            setGameOver(true);
            return 0;
          }
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [activeGame, gameOver, feedback, soundOn]);

  const handleAnswerInGame = (optIndex: number) => {
    if (!currentQuestion || feedback || gameOver) return;
    if (activeGame === 'lucky_wheel' && !wheelReady) return;

    const ok = optIndex === Number(currentQuestion.answer);
    playTone(ok, soundOn);

    const ptsEarned = activeGame === 'lucky_wheel'
      ? wheelPoints
      : activeGame === 'golden_bell'
      ? 10 + streak * 5
      : 10;

    if (ok) {
      setScore((s) => s + ptsEarned);
      setStreak((st) => st + 1);
      setPlayerProgress((p) => Math.min(8, p + 1));
      if (activeGame === 'math_arena') {
        setArenaScores((prev) => ({ ...prev, [arenaTurn]: prev[arenaTurn] + 10 }));
      }
      if (activeGame === 'secret_tiles' && selectedTile !== null) {
        setRevealedTiles((prev) => prev.map((v, idx) => (idx === selectedTile ? true : v)));
      }
      setFeedback({ ok: true, msg: `Chính xác! +${ptsEarned} điểm.` });
    } else {
      setStreak(0);
      if (activeGame === 'rescue_hero' || activeGame === 'millionaire' || activeGame === 'golden_bell') {
        const nextLives = activeGame === 'rescue_hero' ? lives - 1 : 0;
        setLives(nextLives);
        if (nextLives <= 0) {
          setGameOver(true);
        }
      }
      if (activeGame === 'knowledge_race') {
        setBotProgress((b) => Math.min(8, b + 2));
      }
      const correctLabel = Array.isArray(currentQuestion.options)
        ? currentQuestion.options[Number(currentQuestion.answer)]
        : currentQuestion.workSteps?.[Number(currentQuestion.answer)] || '';
      setFeedback({ ok: false, msg: `Chưa chính xác. Đáp án đúng là: ${correctLabel}` });
    }

    if (activeGame === 'knowledge_race' && ok) {
      setBotProgress((b) => Math.min(8, b + (Math.random() > 0.55 ? 1 : 0)));
    }
  };

  const nextGameStep = () => {
    if (!activeGame) return;
    const maxQuestions =
      activeGame === 'millionaire' ? Math.min(10, pool.length)
      : activeGame === 'rescue_hero' ? Math.min(6, pool.length)
      : activeGame === 'obstacle_course' ? Math.min(4, pool.length)
      : pool.length;

    if (activeGame === 'knowledge_race' && (playerProgress >= 8 || botProgress >= 8)) {
      setGameOver(true);
      return;
    }
    if (activeGame === 'secret_tiles' && revealedTiles.every(Boolean)) {
      setGameOver(true);
      return;
    }
    if (qIdx + 1 >= maxQuestions) {
      setGameOver(true);
      return;
    }

    setQIdx((i) => i + 1);
    setFeedback(null);
    setEliminatedOpts([]);
    if (activeGame === 'golden_bell') setTimeLeft(25);
    if (activeGame === 'lucky_wheel') setWheelReady(false);
    if (activeGame === 'math_arena') setArenaTurn((t) => (t === 'A' ? 'B' : 'A'));
    if (activeGame === 'secret_tiles') {
      const nextClosed = revealedTiles.findIndex((v) => !v);
      setSelectedTile(nextClosed >= 0 ? nextClosed : null);
    }
  };

  const spinWheel = () => {
    if (wheelReady) return;
    const pick = Math.floor(Math.random() * WHEEL_WEDGES.length);
    const extraSpins = 360 * 3 + pick * 60 + 30;
    setWheelAngle((a) => a + extraSpins);
    setWheelPoints(WHEEL_WEDGES[pick].points);
    window.setTimeout(() => setWheelReady(true), 600);
  };

  const use5050 = () => {
    if (lifeline5050Used || !currentQuestion?.options) return;
    const correctIdx = Number(currentQuestion.answer);
    const wrongIndices = currentQuestion.options.map((_, i) => i).filter((i) => i !== correctIdx);
    const shuffled = wrongIndices.sort(() => Math.random() - 0.5).slice(0, 2);
    setEliminatedOpts(shuffled);
    setLifeline5050Used(true);
  };

  // =========================================================================
  // GIAO DIEN CHON TRO CHOI
  // =========================================================================
  if (!activeGame) {
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-50">
              Khu vực Trò chơi Toán học tương tác
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              10 trò chơi luyện phản xạ Toán học sử dụng trực tiếp ngân hàng câu hỏi chuẩn GDPT 2018, trình chiếu tốt trên bảng lớp học.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={grade}
              onChange={(e) => {
                setGrade(Number(e.target.value));
                setTopic('');
              }}
              className="min-h-[40px] rounded-xl border border-slate-300 bg-white px-3 text-sm font-medium text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            >
              <option value={0}>Tất cả Lớp 6–9</option>
              {[6, 7, 8, 9].map((g) => (
                <option key={g} value={g}>Toán Lớp {g}</option>
              ))}
            </select>
            <select
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="min-h-[40px] rounded-xl border border-slate-300 bg-white px-3 text-sm font-medium text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            >
              <option value="">Tất cả chủ đề</option>
              {filteredTopics.map((t) => (
                <option key={t.key} value={t.key}>{t.name}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setSoundOn((s) => !s)}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-slate-300 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              {soundOn ? <Volume2 className="h-4 w-4 text-blue-600" /> : <VolumeX className="h-4 w-4 text-slate-400" />}
              <span>{soundOn ? 'Bật âm' : 'Tắt âm'}</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {GAMES.map((game) => {
            const Icon = game.icon;
            return (
              <div
                key={game.id}
                className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 transition-colors hover:border-blue-400 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-500"
              >
                <div>
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 dark:text-slate-50">{game.title}</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{game.subtitle}</p>
                    </div>
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                    {game.rules}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => launchGame(game.id)}
                  className="mt-4 inline-flex min-h-[42px] w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                >
                  <Play className="h-4 w-4" />
                  <span>Chơi ngay</span>
                </button>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // =========================================================================
  // MAN HINH DANG CHOI TRO CHOI
  // =========================================================================
  const choices: string[] = currentQuestion
    ? (currentQuestion.options || currentQuestion.workSteps || [])
    : [];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-3">
          <Gamepad2 className="h-5 w-5 text-blue-600" />
          <div>
            <h2 className="font-bold text-slate-900 dark:text-slate-50">{currentGameMeta?.title}</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">{currentGameMeta?.rules}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 font-mono text-sm font-bold">
          {timeLeft > 0 && (
            <span className={timeLeft <= 10 ? 'text-rose-600' : 'text-blue-600'}>
              {timeLeft}s
            </span>
          )}
          {activeGame === 'rescue_hero' && (
            <span className="text-rose-600">Tim: {'♥'.repeat(Math.max(0, lives))}</span>
          )}
          {activeGame === 'math_arena' ? (
            <span className="text-violet-700 dark:text-violet-400">
              Đội A: {arenaScores.A} đ · Đội B: {arenaScores.B} đ (Lượt Đội {arenaTurn})
            </span>
          ) : (
            <span className="text-emerald-700 dark:text-emerald-400">Điểm: {score}</span>
          )}
          <button
            type="button"
            onClick={() => setActiveGame(null)}
            className="rounded-lg border border-slate-300 px-3 py-1.5 font-sans text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200"
          >
            Đổi trò chơi
          </button>
        </div>
      </div>

      {/* Thanh trang thai rieng cua tung tro choi */}
      {activeGame === 'knowledge_race' && (
        <div className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex justify-between text-xs font-semibold">
            <span>Bạn ({playerProgress}/8 chặng)</span>
            <span>Đối thủ ảo ({botProgress}/8 chặng)</span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div className="h-full bg-blue-600 transition-all" style={{ width: `${(playerProgress / 8) * 100}%` }} />
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div className="h-full bg-amber-500 transition-all" style={{ width: `${(botProgress / 8) * 100}%` }} />
          </div>
        </div>
      )}

      {activeGame === 'lucky_wheel' && !gameOver && (
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 sm:flex-row sm:justify-center dark:border-slate-800 dark:bg-slate-900">
          <div className="relative h-36 w-36">
            <svg
              viewBox="0 0 120 120"
              className="h-full w-full transition-transform duration-500"
              style={{ transform: `rotate(${wheelAngle}deg)` }}
            >
              {WHEEL_WEDGES.map((w, idx) => {
                const startAngle = (idx * 60 - 90) * (Math.PI / 180);
                const endAngle = ((idx + 1) * 60 - 90) * (Math.PI / 180);
                const x1 = 60 + 56 * Math.cos(startAngle);
                const y1 = 60 + 56 * Math.sin(startAngle);
                const x2 = 60 + 56 * Math.cos(endAngle);
                const y2 = 60 + 56 * Math.sin(endAngle);
                return (
                  <path
                    key={w.label}
                    d={`M 60 60 L ${x1} ${y1} A 56 56 0 0 1 ${x2} ${y2} Z`}
                    fill={w.color}
                    stroke="#ffffff"
                    strokeWidth="1.5"
                  />
                );
              })}
              <circle cx="60" cy="60" r="14" fill="#ffffff" />
            </svg>
          </div>
          <div className="text-center sm:text-left">
            <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              {wheelReady
                ? `Mức điểm thưởng câu này: +${wheelPoints} điểm!`
                : 'Nhấn quay để xác định mức điểm cho câu hỏi tiếp theo.'}
            </div>
            <button
              type="button"
              disabled={wheelReady}
              onClick={spinWheel}
              className="mt-2 min-h-[40px] rounded-xl bg-violet-600 px-5 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-45"
            >
              Quay vòng tròn
            </button>
          </div>
        </div>
      )}

      {activeGame === 'secret_tiles' && (
        <div className="grid grid-cols-3 gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          {['TOÁN HỌC', 'LÀ', 'NGÔN NGỮ', 'CỦA', 'VŨ', 'TRỤ'].map((word, idx) => (
            <button
              key={idx}
              type="button"
              disabled={revealedTiles[idx]}
              onClick={() => setSelectedTile(idx)}
              className={`min-h-[56px] rounded-xl border-2 text-sm font-bold transition-colors ${
                revealedTiles[idx]
                  ? 'border-emerald-500 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300'
                  : selectedTile === idx
                  ? 'border-blue-600 bg-blue-50 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300'
                  : 'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
              }`}
            >
              {revealedTiles[idx] ? word : `Ô bí mật #${idx + 1}`}
            </button>
          ))}
        </div>
      )}

      {gameOver ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center dark:border-slate-800 dark:bg-slate-900">
          <Trophy className="mx-auto h-12 w-12 text-amber-500" />
          <h3 className="mt-3 text-2xl font-bold text-slate-900 dark:text-slate-50">
            Kết thúc trò chơi!
          </h3>
          <p className="mt-2 text-base text-slate-600 dark:text-slate-300">
            {activeGame === 'math_arena'
              ? `Tỉ số chung cuộc: Đội A ${arenaScores.A} điểm — Đội B ${arenaScores.B} điểm`
              : `Tổng điểm đạt được: ${score} điểm`}
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <button
              type="button"
              onClick={() => launchGame(activeGame)}
              className="inline-flex min-h-[42px] items-center gap-2 rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              <RotateCcw className="h-4 w-4" />
              <span>Chơi lại</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveGame(null)}
              className="min-h-[42px] rounded-xl border border-slate-300 px-5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200"
            >
              Về danh sách trò chơi
            </button>
          </div>
        </div>
      ) : currentQuestion ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-3 flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>Câu {qIdx + 1} · Lớp {currentQuestion.grade}</span>
            {activeGame === 'millionaire' && !lifeline5050Used && (
              <button
                type="button"
                onClick={use5050}
                className="rounded-lg border border-amber-400 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800 hover:bg-amber-100"
              >
                Trợ giúp 50:50
              </button>
            )}
          </div>

          <div className="question-prompt text-lg font-bold text-slate-900 dark:text-slate-50">
            <MathText text={currentQuestion.prompt} />
          </div>

          <MathDiagram spec={currentQuestion.svgSpec} />

          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {choices.map((opt, idx) => {
              const hiddenBy5050 = eliminatedOpts.includes(idx);
              return (
                <button
                  key={idx}
                  type="button"
                  disabled={Boolean(feedback) || hiddenBy5050 || (activeGame === 'lucky_wheel' && !wheelReady)}
                  onClick={() => handleAnswerInGame(idx)}
                  className={`option-label flex min-h-[54px] items-center gap-3 rounded-xl border-2 px-4 py-3 text-left font-medium transition-colors ${
                    hiddenBy5050
                      ? 'border-slate-100 bg-slate-50 opacity-25 dark:border-slate-800 dark:bg-slate-800/30'
                      : feedback && idx === Number(currentQuestion.answer)
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-950 dark:bg-emerald-950/50 dark:text-emerald-100'
                      : 'border-slate-200 bg-white text-slate-900 hover:border-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100'
                  }`}
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                    {'ABCD'[idx]}
                  </span>
                  <span className="flex-1"><MathText text={opt} /></span>
                </button>
              );
            })}
          </div>

          {feedback && (
            <div className={`mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4 ${
              feedback.ok
                ? 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200'
                : 'border-rose-300 bg-rose-50 text-rose-900 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200'
            }`}>
              <div className="text-sm font-semibold"><MathText text={feedback.msg} /></div>
              <button
                type="button"
                onClick={nextGameStep}
                className="min-h-[40px] rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700"
              >
                Câu tiếp theo →
              </button>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
};
