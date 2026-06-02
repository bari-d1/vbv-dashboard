async function vbvRenderVeditsJobs() {
  let jobs = [];
  try { jobs = await vbvApi('GET', '/vbv/jobs/all'); } catch(e) {
    return `<div class="vbv-alert vbv-alert-error">${e.message}</div>`;
  }

  const rows = jobs.map(j => `
    <tr>
      <td>${escapeHtml(j.title)}</td>
      <td>${escapeHtml(j.artistName)}</td>
      <td>${escapeHtml(j.createdBy?.name || '—')}</td>
      <td>${j.assignedTo ? escapeHtml(j.assignedTo.name) : '<span style="color:var(--text-muted)">Unassigned</span>'}</td>
      <td>${vbvStatusBadge(j.status)}</td>
      <td>${new Date(j.deadline).toLocaleDateString('en-GB')}</td>
      <td><button class="vbv-btn vbv-btn-danger vbv-btn-sm vbv-delete-job-btn" data-job-id="${j.id}" data-job-title="${escapeHtml(j.title)}">Delete</button></td>
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
    </div>`;
}

function vbvBindVeditsJobs() {
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
