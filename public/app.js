// ═══════════════════════════════════════════════════════
//  HomeTasks – Frontend SPA with Laravel API
// ═══════════════════════════════════════════════════════

// ── CONFIG ─────────────────────────────────────────────
// Works for both virtual host (hometasks.test) and subdirectory (localhost/hometasks/public)
const BASE = (() => {
  const dir = window.location.pathname.replace(/\/[^/]*$/, ''); // strip filename
  return window.location.origin + dir + '/api';
})();

// ── STATE ──────────────────────────────────────────────
let state = {
  user:         null,
  token:        localStorage.getItem('ht_token') || null,
  homes:        [],
  currentHome:  null,
  members:      [],
  tasks:        [],
  payments:     [],
  incidents:    [],
  currentView:  'dashboard',
  filters:      { tasks:'all', payments:'all', incidents:'all' },
  catFilters:   { tasks:'all', incidents:'all' },
  editingId:    null,
  editingType:  null,
  calendarDate: new Date(),
};

// ── API HELPERS ────────────────────────────────────────
async function api(method, path, body = null) {
  const opts = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
  };
  if (state.token) opts.headers['Authorization'] = 'Bearer ' + state.token;
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(BASE + path, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw data;
  return data;
}

const GET    = (p)    => api('GET', p);
const POST   = (p, b) => api('POST', p, b);
const PUT    = (p, b) => api('PUT', p, b);
const DELETE = (p)    => api('DELETE', p);

// ── LOADING ────────────────────────────────────────────
function showLoading()  { document.getElementById('loading-overlay').classList.add('active'); }
function hideLoading()  { document.getElementById('loading-overlay').classList.remove('active'); }

