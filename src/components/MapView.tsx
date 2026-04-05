import React, { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import { Coordinate } from '../types';
import { calculateBearing } from '../utils/geo';
import { Layers, Box } from 'lucide-react';

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
          attribution: 'Tiles &copy; Esri',
        },
      },
      layers: [
        {
          id: 'simple-tiles',
          type: 'raster',
          source: 'raster-tiles',
          minzoom: 0,
          maxzoom: 19,
        },
      ],
    } as maplibregl.StyleSpecification,
  },
};

type MapStyle = keyof typeof TILE_LAYERS;

const STYLE_DOTS: Record<MapStyle, string> = {
  dark:      '#1a1a2e',
  light:     '#e8e8e0',
  streets:   '#d4a853',
  satellite: '#2d5a1b',
};

interface MapViewProps {
  coordinates: Coordinate[];
  currentLocation: Coordinate | null;
  isReplaying?: boolean;
  bearing?: number;
  pitch?: number;
  zoom?: number;
}

function addRouteLayers(map: maplibregl.Map, coords: [number, number][]) {
  if (!map.getSource('route')) {
    map.addSource('route', {
      type: 'geojson',
      data: {
        type: 'Feature',
        properties: {},
        geometry: { type: 'LineString', coordinates: coords },
      },
    });
  }

  if (!map.getLayer('route-glow')) {
    map.addLayer({
      id: 'route-glow',
      type: 'line',
      source: 'route',
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': '#ff4500',
        'line-width': 14,
        'line-opacity': 0.25,
        'line-blur': 8,
      },
    });
  }

  if (!map.getLayer('route')) {
    map.addLayer({
      id: 'route',
      type: 'line',
      source: 'route',
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': '#ff4500',
        'line-width': 5,
        'line-opacity': 1,
      },
    });
  }
}

