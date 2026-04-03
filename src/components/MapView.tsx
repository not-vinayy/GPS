import React, { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import { Coordinate } from '../types';
import { Layers } from 'lucide-react';

const TILE_LAYERS = {
  dark: {
    name: 'Dark',
    style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
  },
  light: {
    name: 'Light',
    style: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
  },
  streets: {
    name: 'Streets',
    style: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
  },
  satellite: {
    name: 'Satellite',
    style: {
      version: 8,
      sources: {
        'raster-tiles': {
          type: 'raster',
          tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
          tileSize: 256,
          attribution: 'Tiles &copy; Esri'
        }
      },
      layers: [
        {
          id: 'simple-tiles',
          type: 'raster',
          source: 'raster-tiles',
          minzoom: 0,
          maxzoom: 19
        }
      ]
    } as maplibregl.StyleSpecification
  }
};

type MapStyle = keyof typeof TILE_LAYERS;

interface MapViewProps {
  coordinates: Coordinate[];
  currentLocation: Coordinate | null;
  isReplaying?: boolean;
  bearing?: number;
  pitch?: number;
  zoom?: number;
}

export default function MapView({ 
  coordinates, 
  currentLocation, 
  isReplaying = false, 
  bearing = 0, 
  pitch = 0, 
  zoom = 15 
}: MapViewProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const marker = useRef<maplibregl.Marker | null>(null);
  const [mapStyle, setMapStyle] = useState<MapStyle>('dark');
  const [mapLoaded, setMapLoaded] = useState(false);

  useEffect(() => {
    if (map.current || !mapContainer.current) return;

    const initialCenter: [number, number] = currentLocation 
      ? [currentLocation.lng, currentLocation.lat]
      : [-122.4194, 37.7749];

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: TILE_LAYERS[mapStyle].style,
      center: initialCenter,
      zoom: zoom,
      pitch: pitch,
      bearing: bearing,
      attributionControl: false,
    });

    map.current.addControl(new maplibregl.AttributionControl({ compact: true }));

    map.current.on('load', () => {
      if (!map.current) return;

      map.current.addSource('route', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: [],
          },
        },
      });

      map.current.addLayer({
        id: 'route-glow',
        type: 'line',
        source: 'route',
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
        },
        paint: {
          'line-color': '#fc4c02',
          'line-width': 12,
          'line-opacity': 0.3,
          'line-blur': 8,
        },
      });

      map.current.addLayer({
        id: 'route',
        type: 'line',
        source: 'route',
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
        },
        paint: {
          'line-color': '#fc4c02',
          'line-width': 5,
          'line-opacity': 1,
        },
      });

      const el = document.createElement('div');
      // Material marker: a soft blue dot with a pulsing semi-transparent ring
      el.className = `w-4 h-4 bg-blue-400 rounded-full shadow-[0_0_0_4px_rgba(96,165,250,0.3)] ${!isReplaying ? 'animate-pulse' : ''}`;

      marker.current = new maplibregl.Marker({ element: el })
        .setLngLat(initialCenter)
        .addTo(map.current);

      setMapLoaded(true);
    });

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []);

  // Handle style change
  useEffect(() => {
    if (map.current && map.current.isStyleLoaded()) {
      map.current.setStyle(TILE_LAYERS[mapStyle].style);
      
      // Re-add source and layer after style loads
      map.current.once('styledata', () => {
        if (!map.current) return;
        if (!map.current.getSource('route')) {
          map.current.addSource('route', {
            type: 'geojson',
            data: {
              type: 'Feature',
              properties: {},
              geometry: {
                type: 'LineString',
                coordinates: coordinates.map(c => [c.lng, c.lat]),
              },
            },
          });

          map.current.addLayer({
            id: 'route-glow',
            type: 'line',
            source: 'route',
            layout: {
              'line-join': 'round',
              'line-cap': 'round',
            },
            paint: {
              'line-color': '#fc4c02',
              'line-width': 12,
              'line-opacity': 0.3,
              'line-blur': 8,
            },
          });

          map.current.addLayer({
            id: 'route',
            type: 'line',
            source: 'route',
            layout: {
              'line-join': 'round',
              'line-cap': 'round',
            },
            paint: {
              'line-color': '#fc4c02',
              'line-width': 5,
              'line-opacity': 1,
            },
          });
        }
      });
    }
  }, [mapStyle]);

  // Update route and marker
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    const geojsonCoords = coordinates.map((c) => [c.lng, c.lat]);

    const source = map.current.getSource('route') as maplibregl.GeoJSONSource;
    if (source) {
      source.setData({
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates: geojsonCoords,
        },
      });
    }

    if (currentLocation && marker.current) {
      marker.current.setLngLat([currentLocation.lng, currentLocation.lat]);
      
      if (isReplaying) {
        map.current.jumpTo({
          center: [currentLocation.lng, currentLocation.lat],
          bearing: bearing,
          pitch: pitch,
          zoom: zoom
        });
      } else {
        map.current.easeTo({
          center: [currentLocation.lng, currentLocation.lat],
          duration: 1000,
        });
      }
    }
  }, [coordinates, currentLocation, isReplaying, bearing, pitch, zoom, mapLoaded]);

  return (
    <div className="w-full h-full z-0 relative">
      {/* Layer Switcher */}
      <div className={`absolute ${isReplaying ? 'top-4' : 'top-4'} right-4 z-[1000] bg-white/90 backdrop-blur-md border border-slate-200 p-1 flex flex-col shadow-md rounded-2xl overflow-hidden`}>
        <div className="p-2 bg-slate-50 flex justify-center items-center border-b border-slate-100">
          <Layers className="w-4 h-4 text-slate-500" />
        </div>
        <div className="flex flex-col">
          {Object.entries(TILE_LAYERS).map(([key, layer], index) => (
            <button
              key={key}
              onClick={() => setMapStyle(key as MapStyle)}
              className={`px-3 py-2 text-xs font-medium transition-colors text-left ${
                mapStyle === key 
                  ? 'bg-blue-50 text-blue-700' 
                  : 'bg-transparent text-slate-600 hover:bg-slate-50'
              }`}
            >
              {layer.name}
            </button>
          ))}
        </div>
      </div>
      <div ref={mapContainer} className="w-full h-full box-border" />
    </div>
  );
}
