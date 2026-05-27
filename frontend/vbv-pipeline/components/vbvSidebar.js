function vbvRenderSidebar(user, activeView) {
  const navItems = {
    admin: [
      { view: 'admin-panel', label: 'User Management' },
      { view: 'activity-log', label: 'Activity Log' },
      { view: 'social-dashboard', label: 'Create Brief' },
      { view: 'my-briefs', label: 'My Briefs' },
      { view: 'for-review', label: 'For Review' },
      { view: 'lead-editor-dashboard', label: 'Assign & Review' },
    ],
    social_media: [
      { view: 'social-dashboard', label: 'Create Brief' },
      { view: 'my-briefs', label: 'My Briefs' },
      { view: 'for-review', label: 'For Review' },
    ],
    editor: [
      { view: 'job-pool', label: 'Job Pool' },
      { view: 'editor-dashboard', label: 'My Jobs' },
    ],
    lead_editor: [
      { view: 'social-dashboard', label: 'Create Brief' },
      { view: 'my-briefs', label: 'My Briefs' },
      { view: 'job-pool', label: 'Job Pool' },
      { view: 'editor-dashboard', label: 'My Jobs' },
      { view: 'lead-editor-dashboard', label: 'Review Queue' },
    ],
  };
  const items = navItems[user.role] || [];
  const links = items.map(item =>
    `<a href="#" class="${activeView === item.view ? 'active' : ''}" data-view="${item.view}"><span>${item.label}</span></a>`
  ).join('');

  return `
    <aside class="vbv-sidebar">
      <div class="vbv-logo">VBV <span>Pipeline</span></div>
      <nav>${links}</nav>
      <div class="vbv-user-info">
        <strong>${escapeHtml(user.name)}</strong>
        ${user.role.replace('_', ' ')}
        <br>
        <button class="vbv-logout" id="vbv-logout-btn">Log out</button>
      </div>
    </aside>`;
}

function vbvSidebarBindEvents() {
  document.querySelectorAll('.vbv-sidebar nav a').forEach(a => {
    a.addEventListener('click', e => {
      e.preventDefault();
      vbvNavigate(a.dataset.view);
    });
  });
  const logoutBtn = document.getElementById('vbv-logout-btn');
  if (logoutBtn) logoutBtn.addEventListener('click', () => vbvLogout());
}
