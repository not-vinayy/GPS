import React from 'react';
import { type User } from 'firebase/auth';
import { Activity } from '../types';
import { formatDuration } from '../utils/geo';
import { LogOut, Flame, Route, Clock, TrendingUp } from 'lucide-react';

interface ProfileScreenProps {
  user: User;
  activities: Activity[];
  onSignOut: () => void;
}

export default function ProfileScreen({ user, activities, onSignOut }: ProfileScreenProps) {
  const initial = (user.displayName?.[0] ?? user.email?.[0] ?? '?').toUpperCase();
  const displayName = user.displayName ?? user.email?.split('@')[0] ?? 'Athlete';

  // Aggregate stats
  const totalRuns     = activities.length;
  const totalDistance = activities.reduce((sum, a) => sum + a.distance, 0);
  const totalDuration = activities.reduce((sum, a) => sum + a.duration, 0);
  const totalElevation = activities.reduce((sum, a) => sum + (a.elevationGain ?? 0), 0);
  const bestPace = activities.length > 0
    ? activities
        .filter(a => a.distance > 0.1)
        .reduce((best, a) => {
          const pace = a.duration / 60 / a.distance;
          return pace < best ? pace : best;
        }, Infinity)
    : null;

  const stats = [
    {
      icon: Route,
      label: 'Total Distance',
      value: totalDistance.toFixed(1),
      unit: 'km',
      color: '#ff4500',
    },
    {
      icon: Clock,
      label: 'Total Time',
      value: formatDuration(totalDuration),
      unit: '',
      color: '#a78bfa',
    },
    {
      icon: Flame,
      label: 'Activities',
      value: String(totalRuns),
      unit: 'runs',
      color: '#fb923c',
    },
    {
      icon: TrendingUp,
      label: 'Elevation',
      value: Math.round(totalElevation).toLocaleString(),
      unit: 'm',
      color: '#34d399',
    },
  ];

  return (
    <div className="h-full overflow-y-auto bg-[#0a0a0a]">
      {/* Header */}
      <div className="px-6 pt-10 pb-6">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#444] mb-6">Profile</p>

        {/* Avatar + name */}
        <div className="flex flex-col items-center text-center mb-8">
          {user.photoURL ? (
            <img
              src={user.photoURL}
              alt=""
              className="w-24 h-24 rounded-full ring-2 ring-white/10 mb-4 shadow-[0_0_40px_rgba(255,69,0,0.15)]"
            />
          ) : (
            <div className="w-24 h-24 rounded-full bg-[#ff4500] flex items-center justify-center mb-4 text-3xl font-bold text-white shadow-[0_0_40px_rgba(255,69,0,0.2)]">
              {initial}
            </div>
          )}
          <h2 className="text-2xl font-bold text-white">{displayName}</h2>
          {user.email && (
            <p className="text-sm text-[#555] mt-1">{user.email}</p>
          )}
          {totalRuns > 0 && bestPace !== null && bestPace !== Infinity && (
            <div className="mt-3 px-3 py-1 bg-[#ff4500]/10 rounded-full border border-[#ff4500]/20">
              <p className="text-xs font-semibold text-[#ff4500]">
                Best pace — {Math.floor(bestPace)}:{String(Math.round((bestPace % 1) * 60)).padStart(2, '0')} /km
              </p>
            </div>
          )}
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          {stats.map(stat => {
            const Icon = stat.icon;
            return (
              <div key={stat.label} className="bg-[#111] rounded-2xl p-4 border border-white/[0.05]">
                <div className="flex items-center gap-2 mb-2">
                  <Icon className="w-3.5 h-3.5" style={{ color: stat.color }} />
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-[#444]">
                    {stat.label}
                  </span>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="font-barlow text-3xl font-bold text-white leading-none">
                    {stat.value}
                  </span>
                  {stat.unit && (
                    <span className="text-sm text-[#444] font-medium">{stat.unit}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Sign out */}
        <button
          onClick={onSignOut}
          className="w-full flex items-center justify-center gap-2.5 py-4 bg-[#111] border border-white/[0.06] rounded-2xl text-[#666] hover:text-rose-400 hover:border-rose-500/20 hover:bg-rose-500/5 transition-all font-semibold text-sm"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>
    </div>
  );
}
