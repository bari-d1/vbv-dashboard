function vbvStatusBadge(status) {
  const labels = {
    open:              'Open',
    in_progress:       'In Progress',
    submitted:         'Submitted',
    sent_back_by_lead: 'Sent Back',
    lead_approved:     'With Social Media',
    sent_back_by_sm:   'Correction Requested',
    sm_approved:       'Approved',
    timestamp_clip:    'Timestamp Clip',
    full_edit:         'Full Edit',
    // roles
    social_media:      'Social Media',
    editor:            'Editor',
    lead_editor:       'Lead Editor',
    admin:             'Admin',
  };
  return `<span class="vbv-badge vbv-badge-${status}">${labels[status] || status}</span>`;
}
