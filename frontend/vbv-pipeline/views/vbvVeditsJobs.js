async function vbvRenderVeditsJobs() {
  let jobs = [];
  try { jobs = await vbvApi('GET', '/vbv/jobs/all'); } catch(e) {
    return `<div class="vbv-alert vbv-alert-error">${e.message}</div>`;
  }

  const canEdit = (status) => ['open', 'assigned'].includes(status);

  const rows = jobs.map(j => `
    <tr>
      <td>${escapeHtml(j.title)}</td>
      <td>${escapeHtml(j.artistName)}</td>
      <td>${escapeHtml(j.createdBy?.name || '—')}</td>
      <td>${j.assignedTo ? escapeHtml(j.assignedTo.name) : '<span style="color:var(--text-muted)">Unassigned</span>'}</td>
      <td>${vbvStatusBadge(j.status)}</td>
      <td>${vbvFormatDeadline(j.deadline)}</td>
      <td style="display:flex;gap:6px;">
        ${canEdit(j.status) ? `<button class="vbv-btn vbv-btn-secondary vbv-btn-sm vbv-edit-job-btn" data-job='${JSON.stringify(j)}'>Edit</button>` : ''}
        <button class="vbv-btn vbv-btn-danger vbv-btn-sm vbv-delete-job-btn" data-job-id="${j.id}" data-job-title="${escapeHtml(j.title)}">Delete</button>
      </td>
    </tr>`).join('') || '<tr><td colspan="7"><div class="vbv-empty">No active Vedits jobs.</div></td></tr>';

  return `
    <h1>All Vedits Jobs</h1>
    <div id="vbv-vedits-jobs-msg"></div>
    <div class="vbv-section">
      <div class="vbv-table-wrap">
        <table class="vbv-table">
          <thead><tr>
            <th>Title</th><th>Artist</th><th>Created By</th><th>Editor</th><th>Status</th><th>Deadline</th><th></th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>
    <div id="vbv-edit-job-modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.4);z-index:1000;display:none;align-items:center;justify-content:center;">
      <div style="background:var(--surface);border-radius:10px;padding:28px;width:100%;max-width:520px;max-height:90vh;overflow-y:auto;margin:16px;">
        <h2 style="font-size:1.1rem;margin-bottom:20px;">Edit Brief</h2>
        <div class="vbv-form-group"><label>Title *</label><input type="text" id="vbv-edit-title"></div>
        <div class="vbv-form-group"><label>Artist / Church *</label><input type="text" id="vbv-edit-artist"></div>
        <div class="vbv-form-group"><label>Drive Link *</label><input type="url" id="vbv-edit-drive"></div>
        <div style="display:flex;gap:12px;">
          <div class="vbv-form-group" style="flex:1"><label>Start</label><input type="text" id="vbv-edit-start" placeholder="00:01:23"></div>
          <div class="vbv-form-group" style="flex:1"><label>End</label><input type="text" id="vbv-edit-end" placeholder="00:02:45"></div>
        </div>
        <div class="vbv-form-group"><label>Clip Notes</label><textarea id="vbv-edit-clipnotes" style="min-height:80px;"></textarea></div>
        <div class="vbv-form-group">
          <label>Platform Target *</label>
          <div class="vbv-checkboxes">
            <label><input type="checkbox" name="vbv-edit-platform" value="Instagram"> Instagram</label>
            <label><input type="checkbox" name="vbv-edit-platform" value="TikTok"> TikTok</label>
            <label><input type="checkbox" name="vbv-edit-platform" value="YouTube"> YouTube</label>
          </div>
        </div>
        <div id="vbv-edit-error" class="vbv-alert vbv-alert-error" style="display:none;margin-bottom:12px;"></div>
        <div style="display:flex;gap:10px;justify-content:flex-end;">
          <button class="vbv-btn vbv-btn-secondary" id="vbv-edit-cancel">Cancel</button>
          <button class="vbv-btn vbv-btn-primary" id="vbv-edit-save">Save Changes</button>
        </div>
      </div>
    </div>`;
}

function vbvBindVeditsJobs() {
  let editingJobId = null;
  const modal = document.getElementById('vbv-edit-job-modal');

  function openEditModal(job) {
    editingJobId = job.id;
    document.getElementById('vbv-edit-title').value = job.title || '';
    document.getElementById('vbv-edit-artist').value = job.artistName || '';
    document.getElementById('vbv-edit-drive').value = job.sourceDriveLink || '';
    document.getElementById('vbv-edit-start').value = job.startTimestamp || '';
    document.getElementById('vbv-edit-end').value = job.endTimestamp || '';
    document.getElementById('vbv-edit-clipnotes').value = job.clipNotes || '';
    document.querySelectorAll('input[name="vbv-edit-platform"]').forEach(cb => {
      cb.checked = (job.platformTargets || []).includes(cb.value);
    });
    document.getElementById('vbv-edit-error').style.display = 'none';
    modal.style.display = 'flex';
  }

  document.querySelectorAll('.vbv-edit-job-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      try { openEditModal(JSON.parse(btn.dataset.job)); } catch { /* ignore */ }
    });
  });

  document.getElementById('vbv-edit-cancel')?.addEventListener('click', () => {
    modal.style.display = 'none';
  });

  modal?.addEventListener('click', (e) => {
    if (e.target === modal) modal.style.display = 'none';
  });

  document.getElementById('vbv-edit-save')?.addEventListener('click', async () => {
    const errEl = document.getElementById('vbv-edit-error');
    errEl.style.display = 'none';
    const platforms = [...document.querySelectorAll('input[name="vbv-edit-platform"]:checked')].map(c => c.value);
    if (!platforms.length) { errEl.textContent = 'Select at least one platform.'; errEl.style.display = 'block'; return; }

    const btn = document.getElementById('vbv-edit-save');
    btn.disabled = true; btn.textContent = 'Saving…';
    try {
      await vbvApi('PATCH', `/vbv/jobs/${editingJobId}`, {
        title:           document.getElementById('vbv-edit-title').value.trim(),
        artistName:      document.getElementById('vbv-edit-artist').value.trim(),
        sourceDriveLink: document.getElementById('vbv-edit-drive').value.trim(),
        startTimestamp:  document.getElementById('vbv-edit-start').value || null,
        endTimestamp:    document.getElementById('vbv-edit-end').value || null,
        clipNotes:       document.getElementById('vbv-edit-clipnotes').value || null,
        platformTargets: platforms,
      });
      modal.style.display = 'none';
      vbvNavigate('vedits-jobs');
    } catch(err) {
      errEl.textContent = err.message; errEl.style.display = 'block';
      btn.disabled = false; btn.textContent = 'Save Changes';
    }
  });

  document.querySelectorAll('.vbv-delete-job-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm(`Delete "${btn.dataset.jobTitle}"? This cannot be undone.`)) return;
      btn.disabled = true; btn.textContent = 'Deleting…';
      try {
        await vbvApi('DELETE', `/vbv/jobs/${btn.dataset.jobId}`);
        vbvNavigate('vedits-jobs');
      } catch(err) {
        alert(err.message);
        btn.disabled = false; btn.textContent = 'Delete';
      }
    });
  });
}
