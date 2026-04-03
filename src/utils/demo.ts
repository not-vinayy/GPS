import { Activity, Coordinate } from '../types';
import { calculateDistance } from './geo';

export function generateDemoActivity(): Activity {
  const points = 60;
  const coordinates: Coordinate[] = [];
  const startTime = Date.now() - 86400000; // 1 day ago
  
  // Starting near Golden Gate Park, SF
  const centerLat = 37.7694;
  const centerLng = -122.4862;
  const radius = 0.005; // Roughly 500m radius

  for (let i = 0; i < points; i++) {
    // Create a nice loop
    const angle = (i / points) * Math.PI * 2;
    
    // Add some slight noise for realism
    const noiseLat = (Math.random() - 0.5) * 0.0005;
    const noiseLng = (Math.random() - 0.5) * 0.0005;

    const lat = centerLat + Math.sin(angle) * radius + noiseLat;
    const lng = centerLng + Math.cos(angle) * radius + noiseLng;
    
    // Simulate some hills
    const altitude = 50 + Math.sin(angle * 2) * 15 + Math.random() * 2;

    coordinates.push({
      lat,
      lng,
      altitude,
      timestamp: startTime + i * 10000, // 10 seconds between points (10 mins total)
    });
  }

  let distance = 0;
  let elevationGain = 0;
  for (let i = 1; i < coordinates.length; i++) {
    distance += calculateDistance(coordinates[i-1], coordinates[i]);
    const altDiff = (coordinates[i].altitude || 0) - (coordinates[i-1].altitude || 0);
    if (altDiff > 0.5) elevationGain += altDiff;
  }

  return {
    id: 'demo-' + Date.now(),
    timestamp: startTime,
    coordinates,
    distance,
    duration: points * 10, // 600 seconds = 10 minutes
    elevationGain
  };
}