// ── AUTH SCREENS ───────────────────────────────────────
function showAuthView(view) {
  document.getElementById('auth-login').style.display    = view === 'login'    ? 'block' : 'none';
  document.getElementById('auth-register').style.display = view === 'register' ? 'block' : 'none';
  document.getElementById('auth-join').style.display     = view === 'join'     ? 'block' : 'none';
  // Clear errors
  ['login-error','register-error','join-error'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
}

function showError(id, msg) {
  const el = document.getElementById(id);
  if (el) { el.textContent = msg; el.style.display = 'block'; }
}

async function doLogin() {
  const btn   = document.getElementById('btn-login');
  const email = document.getElementById('login-email').value.trim();
  const pass  = document.getElementById('login-password').value;
  if (!email || !pass) { showError('login-error', 'Por favor completa todos los campos'); return; }
  btn.disabled = true; btn.textContent = 'Entrando…';
  try {
    const data = await POST('/login', { email, password: pass });
    state.token = data.token;
    state.user  = data.user;
    state.homes = data.homes || [];
    localStorage.setItem('ht_token', data.token);
    enterApp();
  } catch (e) {
    showError('login-error', e?.errors?.email?.[0] || e?.message || 'Error al iniciar sesión');
  } finally {
    btn.disabled = false; btn.textContent = 'Iniciar Sesión';
  }
}

async function doRegister() {
  const btn = document.getElementById('btn-register');
  const name  = document.getElementById('reg-name').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  const pass  = document.getElementById('reg-password').value;
  const conf  = document.getElementById('reg-password-confirm').value;
  if (!name || !email || !pass) { showError('register-error', 'Por favor completa todos los campos'); return; }
  if (pass !== conf) { showError('register-error', 'Las contraseñas no coinciden'); return; }
  if (pass.length < 8) { showError('register-error', 'La contraseña debe tener al menos 8 caracteres'); return; }
  btn.disabled = true; btn.textContent = 'Creando cuenta…';
  try {
    const data = await POST('/register', {
      name, email, password: pass, password_confirmation: conf,
    });
    state.token = data.token;
    state.user  = data.user;
    state.homes = [data.home];
    localStorage.setItem('ht_token', data.token);
    enterApp();
    showToast('🎉 ¡Cuenta creada! Bienvenido a HomeTasks', 'success');
  } catch (e) {
    const errs = e?.errors;
    const msg = errs ? Object.values(errs).flat().join(' ') : (e?.message || 'Error al registrar');
    showError('register-error', msg);
  } finally {
    btn.disabled = false; btn.textContent = 'Crear Cuenta';
  }
}

async function doJoinByCode() {
  const btn  = document.getElementById('btn-join');
  const code = document.getElementById('join-code').value.trim().toUpperCase();
  if (!code) { showError('join-error', 'Introduce un código de invitación'); return; }
  if (!state.token) { showError('join-error', 'Debes iniciar sesión primero para unirte'); return; }
  btn.disabled = true; btn.textContent = 'Uniéndose…';
  try {
    const home = await POST('/homes/join', { invite_code: code });
    state.homes.push(home);
    setCurrentHome(home);
    switchView('dashboard');
    showToast(`✅ Te has unido a "${home.name}"!`, 'success');
  } catch (e) {
    showError('join-error', e?.message || 'Código inválido o ya eres miembro');
  } finally {
    btn.disabled = false; btn.textContent = 'Unirse al Hogar';
  }
}

async function doLogout() {
  try { await POST('/logout'); } catch {}
  state.token = null; state.user = null;
  localStorage.removeItem('ht_token');
  document.getElementById('app-screen').style.display  = 'none';
  document.getElementById('auth-screen').style.display = 'flex';
  showAuthView('login');
}

// ── APP ENTRY ──────────────────────────────────────────
async function enterApp() {
  document.getElementById('auth-screen').style.display = 'none';
  document.getElementById('app-screen').style.display  = 'block';

  // Set user info in sidebar
  const u = state.user;
  const initials = u.name.split(' ').map(p => p[0]).join('').slice(0,2).toUpperCase();
  const av = document.getElementById('user-avatar-display');
  av.textContent = initials;
  av.style.background = u.avatar_color || '#6c63ff';
  document.getElementById('sidebar-username').textContent = u.name;
  document.getElementById('sidebar-email').textContent    = u.email;

  // Set current home
  if (state.homes.length > 0) {
    const savedHomeId = localStorage.getItem('ht_current_home');
    const found = savedHomeId ? state.homes.find(h => h.id == savedHomeId) : null;
    setCurrentHome(found || state.homes[0]);
  }

  updateDateDisplay();
  switchView('dashboard');
}

// ── HOME MANAGEMENT ────────────────────────────────────
function setCurrentHome(home) {
  state.currentHome = home;
  localStorage.setItem('ht_current_home', home.id);
  document.getElementById('sel-avatar').textContent = home.avatar_emoji || '🏠';
  document.getElementById('sel-name').textContent   = home.name;
  document.getElementById('members-home-name').textContent = home.name;
  document.getElementById('invite-code-display').textContent = home.invite_code || '–';
  loadHomeData();
  renderHomeDropdown();
}

function renderHomeDropdown() {
  const list = document.getElementById('home-dropdown-list');
  list.innerHTML = state.homes.map(h => `
    <button class="home-dropdown-item ${h.id === state.currentHome?.id ? 'active' : ''}"
            onclick="selectHome(${h.id})">
      <span>${h.avatar_emoji || '🏠'}</span>
      <span>${esc(h.name)}</span>
      ${h.id === state.currentHome?.id ? '<span style="margin-left:auto;font-size:10px;color:var(--accent2)">✓</span>' : ''}
    </button>
  `).join('');
}

function selectHome(id) {
  const home = state.homes.find(h => h.id === id);
  if (home) { setCurrentHome(home); closeHomeDropdown(); }
}

function toggleHomeDropdown() {
  const dd  = document.getElementById('home-dropdown');
  const btn = document.getElementById('home-selector-btn');
  const open = dd.style.display !== 'none';
  dd.style.display = open ? 'none' : 'block';
  btn.classList.toggle('open', !open);
}

function closeHomeDropdown() {
  document.getElementById('home-dropdown').style.display  = 'none';
  document.getElementById('home-selector-btn').classList.remove('open');
}

document.addEventListener('click', e => {
  const wrap = document.getElementById('home-selector-wrap');
  if (wrap && !wrap.contains(e.target)) closeHomeDropdown();
});

async function loadHomeData() {
  if (!state.currentHome) return;
  showLoading();
  try {
    const hId = state.currentHome.id;
    const [tasks, payments, incidents, members] = await Promise.all([
      GET(`/homes/${hId}/tasks`),
      GET(`/homes/${hId}/payments`),
      GET(`/homes/${hId}/incidents`),
      GET(`/homes/${hId}/members`),
    ]);
    state.tasks     = tasks;
    state.payments  = payments;
    state.incidents = incidents;
    state.members   = members;
    render();
  } catch (e) {
    showToast('Error al cargar los datos', 'error');
  } finally {
    hideLoading();
  }
}

// ── NEW HOME MODAL ─────────────────────────────────────
function openNewHomeModal() {
  closeHomeDropdown();
  document.getElementById('modal-title').textContent = '🏠 Nuevo Hogar';
  document.getElementById('modal-body').innerHTML = `
    <div class="form-group">
      <label class="form-label">Nombre del Hogar *</label>
      <input type="text" class="form-input" id="f-home-name" placeholder="Ej: Casa de la familia García"/>
    </div>
    <div class="form-group">
      <label class="form-label">Descripción</label>
      <input type="text" class="form-input" id="f-home-desc" placeholder="Descripción opcional"/>
    </div>
    <div class="form-group">
      <label class="form-label">Icono</label>
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        ${['🏠','🏡','🏢','🏗️','🏘️','🛖'].map(e => `<button type="button" onclick="selectEmoji(this,'${e}')"
          style="font-size:24px;padding:6px;border-radius:8px;border:2px solid var(--border);background:transparent;cursor:pointer" data-emoji="${e}">${e}</button>`).join('')}
      </div>
    </div>
    <div class="form-actions">
      <button class="btn-cancel" onclick="closeModal()">Cancelar</button>
      <button class="btn-submit" onclick="submitNewHome()">💾 Crear Hogar</button>
    </div>`;
  openModal();
}

function selectEmoji(btn, emoji) {
  btn.closest('.form-group').querySelectorAll('button').forEach(b => b.style.borderColor = 'var(--border)');
  btn.style.borderColor = 'var(--accent)';
  btn.closest('.form-group').dataset.selected = emoji;
}

async function submitNewHome() {
  const name = document.getElementById('f-home-name')?.value.trim();
  if (!name) { showToast('El nombre es obligatorio', 'error'); return; }
  const emojiGroup = document.querySelector('[data-selected]');
  const emoji = emojiGroup?.dataset.selected || '🏠';
  const desc  = document.getElementById('f-home-desc')?.value.trim() || '';
  try {
    const home = await POST('/homes', { name, description: desc, avatar_emoji: emoji });
    state.homes.push(home);
    setCurrentHome(home);
    closeModal();
    showToast(`🏠 Hogar "${home.name}" creado!`, 'success');
  } catch (e) {
    showToast(e?.message || 'Error al crear el hogar', 'error');
  }
}

function openJoinHomeModal() {
  closeHomeDropdown();
  document.getElementById('modal-title').textContent = '🔗 Unirse a un Hogar';
  document.getElementById('modal-body').innerHTML = `
    <p style="font-size:13px;color:var(--text-muted);margin-bottom:16px">Introduce el código de invitación que te compartieron</p>
    <div class="form-group">
      <label class="form-label">Código de invitación</label>
      <input type="text" class="form-input" id="f-join-code" placeholder="ABCD1234"
        style="text-transform:uppercase;letter-spacing:0.15em;font-size:20px;font-weight:700;text-align:center"/>
    </div>
    <div class="form-actions">
      <button class="btn-cancel" onclick="closeModal()">Cancelar</button>
      <button class="btn-submit" onclick="submitJoin()">🔗 Unirse</button>
    </div>`;
  openModal();
}

async function submitJoin() {
  const code = document.getElementById('f-join-code')?.value.trim().toUpperCase();
  if (!code) { showToast('Introduce un código', 'error'); return; }
  try {
    const home = await POST('/homes/join', { invite_code: code });
    state.homes.push(home);
    setCurrentHome(home);
    closeModal();
    showToast(`✅ Te has unido a "${home.name}"!`, 'success');
  } catch (e) {
    showToast(e?.message || 'Código inválido', 'error');
  }
}

// ── INVITE / MEMBERS ───────────────────────────────────
function openInviteModal() {
  const homeId = state.currentHome?.id;
  const code   = state.currentHome?.invite_code || '';
  const invUrl = window.location.origin + window.location.pathname.replace(/\/[^/]*$/, '') + '/#join';
  document.getElementById('modal-title').textContent = '📨 Invitar Miembros';
  document.getElementById('modal-body').innerHTML = `
    <div style="margin-bottom:20px">
      <p class="form-label">Opción 1: Compartir código</p>
      <div style="display:flex;align-items:center;gap:10px;margin-top:8px">
        <div style="flex:1;background:rgba(108,99,255,0.1);border:1px solid rgba(108,99,255,0.3);border-radius:8px;padding:12px;text-align:center;font-size:22px;font-weight:800;letter-spacing:0.15em;font-family:monospace;color:var(--accent2)">${esc(code)}</div>
        <button class="inv-btn" onclick="navigator.clipboard.writeText('${esc(code)}').then(()=>showToast('📋 Código copiado','success'))">📋</button>
      </div>
    </div>
    <div style="margin-bottom:20px">
      <p class="form-label">Opción 2: Crear enlace de invitación</p>
      <p style="font-size:12px;color:var(--text-muted);margin-top:6px;margin-bottom:10px">Genera un enlace único válido por 7 días</p>
      <button class="btn-submit" style="width:100%" onclick="createInvitationLink(${homeId})">🔗 Generar Enlace</button>
      <div id="inv-link-result" style="margin-top:12px"></div>
    </div>
    <div class="form-actions" style="margin-top:0">
      <button class="btn-cancel" onclick="closeModal()">Cerrar</button>
    </div>`;
  openModal();
}

async function createInvitationLink(homeId) {
  try {
    const data = await POST(`/homes/${homeId}/invitations`, {});
    const result = document.getElementById('inv-link-result');
    if (result) {
      result.innerHTML = `
        <div style="background:rgba(52,211,153,0.1);border:1px solid rgba(52,211,153,0.3);border-radius:8px;padding:12px">
          <div style="font-size:11px;color:var(--success);font-weight:600;margin-bottom:6px">✅ ENLACE GENERADO (válido 7 días)</div>
          <div style="font-size:12px;word-break:break-all;color:var(--text-dim);margin-bottom:8px">${esc(data.url)}</div>
          <button class="inv-btn" onclick="navigator.clipboard.writeText('${esc(data.url)}').then(()=>showToast('📋 Enlace copiado','success'))">📋 Copiar enlace</button>
        </div>`;
    }
  } catch (e) {
    showToast(e?.message || 'Error al generar enlace', 'error');
  }
}

async function regenerateCode() {
  if (!state.currentHome) return;
  if (!confirm('¿Regenerar el código? El anterior dejará de funcionar.')) return;
  try {
    const data = await POST(`/homes/${state.currentHome.id}/invite-code/regenerate`, {});
    state.currentHome.invite_code = data.invite_code;
    document.getElementById('invite-code-display').textContent = data.invite_code;
    // Update in homes list
    const h = state.homes.find(h => h.id === state.currentHome.id);
    if (h) h.invite_code = data.invite_code;
    showToast('🔄 Código regenerado', 'success');
  } catch (e) {
    showToast('Error al regenerar', 'error');
  }
}

function copyInviteCode() {
  const code = state.currentHome?.invite_code;
  if (code) {
    navigator.clipboard.writeText(code).then(() => showToast('📋 Código copiado!', 'success'));
  }
}

async function removeMember(userId) {
  if (!confirm('¿Eliminar a este miembro del hogar?')) return;
  try {
    await DELETE(`/homes/${state.currentHome.id}/members/${userId}`);
    state.members = state.members.filter(m => m.id !== userId);
    renderMembers();
    showToast('Miembro eliminado', 'info');
  } catch (e) {
    showToast(e?.message || 'Error', 'error');
  }
}

// ── NAVIGATION ─────────────────────────────────────────
function switchView(view) {
  state.currentView = view;
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById('view-' + view).classList.add('active');
  document.querySelectorAll('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.view === view));
  const titles = { dashboard:'Panel General', tasks:'Tareas del Hogar', payments:'Pagos & Facturas', incidents:'Imprevistos', calendar:'Calendario', members:'Miembros' };
  document.getElementById('topbar-title').textContent = titles[view] || view;
  document.getElementById('btn-add-global').style.display = view === 'dashboard' ? 'flex' : 'none';
  if (view === 'calendar') renderCalendar();
  if (view === 'members')  renderMembers();
  closeSidebar();
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('overlay').classList.toggle('open');
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('overlay').classList.remove('open');
}

// ── FILTERS ────────────────────────────────────────────
function filterItems(type, status, btn) {
  state.filters[type] = status;
  btn.closest('.filter-bar').querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  render();
}
function filterCategory(type, val) {
  state.catFilters[type] = val;
  render();
}

// ── RENDER ─────────────────────────────────────────────
function render() {
  renderStats();
  renderDashboard();
  renderTasks();
  renderPayments();
  renderIncidents();
  renderBadges();
}

function renderStats() {
  const pending  = state.tasks.filter(t => !t.done).length;
  const total    = state.tasks.length;
  const unres    = state.incidents.filter(i => i.status !== 'resolved').length;
  const totalInc = state.incidents.length;
  const due      = state.payments.filter(p => p.status !== 'paid');
  const dueAmt   = due.reduce((s, p) => s + parseFloat(p.amount || 0), 0);
  const totalAmt = state.payments.reduce((s, p) => s + parseFloat(p.amount || 0), 0);

  set('stat-tasks-total',    pending);
  set('stat-payments-due',   dueAmt.toFixed(2) + '€');
  set('stat-incidents-open', unres);
  set('stat-members',        state.members.length);

  setBarWidth('stat-tasks-bar',     total    ? ((total-pending)/total*100)         : 0);
  setBarWidth('stat-payments-bar',  totalAmt ? ((totalAmt-dueAmt)/totalAmt*100)   : 0);
  setBarWidth('stat-incidents-bar', totalInc ? ((totalInc-unres)/totalInc*100)    : 0);
  setBarWidth('stat-done-bar',      state.members.length ? 100 : 0);
}

function set(id, val) { const el = document.getElementById(id); if (el) el.textContent = val; }
function setBarWidth(id, pct) { const el = document.getElementById(id); if (el) el.style.width = Math.min(pct,100) + '%'; }

function renderBadges() {
  updateBadge('badge-tasks',     state.tasks.filter(t => !t.done).length);
  updateBadge('badge-payments',  state.payments.filter(p => p.status !== 'paid').length);
  updateBadge('badge-incidents', state.incidents.filter(i => i.status !== 'resolved').length);
}
function updateBadge(id, count) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = count;
  el.classList.toggle('show', count > 0);
}

// ── DASHBOARD ──────────────────────────────────────────
function renderDashboard() {
  const tasksList = document.getElementById('dash-tasks-list');
  const paysList  = document.getElementById('dash-payments-list');
  const incList   = document.getElementById('dash-incidents-list');

  const pending  = state.tasks.filter(t => !t.done && t.due_date).sort((a,b) => a.due_date.localeCompare(b.due_date)).slice(0,5);
  const pendPays = state.payments.filter(p => p.status !== 'paid' && p.due_date).sort((a,b) => a.due_date.localeCompare(b.due_date)).slice(0,5);
  const openInc  = state.incidents.filter(i => i.status !== 'resolved').slice(0,5);

  tasksList.innerHTML = pending.length
    ? pending.map(t => miniItem(t.title, relativeDate(t.due_date), 'var(--task)')).join('')
    : '<div class="empty-state-mini">Sin tareas pendientes 🎉</div>';

  paysList.innerHTML = pendPays.length
    ? pendPays.map(p => miniItem(`${p.title} – ${parseFloat(p.amount).toFixed(2)}€`, relativeDate(p.due_date), 'var(--payment)')).join('')
    : '<div class="empty-state-mini">Sin pagos pendientes 🎉</div>';

  incList.innerHTML = openInc.length
    ? openInc.map(i => miniItem(i.title, i.status === 'progress' ? 'En progreso' : 'Abierto', 'var(--incident)')).join('')
    : '<div class="empty-state-mini">Sin imprevistos 🎉</div>';
}

function miniItem(title, right, color) {
  return `<div class="mini-item">
    <div class="mini-dot" style="background:${color}"></div>
    <span class="mini-title">${esc(title)}</span>
    <span class="mini-right">${right}</span>
  </div>`;
}

// ── TASKS ──────────────────────────────────────────────
function renderTasks() {
  const container = document.getElementById('tasks-list');
  let items = [...state.tasks];
  if (state.filters.tasks === 'pending') items = items.filter(t => !t.done);
  if (state.filters.tasks === 'done')    items = items.filter(t => t.done);
  if (state.catFilters.tasks !== 'all')  items = items.filter(t => t.category === state.catFilters.tasks);
  items.sort((a,b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
    return 0;
  });
  if (!items.length) {
    container.innerHTML = `<div class="empty-state"><div class="empty-state-emoji">✅</div><div class="empty-state-title">Sin tareas</div><div class="empty-state-sub">Añade tu primera tarea del hogar</div></div>`;
    return;
  }
  container.innerHTML = items.map(t => `
    <div class="item-card ${t.done ? 'done' : ''}">
      <div class="item-card-top">
        <div class="item-check ${t.done ? 'checked' : ''}" onclick="toggleTask(${t.id},${!t.done})"></div>
        <div class="item-meta">
          <div class="item-title">${esc(t.title)}</div>
          ${t.description ? `<div class="item-desc">${esc(t.description)}</div>` : ''}
        </div>
        <div class="item-actions">
          <button class="item-action-btn" onclick="editItem('task',${t.id})" title="Editar">✏️</button>
          <button class="item-action-btn" onclick="deleteItem('task',${t.id})" title="Eliminar">🗑️</button>
        </div>
      </div>
      <div class="item-footer">
        <span class="item-tag priority-${t.priority}">${priorityLabel(t.priority)}</span>
        ${t.category ? `<span class="cat-tag">${catIcon(t.category)} ${t.category}</span>` : ''}
        ${t.due_date ? `<span class="item-date">${relativeDate(t.due_date)}</span>` : ''}
        ${t.created_by ? creatorTag(t.created_by) : ''}
      </div>
    </div>`).join('');
}

async function toggleTask(id, done) {
  try {
    const updated = await PUT(`/homes/${state.currentHome.id}/tasks/${id}`, { done });
    const idx = state.tasks.findIndex(t => t.id === id);
    if (idx > -1) state.tasks[idx] = { ...state.tasks[idx], ...updated };
    render();
    showToast(done ? '✅ Tarea completada!' : '↩️ Tarea pendiente', 'success');
  } catch { showToast('Error al actualizar', 'error'); }
}

// ── PAYMENTS ───────────────────────────────────────────
function renderPayments() {
  const container = document.getElementById('payments-list');
  let items = [...state.payments];
  if (state.filters.payments === 'pending') items = items.filter(p => p.status === 'pending');
  if (state.filters.payments === 'paid')    items = items.filter(p => p.status === 'paid');
  if (state.filters.payments === 'overdue') items = items.filter(p => p.status === 'overdue');

  // Summary
  const all      = state.payments;
  const totalAmt = all.reduce((s,p) => s+parseFloat(p.amount||0), 0);
  const paidAmt  = all.filter(p=>p.status==='paid').reduce((s,p) => s+parseFloat(p.amount||0), 0);
  const pendAmt  = all.filter(p=>p.status==='pending').reduce((s,p) => s+parseFloat(p.amount||0), 0);
  const overAmt  = all.filter(p=>p.status==='overdue').reduce((s,p) => s+parseFloat(p.amount||0), 0);
  document.getElementById('payment-summary').innerHTML = `
    <div class="pay-sum-card"><div class="pay-sum-val">${totalAmt.toFixed(2)}€</div><div class="pay-sum-lbl">Total</div></div>
    <div class="pay-sum-card"><div class="pay-sum-val" style="color:var(--success)">${paidAmt.toFixed(2)}€</div><div class="pay-sum-lbl">Pagado</div></div>
    <div class="pay-sum-card"><div class="pay-sum-val" style="color:var(--payment)">${pendAmt.toFixed(2)}€</div><div class="pay-sum-lbl">Pendiente</div></div>
    <div class="pay-sum-card"><div class="pay-sum-val" style="color:var(--incident)">${overAmt.toFixed(2)}€</div><div class="pay-sum-lbl">Vencido</div></div>`;

  if (!items.length) {
    container.innerHTML = `<div class="empty-state"><div class="empty-state-emoji">💳</div><div class="empty-state-title">Sin pagos</div><div class="empty-state-sub">Añade facturas, recibos o pagos recurrentes</div></div>`;
    return;
  }
  const statusLabels = { pending:'Pendiente', paid:'Pagado', overdue:'Vencido' };
  container.innerHTML = items.map(p => `
    <div class="item-card">
      <div class="item-card-top">
        <div class="item-meta">
          <div class="item-title">${esc(p.title)}</div>
          ${p.description ? `<div class="item-desc">${esc(p.description)}</div>` : ''}
          <div class="payment-amount" style="margin-top:8px">${parseFloat(p.amount).toFixed(2)}€</div>
        </div>
        <div class="item-actions">
          ${p.status !== 'paid' ? `<button class="item-action-btn" onclick="markPayment(${p.id},'paid')" title="Marcar pagado">✅</button>` : ''}
          <button class="item-action-btn" onclick="editItem('payment',${p.id})" title="Editar">✏️</button>
          <button class="item-action-btn" onclick="deleteItem('payment',${p.id})" title="Eliminar">🗑️</button>
        </div>
      </div>
      <div class="item-footer">
        <span class="payment-status status-${p.status}">${statusLabels[p.status]}</span>
        ${p.category ? `<span class="cat-tag">${esc(p.category)}</span>` : ''}
        ${p.due_date ? `<span class="item-date">${relativeDate(p.due_date)}</span>` : ''}
        ${p.created_by ? creatorTag(p.created_by) : ''}
      </div>
    </div>`).join('');
}

async function markPayment(id, status) {
  try {
    const updated = await PUT(`/homes/${state.currentHome.id}/payments/${id}`, { status });
    const idx = state.payments.findIndex(p => p.id === id);
    if (idx > -1) state.payments[idx] = { ...state.payments[idx], ...updated };
    render();
    showToast('💳 Pago marcado como pagado!', 'success');
  } catch { showToast('Error al actualizar', 'error'); }
}

// ── INCIDENTS ──────────────────────────────────────────
function renderIncidents() {
  const container = document.getElementById('incidents-list');
  let items = [...state.incidents];
  if (state.filters.incidents === 'open')     items = items.filter(i => i.status === 'open');
  if (state.filters.incidents === 'resolved') items = items.filter(i => i.status === 'resolved');
  if (state.catFilters.incidents !== 'all')   items = items.filter(i => i.category === state.catFilters.incidents);

  if (!items.length) {
    container.innerHTML = `<div class="empty-state"><div class="empty-state-emoji">⚡</div><div class="empty-state-title">Sin imprevistos</div><div class="empty-state-sub">Registra averías, urgencias o situaciones inesperadas</div></div>`;
    return;
  }
  const statusLabels = { open:'Abierto', progress:'En progreso', resolved:'Resuelto' };
  const barClass     = { high:'inc-urgent', medium:'inc-medium', low:'inc-low' };
  container.innerHTML = items.map(i => `
    <div class="item-card">
      <div class="incident-priority-bar ${barClass[i.priority]}"></div>
      <div class="item-card-top">
        <div class="item-meta">
          <div class="item-title">${catIcon(i.category)} ${esc(i.title)}</div>
          ${i.description ? `<div class="item-desc">${esc(i.description)}</div>` : ''}
          ${i.cost ? `<div class="payment-amount" style="margin-top:6px;font-size:16px">💸 ${parseFloat(i.cost).toFixed(2)}€</div>` : ''}
        </div>
        <div class="item-actions">
          ${i.status !== 'resolved' ? `<button class="item-action-btn" onclick="resolveIncident(${i.id})" title="Resolver">✅</button>` : ''}
          <button class="item-action-btn" onclick="editItem('incident',${i.id})" title="Editar">✏️</button>
          <button class="item-action-btn" onclick="deleteItem('incident',${i.id})" title="Eliminar">🗑️</button>
        </div>
      </div>
      <div class="item-footer">
        <span class="incident-status status-${i.status}">${statusLabels[i.status]}</span>
        <span class="item-tag priority-${i.priority}">${priorityLabel(i.priority)}</span>
        ${i.reported_at ? `<span class="item-date">📅 ${fmtDate(i.reported_at)}</span>` : ''}
        ${i.created_by ? creatorTag(i.created_by) : ''}
      </div>
    </div>`).join('');
}

async function resolveIncident(id) {
  try {
    const updated = await PUT(`/homes/${state.currentHome.id}/incidents/${id}`, { status:'resolved' });
    const idx = state.incidents.findIndex(i => i.id === id);
    if (idx > -1) state.incidents[idx] = { ...state.incidents[idx], ...updated };
    render();
    showToast('✅ Imprevisto resuelto!', 'success');
  } catch { showToast('Error al actualizar', 'error'); }
}

// ── MEMBERS ────────────────────────────────────────────
function renderMembers() {
  const container = document.getElementById('members-list');
  const currentUserId = state.user?.id;
  const isOwner = state.currentHome?.owner_id === currentUserId;

  container.innerHTML = state.members.map(m => {
    const role = m.pivot?.role || 'member';
    const initials = m.name.split(' ').map(p => p[0]).join('').slice(0,2).toUpperCase();
    const isMe = m.id === currentUserId;
    return `
      <div class="member-card">
        <div class="member-avatar" style="background:${m.avatar_color || '#6c63ff'}">${initials}</div>
        <div class="member-info">
          <div class="member-name">${esc(m.name)} ${isMe ? '<span style="font-size:10px;color:var(--text-muted)">(Tú)</span>' : ''}</div>
          <div class="member-email">${esc(m.email)}</div>
        </div>
        <span class="member-role role-${role}">${role === 'owner' ? '👑 Propietario' : '👤 Miembro'}</span>
        ${isOwner && !isMe ? `<button class="member-remove-btn" onclick="removeMember(${m.id})" title="Eliminar">✕</button>` : ''}
      </div>`;
  }).join('') || '<div class="empty-state-mini" style="padding:40px;text-align:center;color:var(--text-muted)">Sin miembros aún</div>';
}

// ── CALENDAR ───────────────────────────────────────────
function renderCalendar() {
  const d = state.calendarDate;
  const year = d.getFullYear(), month = d.getMonth();
  const monthNames = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  document.getElementById('cal-title').textContent = `${monthNames[month]} ${year}`;
  const grid = document.getElementById('calendar-grid');
  const dayNames = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];
  let html = dayNames.map(n => `<div class="cal-day-name">${n}</div>`).join('');
  const firstDay = new Date(year, month, 1);
  const lastDay  = new Date(year, month+1, 0);
  let startDow   = firstDay.getDay(); if (startDow === 0) startDow = 7;
  for (let i = startDow-1; i > 0; i--) {
    const day = new Date(year, month, 1-i);
    html += `<div class="cal-day other-month"><div class="cal-day-num">${day.getDate()}</div></div>`;
  }
  const todayStr = new Date().toISOString().slice(0,10);
  for (let day = 1; day <= lastDay.getDate(); day++) {
    const ds = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    const isToday = ds === todayStr;
    const tEvs = state.tasks.filter(t => t.due_date?.slice(0,10) === ds);
    const pEvs = state.payments.filter(p => p.due_date?.slice(0,10) === ds);
    const iEvs = state.incidents.filter(i => i.reported_at?.slice(0,10) === ds);
    const evHtml = [
      ...tEvs.map(t => `<div class="cal-event task-ev">✅ ${esc(t.title)}</div>`),
      ...pEvs.map(p => `<div class="cal-event payment-ev">💳 ${esc(p.title)}</div>`),
      ...iEvs.map(i => `<div class="cal-event incident-ev">⚡ ${esc(i.title)}</div>`),
    ].slice(0,3).join('');
    html += `<div class="cal-day ${isToday ? 'today' : ''}"><div class="cal-day-num">${day}</div><div class="cal-events">${evHtml}</div></div>`;
  }
  const endDow    = lastDay.getDay();
  const remaining = endDow === 0 ? 0 : 7 - endDow;
  for (let i = 1; i <= remaining; i++) {
    html += `<div class="cal-day other-month"><div class="cal-day-num">${i}</div></div>`;
  }
  grid.innerHTML = html;
}

