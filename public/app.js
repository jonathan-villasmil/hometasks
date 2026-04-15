// ═══════════════════════════════════════════
//  HomeTasks – App Logic
// ═══════════════════════════════════════════

// ── STATE ──────────────────────────────────
let state = {
  tasks:     [],
  payments:  [],
  incidents: [],
  currentView: 'dashboard',
  filters: { tasks: 'all', payments: 'all', incidents: 'all' },
  catFilters: { tasks: 'all', incidents: 'all' },
  editingId: null,
  editingType: null,
  calendarDate: new Date(),
};

// ── PERSISTENCE ────────────────────────────
function save() {
  localStorage.setItem('ht_tasks',     JSON.stringify(state.tasks));
  localStorage.setItem('ht_payments',  JSON.stringify(state.payments));
  localStorage.setItem('ht_incidents', JSON.stringify(state.incidents));
}

function load() {
  state.tasks     = JSON.parse(localStorage.getItem('ht_tasks')     || '[]');
  state.payments  = JSON.parse(localStorage.getItem('ht_payments')  || '[]');
  state.incidents = JSON.parse(localStorage.getItem('ht_incidents') || '[]');
}

// ── HELPERS ────────────────────────────────
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2); }

function fmtDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('es-ES', { day:'numeric', month:'short', year:'numeric' });
}

function isOverdue(dateStr) {
  if (!dateStr) return false;
  return new Date(dateStr + 'T00:00:00') < new Date(new Date().toDateString());
}

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const diff = new Date(dateStr + 'T00:00:00') - new Date(new Date().toDateString());
  return Math.round(diff / 86400000);
}

function relativeDate(dateStr) {
  if (!dateStr) return '';
  const d = daysUntil(dateStr);
  if (d === 0) return '🔴 Hoy';
  if (d === 1) return '🟠 Mañana';
  if (d < 0)  return `⚠️ Hace ${Math.abs(d)}d`;
  if (d <= 7) return `📅 En ${d} días`;
  return `📅 ${fmtDate(dateStr)}`;
}

function priorityLabel(p) {
  return { high: '🔴 Alta', medium: '🟡 Media', low: '🟢 Baja' }[p] || p;
}

function catIcon(cat) {
  const icons = {
    limpieza:'🧹', cocina:'🍳', mantenimiento:'🔧', jardín:'🌿', compras:'🛒',
    avería:'🔩', urgencia:'🚨', reparación:'🔨', 'compra urgente':'🛍️', otro:'📦'
  };
  return icons[cat] || '📦';
}

// ── NAVIGATION ─────────────────────────────
function switchView(view) {
  state.currentView = view;
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById('view-' + view).classList.add('active');
  document.querySelectorAll('.nav-item').forEach(n => {
    n.classList.toggle('active', n.dataset.view === view);
  });
  const titles = { dashboard:'Panel General', tasks:'Tareas del Hogar', payments:'Pagos & Facturas', incidents:'Imprevistos', calendar:'Calendario' };
  document.getElementById('topbar-title').textContent = titles[view];
  document.getElementById('btn-add-global').style.display = view === 'dashboard' ? 'flex' : 'none';

  if (view === 'calendar') renderCalendar();
  render();
  closeSidebar();
}

function toggleSidebar() {
  const s = document.getElementById('sidebar');
  const o = document.getElementById('overlay');
  s.classList.toggle('open');
  o.classList.toggle('open');
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('overlay').classList.remove('open');
}

// ── FILTERS ────────────────────────────────
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

// ── RENDER ─────────────────────────────────
function render() {
  renderStats();
  renderDashboard();
  renderTasks();
  renderPayments();
  renderIncidents();
  renderBadges();
}

