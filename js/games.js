export function renderGame(container, type) {
  switch (type) {
    case 'memory': renderMemoryGame(container); break;
    case 'chrono': renderBlindChrono(container); break;
    case 'binary': renderBinaryGame(container); break;
    case 'latency': renderLatencyGame(container); break;
    case 'angle': renderAngleGame(container); break;
    case 'math': renderMathGame(container); break;
    case 'rhythm': renderRhythmGame(container); break;
  }
}

/* 1. Matriz de Memoria */
function renderMemoryGame(container) {
  container.innerHTML = `
    <div class="game-box">
      <div class="game-hint" id="mem-status">MEMORIZA LAS 5 CASILLAS</div>
      <div class="memory-grid" id="mem-grid"></div>
      <button class="action-btn red-btn" id="mem-start" style="width:100%">INICIAR SECUENCIA</button>
    </div>
  `;
  const grid = container.querySelector('#mem-grid');
  const status = container.querySelector('#mem-status');
  const startBtn = container.querySelector('#mem-start');
  let target = new Set(), found = new Set(), locked = true;

  for (let i = 0; i < 16; i++) {
    const cell = document.createElement('div');
    cell.className = 'mem-cell';
    cell.addEventListener('click', () => {
      if (locked || found.has(i)) return;
      if (target.has(i)) {
        cell.classList.add('hit');
        found.add(i);
        if (found.size === target.size) {
          locked = true;
          status.textContent = 'COMPLETADO';
          startBtn.style.display = 'block';
          startBtn.textContent = 'NUEVO PATRÓN';
        }
      } else {
        cell.classList.add('miss');
        locked = true;
        status.textContent = 'FALLO';
        startBtn.style.display = 'block';
        startBtn.textContent = 'REINTENTAR';
      }
    });
    grid.appendChild(cell);
  }

  startBtn.addEventListener('click', () => {
    target.clear(); found.clear(); locked = true;
    startBtn.style.display = 'none';
    const cells = grid.querySelectorAll('.mem-cell');
    cells.forEach((c) => (c.className = 'mem-cell'));
    while (target.size < 5) target.add(Math.floor(Math.random() * 16));
    status.textContent = 'OBSERVA...';
    target.forEach((idx) => cells[idx].classList.add('lit'));
    setTimeout(() => {
      cells.forEach((c) => c.classList.remove('lit'));
      status.textContent = 'MARCA LAS 5 POSICIONES';
      locked = false;
    }, 1050);
  });
}

/* 2. Cronómetro Ciego */
function renderBlindChrono(container) {
  container.innerHTML = `
    <div class="game-box">
      <div class="game-hint">DETÉN EN <strong>5.00s</strong> (SE OCULTA A LOS 2s)</div>
      <div class="chrono-display" id="chrono-val">0.00s</div>
      <button class="action-btn red-btn" id="chrono-btn" style="width:100%">ARRANCAR</button>
    </div>
  `;
  const display = container.querySelector('#chrono-val');
  const btn = container.querySelector('#chrono-btn');
  let running = false, startTime = 0, rafId = null;

  function tick() {
    const elapsed = (performance.now() - startTime) / 1000;
    display.textContent = elapsed < 2.0 ? elapsed.toFixed(2) + 's' : '?.??s';
    rafId = requestAnimationFrame(tick);
  }

  btn.addEventListener('click', () => {
    if (!running) {
      running = true;
      startTime = performance.now();
      btn.textContent = 'DETENER EN 5.00s';
      rafId = requestAnimationFrame(tick);
    } else {
      running = false;
      cancelAnimationFrame(rafId);
      const finalTime = (performance.now() - startTime) / 1000;
      const diff = Math.abs(5.0 - finalTime).toFixed(2);
      display.textContent = `${finalTime.toFixed(2)}s`;
      btn.textContent = `DESVIACIÓN: ${diff}s · REPETIR`;
    }
  });
}