function changeMonth(dir) {
  state.calendarDate = new Date(state.calendarDate.getFullYear(), state.calendarDate.getMonth() + dir, 1);
  renderCalendar();
}

// ── MODAL ──────────────────────────────────────────────
function openAddModal(type) {
  const view = state.currentView;
  const t = type || (view === 'tasks' ? 'task' : view === 'payments' ? 'payment' : view === 'incidents' ? 'incident' : 'task');
  state.editingId = null;
  state.editingType = t;
  const titles = { task:'Nueva Tarea', payment:'Nuevo Pago', incident:'Nuevo Imprevisto' };
  document.getElementById('modal-title').textContent = titles[t];
  document.getElementById('modal-body').innerHTML = buildForm(t, null);
  openModal();
}

function editItem(type, id) {
  const map = { task: state.tasks, payment: state.payments, incident: state.incidents };
  const item = map[type]?.find(i => i.id === id);
  if (!item) return;
  state.editingId   = id;
  state.editingType = type;
  const titles = { task:'Editar Tarea', payment:'Editar Pago', incident:'Editar Imprevisto' };
  document.getElementById('modal-title').textContent = titles[type];
  document.getElementById('modal-body').innerHTML = buildForm(type, item);
  openModal();
}

function openModal()  {
  document.getElementById('modal-backdrop').classList.add('open');
  document.getElementById('modal').classList.add('open');
  setTimeout(() => document.querySelector('#modal .form-input')?.focus(), 100);
}
function closeModal() {
  document.getElementById('modal-backdrop').classList.remove('open');
  document.getElementById('modal').classList.remove('open');
  state.editingId = null; state.editingType = null;
}

