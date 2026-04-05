import React, { useState, useEffect, useRef } from 'react';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import type { BackgroundGeolocationPlugin } from '@capacitor-community/background-geolocation';

// This plugin has no JS bundle — register it via the native bridge.
// On web, isNative is false so these methods are never called.
const BackgroundGeolocation = registerPlugin<BackgroundGeolocationPlugin>(
  'BackgroundGeolocation',
);
import MapView from './MapView';
import StatsPanel from './StatsPanel';
import { Coordinate, Activity } from '../types';
import { calculateDistance, calculateSpeed } from '../utils/geo';
import { logger } from '../utils/logger';

/** True when running inside the Capacitor Android/iOS shell. */
const isNative = Capacitor.isNativePlatform();
logger.info('app', 'Platform detected', { native: isNative, platform: Capacitor.getPlatform() });

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

  // Refs mirror state so stopTracking always reads the latest values,
  // even when GPS callbacks race with the stop button on Android.
  const coordsRef = useRef<Coordinate[]>([]);
  const distanceRef = useRef(0);
  const durationRef = useRef(0);
  const elevationRef = useRef(0);
  useEffect(() => { coordsRef.current = coordinates; }, [coordinates]);
  useEffect(() => { distanceRef.current = distance; }, [distance]);
  useEffect(() => { durationRef.current = duration; }, [duration]);
  useEffect(() => { elevationRef.current = elevationGain; }, [elevationGain]);

  // Watcher handles — one type per platform
  const webWatchIdRef = useRef<number | null>(null);
  const nativeWatchIdRef = useRef<string | null>(null);
  const timerRef = useRef<number | null>(null);

  // ── Process an incoming GPS fix ──────────────────────────────────────────
  const processLocation = (
    lat: number,
    lng: number,
    altitude: number | null,
    accuracy: number,
    timestamp: number,
  ) => {
    // Discard noisy fixes (>20 m accuracy)
    if (accuracy > 20) {
      logger.debug('gps', 'Fix discarded — accuracy too low', { accuracy: Math.round(accuracy) });
      return;
    }

    logger.debug('gps', 'Fix received', {
      lat: lat.toFixed(5), lng: lng.toFixed(5), accuracy: Math.round(accuracy),
    });

    const newCoord: Coordinate = { lat, lng, altitude, timestamp };
    setCurrentLocation(newCoord);

    setCoordinates(prev => {
      if (prev.length > 0) {
        const last = prev[prev.length - 1];
        const dist = calculateDistance(last, newCoord);

        // Ignore micro-movements (<5 m) to avoid GPS jitter
        if (dist > 0.005) {
          setDistance(d => d + dist);
          if (last.altitude !== null && altitude !== null) {
            const diff = altitude - last.altitude;
            if (diff > 0.5) setElevationGain(e => e + diff);
          }
          return [...prev, newCoord];
        }
        return prev;
      }
      return [newCoord];
    });
  };

  // ── Acquire initial location on mount ────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      logger.info('gps', 'Requesting initial location…', { native: isNative });
      try {
        if (isNative) {
          logger.info('permissions', 'Requesting location permission (native)');
          const perm = await Geolocation.requestPermissions();
          logger.info('permissions', 'Permission result', { location: perm.location });
          const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true });
          logger.info('gps', 'Initial location acquired', {
            lat: pos.coords.latitude.toFixed(5),
            lng: pos.coords.longitude.toFixed(5),
            accuracy: Math.round(pos.coords.accuracy),
          });
          setCurrentLocation({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            altitude: pos.coords.altitude,
            timestamp: pos.timestamp,
          });
        } else {
          if (!('geolocation' in navigator)) {
            logger.error('gps', 'navigator.geolocation not available');
            setError('Geolocation is not supported by your browser.');
            return;
          }
          navigator.geolocation.getCurrentPosition(
            pos => {
              logger.info('gps', 'Initial location acquired (web)', {
                lat: pos.coords.latitude.toFixed(5),
                lng: pos.coords.longitude.toFixed(5),
                accuracy: Math.round(pos.coords.accuracy),
              });
              setCurrentLocation({
                lat: pos.coords.latitude,
                lng: pos.coords.longitude,
                altitude: pos.coords.altitude,
                timestamp: pos.timestamp,
              });
            },
            err => {
              logger.error('gps', 'Initial location failed', { code: err.code, message: err.message });
              setError('Could not get your location. Please check permissions.');
            },
            { enableHighAccuracy: true },
          );
        }
      } catch (e) {
        logger.error('gps', 'Unexpected error getting initial location', { err: String(e) });
        setError('Could not get your location. Please check permissions.');
      }
    };
    init();
  }, []);

  // ── Start recording ───────────────────────────────────────────────────────
  const startTracking = async () => {
    logger.info('recording', 'Start recording requested', { native: isNative });
    setError(null);
    setCoordinates([]);
    setDistance(0);
    setDuration(0);
    setElevationGain(0);
    setIsRecording(true);

    timerRef.current = window.setInterval(() => setDuration(d => d + 1), 1000);

    if (isNative) {
      try {
        // Ensure we have foreground location permission before starting
        logger.info('permissions', 'Requesting location permission before recording');
        const perm = await Geolocation.requestPermissions();
        logger.info('permissions', 'Permission result', { location: perm.location });
        if (perm.location !== 'granted') {
          logger.warn('permissions', 'Location permission denied — aborting recording');
          setError('Location permission is required to record a run.');
          setIsRecording(false);
          clearInterval(timerRef.current!);
          timerRef.current = null;
          return;
        }

        // BackgroundGeolocation creates a persistent foreground-service
        // notification on Android, keeping GPS alive even when the app is
        // backgrounded or the screen is off.
        nativeWatchIdRef.current = await BackgroundGeolocation.addWatcher(
          {
            backgroundMessage: 'Tap to return to Trace.',
            backgroundTitle: 'Recording your run…',
            // The plugin will ask for ACCESS_BACKGROUND_LOCATION if needed
            requestPermissions: true,
            stale: false,
            // Only fire a callback after moving at least 5 m (mirrors web filter)
            distanceFilter: 5,
          },
          (location, err) => {
            if (err) {
              logger.error('gps', 'BackgroundGeolocation error', { code: err.code, message: err.message });
              if (err.code === 'NOT_AUTHORIZED') {
                setError('Location permission denied. Please enable it in Settings.');
                BackgroundGeolocation.openSettings();
              }
              return;
            }
            if (!location) return;
            processLocation(
              location.latitude,
              location.longitude,
              location.altitude ?? null,
              location.accuracy,
              location.time,
            );
          },
        );
        logger.info('gps', 'BackgroundGeolocation watcher started', { watcherId: nativeWatchIdRef.current });
      } catch (e) {
        logger.error('recording', 'Failed to start native GPS tracking', { err: String(e) });
        setError('Failed to start GPS tracking.');
        setIsRecording(false);
        clearInterval(timerRef.current!);
        timerRef.current = null;
      }
    } else {
      // ── Browser fallback ─────────────────────────────────────────────────
      logger.info('gps', 'Starting navigator.geolocation.watchPosition (web)');
      webWatchIdRef.current = navigator.geolocation.watchPosition(
        pos => processLocation(
          pos.coords.latitude,
          pos.coords.longitude,
          pos.coords.altitude,
          pos.coords.accuracy,
          pos.timestamp,
        ),
        err => {
          logger.error('gps', 'watchPosition error', { code: err.code, message: err.message });
          setError('Lost GPS signal or permission denied.');
        },
        { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 },
      );
      logger.info('gps', 'watchPosition started', { watchId: webWatchIdRef.current });
    }
    logger.info('recording', 'Recording started');
  };

  // ── Stop recording & save ─────────────────────────────────────────────────
  const stopTracking = async () => {
    setIsRecording(false);

    if (isNative && nativeWatchIdRef.current !== null) {
      await BackgroundGeolocation.removeWatcher({ id: nativeWatchIdRef.current });
      nativeWatchIdRef.current = null;
    } else if (!isNative && webWatchIdRef.current !== null) {
      navigator.geolocation.clearWatch(webWatchIdRef.current);
      webWatchIdRef.current = null;
    }

    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    // Read from refs to get the very latest values (guards against async lag)
    const finalCoords    = coordsRef.current;
    const finalDistance  = distanceRef.current;
    const finalDuration  = durationRef.current;
    const finalElevation = elevationRef.current;

    logger.info('recording', 'Recording stopped', {
      coords:    finalCoords.length,
      distance:  finalDistance.toFixed(3) + 'km',
      duration:  finalDuration + 's',
      elevation: finalElevation.toFixed(1) + 'm',
    });

    if (finalCoords.length > 1 && finalDistance > 0) {
      const id = Date.now().toString();
      logger.info('recording', 'Saving activity', { id, distance: finalDistance.toFixed(3), duration: finalDuration });
      onSaveActivity({
        id,
        timestamp: finalCoords[0].timestamp,
        coordinates: finalCoords,
        distance: finalDistance,
        duration: finalDuration,
        elevationGain: finalElevation,
      });
    } else {
      logger.warn('recording', 'Activity discarded — too few points or zero distance', {
        coords: finalCoords.length, distance: finalDistance,
      });
    }
  };

  // ── Cleanup on unmount ────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (isNative && nativeWatchIdRef.current !== null) {
        BackgroundGeolocation.removeWatcher({ id: nativeWatchIdRef.current! });
      } else if (!isNative && webWatchIdRef.current !== null) {
        navigator.geolocation.clearWatch(webWatchIdRef.current);
      }
      if (timerRef.current !== null) clearInterval(timerRef.current);
    };
  }, []);

  const speed = calculateSpeed(distance, duration);

  return (
    <div className="flex flex-col w-full h-full bg-[#0a0a0a]">
      {error && (
        <div className="bg-rose-950/80 text-rose-300 px-4 py-3 text-center text-sm z-10 relative m-3 rounded-2xl border border-rose-800/50 backdrop-blur-sm">
          {error}
        </div>
      )}

      <div className="flex-1 relative overflow-hidden z-0">
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
