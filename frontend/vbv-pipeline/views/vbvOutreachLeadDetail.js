// Fills {variableName} placeholders in a template string — mirrors the
// substitution emailService.fillTemplate performs server-side, so the
// preview matches what actually gets sent.
function vbvFillTemplate(str, vars) {
  return String(str).replace(/\{(\w+)\}/g, (match, key) => (key in vars ? vars[key] : match));
}

async function vbvRenderOutreachLeadDetail() {
  if (!vbvOutreachActiveLeadId) {
    return '<div class="vbv-empty">No lead selected. <a href="#" onclick="vbvNavigate(\'outreach\');return false;">Back to Outreach</a></div>';
  }

  let templates;
  try {
    [vbvOutreachActiveLead, templates] = await Promise.all([
      vbvApi('GET', `/vbv/leads/${vbvOutreachActiveLeadId}`),
      vbvApi('GET', '/api/templates'),
    ]);
  } catch(e) {
    return `<div class="vbv-alert vbv-alert-error">${e.message}</div>`;
  }

  const lead = vbvOutreachActiveLead;

  const statusOptions = VBV_LEAD_STATUSES.map(s =>
    `<option value="${s}" ${lead.status === s ? 'selected' : ''}>${VBV_LEAD_STATUS_LABELS[s]}</option>`
  ).join('');

  const templateOptions = templates.map(t => `<option value="${t.id}">${escapeHtml(t.name)}</option>`).join('');

  // Chronological (oldest first) — the API returns newest first for the detail panel.
  const thread = [...(lead.emailLogs || [])].reverse();
  const threadHtml = thread.length
    ? thread.map(log => `
        <div class="vbv-thread-entry">
          <div class="vbv-thread-meta">
            <strong style="color:${log.direction === 'SENT' ? 'var(--accent)' : 'var(--text)'};">${log.direction === 'SENT' ? 'You' : 'Them'}</strong>
            &bull; ${new Date(log.sentAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </div>
          ${log.subject ? `<div class="vbv-thread-subject">${escapeHtml(log.subject)}</div>` : ''}
          <div class="vbv-thread-body">${escapeHtml(log.body)}</div>
        </div>`).join('')
    : '<div class="vbv-empty">No emails yet.</div>';

  return `
    <button class="vbv-btn vbv-btn-secondary vbv-btn-sm" id="vbv-outreach-back-btn" style="margin-bottom:16px;">&larr; Back to Leads</button>
    <div class="vbv-section-header">
      <h1>${escapeHtml(lead.churchName)}</h1>
      <button class="vbv-btn vbv-btn-primary" id="vbv-send-email-btn">Send Email</button>
    </div>
    <div id="vbv-outreach-detail-msg"></div>

    <div class="vbv-card" style="margin-bottom:32px;">
      <p><strong>Email:</strong> ${escapeHtml(lead.email)}</p>
      ${lead.driveLink ? `<p><strong>Drive Link:</strong> <a href="${escapeHtml(lead.driveLink)}" target="_blank" rel="noopener">Open Link</a></p>` : ''}
      <p style="margin-top:10px;"><strong>Status:</strong> ${vbvLeadStatusBadge(lead.status)}</p>
      <div class="vbv-form-group" style="max-width:220px;margin-top:14px;margin-bottom:0;">
        <label>Update Status</label>
        <select id="vbv-lead-status-select">${statusOptions}</select>
      </div>
    </div>

    <h2 style="font-size:1rem;margin-bottom:14px;">Email Thread</h2>
    <div id="vbv-email-thread">${threadHtml}</div>

    <div id="vbv-send-email-modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.4);z-index:1000;align-items:center;justify-content:center;">
      <div style="background:var(--surface);border-radius:10px;padding:28px;width:100%;max-width:640px;max-height:90vh;overflow-y:auto;margin:16px;">
        <h2 style="font-size:1.1rem;margin-bottom:20px;">Send Outreach Email</h2>
        <div class="vbv-form-group">
          <label>Template</label>
          <select id="vbv-send-template-select">
            <option value="">Select a template…</option>
            ${templateOptions}
          </select>
        </div>
        <div class="vbv-form-group">
          <label>Preview</label>
          <iframe id="vbv-template-preview" sandbox="" title="Email preview" style="width:100%;height:420px;border:1px solid var(--border);border-radius:8px;background:#fff;"></iframe>
        </div>
        <div id="vbv-send-email-error" class="vbv-alert vbv-alert-error" style="display:none;margin-bottom:12px;"></div>
        <div style="display:flex;gap:10px;justify-content:flex-end;">
          <button class="vbv-btn vbv-btn-secondary" id="vbv-send-email-cancel">Cancel</button>
          <button class="vbv-btn vbv-btn-primary" id="vbv-send-email-confirm" disabled>Confirm &amp; Send</button>
        </div>
      </div>
    </div>`;
}