// ── FORMS ──────────────────────────────────────────────
function buildForm(type, data) {
  if (type === 'task')     return buildTaskForm(data);
  if (type === 'payment')  return buildPaymentForm(data);
  if (type === 'incident') return buildIncidentForm(data);
}

function memberOptions(selectedId) {
  return `<option value="">Sin asignar</option>` +
    state.members.map(m => `<option value="${m.id}" ${m.id == selectedId ? 'selected' : ''}>${esc(m.name)}</option>`).join('');
}

function buildTaskForm(d) {
  return `
  <div class="form-group"><label class="form-label">Título *</label>
    <input type="text" class="form-input" id="f-title" placeholder="Ej: Pasar la aspiradora" value="${esc(d?.title||'')}" maxlength="200"/></div>
  <div class="form-group"><label class="form-label">Descripción</label>
    <textarea class="form-textarea" id="f-desc" placeholder="Detalles opcionales...">${esc(d?.description||'')}</textarea></div>
  <div class="form-row">
    <div class="form-group"><label class="form-label">Categoría</label>
      <select class="form-select" id="f-cat">
        ${['limpieza','cocina','mantenimiento','jardín','compras','otro'].map(c => `<option value="${c}" ${d?.category===c?'selected':''}>${catIcon(c)} ${cap(c)}</option>`).join('')}
      </select></div>
    <div class="form-group"><label class="form-label">Prioridad</label>
      <select class="form-select" id="f-priority">
        <option value="low"    ${d?.priority==='low'?'selected':''}>🟢 Baja</option>
        <option value="medium" ${d?.priority==='medium'||!d?'selected':''}>🟡 Media</option>
        <option value="high"   ${d?.priority==='high'?'selected':''}>🔴 Alta</option>
      </select></div>
  </div>
  <div class="form-row">
    <div class="form-group"><label class="form-label">Fecha límite</label>
      <input type="date" class="form-input" id="f-due" value="${d?.due_date?.slice(0,10)||''}"/></div>
    <div class="form-group"><label class="form-label">Asignar a</label>
      <select class="form-select" id="f-assigned">${memberOptions(d?.assigned_to)}</select></div>
  </div>
  <div class="form-actions">
    <button class="btn-cancel" onclick="closeModal()">Cancelar</button>
    <button class="btn-submit" onclick="submitTask()">💾 Guardar</button>
  </div>`;
}

