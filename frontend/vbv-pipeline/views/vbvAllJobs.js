async function vbvRenderAllJobs() {
  let jobs = [], editors = [];
  try {
    [jobs, editors] = await Promise.all([
      vbvApi('GET', '/vbv/jobs/all'),
      vbvApi('GET', '/vbv/users/editors').catch(() => []),
    ]);
  } catch(e) {
    return `<div class="vbv-alert vbv-alert-error">${e.message}</div>`;
  }

  const editorOptions = editors.map(e => `<option value="${e.id}">${escapeHtml(e.name)}</option>`).join('');
  const reassignableStatuses = ['assigned', 'in_progress', 'sent_back_by_lead', 'sent_back_by_sm', 'submitted'];

  const rows = jobs.map(j => {
    const canReassign = reassignableStatuses.includes(j.status);
    const reassignCell = canReassign ? `
      <div class="vbv-assign-row">
        <select id="reassign-sel-${j.id}" class="vbv-assign-sel">
          <option value="">Select editor…</option>
          ${editorOptions}
        </select>
        <button class="vbv-btn vbv-btn-secondary vbv-btn-sm vbv-reassign-btn" data-job-id="${j.id}">Reassign</button>
      </div>` : '<span style="color:var(--text-muted);font-size:0.8rem;">—</span>';

    return `
      <tr>
        <td>${escapeHtml(j.title)}</td>
        <td>${escapeHtml(j.artistName)}</td>
        <td>${escapeHtml(j.createdBy?.name || '—')}</td>
        <td>${j.assignedTo ? escapeHtml(j.assignedTo.name) : '<span style="color:var(--text-muted)">Unassigned</span>'}</td>
        <td>${vbvStatusBadge(j.status)}</td>
        <td>${new Date(j.deadline).toLocaleDateString('en-GB')}</td>
        <td>${reassignCell}</td>
        <td><button class="vbv-btn vbv-btn-danger vbv-btn-sm vbv-delete-job-btn" data-job-id="${j.id}" data-job-title="${escapeHtml(j.title)}">Delete</button></td>
      </tr>`;
  }).join('') || '<tr><td colspan="7"><div class="vbv-empty">No active jobs.</div></td></tr>';

  return `
    <h1>All Active Jobs</h1>
    <div id="vbv-reassign-msg"></div>
    <div class="vbv-section">
      <div class="vbv-table-wrap">
        <table class="vbv-table">
          <thead><tr>
            <th>Title</th><th>Artist</th><th>Created By</th><th>Editor</th><th>Status</th><th>Deadline</th><th>Reassign</th><th></th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>`;
}

function vbvBindAllJobs() {
  document.querySelectorAll('.vbv-delete-job-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm(`Delete "${btn.dataset.jobTitle}"? This cannot be undone.`)) return;
      btn.disabled = true; btn.textContent = 'Deleting…';
      try {
        await vbvApi('DELETE', `/vbv/jobs/${btn.dataset.jobId}`);
        vbvNavigate('all-jobs');
      } catch(err) {
        alert(err.message);
        btn.disabled = false; btn.textContent = 'Delete';
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
        vbvNavigate('all-jobs');
      } catch(err) {
        if (msgEl) msgEl.innerHTML = `<div class="vbv-alert vbv-alert-error">${err.message}</div>`;
        btn.disabled = false; btn.textContent = 'Reassign';
      }
    });
  });
}
