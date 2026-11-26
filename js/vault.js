import { getAllCaptures, deleteCapture, getAllStates, saveCapture, updateCardState, getAllFogPoints, addFogPoint } from './db.js';

const vaultGrid = document.getElementById('vault-grid');
const vaultSummary = document.getElementById('vault-summary');
const vTabs = document.querySelectorAll('.v-tab');

const modal = document.getElementById('capture-modal');
const modalImg = document.getElementById('modal-img');
const modalPalette = document.getElementById('modal-palette');
const modalMeta = document.getElementById('modal-meta');
const modalClose = document.getElementById('modal-close');
const modalDelete = document.getElementById('modal-delete');
const modalShare = document.getElementById('modal-share');

let activeTab = 'captures';
let selectedCapture = null;
let cachedCards = [];

export async function renderVault(allCards = []) {
  if (allCards.length) cachedCards = allCards;
  const captures = await getAllCaptures();
  const states = await getAllStates();
  const savedIds = new Set(states.filter((s) => s.saved).map((s) => s.id));
  const savedSparks = cachedCards.filter((c) => savedIds.has(c.id));

  vaultSummary.textContent = `${captures.length} CAPTURAS · ${savedSparks.length} PÍLDORAS`;
  vaultGrid.innerHTML = '';

  const backupBar = document.createElement('div');
  backupBar.className = 'backup-bar';
  backupBar.innerHTML = `
    <button id="btn-export-backup" class="action-btn">↓ EXPORTAR BACKUP</button>
    <label class="action-btn" style="cursor:pointer">
      ↑ IMPORTAR BACKUP
      <input type="file" id="input-import-backup" accept=".json" style="display:none" />
    </label>
  `;
  vaultGrid.parentElement.querySelector('.backup-bar')?.remove();
  vaultGrid.before(backupBar);

  backupBar.querySelector('#btn-export-backup').addEventListener('click', exportBackup);
  backupBar.querySelector('#input-import-backup').addEventListener('change', importBackup);

  if (activeTab === 'captures') {
    vaultGrid.className = 'vault-grid captures-mode';
    if (captures.length === 0) {
      vaultGrid.innerHTML = `<p class="empty-msg">SIN CAPTURAS AÚN.<br>LAS FOTOS DE BENTO ÓPTICA NUNCA VAN A TU GALERÍA.</p>`;
      return;
    }

    captures.forEach((cap) => {
      const item = document.createElement('div');
      item.className = 'vault-photo-card';
      item.innerHTML = `
        <img src="${cap.image}" alt="Captura" loading="lazy" />
        <div class="mini-pal">
          ${cap.palette.map((c) => `<span style="background:${c}"></span>`).join('')}
        </div>
      `;
      item.addEventListener('click', () => openCaptureModal(cap));
      vaultGrid.appendChild(item);
    });
  } else {
    vaultGrid.className = 'vault-grid sparks-mode';
    if (savedSparks.length === 0) {
      vaultGrid.innerHTML = `<p class="empty-msg">NO TIENES PÍLDORAS GUARDADAS DESDE EL FEED.</p>`;
      return;
    }

    savedSparks.forEach((card) => {
      const item = document.createElement('div');
      item.className = 'vault-spark-card';
      item.innerHTML = `
        <span class="tag">${card.category}</span>
        <h3>${card.title}</h3>
        <p>${card.text || card.deep || ''}</p>
      `;
      vaultGrid.appendChild(item);
    });
  }
}

async function exportBackup() {
  const payload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    captures: await getAllCaptures(),
    states: await getAllStates(),
    fogPoints: await getAllFogPoints()
  };
  const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `bentoscroll-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

async function importBackup(e) {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (Array.isArray(data.captures)) for (const cap of data.captures) await saveCapture(cap);
    if (Array.isArray(data.states)) for (const st of data.states) await updateCardState(st.id, st);
    if (Array.isArray(data.fogPoints)) for (const pt of data.fogPoints) await addFogPoint(pt);
    renderVault();
  } catch (err) {
    alert('Archivo de backup no válido.');
  }
}

function openCaptureModal(cap) {
  selectedCapture = cap;
  modalImg.src = cap.image;
  modalPalette.innerHTML = cap.palette
    .map((hex) => `<div class="swatch" style="background:${hex}"><span>${hex}</span></div>`)
    .join('');
  const dateStr = new Date(cap.createdAt).toLocaleString('es-ES', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  });
  modalMeta.textContent = `MODO: ${cap.filter.toUpperCase()} · ${dateStr} · SOLO LOCAL`;
  modal.classList.remove('hidden');
}

modalClose.addEventListener('click', () => modal.classList.add('hidden'));

modalDelete.addEventListener('click', async () => {
  if (!selectedCapture) return;
  await deleteCapture(selectedCapture.id);
  modal.classList.add('hidden');
  renderVault();
});

modalShare.addEventListener('click', async () => {
  if (!selectedCapture) return;
  try {
    const res = await fetch(selectedCapture.image);
    const blob = await res.blob();
    const file = new File([blob], `${selectedCapture.id}.webp`, { type: 'image/webp' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        files: [file],
        title: 'BentoScroll',
        text: `Paleta: ${selectedCapture.palette.join(', ')}`
      });
    } else {
      const a = document.createElement('a');
      a.href = selectedCapture.image;
      a.download = `${selectedCapture.id}.webp`;
      a.click();
    }
  } catch (e) {}
});

vTabs.forEach((tab) => {
  tab.addEventListener('click', () => {
    vTabs.forEach((t) => t.classList.remove('active'));
    tab.classList.add('active');
    activeTab = tab.dataset.vtab;
    renderVault();
  });
});