function buildPaymentForm(d) {
  return `
  <div class="form-group"><label class="form-label">Concepto *</label>
    <input type="text" class="form-input" id="f-title" placeholder="Ej: Recibo luz, Alquiler..." value="${esc(d?.title||'')}" maxlength="200"/></div>
  <div class="form-row">
    <div class="form-group"><label class="form-label">Importe (€) *</label>
      <input type="number" class="form-input" id="f-amount" placeholder="0.00" step="0.01" min="0" value="${d?.amount||''}"/></div>
    <div class="form-group"><label class="form-label">Estado</label>
      <select class="form-select" id="f-status">
        <option value="pending" ${d?.status==='pending'||!d?'selected':''}>⏳ Pendiente</option>
        <option value="paid"    ${d?.status==='paid'?'selected':''}>✅ Pagado</option>
      </select></div>
  </div>
  <div class="form-row">
    <div class="form-group"><label class="form-label">Categoría</label>
      <select class="form-select" id="f-cat">
        ${['luz','agua','gas','internet','alquiler','hipoteca','seguro','suscripción','comunidad','otro'].map(c=>`<option value="${c}" ${d?.category===c?'selected':''}>${cap(c)}</option>`).join('')}
      </select></div>
    <div class="form-group"><label class="form-label">Fecha vencimiento</label>
      <input type="date" class="form-input" id="f-due" value="${d?.due_date?.slice(0,10)||''}"/></div>
  </div>
  <div class="form-group"><label class="form-label">Notas</label>
    <textarea class="form-textarea" id="f-desc" placeholder="Referencia, número de factura...">${esc(d?.description||'')}</textarea></div>
  <div class="form-actions">
    <button class="btn-cancel" onclick="closeModal()">Cancelar</button>
    <button class="btn-submit" onclick="submitPayment()">💾 Guardar</button>
  </div>`;
}