function renderStats() {
  const pendingTasks  = state.tasks.filter(t => !t.done).length;
  const totalTasks    = state.tasks.length;
  const unresolved    = state.incidents.filter(i => i.status !== 'resolved').length;
  const totalInc      = state.incidents.length;
  const duePayments   = state.payments.filter(p => p.status !== 'paid');
  const dueAmount     = duePayments.reduce((s, p) => s + parseFloat(p.amount || 0), 0);
  const totalPayAmt   = state.payments.reduce((s, p) => s + parseFloat(p.amount || 0), 0);
  const doneTodayCount = state.tasks.filter(t => t.done && t.doneAt && t.doneAt.startsWith(new Date().toISOString().slice(0,10))).length;

  set('stat-tasks-total',    pendingTasks);
  set('stat-payments-due',   dueAmount.toFixed(2) + '€');
  set('stat-incidents-open', unresolved);
  set('stat-done-total',     doneTodayCount);

  setBarWidth('stat-tasks-bar',    totalTasks  ? ((totalTasks - pendingTasks) / totalTasks * 100) : 0);
  setBarWidth('stat-payments-bar', totalPayAmt ? ((totalPayAmt - dueAmount)   / totalPayAmt * 100) : 0);
  setBarWidth('stat-incidents-bar',totalInc    ? ((totalInc - unresolved)    / totalInc * 100) : 0);
  setBarWidth('stat-done-bar',     totalTasks  ? (doneTodayCount / totalTasks * 100) : 0);
}

function set(id, val) { const el = document.getElementById(id); if (el) el.textContent = val; }
function setBarWidth(id, pct) { const el = document.getElementById(id); if (el) el.style.width = Math.min(pct,100) + '%'; }

function renderBadges() {
  const pendingTasks  = state.tasks.filter(t => !t.done).length;
  const duePayments   = state.payments.filter(p => p.status !== 'paid').length;
  const openInc       = state.incidents.filter(i => i.status !== 'resolved').length;

  updateBadge('badge-tasks',     pendingTasks);
  updateBadge('badge-payments',  duePayments);
  updateBadge('badge-incidents', openInc);
}

function updateBadge(id, count) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = count;
  el.classList.toggle('show', count > 0);
}

// ── DASHBOARD ──────────────────────────────
function renderDashboard() {
  const tasksList = document.getElementById('dash-tasks-list');
  const paysList  = document.getElementById('dash-payments-list');
  const incList   = document.getElementById('dash-incidents-list');

  const pendingTasks = state.tasks.filter(t => !t.done && t.dueDate)
    .sort((a,b) => a.dueDate.localeCompare(b.dueDate)).slice(0,5);
  const pendingPays  = state.payments.filter(p => p.status !== 'paid' && p.dueDate)
    .sort((a,b) => a.dueDate.localeCompare(b.dueDate)).slice(0,5);
  const recentInc    = state.incidents.filter(i => i.status !== 'resolved').slice(0,5);

  tasksList.innerHTML = pendingTasks.length
    ? pendingTasks.map(t => miniItem(t.title, relativeDate(t.dueDate), 'var(--task)', () => switchView('tasks'))).join('')
    : '<div class="empty-state-mini">Sin tareas pendientes 🎉</div>';

  paysList.innerHTML = pendingPays.length
    ? pendingPays.map(p => miniItem(`${p.title} – ${parseFloat(p.amount).toFixed(2)}€`, relativeDate(p.dueDate), 'var(--payment)', () => switchView('payments'))).join('')
    : '<div class="empty-state-mini">Sin pagos pendientes 🎉</div>';

  incList.innerHTML = recentInc.length
    ? recentInc.map(i => miniItem(i.title, i.status, 'var(--incident)', () => switchView('incidents'))).join('')
    : '<div class="empty-state-mini">Sin imprevistos 🎉</div>';
}

function miniItem(title, right, color, onclick) {
  return `<div class="mini-item" onclick="${onclick.toString().replace(/"/g,"'")}">
    <div class="mini-dot" style="background:${color}"></div>
    <span class="mini-title">${esc(title)}</span>
    <span class="mini-right">${right}</span>
  </div>`;
}

