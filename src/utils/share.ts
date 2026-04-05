import maplibregl from 'maplibre-gl';
import { format } from 'date-fns';
import { Activity } from '../types';
import { formatDuration, formatPace } from './geo';

const CARD_W = 600;
const CARD_H = 800;
const DPR = 2;

// Load a clean modern sans-serif font
async function loadFont(): Promise<void> {
  if (document.fonts.check('700 48px Inter')) return;
  try {
    const bold = new FontFace(
      'Inter',
      'url(https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuGkyMZhrib2Bg-4.woff2) format("woff2")',
      { weight: '700' }
    );
    const medium = new FontFace(
      'Inter',
      'url(https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuI6zMZhrib2Bg-4.woff2) format("woff2")',
      { weight: '500' }
    );
    await Promise.all([bold.load(), medium.load()]);
    document.fonts.add(bold);
    document.fonts.add(medium);
  } catch {
    // fallback to system fonts
  }
}

function drawShoeIcon(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  ctx.save();
  ctx.translate(x, y);
  const scale = size / 24;
  ctx.scale(scale, scale);
  ctx.strokeStyle = 'white';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  // Simple shoe silhouette
  ctx.moveTo(4, 16);
  ctx.lineTo(4, 20);
  ctx.lineTo(20, 20);
  ctx.lineTo(20, 16);
  ctx.moveTo(4, 16);
  ctx.bezierCurveTo(4, 12, 8, 8, 12, 8);
  ctx.lineTo(16, 8);
  ctx.bezierCurveTo(18, 8, 20, 10, 20, 12);
  ctx.lineTo(20, 16);
  ctx.stroke();
  
  // Lace lines
  ctx.beginPath();
  ctx.moveTo(10, 11);
  ctx.lineTo(14, 11);
  ctx.moveTo(10, 14);
  ctx.lineTo(14, 14);
  ctx.stroke();
  ctx.restore();
}

function drawAppLogo(ctx: CanvasRenderingContext2D, x: number, y: number, height: number) {
  ctx.save();
  ctx.fillStyle = 'white';
  ctx.font = `bold ${height}px Inter, sans-serif`;
  ctx.textAlign = 'right';
  ctx.fillText('TRACE', x, y);
  ctx.restore();
}

function formatShareDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  return `${m}m ${s}s`;
}

