// ============================================================================
// CONSTANTES
// ============================================================================
const DAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const DEFAULT_CATEGORIES = [
  { id: "foco", name: "Foco / Trabalho", color: "#C9A24B" },
  { id: "rotina", name: "Rotina pessoal", color: "#5B7A99" },
  { id: "compromissos", name: "Compromissos", color: "#C1633D" },
  { id: "descanso", name: "Descanso", color: "#4C8C86" },
];
const STORAGE_KEY = "time-ledger:v1";
const TOTAL_CELLS = 16 * 7;

// ============================================================================
// FUNÇÕES AUXILIARES
// ============================================================================
function pad(n) { return n.toString().padStart(2, "0"); }
function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// ============================================================================
// ESTADO (persistido em localStorage)
// ============================================================================
let state = {
  startHour: 6,
  categories: DEFAULT_CATEGORIES,
  cells: {},
  locked: false,
};
let activeCat = DEFAULT_CATEGORIES[0].id;
let showAddForm = false;
let newCatColor = "#8FA6B3";
let showTips = false;

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (typeof data.startHour === "number") state.startHour = data.startHour;
      if (Array.isArray(data.categories) && data.categories.length) state.categories = data.categories;
      if (data.cells && typeof data.cells === "object") state.cells = data.cells;
      if (typeof data.locked === "boolean") state.locked = data.locked;
      if (!state.categories.find((c) => c.id === activeCat)) {
        activeCat = state.categories.length ? state.categories[0].id : null;
      }
    }
  } catch (e) {
    // sem dados salvos ainda — segue com os padrões
  }
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    // armazenamento indisponível (ex: modo privado) — segue sem persistir
  }
}

// ============================================================================
// PINTURA DAS CÉLULAS (Pointer Events — funciona com dedo e mouse)
// ============================================================================
let painting = false;
let paintValue = null;

function paintCell(key, value) {
  const current = state.cells[key] ?? null;
  if (current === value) return;
  if (value === null) delete state.cells[key];
  else state.cells[key] = value;
  saveState();
  render();
}

function onCellPointerDown(key) {
  return (e) => {
    if (state.locked) return;
    e.preventDefault();
    const isEraser = activeCat === null;
    const value = isEraser ? null : state.cells[key] === activeCat ? null : activeCat;
    painting = true;
    paintValue = value;
    paintCell(key, value);
  };
}

window.addEventListener("pointermove", (e) => {
  if (!painting) return;
  const el = document.elementFromPoint(e.clientX, e.clientY);
  const key = el?.dataset?.key;
  if (key) paintCell(key, paintValue);
});
window.addEventListener("pointerup", () => { painting = false; });
window.addEventListener("pointercancel", () => { painting = false; });

// ============================================================================
// AÇÕES
// ============================================================================
function toggleLocked() {
  state.locked = !state.locked;
  if (state.locked) showAddForm = false;
  saveState();
  render();
}

function addCategory(name, color) {
  const trimmed = name.trim();
  if (!trimmed) return;
  const id = `cat-${Date.now()}`;
  state.categories.push({ id, name: trimmed, color });
  activeCat = id;
  showAddForm = false;
  newCatColor = "#8FA6B3";
  saveState();
  render();
}

function removeCategory(id) {
  state.categories = state.categories.filter((c) => c.id !== id);
  const nextCells = {};
  for (const k in state.cells) if (state.cells[k] !== id) nextCells[k] = state.cells[k];
  state.cells = nextCells;
  if (activeCat === id) activeCat = state.categories.length ? state.categories[0].id : null;
  saveState();
  render();
}