function buildIncidentForm(d) {
  const today = new Date().toISOString().slice(0,10);
  return `
  <div class="form-group"><label class="form-label">Título *</label>
    <input type="text" class="form-input" id="f-title" placeholder="Ej: Avería caldera, Goteras..." value="${esc(d?.title||'')}" maxlength="200"/></div>
  <div class="form-group"><label class="form-label">Descripción</label>
    <textarea class="form-textarea" id="f-desc" placeholder="Describe el imprevisto...">${esc(d?.description||'')}</textarea></div>
  <div class="form-row">
    <div class="form-group"><label class="form-label">Categoría</label>
      <select class="form-select" id="f-cat">
        ${['avería','urgencia','reparación','compra urgente','otro'].map(c=>`<option value="${c}" ${d?.category===c?'selected':''}>${catIcon(c)} ${cap(c)}</option>`).join('')}
      </select></div>
    <div class="form-group"><label class="form-label">Prioridad</label>
      <select class="form-select" id="f-priority">
        <option value="low"    ${d?.priority==='low'?'selected':''}>🟢 Baja</option>
        <option value="medium" ${d?.priority==='medium'?'selected':''}>🟡 Media</option>
        <option value="high"   ${d?.priority==='high'||!d?'selected':''}>🔴 Alta</option>
      </select></div>
  </div>
  <div class="form-row">
    <div class="form-group"><label class="form-label">Coste estimado (€)</label>
      <input type="number" class="form-input" id="f-cost" placeholder="0.00" step="0.01" min="0" value="${d?.cost||''}"/></div>
    <div class="form-group"><label class="form-label">Fecha</label>
      <input type="date" class="form-input" id="f-reported" value="${d?.reported_at?.slice(0,10)||today}"/></div>
  </div>
  <div class="form-group"><label class="form-label">Estado</label>
    <select class="form-select" id="f-status">
      <option value="open"     ${d?.status==='open'||!d?'selected':''}>🔴 Abierto</option>
      <option value="progress" ${d?.status==='progress'?'selected':''}>🟡 En progreso</option>
      <option value="resolved" ${d?.status==='resolved'?'selected':''}>✅ Resuelto</option>
    </select></div>
  <div class="form-actions">
    <button class="btn-cancel" onclick="closeModal()">Cancelar</button>
    <button class="btn-submit" onclick="submitIncident()">💾 Guardar</button>
  </div>`;
}

