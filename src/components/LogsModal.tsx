import React, { useState, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { X, Download, Share2, Trash2, RefreshCw } from 'lucide-react';
import { logger, type LogEntry, type LogLevel } from '../utils/logger';
import { Capacitor } from '@capacitor/core';

interface LogsModalProps {
  onClose: () => void;
}

const LEVEL_STYLES: Record<LogLevel, { badge: string; text: string; row: string }> = {
  error: { badge: 'bg-rose-500 text-white',          text: 'text-rose-400',   row: 'bg-rose-950/30' },
  warn:  { badge: 'bg-amber-400 text-amber-900',     text: 'text-amber-300',  row: 'bg-amber-950/20' },
  info:  { badge: 'bg-sky-500 text-white',           text: 'text-sky-300',    row: '' },
  debug: { badge: 'bg-slate-600 text-slate-200',     text: 'text-slate-400',  row: '' },
};

const CAT_COLOUR: Record<string, string> = {
  app:         'text-violet-400',
  gps:         'text-emerald-400',
  recording:   'text-orange-400',
  permissions: 'text-yellow-400',
  storage:     'text-blue-400',
};

function buildLogText(entries: LogEntry[]): string {
  const lines: string[] = [
    '╔══════════════════════════════════════════════════╗',
    '║             TRACE APP — DEBUG LOG                ║',
    '╚══════════════════════════════════════════════════╝',
    `Generated  : ${new Date().toISOString()}`,
    `Platform   : ${Capacitor.isNativePlatform() ? `native (${Capacitor.getPlatform()})` : 'web'}`,
    `User-Agent : ${navigator.userAgent}`,
    `Entries    : ${entries.length}`,
    '',
    '──────────────────────────────────────────────────',
    '',
  ];

  for (const e of entries) {
    const ts   = format(new Date(e.ts), 'HH:mm:ss.SSS');
    const lvl  = e.level.toUpperCase().padEnd(5);
    const cat  = e.cat.toUpperCase().padEnd(11);
    const data = e.data ? ` | ${e.data}` : '';
    lines.push(`[${ts}] ${lvl} ${cat} ${e.msg}${data}`);
  }

  return lines.join('\n');
}

async function shareOrDownload(text: string, fileName: string): Promise<void> {
  const blob = new Blob([text], { type: 'text/plain' });
  const file = new File([blob], fileName, { type: 'text/plain' });

  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], title: 'Trace Debug Logs' });
  } else {
    const url = URL.createObjectURL(blob);
    const a   = document.createElement('a');
    a.href     = url;
    a.download = fileName;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5_000);
  }
}

export default function LogsModal({ onClose }: LogsModalProps) {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [filter, setFilter]   = useState<LogLevel | 'all'>('all');
  const bottomRef = useRef<HTMLDivElement>(null);

  const refresh = () => setEntries(logger.getAll());

  useEffect(() => {
    refresh();
  }, []);

  // Auto-scroll to bottom when entries change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [entries.length]);

  const visible = filter === 'all'
    ? entries
    : entries.filter(e => e.level === filter);

  const handleDownload = async () => {
    const text     = buildLogText(entries);
    const fileName = `trace-logs-${format(new Date(), 'yyyy-MM-dd-HHmm')}.txt`;
    await shareOrDownload(text, fileName);
  };

  const handleClear = () => {
    logger.clear();
    setEntries([]);
  };

  const counts = entries.reduce(
    (acc, e) => { acc[e.level] = (acc[e.level] ?? 0) + 1; return acc; },
    {} as Record<LogLevel, number>,
  );

  return (
    <div
      className="fixed inset-0 z-[70] flex flex-col bg-slate-950 text-slate-100 font-mono"
      style={{ fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace" }}
    >
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-4 py-3 bg-slate-900 border-b border-slate-800 shrink-0">
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-slate-100 tracking-wide">Debug Logs</div>
          <div className="text-[10px] text-slate-500 truncate">
            {entries.length} entries
            {counts.error  ? <span className="text-rose-400 ml-2">● {counts.error}  err</span>  : null}
            {counts.warn   ? <span className="text-amber-400 ml-2">● {counts.warn}  warn</span> : null}
          </div>
        </div>

        {/* Level filter pills */}
        <div className="flex gap-1">
          {(['all', 'error', 'warn', 'info', 'debug'] as const).map(lvl => (
            <button
              key={lvl}
              onClick={() => setFilter(lvl)}
              className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full transition-colors ${
                filter === lvl
                  ? 'bg-slate-100 text-slate-900'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              }`}
            >
              {lvl}
            </button>
          ))}
        </div>

        <div className="flex gap-1 shrink-0">
          <button
            onClick={refresh}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-100 transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-100 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ── Log list ───────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto text-[11px] leading-relaxed">
        {visible.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-slate-600">
            <span className="text-3xl">📭</span>
            <span>No log entries yet. Start a recording to generate logs.</span>
          </div>
        ) : (
          visible.map(entry => {
            const styles = LEVEL_STYLES[entry.level];
            return (
              <div
                key={entry.id}
                className={`flex gap-2 px-3 py-1 border-b border-slate-800/50 ${styles.row}`}
              >
                {/* Timestamp */}
                <span className="text-slate-600 shrink-0 w-[88px] tabular-nums">
                  {format(new Date(entry.ts), 'HH:mm:ss.SSS')}
                </span>

                {/* Level badge */}
                <span className={`shrink-0 text-[8px] font-bold uppercase px-1.5 py-0.5 rounded self-start mt-0.5 ${styles.badge}`}>
                  {entry.level}
                </span>

                {/* Category */}
                <span className={`shrink-0 w-[72px] text-[10px] font-semibold uppercase ${CAT_COLOUR[entry.cat] ?? 'text-slate-400'}`}>
                  {entry.cat}
                </span>

                {/* Message + data */}
                <span className="flex-1 min-w-0 break-all text-slate-300">
                  {entry.msg}
                  {entry.data && (
                    <span className="text-slate-500 ml-1">| {entry.data}</span>
                  )}
                </span>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* ── Footer actions ─────────────────────────────────────────────────── */}
      <div className="flex gap-2 px-4 py-3 bg-slate-900 border-t border-slate-800 shrink-0">
        <button
          onClick={handleDownload}
          disabled={entries.length === 0}
          className="flex-1 flex items-center justify-center gap-2 py-3 bg-orange-600 hover:bg-orange-500 text-white font-bold text-sm rounded-xl transition-colors disabled:opacity-40"
        >
          <Share2 className="w-4 h-4" />
          Share / Download
        </button>
        <button
          onClick={handleClear}
          disabled={entries.length === 0}
          className="flex items-center justify-center gap-2 px-4 py-3 bg-slate-800 hover:bg-rose-900 text-slate-400 hover:text-rose-300 font-semibold text-sm rounded-xl transition-colors disabled:opacity-40"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
