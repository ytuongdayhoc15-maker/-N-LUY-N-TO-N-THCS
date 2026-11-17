import React from 'react';
import { SvgSpec } from '../types';

interface MathDiagramProps {
  spec?: SvgSpec | null;
}

export const MathDiagram: React.FC<MathDiagramProps> = ({ spec }) => {
  if (!spec) return null;

  if (spec.kind === 'trapezoid') {
    const top = Number(spec.top) || 6;
    const bottom = Number(spec.bottom) || 10;
    const height = Number(spec.height) || 4;
    const unit = String(spec.unit || 'm');
    return (
      <div className="my-3 flex justify-center rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-900/60">
        <svg viewBox="0 0 320 175" className="h-44 w-full max-w-xs" role="img" aria-label="Hình thang cân ABCD">
          <polygon points="85,35 235,35 280,135 40,135" fill="rgba(37, 99, 235, 0.10)" stroke="#2563eb" strokeWidth="2.5" strokeLinejoin="round" />
          <line x1="85" y1="35" x2="85" y2="135" stroke="#ea580c" strokeWidth="2" strokeDasharray="5 4" />
          <polyline points="85,123 97,123 97,135" fill="none" stroke="#ea580c" strokeWidth="1.8" />
          <text x="74" y="27" className="fill-slate-800 dark:fill-slate-200 text-[13px] font-bold">A</text>
          <text x="238" y="27" className="fill-slate-800 dark:fill-slate-200 text-[13px] font-bold">B</text>
          <text x="284" y="146" className="fill-slate-800 dark:fill-slate-200 text-[13px] font-bold">C</text>
          <text x="25" y="146" className="fill-slate-800 dark:fill-slate-200 text-[13px] font-bold">D</text>
          <text x="80" y="152" className="fill-orange-600 dark:fill-orange-400 text-[12px] font-semibold">H</text>
          <text x="160" y="25" textAnchor="middle" className="fill-blue-700 dark:fill-blue-300 text-[12px] font-semibold">{top} {unit}</text>
          <text x="160" y="156" textAnchor="middle" className="fill-blue-700 dark:fill-blue-300 text-[12px] font-semibold">{bottom} {unit}</text>
          <text x="95" y="90" className="fill-orange-600 dark:fill-orange-400 text-[12px] font-semibold">{height} {unit}</text>
        </svg>
      </div>
    );
  }

  if (spec.kind === 'bar_chart') {
    const bars = (spec.bars as { label: string; value: number; color: string }[]) || [];
    const maxVal = Math.max(10, ...bars.map((b) => b.value));
    return (
      <div className="my-3 flex flex-col items-center rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-900/60">
        {Boolean(spec.title) && <div className="mb-2 text-xs font-semibold text-slate-600 dark:text-slate-300">{String(spec.title)}</div>}
        <svg viewBox="0 0 320 170" className="h-44 w-full max-w-xs" role="img" aria-label="Biểu đồ cột thống kê">
          <line x1="40" y1="20" x2="40" y2="135" stroke="#64748b" strokeWidth="1.8" />
          <line x1="40" y1="135" x2="295" y2="135" stroke="#64748b" strokeWidth="1.8" />
          {[0.25, 0.5, 0.75, 1].map((r, idx) => {
            const y = 135 - r * 100;
            return <line key={idx} x1="40" y1={y} x2="295" y2={y} stroke="#cbd5e1" strokeDasharray="3 3" strokeWidth="1" />;
          })}
          {bars.map((bar, idx) => {
            const h = (bar.value / maxVal) * 100;
            const x = 65 + idx * 75;
            const y = 135 - h;
            return (
              <g key={bar.label}>
                <rect x={x} y={y} width="42" height={h} rx="6" fill={bar.color || '#2563eb'} />
                <text x={x + 21} y={y - 6} textAnchor="middle" className="fill-slate-800 dark:fill-slate-100 text-[12px] font-bold">{bar.value}</text>
                <text x={x + 21} y="153" textAnchor="middle" className="fill-slate-600 dark:fill-slate-300 text-[12px] font-medium">{bar.label}</text>
              </g>
            );
          })}
        </svg>
      </div>
    );
  }

  if (spec.kind === 'parallel_lines') {
    const angle = Number(spec.angle) || 65;
    return (
      <div className="my-3 flex justify-center rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-900/60">
        <svg viewBox="0 0 320 175" className="h-44 w-full max-w-xs" role="img" aria-label="Hai đường thẳng song song bị cắt bởi đường thẳng thứ ba">
          <line x1="25" y1="52" x2="295" y2="52" stroke="#2563eb" strokeWidth="2.4" />
          <line x1="25" y1="125" x2="295" y2="125" stroke="#2563eb" strokeWidth="2.4" />
          <line x1="115" y1="15" x2="210" y2="162" stroke="#6d28d9" strokeWidth="2.2" />
          <path d="M 152 52 A 22 22 0 0 1 130 70" fill="none" stroke="#ea580c" strokeWidth="2.2" />
          <path d="M 173 125 A 22 22 0 0 1 196 108" fill="none" stroke="#059669" strokeWidth="2.2" />
          <text x="32" y="43" className="fill-blue-700 dark:fill-blue-300 text-[13px] font-bold">a</text>
          <text x="32" y="116" className="fill-blue-700 dark:fill-blue-300 text-[13px] font-bold">b</text>
          <text x="215" y="158" className="fill-violet-700 dark:fill-violet-300 text-[13px] font-bold">c</text>
          <text x="150" y="74" className="fill-orange-600 dark:fill-orange-400 text-[12px] font-bold">{angle}°</text>
          <text x="165" y="115" className="fill-emerald-600 dark:fill-emerald-400 text-[12px] font-bold">B₂ = ?</text>
        </svg>
      </div>
    );
  }

  if (spec.kind === 'thales_triangle') {
    const am = Number(spec.am) || 4;
    const mb = Number(spec.mb) || 6;
    const an = Number(spec.an) || 6;
    return (
      <div className="my-3 flex justify-center rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-900/60">
        <svg viewBox="0 0 320 185" className="h-44 w-full max-w-xs" role="img" aria-label="Tam giác ABC với MN song song BC">
          <polygon points="155,22 50,158 265,158" fill="rgba(37,99,235,0.08)" stroke="#2563eb" strokeWidth="2.3" strokeLinejoin="round" />
          <line x1="108" y1="83" x2="204" y2="83" stroke="#059669" strokeWidth="2.3" />
          <text x="155" y="16" textAnchor="middle" className="fill-slate-800 dark:fill-slate-200 text-[13px] font-bold">A</text>
          <text x="38" y="166" className="fill-slate-800 dark:fill-slate-200 text-[13px] font-bold">B</text>
          <text x="272" y="166" className="fill-slate-800 dark:fill-slate-200 text-[13px] font-bold">C</text>
          <text x="92" y="83" className="fill-emerald-700 dark:fill-emerald-400 text-[13px] font-bold">M</text>
          <text x="210" y="83" className="fill-emerald-700 dark:fill-emerald-400 text-[13px] font-bold">N</text>
          <text x="115" y="54" className="fill-blue-700 dark:fill-blue-300 text-[11px] font-semibold">{am}</text>
          <text x="68" y="125" className="fill-blue-700 dark:fill-blue-300 text-[11px] font-semibold">{mb}</text>
          <text x="188" y="54" className="fill-orange-600 dark:fill-orange-400 text-[11px] font-semibold">{an}</text>
          <text x="242" y="125" className="fill-orange-600 dark:fill-orange-400 text-[11px] font-semibold">?</text>
        </svg>
      </div>
    );
  }

  if (spec.kind === 'right_triangle') {
    const ab = Number(spec.ab) || 6;
    const ac = Number(spec.ac) || 8;
    return (
      <div className="my-3 flex justify-center rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-900/60">
        <svg viewBox="0 0 320 175" className="h-44 w-full max-w-xs" role="img" aria-label="Tam giác ABC vuông tại A">
          <polygon points="75,30 75,140 250,140" fill="rgba(109,40,217,0.08)" stroke="#6d28d9" strokeWidth="2.4" strokeLinejoin="round" />
          <polyline points="75,124 91,124 91,140" fill="none" stroke="#6d28d9" strokeWidth="1.8" />
          <text x="60" y="148" className="fill-slate-800 dark:fill-slate-200 text-[13px] font-bold">A</text>
          <text x="68" y="22" className="fill-slate-800 dark:fill-slate-200 text-[13px] font-bold">B</text>
          <text x="256" y="148" className="fill-slate-800 dark:fill-slate-200 text-[13px] font-bold">C</text>
          <text x="36" y="92" className="fill-blue-700 dark:fill-blue-300 text-[12px] font-semibold">{ab} cm</text>
          <text x="160" y="158" textAnchor="middle" className="fill-blue-700 dark:fill-blue-300 text-[12px] font-semibold">{ac} cm</text>
        </svg>
      </div>
    );
  }

  if (spec.kind === 'linear_graph' || spec.kind === 'parabola') {
    const isPara = spec.kind === 'parabola';
    const ox = 160;
    const oy = isPara ? 45 : 80;
    const pathPts = isPara
      ? Array.from({ length: 41 }, (_, idx) => {
          const x = -2.4 + idx * 0.12;
          const y = -0.5 * x * x; // scaled display
          const sx = ox + x * 32;
          const sy = oy - y * 32;
          return `${idx === 0 ? 'M' : 'L'} ${sx.toFixed(1)} ${sy.toFixed(1)}`;
        }).join(' ')
      : '';

    return (
      <div className="my-3 flex justify-center rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-900/60">
        <svg viewBox="0 0 320 190" className="h-44 w-full max-w-xs" role="img" aria-label="Hệ trục tọa độ Oxy">
          <defs>
            <pattern id="mathGrid" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(148,163,184,0.28)" strokeWidth="1" />
            </pattern>
          </defs>
          <rect x="20" y="10" width="280" height="170" fill="url(#mathGrid)" rx="8" />
          <line x1="25" y1={oy} x2="295" y2={oy} stroke="#64748b" strokeWidth="1.8" />
          <line x1={ox} y1="15" x2={ox} y2="175" stroke="#64748b" strokeWidth="1.8" />
          <text x="288" y={oy - 6} className="fill-slate-600 dark:fill-slate-300 text-[11px] font-bold">x</text>
          <text x={ox + 8} y="24" className="fill-slate-600 dark:fill-slate-300 text-[11px] font-bold">y</text>
          <text x={ox - 12} y={oy + 14} className="fill-slate-600 dark:fill-slate-300 text-[11px] font-bold">O</text>

          {!isPara ? (
            <>
              <line x1="125" y1="170" x2="225" y2="20" stroke="#2563eb" strokeWidth="2.5" />
              <circle cx="200" cy={oy} r="4" fill="#ea580c" />
              <circle cx={ox} cy={oy + 60} r="4" fill="#ea580c" />
              <text x="205" y={oy - 8} className="fill-orange-600 dark:fill-orange-400 text-[11px] font-bold">A(2; 0)</text>
              <text x={ox + 8} y={oy + 64} className="fill-orange-600 dark:fill-orange-400 text-[11px] font-bold">B(0; -4)</text>
            </>
          ) : (
            <>
              <path d={pathPts} fill="none" stroke="#6d28d9" strokeWidth="2.5" />
              <circle cx={ox + 2 * 32} cy={oy + 2 * 32} r="4.5" fill="#ea580c" />
              <line x1={ox + 64} y1={oy} x2={ox + 64} y2={oy + 64} stroke="#ea580c" strokeDasharray="3 3" strokeWidth="1.3" />
              <line x1={ox} y1={oy + 64} x2={ox + 64} y2={oy + 64} stroke="#ea580c" strokeDasharray="3 3" strokeWidth="1.3" />
              <text x={ox + 72} y={oy + 68} className="fill-orange-600 dark:fill-orange-400 text-[11px] font-bold">M(2; -8)</text>
            </>
          )}
        </svg>
      </div>
    );
  }

  return null;
};
