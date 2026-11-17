import React, { useState } from 'react';
import { MathText } from './MathText';

export const HeroGeometrySandbox: React.FC = () => {
  const [coeffA, setCoeffA] = useState<number>(1);
  const [slopeM, setSlopeM] = useState<number>(1);

  const ox = 170;
  const oy = 115;
  const scale = 22;

  // Ve Parabol y = a*x^2
  const parabolaPath = Array.from({ length: 61 }, (_, i) => {
    const x = -4.5 + i * 0.15;
    const y = coeffA * 0.4 * x * x;
    const sx = ox + x * scale;
    const sy = oy - y * scale;
    return `${i === 0 ? 'M' : 'L'} ${sx.toFixed(1)} ${sy.toFixed(1)}`;
  }).join(' ');

  // Ve duong thang y = m*x + 1
  const x1 = -5;
  const y1 = slopeM * x1 + 1;
  const x2 = 5;
  const y2 = slopeM * x2 + 1;

  return (
    <div className="flex h-full flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
          Mô phỏng Đồ thị & Hàm số trực quan
        </div>
        <div className="font-mono text-xs font-semibold text-blue-700 dark:text-blue-400">
          <MathText text={`$y = ${coeffA}x^2$ · $y = ${slopeM}x + 1$`} />
        </div>
      </div>

      <div className="my-3 overflow-hidden rounded-xl border border-slate-100 bg-slate-50 dark:border-slate-800 dark:bg-slate-950/60">
        <svg viewBox="0 0 340 210" className="h-52 w-full" role="img" aria-label="Đồ thị hàm số tương tác">
          <defs>
            <pattern id="heroGrid" width="22" height="22" patternUnits="userSpaceOnUse">
              <path d="M 22 0 L 0 0 0 22" fill="none" stroke="rgba(148,163,184,0.22)" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="340" height="210" fill="url(#heroGrid)" />
          <line x1="15" y1={oy} x2="325" y2={oy} stroke="#64748b" strokeWidth="1.5" />
          <line x1={ox} y1="10" x2={ox} y2="200" stroke="#64748b" strokeWidth="1.5" />
          <text x="316" y={oy - 6} className="fill-slate-500 text-[11px] font-bold">x</text>
          <text x={ox + 7} y="20" className="fill-slate-500 text-[11px] font-bold">y</text>
          <text x={ox - 12} y={oy + 13} className="fill-slate-500 text-[11px] font-bold">O</text>

          <path d={parabolaPath} fill="none" stroke="#2563eb" strokeWidth="2.5" />
          <line
            x1={ox + x1 * scale}
            y1={oy - y1 * scale}
            x2={ox + x2 * scale}
            y2={oy - y2 * scale}
            stroke="#7c3aed"
            strokeWidth="2.2"
            strokeDasharray="6 4"
          />
          <circle cx={ox} cy={oy} r="4" fill="#059669" />
          <circle cx={ox} cy={oy - scale} r="4" fill="#ea580c" />
        </svg>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block space-y-1">
          <div className="flex justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
            <span>Hệ số Parabol (a)</span>
            <span className="font-mono text-blue-700 dark:text-blue-400">{coeffA}</span>
          </div>
          <input
            type="range"
            min={-2}
            max={2}
            step={0.5}
            value={coeffA}
            onChange={(e) => setCoeffA(Number(e.target.value) || 0.5)}
            className="w-full accent-blue-600"
          />
        </label>

        <label className="block space-y-1">
          <div className="flex justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
            <span>Hệ số góc đường thẳng (m)</span>
            <span className="font-mono text-violet-700 dark:text-violet-400">{slopeM}</span>
          </div>
          <input
            type="range"
            min={-2}
            max={2}
            step={0.5}
            value={slopeM}
            onChange={(e) => setSlopeM(Number(e.target.value))}
            className="w-full accent-violet-600"
          />
        </label>
      </div>
    </div>
  );
};
