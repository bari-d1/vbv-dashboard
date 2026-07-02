async function vbvRenderLeadEditorDashboard() {
  let pool = [], queue = [], inSmReview = [], completed = [], active = [], editors = [];
  try {
    [pool, queue, inSmReview, completed, active] = await Promise.all([
      vbvApi('GET', '/vbv/jobs/pool'),
      vbvApi('GET', '/vbv/jobs/review-queue'),
      vbvApi('GET', '/vbv/jobs/in-sm-review'),
      vbvApi('GET', '/vbv/jobs/completed'),
      vbvApi('GET', '/vbv/jobs/all'),
    ]);
    editors = await vbvApi('GET', '/vbv/users/editors').catch(() => []);
  } catch(e) { return `<div class="vbv-alert vbv-alert-error">${e.message}</div>`; }

  const editorOptions = editors.map(e => `<option value="${e.id}">${escapeHtml(e.name)}</option>`).join('');

  // ── Job Pool (assign) ──────────────────────────────────────────────────
  const poolCards = pool.length
    ? pool.map(job => {
        const assignRow = `
          <div class="vbv-assign-row">
            <select id="assign-sel-${job.id}" class="vbv-assign-sel">
              <option value="">Select editor…</option>
              ${editorOptions}
            </select>
            <button class="vbv-btn vbv-btn-primary vbv-btn-sm vbv-assign-btn" data-job-id="${job.id}">Assign</button>
            <button class="vbv-btn vbv-btn-danger vbv-btn-sm vbv-delete-job-btn" data-job-id="${job.id}" data-job-title="${escapeHtml(job.title)}">Delete</button>
          </div>`;
        return vbvJobCardHTML(job, { actions: assignRow });
      }).join('')
    : '<div class="vbv-empty">No open jobs in the pool.</div>';

  // ── Review Queue ───────────────────────────────────────────────────────
  const queueCards = queue.length
    ? queue.map(job => {
        const sub = job.submissions?.[0];
        const timeline = vbvRenderTimeline(job.timelineLogs || []);
        const extra = `
          ${sub ? `
            <p><strong>Editor:</strong> ${escapeHtml(job.assignedTo?.name || '—')}</p>
            <p><strong>Submitted:</strong> ${new Date(sub.submittedAt).toLocaleDateString('en-GB')}</p>
            <p><strong>Drive Link:</strong> <a href="${escapeHtml(sub.driveLink)}" target="_blank" rel="noopener">Open Finished Edit</a></p>
            ${sub.editorNotes ? `<p><strong>Editor Notes:</strong> ${escapeHtml(sub.editorNotes)}</p>` : ''}
          ` : ''}
          <div style="margin-top:14px;">
            <strong style="font-size:0.8rem;text-transform:uppercase;letter-spacing:0.4px;color:var(--text-muted);">Timeline</strong>
            <div style="margin-top:8px;">${timeline}</div>
          </div>
          <div id="send-back-form-${job.id}" class="vbv-inline-form" style="display:none;margin-top:10px;">
            <div class="vbv-form-group">
              <label>Review Note *</label>
              <textarea id="sb-note-${job.id}" placeholder="Explain what needs to change…"></textarea>
            </div>
            <button class="vbv-btn vbv-btn-danger vbv-btn-sm vbv-confirm-sendback-btn" data-job-id="${job.id}">Confirm Send Back</button>
            <button class="vbv-btn vbv-btn-secondary vbv-btn-sm" onclick="document.getElementById('send-back-form-${job.id}').style.display='none'" style="margin-left:6px;">Cancel</button>
            <span id="sb-err-${job.id}" style="color:var(--accent);font-size:0.8rem;margin-left:8px;display:none;"></span>
          </div>`;

        const actions = `
          <button class="vbv-btn vbv-btn-success vbv-btn-sm vbv-approve-btn" data-job-id="${job.id}">Approve → Send to SM</button>
          <button class="vbv-btn vbv-btn-danger vbv-btn-sm" onclick="document.getElementById('send-back-form-${job.id}').style.display=''">Send Back to Editor</button>`;

        return vbvJobCardHTML(job, { extraDetails: extra, actions });
      }).join('')
    : '<div class="vbv-empty">No submissions to review.</div>';

  // ── Active Jobs (reassign) ─────────────────────────────────────────────
  const reassignableStatuses = ['assigned', 'in_progress', 'sent_back_by_lead', 'sent_back_by_sm'];
  const reassignable = active.filter(j => reassignableStatuses.includes(j.status));
  const reassignCards = reassignable.length
    ? reassignable.map(j => {
        const actions = `
          <div class="vbv-assign-row" style="margin-bottom:8px;">
            <input type="date" id="deadline-${j.id}" class="vbv-assign-sel" value="${j.deadline ? j.deadline.split('T')[0] : ''}">
            <button class="vbv-btn vbv-btn-secondary vbv-btn-sm vbv-save-deadline-btn" data-job-id="${j.id}">Save Deadline</button>
          </div>
          <div class="vbv-assign-row">
            <select id="reassign-sel-${j.id}" class="vbv-assign-sel">
              <option value="">Select editor…</option>
              ${editorOptions}
            </select>
            <button class="vbv-btn vbv-btn-secondary vbv-btn-sm vbv-reassign-btn" data-job-id="${j.id}">Reassign</button>
            <button class="vbv-btn vbv-btn-danger vbv-btn-sm vbv-delete-job-btn" data-job-id="${j.id}" data-job-title="${escapeHtml(j.title)}">Delete</button>
          </div>`;
        return vbvJobCardHTML(j, { actions });
      }).join('')
    : '<div class="vbv-empty">No active jobs to reassign.</div>';

  // ── In SM Review (read-only) ────────────────────────────────────────────
  const smReviewRows = inSmReview.length
    ? inSmReview.map(j => `
        <tr>
          <td>${escapeHtml(j.title)}</td>
          <td>${escapeHtml(j.artistName)}</td>
          <td>${escapeHtml(j.assignedTo?.name || '—')}</td>
          <td>${escapeHtml(j.createdBy?.name || '—')}</td>
          <td>${vbvFormatDeadline(j.deadline)}</td>
        </tr>`).join('')
    : '<tr><td colspan="5"><div class="vbv-empty">Nothing with Social Media right now.</div></td></tr>';

  // ── Completed (read-only) ──────────────────────────────────────────────
  const completedRows = completed.length
    ? completed.map(j => {
        const sub = j.submissions?.[0];
        return `
        <tr>
          <td>${escapeHtml(j.title)}</td>
          <td>${escapeHtml(j.artistName)}</td>
          <td>${escapeHtml(j.assignedTo?.name || '—')}</td>
          <td>${vbvStatusBadge('sm_approved')}</td>
          <td>${sub ? `<a href="${escapeHtml(sub.driveLink)}" target="_blank" rel="noopener">Open Video</a>` : '—'}</td>
        </tr>`;
      }).join('')
    : '<tr><td colspan="5"><div class="vbv-empty">No completed jobs yet.</div></td></tr>';

  return `
    <h1>Lead Editor</h1>

    <div class="vbv-section">
      <div class="vbv-section-header">
        <h2 style="margin:0;">Assign Jobs <span class="vbv-section-count">(${pool.length} open)</span></h2>
        <button class="vbv-btn vbv-btn-secondary vbv-btn-sm" onclick="vbvToggleSection('vbv-pool-list', this)">Show ▾</button>
      </div>
      <div id="vbv-assign-msg"></div>
      <div id="vbv-pool-list" class="vbv-section-body">
        ${poolCards}
      </div>
    </div>

    <div class="vbv-section">
      <div class="vbv-section-header">
        <h2 style="margin:0;">Review Queue <span class="vbv-section-count">(${queue.length} pending)</span></h2>
        <button class="vbv-btn vbv-btn-secondary vbv-btn-sm" onclick="vbvToggleSection('vbv-queue-list', this)">Show ▾</button>
      </div>
      <div id="vbv-review-msg"></div>
      <div id="vbv-queue-list" class="vbv-section-body">
        ${queueCards}
      </div>
    </div>

    <div class="vbv-section">
      <div class="vbv-section-header">
        <h2 style="margin:0;">Reassign Jobs <span class="vbv-section-count">(${reassignable.length} active)</span></h2>
        <button class="vbv-btn vbv-btn-secondary vbv-btn-sm" onclick="vbvToggleSection('vbv-reassign-list', this)">Show ▾</button>
      </div>
      <div id="vbv-reassign-msg"></div>
      <div id="vbv-reassign-list" class="vbv-section-body">
        ${reassignCards}
      </div>
    </div>

    <div class="vbv-section">
      <div class="vbv-section-header">
        <h2 style="margin:0;">In Social Media Review <span class="vbv-section-count">(${inSmReview.length})</span></h2>
        <button class="vbv-btn vbv-btn-secondary vbv-btn-sm" onclick="vbvToggleSection('vbv-sm-review-list', this)">Show ▾</button>
      </div>
      <div id="vbv-sm-review-list" class="vbv-section-body">
        <div class="vbv-table-wrap">
          <table class="vbv-table">
            <thead><tr><th>Title</th><th>Artist</th><th>Editor</th><th>Social Media</th><th>Deadline</th></tr></thead>
            <tbody>${smReviewRows}</tbody>
          </table>
        </div>
      </div>
    </div>

    <div class="vbv-section">
      <div class="vbv-section-header">
        <h2 style="margin:0;">Completed <span class="vbv-section-count">(${completed.length})</span></h2>
        <button class="vbv-btn vbv-btn-secondary vbv-btn-sm" onclick="vbvToggleSection('vbv-completed-list', this)">Show ▾</button>
      </div>
      <div id="vbv-completed-list" class="vbv-section-body">
        <div class="vbv-table-wrap">
          <table class="vbv-table">
            <thead><tr><th>Title</th><th>Artist</th><th>Editor</th><th>Status</th><th>Video</th></tr></thead>
            <tbody>${completedRows}</tbody>
          </table>
        </div>
      </div>
    </div>`;
}