// ============================================================================
// RENDER
// ============================================================================
function render() {
  const root = document.getElementById("root");
  const hours = Array.from({ length: 16 }, (_, i) => (state.startHour + i) % 24);
  const filledCount = Object.keys(state.cells).length;
  const freeCount = TOTAL_CELLS - filledCount;
  const summary = state.categories.map((c) => ({
    ...c,
    count: Object.values(state.cells).filter((v) => v === c.id).length,
  }));

  root.innerHTML = `
    <button class="tl-lock-btn ${state.locked ? "active" : ""}" id="lockBtn"
      aria-label="${state.locked ? "Desativar modo somente leitura" : "Ativar modo somente leitura"}"
      title="${state.locked ? "Desativar modo somente leitura" : "Ativar modo somente leitura"}">
      ${state.locked ? "🔒" : "🔓"}
    </button>

    <div class="tl-header-block">
      <p class="tl-eyebrow">Diário de 112 horas</p>
      <h1 class="tl-title">Livro-razão do tempo</h1>
      <p class="tl-subtitle">16 horas por dia, 7 dias por semana. Cada quadrado é uma hora sua — toque para escolher uma categoria e pintar.</p>
      ${state.locked ? `<span class="tl-readonly-badge">🔒 somente leitura</span>` : ""}
    </div>

    <div class="tl-hero">
      <div class="tl-hero-top">
        <span class="tl-hero-label">Semana planejada</span>
        <span class="tl-hero-value">${filledCount} / ${TOTAL_CELLS} h</span>
      </div>
      <div class="tl-hero-bar">
        ${summary.map((c) => c.count > 0 ? `<div class="tl-hero-seg" style="width:${(c.count / TOTAL_CELLS) * 100}%;background:${c.color}" title="${esc(c.name)}: ${c.count}h"></div>` : "").join("")}
        ${freeCount > 0 ? `<div class="tl-hero-seg" style="width:${(freeCount / TOTAL_CELLS) * 100}%;background:transparent"></div>` : ""}
      </div>
    </div>

    <div class="tl-toolbar ${state.locked ? "tl-disabled" : ""}">
      ${state.categories.map((c) => `
        <button class="tl-chip ${activeCat === c.id ? "active" : ""}" data-setcat="${c.id}">
          <span class="tl-swatch" style="background:${c.color}"></span>
          ${esc(c.name)}
          <span class="tl-chip-x" data-removecat="${c.id}">×</span>
        </button>
      `).join("")}
      <button class="tl-chip tl-chip-eraser ${activeCat === null ? "active" : ""}" id="eraserBtn">␡ Borracha</button>
      ${!showAddForm ? `<button class="tl-add-btn" id="showAddBtn">+ nova categoria</button>` : ""}
      <span class="tl-wake-row">
        <label class="tl-hero-label" style="font-size:11px">acorda às</label>
        <select class="tl-hour-select" id="hourSelect" ${state.locked ? "disabled" : ""}>
          ${Array.from({ length: 24 }, (_, h) => `<option value="${h}" ${h === state.startHour ? "selected" : ""}>${pad(h)}:00</option>`).join("")}
        </select>
      </span>
    </div>

    ${showAddForm ? `
      <div class="tl-add-form">
        <input type="color" id="newCatColor" value="${newCatColor}">
        <input type="text" id="newCatName" placeholder="nome da categoria (ex: Estudo, Exercício...)">
        <button id="addCatBtn">Adicionar</button>
      </div>
    ` : ""}

    <div class="tl-grid-wrap">
      <div class="tl-grid ${state.locked ? "tl-disabled" : ""}">
        <div class="tl-corner"></div>
        ${DAYS.map((d) => `<div class="tl-day-label">${d}</div>`).join("")}
        ${hours.map((h) => `
          <div class="tl-hour-label">${pad(h)}:00</div>
          ${DAYS.map((_, dayIdx) => {
            const key = `${dayIdx}-${h}`;
            const catId = state.cells[key];
            const cat = state.categories.find((c) => c.id === catId);
            const style = cat ? `background:${cat.color};border-color:${cat.color}` : "";
            return `<div class="tl-cell" data-key="${key}" style="${style}" title="${cat ? esc(cat.name) : "vazio"}"></div>`;
          }).join("")}
        `).join("")}
      </div>
    </div>

    <div class="tl-summary">
      ${summary.map((c) => `
        <div class="tl-summary-item">
          <div class="tl-summary-name"><span class="tl-swatch" style="background:${c.color}"></span>${esc(c.name)}</div>
          <div class="tl-summary-hours">${c.count}h <span>(${Math.round((c.count / TOTAL_CELLS) * 100)}%)</span></div>
        </div>
      `).join("")}
      <div class="tl-summary-item">
        <div class="tl-summary-name">Livre</div>
        <div class="tl-summary-hours">${freeCount}h <span>(${Math.round((freeCount / TOTAL_CELLS) * 100)}%)</span></div>
      </div>
    </div>

    <div class="tl-tips">
      <button class="tl-tips-toggle" id="tipsToggle">${showTips ? "− ocultar" : "+ boas práticas de gestão do tempo"}</button>
      ${showTips ? `
        <ul class="tl-tips-list">
          <li><strong>Bloqueie antes de listar.</strong> Reserve primeiro os blocos fixos (sono, compromissos, refeições) e só depois distribua o resto.</li>
          <li><strong>Regra 80/20.</strong> Identifique as poucas atividades que geram a maior parte dos seus resultados e proteja esses blocos como prioridade.</li>
          <li><strong>Agrupe tarefas parecidas.</strong> Trocar de contexto o tempo todo custa energia; junte tarefas semelhantes em blocos seguidos.</li>
          <li><strong>Deixe folga de propósito.</strong> Uma semana 100% preenchida quebra fácil — mantenha algumas horas livres para imprevistos.</li>
          <li><strong>Revise no fim da semana.</strong> Compare o planejado com o que realmente aconteceu e ajuste os blocos da próxima semana.</li>
        </ul>
      ` : ""}
    </div>
  `;

  attachListeners();
}

