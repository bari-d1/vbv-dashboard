async function vbvRenderOffers() {
  let offers = [];
  try { offers = await vbvApi('GET', '/vbv/offers'); } catch (e) { return `<div class="vbv-alert vbv-alert-error">${e.message}</div>`; }

  const offerRows = offers.map(o => `
    <tr>
      <td>${escapeHtml(o.churchName)}</td>
      <td><a href="https://versebyverseedits.dayoadebari.com/${escapeHtml(o.slug)}" target="_blank" rel="noopener">/${escapeHtml(o.slug)}</a></td>
      <td>${o.isActive ? '<span style="color:#10b981">Active</span>' : '<span style="color:#9ca3af">Inactive</span>'}</td>
      <td>${new Date(o.createdAt).toLocaleDateString('en-GB')}</td>
    </tr>`).join('') || '<tr><td colspan="4" class="vbv-empty">No offer pages yet.</td></tr>';

  const filterOptions = offers.map(o => `<option value="${escapeHtml(o.slug)}">${escapeHtml(o.churchName)}</option>`).join('');

  return `
    <h1>Brand Offers</h1>
    <div class="vbv-section">
      <h2>Configured Offers</h2>
      <div class="vbv-table-wrap">
        <table class="vbv-table">
          <thead><tr><th>Church</th><th>URL</th><th>Status</th><th>Created</th></tr></thead>
          <tbody>${offerRows}</tbody>
        </table>
      </div>
    </div>
    <div class="vbv-section">
      <div class="vbv-section-header"><h2>Access Log</h2></div>
      <form id="vbv-offer-log-filter" style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:20px;align-items:flex-end;">
        <div class="vbv-form-group" style="margin:0">
          <label>Church</label>
          <select id="vbv-offer-filter-slug" style="padding:8px 10px;border:1px solid var(--border);border-radius:6px;font-size:0.85rem;">
            <option value="">All</option>
            ${filterOptions}
          </select>
        </div>
        <div class="vbv-form-group" style="margin:0">
          <label>Event</label>
          <select id="vbv-offer-filter-type" style="padding:8px 10px;border:1px solid var(--border);border-radius:6px;font-size:0.85rem;">
            <option value="">All</option>
            <option value="VIEW">Viewed</option>
            <option value="UNLOCK_SUCCESS">Unlocked</option>
            <option value="UNLOCK_FAIL">Wrong password</option>
          </select>
        </div>
        <button type="submit" class="vbv-btn vbv-btn-primary vbv-btn-sm">Filter</button>
        <button type="button" class="vbv-btn vbv-btn-secondary vbv-btn-sm" onclick="vbvLoadOfferLogs()">Reset</button>
      </form>
      <div id="vbv-offer-log-table"><div class="vbv-loading">Loading…</div></div>
    </div>`;
}

function vbvBindOffers() {
  vbvLoadOfferLogs();
  const form = document.getElementById('vbv-offer-log-filter');
  if (form) form.addEventListener('submit', e => { e.preventDefault(); vbvLoadOfferLogs(); });
}

function vbvOfferEventBadge(type) {
  const styles = {
    VIEW: 'color:#9ca3af',
    UNLOCK_SUCCESS: 'color:#10b981',
    UNLOCK_FAIL: 'color:var(--accent)',
  };
  const labels = {
    VIEW: 'Viewed',
    UNLOCK_SUCCESS: 'Unlocked',
    UNLOCK_FAIL: 'Wrong password',
  };
  return `<span style="${styles[type] || ''}">${labels[type] || type}</span>`;
}

async function vbvLoadOfferLogs() {
  const slug = document.getElementById('vbv-offer-filter-slug')?.value || '';
  const type = document.getElementById('vbv-offer-filter-type')?.value || '';
  const params = new URLSearchParams();
  if (slug) params.set('slug', slug);
  if (type) params.set('type', type);
  const el = document.getElementById('vbv-offer-log-table');
  if (!el) return;
  el.innerHTML = '<div class="vbv-loading">Loading…</div>';
  try {
    const logs = await vbvApi('GET', `/vbv/offers/logs?${params}`);
    if (!logs.length) { el.innerHTML = '<div class="vbv-empty">No access recorded yet.</div>'; return; }
    const rows = logs.map(l => `
      <tr>
        <td>${new Date(l.createdAt).toLocaleString('en-GB')}</td>
        <td>${escapeHtml(l.offer?.churchName || l.slug)}</td>
        <td>${vbvOfferEventBadge(l.type)}</td>
        <td>${escapeHtml(l.ipAddress || '—')}</td>
        <td style="max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(l.userAgent || '—')}</td>
      </tr>`).join('');
    el.innerHTML = `
      <div class="vbv-table-wrap">
        <table class="vbv-table">
          <thead><tr><th>Time</th><th>Church</th><th>Event</th><th>IP</th><th>User Agent</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  } catch (e) { el.innerHTML = `<div class="vbv-alert vbv-alert-error">${e.message}</div>`; }
}
