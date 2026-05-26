async function vbvRenderAdminPanel(view) {
  if (view === 'activity-log') return vbvRenderActivityLog();

  let users = [];
  try { users = await vbvApi('GET', '/vbv/users'); } catch(e) { return `<div class="vbv-alert vbv-alert-error">${e.message}</div>`; }

  const rows = users.map(u => `
    <tr>
      <td>${escapeHtml(u.name)}</td>
      <td>${escapeHtml(u.email)}</td>
      <td>${vbvStatusBadge(u.role)}</td>
      <td>${new Date(u.createdAt).toLocaleDateString('en-GB')}</td>
      <td>
        <div class="vbv-pw-wrap" style="max-width:180px;">
          <input type="password" value="${escapeHtml(u.credential?.plainPassword || '—')}" readonly style="font-family:monospace;font-size:0.8rem;">
          <button type="button" class="vbv-pw-toggle" onclick="vbvToggleLoginPw(this)">Show</button>
        </div>
      </td>
      <td>${u.isActive ? '<span style="color:#10b981">Active</span>' : '<span style="color:#9ca3af">Inactive</span>'}</td>
      <td>
        <select class="vbv-role-select" data-uid="${u.id}" style="font-size:0.8rem;padding:4px 8px;border:1px solid var(--border);border-radius:4px;">
          ${['social_media','editor','lead_editor','admin'].map(r => `<option value="${r}" ${u.role===r?'selected':''}>${r.replace('_',' ')}</option>`).join('')}
        </select>
      </td>
      <td>
        <button class="vbv-btn vbv-btn-sm ${u.isActive?'vbv-btn-secondary':'vbv-btn-primary'}" onclick="vbvToggleActive('${u.id}', ${!u.isActive})">${u.isActive?'Deactivate':'Activate'}</button>
        <button class="vbv-btn vbv-btn-sm vbv-btn-danger" onclick="vbvDeleteUser('${u.id}', '${escapeHtml(u.name)}')" style="margin-left:6px;">Delete</button>
      </td>
    </tr>`).join('') || '<tr><td colspan="8" class="vbv-empty">No users yet.</td></tr>';

  return `
    <h1>User Management</h1>
    <div class="vbv-section">
      <div class="vbv-section-header"><h2>Add User</h2></div>
      <div id="vbv-add-user-error" class="vbv-alert vbv-alert-error" style="display:none;"></div>
      <div id="vbv-add-user-success" class="vbv-alert vbv-alert-info" style="display:none;"></div>
      <form id="vbv-add-user-form" style="display:grid;grid-template-columns:1fr 1fr 1fr auto;gap:12px;align-items:end;">
        <div class="vbv-form-group" style="margin:0">
          <label>Full Name</label>
          <input type="text" id="vbv-new-name" required placeholder="Jordan Smith">
        </div>
        <div class="vbv-form-group" style="margin:0">
          <label>Email</label>
          <input type="email" id="vbv-new-email" required placeholder="jordan@vbv.com">
        </div>
        <div class="vbv-form-group" style="margin:0">
          <label>Role</label>
          <select id="vbv-new-role">
            <option value="social_media">Social Media</option>
            <option value="editor">Editor</option>
            <option value="lead_editor">Lead Editor</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <button type="submit" class="vbv-btn vbv-btn-primary" style="height:40px;">Add User</button>
      </form>
    </div>
    <div class="vbv-section">
      <h2>All Users</h2>
      <div class="vbv-table-wrap">
        <table class="vbv-table">
          <thead><tr>
            <th>Name</th><th>Email</th><th>Role</th><th>Added</th><th>Password</th><th>Status</th><th>Change Role</th><th>Actions</th>
          </tr></thead>
          <tbody id="vbv-users-tbody">${rows}</tbody>
        </table>
      </div>
    </div>`;
}

function vbvBindAdminPanel() {
  const form = document.getElementById('vbv-add-user-form');
  if (!form) return;
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const name = document.getElementById('vbv-new-name').value.trim();
    const email = document.getElementById('vbv-new-email').value.trim();
    const roleValue = document.getElementById('vbv-new-role').value;
    const errEl = document.getElementById('vbv-add-user-error');
    const sucEl = document.getElementById('vbv-add-user-success');
    errEl.style.display = 'none'; sucEl.style.display = 'none';
    try {
      const u = await vbvApi('POST', '/vbv/users', { name, email, roleValue });
      sucEl.textContent = `User "${u.name}" created. Password: ${u.plainPassword} (sent by email)`;
      sucEl.style.display = 'block';
      form.reset();
      vbvNavigate('admin-panel');
    } catch(err) {
      errEl.textContent = err.message; errEl.style.display = 'block';
    }
  });

  document.querySelectorAll('.vbv-role-select').forEach(sel => {
    sel.addEventListener('change', async () => {
      try {
        await vbvApi('PATCH', `/vbv/users/${sel.dataset.uid}`, { roleValue: sel.value });
      } catch(e) { alert('Failed to update role: ' + e.message); }
    });
  });
}

