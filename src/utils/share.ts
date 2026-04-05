import maplibregl from 'maplibre-gl';
import { format } from 'date-fns';
import { Activity } from '../types';
import { formatDuration, formatPace } from './geo';

const CARD_W = 600;
const CARD_H = 800;
const DPR = 2;

// Load a condensed athletic font for numbers
async function loadFont(): Promise<void> {
  if (document.fonts.check('700 48px Oswald')) return;
  try {
    const bold = new FontFace(
      'Oswald',
      'url(https://fonts.gstatic.com/s/oswald/v53/TK3_WkUHHAIjg75cFRf3bXL8LICs1_FvsUtiZTaR.woff2) format("woff2")',
      { weight: '700' }
    );
    const light = new FontFace(
      'Oswald',
      'url(https://fonts.gstatic.com/s/oswald/v53/TK3iWkUHHAIjg75cFRf3bXL8LICs1xZosUtiZSWqVw.woff2) format("woff2")',
      { weight: '300' }
    );
    await Promise.all([bold.load(), light.load()]);
    document.fonts.add(bold);
    document.fonts.add(light);
  } catch {
    // fallback to system fonts
  }
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
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

  // ── 2. Cinematic vignette (darkens edges, especially bottom) ────────────────
  // Radial edge vignette
  const radVig = ctx.createRadialGradient(
    CARD_W / 2, CARD_H * 0.42, CARD_H * 0.25,
    CARD_W / 2, CARD_H * 0.42, CARD_H * 0.8
  );
  radVig.addColorStop(0, 'rgba(0,0,0,0)');
  radVig.addColorStop(1, 'rgba(0,0,0,0.45)');
  ctx.fillStyle = radVig;
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  // Linear bottom fade (for glass panel readability)
  const botFade = ctx.createLinearGradient(0, CARD_H * 0.45, 0, CARD_H);
  botFade.addColorStop(0, 'rgba(0,0,0,0)');
  botFade.addColorStop(0.55, 'rgba(0,0,0,0.3)');
  botFade.addColorStop(1, 'rgba(0,0,0,0.72)');
  ctx.fillStyle = botFade;
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  // ── 3. Route polyline ───────────────────────────────────────────────────────
  const step = Math.max(1, Math.floor(pixelCoords.length / 400));
  const pts = pixelCoords.filter((_, i) => i % step === 0);

  const tracePath = () => {
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  };

  // Layer 1 — wide diffuse halo (canvas filter blur)
  tracePath();
  ctx.strokeStyle = 'rgba(252, 90, 20, 0.22)';
  ctx.lineWidth = 32;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.filter = 'blur(10px)';
  ctx.stroke();
  ctx.filter = 'none';

  // Layer 2 — tight glow
  tracePath();
  ctx.strokeStyle = 'rgba(252, 76, 2, 0.55)';
  ctx.lineWidth = 14;
  ctx.shadowColor = '#fc4c02';
  ctx.shadowBlur = 18;
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Layer 3 — core line
  tracePath();
  ctx.strokeStyle = '#ff7040';
  ctx.lineWidth = 3.5;
  ctx.shadowColor = '#ffb090';
  ctx.shadowBlur = 6;
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Start marker — green ring + dot
  const s = pixelCoords[0];
  ctx.beginPath();
  ctx.arc(s.x, s.y, 7, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.shadowColor = '#34d399';
  ctx.shadowBlur = 14;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.beginPath();
  ctx.arc(s.x, s.y, 4, 0, Math.PI * 2);
  ctx.fillStyle = '#34d399';
  ctx.fill();

  // End marker — orange ring + dot
  const e = pixelCoords[pixelCoords.length - 1];
  ctx.beginPath();
  ctx.arc(e.x, e.y, 7, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.shadowColor = '#fc4c02';
  ctx.shadowBlur = 14;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.beginPath();
  ctx.arc(e.x, e.y, 4, 0, Math.PI * 2);
  ctx.fillStyle = '#fc4c02';
  ctx.fill();

  // ── 4. Frosted glass stats panel ────────────────────────────────────────────
  const PAD_H = 20;                         // horizontal margin
  const panelX = PAD_H;
  const panelW = CARD_W - PAD_H * 2;
  const panelH = 198;
  const panelY = CARD_H - panelH - 22;
  const R = 26;

  // Frosted glass: clip to panel, redraw blurred map, then dark tint
  ctx.save();
  roundRect(ctx, panelX, panelY, panelW, panelH, R);
  ctx.clip();

  ctx.filter = 'blur(28px) saturate(1.4)';
  ctx.drawImage(mapImg, 0, 0, CARD_W, CARD_H);
  ctx.filter = 'none';

  // Dark-navy tinted overlay
  ctx.fillStyle = 'rgba(6, 10, 24, 0.68)';
  ctx.fillRect(panelX, panelY, panelW, panelH);

  // Subtle top-edge shimmer inside panel
  const shimmer = ctx.createLinearGradient(0, panelY, 0, panelY + 56);
  shimmer.addColorStop(0, 'rgba(255,255,255,0.07)');
  shimmer.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = shimmer;
  ctx.fillRect(panelX, panelY, panelW, panelH);

  ctx.restore();

  // Panel border
  roundRect(ctx, panelX, panelY, panelW, panelH, R);
  ctx.strokeStyle = 'rgba(255,255,255,0.13)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Orange accent line at top of panel
  ctx.fillStyle = '#fc4c02';
  const accentLen = 32;
  ctx.fillRect(panelX + 24, panelY - 1, accentLen, 2.5);

  // ── Panel content ───────────────────────────────────────────────────────────
  const cx0 = panelX + 24;   // left content start
  const useOswald = document.fonts.check('700 48px Oswald');

  // Activity name
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.textAlign = 'left';
  ctx.font = useOswald
    ? `700 20px Oswald`
    : `bold 18px -apple-system, "Helvetica Neue", sans-serif`;
  ctx.fillText(
    activity.name ?? format(new Date(activity.timestamp), 'EEEE, MMMM d'),
    cx0,
    panelY + 34
  );

  // Date
  ctx.fillStyle = 'rgba(255,255,255,0.38)';
  ctx.font = `12px -apple-system, "Helvetica Neue", sans-serif`;
  ctx.fillText(
    format(new Date(activity.timestamp), "h:mm a · MMM d, yyyy"),
    cx0,
    panelY + 52
  );

  // Branding (top-right of panel)
  const brandText = 'GPS FITNESS TRACKER';
  ctx.font = `bold 9px -apple-system, "Helvetica Neue", sans-serif`;
  const brandW = ctx.measureText(brandText).width;
  const brandRX = panelX + panelW - 24;
  const brandY = panelY + 34;

  // Orange pulse dot
  ctx.beginPath();
  ctx.arc(brandRX - brandW - 7, brandY - 4, 3.5, 0, Math.PI * 2);
  ctx.fillStyle = '#fc4c02';
  ctx.shadowColor = '#fc4c02';
  ctx.shadowBlur = 8;
  ctx.fill();
  ctx.shadowBlur = 0;

  ctx.fillStyle = 'rgba(255,255,255,0.22)';
  ctx.textAlign = 'right';
  ctx.fillText(brandText, brandRX, brandY);

  // Horizontal rule
  const ruleY = panelY + 68;
  const ruleGrad = ctx.createLinearGradient(panelX, 0, panelX + panelW, 0);
  ruleGrad.addColorStop(0, 'rgba(255,255,255,0)');
  ruleGrad.addColorStop(0.15, 'rgba(255,255,255,0.1)');
  ruleGrad.addColorStop(0.85, 'rgba(255,255,255,0.1)');
  ruleGrad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = ruleGrad;
  ctx.fillRect(panelX, ruleY, panelW, 1);

  // ── Stats 4-column grid ─────────────────────────────────────────────────────
  const stats = [
    { value: activity.distance.toFixed(2), unit: 'KM',       accent: '#60a5fa' },
    { value: formatPace(activity.distance, activity.duration), unit: '/KM PACE', accent: '#c084fc' },
    { value: formatDuration(activity.duration),               unit: 'TIME',     accent: '#94a3b8' },
    { value: `${Math.round(activity.elevationGain)}`,         unit: 'M ELEV',   accent: '#fbbf24' },
  ];

  const colW = panelW / 4;
  const numY = ruleY + 56;
  const unitY = ruleY + 76;

  stats.forEach((stat, i) => {
    const colCx = panelX + colW * i + colW / 2;

    // Vertical divider (skip first)
    if (i > 0) {
      ctx.strokeStyle = 'rgba(255,255,255,0.07)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(panelX + colW * i, ruleY + 16);
      ctx.lineTo(panelX + colW * i, ruleY + 88);
      ctx.stroke();
    }

    // Number
    ctx.fillStyle = 'rgba(255,255,255,0.96)';
    ctx.textAlign = 'center';
    ctx.font = useOswald
      ? `700 34px Oswald`
      : `bold 28px "Helvetica Neue", Arial, sans-serif`;
    ctx.fillText(stat.value, colCx, numY);

    // Unit label
    ctx.fillStyle = stat.accent;
    ctx.font = `bold 9px -apple-system, "Helvetica Neue", sans-serif`;
    ctx.fillText(stat.unit, colCx, unitY);
  });

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