// ── TASKS ──────────────────────────────────
function renderTasks() {
  const container = document.getElementById('tasks-list');
  let items = [...state.tasks];

  if (state.filters.tasks === 'pending') items = items.filter(t => !t.done);
  if (state.filters.tasks === 'done')    items = items.filter(t => t.done);
  if (state.catFilters.tasks !== 'all')  items = items.filter(t => t.category === state.catFilters.tasks);

  // Sort: pending first, then by date
  items.sort((a,b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
    return 0;
  });

  if (!items.length) {
    container.innerHTML = `<div class="empty-state">
      <div class="empty-state-emoji">✅</div>
      <div class="empty-state-title">Sin tareas</div>
      <div class="empty-state-sub">Añade tu primera tarea del hogar</div>
    </div>`;
    return;
  }

  container.innerHTML = items.map(t => `
    <div class="item-card ${t.done ? 'done' : ''}" id="task-${t.id}">
      <div class="item-card-top">
        <div class="item-check ${t.done ? 'checked' : ''}" onclick="toggleTask('${t.id}')"></div>
        <div class="item-meta">
          <div class="item-title">${esc(t.title)}</div>
          ${t.description ? `<div class="item-desc">${esc(t.description)}</div>` : ''}
        </div>
        <div class="item-actions">
          <button class="item-action-btn" onclick="editItem('task','${t.id}')" title="Editar">✏️</button>
          <button class="item-action-btn" onclick="deleteItem('task','${t.id}')" title="Eliminar">🗑️</button>
        </div>
      </div>
      <div class="item-footer">
        <span class="item-tag priority-${t.priority}">${priorityLabel(t.priority)}</span>
        ${t.category ? `<span class="cat-tag">${catIcon(t.category)} ${t.category}</span>` : ''}
        ${t.dueDate ? `<span class="item-date">${relativeDate(t.dueDate)}</span>` : ''}
      </div>
    </div>
  `).join('');
}

function toggleTask(id) {
  const t = state.tasks.find(t => t.id === id);
  if (!t) return;
  t.done = !t.done;
  t.doneAt = t.done ? new Date().toISOString() : null;
  save(); render();
  showToast(t.done ? '✅ Tarea completada!' : '↩️ Tarea pendiente de nuevo', 'success');
}

// ── PAYMENTS ───────────────────────────────
function renderPayments() {
  const container = document.getElementById('payments-list');
  let items = [...state.payments];

  if (state.filters.payments === 'pending') items = items.filter(p => p.status === 'pending');
  if (state.filters.payments === 'paid')    items = items.filter(p => p.status === 'paid');
  if (state.filters.payments === 'overdue') items = items.filter(p => p.status === 'overdue' || (p.status !== 'paid' && isOverdue(p.dueDate)));

  // Update overdue status automatically
  items.forEach(p => {
    if (p.status !== 'paid' && isOverdue(p.dueDate)) p.status = 'overdue';
  });

  items.sort((a,b) => {
    const order = { overdue:0, pending:1, paid:2 };
    if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status];
    if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
    return 0;
  });

  // Summary
  const sumEl = document.getElementById('payment-summary');
  const all = state.payments;
  const totalMonth = all.reduce((s,p)=>s+parseFloat(p.amount||0),0);
  const totalPaid  = all.filter(p=>p.status==='paid').reduce((s,p)=>s+parseFloat(p.amount||0),0);
  const totalPend  = all.filter(p=>p.status!=='paid').reduce((s,p)=>s+parseFloat(p.amount||0),0);
  const totalOver  = all.filter(p=>p.status==='overdue'||(p.status!=='paid'&&isOverdue(p.dueDate))).reduce((s,p)=>s+parseFloat(p.amount||0),0);
  sumEl.innerHTML = `
    <div class="pay-sum-card"><div class="pay-sum-val" style="color:var(--text)">${totalMonth.toFixed(2)}€</div><div class="pay-sum-lbl">Total registrado</div></div>
    <div class="pay-sum-card"><div class="pay-sum-val" style="color:var(--success)">${totalPaid.toFixed(2)}€</div><div class="pay-sum-lbl">Pagado</div></div>
    <div class="pay-sum-card"><div class="pay-sum-val" style="color:var(--payment)">${totalPend.toFixed(2)}€</div><div class="pay-sum-lbl">Pendiente</div></div>
    <div class="pay-sum-card"><div class="pay-sum-val" style="color:var(--incident)">${totalOver.toFixed(2)}€</div><div class="pay-sum-lbl">Vencido</div></div>
  `;

  if (!items.length) {
    container.innerHTML = `<div class="empty-state">
      <div class="empty-state-emoji">💳</div>
      <div class="empty-state-title">Sin pagos registrados</div>
      <div class="empty-state-sub">Añade facturas, recibos o pagos recurrentes</div>
    </div>`;
    return;
  }

  container.innerHTML = items.map(p => {
    const over = p.status !== 'paid' && isOverdue(p.dueDate);
    const effectiveStatus = over ? 'overdue' : p.status;
    const statusLabels = { pending:'Pendiente', paid:'Pagado', overdue:'Vencido' };
    return `
    <div class="item-card" id="payment-${p.id}">
      <div class="item-card-top">
        <div class="item-meta">
          <div class="item-title">${esc(p.title)}</div>
          ${p.description ? `<div class="item-desc">${esc(p.description)}</div>` : ''}
          <div class="payment-amount" style="margin-top:8px">${parseFloat(p.amount).toFixed(2)}€</div>
        </div>
        <div class="item-actions">
          ${effectiveStatus !== 'paid' ? `<button class="item-action-btn" onclick="markPayment('${p.id}','paid')" title="Marcar pagado">✅</button>` : ''}
          <button class="item-action-btn" onclick="editItem('payment','${p.id}')" title="Editar">✏️</button>
          <button class="item-action-btn" onclick="deleteItem('payment','${p.id}')" title="Eliminar">🗑️</button>
        </div>
      </div>
      <div class="item-footer">
        <span class="payment-status status-${effectiveStatus}">${statusLabels[effectiveStatus]}</span>
        ${p.category ? `<span class="cat-tag">${esc(p.category)}</span>` : ''}
        ${p.dueDate ? `<span class="item-date">${relativeDate(p.dueDate)}</span>` : ''}
      </div>
    </div>`;
  }).join('');
}

