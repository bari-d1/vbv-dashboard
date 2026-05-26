function vbvJobCardHTML(job, opts = {}) {
  const deadline = new Date(job.deadline).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const platforms = Array.isArray(job.platformTargets) ? job.platformTargets.join(', ') : '';
  const detailsId = `details-${job.id}`;

  let detailsHTML = `
    <p><strong>Artist:</strong> ${escapeHtml(job.artistName)}</p>
    <p><strong>Drive Link:</strong> <a href="${escapeHtml(job.sourceDriveLink)}" target="_blank" rel="noopener">Open Source Material</a></p>
    <p><strong>Platforms:</strong> ${escapeHtml(platforms)}</p>
    <p><strong>Deadline:</strong> ${deadline}</p>`;

  if (job.briefType === 'timestamp_clip') {
    detailsHTML += `
      <p><strong>Start:</strong> ${escapeHtml(job.startTimestamp || '—')}</p>
      <p><strong>End:</strong> ${escapeHtml(job.endTimestamp || '—')}</p>
      ${job.clipNotes ? `<p><strong>Clip Notes:</strong> ${escapeHtml(job.clipNotes)}</p>` : ''}`;
  } else {
    detailsHTML += job.editInstructions ? `<p><strong>Instructions:</strong> ${escapeHtml(job.editInstructions)}</p>` : '';
  }

  if (opts.extraDetails) detailsHTML += opts.extraDetails;

  const actionsHTML = opts.actions || '';

  return `
    <div class="vbv-card" data-job-id="${job.id}">
      <div class="vbv-card-header">
        <div>
          <div class="vbv-card-title">${escapeHtml(job.title)}</div>
          <div class="vbv-card-meta">${escapeHtml(job.artistName)} &bull; ${vbvStatusBadge(job.briefType)} &bull; ${vbvStatusBadge(job.status)}</div>
        </div>
        <button class="vbv-btn vbv-btn-secondary vbv-btn-sm" onclick="vbvToggleDetails('${detailsId}', this)">Details ▾</button>
      </div>
      <div class="vbv-card-details" id="${detailsId}">
        ${detailsHTML}
        ${actionsHTML ? `<div class="vbv-card-actions">${actionsHTML}</div>` : ''}
      </div>
    </div>`;
}

function vbvToggleDetails(id, btn) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.toggle('open');
  btn.textContent = el.classList.contains('open') ? 'Details ▴' : 'Details ▾';
}
