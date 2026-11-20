'use strict';

const KEY = 'treino-diario-v1';
const RING_LEN = 2 * Math.PI * 52;
const ACTIVITIES = ['Musculação', 'Corrida', 'Caminhada', 'Bicicleta', 'Natação', 'Funcional', 'Alongamento', 'Outro'];

// ---------- estado ----------
function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s && s.days) return s;
  } catch (_) {}
  return { goal: 90, reminder: '19:00', days: {}, running: null, notified: {} };
}
let state = load();
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (_) {}
}

// ---------- utilitários ----------
function dayKey(d = new Date()) {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}
function fmtHM(min) {
  min = Math.round(min);
  return `${Math.floor(min / 60)}:${String(min % 60).padStart(2, '0')}`;
}
function fmtHMS(ms) {
  const s = Math.floor(ms / 1000);
  return [Math.floor(s / 3600), Math.floor(s / 60) % 60, s % 60].map(n => String(n).padStart(2, '0')).join(':');
}
function sessions(key) { return state.days[key] || []; }
function runningMin() {
  return state.running ? (Date.now() - state.running.start) / 60000 : 0;
}
function totalMin(key) {
  let t = sessions(key).reduce((a, s) => a + s.min, 0);
  if (key === dayKey() && state.running) t += runningMin();
  return t;
}
function addSession(activity, min, at = Date.now()) {
  const k = dayKey(new Date(at));
  (state.days[k] ||= []).push({ activity, min, at });
  save();
}
function streak() {
  let n = 0;
  const d = new Date();
  // hoje conta se já bateu; se não, começa de ontem sem quebrar a sequência
  if (totalMin(dayKey(d)) < state.goal) d.setDate(d.getDate() - 1);
  while (totalMin(dayKey(d)) >= state.goal) { n++; d.setDate(d.getDate() - 1); }
  return n;
}

// ---------- elementos ----------
const $ = id => document.getElementById(id);
const els = {
  todayLabel: $('today-label'), done: $('done-text'), goal: $('goal-text'), left: $('left-text'),
  ring: $('ring-fg'), timer: $('timer'), activity: $('activity'), start: $('start-btn'), stop: $('stop-btn'),
  manualForm: $('manual-form'), manualAct: $('manual-activity'), manualMin: $('manual-min'),
  list: $('today-list'), week: $('week'), streak: $('streak'),
  goalInput: $('goal-input'), reminderInput: $('reminder-input'), notifBtn: $('notif-btn'),
};
ACTIVITIES.forEach(a => els.manualAct.add(new Option(a)));

// ---------- render ----------
function render() {
  const today = dayKey();
  const done = totalMin(today);
  const pct = Math.min(done / state.goal, 1);

  els.todayLabel.textContent = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  els.done.textContent = fmtHM(done);
  els.goal.textContent = fmtHM(state.goal);
  els.ring.style.strokeDasharray = RING_LEN;
  els.ring.style.strokeDashoffset = RING_LEN * (1 - pct);
  els.left.textContent = done >= state.goal ? '✅ Meta batida!' : `faltam ${fmtHM(state.goal - done)}`;

  const r = state.running;
  els.timer.textContent = r ? fmtHMS(Date.now() - r.start) : '00:00:00';
  els.start.disabled = !!r;
  els.stop.disabled = !r;
  els.activity.disabled = !!r;
  if (r) els.activity.value = r.activity;

  els.list.innerHTML = '';
  const list = sessions(today);
  if (!list.length && !r) {
    els.list.innerHTML = '<li class="muted">Nenhum treino ainda hoje.</li>';
  }
  list.forEach((s, i) => {
    const li = document.createElement('li');
    const time = new Date(s.at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    li.innerHTML = `<span>${s.activity} <span class="muted small">· ${time}</span></span>
      <span>${fmtHM(s.min)} <button class="del" data-i="${i}" aria-label="Remover">✕</button></span>`;
    els.list.appendChild(li);
  });
  if (r) {
    const li = document.createElement('li');
    li.innerHTML = `<span>${r.activity} <span class="muted small">· em andamento</span></span><span>${fmtHM(runningMin())}</span>`;
    els.list.appendChild(li);
  }

  els.week.innerHTML = '';
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const m = totalMin(dayKey(d));
    const h = Math.min(m / state.goal, 1) * 100;
    const div = document.createElement('div');
    div.className = 'day';
    div.title = `${fmtHM(m)}`;
    div.innerHTML = `<div class="bar-wrap"><div class="bar ${m >= state.goal ? 'hit' : ''}" style="height:${h}%"></div></div>
      <span>${d.toLocaleDateString('pt-BR', { weekday: 'short' }).slice(0, 3)}</span>`;
    els.week.appendChild(div);
  }
  const s = streak();
  els.streak.textContent = `🔥 ${s} ${s === 1 ? 'dia' : 'dias'}`;

  if (document.activeElement !== els.goalInput) els.goalInput.value = state.goal;
  if (document.activeElement !== els.reminderInput) els.reminderInput.value = state.reminder;
  els.notifBtn.hidden = !('Notification' in window) || Notification.permission === 'granted';

  checkNotifications(done);
}

// ---------- notificações ----------
function notify(title, body) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  if (navigator.serviceWorker?.controller) {
    navigator.serviceWorker.ready.then(reg => reg.showNotification(title, { body, icon: 'icon.svg' }));
  } else {
    new Notification(title, { body, icon: 'icon.svg' });
  }
}
function checkNotifications(done) {
  const today = dayKey();
  const n = (state.notified[today] ||= {});
  if (done >= state.goal && !n.goal) {
    n.goal = true; save();
    notify('Meta batida! 💪', `Você fez ${fmtHM(done)} de exercício hoje.`);
  }
  const now = new Date();
  const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  if (state.reminder && hhmm >= state.reminder && done < state.goal && !n.reminder && !state.running) {
    n.reminder = true; save();
    notify('Bora treinar!', `Ainda faltam ${fmtHM(state.goal - done)} para a meta de hoje.`);
  }
}

// ---------- eventos ----------
els.start.onclick = () => {
  state.running = { start: Date.now(), activity: els.activity.value };
  save(); render();
};
els.stop.onclick = () => {
  const r = state.running;
  if (!r) return;
  const min = Math.round((Date.now() - r.start) / 60000);
  state.running = null;
  if (min >= 1) addSession(r.activity, min, r.start);
  save(); render();
};
els.manualForm.onsubmit = e => {
  e.preventDefault();
  const min = parseInt(els.manualMin.value, 10);
  if (!(min > 0)) return;
  addSession(els.manualAct.value, min);
  els.manualMin.value = '';
  render();
};
els.list.onclick = e => {
  const b = e.target.closest('.del');
  if (!b) return;
  if (!confirm('Remover este treino?')) return;
  sessions(dayKey()).splice(+b.dataset.i, 1);
  save(); render();
};
els.goalInput.onchange = () => {
  const v = parseInt(els.goalInput.value, 10);
  if (v >= 10) { state.goal = v; save(); render(); }
};
els.reminderInput.onchange = () => {
  state.reminder = els.reminderInput.value;
  delete (state.notified[dayKey()] || {}).reminder;
  save(); render();
};
els.notifBtn.onclick = async () => {
  if ('Notification' in window) await Notification.requestPermission();
  render();
};

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

render();
setInterval(render, 1000);
document.addEventListener('visibilitychange', render);
