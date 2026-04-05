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
    return <div className="w-[72px] h-[72px] rounded-2xl bg-slate-100 shrink-0" />;
  }

  const lats = coordinates.map(c => c.lat);
  const lngs = coordinates.map(c => c.lng);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);

  const W = 100, H = 100, PAD = 10;
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
      width={72}
      height={72}
      className="rounded-2xl bg-slate-100 shrink-0"
    >
      <polyline
        points={points}
        fill="none"
        stroke="#fc4c02"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
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
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <div>
            <h3 className="text-base font-bold text-slate-800">Share Activity</h3>
            <p className="text-xs text-slate-400 mt-0.5">{name}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-full bg-slate-100 hover:bg-slate-200 transition-colors">
            <X className="w-4 h-4 text-slate-600" />
          </button>
        </div>

        {/* Card preview */}
        <div className="px-5 pb-4">
          {genError ? (
            <div className="w-full aspect-[3/4] rounded-2xl bg-slate-100 flex flex-col items-center justify-center gap-2 text-slate-400">
              <MapPin className="w-8 h-8 opacity-40" />
              <p className="text-sm font-medium">Couldn't generate card</p>
            </div>
          ) : imageUrl ? (
            <img src={imageUrl} alt="Activity share card" className="w-full rounded-2xl shadow-md" />
          ) : (
            /* Loading skeleton — map is rendering off-screen */
            <div className="w-full aspect-[3/4] rounded-2xl bg-slate-900 overflow-hidden relative flex flex-col items-center justify-end pb-8 gap-3">
              {/* Simulated dark map shimmer */}
              <div className="absolute inset-0 bg-gradient-to-br from-slate-800 via-slate-900 to-slate-800 animate-pulse" />
              {/* Fake route line shimmer */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-0.5 rounded-full bg-orange-500/30 animate-pulse" />
              {/* Spinner */}
              <div className="relative flex flex-col items-center gap-2">
                <svg className="animate-spin w-6 h-6 text-orange-500" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"/>
                  <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                <p className="text-xs text-slate-400 font-medium tracking-wide">Rendering map…</p>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3 px-5 pb-6">
          <button
            onClick={handleShare}
            disabled={!imageUrl || sharing}
            className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-slate-900 text-white font-semibold rounded-2xl hover:bg-slate-700 transition-colors disabled:opacity-40"
          >
            <Share2 className="w-4 h-4" />
            {sharing ? 'Sharing…' : 'Share'}
          </button>
          <button
            onClick={handleDownload}
            disabled={!imageUrl}
            className="flex items-center justify-center gap-2 px-5 py-3.5 bg-slate-100 text-slate-700 font-semibold rounded-2xl hover:bg-slate-200 transition-colors disabled:opacity-40"
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
    <div className="h-full overflow-y-auto bg-slate-50 p-4">
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 mb-6 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <h2 className="text-2xl font-bold text-slate-800">Your Traces</h2>
          {syncing && <CloudUpload className="w-4 h-4 text-blue-400 animate-pulse" title="Syncing…" />}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowLogs(true)}
            className="p-2 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-700 transition-colors"
            title="Debug logs"
          >
            <Terminal className="w-4 h-4" />
          </button>
          <button
            onClick={onAddDemo}
            className="bg-blue-50 text-blue-700 px-4 py-2 rounded-full font-medium text-sm hover:bg-blue-100 transition-colors"
          >
            Add Demo
          </button>
        </div>
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
            const isLongest = activity.id === longestId;
            const isFastest = activity.id === fastestId;
            const isEditing = editingId === activity.id;
            const displayName = activity.name ?? format(new Date(activity.timestamp), 'EEEE, MMMM d');

            return (
              <div key={activity.id} className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
                {/* Top row: thumbnail + title + badges */}
                <div className="flex items-center gap-4 px-5 pt-5 pb-3">
                  <RouteThumbnail coordinates={activity.coordinates} />

                  <div className="flex-1 min-w-0">
                    {(isLongest || isFastest) && (
                      <div className="flex gap-2 mb-1.5">
                        {isLongest && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                            <Trophy className="w-3 h-3" /> Longest
                          </span>
                        )}
                        {isFastest && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
                            <Zap className="w-3 h-3" /> Fastest
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
                          className="flex-1 text-base font-bold text-slate-800 bg-slate-100 rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-blue-300 min-w-0"
                        />
                        <button
                          onMouseDown={e => { e.preventDefault(); commitEdit(activity.id); }}
                          className="p-1 text-emerald-600 hover:text-emerald-700"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 group">
                        <span className="text-base font-bold text-slate-800 truncate">{displayName}</span>
                        <button
                          onClick={() => startEdit(activity)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-slate-400 hover:text-slate-600 shrink-0"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}

                    <p className="text-xs text-slate-400 mt-0.5">{format(new Date(activity.timestamp), 'h:mm a · MMM d, yyyy')}</p>
                  </div>
                </div>

                {/* Bottom row: stats + replay + share */}
                <div className="flex gap-2 px-5 pb-5">
                  <div className="flex-1 bg-blue-50 p-3 rounded-2xl flex flex-col items-center">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-blue-600 mb-0.5">Dist</span>
                    <span className="text-lg font-bold text-blue-900 leading-none">{activity.distance.toFixed(2)}</span>
                    <span className="text-[10px] text-blue-500 mt-0.5">km</span>
                  </div>
                  <div className="flex-1 bg-purple-50 p-3 rounded-2xl flex flex-col items-center">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-purple-600 mb-0.5">Pace</span>
                    <span className="text-lg font-bold text-purple-900 leading-none">{formatPace(activity.distance, activity.duration)}</span>
                    <span className="text-[10px] text-purple-500 mt-0.5">/km</span>
                  </div>
                  <div className="flex-1 bg-slate-50 p-3 rounded-2xl flex flex-col items-center">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-0.5">Time</span>
                    <span className="text-lg font-bold text-slate-800 leading-none">{formatDuration(activity.duration)}</span>
                    <span className="text-[10px] text-slate-400 mt-0.5">hh:mm</span>
                  </div>
                  <button
                    onClick={() => onReplay(activity)}
                    className="flex flex-col items-center justify-center px-3 bg-amber-200 hover:bg-amber-300 text-amber-900 rounded-2xl transition-colors shadow-sm shrink-0"
                  >
                    <Play className="w-4 h-4 mb-1" />
                    <span className="text-[9px] font-semibold uppercase tracking-wider">Replay</span>
                  </button>
                  <button
                    onClick={() => setSharingActivity(activity)}
                    className="flex flex-col items-center justify-center px-3 bg-slate-900 hover:bg-slate-700 text-white rounded-2xl transition-colors shadow-sm shrink-0"
                  >
                    <Share2 className="w-4 h-4 mb-1" />
                    <span className="text-[9px] font-semibold uppercase tracking-wider">Share</span>
                  </button>
                  <button
                    onClick={() => { if (confirm('Delete this activity?')) onDelete(activity.id); }}
                    className="flex flex-col items-center justify-center px-3 bg-rose-50 hover:bg-rose-100 text-rose-500 rounded-2xl transition-colors shadow-sm shrink-0"
                  >
                    <Trash2 className="w-4 h-4 mb-1" />
                    <span className="text-[9px] font-semibold uppercase tracking-wider">Del</span>
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
