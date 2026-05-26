async function vbvRenderForReview() {
  let jobs = [];
  try { jobs = await vbvApi('GET', '/vbv/jobs/for-review'); } catch(e) {
    return `<div class="vbv-alert vbv-alert-error">${e.message}</div>`;
  }

  if (!jobs.length) {
    return `<h1>For Review</h1><div class="vbv-empty">No edits are waiting for your review right now.</div>`;
  }

  const cards = jobs.map(job => {
    const sub = job.submissions?.[0];
    const timeline = vbvRenderTimeline(job.timelineLogs || []);
    const deadline = new Date(job.deadline).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const submittedDate = sub ? new Date(sub.submittedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

    // Full brief details for comparison
    let briefDetails = `
      <p><strong>Artist:</strong> ${escapeHtml(job.artistName)}</p>
      <p><strong>Source Material:</strong> <a href="${escapeHtml(job.sourceDriveLink)}" target="_blank" rel="noopener">Open Source Drive Link</a></p>
      <p><strong>Platforms:</strong> ${escapeHtml((job.platformTargets || []).join(', '))}</p>
      <p><strong>Deadline:</strong> ${deadline}</p>`;
    if (job.briefType === 'timestamp_clip') {
      briefDetails += `
        <p><strong>Start:</strong> ${escapeHtml(job.startTimestamp || '—')}</p>
        <p><strong>End:</strong> ${escapeHtml(job.endTimestamp || '—')}</p>
        ${job.clipNotes ? `<p><strong>Clip Notes:</strong> ${escapeHtml(job.clipNotes)}</p>` : ''}`;
    } else {
      briefDetails += job.editInstructions ? `<p><strong>Instructions:</strong> ${escapeHtml(job.editInstructions)}</p>` : '';
    }

    const extra = `
      <div style="margin-top:12px;padding:12px;background:#f8f9fa;border-radius:6px;border:1px solid var(--border);">
        <strong style="font-size:0.75rem;text-transform:uppercase;letter-spacing:0.4px;color:var(--text-muted);">Original Brief</strong>
        <div style="margin-top:8px;font-size:0.85rem;">${briefDetails}</div>
      </div>
      ${sub ? `
      <div style="margin-top:12px;padding:12px;background:#f0fdf4;border-radius:6px;border:1px solid #86efac;">
        <strong style="font-size:0.75rem;text-transform:uppercase;letter-spacing:0.4px;color:#166534;">Finished Edit</strong>
        <div style="margin-top:8px;font-size:0.85rem;">
          <p><strong>Editor:</strong> ${escapeHtml(job.assignedTo?.name || '—')}</p>
          <p><strong>Submitted:</strong> ${submittedDate}</p>
          <p><strong>Drive Link:</strong> <a href="${escapeHtml(sub.driveLink)}" target="_blank" rel="noopener">Open Finished Edit</a></p>
          ${sub.editorNotes ? `<p><strong>Editor Notes:</strong> ${escapeHtml(sub.editorNotes)}</p>` : ''}
        </div>
      </div>` : ''}
      <div style="margin-top:12px;">
        <strong style="font-size:0.75rem;text-transform:uppercase;letter-spacing:0.4px;color:var(--text-muted);">Timeline</strong>
        <div style="margin-top:8px;">${timeline}</div>
      </div>
      <div id="sm-sendback-form-${job.id}" class="vbv-inline-form" style="display:none;margin-top:10px;">
        <div class="vbv-form-group">
          <label>Correction Note *</label>
          <textarea id="sm-note-${job.id}" placeholder="Describe what needs to change…"></textarea>
        </div>
        <button class="vbv-btn vbv-btn-danger vbv-btn-sm vbv-sm-confirm-sendback" data-job-id="${job.id}">Confirm Request Correction</button>
        <button class="vbv-btn vbv-btn-secondary vbv-btn-sm" onclick="document.getElementById('sm-sendback-form-${job.id}').style.display='none'" style="margin-left:6px;">Cancel</button>
        <span id="sm-sb-err-${job.id}" style="color:var(--accent);font-size:0.8rem;margin-left:8px;display:none;"></span>
      </div>`;

    const actions = `
      <button class="vbv-btn vbv-btn-success vbv-btn-sm vbv-sm-approve-btn" data-job-id="${job.id}">Approve</button>
      <button class="vbv-btn vbv-btn-danger vbv-btn-sm" onclick="document.getElementById('sm-sendback-form-${job.id}').style.display=''">Request Correction</button>`;

    return `
      <div class="vbv-card" data-job-id="${job.id}">
        <div class="vbv-card-header">
          <div>
            <div class="vbv-card-title">${escapeHtml(job.title)}</div>
            <div class="vbv-card-meta">${escapeHtml(job.assignedTo?.name || '—')} &bull; ${vbvStatusBadge(job.briefType)} &bull; submitted ${submittedDate}</div>
          </div>
          <button class="vbv-btn vbv-btn-secondary vbv-btn-sm" onclick="vbvToggleDetails('fr-details-${job.id}', this)">Details ▾</button>
        </div>
        <div class="vbv-card-details" id="fr-details-${job.id}">
          ${extra}
          <div class="vbv-card-actions">${actions}</div>
        </div>
      </div>`;
  }).join('');

  return `
    <h1>For Review</h1>
    <div id="vbv-fr-msg"></div>
    ${cards}`;
}

function vbvBindForReview() {
  document.querySelectorAll('.vbv-sm-approve-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const jobId = btn.dataset.jobId;
      const msgEl = document.getElementById('vbv-fr-msg');
      btn.disabled = true; btn.textContent = 'Approving…';
      try {
        await vbvApi('POST', `/vbv/jobs/${jobId}/sm-approve`);
        vbvNavigate('for-review');
      } catch(err) {
        if (msgEl) msgEl.innerHTML = `<div class="vbv-alert vbv-alert-error">${err.message}</div>`;
        btn.disabled = false; btn.textContent = 'Approve';
      }
    });
  });

  document.querySelectorAll('.vbv-sm-confirm-sendback').forEach(btn => {
    btn.addEventListener('click', async () => {
      const jobId = btn.dataset.jobId;
      const smNote = document.getElementById(`sm-note-${jobId}`)?.value.trim();
      const errEl = document.getElementById(`sm-sb-err-${jobId}`);
      if (!smNote) { errEl.textContent = 'Correction note is required.'; errEl.style.display='inline'; return; }
      errEl.style.display = 'none';
      btn.disabled = true; btn.textContent = 'Sending…';
      try {
        await vbvApi('POST', `/vbv/jobs/${jobId}/sm-send-back`, { smNote });
        vbvNavigate('for-review');
      } catch(err) {
        errEl.textContent = err.message; errEl.style.display='inline';
        btn.disabled = false; btn.textContent = 'Confirm Request Correction';
      }
    });
  });
}