/* 3. Byte Builder */
function renderBinaryGame(container) {
  const weights = [16, 8, 4, 2, 1];
  let targetNum = Math.floor(Math.random() * 30) + 1;
  let bits = [0, 0, 0, 0, 0];

  container.innerHTML = `
    <div class="game-box">
      <div class="game-hint">SUMA EN BINARIO: <strong id="bin-target" style="color:var(--red);font-size:1.1rem">${targetNum}</strong></div>
      <div class="binary-bits" id="bin-row"></div>
      <div class="game-hint" id="bin-sum">ACTUAL: 0</div>
    </div>
  `;
  const row = container.querySelector('#bin-row');
  const targetEl = container.querySelector('#bin-target');
  const sumEl = container.querySelector('#bin-sum');

  function renderBits() {
    row.innerHTML = '';
    weights.forEach((w, idx) => {
      const btn = document.createElement('button');
      btn.className = `bit-btn ${bits[idx] ? 'on' : ''}`;
      btn.innerHTML = `${bits[idx]}<span>${w}</span>`;
      btn.addEventListener('click', () => {
        bits[idx] = bits[idx] ? 0 : 1;
        const currentSum = bits.reduce((acc, b, i) => acc + b * weights[i], 0);
        renderBits();
        if (currentSum === targetNum) {
          sumEl.innerHTML = `<strong style="color:var(--offline-green)">EXACTO: ${bits.join('')}</strong>`;
          setTimeout(() => {
            targetNum = Math.floor(Math.random() * 30) + 1;
            bits = [0, 0, 0, 0, 0];
            targetEl.textContent = targetNum;
            sumEl.textContent = 'ACTUAL: 0';
            renderBits();
          }, 1300);
        } else {
          sumEl.textContent = `ACTUAL: ${currentSum}`;
        }
      });
      row.appendChild(btn);
    });
  }
  renderBits();
}

/* 4. Test de Latencia */
function renderLatencyGame(container) {
  container.innerHTML = `
    <div class="game-box">
      <div class="game-hint">TOCA CUANDO EL PANEL PASE A ROJO</div>
      <div class="latency-pad" id="lat-pad">TOCAR PARA EMPEZAR</div>
    </div>
  `;
  const pad = container.querySelector('#lat-pad');
  let state = 'idle', timer = null, goTime = 0;

  pad.addEventListener('click', () => {
    if (state === 'idle') {
      state = 'wait';
      pad.className = 'latency-pad wait';
      pad.textContent = 'ESPERA...';
      timer = setTimeout(() => {
        state = 'go';
        goTime = performance.now();
        pad.className = 'latency-pad go';
        pad.textContent = '¡AHORA!';
      }, 1200 + Math.random() * 2200);
    } else if (state === 'wait') {
      clearTimeout(timer);
      state = 'idle';
      pad.className = 'latency-pad';
      pad.textContent = 'MUY PRONTO · REPETIR';
    } else if (state === 'go') {
      const ms = Math.round(performance.now() - goTime);
      state = 'idle';
      pad.className = 'latency-pad';
      pad.textContent = `${ms} MS · REPETIR`;
    }
  });
}

/* 5. NUEVO: Estimador de Ángulos */
function renderAngleGame(container) {
  let targetDeg = Math.floor(Math.random() * 145) + 20;
  container.innerHTML = `
    <div class="game-box">
      <div class="game-hint" id="ang-status">ESTIMA EL ÁNGULO EN GRADOS</div>
      <canvas id="ang-cv" width="180" height="120" style="background:#fff;border:1px solid #111"></canvas>
      <input type="range" min="10" max="175" value="90" class="angle-slider" id="ang-range" />
      <button class="action-btn red-btn" id="ang-check" style="width:100%">CONFIRMAR: <span id="ang-val">90°</span></button>
    </div>
  `;
  const cv = container.querySelector('#ang-cv');
  const ctx = cv.getContext('2d');
  const range = container.querySelector('#ang-range');
  const valSpan = container.querySelector('#ang-val');
  const checkBtn = container.querySelector('#ang-check');
  const status = container.querySelector('#ang-status');
  let solved = false;

  function drawAngle(deg) {
    ctx.clearRect(0, 0, cv.width, cv.height);
    const ox = 90, oy = 100, r = 72;
    ctx.strokeStyle = '#111111';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(ox, oy);
    ctx.lineTo(ox + r, oy);
    const rad = (deg * Math.PI) / 180;
    ctx.moveTo(ox, oy);
    ctx.lineTo(ox + Math.cos(rad) * r, oy - Math.sin(rad) * r);
    ctx.stroke();

    ctx.strokeStyle = '#c0392b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(ox, oy, 26, 0, -rad, true);
    ctx.stroke();
  }

  drawAngle(targetDeg);

  range.addEventListener('input', () => {
    valSpan.textContent = `${range.value}°`;
  });

  checkBtn.addEventListener('click', () => {
    if (solved) {
      solved = false;
      targetDeg = Math.floor(Math.random() * 145) + 20;
      drawAngle(targetDeg);
      status.textContent = 'ESTIMA EL ÁNGULO EN GRADOS';
      checkBtn.innerHTML = `CONFIRMAR: <span id="ang-val">${range.value}°</span>`;
      return;
    }
    solved = true;
    const guess = Number(range.value);
    const err = Math.abs(targetDeg - guess);
    status.textContent = `REAL: ${targetDeg}° · ERROR: ±${err}°`;
    checkBtn.textContent = 'NUEVO ÁNGULO';
  });
}

