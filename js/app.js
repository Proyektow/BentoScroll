import { getAllStates, updateCardState } from './db.js';
import { renderGame } from './games.js';

const feedEl = document.getElementById('feed');
const statSeenEl = document.getElementById('stat-seen');
const statSavedEl = document.getElementById('stat-saved');
const filterBtn = document.getElementById('btn-saved-filter');

let allCards = [];
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
  statSeenEl.textContent = `${seen} vistas`;
  statSavedEl.textContent = saved;
}

function renderFeed() {
  feedEl.innerHTML = '';
  const list = onlySaved
    ? allCards.filter((c) => statesMap.get(c.id)?.saved)
    : allCards;

  if (list.length === 0) {
    feedEl.innerHTML = `
      <section class="slide">
        <div class="bento-card" style="justify-content:center;align-items:center;text-align:center">
          <p class="bento-text">No tienes tarjetas guardadas todavía.</p>
        </div>
      </section>`;
    return;
  }

  list.forEach((card) => {
    const st = statesMap.get(card.id) || { seen: false, saved: false };
    const slide = document.createElement('section');
    slide.className = 'slide';
    slide.dataset.id = card.id;

    slide.innerHTML = `
      <article class="bento-card">
        <div class="bento-meta">
          <span class="tag">${card.category}</span>
          <span>${card.type === 'game' ? 'Micro-reto' : '30 seg'}</span>
        </div>
        <div class="bento-body">
          <h2 class="bento-title">${card.title}</h2>
          ${card.text ? `<p class="bento-text">${card.text}</p>` : ''}
          <div class="dynamic-slot"></div>
          ${card.deep ? `<div class="bento-deep">${card.deep}</div>` : ''}
        </div>
        <div class="bento-footer">
          ${card.deep ? `<button class="action-btn btn-deep">Profundizar</button>` : ''}
          <button class="action-btn btn-save ${st.saved ? 'primary' : ''}">
            ${st.saved ? 'Guardado' : 'Guardar'}
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
    } else if (card.type === 'game') {
      renderGame(slot, card.gameType);
    }

    const deepBtn = slide.querySelector('.btn-deep');
    if (deepBtn) {
      deepBtn.addEventListener('click', () => {
        const box = slide.querySelector('.bento-deep');
        box.classList.toggle('open');
        deepBtn.textContent = box.classList.contains('open') ? 'Ocultar' : 'Profundizar';
      });
    }

    const saveBtn = slide.querySelector('.btn-save');
    saveBtn.addEventListener('click', async () => {
      const current = statesMap.get(card.id)?.saved || false;
      const updated = await updateCardState(card.id, { saved: !current });
      statesMap.set(card.id, updated);
      saveBtn.classList.toggle('primary', updated.saved);
      saveBtn.textContent = updated.saved ? 'Guardado' : 'Guardar';
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
  renderFeed();
});

init();