// ── SUBMIT ─────────────────────────────────────────────
async function submitTask() {
  const title = document.getElementById('f-title')?.value.trim();
  if (!title) { showToast('El título es obligatorio', 'error'); return; }
  const body = {
    title,
    description: document.getElementById('f-desc')?.value.trim() || null,
    category:    document.getElementById('f-cat')?.value || 'otro',
    priority:    document.getElementById('f-priority')?.value || 'medium',
    due_date:    document.getElementById('f-due')?.value || null,
    assigned_to: document.getElementById('f-assigned')?.value || null,
  };
  if (body.assigned_to === '') body.assigned_to = null;
  try {
    if (state.editingId) {
      const updated = await PUT(`/homes/${state.currentHome.id}/tasks/${state.editingId}`, body);
      const idx = state.tasks.findIndex(t => t.id === state.editingId);
      if (idx > -1) state.tasks[idx] = { ...state.tasks[idx], ...updated };
      showToast('✏️ Tarea actualizada', 'info');
    } else {
      const created = await POST(`/homes/${state.currentHome.id}/tasks`, body);
      state.tasks.push(created);
      showToast('✅ Tarea añadida!', 'success');
    }
    closeModal(); render();
  } catch (e) { showToast(e?.message || 'Error al guardar', 'error'); }
}