function markPayment(id, status) {
  const p = state.payments.find(p => p.id === id);
  if (!p) return;
  p.status = status;
  p.paidAt = status === 'paid' ? new Date().toISOString() : null;
  save(); render();
  showToast('💳 Pago marcado como pagado!', 'success');
}

// ── INCIDENTS ──────────────────────────────
function renderIncidents() {
  const container = document.getElementById('incidents-list');
  let items = [...state.incidents];

  if (state.filters.incidents === 'open')     items = items.filter(i => i.status === 'open');
  if (state.filters.incidents === 'resolved') items = items.filter(i => i.status === 'resolved');
  if (state.catFilters.incidents !== 'all')   items = items.filter(i => i.category === state.catFilters.incidents);

  items.sort((a,b) => {
    const order = { open:0, progress:1, resolved:2 };
    if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status];
    const pOrder = { high:0, medium:1, low:2 };
    return pOrder[a.priority] - pOrder[b.priority];
  });

  if (!items.length) {
    container.innerHTML = `<div class="empty-state">
      <div class="empty-state-emoji">⚡</div>
      <div class="empty-state-title">Sin imprevistos</div>
      <div class="empty-state-sub">Registra averías, urgencias o situaciones inesperadas</div>
    </div>`;
    return;
  }

  const statusLabels = { open:'Abierto', progress:'En progreso', resolved:'Resuelto' };
  const barClass = { high:'inc-urgent', medium:'inc-medium', low:'inc-low' };

  container.innerHTML = items.map(i => `
    <div class="item-card" id="incident-${i.id}">
      <div class="incident-priority-bar ${barClass[i.priority]}"></div>
      <div class="item-card-top">
        <div class="item-meta">
          <div class="item-title">${catIcon(i.category)} ${esc(i.title)}</div>
          ${i.description ? `<div class="item-desc">${esc(i.description)}</div>` : ''}
          ${i.cost ? `<div class="payment-amount" style="margin-top:6px;font-size:16px">💸 ${parseFloat(i.cost).toFixed(2)}€</div>` : ''}
        </div>
        <div class="item-actions">
          ${i.status !== 'resolved' ? `<button class="item-action-btn" onclick="resolveIncident('${i.id}')" title="Resolver">✅</button>` : ''}
          <button class="item-action-btn" onclick="editItem('incident','${i.id}')" title="Editar">✏️</button>
          <button class="item-action-btn" onclick="deleteItem('incident','${i.id}')" title="Eliminar">🗑️</button>
        </div>
      </div>
      <div class="item-footer">
        <span class="incident-status status-${i.status}">${statusLabels[i.status]}</span>
        <span class="item-tag priority-${i.priority}">${priorityLabel(i.priority)}</span>
        ${i.reportedAt ? `<span class="item-date">📅 ${fmtDate(i.reportedAt)}</span>` : ''}
      </div>
    </div>
  `).join('');
}

function resolveIncident(id) {
  const i = state.incidents.find(i => i.id === id);
  if (!i) return;
  i.status = 'resolved';
  i.resolvedAt = new Date().toISOString();
  save(); render();
  showToast('✅ Imprevisto resuelto!', 'success');
}

