export interface Coordinate {
  lat: number;
  lng: number;
  timestamp: number;
  altitude: number | null;
}

export interface Activity {
  id: string;
  name?: string;
  timestamp: number;
  coordinates: Coordinate[];
  distance: number; // in km
  duration: number; // in seconds
  elevationGain: number; // in meters
}
