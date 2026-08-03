async function vbvRenderRemuneration() {
  const user = vbvCurrentUser();
  if (!user || user.role !== 'admin') {
    return `<div class="vbv-alert vbv-alert-warning" style="max-width:480px;">Admin access only.</div>`;
  }

  let completed = [];
  try {
    completed = await vbvApi('GET', '/vbv/jobs/completed');
  } catch(e) {
    return `<div class="vbv-alert vbv-alert-error">${e.message}</div>`;
  }

  if (!completed.length) {
    return `
      <h1>Remuneration</h1>
      <div class="vbv-section">
        <div class="vbv-empty">No completed jobs yet.</div>
      </div>`;
  }

  // Group by month → then by editor
  const months = {};
  completed.forEach(j => {
    const sub = j.submissions?.[0];
    const dateStr = sub?.smReviewedAt || j.createdAt;
    const d = new Date(dateStr);
    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const monthLabel = d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

    if (!months[monthKey]) months[monthKey] = { label: monthLabel, editors: {} };

    const editorName = j.assignedTo?.name || 'Unassigned';
    if (!months[monthKey].editors[editorName]) months[monthKey].editors[editorName] = [];
    months[monthKey].editors[editorName].push(j);
  });

  const monthKeys = Object.keys(months).sort((a, b) => b.localeCompare(a));

  const sectionsHTML = monthKeys.map(monthKey => {
    const { label, editors } = months[monthKey];
    const totalJobs = Object.values(editors).reduce((sum, jobs) => sum + jobs.length, 0);

    const editorBlocks = Object.keys(editors).sort().map(editorName => {
      const jobs = editors[editorName];
      const rows = jobs.map(j => {
        const sub = j.submissions?.[0];
        const completedDate = sub?.smReviewedAt
          ? new Date(sub.smReviewedAt).toLocaleDateString('en-GB')
          : '—';
        return `
          <tr>
            <td>${escapeHtml(j.title)}</td>
            <td>${escapeHtml(j.artistName)}</td>
            <td>${escapeHtml(completedDate)}</td>
            <td>${sub ? `<a href="${escapeHtml(sub.driveLink)}" target="_blank" rel="noopener">Open Video</a>` : '—'}</td>
          </tr>`;
      }).join('');

      return `
        <div style="margin-bottom:24px;">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
            <span style="font-size:0.85rem;font-weight:700;color:var(--text);">${escapeHtml(editorName)}</span>
            <span class="vbv-section-count">${jobs.length} job${jobs.length !== 1 ? 's' : ''}</span>
          </div>
          <div class="vbv-table-wrap">
            <table class="vbv-table">
              <thead>
                <tr><th>Title</th><th>Artist</th><th>Completed</th><th>Video</th></tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
          </div>
        </div>`;
    }).join('');

    return `
      <div class="vbv-section">
        <div class="vbv-section-header">
          <h2 style="margin:0;">${escapeHtml(label)} <span class="vbv-section-count">${totalJobs} job${totalJobs !== 1 ? 's' : ''}</span></h2>
          <button class="vbv-btn vbv-btn-secondary vbv-btn-sm" onclick="vbvToggleSection('vbv-renum-${monthKey}', this)">Show ▾</button>
        </div>
        <div id="vbv-renum-${monthKey}" class="vbv-section-body">
          ${editorBlocks}
        </div>
      </div>`;
  }).join('');

  return `<h1>Remuneration</h1>${sectionsHTML}`;
}

function vbvBindRemuneration() {}