// ── CALENDAR ───────────────────────────────
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
  let startDow = firstDay.getDay(); if (startDow === 0) startDow = 7;

  // prev month days
  for (let i = startDow-1; i > 0; i--) {
    const day = new Date(year, month, 1-i);
    html += `<div class="cal-day other-month"><div class="cal-day-num">${day.getDate()}</div></div>`;
  }

  const today = new Date(); const todayStr = today.toISOString().slice(0,10);

  for (let day = 1; day <= lastDay.getDate(); day++) {
    const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    const isToday = dateStr === todayStr;

    const taskEvs     = state.tasks.filter(t => t.dueDate === dateStr);
    const paymentEvs  = state.payments.filter(p => p.dueDate === dateStr);
    const incidentEvs = state.incidents.filter(i => i.reportedAt === dateStr);

    const evHtml = [
      ...taskEvs.map(t => `<div class="cal-event task-ev">✅ ${esc(t.title)}</div>`),
      ...paymentEvs.map(p => `<div class="cal-event payment-ev">💳 ${esc(p.title)}</div>`),
      ...incidentEvs.map(i => `<div class="cal-event incident-ev">⚡ ${esc(i.title)}</div>`),
    ].slice(0,3).join('');

    html += `<div class="cal-day ${isToday ? 'today' : ''}">
      <div class="cal-day-num">${day}</div>
      <div class="cal-events">${evHtml}</div>
    </div>`;
  }

  // remaining
  const endDow = lastDay.getDay(); const remaining = endDow === 0 ? 0 : 7 - endDow;
  for (let i = 1; i <= remaining; i++) {
    html += `<div class="cal-day other-month"><div class="cal-day-num">${i}</div></div>`;
  }

  grid.innerHTML = html;
}

function changeMonth(dir) {
  state.calendarDate = new Date(state.calendarDate.getFullYear(), state.calendarDate.getMonth() + dir, 1);
  renderCalendar();
}

// ── MODAL ──────────────────────────────────
function openAddModal(type) {
  const view = state.currentView;
  const resolvedType = type || (view === 'tasks' ? 'task' : view === 'payments' ? 'payment' : view === 'incidents' ? 'incident' : 'task');
  state.editingId = null;
  state.editingType = resolvedType;
  const titles = { task:'Nueva Tarea', payment:'Nuevo Pago', incident:'Nuevo Imprevisto' };
  document.getElementById('modal-title').textContent = titles[resolvedType];
  document.getElementById('modal-body').innerHTML = buildForm(resolvedType, null);
  openModal();
}

function editItem(type, id) {
  const map = { task: state.tasks, payment: state.payments, incident: state.incidents };
  const item = map[type + 's'].find(i => i.id === id);
  if (!item) return;
  state.editingId = id;
  state.editingType = type;
  const titles = { task:'Editar Tarea', payment:'Editar Pago', incident:'Editar Imprevisto' };
  document.getElementById('modal-title').textContent = titles[type];
  document.getElementById('modal-body').innerHTML = buildForm(type, item);
  openModal();
}

function openModal() {
  document.getElementById('modal-backdrop').classList.add('open');
  document.getElementById('modal').classList.add('open');
  setTimeout(() => document.querySelector('.form-input, .form-textarea')?.focus(), 100);
}

function closeModal() {
  document.getElementById('modal-backdrop').classList.remove('open');
  document.getElementById('modal').classList.remove('open');
  state.editingId = null;
  state.editingType = null;
}

// ── FORMS ──────────────────────────────────
function buildForm(type, data) {
  if (type === 'task')     return buildTaskForm(data);
  if (type === 'payment')  return buildPaymentForm(data);
  if (type === 'incident') return buildIncidentForm(data);
}