async function vbvToggleActive(id, isActive) {
  try {
    await vbvApi('PATCH', `/vbv/users/${id}`, { isActive });
    vbvNavigate('admin-panel');
  } catch(e) { alert(e.message); }
}

async function vbvDeleteUser(id, name) {
  if (!confirm(`Delete user "${name}"? This cannot be undone.`)) return;
  try {
    await vbvApi('DELETE', `/vbv/users/${id}`);
    vbvNavigate('admin-panel');
  } catch(e) { alert(e.message); }
}

async function vbvRenderActivityLog() {
  return `
    <h1>Activity Log</h1>
    <div class="vbv-section">
      <form id="vbv-log-filter" style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:20px;align-items:flex-end;">
        <div class="vbv-form-group" style="margin:0">
          <label>Role</label>
          <select id="vbv-filter-role" style="padding:8px 10px;border:1px solid var(--border);border-radius:6px;font-size:0.85rem;">
            <option value="">All roles</option>
            ${['social_media','editor','lead_editor','admin'].map(r=>`<option value="${r}">${r.replace('_',' ')}</option>`).join('')}
          </select>
        </div>
        <div class="vbv-form-group" style="margin:0">
          <label>From</label>
          <input type="date" id="vbv-filter-from" style="padding:8px 10px;border:1px solid var(--border);border-radius:6px;font-size:0.85rem;">
        </div>
        <div class="vbv-form-group" style="margin:0">
          <label>To</label>
          <input type="date" id="vbv-filter-to" style="padding:8px 10px;border:1px solid var(--border);border-radius:6px;font-size:0.85rem;">
        </div>
        <button type="submit" class="vbv-btn vbv-btn-primary vbv-btn-sm">Filter</button>
        <button type="button" class="vbv-btn vbv-btn-secondary vbv-btn-sm" onclick="vbvLoadLogs()">Reset</button>
      </form>
      <div id="vbv-log-table"><div class="vbv-loading">Loading…</div></div>
    </div>`;
}

function vbvBindActivityLog() {
  vbvLoadLogs();
  const form = document.getElementById('vbv-log-filter');
  if (form) form.addEventListener('submit', e => { e.preventDefault(); vbvLoadLogs(); });
}

async function vbvLoadLogs() {
  const roleFilter = document.getElementById('vbv-filter-role')?.value || '';
  const dateFrom = document.getElementById('vbv-filter-from')?.value || '';
  const dateTo = document.getElementById('vbv-filter-to')?.value || '';
  const params = new URLSearchParams();
  if (roleFilter) params.set('roleFilter', roleFilter);
  if (dateFrom) params.set('dateFrom', dateFrom);
  if (dateTo) params.set('dateTo', dateTo);
  const el = document.getElementById('vbv-log-table');
  if (!el) return;
  el.innerHTML = '<div class="vbv-loading">Loading…</div>';
  try {
    const logs = await vbvApi('GET', `/vbv/logs/activity?${params}`);
    if (!logs.length) { el.innerHTML = '<div class="vbv-empty">No activity found.</div>'; return; }
    const rows = logs.map(l => `
      <tr>
        <td>${new Date(l.createdAt).toLocaleString('en-GB')}</td>
        <td>${escapeHtml(l.actor?.name || '—')}</td>
        <td>${l.actor?.role ? vbvStatusBadge(l.actor.role) : '—'}</td>
        <td>${escapeHtml(l.actionType)}</td>
        <td>${escapeHtml(l.detail || '—')}</td>
      </tr>`).join('');
    el.innerHTML = `
      <div class="vbv-table-wrap">
        <table class="vbv-table">
          <thead><tr><th>Time</th><th>User</th><th>Role</th><th>Action</th><th>Detail</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  } catch(e) { el.innerHTML = `<div class="vbv-alert vbv-alert-error">${e.message}</div>`; }
}