export default function MapView({
  coordinates,
  currentLocation,
  isReplaying = false,
  bearing = 0,
  pitch = 0,
  zoom = 15,
}: MapViewProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map          = useRef<maplibregl.Map | null>(null);
  const marker       = useRef<maplibregl.Marker | null>(null);
  const [mapStyle, setMapStyle] = useState<MapStyle>('dark');
  const [mapLoaded, setMapLoaded] = useState(false);
  const [showMenu,  setShowMenu]  = useState(false);
  const [is3D,      setIs3D]      = useState(false);

  // Keep a ref to latest coordinates so style-switch handler can access them
  const coordinatesRef = useRef(coordinates);
  useEffect(() => { coordinatesRef.current = coordinates; }, [coordinates]);

  // ── Initial map setup ────────────────────────────────────────────────────
  useEffect(() => {
    if (map.current || !mapContainer.current) return;

    const initialCenter: [number, number] = currentLocation
      ? [currentLocation.lng, currentLocation.lat]
      : [-122.4194, 37.7749];

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: TILE_LAYERS[mapStyle].style,
      center: initialCenter,
      zoom,
      pitch,
      bearing,
      attributionControl: false,
    });

    map.current.addControl(new maplibregl.AttributionControl({ compact: true }));

    map.current.on('load', () => {
      if (!map.current) return;

      addRouteLayers(map.current, coordinatesRef.current.map(c => [c.lng, c.lat]));

      // Location dot
      const el = document.createElement('div');
      el.style.cssText = `
        width: 14px; height: 14px;
        background: #4fc3f7;
        border-radius: 50%;
        box-shadow: 0 0 0 3px rgba(79,195,247,0.25), 0 2px 6px rgba(0,0,0,0.4);
      `;
      if (!isReplaying) {
        el.style.animation = 'pulse 2s cubic-bezier(0.4,0,0.6,1) infinite';
      }

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

  // ── Style switching — use style.load to reliably re-add layers ───────────
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    map.current.setStyle(TILE_LAYERS[mapStyle].style);

    map.current.once('idle', () => {
      if (!map.current) return;
      addRouteLayers(map.current, coordinatesRef.current.map(c => [c.lng, c.lat]));
    });
  }, [mapStyle]);

  // ── Update route + marker position ──────────────────────────────────────
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    const geojsonCoords = coordinates.map(c => [c.lng, c.lat]) as [number, number][];

    // If a style switch wiped the source (race condition on satellite's inline style),
    // re-add everything rather than silently skipping.
    if (!map.current.getSource('route')) {
      if (map.current.isStyleLoaded()) {
        addRouteLayers(map.current, geojsonCoords);
      }
      // Either way, bail — the source isn't ready yet; the style.load callback will add it.
      return;
    }

    const source = map.current.getSource('route') as maplibregl.GeoJSONSource;
    source.setData({
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'LineString',
        coordinates: geojsonCoords,
      },
    });

    if (currentLocation && marker.current) {
      marker.current.setLngLat([currentLocation.lng, currentLocation.lat]);

      if (isReplaying) {
        map.current.jumpTo({
          center: [currentLocation.lng, currentLocation.lat],
          bearing,
          pitch,
          zoom,
        });
      } else if (is3D && coordinates.length >= 2) {
        // Follow direction of travel in 3D
        const prev = coordinates[coordinates.length - 2];
        const curr = coordinates[coordinates.length - 1];
        const travelBearing = calculateBearing(prev, curr);
        map.current.easeTo({
          center: [currentLocation.lng, currentLocation.lat],
          bearing: travelBearing,
          pitch: 60,
          zoom: 17.5,
          duration: 1000,
        });
      } else {
        map.current.easeTo({
          center: [currentLocation.lng, currentLocation.lat],
          bearing: 0,
          pitch: 0,
          zoom: 15,
          duration: 800,
        });
      }
    }
  }, [coordinates, currentLocation, isReplaying, bearing, pitch, zoom, mapLoaded, is3D]);

  const handleStyleSelect = (key: MapStyle) => {
    setMapStyle(key);
    setShowMenu(false);
  };

  return (
    <div className="w-full h-full z-0 relative">
      {/* Style picker */}
      <div className={`absolute z-[1000] ${isReplaying ? 'top-20' : 'top-4'} right-4`}>
        {/* Toggle button */}
        <button
          onClick={() => setShowMenu(s => !s)}
          className="w-10 h-10 bg-black/60 backdrop-blur-md rounded-full flex items-center justify-center border border-white/10 hover:border-white/25 transition-all shadow-lg"
          aria-label="Map style"
        >
          <Layers className="w-4 h-4 text-white/80" />
        </button>

        {/* Dropdown */}
        {showMenu && (
          <div className="absolute top-12 right-0 bg-[#111]/95 backdrop-blur-xl border border-white/[0.08] rounded-2xl overflow-hidden shadow-2xl w-[130px]">
            {/* 3D toggle — only in live tracking, not replay */}
            {!isReplaying && (
              <>
                <button
                  onClick={() => setIs3D(v => !v)}
                  className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm font-medium text-left transition-colors ${
                    is3D
                      ? 'text-[#ff4500] bg-[#ff4500]/10'
                      : 'text-[#777] hover:text-white hover:bg-white/[0.05]'
                  }`}
                >
                  <Box className="w-4 h-4 shrink-0" />
                  3D Follow
                  {is3D && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[#ff4500] shrink-0" />}
                </button>
                <div className="h-px bg-white/[0.06] mx-3" />
              </>
            )}

            {(Object.entries(TILE_LAYERS) as [MapStyle, { name: string }][]).map(([key, layer]) => {
              const active = mapStyle === key;
              return (
                <button
                  key={key}
                  onClick={() => handleStyleSelect(key)}
                  className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm font-medium text-left transition-colors ${
                    active
                      ? 'text-[#ff4500] bg-[#ff4500]/10'
                      : 'text-[#777] hover:text-white hover:bg-white/[0.05]'
                  }`}
                >
                  <span className="w-3 h-3 rounded-sm shrink-0" style={{ background: STYLE_DOTS[key] }} />
                  {layer.name}
                  {active && (
                    <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[#ff4500] shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div ref={mapContainer} className="w-full h-full box-border" />
    </div>
  );
}
