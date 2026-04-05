/**
 * Lightweight in-app logger.
 * Persists up to 1 000 entries in localStorage so they survive refreshes.
 * Mirrors every entry to the browser/Logcat console as well.
 */

export type LogLevel    = 'debug' | 'info' | 'warn' | 'error';
export type LogCategory = 'app' | 'gps' | 'recording' | 'permissions' | 'storage';

export interface LogEntry {
  id:    string;
  ts:    number;      // Unix ms
  level: LogLevel;
  cat:   LogCategory;
  msg:   string;
  data?: string;      // JSON-stringified extra context
}

const MAX_ENTRIES  = 1_000;
const STORAGE_KEY  = 'trace_debug_logs';

// In-memory cache so we don't parse JSON on every log call
let cache: LogEntry[] | null = null;

function load(): LogEntry[] {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    cache = raw ? (JSON.parse(raw) as LogEntry[]) : [];
  } catch {
    cache = [];
  }
  return cache;
}

function persist(logs: LogEntry[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(logs));
  } catch {
    // Storage quota hit — keep the most recent half and retry once
    try {
      const trimmed = logs.slice(-Math.floor(MAX_ENTRIES / 2));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
      cache = trimmed;
    } catch { /* give up */ }
  }
}

function safeStringify(val: unknown): string {
  try   { return JSON.stringify(val); }
  catch { return String(val); }
}

function addEntry(level: LogLevel, cat: LogCategory, msg: string, data?: unknown): void {
  const entry: LogEntry = {
    id:    `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    ts:    Date.now(),
    level,
    cat,
    msg,
    ...(data !== undefined && { data: safeStringify(data) }),
  };

  // Mirror to console (visible in Logcat on Android via Capacitor)
  const prefix = `[TRACE/${cat.toUpperCase()}]`;
  if      (level === 'error') console.error(prefix, msg, data ?? '');
  else if (level === 'warn')  console.warn(prefix, msg, data ?? '');
  else if (level === 'debug') console.debug(prefix, msg, data ?? '');
  else                        console.log(prefix, msg, data ?? '');

  const logs = load();
  logs.push(entry);
  if (logs.length > MAX_ENTRIES) logs.splice(0, logs.length - MAX_ENTRIES);
  persist(logs);
}

export const logger = {
  debug: (cat: LogCategory, msg: string, data?: unknown) => addEntry('debug', cat, msg, data),
  info:  (cat: LogCategory, msg: string, data?: unknown) => addEntry('info',  cat, msg, data),
  warn:  (cat: LogCategory, msg: string, data?: unknown) => addEntry('warn',  cat, msg, data),
  error: (cat: LogCategory, msg: string, data?: unknown) => addEntry('error', cat, msg, data),

  /** Return a copy of all stored entries (oldest first). */
  getAll(): LogEntry[] {
    return [...load()];
  },

  /** Wipe logs from memory and localStorage. */
  clear(): void {
    cache = [];
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
  },
};
