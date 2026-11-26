import { getAllStates, updateCardState } from './db.js';
import { renderGame } from './games.js';

const feedEl = document.getElementById('feed');
const progressTrackEl = document.getElementById('progress-track');
const statSeenEl = document.getElementById('stat-seen');
const statSavedEl = document.getElementById('stat-saved');
const filterBtn = document.getElementById('btn-saved-filter');
const shuffleBtn = document.getElementById('btn-shuffle');

let allCards = [];
let currentList = [];
let statesMap = new Map();
let onlySaved = false;

async function init() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }

  const res = await fetch('./data/pack.json');
  allCards = await res.json();

  const states = await getAllStates();
  states.forEach((s) => statesMap.set(s.id, s));

  updateHud();
  renderFeed();
}

function updateHud() {
  let seen = 0;
  let saved = 0;
  statesMap.forEach((s) => {
    if (s.seen) seen++;
    if (s.saved) saved++;
  });
  statSeenEl.textContent = `${seen} leídas`;
  statSavedEl.textContent = saved;
}

function renderProgressSegments(count, activeIdx = 0) {
  progressTrackEl.innerHTML = '';
  for (let i = 0; i < count; i++) {
    const seg = document.createElement('div');
    seg.className = 'prog-seg';
    if (i < activeIdx) seg.classList.add('done');
    if (i === activeIdx) seg.classList.add('current');
    progressTrackEl.appendChild(seg);
  }
}

function renderFeed(shuffle = false) {
  feedEl.innerHTML = '';
  let list = onlySaved
    ? allCards.filter((c) => statesMap.get(c.id)?.saved)
    : [...allCards];

  if (shuffle && list.length > 1) {
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
  }

  currentList = list;
  renderProgressSegments(list.length, 0);

  if (list.length === 0) {
    feedEl.innerHTML = `
      <section class="slide">
        <div class="bento-card" style="justify-content:center;align-items:center;text-align:center">
          <p class="bento-text">No tienes tarjetas guardadas todavía.<br>Pulsa <strong>Guardar</strong> en cualquier píldora para archivarla aquí.</p>
        </div>
      </section>`;
    return;
  }

  list.forEach((card, index) => {
    const st = statesMap.get(card.id) || { seen: false, saved: false };
    const isGame = card.type === 'game';
    const slide = document.createElement('section');
    slide.className = 'slide';
    slide.dataset.id = card.id;
    slide.dataset.index = index;

    slide.innerHTML = `
      <article class="bento-card">
        <div class="bento-meta">
          <span class="tag ${isGame ? 'game-tag' : ''}">${card.category}</span>
          <span class="time-pill">${isGame ? 'Reto interactivo' : '25 seg'}</span>
        </div>
        <div class="bento-body">
          <h2 class="bento-title">${card.title}</h2>
          ${card.text ? `<p class="bento-text">${card.text}</p>` : ''}
          ${card.highlight ? `<div class="bento-highlight">${card.highlight}</div>` : ''}
          <div class="dynamic-slot"></div>
          ${card.deep ? `<div class="bento-deep">${card.deep}</div>` : ''}
        </div>
        <div class="bento-footer">
          ${card.deep ? `<button class="action-btn blue-btn btn-deep">Dato técnico</button>` : ''}
          <button class="action-btn btn-save ${st.saved ? 'saved-state' : ''}">
            ${st.saved ? '★ Guardado' : '☆ Guardar'}
          </button>
        </div>
      </article>
    `;

    const slot = slide.querySelector('.dynamic-slot');

    if (card.type === 'trivia') {
      const grid = document.createElement('div');
      grid.className = 'options-grid';
      card.options.forEach((opt, idx) => {
        const btn = document.createElement('button');
        btn.className = 'opt-btn';
        btn.textContent = opt;
        btn.addEventListener('click', () => {
          grid.querySelectorAll('.opt-btn').forEach((b) => (b.disabled = true));
          btn.classList.add(idx === card.answer ? 'correct' : 'wrong');
          if (idx !== card.answer) {
            grid.children[card.answer].classList.add('correct');
          }
          slide.querySelector('.bento-deep')?.classList.add('open');
        });
        grid.appendChild(btn);
      });
      slot.appendChild(grid);
    } else if (isGame) {
      renderGame(slot, card.gameType);
    }

    const deepBtn = slide.querySelector('.btn-deep');
    if (deepBtn) {
      deepBtn.addEventListener('click', () => {
        const box = slide.querySelector('.bento-deep');
        box.classList.toggle('open');
        deepBtn.textContent = box.classList.contains('open') ? 'Ocultar dato' : 'Dato técnico';
      });
    }

    const saveBtn = slide.querySelector('.btn-save');
    saveBtn.addEventListener('click', async () => {
      const current = statesMap.get(card.id)?.saved || false;
      const updated = await updateCardState(card.id, { saved: !current });
      statesMap.set(card.id, updated);
      saveBtn.classList.toggle('saved-state', updated.saved);
      saveBtn.textContent = updated.saved ? '★ Guardado' : '☆ Guardar';
      updateHud();
    });

    feedEl.appendChild(slide);
  });

  observeSlides();
}

function observeSlides() {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach(async (entry) => {
        if (entry.isIntersecting) {
          const id = entry.target.dataset.id;
          const idx = Number(entry.target.dataset.index);
          renderProgressSegments(currentList.length, idx);

          if (!statesMap.get(id)?.seen) {
            const updated = await updateCardState(id, { seen: true });
            statesMap.set(id, updated);
            updateHud();
          }
        }
      });
    },
    { threshold: 0.7 }
  );

  document.querySelectorAll('.slide').forEach((s) => observer.observe(s));
}

filterBtn.addEventListener('click', () => {
  onlySaved = !onlySaved;
  filterBtn.classList.toggle('active', onlySaved);
  renderFeed(false);
});

shuffleBtn.addEventListener('click', () => {
  feedEl.scrollTo({ top: 0, behavior: 'smooth' });
  renderFeed(true);
});

init();
