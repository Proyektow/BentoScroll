import { addFogPoint, getAllFogPoints, getAllCaptures } from './db.js';

const canvas = document.getElementById('fog-canvas');
const ctx = canvas.getContext('2d');
const fogStatsEl = document.getElementById('fog-stats');
const gpsBtn = document.getElementById('btn-fog-gps');
const centerBtn = document.getElementById('btn-fog-center');
const zoomInBtn = document.getElementById('btn-fog-zoom-in');
const zoomOutBtn = document.getElementById('btn-fog-zoom-out');
const pinPreviewEl = document.getElementById('fog-pin-preview');

let watchId = null;
let points = [];
let captures = [];
let centerCoords = { lat: 43.2630, lng: -2.9350 }; // Bilbao por defecto hasta activar GPS
let latestCoords = null;
let zoom = 15;
let renderedPins = [];

const tileCache = new Map();

export async function renderFogMap() {
  const rect = canvas.parentElement.getBoundingClientRect();
  canvas.width = rect.width || 360;
  canvas.height = rect.height || 420;

  points = await getAllFogPoints();
  captures = await getAllCaptures();

  if (points.length > 0 && !latestCoords) {
    const last = points[points.length - 1];
    centerCoords = { lat: last.lat, lng: last.lng };
  }

  fogStatsEl.textContent = `${points.length} ZONAS · ZOOM ${zoom}x`;
  drawScene();
}

export function getLatestCoords() {
  return latestCoords;
}

function latLngToTile(lat, lng, z) {
  const n = Math.pow(2, z);
  const x = ((lng + 180) / 360) * n;
  const latRad = (lat * Math.PI) / 180;
  const y = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n;
  return { x, y };
}

function project(lat, lng) {
  const cTile = latLngToTile(centerCoords.lat, centerCoords.lng, zoom);
  const pTile = latLngToTile(lat, lng, zoom);
  return {
    x: canvas.width / 2 + (pTile.x - cTile.x) * 256,
    y: canvas.height / 2 + (pTile.y - cTile.y) * 256
  };
}

function getTileImage(tx, ty, z) {
  const key = `${z}/${tx}/${ty}`;
  if (tileCache.has(key)) return tileCache.get(key);

  const img = new Image();
  img.crossOrigin = 'anonymous';
  // Mapa minimalista blanco/gris estilo editorial
  img.src = `https://a.basemaps.cartocdn.com/light_all/${z}/${tx}/${ty}.png`;
  img.onload = () => drawScene();
  tileCache.set(key, img);
  return img;
}

