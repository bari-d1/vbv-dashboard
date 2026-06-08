async function vbvRenderClientDetail() {
  if (!vbvClientActiveId) {
    return '<div class="vbv-empty">No client selected. <a href="#" onclick="vbvNavigate(\'clients\');return false;">Back to Clients</a></div>';
  }

  try {
    vbvClientActiveClient = await vbvApi('GET', `/api/clients/${vbvClientActiveId}`);
  } catch(e) {
    return `<div class="vbv-alert vbv-alert-error">${e.message}</div>`;
  }

  const client = vbvClientActiveClient;

  const tierOptions = VBV_CLIENT_TIERS.map(t =>
    `<option value="${t}" ${client.tier === t ? 'selected' : ''}>${VBV_CLIENT_TIER_LABELS[t]}</option>`
  ).join('');
  const statusOptions = VBV_CLIENT_STATUSES.map(s =>
    `<option value="${s}" ${client.status === s ? 'selected' : ''}>${VBV_CLIENT_STATUS_LABELS[s]}</option>`
  ).join('');

  // Chronological (oldest first) — the API returns newest first.
  const sentLogs = (client.emailLogs || []).filter(l => l.direction === 'SENT');
  const thread = [...sentLogs].reverse();
  const logHtml = thread.length
    ? thread.map((log, i) => {
        const bodyId = `vbv-client-email-body-${i}`;
        return `
          <div class="vbv-card" style="margin-bottom:10px;">
            <div class="vbv-card-header">
              <div>
                <div class="vbv-card-title">${log.subject ? escapeHtml(log.subject) : '(no subject)'}</div>
                <div class="vbv-card-meta">${new Date(log.sentAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
              </div>
              <button class="vbv-btn vbv-btn-secondary vbv-btn-sm" onclick="vbvToggleDetails('${bodyId}', this)">Show Body ▾</button>
            </div>
            <div class="vbv-card-details" id="${bodyId}">
              <div style="white-space:pre-wrap;font-size:0.85rem;color:var(--text-muted);">${escapeHtml(log.body)}</div>
            </div>
          </div>`;
      }).join('')
    : '<div class="vbv-empty">No emails sent yet.</div>';

  return `
    <button class="vbv-btn vbv-btn-secondary vbv-btn-sm" id="vbv-client-back-btn" style="margin-bottom:16px;">&larr; Back to Clients</button>
    <h1>${escapeHtml(client.churchName)}</h1>
    <p class="vbv-card-meta" style="margin-bottom:24px;">${escapeHtml(client.email)}</p>
    <div id="vbv-client-detail-msg"></div>

    <div class="vbv-section">
      <h2>Client Info</h2>
      <div class="vbv-card">
        <div style="display:flex;gap:16px;flex-wrap:wrap;">
          <div class="vbv-form-group" style="flex:1;min-width:160px;">
            <label>Tier</label>
            <select id="vbv-client-tier">${tierOptions}</select>
          </div>
          <div class="vbv-form-group" style="flex:1;min-width:160px;">
            <label>Status</label>
            <select id="vbv-client-status">${statusOptions}</select>
          </div>
          <div class="vbv-form-group" style="flex:1;min-width:160px;">
            <label>Start Date</label>
            <input type="date" id="vbv-client-start-date" value="${client.startDate ? client.startDate.split('T')[0] : ''}">
          </div>
        </div>
        <div class="vbv-form-group">
          <label>Notes</label>
          <textarea id="vbv-client-notes" style="min-height:120px;">${escapeHtml(client.notes || '')}</textarea>
        </div>
        <button class="vbv-btn vbv-btn-primary" id="vbv-client-save-btn">Save Changes</button>
      </div>
    </div>

    <div class="vbv-section">
      <h2>Email Log</h2>
      ${logHtml}
    </div>

    <div class="vbv-section">
      <h2>Compose Email</h2>
      <div class="vbv-card">
        <div class="vbv-form-group"><label>Subject</label><input type="text" id="vbv-client-compose-subject"></div>
        <div class="vbv-form-group"><label>Body</label><textarea id="vbv-client-compose-body" style="min-height:160px;"></textarea></div>
        <div id="vbv-client-compose-msg"></div>
        <button class="vbv-btn vbv-btn-primary" id="vbv-client-send-btn">Send</button>
      </div>
    </div>`;
}

function vbvBindClientDetail() {
  document.getElementById('vbv-client-back-btn')?.addEventListener('click', () => {
    vbvClientActiveId = null;
    vbvClientActiveClient = null;
    vbvNavigate('clients');
  });

  // ── Save Changes ──────────────────────────────────────────────────────
  document.getElementById('vbv-client-save-btn')?.addEventListener('click', async () => {
    const msgEl = document.getElementById('vbv-client-detail-msg');
    msgEl.innerHTML = '';

    const tier = document.getElementById('vbv-client-tier').value;
    const status = document.getElementById('vbv-client-status').value;
    const notes = document.getElementById('vbv-client-notes').value.trim();
    const startDate = document.getElementById('vbv-client-start-date').value;

    const btn = document.getElementById('vbv-client-save-btn');
    btn.disabled = true; btn.textContent = 'Saving…';
    try {
      await vbvApi('PATCH', `/api/clients/${vbvClientActiveId}`, {
        tier, status, notes: notes || null, startDate: startDate || null,
      });
      msgEl.innerHTML = '<div class="vbv-alert vbv-alert-info">Changes saved.</div>';
    } catch(err) {
      msgEl.innerHTML = `<div class="vbv-alert vbv-alert-error">${err.message}</div>`;
    } finally {
      btn.disabled = false; btn.textContent = 'Save Changes';
    }
  });

  // ── Compose & send ────────────────────────────────────────────────────
  document.getElementById('vbv-client-send-btn')?.addEventListener('click', async () => {
    const msgEl = document.getElementById('vbv-client-compose-msg');
    msgEl.innerHTML = '';

    const subject = document.getElementById('vbv-client-compose-subject').value.trim();
    const body = document.getElementById('vbv-client-compose-body').value.trim();
    if (!subject || !body) {
      msgEl.innerHTML = '<div class="vbv-alert vbv-alert-error">Subject and body are required.</div>';
      return;
    }

    const btn = document.getElementById('vbv-client-send-btn');
    btn.disabled = true; btn.textContent = 'Sending…';
    try {
      await vbvApi('POST', `/api/clients/${vbvClientActiveId}/send-email`, { subject, body });
      msgEl.innerHTML = '<div class="vbv-alert vbv-alert-info">Email sent successfully.</div>';
      setTimeout(() => vbvNavigate('client-detail'), 1500);
    } catch(err) {
      msgEl.innerHTML = `<div class="vbv-alert vbv-alert-error">${err.message}</div>`;
      btn.disabled = false; btn.textContent = 'Send';
    }
  });
}
