// ── Shared client status/tier data (used by both the table and detail views) ──
const VBV_CLIENT_STATUSES = ['ACTIVE', 'PAUSED', 'CHURNED'];
const VBV_CLIENT_STATUS_LABELS = { ACTIVE: 'Active', PAUSED: 'Paused', CHURNED: 'Churned' };
const VBV_CLIENT_STATUS_STYLES = {
  ACTIVE:  { bg: '#ecfdf5', color: '#22c55e' },
  PAUSED:  { bg: '#fff7ed', color: '#f97316' },
  CHURNED: { bg: '#f3f4f6', color: '#9ca3af' },
};

function vbvClientStatusBadge(status) {
  const s = VBV_CLIENT_STATUS_STYLES[status] || VBV_CLIENT_STATUS_STYLES.CHURNED;
  return `<span class="vbv-badge" style="background:${s.bg};color:${s.color};">${VBV_CLIENT_STATUS_LABELS[status] || status}</span>`;
}

const VBV_CLIENT_TIERS = ['TIER_1', 'TIER_2', 'TIER_3'];
const VBV_CLIENT_TIER_LABELS = { TIER_1: 'Tier 1', TIER_2: 'Tier 2', TIER_3: 'Tier 3' };

// ── Module state ────────────────────────────────────────────────────────────
let vbvClientActiveFilter = '';   // '' = All
let vbvClientActiveId = null;     // set before navigating to the detail view
let vbvClientActiveClient = null;

// ── Clients table view ──────────────────────────────────────────────────────
async function vbvRenderClientsList() {
  let clients = [];
  try {
    clients = await vbvApi('GET', `/api/clients${vbvClientActiveFilter ? `?status=${vbvClientActiveFilter}` : ''}`);
  } catch(e) {
    return `<div class="vbv-alert vbv-alert-error">${e.message}</div>`;
  }

  const tabs = [{ value: '', label: 'All' }, ...VBV_CLIENT_STATUSES.map(s => ({ value: s, label: VBV_CLIENT_STATUS_LABELS[s] }))];
  const tabsHtml = tabs.map(t =>
    `<button class="${vbvClientActiveFilter === t.value ? 'active' : ''}" data-status="${t.value}">${t.label}</button>`
  ).join('');

  const rows = clients.map(c => `
    <tr>
      <td>${escapeHtml(c.churchName)}</td>
      <td>${escapeHtml(c.email)}</td>
      <td>${VBV_CLIENT_TIER_LABELS[c.tier] || c.tier}</td>
      <td>${vbvClientStatusBadge(c.status)}</td>
      <td>${c.startDate ? new Date(c.startDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</td>
      <td><button class="vbv-btn vbv-btn-secondary vbv-btn-sm vbv-client-view-btn" data-client-id="${c.id}">View</button></td>
    </tr>`).join('') || '<tr><td colspan="6"><div class="vbv-empty">No clients found.</div></td></tr>';

  return `
    <h1>Clients</h1>
    <div class="vbv-alert vbv-alert-info">Client records are created automatically when a lead is marked as <strong>Converted</strong>.</div>
    <div class="vbv-filter-tabs" id="vbv-clients-tabs">${tabsHtml}</div>
    <div class="vbv-section">
      <div class="vbv-table-wrap">
        <table class="vbv-table">
          <thead><tr>
            <th>Church Name</th><th>Email</th><th>Tier</th><th>Status</th><th>Start Date</th><th></th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>`;
}

function vbvBindClientsList() {
  document.querySelectorAll('#vbv-clients-tabs button').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.dataset.status === vbvClientActiveFilter) return;
      vbvClientActiveFilter = btn.dataset.status;
      vbvNavigate('clients');
    });
  });

  document.querySelectorAll('.vbv-client-view-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      vbvClientActiveId = btn.dataset.clientId;
      vbvClientActiveClient = null;
      vbvNavigate('client-detail');
    });
  });
}
