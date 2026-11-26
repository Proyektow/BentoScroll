export function renderGame(container, type) {
  if (type === 'memory') {
    renderMemoryGame(container);
  } else {
    renderBlindChrono(container);
  }
}

function renderMemoryGame(container) {
  container.innerHTML = `
    <div class="game-box">
      <div id="mem-status" style="font-size:0.85rem;color:var(--text-muted)">Memoriza las 5 casillas</div>
      <div class="memory-grid" id="mem-grid"></div>
      <button class="action-btn primary" id="mem-start" style="width:100%">Iniciar patrón</button>
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
    cell.dataset.idx = i;
    cell.addEventListener('click', () => {
      if (locked || found.has(i)) return;
      if (target.has(i)) {
        cell.classList.add('hit');
        found.add(i);
        if (found.size === target.size) {
          locked = true;
          status.textContent = 'Patrón completado';
          startBtn.style.display = 'block';
          startBtn.textContent = 'Nuevo patrón';
        }
      } else {
        cell.classList.add('miss');
        locked = true;
        status.textContent = 'Fallo. Inténtalo de nuevo';
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

    while (target.size < 5) {
      target.add(Math.floor(Math.random() * 16));
    }

    status.textContent = 'Observa...';
    target.forEach((idx) => cells[idx].classList.add('lit'));

    setTimeout(() => {
      cells.forEach((c) => c.classList.remove('lit'));
      status.textContent = 'Toca las 5 casillas';
      locked = false;
    }, 1100);
  });
}

function renderBlindChrono(container) {
  container.innerHTML = `
    <div class="game-box">
      <div style="font-size:0.85rem;color:var(--text-muted)">Detén el reloj en <strong>5.00s</strong> (se oculta a los 2s)</div>
      <div class="chrono-display" id="chrono-val">0.00s</div>
      <button class="action-btn primary" id="chrono-btn" style="width:100%">Arrancar</button>
    </div>
  `;

  const display = container.querySelector('#chrono-val');
  const btn = container.querySelector('#chrono-btn');
  let running = false;
  let startTime = 0;
  let rafId = null;

  function tick() {
    const elapsed = (performance.now() - startTime) / 1000;
    if (elapsed < 2.0) {
      display.textContent = elapsed.toFixed(2) + 's';
    } else {
      display.textContent = '?.??s';
    }
    rafId = requestAnimationFrame(tick);
  }

  btn.addEventListener('click', () => {
    if (!running) {
      running = true;
      startTime = performance.now();
      btn.textContent = 'Detener en 5.00s';
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
