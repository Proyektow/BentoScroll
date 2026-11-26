import { saveCapture } from './db.js';
import { getLatestCoords } from './fog.js';

const video = document.getElementById('cam-video');
const canvas = document.getElementById('cam-canvas');
const ctx = canvas.getContext('2d', { willReadFrequently: true });
const overlayMsg = document.getElementById('cam-overlay-msg');
const paletteEl = document.getElementById('live-palette');
const shutterBtn = document.getElementById('btn-shutter');
const flipBtn = document.getElementById('btn-flip-cam');
const filterBtns = document.querySelectorAll('.f-pill');

let stream = null;
let rafId = null;
let activeFilter = 'normal';
let facingMode = 'environment';
let currentPalette = ['#111111', '#c0392b', '#52525b', '#d4d4d0', '#f4f4f2'];
let frameCounter = 0;

export async function startScanner() {
  stopScanner();
  overlayMsg.style.display = 'flex';
  overlayMsg.textContent = 'ACTIVANDO CÁMARA LOCAL...';

  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode, width: { ideal: 640 }, height: { ideal: 640 } },
      audio: false
    });
    video.srcObject = stream;
    await video.play();
    canvas.width = 480;
    canvas.height = 480;
    overlayMsg.style.display = 'none';
    renderLoop();
  } catch (err) {
    overlayMsg.textContent = 'PERMITE EL ACCESO A LA CÁMARA PARA USAR EL ESCÁNER.';
  }
}

export function stopScanner() {
  if (rafId) cancelAnimationFrame(rafId);
  rafId = null;
  if (stream) {
    stream.getTracks().forEach((t) => t.stop());
    stream = null;
  }
}

function renderLoop() {
  if (!stream) return;
  const vw = video.videoWidth || 480;
  const vh = video.videoHeight || 480;
  const size = Math.min(vw, vh);
  const sx = (vw - size) / 2;
  const sy = (vh - size) / 2;

  ctx.drawImage(video, sx, sy, size, size, 0, 0, canvas.width, canvas.height);

  if (frameCounter % 15 === 0) extractPalette();
  frameCounter++;

  if (activeFilter !== 'normal') applyMathFilter(activeFilter);

  rafId = requestAnimationFrame(renderLoop);
}

function extractPalette() {
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  const buckets = new Map();

  for (let i = 0; i < imgData.length; i += 4 * 24) {
    const r = Math.round(imgData[i] / 32) * 32;
    const g = Math.round(imgData[i + 1] / 32) * 32;
    const b = Math.round(imgData[i + 2] / 32) * 32;
    const hex = rgbToHex(Math.min(255, r), Math.min(255, g), Math.min(255, b));
    buckets.set(hex, (buckets.get(hex) || 0) + 1);
  }

  const sorted = [...buckets.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map((entry) => entry[0]);

  if (sorted.length === 5) {
    currentPalette = sorted;
    paletteEl.innerHTML = currentPalette
      .map((hex) => `<div class="swatch" style="background:${hex}"><span>${hex}</span></div>`)
      .join('');
  }
}

function applyMathFilter(type) {
  const w = canvas.width;
  const h = canvas.height;
  const frame = ctx.getImageData(0, 0, w, h);
  const d = frame.data;

  if (type === '1bit') {
    const bayer = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
        const threshold = (bayer[(y % 4) * 4 + (x % 4)] / 16) * 255;
        const isLight = lum > threshold;
        d[i] = isLight ? 244 : 17;
        d[i + 1] = isLight ? 244 : 17;
        d[i + 2] = isLight ? 242 : 17;
      }
    }
    ctx.putImageData(frame, 0, 0);
  } else if (type === 'thermal') {
    for (let i = 0; i < d.length; i += 4) {
      const lum = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / 255;
      if (lum < 0.45) {
        d[i] = 17;
        d[i + 1] = Math.round(lum * 160);
        d[i + 2] = 180;
      } else if (lum < 0.8) {
        d[i] = 192;
        d[i + 1] = Math.round((lum - 0.45) * 260);
        d[i + 2] = 43;
      } else {
        d[i] = 244;
        d[i + 1] = 244;
        d[i + 2] = 235;
      }
    }
    ctx.putImageData(frame, 0, 0);
  } else if (type === 'ascii') {
    const chars = ' .:-=+*#%@';
    const step = 10;
    ctx.fillStyle = '#111111';
    ctx.fillRect(0, 0, w, h);
    ctx.font = 'bold 10px monospace';
    ctx.fillStyle = '#f4f4f2';

    for (let y = 0; y < h; y += step) {
      for (let x = 0; x < w; x += step) {
        const i = (y * w + x) * 4;
        const lum = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / 255;
        const charIdx = Math.min(chars.length - 1, Math.floor(lum * chars.length));
        ctx.fillText(chars[charIdx], x, y + step);
      }
    }
  }
}

function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
}

filterBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    filterBtns.forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    activeFilter = btn.dataset.filter;
  });
});

flipBtn.addEventListener('click', () => {
  facingMode = facingMode === 'environment' ? 'user' : 'environment';
  startScanner();
});

shutterBtn.addEventListener('click', async () => {
  if (!stream) return;
  const dataUrl = canvas.toDataURL('image/webp', 0.82);
  const capture = {
    id: 'cap_' + Date.now(),
    image: dataUrl,
    palette: [...currentPalette],
    filter: activeFilter,
    coords: getLatestCoords(),
    createdAt: Date.now()
  };
  await saveCapture(capture);

  const prevText = shutterBtn.textContent;
  shutterBtn.textContent = capture.coords ? '✓ GUARDADO EN BÓVEDA Y MAPA' : '✓ GUARDADO EN BÓVEDA';
  shutterBtn.style.background = 'var(--offline-green)';
  setTimeout(() => {
    shutterBtn.textContent = prevText;
    shutterBtn.style.background = '';
  }, 1200);
});
