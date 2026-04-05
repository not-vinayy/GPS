# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Start dev server on port 3000 (0.0.0.0)
npm run build      # Production build
npm run preview    # Preview production build
npm run lint       # Type-check only (tsc --noEmit), no test runner configured
npm run clean      # Remove dist/
```

There are no tests configured. Linting is TypeScript type-checking only.

## Environment

The app reads `GEMINI_API_KEY` from a `.env` file at the project root. Vite exposes it via `process.env.GEMINI_API_KEY` (defined in `vite.config.ts`). The `@google/genai` SDK is installed but not yet used in source files.

## Architecture

This is a React 19 + TypeScript SPA built with Vite and styled with Tailwind CSS v4.

**Data model** ([src/types.ts](src/types.ts)):
- `Coordinate` — a GPS point with `lat`, `lng`, `timestamp`, `altitude`
- `Activity` — a recorded run/workout containing an array of `Coordinate`s plus aggregated stats (`distance` in km, `duration` in seconds, `elevationGain` in meters)

**State management**: All state lives in `App.tsx`. Activities are persisted to `localStorage` under the key `strava_clone_activities`. There is no server, backend, or external state library.

**Component tree**:
- `App` — manages the two-tab layout (Record / History), activity list, and replay overlay
  - `Tracker` — live GPS recording; uses `navigator.geolocation.watchPosition`; filters GPS noise (accuracy >20m ignored, movement <5m ignored)
    - `MapView` — MapLibre GL map with CARTO tile layers (dark/light/streets/satellite); renders the route as a GeoJSON LineString with an orange glow layer
    - `StatsPanel` — live stats display and start/stop controls
  - `ActivityHistory` — list of saved activities; triggers replay
    - `MapView` (reused)
  - `ReplayPlayer` — full-screen overlay; animates playback at 10× real-time using `requestAnimationFrame`; interpolates position between GPS points; 3D/2D camera modes with dynamic bearing, pitch, and zoom

**Geo utilities** ([src/utils/geo.ts](src/utils/geo.ts)): Haversine distance, speed, bearing, and duration formatting. These are pure functions — no side effects.

**Demo data** ([src/utils/demo.ts](src/utils/demo.ts)): Generates a synthetic circular 60-point activity near Golden Gate Park, SF, for testing without GPS hardware.

**Map rendering**: MapLibre GL (`maplibre-gl`) is used for the interactive map. Leaflet and Mapbox GL are listed as dependencies but are not used in the current source.

**Path alias**: `@/` resolves to the repo root (configured in both `tsconfig.json` and `vite.config.ts`).
