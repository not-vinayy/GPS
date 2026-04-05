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
  const [speed, setSpeed] = useState(10);
  const SPEEDS = [1, 2, 5, 10, 20, 50];
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentLocation, setCurrentLocation] = useState<Coordinate | null>(activity.coordinates[0] || null);
  const [drawnCoordinates, setDrawnCoordinates] = useState<Coordinate[]>([]);
  const [currentDistance, setCurrentDistance] = useState(0);
  const [currentDuration, setCurrentDuration] = useState(0);
  const [cameraMode, setCameraMode] = useState<'3d' | '2d'>('3d');

  const animationRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef<number>(0);
  const progressRef = useRef<number>(0);
  const currentBearingRef = useRef<number>(0);
  const currentPitchRef = useRef<number>(65);
  const currentZoomRef = useRef<number>(17.5);

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

      const speedMultiplier = speed;

      if (currentIndex < activity.coordinates.length - 1) {
        const p1 = activity.coordinates[currentIndex];
        const p2 = activity.coordinates[currentIndex + 1];
        const timeDiff = p2.timestamp - p1.timestamp;

        if (timeDiff <= 0) {
          setCurrentIndex(i => i + 1);
          progressRef.current = 0;
        } else {
          const progressDelta = Math.max((deltaTime * speedMultiplier) / timeDiff, 0.01);
          progressRef.current += progressDelta;

          if (progressRef.current >= 1) {
            setCurrentIndex(i => i + 1);
            progressRef.current = 0;
            setDrawnCoordinates(activity.coordinates.slice(0, currentIndex + 2));
            let dist = 0;
            for (let i = 1; i <= currentIndex + 1; i++) {
              dist += calculateDistance(activity.coordinates[i-1], activity.coordinates[i]);
            }
            setCurrentDistance(dist);
            setCurrentDuration(Math.floor((p2.timestamp - activity.coordinates[0].timestamp) / 1000));
            setCurrentLocation(p2);
          } else {
            const lat = p1.lat + (p2.lat - p1.lat) * progressRef.current;
            const lng = p1.lng + (p2.lng - p1.lng) * progressRef.current;
            const altitude = (p1.altitude !== null && p2.altitude !== null)
              ? p1.altitude + (p2.altitude - p1.altitude) * progressRef.current
              : p1.altitude;

            const interpolatedCoord: Coordinate = {
              lat, lng, altitude,
              timestamp: p1.timestamp + timeDiff * progressRef.current,
            };

            setCurrentLocation(interpolatedCoord);
            setDrawnCoordinates([...activity.coordinates.slice(0, currentIndex + 1), interpolatedCoord]);

            const segmentDist = calculateDistance(p1, p2);
            let baseDist = 0;
            for (let i = 1; i <= currentIndex; i++) {
              baseDist += calculateDistance(activity.coordinates[i-1], activity.coordinates[i]);
            }
            setCurrentDistance(baseDist + segmentDist * progressRef.current);
            setCurrentDuration(Math.floor((interpolatedCoord.timestamp - activity.coordinates[0].timestamp) / 1000));

            const targetBearing = calculateBearing(p1, p2);
            let diff = targetBearing - currentBearingRef.current;
            diff = ((diff + 540) % 360) - 180;

            if (segmentDist > 0.0001) {
              currentBearingRef.current += diff * 0.08;
              const altDiff = (p2.altitude || 0) - (p1.altitude || 0);
              const gradient = altDiff / (segmentDist * 1000);
              const targetPitch = Math.min(80, Math.max(45, 65 + gradient * 100));
              currentPitchRef.current += (targetPitch - currentPitchRef.current) * 0.05;
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
    return () => { if (animationRef.current) cancelAnimationFrame(animationRef.current); };
  }, [isPlaying, currentIndex, activity, speed]);

  const togglePlay = () => {
    if (currentIndex >= activity.coordinates.length - 1) {
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
      lastFrameTimeRef.current = 0;
    }
    setIsPlaying(!isPlaying);
  };

  const handleReset = () => {
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
  };

  const currentAlt = currentLocation?.altitude;
  const currentSpeed = calculateSpeed(currentDistance, currentDuration);
  const progress = currentIndex / Math.max(1, activity.coordinates.length - 1);

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Map — full screen */}
      <div className="flex-1 relative">
        <MapView
          coordinates={drawnCoordinates}
          currentLocation={currentLocation}
          isReplaying={true}
          bearing={cameraMode === '3d' ? currentBearingRef.current : 0}
          pitch={cameraMode === '3d' ? currentPitchRef.current : 0}
          zoom={cameraMode === '3d' ? currentZoomRef.current : 15}
        />

        {/* Floating top bar */}
        <div className="absolute top-4 left-4 right-4 flex items-center justify-between pointer-events-none">
          <button
            onClick={onClose}
            className="pointer-events-auto w-10 h-10 bg-black/60 backdrop-blur-md rounded-full flex items-center justify-center border border-white/10 hover:border-white/20 transition-colors"
          >
            <X className="w-5 h-5 text-white" />
          </button>

          <div className="bg-black/60 backdrop-blur-md rounded-full px-4 py-2 border border-white/10">
            <span className="text-[11px] font-semibold tracking-[0.2em] text-white/60 uppercase">Replay</span>
          </div>

          <button
            onClick={() => setCameraMode(m => m === '3d' ? '2d' : '3d')}
            className="pointer-events-auto w-10 h-10 bg-black/60 backdrop-blur-md rounded-full flex items-center justify-center border border-white/10 hover:border-[#ff4500]/40 transition-colors"
          >
            {cameraMode === '3d'
              ? <MapIcon className="w-5 h-5 text-[#ff4500]" />
              : <Box className="w-5 h-5 text-[#ff4500]" />
            }
          </button>
        </div>
      </div>

      {/* Floating bottom controls */}
      <div className="bg-[#0e0e0e]/95 backdrop-blur-xl border-t border-white/[0.06] px-4 pt-4 pb-5">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          {[
            { label: 'DIST', value: currentDistance.toFixed(2), unit: 'km', accent: true },
            { label: 'TIME', value: formatDuration(currentDuration), unit: '', accent: false },
            { label: 'SPD',  value: currentSpeed.toFixed(1),       unit: 'km/h', accent: false },
            { label: 'ALT',  value: currentAlt !== null && currentAlt !== undefined ? String(Math.round(currentAlt)) : '--', unit: 'm', accent: false },
          ].map(stat => (
            <div key={stat.label} className="bg-[#1a1a1a] rounded-xl p-2.5 flex flex-col items-center">
              <span className="text-[9px] font-semibold uppercase tracking-[0.15em] text-[#444] mb-1">{stat.label}</span>
              <span
                className="font-barlow text-xl font-bold leading-none tabular-nums"
                style={{ color: stat.accent ? '#ff4500' : '#e5e5e5' }}
              >
                {stat.value}
              </span>
              {stat.unit && <span className="text-[9px] text-[#333] mt-0.5">{stat.unit}</span>}
            </div>
          ))}
        </div>

        {/* Progress scrubber */}
        <div className="flex items-center gap-3 mb-4 px-1">
          <span className="font-barlow text-xs text-[#555] tabular-nums w-10">{formatDuration(currentDuration)}</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.001"
            value={progress}
            onChange={e => {
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
            className="flex-1"
          />
          <span className="font-barlow text-xs text-[#555] tabular-nums w-10 text-right">{formatDuration(Math.floor(activity.duration))}</span>
        </div>

        {/* Controls */}
        <div className="flex justify-center items-center gap-5">
          <button
            onClick={handleReset}
            className="w-11 h-11 bg-[#1a1a1a] rounded-full flex items-center justify-center text-[#555] hover:text-white hover:bg-[#222] transition-colors border border-white/[0.06]"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <button
            onClick={togglePlay}
            className="w-16 h-16 bg-[#ff4500] rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(255,69,0,0.3)] hover:bg-[#e03d00] transition-all active:scale-95"
          >
            {isPlaying
              ? <Pause className="w-6 h-6 text-white" />
              : <Play className="w-6 h-6 text-white ml-0.5" />
            }
          </button>

          {/* Speed cycle button */}
          <button
            onClick={() => setSpeed(s => SPEEDS[(SPEEDS.indexOf(s) + 1) % SPEEDS.length])}
            className="w-11 h-11 bg-[#1a1a1a] rounded-full flex items-center justify-center hover:bg-[#222] transition-colors border border-white/[0.06]"
          >
            <span className="font-barlow text-sm font-bold text-[#ff4500]">{speed}×</span>
          </button>
        </div>
      </div>
    </div>
  );
}
