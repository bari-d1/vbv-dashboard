function vbvJobCardHTML(job, opts = {}) {
  const deadline = vbvFormatDeadline(job.deadline);
  const platforms = Array.isArray(job.platformTargets) ? job.platformTargets.join(', ') : '';
  const detailsId = `details-${job.id}`;

  let detailsHTML = `
    <p><strong>Artist:</strong> ${escapeHtml(job.artistName)}</p>
    <p><strong>Drive Link:</strong> <a href="${escapeHtml(job.sourceDriveLink)}" target="_blank" rel="noopener">Open Source Material</a></p>
    <p><strong>Platforms:</strong> ${escapeHtml(platforms)}</p>
    <p><strong>Deadline:</strong> ${deadline}</p>`;

  if (job.briefType === 'vedits') {
    detailsHTML += `
      <p><strong>Start:</strong> ${escapeHtml(job.startTimestamp || '—')}</p>
      <p><strong>End:</strong> ${escapeHtml(job.endTimestamp || '—')}</p>
      ${job.clipNotes ? `<p><strong>Hook &amp; Payoff:</strong><br><span style="white-space:pre-wrap;font-size:0.82rem;">${escapeHtml(job.clipNotes)}</span></p>` : ''}`;
  } else if (job.briefType === 'timestamp_clip') {
    detailsHTML += `
      <p><strong>Start:</strong> ${escapeHtml(job.startTimestamp || '—')}</p>
      <p><strong>End:</strong> ${escapeHtml(job.endTimestamp || '—')}</p>
      ${job.clipNotes ? `<p><strong>Clip Notes:</strong> ${escapeHtml(job.clipNotes)}</p>` : ''}`;
  } else {
    detailsHTML += job.editInstructions ? `<p><strong>Instructions:</strong> ${escapeHtml(job.editInstructions)}</p>` : '';
  }

  if (opts.extraDetails) detailsHTML += opts.extraDetails;

  const actionsHTML = opts.actions || '';

  const vbvPipelineTag = job.briefType === 'vedits'
    ? `<span class="vbv-badge" style="background:#ede9fe;color:#7c3aed;margin-left:6px;">VBV</span>`
    : '';

  return `
    <div class="vbv-card" data-job-id="${job.id}">
      <div class="vbv-card-header">
        <div>
          <div class="vbv-card-title">${escapeHtml(job.title)}${vbvPipelineTag}</div>
          <div class="vbv-card-meta">${escapeHtml(job.artistName)} &bull; ${vbvStatusBadge(job.briefType)} &bull; ${vbvStatusBadge(job.status)}${job.assignedTo?.name ? ` &bull; ${escapeHtml(job.assignedTo.name)}` : ''}</div>
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

function vbvToggleSection(id, btn) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.toggle('open');
  btn.textContent = el.classList.contains('open') ? 'Hide ▴' : 'Show ▾';
}
