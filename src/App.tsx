import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { auth } from './lib/firebase';
import { useActivities } from './hooks/useActivities';
import Tracker from './components/Tracker';
import ActivityHistory from './components/ActivityHistory';
import ReplayPlayer from './components/ReplayPlayer';
import LoginScreen from './components/LoginScreen';
import { Activity } from './types';
import { Activity as ActivityIcon, History, Loader } from 'lucide-react';
import { generateDemoActivity } from './utils/demo';
import { logger } from './utils/logger';

export default function App() {
  const [activeTab,         setActiveTab]         = useState<'record' | 'history'>('record');
  const [replayingActivity, setReplayingActivity] = useState<Activity | null>(null);
  const [user,              setUser]              = useState<User | null | 'loading'>('loading');

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

  const uid = user === 'loading' || user === null ? null : user.uid;
  const { activities, saveActivity, renameActivity, deleteActivity, syncing } = useActivities(uid);

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

  if (user === 'loading') {
    return (
      <div className="flex items-center justify-center h-screen bg-[#0a0a0a]">
        <div className="flex flex-col items-center gap-3">
          <Loader className="w-7 h-7 text-[#ff4500] animate-spin" />
          <p className="text-[#444] text-sm font-medium tracking-wide">Loading…</p>
        </div>
      </div>
    );
  }

  if (user === null) {
    return <LoginScreen />;
  }

  const initial = (user.email?.[0] ?? user.displayName?.[0] ?? '?').toUpperCase();

  return (
    <div className="flex flex-col h-screen bg-[#0a0a0a] text-white overflow-hidden">
      {/* Main content — padded bottom so content never hides behind nav */}
      <div className="flex-1 relative overflow-hidden pb-24">
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

        {replayingActivity && (
          <ReplayPlayer
            activity={replayingActivity}
            onClose={() => setReplayingActivity(null)}
          />
        )}
      </div>

      {/* Floating pill navigation */}
      <div className="fixed bottom-0 left-0 right-0 z-20 flex justify-center pb-safe pointer-events-none">
        <div className="flex bg-[#161616] border border-white/[0.08] rounded-full px-1.5 py-1.5 gap-1 shadow-[0_8px_40px_rgba(0,0,0,0.8)] pointer-events-auto">
          <button
            onClick={() => setActiveTab('record')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold transition-all duration-200 ${
              activeTab === 'record'
                ? 'bg-[#ff4500] text-white shadow-[0_0_20px_rgba(255,69,0,0.35)]'
                : 'text-[#555] hover:text-white'
            }`}
          >
            <ActivityIcon className="w-4 h-4" />
            Record
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold transition-all duration-200 ${
              activeTab === 'history'
                ? 'bg-[#ff4500] text-white shadow-[0_0_20px_rgba(255,69,0,0.35)]'
                : 'text-[#555] hover:text-white'
            }`}
          >
            <History className="w-4 h-4" />
            History
          </button>

          {/* Avatar / sign-out */}
          <button
            onClick={handleSignOut}
            title={`Sign out (${user.email ?? user.displayName ?? 'user'})`}
            className="flex items-center justify-center px-3 py-2.5 rounded-full text-[#555] hover:text-rose-400 transition-colors group"
          >
            {user.photoURL ? (
              <img src={user.photoURL} alt="" className="w-6 h-6 rounded-full ring-1 ring-white/10 group-hover:ring-rose-500/40 transition-all" />
            ) : (
              <div className="w-6 h-6 rounded-full bg-[#ff4500] text-white text-[10px] font-bold flex items-center justify-center">
                {initial}
              </div>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
