import React, { useState, useEffect } from 'react';
import Tracker from './components/Tracker';
import ActivityHistory from './components/ActivityHistory';
import ReplayPlayer from './components/ReplayPlayer';
import { Activity } from './types';
import { Activity as ActivityIcon, History } from 'lucide-react';
import { generateDemoActivity } from './utils/demo';

export default function App() {
  const [activeTab, setActiveTab] = useState<'record' | 'history'>('record');
  const [activities, setActivities] = useState<Activity[]>([]);
  const [replayingActivity, setReplayingActivity] = useState<Activity | null>(null);

  // Load activities from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('strava_clone_activities');
    if (saved) {
      try {
        setActivities(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to parse activities from localStorage', e);
      }
    }
  }, []);

  const handleSaveActivity = (activity: Activity) => {
    const newActivities = [activity, ...activities];
    setActivities(newActivities);
    localStorage.setItem('strava_clone_activities', JSON.stringify(newActivities));
    setActiveTab('history');
  };

  const handleAddDemo = () => {
    const demoActivity = generateDemoActivity();
    handleSaveActivity(demoActivity);
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50 text-slate-800 overflow-hidden font-sans">
      {/* Main Content Area */}
      <div className="flex-1 relative overflow-hidden bg-slate-50">
        {activeTab === 'record' ? (
          <Tracker onSaveActivity={handleSaveActivity} />
        ) : (
          <ActivityHistory 
            activities={activities} 
            onReplay={(activity) => setReplayingActivity(activity)} 
            onAddDemo={handleAddDemo}
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

      {/* Material Navigation */}
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
      </div>
    </div>
  );
}
