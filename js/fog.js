import { addFogPoint, getAllFogPoints, getAllCaptures } from './db.js';

const canvas = document.getElementById('fog-canvas');
const ctx = canvas.getContext('2d');
const fogStatsEl = document.getElementById('fog-stats');
const gpsBtn = document.getElementById('btn-fog-gps');
const centerBtn = document.getElementById('btn-fog-center');
const simBtn = document.getElementById('btn-fog-sim');
const pinPreviewEl = document.getElementById('fog-pin-preview');

let watchId = null;
let points = [];
let captures = [];
let origin = null; // { lat, lng } referencia central
let latestCoords = null;
let renderedPins = [];

// Escala: ~111,000 metros por grado
const SCALE = 140000;

export async function renderFogMap() {
  const rect = canvas.parentElement.getBoundingClientRect();
  canvas.width = rect.width || 360;
  canvas.height = rect.height || 420;

  points = await getAllFogPoints();
  captures = await getAllCaptures();

  if (!origin && points.length > 0) {
    origin = { lat: points[points.length - 1].lat, lng: points[points.length - 1].lng };
  }

  fogStatsEl.textContent = `${points.length} zonas despejadas · ${captures.filter((c) => c.coords).length} pins`;
  drawScene();
}

export function getLatestCoords() {
  return latestCoords;
}

function project(lat, lng) {
  if (!origin) return { x: canvas.width / 2, y: canvas.height / 2 };
  const dx = (lng - origin.lng) * Math.cos((origin.lat * Math.PI) / 180) * SCALE;
  const dy = (origin.lat - lat) * SCALE;
  return {
    x: canvas.width / 2 + dx,
    y: canvas.height / 2 + dy
  };
}

function drawScene() {
  const w = canvas.width;
  const h = canvas.height;

  // 1. Fondo del mundo descubierto (estilo Bento luminoso con retícula)
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 1;
  const step = 30;
  for (let x = 0; x < w; x += step) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  for (let y = 0; y < h; y += step) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }

  // Ruta conectada entre puntos explorados
  if (points.length > 1) {
    ctx.beginPath();
    points.forEach((pt, idx) => {
      const p = project(pt.lat, pt.lng);
      if (idx === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    ctx.strokeStyle = 'rgba(37, 99, 235, 0.35)';
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  // 2. Capa de Niebla de Guerra (Fog of War) en lienzo auxiliar
  const fogLayer = document.createElement('canvas');
  fogLayer.width = w;
  fogLayer.height = h;
  const fCtx = fogLayer.getContext('2d');

  fCtx.fillStyle = 'rgba(15, 23, 42, 0.88)';
  fCtx.fillRect(0, 0, w, h);

  // Recortar agujeros en la niebla por cada coordenada visitada
  fCtx.globalCompositeOperation = 'destination-out';
  points.forEach((pt) => {
    const p = project(pt.lat, pt.lng);
    const grad = fCtx.createRadialGradient(p.x, p.y, 10, p.x, p.y, 44);
    grad.addColorStop(0, 'rgba(0,0,0,1)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    fCtx.fillStyle = grad;
    fCtx.beginPath();
    fCtx.arc(p.x, p.y, 44, 0, Math.PI * 2);
    fCtx.fill();
  });

  ctx.drawImage(fogLayer, 0, 0);

  // 3. Dibujar Pins de Capturas de la Bóveda sobre zonas despejadas
  renderedPins = [];
  captures.forEach((cap) => {
    if (!cap.coords) return;
    const p = project(cap.coords.lat, cap.coords.lng);
    renderedPins.push({ x: p.x, y: p.y, cap });

    ctx.beginPath();
    ctx.arc(p.x, p.y, 11, 0, Math.PI * 2);
    ctx.fillStyle = '#f97316';
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();
  });

  // 4. Marcador de posición actual (Radar Azul)
  if (points.length > 0) {
    const last = points[points.length - 1];
    const cur = project(last.lat, last.lng);
    ctx.beginPath();
    ctx.arc(cur.x, cur.y, 7, 0, Math.PI * 2);
    ctx.fillStyle = '#2563eb';
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();
  }
}

async function recordPosition(lat, lng) {
  latestCoords = { lat, lng };
  if (!origin) origin = { lat, lng };

  // Evitar duplicados si no te has movido al menos ~12 metros
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
  fogStatsEl.textContent = `${points.length} zonas despejadas · ${captures.filter((c) => c.coords).length} pins`;
  drawScene();
}

gpsBtn.addEventListener('click', () => {
  if (watchId !== null) {
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
    gpsBtn.textContent = 'Activar GPS';
    gpsBtn.classList.remove('active');
    return;
  }

  if (!('geolocation' in navigator)) return;
  gpsBtn.textContent = 'Rastreando...';
  gpsBtn.classList.add('active');

  watchId = navigator.geolocation.watchPosition(
    (pos) => {
      recordPosition(pos.coords.latitude, pos.coords.longitude);
    },
    () => {
      gpsBtn.textContent = 'Sin señal GPS';
    },
    { enableHighAccuracy: true, maximumAge: 5000 }
  );
});

centerBtn.addEventListener('click', () => {
  if (points.length > 0) {
    const last = points[points.length - 1];
    origin = { lat: last.lat, lng: last.lng };
    drawScene();
  }
});

// Botón de simulación para probar en casa o en el metro sin señal GPS
simBtn.addEventListener('click', () => {
  const baseLat = latestCoords ? latestCoords.lat : 43.2630;
  const baseLng = latestCoords ? latestCoords.lng : -2.9350;
  const newLat = baseLat + (Math.random() - 0.5) * 0.0012;
  const newLng = baseLng + (Math.random() - 0.5) * 0.0012;
  recordPosition(newLat, newLng);
});

// Tocar un pin naranja muestra la foto capturada en ese lugar
canvas.addEventListener('click', (e) => {
  const rect = canvas.getBoundingClientRect();
  const cx = e.clientX - rect.left;
  const cy = e.clientY - rect.top;

  const hit = renderedPins.find((pin) => Math.hypot(pin.x - cx, pin.y - cy) < 18);
  if (hit) {
    pinPreviewEl.innerHTML = `
      <img src="${hit.cap.image}" alt="Pin" />
      <div>
        <strong>Hallazgo en esta zona</strong>
        <div class="mini-pal" style="margin-top:4px;border-radius:4px;overflow:hidden">
          ${hit.cap.palette.map((c) => `<span style="background:${c}"></span>`).join('')}
        </div>
      </div>
    `;
    pinPreviewEl.classList.remove('hidden');
  } else {
    pinPreviewEl.classList.add('hidden');
  }
});