function buildTaskForm(d) {
  return `
  <div class="form-group">
    <label class="form-label">Título *</label>
    <input type="text" class="form-input" id="f-title" placeholder="Ej: Pasar la aspiradora" value="${esc(d?.title||'')}" maxlength="100"/>
  </div>
  <div class="form-group">
    <label class="form-label">Descripción</label>
    <textarea class="form-textarea" id="f-desc" placeholder="Detalles opcionales...">${esc(d?.description||'')}</textarea>
  </div>
  <div class="form-row">
    <div class="form-group">
      <label class="form-label">Categoría</label>
      <select class="form-select" id="f-cat">
        ${['limpieza','cocina','mantenimiento','jardín','compras','otro'].map(c => `<option value="${c}" ${d?.category===c?'selected':''}>${catIcon(c)} ${c.charAt(0).toUpperCase()+c.slice(1)}</option>`).join('')}
      </select>
    </div>
    <div class="form-group">
      <label class="form-label">Prioridad</label>
      <select class="form-select" id="f-priority">
        <option value="low"    ${d?.priority==='low'   ?'selected':''}>🟢 Baja</option>
        <option value="medium" ${d?.priority==='medium'||!d?'selected':''}>🟡 Media</option>
        <option value="high"   ${d?.priority==='high'  ?'selected':''}>🔴 Alta</option>
      </select>
    </div>
  </div>
  <div class="form-group">
    <label class="form-label">Fecha límite</label>
    <input type="date" class="form-input" id="f-due" value="${d?.dueDate||''}"/>
  </div>
  <div class="form-actions">
    <button class="btn-cancel" onclick="closeModal()">Cancelar</button>
    <button class="btn-submit" onclick="submitTask()">💾 Guardar</button>
  </div>`;
}

function buildPaymentForm(d) {
  return `
  <div class="form-group">
    <label class="form-label">Concepto *</label>
    <input type="text" class="form-input" id="f-title" placeholder="Ej: Recibo luz, Alquiler..." value="${esc(d?.title||'')}" maxlength="100"/>
  </div>
  <div class="form-row">
    <div class="form-group">
      <label class="form-label">Importe (€) *</label>
      <input type="number" class="form-input" id="f-amount" placeholder="0.00" step="0.01" min="0" value="${d?.amount||''}"/>
    </div>
    <div class="form-group">
      <label class="form-label">Estado</label>
      <select class="form-select" id="f-status">
        <option value="pending" ${d?.status==='pending'||!d?'selected':''}>⏳ Pendiente</option>
        <option value="paid"    ${d?.status==='paid'?'selected':''}>✅ Pagado</option>
      </select>
    </div>
  </div>
  <div class="form-row">
    <div class="form-group">
      <label class="form-label">Categoría</label>
      <select class="form-select" id="f-cat">
        ${['luz','agua','gas','internet','alquiler','hipoteca','seguro','suscripción','comunidad','otro'].map(c=>`<option value="${c}" ${d?.category===c?'selected':''}>${c.charAt(0).toUpperCase()+c.slice(1)}</option>`).join('')}
      </select>
    </div>
    <div class="form-group">
      <label class="form-label">Fecha vencimiento</label>
      <input type="date" class="form-input" id="f-due" value="${d?.dueDate||''}"/>
    </div>
  </div>
  <div class="form-group">
    <label class="form-label">Notas</label>
    <textarea class="form-textarea" id="f-desc" placeholder="Referencia, número de factura...">${esc(d?.description||'')}</textarea>
  </div>
  <div class="form-actions">
    <button class="btn-cancel" onclick="closeModal()">Cancelar</button>
    <button class="btn-submit" onclick="submitPayment()">💾 Guardar</button>
  </div>`;
}

