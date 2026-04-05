import { useEffect, useState, useCallback } from 'react';
import {
  collection, doc, setDoc, updateDoc, deleteDoc,
  onSnapshot, query, orderBy,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Activity } from '../types';
import { logger } from '../utils/logger';

/**
 * Reactive Firestore-backed activities hook.
 *
 * - Real-time sync via onSnapshot (updates across devices instantly)
 * - Offline-first: Firestore's IndexedDB cache means it works without signal
 * - localStorage is kept as an anonymous/pre-login scratch pad and migrated
 *   into Firestore on first sign-in
 */
export function useActivities(uid: string | null) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [syncing, setSyncing]       = useState(false);

  // ── Subscribe to Firestore collection ────────────────────────────────────
  useEffect(() => {
    if (!uid) {
      // Not signed in — fall back to localStorage
      try {
        const raw = localStorage.getItem('trace_activities');
        setActivities(raw ? JSON.parse(raw) : []);
      } catch { setActivities([]); }
      return;
    }

    logger.info('storage', 'Subscribing to Firestore activities', { uid });
    let unsub: Unsubscribe | undefined;

    const subscribe = () => {
      const q = query(
        collection(db, 'users', uid, 'activities'),
        orderBy('timestamp', 'desc'),
      );

      unsub = onSnapshot(
        q,
        snapshot => {
          const docs = snapshot.docs.map(d => d.data() as Activity);
          setActivities(docs);
          logger.info('storage', 'Firestore snapshot received', { count: docs.length });
        },
        err => {
          logger.error('storage', 'Firestore snapshot error', { err: err.message });
        },
      );
    };

    // Migrate any localStorage activities into Firestore on first sign-in
    migrateLocalStorage(uid).then(subscribe);

    return () => unsub?.();
  }, [uid]);

  // ── Save a new activity ──────────────────────────────────────────────────
  const saveActivity = useCallback(async (activity: Activity) => {
    if (!uid) {
      // Anonymous — persist to localStorage only
      setActivities(prev => {
        const next = [activity, ...prev];
        localStorage.setItem('trace_activities', JSON.stringify(next));
        return next;
      });
      return;
    }

    setSyncing(true);
    try {
      await setDoc(doc(db, 'users', uid, 'activities', activity.id), activity);
      logger.info('storage', 'Activity saved to Firestore', { id: activity.id });
    } catch (e) {
      logger.error('storage', 'Failed to save activity', { err: String(e) });
    } finally {
      setSyncing(false);
    }
  }, [uid]);

  // ── Rename an activity ───────────────────────────────────────────────────
  const renameActivity = useCallback(async (id: string, name: string) => {
    if (!uid) {
      setActivities(prev => {
        const next = prev.map(a => a.id === id ? { ...a, name } : a);
        localStorage.setItem('trace_activities', JSON.stringify(next));
        return next;
      });
      return;
    }

    try {
      await updateDoc(doc(db, 'users', uid, 'activities', id), { name });
      logger.info('storage', 'Activity renamed in Firestore', { id, name });
    } catch (e) {
      logger.error('storage', 'Failed to rename activity', { err: String(e) });
    }
  }, [uid]);

  // ── Delete an activity ───────────────────────────────────────────────────
  const deleteActivity = useCallback(async (id: string) => {
    if (!uid) {
      setActivities(prev => {
        const next = prev.filter(a => a.id !== id);
        localStorage.setItem('trace_activities', JSON.stringify(next));
        return next;
      });
      return;
    }

    try {
      await deleteDoc(doc(db, 'users', uid, 'activities', id));
      logger.info('storage', 'Activity deleted from Firestore', { id });
    } catch (e) {
      logger.error('storage', 'Failed to delete activity', { err: String(e) });
    }
  }, [uid]);

  return { activities, saveActivity, renameActivity, deleteActivity, syncing };
}

// ── One-time migration: localStorage → Firestore ─────────────────────────────
async function migrateLocalStorage(uid: string): Promise<void> {
  try {
    const raw = localStorage.getItem('trace_activities');
    if (!raw) return;

    const local: Activity[] = JSON.parse(raw);
    if (local.length === 0) return;

    logger.info('storage', 'Migrating localStorage activities to Firestore', { count: local.length });

    await Promise.all(
      local.map(a => setDoc(doc(db, 'users', uid, 'activities', a.id), a, { merge: true })),
    );

    localStorage.removeItem('trace_activities');
    logger.info('storage', 'Migration complete — localStorage cleared');
  } catch (e) {
    logger.warn('storage', 'Migration failed (non-fatal)', { err: String(e) });
  }
}
