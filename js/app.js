export function renderGame(container, type) {
  switch (type) {
    case 'memory':
      renderMemoryGame(container);
      break;
    case 'chrono':
      renderBlindChrono(container);
      break;
    case 'binary':
      renderBinaryGame(container);
      break;
    case 'latency':
      renderLatencyGame(container);
      break;
  }
}

/* 1. Matriz de Memoria */
function renderMemoryGame(container) {
  container.innerHTML = `
    <div class="game-box">
      <div class="game-hint" id="mem-status">Memoriza los 5 bloques azules</div>
      <div class="memory-grid" id="mem-grid"></div>
      <button class="action-btn orange-btn" id="mem-start" style="width:100%">Iniciar secuencia</button>
    </div>
  `;

  const grid = container.querySelector('#mem-grid');
  const status = container.querySelector('#mem-status');
  const startBtn = container.querySelector('#mem-start');
  let target = new Set();
  let found = new Set();
  let locked = true;

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
          status.textContent = '¡Secuencia completada!';
          startBtn.style.display = 'block';
          startBtn.textContent = 'Subir nivel (Nuevo patrón)';
        }
      } else {
        cell.classList.add('miss');
        locked = true;
        status.textContent = 'Bloque incorrecto';
        startBtn.style.display = 'block';
        startBtn.textContent = 'Reintentar';
      }
    });
    grid.appendChild(cell);
  }

  startBtn.addEventListener('click', () => {
    target.clear();
    found.clear();
    locked = true;
    startBtn.style.display = 'none';
    const cells = grid.querySelectorAll('.mem-cell');
    cells.forEach((c) => (c.className = 'mem-cell'));

    while (target.size < 5) target.add(Math.floor(Math.random() * 16));

    status.textContent = 'Observa la matriz...';
    target.forEach((idx) => cells[idx].classList.add('lit'));

    setTimeout(() => {
      cells.forEach((c) => c.classList.remove('lit'));
      status.textContent = 'Marca las 5 posiciones';
      locked = false;
    }, 1050);
  });
}

/* 2. Cronómetro Ciego */
function renderBlindChrono(container) {
  container.innerHTML = `
    <div class="game-box">
      <div class="game-hint">Clava el reloj en <strong>5.00s</strong> (se oculta a los 2s)</div>
      <div class="chrono-display" id="chrono-val">0.00s</div>
      <button class="action-btn orange-btn" id="chrono-btn" style="width:100%">Arrancar reloj</button>
    </div>
  `;

  const display = container.querySelector('#chrono-val');
  const btn = container.querySelector('#chrono-btn');
  let running = false;
  let startTime = 0;
  let rafId = null;

  function tick() {
    const elapsed = (performance.now() - startTime) / 1000;
    display.textContent = elapsed < 2.0 ? elapsed.toFixed(2) + 's' : '?.??s';
    rafId = requestAnimationFrame(tick);
  }

  btn.addEventListener('click', () => {
    if (!running) {
      running = true;
      startTime = performance.now();
      btn.textContent = '¡Detener en 5.00s!';
      rafId = requestAnimationFrame(tick);
    } else {
      running = false;
      cancelAnimationFrame(rafId);
      const finalTime = (performance.now() - startTime) / 1000;
      const diff = Math.abs(5.0 - finalTime).toFixed(2);
      display.textContent = `${finalTime.toFixed(2)}s`;
      btn.textContent = `Desviación: ${diff}s — Reintentar`;
    }
  });
}

/* 3. Byte Builder (Suma Binaria) */
function renderBinaryGame(container) {
  const weights = [16, 8, 4, 2, 1];
  let targetNum = Math.floor(Math.random() * 30) + 1;
  let bits = [0, 0, 0, 0, 0];

  container.innerHTML = `
    <div class="game-box">
      <div class="game-hint">Activa los bits para sumar: <strong id="bin-target" style="color:var(--blue);font-size:1.1rem">${targetNum}</strong></div>
      <div class="binary-bits" id="bin-row"></div>
      <div class="game-hint" id="bin-sum">Suma actual: 0</div>
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
          sumEl.innerHTML = `<strong style="color:var(--success)">¡Exacto! ${targetNum} en binario es ${bits.join('')}</strong>`;
          setTimeout(() => {
            targetNum = Math.floor(Math.random() * 30) + 1;
            bits = [0, 0, 0, 0, 0];
            targetEl.textContent = targetNum;
            sumEl.textContent = 'Suma actual: 0';
            renderBits();
          }, 1400);
        } else {
          sumEl.textContent = `Suma actual: ${currentSum}`;
        }
      });
      row.appendChild(btn);
    });
  }

  renderBits();
}

/* 4. Test de Latencia Humana */
function renderLatencyGame(container) {
  container.innerHTML = `
    <div class="game-box">
      <div class="game-hint">Mide tu latencia visual (un humano promedio ronda 220 ms)</div>
      <div class="latency-pad" id="lat-pad">Toca aquí para empezar</div>
    </div>
  `;

  const pad = container.querySelector('#lat-pad');
  let state = 'idle'; // idle | wait | go
  let timer = null;
  let goTime = 0;

  pad.addEventListener('click', () => {
    if (state === 'idle') {
      state = 'wait';
      pad.className = 'latency-pad wait';
      pad.textContent = 'Espera al color azul...';
      const delay = 1200 + Math.random() * 2300;
      timer = setTimeout(() => {
        state = 'go';
        goTime = performance.now();
        pad.className = 'latency-pad go';
        pad.textContent = '¡AHORA! TOCA';
      }, delay);
    } else if (state === 'wait') {
      clearTimeout(timer);
      state = 'idle';
      pad.className = 'latency-pad';
      pad.textContent = 'Demasiado pronto — Toca para repetir';
    } else if (state === 'go') {
      const ms = Math.round(performance.now() - goTime);
      state = 'idle';
      pad.className = 'latency-pad';
      pad.textContent = `${ms} ms — Toca para repetir`;
    }
  });
}
