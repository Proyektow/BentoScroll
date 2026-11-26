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

// Variables para Huella Acústica (4 segundos)
let isRecordingAudio = false;
let audioStream = null;
let audioCtx = null;

export async function startScanner() {
  stopScanner();
  if (activeFilter === 'audio') {
    prepareAudioView();
    return;
  }

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
    shutterBtn.textContent = 'CAPTURAR EN BÓVEDA';
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
  if (audioStream) {
    audioStream.getTracks().forEach((t) => t.stop());
    audioStream = null;
  }
  isRecordingAudio = false;
}

function prepareAudioView() {
  canvas.width = 480;
  canvas.height = 480;
  overlayMsg.style.display = 'none';
  ctx.fillStyle = '#111111';
  ctx.fillRect(0, 0, 480, 480);
  ctx.strokeStyle = '#333338';
  ctx.lineWidth = 1;
  for (let y = 40; y < 480; y += 40) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(480, y);
    ctx.stroke();
  }
  ctx.fillStyle = '#f4f4f2';
  ctx.font = 'bold 16px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('HUELLA ACÚSTICA (4 SEG)', 240, 230);
  ctx.fillStyle = '#a1a1aa';
  ctx.font = '13px monospace';
  ctx.fillText('PULSA ABAJO PARA REGISTRAR EL ENTORNO', 240, 260);
  shutterBtn.textContent = 'GRABAR HUELLA (4s)';
  currentPalette = ['#111111', '#c0392b', '#f4f4f2', '#52525b', '#d4d4d0'];
  paletteEl.innerHTML = currentPalette
    .map((hex) => `<div class="swatch" style="background:${hex}"><span>${hex}</span></div>`)
    .join('');
}

async function recordAudioPostcard() {
  if (isRecordingAudio) return;
  try {
    audioStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const source = audioCtx.createMediaStreamSource(audioStream);
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    isRecordingAudio = true;
    shutterBtn.textContent = 'ESCUCHANDO ENTORNO...';
    ctx.fillStyle = '#111111';
    ctx.fillRect(0, 0, 480, 480);

    const startTime = performance.now();
    const duration = 4000;
    let colX = 0;

    function drawAudioColumn() {
      if (!isRecordingAudio) return;
      const elapsed = performance.now() - startTime;
      const progress = Math.min(1, elapsed / duration);
      const targetX = Math.floor(progress * 480);

      analyser.getByteFrequencyData(dataArray);

      while (colX <= targetX && colX < 480) {
        for (let i = 0; i < bufferLength; i++) {
          const val = dataArray[i] / 255;
          if (val > 0.12) {
            const y = 480 - (i / bufferLength) * 440 - 20;
            ctx.fillStyle = val > 0.62 ? '#c0392b' : `rgba(244, 244, 242, ${val})`;
            ctx.fillRect(colX, y, 2, 4);
          }
        }
        colX += 2;
      }

      if (elapsed < duration) {
        rafId = requestAnimationFrame(drawAudioColumn);
      } else {
        isRecordingAudio = false;
        audioStream.getTracks().forEach((t) => t.stop());
        audioStream = null;

        // Sello minimalista en la postal sonora
        ctx.fillStyle = '#f4f4f2';
        ctx.font = 'bold 12px monospace';
        ctx.textAlign = 'left';
        const stamp = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
        ctx.fillText(`BENTO AUDIO · ${stamp}`, 16, 26);

        saveCurrentCanvas('audio');
      }
    }

    drawAudioColumn();
  } catch (err) {
    shutterBtn.textContent = 'PERMITE EL MICRÓFONO';
    setTimeout(() => (shutterBtn.textContent = 'GRABAR HUELLA (4s)'), 1600);
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

async function saveCurrentCanvas(filterName) {
  const dataUrl = canvas.toDataURL('image/webp', 0.85);
  const capture = {
    id: 'cap_' + Date.now(),
    image: dataUrl,
    palette: [...currentPalette],
    filter: filterName,
    coords: getLatestCoords(),
    createdAt: Date.now()
  };
  await saveCapture(capture);

  shutterBtn.textContent = capture.coords ? '✓ GUARDADO EN BÓVEDA Y MAPA' : '✓ GUARDADO EN BÓVEDA';
  shutterBtn.style.background = 'var(--offline-green)';
  setTimeout(() => {
    shutterBtn.textContent = activeFilter === 'audio' ? 'GRABAR HUELLA (4s)' : 'CAPTURAR EN BÓVEDA';
    shutterBtn.style.background = '';
  }, 1300);
}

filterBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    const prev = activeFilter;
    filterBtns.forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    activeFilter = btn.dataset.filter;

    if (activeFilter === 'audio') {
      stopScanner();
      prepareAudioView();
    } else if (prev === 'audio') {
      startScanner();
    }
  });
});

flipBtn.addEventListener('click', () => {
  if (activeFilter === 'audio') return;
  facingMode = facingMode === 'environment' ? 'user' : 'environment';
  startScanner();
});

shutterBtn.addEventListener('click', async () => {
  if (activeFilter === 'audio') {
    recordAudioPostcard();
    return;
  }
  if (!stream) return;
  await saveCurrentCanvas(activeFilter);
});
