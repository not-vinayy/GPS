import React, { useState, useEffect, useRef } from 'react';
import MapView from './MapView';
import StatsPanel from './StatsPanel';
import { Coordinate, Activity } from '../types';
import { calculateDistance, calculateSpeed } from '../utils/geo';

interface TrackerProps {
  onSaveActivity: (activity: Activity) => void;
}

export default function Tracker({ onSaveActivity }: TrackerProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [coordinates, setCoordinates] = useState<Coordinate[]>([]);
  const [currentLocation, setCurrentLocation] = useState<Coordinate | null>(null);
  const [distance, setDistance] = useState(0);
  const [duration, setDuration] = useState(0);
  const [elevationGain, setElevationGain] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const watchIdRef = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);

  // Get initial location
  useEffect(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setCurrentLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            altitude: position.coords.altitude,
            timestamp: position.timestamp,
          });
        },
        (err) => {
          console.error('Error getting initial location:', err);
          setError('Could not get your location. Please check permissions.');
        },
        { enableHighAccuracy: true }
      );
    } else {
      setError('Geolocation is not supported by your browser.');
    }
  }, []);

  const startTracking = () => {
    if (!('geolocation' in navigator)) {
      setError('Geolocation is not supported by your browser.');
      return;
    }

    setError(null);
    setCoordinates([]);
    setDistance(0);
    setDuration(0);
    setElevationGain(0);
    setIsRecording(true);

    // Start timer
    timerRef.current = window.setInterval(() => {
      setDuration((prev) => prev + 1);
    }, 1000);

    // Start GPS tracking
    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        // Ignore inaccurate readings to stabilize GPS tracing
        if (position.coords.accuracy > 20) return;

        const newCoord: Coordinate = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          altitude: position.coords.altitude,
          timestamp: position.timestamp,
        };

        setCurrentLocation(newCoord);

        setCoordinates((prev) => {
          // If we have previous coordinates, add distance
          if (prev.length > 0) {
            const lastCoord = prev[prev.length - 1];
            const dist = calculateDistance(lastCoord, newCoord);
            
            // Only add if we moved more than 5 meters to avoid GPS jitter
            if (dist > 0.005) {
              setDistance((d) => d + dist);
              
              // Calculate elevation gain
              if (lastCoord.altitude !== null && newCoord.altitude !== null) {
                const altDiff = newCoord.altitude - lastCoord.altitude;
                // Only count positive elevation changes to avoid jitter
                if (altDiff > 0.5) {
                  setElevationGain((e) => e + altDiff);
                }
              }
              
              return [...prev, newCoord];
            }
            return prev;
          }
          return [newCoord];
        });
      },
      (err) => {
        console.error('Error watching position:', err);
        setError('Lost GPS signal or permission denied.');
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 5000,
      }
    );
  };

  const stopTracking = () => {
    setIsRecording(false);

    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    // Save activity if we have data
    if (coordinates.length > 1 && distance > 0) {
      const activity: Activity = {
        id: Date.now().toString(),
        timestamp: coordinates[0].timestamp,
        coordinates,
        distance,
        duration,
        elevationGain,
      };
      onSaveActivity(activity);
    }
  };

  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
      if (timerRef.current !== null) clearInterval(timerRef.current);
    };
  }, []);

  const speed = calculateSpeed(distance, duration);

  return (
    <div className="flex flex-col w-full h-full bg-slate-50">
      {error && (
        <div className="bg-rose-100 text-rose-800 px-4 py-3 text-center text-sm shadow-sm z-10 relative m-4 rounded-2xl border border-rose-200">
          {error}
        </div>
      )}
      
      <div className="flex-1 relative rounded-b-3xl overflow-hidden shadow-sm z-0">
        <MapView coordinates={coordinates} currentLocation={currentLocation} />
      </div>
      
      <div className="z-10 relative">
        <StatsPanel
          distance={distance}
          duration={duration}
          speed={speed}
          altitude={currentLocation?.altitude ?? null}
          isRecording={isRecording}
          onStart={startTracking}
          onStop={stopTracking}
        />
      </div>
    </div>
  );
}
