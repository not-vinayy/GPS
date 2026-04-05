import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Activity, Coordinate } from '../types';
import { formatDuration, formatPace } from '../utils/geo';
import { generateShareImage, shareOrDownload } from '../utils/share';
import { Play, Pencil, Check, Trophy, Zap, Share2, Download, X, MapPin, Terminal, Trash2, CloudUpload } from 'lucide-react';
import LogsModal from './LogsModal';

interface ActivityHistoryProps {
  activities: Activity[];
  onReplay: (activity: Activity) => void;
  onAddDemo: () => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  syncing: boolean;
}

function RouteThumbnail({ coordinates }: { coordinates: Coordinate[] }) {
  if (coordinates.length < 2) {
    return <div className="w-16 h-16 rounded-xl bg-[#1e1e1e] shrink-0" />;
  }

  const lats = coordinates.map(c => c.lat);
  const lngs = coordinates.map(c => c.lng);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);

  const W = 100, H = 100, PAD = 12;
  const rangeX = maxLng - minLng || 1e-10;
  const rangeY = maxLat - minLat || 1e-10;

  const step = Math.max(1, Math.floor(coordinates.length / 200));
  const sampled = coordinates.filter((_, i) => i % step === 0);

  const points = sampled
    .map(c => {
      const x = PAD + ((c.lng - minLng) / rangeX) * (W - PAD * 2);
      const y = PAD + ((maxLat - c.lat) / rangeY) * (H - PAD * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width={64}
      height={64}
      className="rounded-xl bg-[#1a1a1a] shrink-0"
    >
      <polyline
        points={points}
        fill="none"
        stroke="#ff4500"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.9"
      />
    </svg>
  );
}

interface ShareModalProps {
  activity: Activity;
  onClose: () => void;
}

function ShareModal({ activity, onClose }: ShareModalProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [genError, setGenError] = useState(false);
  const [sharing, setSharing] = useState(false);

  const name = activity.name ?? format(new Date(activity.timestamp), 'EEEE, MMMM d');
  const fileName = `activity-${format(new Date(activity.timestamp), 'yyyy-MM-dd')}.png`;

  useEffect(() => {
    let cancelled = false;
    generateShareImage(activity)
      .then(url => { if (!cancelled) setImageUrl(url); })
      .catch(() => { if (!cancelled) setGenError(true); });
    return () => { cancelled = true; };
  }, [activity]);

  const handleShare = async () => {
    if (!imageUrl) return;
    setSharing(true);
    try {
      await shareOrDownload(imageUrl, fileName, name);
    } finally {
      setSharing(false);
    }
  };

  const handleDownload = () => {
    if (!imageUrl) return;
    const a = document.createElement('a');
    a.href = imageUrl;
    a.download = fileName;
    a.click();
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-sm bg-[#111] rounded-3xl shadow-2xl overflow-hidden flex flex-col border border-white/[0.08]">
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <div>
            <h3 className="text-base font-bold text-white">Share Activity</h3>
            <p className="text-xs text-[#555] mt-0.5">{name}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-full bg-[#1e1e1e] hover:bg-[#2a2a2a] transition-colors">
            <X className="w-4 h-4 text-[#888]" />
          </button>
        </div>

        <div className="px-5 pb-4">
          {genError ? (
            <div className="w-full aspect-[3/4] rounded-2xl bg-[#1a1a1a] flex flex-col items-center justify-center gap-2 text-[#555]">
              <MapPin className="w-8 h-8 opacity-40" />
              <p className="text-sm font-medium">Couldn't generate card</p>
            </div>
          ) : imageUrl ? (
            <img src={imageUrl} alt="Activity share card" className="w-full rounded-2xl shadow-md" />
          ) : (
            <div className="w-full aspect-[3/4] rounded-2xl bg-[#111] overflow-hidden relative flex flex-col items-center justify-end pb-8 gap-3">
              <div className="absolute inset-0 bg-gradient-to-br from-[#1a1a1a] via-[#111] to-[#1a1a1a] animate-pulse" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-0.5 rounded-full bg-[#ff4500]/20 animate-pulse" />
              <div className="relative flex flex-col items-center gap-2">
                <svg className="animate-spin w-6 h-6 text-[#ff4500]" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"/>
                  <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                <p className="text-xs text-[#555] font-medium tracking-wide">Rendering map…</p>
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-3 px-5 pb-6">
          <button
            onClick={handleShare}
            disabled={!imageUrl || sharing}
            className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-[#ff4500] text-white font-semibold rounded-2xl hover:bg-[#e03d00] transition-colors disabled:opacity-40"
          >
            <Share2 className="w-4 h-4" />
            {sharing ? 'Sharing…' : 'Share'}
          </button>
          <button
            onClick={handleDownload}
            disabled={!imageUrl}
            className="flex items-center justify-center gap-2 px-5 py-3.5 bg-[#1e1e1e] text-[#888] font-semibold rounded-2xl hover:bg-[#2a2a2a] hover:text-white transition-colors disabled:opacity-40"
          >
            <Download className="w-4 h-4" />
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ActivityHistory({ activities, onReplay, onAddDemo, onRename, onDelete, syncing }: ActivityHistoryProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [sharingActivity, setSharingActivity] = useState<Activity | null>(null);
  const [showLogs, setShowLogs] = useState(false);

  const longestId = activities.length > 0
    ? activities.reduce((best, a) => a.distance > best.distance ? a : best).id
    : null;

  const fastestId = activities.length > 0
    ? activities
        .filter(a => a.distance > 0)
        .reduce((best, a) => {
          const pace = a.duration / a.distance;
          const bestPace = best.duration / best.distance;
          return pace < bestPace ? a : best;
        }, activities.filter(a => a.distance > 0)[0])?.id ?? null
    : null;

  const startEdit = (activity: Activity) => {
    setEditingId(activity.id);
    setEditValue(activity.name ?? format(new Date(activity.timestamp), 'EEEE, MMMM d'));
  };

  const commitEdit = (id: string) => {
    const trimmed = editValue.trim();
    if (trimmed) onRename(id, trimmed);
    setEditingId(null);
  };

  return (
    <div className="h-full flex flex-col bg-[#0a0a0a]">
      {/* Sticky header */}
      <div className="sticky top-0 z-10 bg-[#0a0a0a] border-b border-white/[0.05] px-4 pt-5 pb-4 flex items-center justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#444] mb-0.5">Your Activities</p>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold text-white">Traces</h2>
            {syncing && <CloudUpload className="w-4 h-4 text-[#ff4500] animate-pulse" />}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowLogs(true)}
            className="w-9 h-9 rounded-full bg-[#1a1a1a] flex items-center justify-center text-[#555] hover:text-white transition-colors border border-white/[0.06]"
            title="Debug logs"
          >
            <Terminal className="w-4 h-4" />
          </button>
          <button
            onClick={onAddDemo}
            className="px-4 py-2 bg-[#1a1a1a] text-[#777] text-sm font-medium rounded-full hover:text-white border border-white/[0.06] transition-colors"
          >
            + Demo
          </button>
        </div>
      </div>

      {/* Activity list */}
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
        {activities.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-2xl bg-[#1a1a1a] flex items-center justify-center mb-4">
              <MapPin className="w-7 h-7 text-[#333]" />
            </div>
            <p className="text-[#555] font-medium mb-1">No activities yet</p>
            <p className="text-[#333] text-sm mb-6">Go for a run or try a demo</p>
            <button
              onClick={onAddDemo}
              className="px-8 py-3 bg-[#ff4500] text-white font-semibold rounded-2xl shadow-[0_0_24px_rgba(255,69,0,0.2)] hover:bg-[#e03d00] transition-colors"
            >
              Load Demo
            </button>
          </div>
        ) : (
          activities.map(activity => {
            const isLongest = activity.id === longestId;
            const isFastest = activity.id === fastestId;
            const isEditing = editingId === activity.id;
            const displayName = activity.name ?? format(new Date(activity.timestamp), 'EEEE, MMMM d');

            return (
              <div key={activity.id} className="bg-[#111] rounded-2xl border border-white/[0.06] overflow-hidden">
                {/* Top: thumbnail + title */}
                <div className="flex items-start gap-3 p-4">
                  <RouteThumbnail coordinates={activity.coordinates} />

                  <div className="flex-1 min-w-0">
                    {(isLongest || isFastest) && (
                      <div className="flex gap-1.5 mb-2">
                        {isLongest && (
                          <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider bg-amber-500/15 text-amber-400 px-2 py-0.5 rounded-full">
                            <Trophy className="w-2.5 h-2.5" /> Longest
                          </span>
                        )}
                        {isFastest && (
                          <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-400 px-2 py-0.5 rounded-full">
                            <Zap className="w-2.5 h-2.5" /> Fastest
                          </span>
                        )}
                      </div>
                    )}

                    {isEditing ? (
                      <div className="flex items-center gap-2">
                        <input
                          autoFocus
                          value={editValue}
                          onChange={e => setEditValue(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') commitEdit(activity.id);
                            if (e.key === 'Escape') setEditingId(null);
                          }}
                          onBlur={() => commitEdit(activity.id)}
                          className="flex-1 text-sm font-bold text-white bg-[#1e1e1e] rounded-lg px-2.5 py-1.5 outline-none focus:ring-1 focus:ring-[#ff4500]/50 min-w-0"
                        />
                        <button
                          onMouseDown={e => { e.preventDefault(); commitEdit(activity.id); }}
                          className="p-1 text-emerald-500"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 group">
                        <span className="text-sm font-bold text-white truncate">{displayName}</span>
                        <button
                          onClick={() => startEdit(activity)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-[#444] hover:text-[#888] shrink-0"
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                      </div>
                    )}

                    <p className="text-[11px] text-[#444] mt-0.5">
                      {format(new Date(activity.timestamp), 'h:mm a · MMM d, yyyy')}
                    </p>
                  </div>
                </div>

                {/* Stats row */}
                <div className="flex border-t border-white/[0.05]">
                  {[
                    { label: 'DIST', value: activity.distance.toFixed(2), unit: 'km', accent: true },
                    { label: 'PACE', value: formatPace(activity.distance, activity.duration), unit: '/km', accent: false },
                    { label: 'TIME', value: formatDuration(activity.duration), unit: '', accent: false },
                  ].map((stat, i) => (
                    <div
                      key={stat.label}
                      className={`flex-1 py-3 flex flex-col items-center ${i < 2 ? 'border-r border-white/[0.05]' : ''}`}
                    >
                      <span className="text-[9px] font-semibold tracking-widest text-[#3a3a3a] uppercase">{stat.label}</span>
                      <span
                        className="font-barlow text-xl font-bold mt-0.5 leading-none"
                        style={{ color: stat.accent ? '#ff4500' : '#e5e5e5' }}
                      >
                        {stat.value}
                      </span>
                      {stat.unit && <span className="text-[9px] text-[#333] mt-0.5">{stat.unit}</span>}
                    </div>
                  ))}
                </div>

                {/* Action buttons */}
                <div className="flex border-t border-white/[0.05]">
                  <button
                    onClick={() => onReplay(activity)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-3 text-[#555] hover:text-[#ff4500] hover:bg-[#ff4500]/5 transition-colors text-xs font-semibold"
                  >
                    <Play className="w-3.5 h-3.5" /> Replay
                  </button>
                  <div className="w-px bg-white/[0.05]" />
                  <button
                    onClick={() => setSharingActivity(activity)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-3 text-[#555] hover:text-white hover:bg-white/[0.04] transition-colors text-xs font-semibold"
                  >
                    <Share2 className="w-3.5 h-3.5" /> Share
                  </button>
                  <div className="w-px bg-white/[0.05]" />
                  <button
                    onClick={() => { if (confirm('Delete this activity?')) onDelete(activity.id); }}
                    className="flex-1 flex items-center justify-center gap-1.5 py-3 text-[#444] hover:text-rose-400 hover:bg-rose-400/5 transition-colors text-xs font-semibold"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {sharingActivity && (
        <ShareModal
          activity={sharingActivity}
          onClose={() => setSharingActivity(null)}
        />
      )}

      {showLogs && <LogsModal onClose={() => setShowLogs(false)} />}
    </div>
  );
}
