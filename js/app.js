import { getAllStates, updateCardState, getDynamicCards, saveDynamicCards } from './db.js';
import { renderGame } from './games.js';
import { startScanner, stopScanner } from './scanner.js';
import { renderVault } from './vault.js';
import { startLab, stopLab } from './lab.js';
import { renderFogMap } from './fog.js';

const feedEl = document.getElementById('feed');
const progressTrackEl = document.getElementById('progress-track');
const statSeenEl = document.getElementById('stat-seen');
const shuffleBtn = document.getElementById('btn-shuffle');
const syncBtn = document.getElementById('btn-sync');
const syncLabel = document.getElementById('sync-label');

const navItems = document.querySelectorAll('.nav-item');
const views = document.querySelectorAll('.view');

let baseCards = [];
let allCards = [];
let currentList = [];
let statesMap = new Map();

const WIKI_CATEGORIES = [
  { key: 'Inteligencia_artificial', label: 'IA · WIKI' },
  { key: 'Hardware', label: 'HARDWARE · WIKI' },
  { key: 'Ciberseguridad', label: 'SEGURIDAD · WIKI' },
  { key: 'Robótica', label: 'ROBÓTICA · WIKI' },
  { key: 'Algoritmos', label: 'ALGORITMOS · WIKI' }
];

async function init() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }

  const res = await fetch('./data/pack.json');
  baseCards = await res.json();

  const states = await getAllStates();
  states.forEach((s) => statesMap.set(s.id, s));

  await rebuildAllCards();
  updateHud();
  renderFeed();

  if (navigator.onLine) {
    const dyn = await getDynamicCards();
    if (dyn.length < 5) syncOnlinePills(true);
  }
}

async function rebuildAllCards() {
  const dynCards = await getDynamicCards();
  allCards = [...baseCards, ...dynCards];
}

async function syncOnlinePills(silent = false) {
  if (!navigator.onLine) {
    if (!silent) {
      syncLabel.textContent = 'SIN RED';
      setTimeout(() => (syncLabel.textContent = 'RED +'), 1500);
    }
    return;
  }

  syncLabel.textContent = '...';

  try {
    const cat = WIKI_CATEGORIES[Math.floor(Math.random() * WIKI_CATEGORIES.length)];
    const url = `https://es.wikipedia.org/w/api.php?action=query&generator=categorymembers&gcmtitle=Categor%C3%ADa:${cat.key}&gcmlimit=25&gcmtype=page&prop=extracts&exintro=1&explaintext=1&format=json&origin=*`;
    const res = await fetch(url);
    const data = await res.json();
    const pages = Object.values(data?.query?.pages || {});

    const validPages = pages
      .filter((p) => p.extract && p.extract.length > 140 && !p.title.includes(':'))
      .sort(() => Math.random() - 0.5)
      .slice(0, 5);

    const newCards = validPages.map((p) => {
      const clean = p.extract.replace(/\s+/g, ' ').trim();
      const sentences = clean.split(/(?<=[.!?])\s+/);
      const shortText = sentences.slice(0, 2).join(' ').slice(0, 260);
      const deepText = sentences.slice(2, 5).join(' ').slice(0, 340);

      return {
        id: 'wiki_' + p.pageid,
        type: 'spark',
        isOnline: true,
        category: cat.label,
        title: p.title,
        text: shortText,
        deep: deepText || 'Descargado automáticamente para lectura offline.'
      };
    });

    if (newCards.length > 0) {
      await saveDynamicCards(newCards);
      await rebuildAllCards();
      renderFeed(true);
      syncLabel.textContent = silent ? 'RED +' : `+${newCards.length}`;
      if (!silent) setTimeout(() => (syncLabel.textContent = 'RED +'), 1600);
    } else {
      syncLabel.textContent = 'RED +';
    }
  } catch (err) {
    syncLabel.textContent = 'ERROR';
    setTimeout(() => (syncLabel.textContent = 'RED +'), 1500);
  }
}

navItems.forEach((btn) => {
  btn.addEventListener('click', () => {
    const targetId = btn.dataset.target;
    navItems.forEach((n) => n.classList.remove('active'));
    btn.classList.add('active');
    views.forEach((v) => v.classList.toggle('active', v.id === targetId));

    if (targetId === 'view-scanner') startScanner();
    else stopScanner();

    if (targetId === 'view-lab') startLab();
    else stopLab();

    if (targetId === 'view-fog') renderFogMap();
    if (targetId === 'view-vault') renderVault(allCards);
  });
});

function updateHud() {
  let seen = 0;
  statesMap.forEach((s) => {
    if (s.seen) seen++;
  });
  statSeenEl.textContent = `${seen} LEÍDAS · OFFLINE`;
}

function renderProgressSegments(count, activeIdx = 0) {
  progressTrackEl.innerHTML = '';
  const visibleCount = Math.min(count, 20);
  for (let i = 0; i < visibleCount; i++) {
    const seg = document.createElement('div');
    seg.className = 'prog-seg';
    const mappedIdx = activeIdx % visibleCount;
    if (i < mappedIdx) seg.classList.add('done');
    if (i === mappedIdx) seg.classList.add('current');
    progressTrackEl.appendChild(seg);
  }
}

function renderFeed(shuffle = false) {
  feedEl.innerHTML = '';
  let list = [...allCards];

  if (shuffle && list.length > 1) {
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
  }

  currentList = list;
  renderProgressSegments(list.length, 0);

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
          <span class="tag">${card.category}</span>
          <span class="time-pill">${isGame ? 'RETO' : 'OFFLINE'}</span>
        </div>
        <div class="bento-body">
          <h2 class="bento-title">${card.title}</h2>
          ${card.text ? `<p class="bento-text">${card.text}</p>` : ''}
          ${card.highlight ? `<div class="bento-highlight">${card.highlight}</div>` : ''}
          <div class="dynamic-slot"></div>
          ${card.deep ? `<div class="bento-deep">${card.deep}</div>` : ''}
        </div>
        <div class="bento-footer">
          ${card.deep ? `<button class="action-btn btn-deep">DATO TÉCNICO</button>` : ''}
          <button class="action-btn btn-save ${st.saved ? 'saved-state' : ''}">
            ${st.saved ? '★ EN BÓVEDA' : '☆ GUARDAR'}
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
          if (idx !== card.answer) grid.children[card.answer].classList.add('correct');
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
        deepBtn.textContent = box.classList.contains('open') ? 'OCULTAR' : 'DATO TÉCNICO';
      });
    }

    const saveBtn = slide.querySelector('.btn-save');
    saveBtn.addEventListener('click', async () => {
      const current = statesMap.get(card.id)?.saved || false;
      const updated = await updateCardState(card.id, { saved: !current });
      statesMap.set(card.id, updated);
      saveBtn.classList.toggle('saved-state', updated.saved);
      saveBtn.textContent = updated.saved ? '★ EN BÓVEDA' : '☆ GUARDAR';
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

shuffleBtn.addEventListener('click', () => {
  feedEl.scrollTo({ top: 0, behavior: 'smooth' });
  renderFeed(true);
});

syncBtn.addEventListener('click', () => syncOnlinePills(false));

init();
