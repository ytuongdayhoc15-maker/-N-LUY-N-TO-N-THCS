import React, { useMemo } from 'react';
import { ArrowDown, ArrowUp, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import { Question } from '../types';
import { MathText } from './MathText';
import { MathDiagram } from './MathDiagram';

export const QUESTION_TYPE_LABELS: Record<string, string> = {
  mcq: 'Trắc nghiệm 4 lựa chọn',
  true_false: 'Đúng / Sai (4 ý)',
  fill_blank: 'Điền đáp án',
  matching: 'Ghép cặp kiến thức',
  ordering: 'Sắp xếp bước giải',
  short_essay: 'Tự luận ngắn',
  real_world: 'Bài toán thực tế',
  geometry_graph: 'Hình vẽ & Đồ thị',
  find_error: 'Tìm lỗi sai',
  high_application: 'Vận dụng & Vận dụng cao'
};

export const LEVEL_LABELS: Record<number, string> = {
  1: 'Mức 1 – Cơ bản',
  2: 'Mức 2 – Nâng cao',
  3: 'Mức 3 – Thử thách'
};

interface QuestionCardProps {
  question: Question;
  index: number;
  total: number;
  value: unknown;
  onChange: (val: unknown) => void;
  locked?: boolean;
  showSolution?: boolean;
  feedback?: {
    isCorrect: boolean;
    score: number;
    maxScore: number;
    needsManualGrading?: boolean;
    expectedDisplay?: string;
    solutionSteps?: string[];
    commonMistake?: string;
  } | null;
}

export const QuestionCard: React.FC<QuestionCardProps> = ({
  question,
  index,
  total,
  value,
  onChange,
  locked = false,
  showSolution = false,
  feedback = null
}) => {
  // Tao thu tu tron co dinh theo ID cau hoi cho dang sap xep & ghep cap
  const shuffledRightIndices = useMemo(() => {
    if (!question.pairs) return [];
    const arr = question.pairs.map((_, i) => i);
    // Dao deterministic theo code cau hoi de on dinh giua cac lan render
    for (let i = arr.length - 1; i > 0; i--) {
      const j = (question.code.charCodeAt(i % question.code.length) + i) % (i + 1);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    if (arr.every((v, i) => v === i) && arr.length > 1) {
      [arr[0], arr[1]] = [arr[1], arr[0]];
    }
    return arr;
  }, [question.code, question.pairs]);

  const orderingValue: number[] = useMemo(() => {
    if (!question.steps) return [];
    if (Array.isArray(value) && value.length === question.steps.length) {
      return value.map(Number);
    }
    const arr = question.steps.map((_, i) => i);
    if (arr.length > 1) {
      return [...arr.slice(1), arr[0]];
    }
    return arr;
  }, [question.steps, value]);

  const moveOrderItem = (pos: number, delta: number) => {
    if (locked) return;
    const nextPos = pos + delta;
    if (nextPos < 0 || nextPos >= orderingValue.length) return;
    const copy = [...orderingValue];
    [copy[pos], copy[nextPos]] = [copy[nextPos], copy[pos]];
    onChange(copy);
  };

  const renderInputArea = () => {
    const t = question.type;

    // 1. Trac nghiem A/B/C/D (hoac real_world/geometry_graph/high_application co options)
    if (Array.isArray(question.options)) {
      const selected = typeof value === 'number' ? value : -1;
      return (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {question.options.map((opt, i) => {
            const isSelected = selected === i;
            const correctIdx = typeof question.answer === 'number' ? question.answer : -1;
            let stateStyle = 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-blue-400 dark:hover:border-blue-500';
            if (showSolution && feedback) {
              if (i === correctIdx) {
                stateStyle = 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/50 dark:border-emerald-500';
              } else if (isSelected && !feedback.isCorrect) {
                stateStyle = 'border-rose-600 bg-rose-50 dark:bg-rose-950/50 dark:border-rose-500';
              }
            } else if (isSelected) {
              stateStyle = 'border-blue-600 bg-blue-50/80 dark:bg-blue-950/50 dark:border-blue-500';
            }

            return (
              <button
                key={i}
                type="button"
                disabled={locked}
                onClick={() => onChange(i)}
                className={`option-label flex min-h-[54px] items-center gap-3.5 rounded-xl border-2 px-4 py-3 text-left text-[15px] font-medium text-slate-900 transition-colors dark:text-slate-100 ${stateStyle}`}
              >
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-bold ${
                  isSelected
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                }`}>
                  {'ABCD'[i]}
                </span>
                <span className="flex-1">
                  <MathText text={opt} />
                </span>
              </button>
            );
          })}
        </div>
      );
    }

    // 2. Tim loi sai (chon buoc giai sai)
    if (t === 'find_error' && Array.isArray(question.workSteps)) {
      const selected = typeof value === 'number' ? value : -1;
      return (
        <div className="space-y-2.5">
          {question.workSteps.map((stepText, i) => {
            const isSelected = selected === i;
            const correctIdx = typeof question.answer === 'number' ? question.answer : -1;
            let stateStyle = 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-blue-400';
            if (showSolution && feedback) {
              if (i === correctIdx) {
                stateStyle = 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/50';
              } else if (isSelected && i !== correctIdx) {
                stateStyle = 'border-rose-600 bg-rose-50 dark:bg-rose-950/50';
              }
            } else if (isSelected) {
              stateStyle = 'border-blue-600 bg-blue-50 dark:bg-blue-950/40';
            }
            return (
              <button
                key={i}
                type="button"
                disabled={locked}
                onClick={() => onChange(i)}
                className={`flex min-h-[48px] w-full items-center gap-3 rounded-xl border-2 px-4 py-3 text-left text-[15px] text-slate-900 transition-colors dark:text-slate-100 ${stateStyle}`}
              >
                <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-xs font-bold ${
                  isSelected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                }`}>
                  {i + 1}
                </span>
                <MathText text={stepText} />
              </button>
            );
          })}
        </div>
      );
    }

    // 3. Dung / Sai 4 y
    if (t === 'true_false' && Array.isArray(question.statements)) {
      const currentArr: (boolean | null)[] = Array.isArray(value)
        ? value
        : question.statements.map(() => null);

      return (
        <div className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
          {question.statements.map((st, idx) => {
            const val = currentArr[idx];
            return (
              <div key={idx} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex-1 text-[15px] text-slate-800 dark:text-slate-200">
                  <span className="mr-2 font-bold text-blue-700 dark:text-blue-400">{st.label})</span>
                  <MathText text={st.text} />
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {[
                    { label: 'Đúng', boolVal: true },
                    { label: 'Sai', boolVal: false }
                  ].map((choice) => {
                    const active = val === choice.boolVal;
                    return (
                      <button
                        key={choice.label}
                        type="button"
                        disabled={locked}
                        onClick={() => {
                          const next = [...currentArr];
                          next[idx] = choice.boolVal;
                          onChange(next);
                        }}
                        className={`min-h-[40px] rounded-lg border px-4 py-1.5 text-sm font-semibold transition-colors whitespace-nowrap ${
                          active
                            ? choice.boolVal
                              ? 'border-emerald-600 bg-emerald-600 text-white'
                              : 'border-rose-600 bg-rose-600 text-white'
                            : 'border-slate-300 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                        }`}
                      >
                        {choice.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      );
    }

    // 4. Ghep cap kien thuc
    if (t === 'matching' && Array.isArray(question.pairs)) {
      const currentArr: number[] = Array.isArray(value) ? value : question.pairs.map(() => -1);
      return (
        <div className="space-y-3">
          {question.pairs.map((pair, leftIdx) => (
            <div key={leftIdx} className="grid grid-cols-1 items-center gap-3 rounded-xl border border-slate-200 bg-white p-3.5 sm:grid-cols-[1fr_auto_1fr] dark:border-slate-800 dark:bg-slate-900">
              <div className="font-medium text-slate-900 dark:text-slate-100">
                <span className="mr-2 text-xs font-bold text-slate-500">{leftIdx + 1}.</span>
                <MathText text={pair.left} />
              </div>
              <span className="hidden text-slate-400 sm:inline">→</span>
              <select
                disabled={locked}
                value={currentArr[leftIdx] ?? -1}
                onChange={(e) => {
                  const next = [...currentArr];
                  next[leftIdx] = Number(e.target.value);
                  onChange(next);
                }}
                className="min-h-[42px] w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-900 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              >
                <option value={-1}>-- Chọn vế tương ứng --</option>
                {shuffledRightIndices.map((origIdx) => (
                  <option key={origIdx} value={origIdx}>
                    {question.pairs![origIdx].right.replace(/\$/g, '')}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      );
    }

    // 5. Sap xep cac buoc giai
    if (t === 'ordering' && Array.isArray(question.steps)) {
      return (
        <div className="space-y-2.5">
          {orderingValue.map((origIdx, pos) => (
            <div
              key={origIdx}
              className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="flex items-center gap-3 text-[15px] text-slate-900 dark:text-slate-100">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-blue-50 font-mono text-xs font-bold text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                  {pos + 1}
                </span>
                <MathText text={question.steps![origIdx]} />
              </div>
              {!locked && (
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    aria-label="Di chuyển lên"
                    disabled={pos === 0}
                    onClick={() => moveOrderItem(pos, -1)}
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-35 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    <ArrowUp className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    aria-label="Di chuyển xuống"
                    disabled={pos === orderingValue.length - 1}
                    onClick={() => moveOrderItem(pos, 1)}
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-35 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    <ArrowDown className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      );
    }

    // 6. Tu luan ngan
    if (t === 'short_essay') {
      return (
        <div className="space-y-2">
          <textarea
            disabled={locked}
            rows={4}
            value={typeof value === 'string' ? value : ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Nhập lời giải chi tiết và kết luận đáp số của em..."
            className="w-full rounded-xl border border-slate-300 bg-white p-3.5 text-[15px] text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Câu tự luận được đối chiếu từ khóa bước đầu và gửi về giáo viên chấm điểm chính thức.
          </p>
        </div>
      );
    }

    // 7. Dien dap an / Bai toan thuc te dang dien so
    const quickSymbols = ['/', '-', ',', '√', '²', '³', 'π', '°'];
    const currentStr = typeof value === 'string' ? value : '';
    return (
      <div className="space-y-3">
        <input
          type="text"
          disabled={locked}
          value={currentStr}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Nhập đáp án (ví dụ: 18, 5/6 hoặc 12,5)"
          className="min-h-[48px] w-full rounded-xl border-2 border-slate-300 bg-white px-4 py-2.5 font-mono text-base font-medium text-slate-900 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        />
        {!locked && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-xs text-slate-500 dark:text-slate-400">Ký hiệu nhanh:</span>
            {quickSymbols.map((sym) => (
              <button
                key={sym}
                type="button"
                onClick={() => onChange(currentStr + sym)}
                className="min-h-[34px] min-w-[36px] rounded-md border border-slate-200 bg-slate-50 px-2.5 font-mono text-sm font-semibold text-slate-700 hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                {sym}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
        <div className="flex flex-wrap items-center gap-2 font-medium">
          <span className="font-mono font-semibold text-blue-700 dark:text-blue-400">
            Câu {index + 1}/{total}
          </span>
          <span aria-hidden="true">·</span>
          <span>{QUESTION_TYPE_LABELS[question.type] || question.type}</span>
          <span aria-hidden="true">·</span>
          <span>{LEVEL_LABELS[question.level] || `Mức ${question.level}`}</span>
          {question.lessonTitle && (
            <>
              <span aria-hidden="true">·</span>
              <span>{question.lessonTitle}</span>
            </>
          )}
        </div>
        <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">
          {question.points} điểm
        </span>
      </div>

      <div className="question-prompt text-lg font-semibold leading-relaxed text-slate-900 dark:text-slate-50">
        <MathText text={question.prompt} />
      </div>

      <MathDiagram spec={question.svgSpec} />

      {renderInputArea()}

      {showSolution && feedback && (
        <div
          role="status"
          aria-live="polite"
          className={`rounded-xl border p-4 text-sm leading-relaxed ${
            feedback.needsManualGrading
              ? 'border-amber-300 bg-amber-50/70 text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100'
              : feedback.isCorrect
              ? 'border-emerald-300 bg-emerald-50/70 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100'
              : 'border-rose-300 bg-rose-50/70 text-rose-950 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-100'
          }`}
        >
          <div className="mb-2 flex items-center gap-2 font-bold">
            {feedback.needsManualGrading ? (
              <>
                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
                <span>Đã ghi nhận bài tự luận (Điểm đối chiếu sơ bộ: {feedback.score}/{feedback.maxScore}, chờ giáo viên chấm)</span>
              </>
            ) : feedback.isCorrect ? (
              <>
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                <span>Chính xác (+{feedback.score}/{feedback.maxScore} điểm)</span>
              </>
            ) : (
              <>
                <XCircle className="h-4 w-4 shrink-0 text-rose-600" />
                <span>
                  Chưa chính xác ({feedback.score}/{feedback.maxScore} điểm) · Đáp án đúng:{' '}
                  <MathText text={feedback.expectedDisplay || ''} />
                </span>
              </>
            )}
          </div>

          {Array.isArray(feedback.solutionSteps) && feedback.solutionSteps.length > 0 && (
            <div className="mt-3 space-y-1.5 border-t border-current/15 pt-3">
              <div className="font-semibold">Lời giải chi tiết:</div>
              {feedback.solutionSteps.map((step, i) => (
                <div key={i} className="pl-1">
                  <MathText text={step} />
                </div>
              ))}
            </div>
          )}

          {feedback.commonMistake && (
            <div className="mt-2.5 border-t border-current/15 pt-2.5 text-xs opacity-90">
              <span className="font-semibold">Bước 5 (Lỗi sai dễ mắc): </span>
              <MathText text={feedback.commonMistake} />
            </div>
          )}
        </div>
      )}
    </div>
  );
};