function drawScene() {
  const w = canvas.width;
  const h = canvas.height;

  ctx.fillStyle = '#f4f4f2';
  ctx.fillRect(0, 0, w, h);

  // 1. Dibujar mapa real de la ciudad (tiles cacheados)
  const cTile = latLngToTile(centerCoords.lat, centerCoords.lng, zoom);
  const baseTx = Math.floor(cTile.x);
  const baseTy = Math.floor(cTile.y);
  const offsetX = (cTile.x - baseTx) * 256;
  const offsetY = (cTile.y - baseTy) * 256;

  for (let dx = -2; dx <= 2; dx++) {
    for (let dy = -2; dy <= 2; dy++) {
      const tx = baseTx + dx;
      const ty = baseTy + dy;
      const img = getTileImage(tx, ty, zoom);
      const drawX = w / 2 - offsetX + dx * 256;
      const drawY = h / 2 - offsetY + dy * 256;
      if (img.complete && img.naturalWidth > 0) {
        ctx.drawImage(img, drawX, drawY, 256, 256);
      }
    }
  }

  // 2. Capa de Niebla sobre la ciudad
  const fogLayer = document.createElement('canvas');
  fogLayer.width = w;
  fogLayer.height = h;
  const fCtx = fogLayer.getContext('2d');

  fCtx.fillStyle = 'rgba(17, 17, 17, 0.72)';
  fCtx.fillRect(0, 0, w, h);

  fCtx.globalCompositeOperation = 'destination-out';
  const radius = Math.max(22, (zoom - 11) * 12);

  points.forEach((pt) => {
    const p = project(pt.lat, pt.lng);
    const grad = fCtx.createRadialGradient(p.x, p.y, radius * 0.3, p.x, p.y, radius);
    grad.addColorStop(0, 'rgba(0,0,0,1)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    fCtx.fillStyle = grad;
    fCtx.beginPath();
    fCtx.arc(p.x, p.y, radius, 0, Math.PI * 2);
    fCtx.fill();
  });

  ctx.drawImage(fogLayer, 0, 0);

  // 3. Pins de Capturas de la Bóveda
  renderedPins = [];
  captures.forEach((cap) => {
    if (!cap.coords) return;
    const p = project(cap.coords.lat, cap.coords.lng);
    renderedPins.push({ x: p.x, y: p.y, cap });

    ctx.fillStyle = '#c0392b';
    ctx.fillRect(p.x - 7, p.y - 7, 14, 14);
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#ffffff';
    ctx.strokeRect(p.x - 7, p.y - 7, 14, 14);
  });

  // 4. Posición actual
  if (points.length > 0) {
    const last = points[points.length - 1];
    const cur = project(last.lat, last.lng);
    ctx.beginPath();
    ctx.arc(cur.x, cur.y, 6, 0, Math.PI * 2);
    ctx.fillStyle = '#111111';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();
  }
}

async function recordPosition(lat, lng) {
  latestCoords = { lat, lng };
  centerCoords = { lat, lng };

  const last = points[points.length - 1];
  if (last) {
    const distDeg = Math.hypot(lat - last.lat, lng - last.lng);
    if (distDeg < 0.00011) {
      drawScene();
      return;
    }
  }

  const pt = { id: 'fog_' + Date.now(), lat, lng, ts: Date.now() };
  await addFogPoint(pt);
  points.push(pt);
  fogStatsEl.textContent = `${points.length} ZONAS · ZOOM ${zoom}x`;
  drawScene();
}

gpsBtn.addEventListener('click', () => {
  if (watchId !== null) {
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
    gpsBtn.textContent = 'RED/GPS';
    gpsBtn.classList.remove('active');
    return;
  }

  if (!('geolocation' in navigator)) return;
  gpsBtn.textContent = 'GPS ACTIVO';
  gpsBtn.classList.add('active');

  watchId = navigator.geolocation.watchPosition(
    (pos) => recordPosition(pos.coords.latitude, pos.coords.longitude),
    () => (gpsBtn.textContent = 'SIN SEÑAL'),
    { enableHighAccuracy: true, maximumAge: 5000 }
  );
});

zoomInBtn.addEventListener('click', () => {
  if (zoom < 17) {
    zoom++;
    fogStatsEl.textContent = `${points.length} ZONAS · ZOOM ${zoom}x`;
    drawScene();
  }
});

zoomOutBtn.addEventListener('click', () => {
  if (zoom > 12) {
    zoom--;
    fogStatsEl.textContent = `${points.length} ZONAS · ZOOM ${zoom}x`;
    drawScene();
  }
});

centerBtn.addEventListener('click', () => {
  if (latestCoords) {
    centerCoords = { ...latestCoords };
  } else if (points.length > 0) {
    const last = points[points.length - 1];
    centerCoords = { lat: last.lat, lng: last.lng };
  }
  drawScene();
});

canvas.addEventListener('click', (e) => {
  const rect = canvas.getBoundingClientRect();
  const cx = e.clientX - rect.left;
  const cy = e.clientY - rect.top;

  const hit = renderedPins.find((pin) => Math.hypot(pin.x - cx, pin.y - cy) < 18);
  if (hit) {
    pinPreviewEl.innerHTML = `
      <img src="${hit.cap.image}" alt="Pin" />
      <div>
        <strong>CAPTURA LOCAL</strong>
        <div class="mini-pal" style="margin-top:4px">
          ${hit.cap.palette.map((c) => `<span style="background:${c}"></span>`).join('')}
        </div>
      </div>
    `;
    pinPreviewEl.classList.remove('hidden');
  } else {
    pinPreviewEl.classList.add('hidden');
  }
});