async function submitPayment() {
  const title  = document.getElementById('f-title')?.value.trim();
  const amount = document.getElementById('f-amount')?.value;
  if (!title)  { showToast('El concepto es obligatorio', 'error'); return; }
  if (!amount || isNaN(amount)) { showToast('Introduce un importe válido', 'error'); return; }
  const body = {
    title, amount: parseFloat(amount),
    description: document.getElementById('f-desc')?.value.trim() || null,
    category:    document.getElementById('f-cat')?.value || 'otro',
    status:      document.getElementById('f-status')?.value || 'pending',
    due_date:    document.getElementById('f-due')?.value || null,
  };
  try {
    if (state.editingId) {
      const updated = await PUT(`/homes/${state.currentHome.id}/payments/${state.editingId}`, body);
      const idx = state.payments.findIndex(p => p.id === state.editingId);
      if (idx > -1) state.payments[idx] = { ...state.payments[idx], ...updated };
      showToast('✏️ Pago actualizado', 'info');
    } else {
      const created = await POST(`/homes/${state.currentHome.id}/payments`, body);
      state.payments.push(created);
      showToast('💳 Pago añadido!', 'success');
    }
    closeModal(); render();
  } catch (e) { showToast(e?.message || 'Error al guardar', 'error'); }
}

async function submitIncident() {
  const title = document.getElementById('f-title')?.value.trim();
  if (!title) { showToast('El título es obligatorio', 'error'); return; }
  const cost = document.getElementById('f-cost')?.value;
  const body = {
    title,
    description: document.getElementById('f-desc')?.value.trim() || null,
    category:    document.getElementById('f-cat')?.value || 'otro',
    priority:    document.getElementById('f-priority')?.value || 'high',
    status:      document.getElementById('f-status')?.value || 'open',
    cost:        cost && !isNaN(cost) ? parseFloat(cost) : null,
    reported_at: document.getElementById('f-reported')?.value || null,
  };
  try {
    if (state.editingId) {
      const updated = await PUT(`/homes/${state.currentHome.id}/incidents/${state.editingId}`, body);
      const idx = state.incidents.findIndex(i => i.id === state.editingId);
      if (idx > -1) state.incidents[idx] = { ...state.incidents[idx], ...updated };
      showToast('✏️ Imprevisto actualizado', 'info');
    } else {
      const created = await POST(`/homes/${state.currentHome.id}/incidents`, body);
      state.incidents.push(created);
      showToast('⚡ Imprevisto registrado!', 'success');
    }
    closeModal(); render();
  } catch (e) { showToast(e?.message || 'Error al guardar', 'error'); }
}

async function deleteItem(type, id) {
  if (!confirm('¿Eliminar este elemento?')) return;
  const pathMap = { task:'tasks', payment:'payments', incident:'incidents' };
  try {
    await DELETE(`/homes/${state.currentHome.id}/${pathMap[type]}/${id}`);
    const arrMap = { task:'tasks', payment:'payments', incident:'incidents' };
    state[arrMap[type]] = state[arrMap[type]].filter(i => i.id !== id);
    render();
    showToast('🗑️ Eliminado', 'info');
  } catch (e) { showToast(e?.message || 'Error al eliminar', 'error'); }
}

// ── HELPERS ────────────────────────────────────────────
function esc(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
function priorityLabel(p) { return { high:'🔴 Alta', medium:'🟡 Media', low:'🟢 Baja' }[p] || p; }
function catIcon(cat) {
  const icons = { limpieza:'🧹', cocina:'🍳', mantenimiento:'🔧', jardín:'🌿', compras:'🛒', avería:'🔩', urgencia:'🚨', reparación:'🔨', 'compra urgente':'🛍️', otro:'📦' };
  return icons[cat] || '📦';
}
function fmtDate(ds) {
  if (!ds) return '';
  const d = new Date(ds.slice(0,10) + 'T00:00:00');
  return d.toLocaleDateString('es-ES', { day:'numeric', month:'short', year:'numeric' });
}
function isOverdue(ds) {
  if (!ds) return false;
  return new Date(ds.slice(0,10) + 'T00:00:00') < new Date(new Date().toDateString());
}
function daysUntil(ds) {
  if (!ds) return null;
  return Math.round((new Date(ds.slice(0,10) + 'T00:00:00') - new Date(new Date().toDateString())) / 86400000);
}
function relativeDate(ds) {
  if (!ds) return '';
  const d = daysUntil(ds);
  if (d === 0)  return '🔴 Hoy';
  if (d === 1)  return '🟠 Mañana';
  if (d < 0)   return `⚠️ Hace ${Math.abs(d)}d`;
  if (d <= 7)  return `📅 En ${d} días`;
  return `📅 ${fmtDate(ds)}`;
}
function creatorTag(user) {
  if (!user) return '';
  const initials = user.name?.split(' ').map(p=>p[0]).join('').slice(0,2).toUpperCase() || '?';
  return `<div class="item-creator">
    <div class="item-creator-avatar" style="background:${user.avatar_color||'#6c63ff'}">${initials}</div>
    <span>${esc(user.name)}</span>
  </div>`;
}

function updateDateDisplay() {
  const el = document.getElementById('date-display');
  if (!el) return;
  const days   = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
  const months = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  const now    = new Date();
  el.textContent = `${days[now.getDay()]}, ${now.getDate()} de ${months[now.getMonth()]} de ${now.getFullYear()}`;
}

// ── TOAST ──────────────────────────────────────────────
function showToast(msg, type = 'info') {
  const container = document.getElementById('toast-container');
  const icons = { success:'✅', error:'❌', info:'ℹ️' };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${icons[type]}</span> ${msg}`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity   = '0';
    toast.style.transform = 'translateX(16px)';
    toast.style.transition = '0.3s';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ── KEYBOARD ───────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeModal();
});

// ── INIT ───────────────────────────────────────────────
(async function init() {
  showAuthView('login');
  if (state.token) {
    showLoading();
    try {
      const data = await GET('/me');
      state.user  = data.user;
      state.homes = data.homes || [];
      enterApp();
    } catch {
      // Token expired
      state.token = null;
      localStorage.removeItem('ht_token');
      hideLoading();
    }
  }
})();
