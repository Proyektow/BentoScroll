const canvas = document.getElementById('lab-canvas');
const ctx = canvas.getContext('2d');
const lTabs = document.querySelectorAll('.l-tab');
const modeBtn = document.getElementById('btn-lab-mode');
const clearBtn = document.getElementById('btn-lab-clear');

let rafId = null;
let mode = 'particles'; // 'particles' | 'sound'
let attract = true;
let pointer = { x: -999, y: -999, down: false };

let particles = [];
let ripples = [];
let audioCtx = null;

// Escala pentatónica armónica (Hz)
const SCALE = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25, 587.33, 659.25];

export function startLab() {
  stopLab();
  resizeCanvas();
  if (particles.length === 0) initParticles();
  loop();
}

export function stopLab() {
  if (rafId) cancelAnimationFrame(rafId);
  rafId = null;
}

function resizeCanvas() {
  const rect = canvas.parentElement.getBoundingClientRect();
  canvas.width = rect.width || 360;
  canvas.height = rect.height || 420;
}

function initParticles() {
  particles = [];
  for (let i = 0; i < 180; i++) {
    particles.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 1.5,
      vy: (Math.random() - 0.5) * 1.5,
      isOrange: i % 5 === 0,
      size: i % 5 === 0 ? 3.5 : 2.3
    });
  }
}

function playTone(normX, normY) {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();

  const noteIdx = Math.min(SCALE.length - 1, Math.floor(normX * SCALE.length));
  const freq = SCALE[noteIdx] * (normY < 0.5 ? 1.5 : 1);

  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq, audioCtx.currentTime);

  gain.gain.setValueAtTime(0.14, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 1.2);

  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + 1.25);
}

function spawnRipple(x, y) {
  ripples.push({
    x,
    y,
    r: 6,
    alpha: 1,
    color: ripples.length % 2 === 0 ? '#2563eb' : '#f97316'
  });
  playTone(x / canvas.width, y / canvas.height);
}

function loop() {
  if (mode === 'particles') {
    ctx.fillStyle = 'rgba(248, 250, 252, 0.24)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    particles.forEach((p) => {
      if (pointer.down) {
        const dx = pointer.x - p.x;
        const dy = pointer.y - p.y;
        const dist = Math.hypot(dx, dy) || 1;
        if (dist < 180) {
          const force = ((180 - dist) / 180) * (attract ? 0.55 : -0.85);
          p.vx += (dx / dist) * force;
          p.vy += (dy / dist) * force;
        }
      }

      p.vx *= 0.96;
      p.vy *= 0.96;
      p.x += p.vx;
      p.y += p.vy;

      if (p.x < 0) p.x = canvas.width;
      if (p.x > canvas.width) p.x = 0;
      if (p.y < 0) p.y = canvas.height;
      if (p.y > canvas.height) p.y = 0;

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fillStyle = p.isOrange ? '#f97316' : '#2563eb';
      ctx.fill();
    });
  } else {
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Retícula geométrica sutil
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.08)';
    ctx.lineWidth = 1;
    for (let x = 0; x < canvas.width; x += 32) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }

    ripples.forEach((rp) => {
      rp.r += 2.4;
      rp.alpha *= 0.975;

      ctx.beginPath();
      ctx.arc(rp.x, rp.y, rp.r, 0, Math.PI * 2);
      ctx.strokeStyle = rp.color;
      ctx.globalAlpha = rp.alpha;
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Polígono armónico inscrito
      ctx.beginPath();
      for (let s = 0; s <= 6; s++) {
        const ang = (s / 6) * Math.PI * 2 + rp.r * 0.01;
        const px = rp.x + Math.cos(ang) * (rp.r * 0.7);
        const py = rp.y + Math.sin(ang) * (rp.r * 0.7);
        if (s === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
    });

    ripples = ripples.filter((rp) => rp.alpha > 0.03);
  }

  rafId = requestAnimationFrame(loop);
}

function getPos(e) {
  const rect = canvas.getBoundingClientRect();
  const touch = e.touches ? e.touches[0] : e;
  return {
    x: touch.clientX - rect.left,
    y: touch.clientY - rect.top
  };
}

canvas.addEventListener('pointerdown', (e) => {
  const pos = getPos(e);
  pointer = { ...pos, down: true };
  if (mode === 'sound') spawnRipple(pos.x, pos.y);
});

canvas.addEventListener('pointermove', (e) => {
  if (!pointer.down) return;
  const pos = getPos(e);
  pointer.x = pos.x;
  pointer.y = pos.y;
});

window.addEventListener('pointerup', () => {
  pointer.down = false;
});

lTabs.forEach((tab) => {
  tab.addEventListener('click', () => {
    lTabs.forEach((t) => t.classList.remove('active'));
    tab.classList.add('active');
    mode = tab.dataset.ltab;
    modeBtn.style.display = mode === 'particles' ? 'block' : 'none';
  });
});

modeBtn.addEventListener('click', () => {
  attract = !attract;
  modeBtn.textContent = `Polaridad: ${attract ? 'Atracción' : 'Repulsión'}`;
});

clearBtn.addEventListener('click', () => {
  ripples = [];
  initParticles();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
});
