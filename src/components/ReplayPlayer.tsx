import React, { useState, useEffect, useRef } from 'react';
import MapView from './MapView';
import { Activity, Coordinate } from '../types';
import { formatDuration, calculateDistance, calculateSpeed, calculateBearing } from '../utils/geo';
import { X, Play, Pause, RotateCcw, Box, Map as MapIcon } from 'lucide-react';

interface ReplayPlayerProps {
  activity: Activity;
  onClose: () => void;
}

export default function ReplayPlayer({ activity, onClose }: ReplayPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentLocation, setCurrentLocation] = useState<Coordinate | null>(activity.coordinates[0] || null);
  const [drawnCoordinates, setDrawnCoordinates] = useState<Coordinate[]>([]);
  const [currentDistance, setCurrentDistance] = useState(0);
  const [currentDuration, setCurrentDuration] = useState(0);
  const [cameraMode, setCameraMode] = useState<'3d' | '2d'>('3d');

  const animationRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef<number>(0);
  const progressRef = useRef<number>(0); // 0 to 1 between current and next point
  const currentBearingRef = useRef<number>(0);
  const currentPitchRef = useRef<number>(65);
  const currentZoomRef = useRef<number>(17.5);

  // Reset state when activity changes
  useEffect(() => {
    setCurrentIndex(0);
    setCurrentLocation(activity.coordinates[0] || null);
    setDrawnCoordinates([activity.coordinates[0]]);
    setCurrentDistance(0);
    setCurrentDuration(0);
    setIsPlaying(false);
    progressRef.current = 0;
    currentBearingRef.current = 0;
    currentPitchRef.current = 65;
    currentZoomRef.current = 17.5;
  }, [activity]);

  useEffect(() => {
    if (!isPlaying) {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      return;
    }

    const animate = (time: number) => {
      if (!lastFrameTimeRef.current) lastFrameTimeRef.current = time;
      const deltaTime = time - lastFrameTimeRef.current;
      lastFrameTimeRef.current = time;

      // Animation speed multiplier (e.g., 10x real time)
      const speedMultiplier = 10;
      
      if (currentIndex < activity.coordinates.length - 1) {
        const p1 = activity.coordinates[currentIndex];
        const p2 = activity.coordinates[currentIndex + 1];
        
        // Time difference between points in ms
        const timeDiff = p2.timestamp - p1.timestamp;
        
        // If points are recorded at same time (shouldn't happen, but just in case)
        if (timeDiff <= 0) {
          setCurrentIndex(i => i + 1);
          progressRef.current = 0;
        } else {
          // Calculate how much progress to add based on delta time and real time difference
          const progressDelta = Math.max((deltaTime * speedMultiplier) / timeDiff, 0.01);
          progressRef.current += progressDelta;

          if (progressRef.current >= 1) {
            // Reached next point
            setCurrentIndex(i => i + 1);
            progressRef.current = 0;
            
            // Update stats exactly to the point
            setDrawnCoordinates(activity.coordinates.slice(0, currentIndex + 2));
            
            // Recalculate distance up to this point
            let dist = 0;
            for (let i = 1; i <= currentIndex + 1; i++) {
              dist += calculateDistance(activity.coordinates[i-1], activity.coordinates[i]);
            }
            setCurrentDistance(dist);
            setCurrentDuration(Math.floor((p2.timestamp - activity.coordinates[0].timestamp) / 1000));
            setCurrentLocation(p2);
          } else {
            // Interpolate position
            const lat = p1.lat + (p2.lat - p1.lat) * progressRef.current;
            const lng = p1.lng + (p2.lng - p1.lng) * progressRef.current;
            const altitude = (p1.altitude !== null && p2.altitude !== null) 
              ? p1.altitude + (p2.altitude - p1.altitude) * progressRef.current 
              : p1.altitude;
            
            const interpolatedCoord: Coordinate = {
              lat,
              lng,
              altitude,
              timestamp: p1.timestamp + timeDiff * progressRef.current
            };
            
            setCurrentLocation(interpolatedCoord);
            
            // Update drawn coordinates with interpolated point
            setDrawnCoordinates([...activity.coordinates.slice(0, currentIndex + 1), interpolatedCoord]);
            
            // Interpolate stats
            const segmentDist = calculateDistance(p1, p2);
            
            let baseDist = 0;
            for (let i = 1; i <= currentIndex; i++) {
              baseDist += calculateDistance(activity.coordinates[i-1], activity.coordinates[i]);
            }
            
            setCurrentDistance(baseDist + segmentDist * progressRef.current);
            setCurrentDuration(Math.floor((interpolatedCoord.timestamp - activity.coordinates[0].timestamp) / 1000));

            // Dynamic Camera Logic
            const targetBearing = calculateBearing(p1, p2);
            let diff = targetBearing - currentBearingRef.current;
            diff = ((diff + 540) % 360) - 180; // Normalize to -180 to 180
            
            // Only rotate if we are actually moving
            if (segmentDist > 0.0001) {
              // Smooth bearing
              currentBearingRef.current += diff * 0.08; 
              
              // Dynamic Pitch based on elevation gradient
              const altDiff = (p2.altitude || 0) - (p1.altitude || 0);
              const gradient = altDiff / (segmentDist * 1000); // m / m
              const targetPitch = Math.min(80, Math.max(45, 65 + gradient * 100));
              currentPitchRef.current += (targetPitch - currentPitchRef.current) * 0.05;

              // Dynamic Zoom based on speed
              const currentSpeedKmH = calculateSpeed(segmentDist, timeDiff / 1000);
              const targetZoom = Math.max(15.5, 18 - (currentSpeedKmH / 40));
              currentZoomRef.current += (targetZoom - currentZoomRef.current) * 0.05;
            }
          }
        }
        animationRef.current = requestAnimationFrame(animate);
      } else {
        setIsPlaying(false);
      }
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [isPlaying, currentIndex, activity]);

  const togglePlay = () => {
    if (currentIndex >= activity.coordinates.length - 1) {
      // Reset if at end
      setCurrentIndex(0);
      setDrawnCoordinates([activity.coordinates[0]]);
      setCurrentDistance(0);
      setCurrentDuration(0);
      progressRef.current = 0;
      lastFrameTimeRef.current = 0;
      currentBearingRef.current = 0;
      currentPitchRef.current = 65;
      currentZoomRef.current = 17.5;
    } else {
      lastFrameTimeRef.current = 0; // Reset frame time when resuming
    }
    setIsPlaying(!isPlaying);
  };

  const currentSpeed = calculateSpeed(currentDistance, currentDuration);

  return (
    <div className="fixed inset-0 z-50 bg-slate-50/95 backdrop-blur-md flex flex-col font-sans">
      {/* Header */}
      <div className="bg-white flex justify-between items-center shadow-sm rounded-b-3xl mx-4 mt-4 overflow-hidden z-10 border border-slate-100">
        <div className="p-4 bg-rose-50 cursor-pointer hover:bg-rose-100 transition-colors" onClick={onClose}>
          <X className="w-6 h-6 text-rose-700" />
        </div>
        <div className="flex-1 flex flex-col justify-center items-center py-2">
          <h2 className="text-xl font-bold text-slate-800 leading-none mb-1">Replay</h2>
          <span className="text-[10px] font-medium tracking-wider uppercase text-slate-400">System Active</span>
        </div>
        <div 
          className="p-4 bg-amber-50 cursor-pointer hover:bg-amber-100 transition-colors" 
          onClick={() => setCameraMode(m => m === '3d' ? '2d' : '3d')}
        >
          {cameraMode === '3d' ? <MapIcon className="w-6 h-6 text-amber-700" /> : <Box className="w-6 h-6 text-amber-700" />}
        </div>
      </div>

      {/* Map */}
      <div className="flex-1 relative bg-transparent mx-4 mt-4 rounded-3xl overflow-hidden shadow-inner border border-slate-200">
        <MapView 
          coordinates={drawnCoordinates} 
          currentLocation={currentLocation} 
          isReplaying={true} 
          bearing={cameraMode === '3d' ? currentBearingRef.current : 0}
          pitch={cameraMode === '3d' ? currentPitchRef.current : 0}
          zoom={cameraMode === '3d' ? currentZoomRef.current : 15}
        />
      </div>

      {/* Controls */}
      <div className="bg-white flex flex-col gap-4 p-6 rounded-t-3xl shadow-[0_-8px_30px_rgba(0,0,0,0.04)] mt-4 z-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-blue-50 p-3 text-center flex flex-col justify-center rounded-2xl">
            <div className="text-[10px] font-medium uppercase tracking-wider text-blue-600 mb-1">Distance</div>
            <div className="text-xl font-bold text-blue-900">{currentDistance.toFixed(2)}</div>
          </div>
          <div className="bg-slate-50 p-3 text-center flex flex-col justify-center rounded-2xl">
            <div className="text-[10px] font-medium uppercase tracking-wider text-slate-500 mb-1">Time</div>
            <div className="text-xl font-bold text-slate-800">{formatDuration(currentDuration)}</div>
          </div>
          <div className="bg-purple-50 p-3 text-center flex flex-col justify-center rounded-2xl">
            <div className="text-[10px] font-medium uppercase tracking-wider text-purple-600 mb-1">Speed</div>
            <div className="text-xl font-bold text-purple-900">{currentSpeed.toFixed(1)}</div>
          </div>
          <div className="bg-amber-50 p-3 text-center flex flex-col justify-center rounded-2xl">
            <div className="text-[10px] font-medium uppercase tracking-wider text-amber-600 mb-1">Altitude</div>
            <div className="text-xl font-bold text-amber-900">{currentLocation?.altitude !== null && currentLocation?.altitude !== undefined ? Math.round(currentLocation.altitude) : '--'}</div>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-4 px-2">
            <span className="text-xs font-medium text-slate-500 w-12">{formatDuration(currentDuration)}</span>
            <input 
              type="range" 
              min="0" 
              max="1" 
              step="0.001" 
              value={currentIndex / Math.max(1, activity.coordinates.length - 1)}
              onChange={(e) => {
                const newProgress = parseFloat(e.target.value);
                const newIndex = Math.floor(newProgress * (activity.coordinates.length - 1));
                setCurrentIndex(newIndex);
                setDrawnCoordinates(activity.coordinates.slice(0, newIndex + 1));
                
                let dist = 0;
                for (let i = 1; i <= newIndex; i++) {
                  dist += calculateDistance(activity.coordinates[i-1], activity.coordinates[i]);
                }
                setCurrentDistance(dist);
                setCurrentDuration(Math.floor((activity.coordinates[newIndex].timestamp - activity.coordinates[0].timestamp) / 1000));
                setCurrentLocation(activity.coordinates[newIndex]);
                progressRef.current = 0;
              }}
            />
            <span className="text-xs font-medium text-slate-500 w-12 text-right">{formatDuration(Math.floor(activity.duration))}</span>
          </div>
          
          <div className="flex justify-center items-center gap-6">
            <button
              onClick={() => {
                setCurrentIndex(0);
                setDrawnCoordinates([activity.coordinates[0]]);
                setCurrentDistance(0);
                setCurrentDuration(0);
                progressRef.current = 0;
                lastFrameTimeRef.current = 0;
                currentBearingRef.current = 0;
                currentPitchRef.current = 65;
                currentZoomRef.current = 17.5;
                setIsPlaying(false);
              }}
              className="p-3 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-full transition-colors"
            >
              <RotateCcw className="w-5 h-5" />
            </button>
            <button
              onClick={togglePlay}
              className="p-4 bg-emerald-300 text-emerald-900 hover:bg-emerald-400 rounded-full shadow-md hover:shadow-lg transition-all active:scale-95"
            >
              {isPlaying ? (
                <Pause className="w-6 h-6" />
              ) : (
                <Play className="w-6 h-6 ml-1" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