function attachListeners() {
  const root = document.getElementById("root");

  document.getElementById("lockBtn").addEventListener("click", toggleLocked);

  root.querySelectorAll("[data-setcat]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      if (e.target.closest("[data-removecat]")) return;
      activeCat = btn.getAttribute("data-setcat");
      render();
    });
  });

  root.querySelectorAll("[data-removecat]").forEach((el) => {
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      removeCategory(el.getAttribute("data-removecat"));
    });
  });

  const eraserBtn = document.getElementById("eraserBtn");
  if (eraserBtn) eraserBtn.addEventListener("click", () => { activeCat = null; render(); });

  const showAddBtn = document.getElementById("showAddBtn");
  if (showAddBtn) showAddBtn.addEventListener("click", () => { showAddForm = true; render(); });

  const hourSelect = document.getElementById("hourSelect");
  if (hourSelect) hourSelect.addEventListener("change", (e) => {
    state.startHour = Number(e.target.value);
    saveState();
    render();
  });

  const newCatColorInput = document.getElementById("newCatColor");
  if (newCatColorInput) newCatColorInput.addEventListener("input", (e) => { newCatColor = e.target.value; });

  const newCatNameInput = document.getElementById("newCatName");
  if (newCatNameInput) {
    newCatNameInput.focus();
    newCatNameInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") addCategory(newCatNameInput.value, newCatColor);
    });
  }

  const addCatBtn = document.getElementById("addCatBtn");
  if (addCatBtn) addCatBtn.addEventListener("click", () => {
    addCategory(newCatNameInput.value, newCatColor);
  });

  const tipsToggle = document.getElementById("tipsToggle");
  tipsToggle.addEventListener("click", () => { showTips = !showTips; render(); });

  root.querySelectorAll(".tl-cell").forEach((cell) => {
    cell.addEventListener("pointerdown", onCellPointerDown(cell.getAttribute("data-key")));
  });
}

// ============================================================================
// INICIALIZAÇÃO
// ============================================================================
loadState();
render();

// Registra o service worker (funcionamento offline como app instalado)
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}