function vbvBindLeadEditorDashboard() {
  document.querySelectorAll('.vbv-delete-job-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm(`Delete "${btn.dataset.jobTitle}"? This cannot be undone.`)) return;
      btn.disabled = true; btn.textContent = 'Deleting…';
      try {
        await vbvApi('DELETE', `/vbv/jobs/${btn.dataset.jobId}`);
        vbvNavigate('lead-editor-dashboard');
      } catch(err) {
        alert(err.message);
        btn.disabled = false; btn.textContent = 'Delete';
      }
    });
  });

  document.querySelectorAll('.vbv-assign-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const jobId = btn.dataset.jobId;
      const sel = document.getElementById(`assign-sel-${jobId}`);
      const editorId = sel?.value;
      const msgEl = document.getElementById('vbv-assign-msg');
      if (!editorId) { if (msgEl) msgEl.innerHTML = '<div class="vbv-alert vbv-alert-error">Select an editor first.</div>'; return; }
      btn.disabled = true; btn.textContent = 'Assigning…';
      try {
        await vbvApi('POST', `/vbv/jobs/${jobId}/assign`, { editorId });
        vbvNavigate('lead-editor-dashboard');
      } catch(err) {
        if (msgEl) msgEl.innerHTML = `<div class="vbv-alert vbv-alert-error">${err.message}</div>`;
        btn.disabled = false; btn.textContent = 'Assign';
      }
    });
  });

  document.querySelectorAll('.vbv-save-deadline-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const jobId = btn.dataset.jobId;
      const input = document.getElementById(`deadline-${jobId}`);
      const msgEl = document.getElementById('vbv-reassign-msg');
      if (!input?.value) { if (msgEl) msgEl.innerHTML = '<div class="vbv-alert vbv-alert-error">Pick a date first.</div>'; return; }
      btn.disabled = true; btn.textContent = 'Saving…';
      try {
        await vbvApi('PATCH', `/vbv/jobs/${jobId}`, { deadline: input.value });
        vbvNavigate('lead-editor-dashboard');
      } catch(err) {
        if (msgEl) msgEl.innerHTML = `<div class="vbv-alert vbv-alert-error">${err.message}</div>`;
        btn.disabled = false; btn.textContent = 'Save';
      }
    });
  });

  document.querySelectorAll('.vbv-reassign-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const jobId = btn.dataset.jobId;
      const sel = document.getElementById(`reassign-sel-${jobId}`);
      const editorId = sel?.value;
      const msgEl = document.getElementById('vbv-reassign-msg');
      if (!editorId) { if (msgEl) msgEl.innerHTML = '<div class="vbv-alert vbv-alert-error">Select an editor first.</div>'; return; }
      btn.disabled = true; btn.textContent = 'Reassigning…';
      try {
        await vbvApi('POST', `/vbv/jobs/${jobId}/reassign`, { editorId });
        vbvNavigate('lead-editor-dashboard');
      } catch(err) {
        if (msgEl) msgEl.innerHTML = `<div class="vbv-alert vbv-alert-error">${err.message}</div>`;
        btn.disabled = false; btn.textContent = 'Reassign';
      }
    });
  });

  document.querySelectorAll('.vbv-approve-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const jobId = btn.dataset.jobId;
      const msgEl = document.getElementById('vbv-review-msg');
      btn.disabled = true; btn.textContent = 'Approving…';
      try {
        await vbvApi('POST', `/vbv/jobs/${jobId}/approve`);
        vbvNavigate('lead-editor-dashboard');
      } catch(err) {
        if (msgEl) msgEl.innerHTML = `<div class="vbv-alert vbv-alert-error">${err.message}</div>`;
        btn.disabled = false; btn.textContent = 'Approve → Send to SM';
      }
    });
  });

  document.querySelectorAll('.vbv-confirm-sendback-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const jobId = btn.dataset.jobId;
      const reviewNote = document.getElementById(`sb-note-${jobId}`)?.value.trim();
      const errEl = document.getElementById(`sb-err-${jobId}`);
      if (!reviewNote) { errEl.textContent = 'Note is required.'; errEl.style.display='inline'; return; }
      errEl.style.display = 'none';
      btn.disabled = true; btn.textContent = 'Sending…';
      try {
        await vbvApi('POST', `/vbv/jobs/${jobId}/send-back`, { reviewNote });
        vbvNavigate('lead-editor-dashboard');
      } catch(err) {
        errEl.textContent = err.message; errEl.style.display='inline';
        btn.disabled = false; btn.textContent = 'Confirm Send Back';
      }
    });
  });
}