function vbvBindOutreachLeadDetail() {
  document.getElementById('vbv-outreach-back-btn')?.addEventListener('click', () => {
    vbvOutreachActiveLeadId = null;
    vbvOutreachActiveLead = null;
    vbvNavigate('outreach');
  });

  // ── Status update ─────────────────────────────────────────────────────
  const statusSelect = document.getElementById('vbv-lead-status-select');
  statusSelect?.addEventListener('change', async () => {
    const msgEl = document.getElementById('vbv-outreach-detail-msg');
    msgEl.innerHTML = '';
    const previousStatus = vbvOutreachActiveLead.status;
    statusSelect.disabled = true;
    try {
      await vbvApi('PATCH', `/vbv/leads/${vbvOutreachActiveLeadId}`, { status: statusSelect.value });
      vbvNavigate('outreach-lead-detail');
    } catch(err) {
      msgEl.innerHTML = `<div class="vbv-alert vbv-alert-error">${err.message}</div>`;
      statusSelect.value = previousStatus;
      statusSelect.disabled = false;
    }
  });

  // ── Send email modal ──────────────────────────────────────────────────
  const modal = document.getElementById('vbv-send-email-modal');
  const templateSelect = document.getElementById('vbv-send-template-select');
  const preview = document.getElementById('vbv-template-preview');
  const confirmBtn = document.getElementById('vbv-send-email-confirm');
  let selectedTemplate = null;

  function resetSendModal() {
    templateSelect.value = '';
    preview.srcdoc = '';
    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Confirm & Send';
    selectedTemplate = null;
    document.getElementById('vbv-send-email-error').style.display = 'none';
  }

  document.getElementById('vbv-send-email-btn')?.addEventListener('click', () => {
    resetSendModal();
    modal.style.display = 'flex';
  });

  document.getElementById('vbv-send-email-cancel')?.addEventListener('click', () => { modal.style.display = 'none'; });
  modal?.addEventListener('click', (e) => { if (e.target === modal) modal.style.display = 'none'; });

  templateSelect?.addEventListener('change', async () => {
    const id = templateSelect.value;
    selectedTemplate = null;
    confirmBtn.disabled = true;
    if (!id) { preview.srcdoc = ''; return; }

    try {
      const template = await vbvApi('GET', `/api/templates/${id}`);
      const vars = { churchName: vbvOutreachActiveLead.churchName, driveLink: vbvOutreachActiveLead.driveLink || '' };
      preview.srcdoc = vbvFillTemplate(template.bodyHtml, vars);
      selectedTemplate = template;
      confirmBtn.disabled = false;
    } catch(err) {
      preview.srcdoc = '';
      alert(err.message);
    }
  });

  confirmBtn?.addEventListener('click', async () => {
    if (!selectedTemplate) return;
    const errEl = document.getElementById('vbv-send-email-error');
    errEl.style.display = 'none';
    confirmBtn.disabled = true; confirmBtn.textContent = 'Sending…';
    try {
      await vbvApi('POST', `/vbv/leads/${vbvOutreachActiveLeadId}/send-email`, { templateId: selectedTemplate.id });
      modal.style.display = 'none';
      vbvNavigate('outreach-lead-detail');
    } catch(err) {
      errEl.textContent = err.message; errEl.style.display = 'block';
      confirmBtn.disabled = false; confirmBtn.textContent = 'Confirm & Send';
    }
  });
}
