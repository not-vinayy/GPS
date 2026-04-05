import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { auth } from './lib/firebase';
import { useActivities } from './hooks/useActivities';
import Tracker from './components/Tracker';
import ActivityHistory from './components/ActivityHistory';
import ReplayPlayer from './components/ReplayPlayer';
import LoginScreen from './components/LoginScreen';
import { Activity } from './types';
import { Activity as ActivityIcon, History, LogOut, Loader } from 'lucide-react';
import { generateDemoActivity } from './utils/demo';
import { logger } from './utils/logger';

export default function App() {
  const [activeTab,         setActiveTab]         = useState<'record' | 'history'>('record');
  const [replayingActivity, setReplayingActivity] = useState<Activity | null>(null);
  const [user,              setUser]              = useState<User | null | 'loading'>('loading');

  // ── Auth state ────────────────────────────────────────────────────────────
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, u => {
      setUser(u);
      if (u) {
        logger.info('app', 'Auth state: signed in', { uid: u.uid, email: u.email ?? '(no email)' });
      } else {
        logger.info('app', 'Auth state: signed out');
      }
    });
    return unsub;
  }, []);

  // ── Activities (Firestore when signed in, localStorage when not) ──────────
  const uid = user === 'loading' || user === null ? null : user.uid;
  const { activities, saveActivity, renameActivity, deleteActivity, syncing } = useActivities(uid);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleSaveActivity = async (activity: Activity) => {
    await saveActivity(activity);
    setActiveTab('history');
  };

  const handleAddDemo = () => {
    saveActivity(generateDemoActivity());
    setActiveTab('history');
  };

  const handleSignOut = async () => {
    await signOut(auth);
    logger.info('app', 'User signed out');
  };

  // ── Loading splash ────────────────────────────────────────────────────────
  if (user === 'loading') {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-950">
        <Loader className="w-8 h-8 text-orange-500 animate-spin" />
      </div>
    );
  }

  // ── Unauthenticated ───────────────────────────────────────────────────────
  if (user === null) {
    return <LoginScreen />;
  }

  // ── Authenticated app ─────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-screen bg-slate-50 text-slate-800 overflow-hidden font-sans">
      {/* Main Content Area */}
      <div className="flex-1 relative overflow-hidden bg-slate-50">
        {activeTab === 'record' ? (
          <Tracker onSaveActivity={handleSaveActivity} />
        ) : (
          <ActivityHistory
            activities={activities}
            onReplay={activity => setReplayingActivity(activity)}
            onAddDemo={handleAddDemo}
            onRename={renameActivity}
            onDelete={deleteActivity}
            syncing={syncing}
          />
        )}

        {/* Replay Overlay */}
        {replayingActivity && (
          <ReplayPlayer
            activity={replayingActivity}
            onClose={() => setReplayingActivity(null)}
          />
        )}
      </div>

      {/* Navigation bar */}
      <div className="flex h-20 bg-white border-t border-slate-200 shadow-[0_-4px_20px_rgba(0,0,0,0.03)] rounded-t-3xl px-4 pb-2 pt-2 z-10 relative">
        <button
          onClick={() => setActiveTab('record')}
          className={`flex-1 flex flex-col items-center justify-center font-medium text-sm transition-all duration-300 rounded-2xl mx-1 ${
            activeTab === 'record' ? 'bg-blue-100 text-blue-700 shadow-sm' : 'bg-transparent hover:bg-slate-50 text-slate-500'
          }`}
        >
          <ActivityIcon className="w-5 h-5 mb-1" />
          Record
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={`flex-1 flex flex-col items-center justify-center font-medium text-sm transition-all duration-300 rounded-2xl mx-1 ${
            activeTab === 'history' ? 'bg-purple-100 text-purple-700 shadow-sm' : 'bg-transparent hover:bg-slate-50 text-slate-500'
          }`}
        >
          <History className="w-5 h-5 mb-1" />
          History
        </button>

        {/* User avatar + sign-out */}
        <button
          onClick={handleSignOut}
          className="flex flex-col items-center justify-center px-3 text-slate-400 hover:text-rose-500 transition-colors rounded-2xl hover:bg-rose-50 mx-1"
          title={`Signed in as ${user.email ?? user.displayName ?? 'user'}`}
        >
          {user.photoURL ? (
            <img src={user.photoURL} alt="" className="w-6 h-6 rounded-full mb-1" />
          ) : (
            <div className="w-6 h-6 rounded-full bg-orange-500 text-white text-[10px] font-bold flex items-center justify-center mb-1">
              {(user.email?.[0] ?? user.displayName?.[0] ?? '?').toUpperCase()}
            </div>
          )}
          <span className="text-[9px] font-semibold uppercase tracking-wider">
            <LogOut className="w-3 h-3 inline" />
          </span>
        </button>
      </div>
    </div>
  );
}
