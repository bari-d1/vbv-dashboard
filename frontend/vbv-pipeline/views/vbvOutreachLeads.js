// ── Shared lead status data (used by both the table and detail views) ──────
const VBV_LEAD_STATUSES = ['CONTACTED', 'REPLIED', 'BOOKED_CALL', 'CONVERTED', 'NO_RESPONSE'];
const VBV_LEAD_STATUS_LABELS = {
  CONTACTED:   'Contacted',
  REPLIED:     'Replied',
  BOOKED_CALL: 'Booked Call',
  CONVERTED:   'Converted',
  NO_RESPONSE: 'No Response',
};
const VBV_LEAD_STATUS_STYLES = {
  NO_RESPONSE:  { bg: '#f3f4f6', color: '#9ca3af' },
  CONTACTED:    { bg: '#ffffff', color: '#1a1a1a', border: '1px solid var(--border)' },
  REPLIED:      { bg: '#eff6ff', color: '#3b82f6' },
  BOOKED_CALL:  { bg: '#fff7ed', color: '#f97316' },
  CONVERTED:    { bg: '#ecfdf5', color: '#22c55e' },
};

function vbvLeadStatusBadge(status) {
  const s = VBV_LEAD_STATUS_STYLES[status] || VBV_LEAD_STATUS_STYLES.NO_RESPONSE;
  return `<span class="vbv-badge" style="background:${s.bg};color:${s.color};${s.border ? `border:${s.border};` : ''}">${VBV_LEAD_STATUS_LABELS[status] || status}</span>`;
}

// ── Module state ────────────────────────────────────────────────────────────
let vbvOutreachActiveFilter = '';   // '' = All
let vbvOutreachActiveLeadId = null; // set before navigating to the detail view
let vbvOutreachActiveLead = null;

// ── Leads table view ────────────────────────────────────────────────────────
async function vbvRenderOutreachLeads() {
  let leads = [];
  try {
    leads = await vbvApi('GET', `/vbv/leads${vbvOutreachActiveFilter ? `?status=${vbvOutreachActiveFilter}` : ''}`);
  } catch(e) {
    return `<div class="vbv-alert vbv-alert-error">${e.message}</div>`;
  }

  const tabs = [{ value: '', label: 'All' }, ...VBV_LEAD_STATUSES.map(s => ({ value: s, label: VBV_LEAD_STATUS_LABELS[s] }))];
  const tabsHtml = tabs.map(t =>
    `<button class="${vbvOutreachActiveFilter === t.value ? 'active' : ''}" data-status="${t.value}">${t.label}</button>`
  ).join('');

  const isAdmin = vbvCurrentUser()?.role === 'admin';

  const rows = leads.map(l => `
    <tr>
      <td>${escapeHtml(l.churchName)}</td>
      <td>${escapeHtml(l.email)}</td>
      <td>${vbvLeadStatusBadge(l.status)}</td>
      <td>${new Date(l.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
      <td>
        <button class="vbv-btn vbv-btn-secondary vbv-btn-sm vbv-outreach-view-btn" data-lead-id="${l.id}">View</button>
        ${isAdmin ? `<button class="vbv-btn vbv-btn-danger vbv-btn-sm vbv-outreach-delete-btn" data-lead-id="${l.id}" data-lead-name="${escapeHtml(l.churchName)}" style="margin-left:6px;">Delete</button>` : ''}
      </td>
    </tr>`).join('') || '<tr><td colspan="5"><div class="vbv-empty">No leads found.</div></td></tr>';

  return `
    <div class="vbv-section-header">
      <h1>Outreach</h1>
      <button class="vbv-btn vbv-btn-primary" id="vbv-add-lead-btn">Add Lead</button>
    </div>
    <div class="vbv-filter-tabs" id="vbv-filter-tabs">${tabsHtml}</div>
    <div id="vbv-outreach-msg"></div>
    <div class="vbv-section">
      <div class="vbv-table-wrap">
        <table class="vbv-table">
          <thead><tr>
            <th>Church Name</th><th>Email</th><th>Status</th><th>Date Added</th><th></th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>

    <div id="vbv-add-lead-modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.4);z-index:1000;align-items:center;justify-content:center;">
      <div style="background:var(--surface);border-radius:10px;padding:28px;width:100%;max-width:480px;max-height:90vh;overflow-y:auto;margin:16px;">
        <h2 style="font-size:1.1rem;margin-bottom:20px;">Add Lead</h2>
        <div class="vbv-form-group"><label>Church Name *</label><input type="text" id="vbv-lead-church"></div>
        <div class="vbv-form-group"><label>Email *</label><input type="email" id="vbv-lead-email"></div>
        <div class="vbv-form-group"><label>Drive Link</label><input type="url" id="vbv-lead-drive" placeholder="https://drive.google.com/…"></div>
        <div id="vbv-add-lead-error" class="vbv-alert vbv-alert-error" style="display:none;margin-bottom:12px;"></div>
        <div style="display:flex;gap:10px;justify-content:flex-end;">
          <button class="vbv-btn vbv-btn-secondary" id="vbv-add-lead-cancel">Cancel</button>
          <button class="vbv-btn vbv-btn-primary" id="vbv-add-lead-save">Add Lead</button>
        </div>
      </div>
    </div>`;
}