function buildIncidentForm(d) {
  const today = new Date().toISOString().slice(0,10);
  return `
  <div class="form-group">
    <label class="form-label">Título *</label>
    <input type="text" class="form-input" id="f-title" placeholder="Ej: Avería caldera, Goteras..." value="${esc(d?.title||'')}" maxlength="100"/>
  </div>
  <div class="form-group">
    <label class="form-label">Descripción</label>
    <textarea class="form-textarea" id="f-desc" placeholder="Describe el imprevisto...">${esc(d?.description||'')}</textarea>
  </div>
  <div class="form-row">
    <div class="form-group">
      <label class="form-label">Categoría</label>
      <select class="form-select" id="f-cat">
        ${['avería','urgencia','reparación','compra urgente','otro'].map(c=>`<option value="${c}" ${d?.category===c?'selected':''}>${catIcon(c)} ${c.charAt(0).toUpperCase()+c.slice(1)}</option>`).join('')}
      </select>
    </div>
    <div class="form-group">
      <label class="form-label">Prioridad</label>
      <select class="form-select" id="f-priority">
        <option value="low"    ${d?.priority==='low'   ?'selected':''}>🟢 Baja</option>
        <option value="medium" ${d?.priority==='medium'?'selected':''}>🟡 Media</option>
        <option value="high"   ${d?.priority==='high'||!d?'selected':''}>🔴 Alta</option>
      </select>
    </div>
  </div>
  <div class="form-row">
    <div class="form-group">
      <label class="form-label">Coste estimado (€)</label>
      <input type="number" class="form-input" id="f-cost" placeholder="0.00" step="0.01" min="0" value="${d?.cost||''}"/>
    </div>
    <div class="form-group">
      <label class="form-label">Fecha</label>
      <input type="date" class="form-input" id="f-reported" value="${d?.reportedAt||today}"/>
    </div>
  </div>
  <div class="form-group">
    <label class="form-label">Estado</label>
    <select class="form-select" id="f-status">
      <option value="open"     ${d?.status==='open'||!d?'selected':''}>🔴 Abierto</option>
      <option value="progress" ${d?.status==='progress'?'selected':''}>🟡 En progreso</option>
      <option value="resolved" ${d?.status==='resolved'?'selected':''}>✅ Resuelto</option>
    </select>
  </div>
  <div class="form-actions">
    <button class="btn-cancel" onclick="closeModal()">Cancelar</button>
    <button class="btn-submit" onclick="submitIncident()">💾 Guardar</button>
  </div>`;
}

// ── SUBMIT ─────────────────────────────────
function submitTask() {
  const title = document.getElementById('f-title')?.value.trim();
  if (!title) { showToast('El título es obligatorio', 'error'); return; }
  const item = {
    id: state.editingId || uid(),
    title,
    description: document.getElementById('f-desc')?.value.trim() || '',
    category:    document.getElementById('f-cat')?.value || 'otro',
    priority:    document.getElementById('f-priority')?.value || 'medium',
    dueDate:     document.getElementById('f-due')?.value || null,
    done:        false,
    doneAt:      null,
    createdAt:   new Date().toISOString(),
  };
  if (state.editingId) {
    const idx = state.tasks.findIndex(t => t.id === state.editingId);
    const existing = state.tasks[idx];
    item.done = existing.done; item.doneAt = existing.doneAt; item.createdAt = existing.createdAt;
    state.tasks[idx] = item;
    showToast('✏️ Tarea actualizada', 'info');
  } else {
    state.tasks.push(item);
    showToast('✅ Tarea añadida!', 'success');
  }
  save(); closeModal(); render();
}

function submitPayment() {
  const title  = document.getElementById('f-title')?.value.trim();
  const amount = document.getElementById('f-amount')?.value;
  if (!title)  { showToast('El concepto es obligatorio', 'error'); return; }
  if (!amount || isNaN(amount)) { showToast('Introduce un importe válido', 'error'); return; }
  const item = {
    id: state.editingId || uid(),
    title, amount: parseFloat(amount),
    description: document.getElementById('f-desc')?.value.trim() || '',
    category:    document.getElementById('f-cat')?.value || 'otro',
    status:      document.getElementById('f-status')?.value || 'pending',
    dueDate:     document.getElementById('f-due')?.value || null,
    paidAt:      null,
    createdAt:   new Date().toISOString(),
  };
  if (state.editingId) {
    state.payments[state.payments.findIndex(p => p.id === state.editingId)] = item;
    showToast('✏️ Pago actualizado', 'info');
  } else {
    state.payments.push(item);
    showToast('💳 Pago añadido!', 'success');
  }
  save(); closeModal(); render();
}

function submitIncident() {
  const title = document.getElementById('f-title')?.value.trim();
  if (!title) { showToast('El título es obligatorio', 'error'); return; }
  const cost = document.getElementById('f-cost')?.value;
  const item = {
    id: state.editingId || uid(),
    title,
    description: document.getElementById('f-desc')?.value.trim() || '',
    category:    document.getElementById('f-cat')?.value || 'otro',
    priority:    document.getElementById('f-priority')?.value || 'high',
    status:      document.getElementById('f-status')?.value || 'open',
    cost:        cost && !isNaN(cost) ? parseFloat(cost) : null,
    reportedAt:  document.getElementById('f-reported')?.value || new Date().toISOString().slice(0,10),
    resolvedAt:  null,
    createdAt:   new Date().toISOString(),
  };
  if (state.editingId) {
    state.incidents[state.incidents.findIndex(i => i.id === state.editingId)] = item;
    showToast('✏️ Imprevisto actualizado', 'info');
  } else {
    state.incidents.push(item);
    showToast('⚡ Imprevisto registrado!', 'success');
  }
  save(); closeModal(); render();
}

