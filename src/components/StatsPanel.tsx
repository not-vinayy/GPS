import React from 'react';
import { formatDuration, formatPace } from '../utils/geo';

interface StatsPanelProps {
  distance: number;
  duration: number;
  speed: number;
  altitude: number | null;
  isRecording: boolean;
  onStart: () => void;
  onStop: () => void;
}

export default function StatsPanel({
  distance,
  duration,
  speed,
  altitude,
  isRecording,
  onStart,
  onStop,
}: StatsPanelProps) {
  return (
    <div className="bg-[#0e0e0e] border-t border-white/[0.06] px-4 pt-4 pb-5">
      {/* Stats grid */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        <div className="bg-[#161616] rounded-xl p-3 flex flex-col items-center">
          <span className="text-[9px] font-semibold uppercase tracking-[0.15em] text-[#555] mb-1">Time</span>
          <span className="font-barlow text-2xl font-bold text-white leading-none tabular-nums">
            {formatDuration(duration)}
          </span>
        </div>

        <div className="bg-[#161616] rounded-xl p-3 flex flex-col items-center">
          <span className="text-[9px] font-semibold uppercase tracking-[0.15em] text-[#ff4500] mb-1">Dist</span>
          <span className="font-barlow text-2xl font-bold text-white leading-none tabular-nums">
            {distance.toFixed(2)}
          </span>
          <span className="text-[9px] text-[#444] mt-0.5">km</span>
        </div>

        <div className="bg-[#161616] rounded-xl p-3 flex flex-col items-center">
          <span className="text-[9px] font-semibold uppercase tracking-[0.15em] text-[#555] mb-1">Pace</span>
          <span className="font-barlow text-2xl font-bold text-white leading-none tabular-nums">
            {formatPace(distance, duration)}
          </span>
          <span className="text-[9px] text-[#444] mt-0.5">/km</span>
        </div>

        <div className="bg-[#161616] rounded-xl p-3 flex flex-col items-center">
          <span className="text-[9px] font-semibold uppercase tracking-[0.15em] text-[#555] mb-1">Alt</span>
          <span className="font-barlow text-2xl font-bold text-white leading-none tabular-nums">
            {altitude !== null ? Math.round(altitude) : '--'}
          </span>
          <span className="text-[9px] text-[#444] mt-0.5">m</span>
        </div>
      </div>

      {/* Start / Stop button */}
      <button
        onClick={isRecording ? onStop : onStart}
        className={`w-full py-4 rounded-2xl font-bold text-base tracking-widest uppercase transition-all duration-300 active:scale-[0.97] ${
          isRecording
            ? 'bg-rose-600 text-white recording-pulse'
            : 'bg-[#ff4500] text-white shadow-[0_0_30px_rgba(255,69,0,0.2)] hover:shadow-[0_0_40px_rgba(255,69,0,0.35)]'
        }`}
      >
        {isRecording ? '■  Stop Activity' : '▶  Start Run'}
      </button>
    </div>
  );
}