function vbvBindOutreachLeads() {
  document.querySelectorAll('#vbv-filter-tabs button').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.dataset.status === vbvOutreachActiveFilter) return;
      vbvOutreachActiveFilter = btn.dataset.status;
      vbvNavigate('outreach');
    });
  });

  document.querySelectorAll('.vbv-outreach-view-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      vbvOutreachActiveLeadId = btn.dataset.leadId;
      vbvOutreachActiveLead = null;
      vbvNavigate('outreach-lead-detail');
    });
  });

  document.querySelectorAll('.vbv-outreach-delete-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm(`Delete lead "${btn.dataset.leadName}"? This cannot be undone.`)) return;
      btn.disabled = true; btn.textContent = 'Deleting…';
      try {
        await vbvApi('DELETE', `/vbv/leads/${btn.dataset.leadId}`);
        vbvNavigate('outreach');
      } catch(err) {
        alert(err.message);
        btn.disabled = false; btn.textContent = 'Delete';
      }
    });
  });

  const modal = document.getElementById('vbv-add-lead-modal');

  document.getElementById('vbv-add-lead-btn')?.addEventListener('click', () => {
    document.getElementById('vbv-lead-church').value = '';
    document.getElementById('vbv-lead-email').value = '';
    document.getElementById('vbv-lead-drive').value = '';
    document.getElementById('vbv-add-lead-error').style.display = 'none';
    modal.style.display = 'flex';
  });

  document.getElementById('vbv-add-lead-cancel')?.addEventListener('click', () => { modal.style.display = 'none'; });
  modal?.addEventListener('click', (e) => { if (e.target === modal) modal.style.display = 'none'; });

  document.getElementById('vbv-add-lead-save')?.addEventListener('click', async () => {
    const errEl = document.getElementById('vbv-add-lead-error');
    errEl.style.display = 'none';

    const churchName = document.getElementById('vbv-lead-church').value.trim();
    const email = document.getElementById('vbv-lead-email').value.trim();
    const driveLink = document.getElementById('vbv-lead-drive').value.trim();
    if (!churchName || !email) {
      errEl.textContent = 'Church name and email are required.';
      errEl.style.display = 'block';
      return;
    }

    const btn = document.getElementById('vbv-add-lead-save');
    btn.disabled = true; btn.textContent = 'Adding…';
    try {
      await vbvApi('POST', '/vbv/leads', { churchName, email, driveLink: driveLink || null });
      modal.style.display = 'none';
      vbvNavigate('outreach');
    } catch(err) {
      errEl.textContent = err.message; errEl.style.display = 'block';
      btn.disabled = false; btn.textContent = 'Add Lead';
    }
  });
}