function deleteItem(type, id) {
  if (!confirm('¿Eliminar este elemento?')) return;
  const map = { task:'tasks', payment:'payments', incident:'incidents' };
  state[map[type]] = state[map[type]].filter(i => i.id !== id);
  save(); render();
  showToast('🗑️ Eliminado', 'info');
}

// ── TOAST ──────────────────────────────────
function showToast(msg, type = 'info') {
  const container = document.getElementById('toast-container');
  const icons = { success:'✅', error:'❌', info:'ℹ️' };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${icons[type]}</span> ${msg}`;
  container.appendChild(toast);
  setTimeout(() => { toast.style.opacity = '0'; toast.style.transform = 'translateX(16px)'; toast.style.transition = '0.3s'; setTimeout(() => toast.remove(), 300); }, 3000);
}

// ── ESCAPE ─────────────────────────────────
function esc(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── DATE DISPLAY ───────────────────────────
function updateDateDisplay() {
  const el = document.getElementById('date-display');
  if (!el) return;
  const days = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
  const months = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  const now = new Date();
  el.textContent = `${days[now.getDay()]}, ${now.getDate()} de ${months[now.getMonth()]} de ${now.getFullYear()}`;
}

// ── KEYBOARD SHORTCUTS ─────────────────────
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeModal();
  if (e.key === 'Enter' && document.getElementById('modal').classList.contains('open')) {
    const btn = document.querySelector('.btn-submit');
    if (btn && document.activeElement?.tagName !== 'TEXTAREA') btn.click();
  }
});

// ── INIT ───────────────────────────────────
(function init() {
  load();
  updateDateDisplay();
  render();
  switchView('dashboard');

  // Demo data (first time only)
  if (!state.tasks.length && !state.payments.length && !state.incidents.length) {
    const today = new Date();
    const fmt = d => d.toISOString().slice(0,10);
    const addDays = n => { const d = new Date(today); d.setDate(d.getDate()+n); return fmt(d); };

    state.tasks = [
      { id:uid(), title:'Pasar la aspiradora', description:'Especialmente el salón y dormitorios', category:'limpieza', priority:'medium', dueDate: addDays(1), done:false, doneAt:null, createdAt:new Date().toISOString() },
      { id:uid(), title:'Hacer la compra semanal', description:'Lista en la nevera', category:'compras', priority:'high', dueDate: addDays(0), done:false, doneAt:null, createdAt:new Date().toISOString() },
      { id:uid(), title:'Limpiar el baño', description:'', category:'limpieza', priority:'medium', dueDate: addDays(3), done:false, doneAt:null, createdAt:new Date().toISOString() },
      { id:uid(), title:'Cambiar filtro cafetera', description:'', category:'cocina', priority:'low', dueDate: addDays(7), done:true, doneAt:new Date().toISOString(), createdAt:new Date().toISOString() },
    ];
    state.payments = [
      { id:uid(), title:'Recibo de la Luz', description:'Iberdrola – bimestral', category:'luz', amount:87.50, status:'pending', dueDate: addDays(5), paidAt:null, createdAt:new Date().toISOString() },
      { id:uid(), title:'Alquiler', description:'Mensualidad piso', category:'alquiler', amount:950.00, status:'paid', dueDate: addDays(-3), paidAt:new Date().toISOString(), createdAt:new Date().toISOString() },
      { id:uid(), title:'Netflix', description:'Plan familiar', category:'suscripción', amount:17.99, status:'pending', dueDate: addDays(12), paidAt:null, createdAt:new Date().toISOString() },
    ];
    state.incidents = [
      { id:uid(), title:'Grifo cocina gotea', description:'El grifo del fregadero pierde agua por la junta', category:'avería', priority:'medium', status:'open', cost:45, reportedAt: fmt(today), resolvedAt:null, createdAt:new Date().toISOString() },
      { id:uid(), title:'Lavadora no centrifuga', description:'Hay que llamar al servicio técnico', category:'reparación', priority:'high', status:'progress', cost:null, reportedAt: addDays(-2), resolvedAt:null, createdAt:new Date().toISOString() },
    ];
    save();
    render();
  }
})();
