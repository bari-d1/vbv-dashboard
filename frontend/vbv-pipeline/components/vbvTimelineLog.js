function vbvRenderTimeline(logs) {
  if (!logs || logs.length === 0) return '<p style="color:var(--text-muted);font-size:0.85rem;">No timeline entries yet.</p>';
  const actionLabels = {
    created:           'Brief created by',
    claimed:           'Claimed by',
    assigned:          'Assigned by',
    submitted:         'Submitted for review by',
    lead_approved:     'Approved by Lead Editor — awaiting Social Media review —',
    sent_back_by_lead: 'Sent back by Lead Editor —',
    sm_approved:       'Approved by Social Media — pipeline complete —',
    sent_back_by_sm:   'Correction requested by Social Media —',
  };
  const items = logs.map(log => {
    const label = actionLabels[log.action] || log.action;
    const actorName = log.actor?.name || 'Unknown';
    const date = new Date(log.createdAt);
    const formatted = date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
      + ', ' + date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    return `
      <li>
        <div class="tl-action">${label} ${actorName}</div>
        ${log.note ? `<div class="tl-note">${escapeHtml(log.note)}</div>` : ''}
        <div class="tl-time">${formatted}</div>
      </li>`;
  }).join('');
  return `<ul class="vbv-timeline">${items}</ul>`;
}

function escapeHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// Jobs have no deadline until they're assigned to an editor
function vbvFormatDeadline(deadline) {
  if (!deadline) return '—';
  return new Date(deadline).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}