/* 6. NUEVO: Cálculo Mental Express */
function renderMathGame(container) {
  container.innerHTML = `
    <div class="game-box">
      <div class="game-hint" id="math-status">CÁLCULO MENTAL RÁPIDO</div>
      <div class="math-expr" id="math-expr"></div>
      <div class="options-grid" id="math-opts" style="width:100%"></div>
    </div>
  `;
  const exprEl = container.querySelector('#math-expr');
  const optsEl = container.querySelector('#math-opts');
  const statusEl = container.querySelector('#math-status');

  function nextRound() {
    const a = Math.floor(Math.random() * 14) + 6;
    const b = Math.floor(Math.random() * 9) + 3;
    const correct = a * b;
    exprEl.textContent = `${a} × ${b}`;
    const choices = new Set([correct]);
    while (choices.size < 3) {
      choices.add(correct + (Math.floor(Math.random() * 11) - 5) || correct + 2);
    }
    const shuffled = [...choices].sort(() => Math.random() - 0.5);
    optsEl.innerHTML = '';
    shuffled.forEach((val) => {
      const btn = document.createElement('button');
      btn.className = 'opt-btn';
      btn.textContent = val;
      btn.addEventListener('click', () => {
        if (val === correct) {
          btn.classList.add('correct');
          statusEl.textContent = 'CORRECTO';
          setTimeout(nextRound, 650);
        } else {
          btn.classList.add('wrong');
          statusEl.textContent = `ERA ${correct}`;
        }
      });
      optsEl.appendChild(btn);
    });
  }
  nextRound();
}

/* 7. NUEVO: Pulso Oculto (Metrónomo) */
function renderRhythmGame(container) {
  container.innerHTML = `
    <div class="game-box">
      <div class="game-hint" id="rhy-status">ESCUCHA 4 PULSOS Y DA EL 5º A TIEMPO</div>
      <div class="latency-pad" id="rhy-pad">INICIAR PULSO (100 BPM)</div>
    </div>
  `;
  const pad = container.querySelector('#rhy-pad');
  const status = container.querySelector('#rhy-status');
  let phase = 'idle';
  let expectedTime = 0;

  function beep() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = 520;
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(); osc.stop(ctx.currentTime + 0.09);
    } catch (e) {}
  }

  pad.addEventListener('click', () => {
    if (phase === 'idle') {
      phase = 'counting';
      const interval = 600; // 100 BPM
      let count = 0;
      const runBeat = () => {
        count++;
        beep();
        pad.className = 'latency-pad go';
        pad.textContent = `PULSO ${count} / 4`;
        setTimeout(() => (pad.className = 'latency-pad'), 120);
        if (count < 4) {
          setTimeout(runBeat, interval);
        } else {
          phase = 'waiting';
          expectedTime = performance.now() + interval;
          setTimeout(() => {
            if (phase === 'waiting') pad.textContent = '¡TOCA EN EL 5º PULSO!';
          }, 150);
        }
      };
      runBeat();
    } else if (phase === 'waiting') {
      const diff = Math.round(performance.now() - expectedTime);
      phase = 'idle';
      const sign = diff > 0 ? '+' : '';
      status.textContent = `PRECISIÓN: ${sign}${diff} MS`;
      pad.textContent = 'REPETIR PULSO';
    }
  });
}
