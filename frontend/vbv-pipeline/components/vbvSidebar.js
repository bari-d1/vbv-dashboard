function vbvRenderSidebar(user, activeView) {
  const navItems = {
    admin: [
      { view: 'admin-panel', label: 'User Management' },
      { view: 'activity-log', label: 'Activity Log' },
      { view: 'all-jobs', label: 'All Jobs' },
      { view: 'social-dashboard', label: 'Create Brief' },
      { view: 'my-briefs', label: 'My Briefs' },
      { view: 'for-review', label: 'For Review' },
      { view: 'lead-editor-dashboard', label: 'Assign & Review' },
      { view: 'monitor', label: 'Monitor' },
      { view: 'sermon-pipeline', label: 'Clipping Tool' },
      { view: 'outreach', label: 'Outreach' },
      { view: 'templates', label: 'Templates' },
      { view: 'clients', label: 'Clients' },
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
      { view: 'monitor', label: 'Monitor' },
    ],
    vedits: [
      { view: 'vedits-create-brief', label: 'Create Brief' },
      { view: 'vedits-jobs', label: 'All Vedits Jobs' },
      { view: 'for-review', label: 'Review Queue' },
      { view: 'sermon-pipeline', label: 'Clipping Tool' },
      { view: 'outreach', label: 'Outreach' },
      { view: 'templates', label: 'Templates' },
      { view: 'clients', label: 'Clients' },
    ],
  };
  const items = navItems[user.role] || [];

  // Append Clipping Tool for non-admin users who have been explicitly granted access
  if (user.role !== 'admin' && user.sermonPipelineAccess) {
    items.push({ view: 'sermon-pipeline', label: 'Clipping Tool' });
  }

  const links = items.map(item => {
    const isActive = activeView === item.view || activeView.startsWith(`${item.view}-`);
    return `<a href="#" class="${isActive ? 'active' : ''}" data-view="${item.view}"><span>${item.label}</span></a>`;
  }).join('');

  return `
    <aside class="vbv-sidebar">
      <button class="vbv-sidebar-close" id="vbv-sidebar-close" aria-label="Close menu">&times;</button>
      <div class="vbv-logo"><img src="/assets/verse-by-verse-logo-red.png" alt="Verse by Verse" class="vbv-logo-img"> <span>Pipeline</span></div>
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
  const sidebar = document.querySelector('.vbv-sidebar');
  const overlay = document.getElementById('vbv-sidebar-overlay');

  function openSidebar() {
    sidebar?.classList.add('vbv-sidebar-open');
    overlay?.classList.add('vbv-overlay-open');
  }
  function closeSidebar() {
    sidebar?.classList.remove('vbv-sidebar-open');
    overlay?.classList.remove('vbv-overlay-open');
  }

  document.querySelectorAll('.vbv-sidebar nav a').forEach(a => {
    a.addEventListener('click', e => {
      e.preventDefault();
      closeSidebar();
      vbvNavigate(a.dataset.view);
    });
  });

  const logoutBtn = document.getElementById('vbv-logout-btn');
  if (logoutBtn) logoutBtn.addEventListener('click', () => { closeSidebar(); vbvLogout(); });

  const hamburger = document.getElementById('vbv-hamburger');
  const closeBtn  = document.getElementById('vbv-sidebar-close');
  if (hamburger) hamburger.addEventListener('click', openSidebar);
  if (closeBtn)  closeBtn.addEventListener('click', closeSidebar);
  if (overlay)   overlay.addEventListener('click', closeSidebar);
}
