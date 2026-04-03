import React from 'react';
import { formatDuration } from '../utils/geo';

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
    <div className="w-full bg-slate-50 flex flex-col gap-4 p-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white p-4 flex flex-col justify-center items-center rounded-2xl shadow-sm border border-slate-100">
          <div className="text-xs font-medium text-slate-500 mb-1">Time</div>
          <div className="text-2xl font-bold text-slate-800">{formatDuration(duration)}</div>
        </div>
        <div className="bg-blue-50 p-4 flex flex-col justify-center items-center rounded-2xl shadow-sm border border-blue-100">
          <div className="text-xs font-medium text-blue-600 mb-1">Distance</div>
          <div className="text-2xl font-bold text-blue-900">
            {distance.toFixed(2)} <span className="text-sm font-medium text-blue-700">km</span>
          </div>
        </div>
        <div className="bg-purple-50 p-4 flex flex-col justify-center items-center rounded-2xl shadow-sm border border-purple-100">
          <div className="text-xs font-medium text-purple-600 mb-1">Speed</div>
          <div className="text-2xl font-bold text-purple-900">
            {speed.toFixed(1)} <span className="text-sm font-medium text-purple-700">km/h</span>
          </div>
        </div>
        <div className="bg-amber-50 p-4 flex flex-col justify-center items-center rounded-2xl shadow-sm border border-amber-100">
          <div className="text-xs font-medium text-amber-600 mb-1">Altitude</div>
          <div className="text-2xl font-bold text-amber-900">
            {altitude !== null ? Math.round(altitude) : '--'} <span className="text-sm font-medium text-amber-700">m</span>
          </div>
        </div>
      </div>

      <button
        onClick={isRecording ? onStop : onStart}
        className={`w-full py-4 font-semibold text-lg rounded-full shadow-md transition-all duration-300 active:scale-[0.98] ${
          isRecording 
            ? 'bg-rose-100 text-rose-700 hover:bg-rose-200 hover:shadow-lg' 
            : 'bg-emerald-300 text-emerald-900 hover:bg-emerald-400 hover:shadow-lg'
        }`}
      >
        {isRecording ? 'Stop Activity' : 'Start Activity'}
      </button>
    </div>
  );
}