export async function generateShareImage(activity: Activity): Promise<string> {
  await loadFont();

  const coords = activity.coordinates;
  if (coords.length < 2) throw new Error('Not enough coordinates to render map');

  // Compute route bounding box
  const lats = coords.map(c => c.lat);
  const lngs = coords.map(c => c.lng);
  const bounds = new maplibregl.LngLatBounds(
    [Math.min(...lngs), Math.min(...lats)],
    [Math.max(...lngs), Math.max(...lats)]
  );

  // ── Render MapLibre map off-screen ──────────────────────────────────────────
  const container = document.createElement('div');
  container.style.cssText = [
    `position:fixed`,
    `top:-9999px`,
    `left:-9999px`,
    `width:${CARD_W}px`,
    `height:${CARD_H}px`,
    `overflow:hidden`,
  ].join(';');
  document.body.appendChild(container);

  let mapDataUrl: string;
  let pixelCoords: Array<{ x: number; y: number }>;

  const map = new maplibregl.Map({
    container,
    style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
    canvasContextAttributes: { preserveDrawingBuffer: true },
    attributionControl: false,
    interactive: false,
    fadeDuration: 0,
  });

  try {
    // Wait for style to load
    await new Promise<void>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('Map load timeout')), 12000);
      map.on('load', () => { clearTimeout(t); resolve(); });
    });

    // Fit map to route bounds — extra padding so route isn't flush to edges
    map.fitBounds(bounds, { padding: 90, animate: false });

    // Wait for tiles to fully render
    await Promise.race([
      new Promise<void>(resolve => map.once('idle', resolve)),
      new Promise<void>(resolve => setTimeout(resolve, 7000)),
    ]);

    // Capture the WebGL canvas
    mapDataUrl = map.getCanvas().toDataURL('image/png');

    // Project each coordinate to pixel space (CSS pixels, 0–CARD_W range)
    pixelCoords = coords.map(c => {
      const pt = map.project([c.lng, c.lat]);
      return { x: pt.x, y: pt.y };
    });
  } finally {
    map.remove();
    document.body.removeChild(container);
  }

  // ── Composite canvas ────────────────────────────────────────────────────────
  const canvas = document.createElement('canvas');
  canvas.width = CARD_W * DPR;
  canvas.height = CARD_H * DPR;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(DPR, DPR);

  // Load captured map image
  const mapImg = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = mapDataUrl;
  });

  // ── 1. Map background ───────────────────────────────────────────────────────
  ctx.drawImage(mapImg, 0, 0, CARD_W, CARD_H);

  // ── 2. Linear Gradient Overlay (Better readability for text) ───────────────
  const overlay = ctx.createLinearGradient(0, CARD_H * 0.3, 0, CARD_H);
  overlay.addColorStop(0, 'rgba(0,0,0,0)');
  overlay.addColorStop(1, 'rgba(0,0,0,0.85)');
  ctx.fillStyle = overlay;
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  // ── 3. Route polyline ───────────────────────────────────────────────────────
  const step = Math.max(1, Math.floor(pixelCoords.length / 400));
  const pts = pixelCoords.filter((i, idx) => idx % step === 0);

  const tracePath = () => {
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  };

  // Reddish-orange route with glow
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  
  // Outer glow
  tracePath();
  ctx.strokeStyle = 'rgba(252, 76, 2, 0.3)';
  ctx.lineWidth = 8;
  ctx.stroke();

  // Core line
  tracePath();
  ctx.strokeStyle = '#fc4c02';
  ctx.lineWidth = 3.5;
  ctx.stroke();

  // ── 4. Content ──────────────────────────────────────────────────────────────
  const margin = 50;
  const contentY = CARD_H - 240;

  // Icons at the top of content area
  drawShoeIcon(ctx, margin, contentY - 40, 32);
  drawAppLogo(ctx, CARD_W - margin, contentY - 14, 20);

  // Title
  ctx.fillStyle = 'white';
  ctx.textAlign = 'left';
  ctx.font = '700 36px Inter, sans-serif';
  ctx.fillText(
    activity.name ?? 'Morning Run',
    margin,
    contentY + 30
  );

  // Stats Grid
  const statsMarginTop = 60;
  const colW = (CARD_W - margin * 2) / 2;
  const subLabelFont = '500 16px Inter, sans-serif';
  const valueFont = '700 32px Inter, sans-serif';
  const unitFont = '700 20px Inter, sans-serif';

  // Helper to draw a stat
  const drawStat = (label: string, value: string, unit: string, x: number, y: number) => {
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = subLabelFont;
    ctx.fillText(label, x, y);

    ctx.fillStyle = 'white';
    ctx.font = valueFont;
    const valueW = ctx.measureText(value).width;
    ctx.fillText(value, x, y + 40);

    ctx.font = unitFont;
    ctx.fillText(unit, x + valueW + 6, y + 40);
  };

  // Row 1
  drawStat('Distance', activity.distance.toFixed(2), 'km', margin, contentY + statsMarginTop + 30);
  drawStat('Time', formatShareDuration(activity.duration), '', margin + colW, contentY + statsMarginTop + 30);

  // Row 2
  drawStat('Pace', formatPace(activity.distance, activity.duration), '/km', margin, contentY + statsMarginTop + 110);

  return canvas.toDataURL('image/png');
}

export async function shareOrDownload(dataUrl: string, fileName: string, title: string) {
  const blob = await fetch(dataUrl).then(r => r.blob());
  const file = new File([blob], fileName, { type: 'image/png' });

  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], title });
  } else {
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = fileName;
    a.click();
  }
}
