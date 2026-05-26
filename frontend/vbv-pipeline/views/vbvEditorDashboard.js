async function vbvRenderEditorDashboard() {
  let jobs = [];
  try { jobs = await vbvApi('GET', '/vbv/jobs/assigned'); } catch(e) {
    return `<div class="vbv-alert vbv-alert-error">${e.message}</div>`;
  }

  if (!jobs.length) return `<h1>My Jobs</h1><div class="vbv-empty">You have no assigned jobs yet. Head to the Job Pool to claim one.</div>`;

  const cards = jobs.map(job => {
    const latestSub = job.submissions?.[0];
    const timeline = vbvRenderTimeline(job.timelineLogs || []);

    // Status-specific alerts
    let statusAlert = '';
    if (job.status === 'sent_back_by_lead' && latestSub?.reviewNote) {
      statusAlert = `
        <div class="vbv-alert vbv-alert-warning" style="margin-top:10px;">
          <strong>Sent back by Lead Editor:</strong> ${escapeHtml(latestSub.reviewNote)}
        </div>`;
    } else if (job.status === 'sent_back_by_sm' && latestSub?.smReviewNote) {
      statusAlert = `
        <div class="vbv-alert" style="margin-top:10px;background:#fff7ed;border:1px solid #fed7aa;color:#9a3412;">
          <strong>Correction requested by Social Media:</strong> ${escapeHtml(latestSub.smReviewNote)}
        </div>`;
    } else if (job.status === 'lead_approved') {
      statusAlert = `
        <div class="vbv-alert vbv-alert-info" style="margin-top:10px;">
          Your edit has been approved by the Lead Editor and is now with Social Media for final review.
        </div>`;
    } else if (job.status === 'sm_approved') {
      statusAlert = `
        <div class="vbv-alert" style="margin-top:10px;background:#ecfdf5;border:1px solid #6ee7b7;color:#065f46;">
          <strong>Pipeline complete.</strong> Social Media has approved this edit.
        </div>`;
    }

    const canSubmit = ['in_progress', 'sent_back_by_lead', 'sent_back_by_sm'].includes(job.status);
    const submitForm = canSubmit ? `
      <div class="vbv-inline-form" id="submit-form-${job.id}">
        <div class="vbv-form-group">
          <label>Drive Link to Finished Edit *</label>
          <input type="url" id="sub-drive-${job.id}" placeholder="https://drive.google.com/…">
        </div>
        <div class="vbv-form-group">
          <label>Notes to Lead Editor</label>
          <textarea id="sub-notes-${job.id}" placeholder="Anything the lead editor should know…"></textarea>
        </div>
        <button class="vbv-btn vbv-btn-primary vbv-btn-sm vbv-submit-btn" data-job-id="${job.id}">Submit for Review</button>
        <span class="vbv-submit-err" id="sub-err-${job.id}" style="color:var(--accent);font-size:0.8rem;margin-left:10px;display:none;"></span>
      </div>` : '';

    const extra = `
      ${statusAlert}
      <div style="margin-top:14px;">
        <strong style="font-size:0.8rem;text-transform:uppercase;letter-spacing:0.4px;color:var(--text-muted);">Timeline</strong>
        <div style="margin-top:8px;">${timeline}</div>
      </div>
      ${submitForm}`;

    return vbvJobCardHTML(job, { extraDetails: extra });
  }).join('');

  return `<h1>My Jobs</h1><div id="vbv-editor-msg"></div>${cards}`;
}

function vbvBindEditorDashboard() {
  document.querySelectorAll('.vbv-submit-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const jobId = btn.dataset.jobId;
      const driveLink = document.getElementById(`sub-drive-${jobId}`)?.value.trim();
      const editorNotes = document.getElementById(`sub-notes-${jobId}`)?.value.trim();
      const errEl = document.getElementById(`sub-err-${jobId}`);
      if (!driveLink) { errEl.textContent = 'Drive link is required.'; errEl.style.display='inline'; return; }
      errEl.style.display = 'none';
      btn.disabled = true; btn.textContent = 'Submitting…';
      try {
        await vbvApi('POST', `/vbv/submissions/${jobId}`, { driveLink, editorNotes });
        vbvNavigate('editor-dashboard');
      } catch(err) {
        errEl.textContent = err.message; errEl.style.display = 'inline';
        btn.disabled = false; btn.textContent = 'Submit for Review';
      }
    });
  });
}
