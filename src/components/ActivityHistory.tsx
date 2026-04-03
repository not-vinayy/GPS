import React from 'react';
import { format } from 'date-fns';
import { Activity } from '../types';
import { formatDuration, calculateSpeed } from '../utils/geo';
import { Play, MapPin, Clock, Zap, Mountain, Plus } from 'lucide-react';

interface ActivityHistoryProps {
  activities: Activity[];
  onReplay: (activity: Activity) => void;
  onAddDemo: () => void;
}

export default function ActivityHistory({ activities, onReplay, onAddDemo }: ActivityHistoryProps) {
  return (
    <div className="h-full overflow-y-auto bg-slate-50 p-4">
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 mb-6 flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-800">Archive</h2>
        <button 
          onClick={onAddDemo}
          className="bg-blue-50 text-blue-700 px-4 py-2 rounded-full font-medium text-sm hover:bg-blue-100 transition-colors"
        >
          Add Demo
        </button>
      </div>
      
      <div className="flex flex-col gap-4">
        {activities.length === 0 ? (
          <div className="bg-white p-10 flex flex-col items-center text-center rounded-3xl shadow-sm border border-slate-100">
            <h2 className="text-xl font-semibold mb-4 text-slate-700">No Activities Yet</h2>
            <button 
              onClick={onAddDemo} 
              className="bg-emerald-300 text-emerald-900 px-8 py-3 rounded-full font-medium shadow-sm hover:bg-emerald-400 hover:shadow-md transition-all"
            >
              Load Demo
            </button>
          </div>
        ) : (
          activities.map(activity => {
            const speed = calculateSpeed(activity.distance, activity.duration);
            return (
              <div key={activity.id} className="bg-white flex flex-col md:flex-row rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="p-6 flex-1 flex flex-col justify-center">
                  <h3 className="text-lg font-bold text-slate-800 mb-1">{format(new Date(activity.timestamp), 'EEEE, MMMM d, yyyy')}</h3>
                  <p className="text-sm font-medium text-slate-500">{format(new Date(activity.timestamp), 'h:mm a')}</p>
                </div>
                <div className="flex flex-wrap md:flex-nowrap bg-slate-50/50 p-4 gap-2 md:gap-4 items-center justify-end">
                  <div className="flex-1 md:flex-none bg-blue-50 p-3 rounded-2xl flex flex-col justify-center items-center min-w-[80px]">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-blue-600 mb-1">Dist</span>
                    <span className="text-lg font-bold text-blue-900">{activity.distance.toFixed(1)}</span>
                  </div>
                  <div className="flex-1 md:flex-none bg-purple-50 p-3 rounded-2xl flex flex-col justify-center items-center min-w-[80px]">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-purple-600 mb-1">Time</span>
                    <span className="text-lg font-bold text-purple-900">{formatDuration(activity.duration)}</span>
                  </div>
                  <button 
                    onClick={() => onReplay(activity)}
                    className="w-full md:w-auto p-4 bg-amber-200 hover:bg-amber-300 text-amber-900 rounded-2xl flex flex-col justify-center items-center transition-colors shadow-sm"
                  >
                    <Play className="w-6 h-6 mb-1" />
                    <span className="text-[10px] font-semibold uppercase tracking-wider">Replay</span>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
