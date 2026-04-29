// ── App state ──────────────────────────────────────────────────────────────
let currentPage = 'overview';
let currentPeriod = 'all';
let isMobileNavOpen = false;

// Track which pages have been loaded for which period
const loadedState = {};

// ── Navigation ─────────────────────────────────────────────────────────────
function navigateTo(page) {
  if (currentPage === page) return;

  // Update sidebar active state
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.page === page);
  });

  // Show/hide pages
  document.querySelectorAll('.page').forEach(el => {
    el.classList.toggle('active', el.id === `page-${page}`);
  });

  // Update topbar title
  const titles = {
    overview: { title: 'Overview',      sub: 'All platforms at a glance' },
    instagram: { title: 'Instagram',    sub: 'Reels · Posts · Stories · Audience' },
    tiktok:    { title: 'TikTok',       sub: 'Videos · Engagement · Reach' },
    youtube:   { title: 'YouTube',      sub: 'Channel · Videos · Watch time' },
    posts:       { title: 'All Posts',       sub: 'Every post with full analytics' },
    compare:     { title: 'Compare Posts',   sub: 'Select posts to compare side by side' },
    fingerprint: { title: 'Repost Detector',  sub: 'Visual fingerprint similarity — detect reposts before you publish' },
    leads:       { title: 'Lead Generation',  sub: 'Screenshot Instagram posts to extract and manage event leads' },
  };
  const t = titles[page] || { title: page, sub: '' };
  document.getElementById('topbar-title').textContent = t.title;
  document.getElementById('topbar-sub').textContent = t.sub;

  currentPage = page;

  // Lazy-load page data
  loadCurrentPage();

  // Close mobile nav
  if (isMobileNavOpen) toggleMobileNav();
}

function loadCurrentPage(force = false) {
  // Compare page always re-renders since selection changes externally
  if (currentPage === 'compare') { renderComparePage(); return; }

  const key = `${currentPage}:${currentPeriod}`;
  if (!force && loadedState[key]) return;
  loadedState[key] = true;

  switch (currentPage) {
    case 'overview':  loadOverview(currentPeriod);  break;
    case 'instagram': loadInstagram(currentPeriod); break;
    case 'tiktok':    loadTikTok(currentPeriod);    break;
    case 'youtube':   loadYouTube(currentPeriod);   break;
    case 'posts':        loadPosts();            break;
    case 'fingerprint':  loadFingerprint();      break;
    case 'leads':        loadLeads();            break;
  }
}

function setPeriod(period) {
  if (currentPeriod === period) return;
  currentPeriod = period;

  document.querySelectorAll('.period-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.period === period);
  });

  // Clear loaded state for current page to force reload
  delete loadedState[`${currentPage}:${period}`];
  loadCurrentPage();
}

function refreshCurrentPage() {
  const key = `${currentPage}:${currentPeriod}`;
  delete loadedState[key];

  const btn = document.getElementById('refresh-btn');
  btn.classList.add('spinning');
  loadCurrentPage();
  setTimeout(() => btn.classList.remove('spinning'), 1000);
}

function toggleMobileNav() {
  isMobileNavOpen = !isMobileNavOpen;
  document.querySelector('.sidebar').classList.toggle('open', isMobileNavOpen);
}

// ── Boot ───────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Nav clicks
  document.querySelectorAll('.nav-item').forEach(el => {
    el.addEventListener('click', () => navigateTo(el.dataset.page));
  });

  // Period buttons
  document.querySelectorAll('.period-btn').forEach(btn => {
    btn.addEventListener('click', () => setPeriod(btn.dataset.period));
  });

  // Refresh button
  document.getElementById('refresh-btn')?.addEventListener('click', refreshCurrentPage);

  // Hamburger (mobile)
  document.getElementById('hamburger')?.addEventListener('click', toggleMobileNav);

  // Close sidebar when clicking outside on mobile
  document.addEventListener('click', (e) => {
    if (
      isMobileNavOpen &&
      !e.target.closest('.sidebar') &&
      !e.target.closest('#hamburger')
    ) {
      toggleMobileNav();
    }
  });

  // Load first page
  navigateTo('overview');

  // Check health / demo status
  fetch('/api/health')
    .then(r => r.json())
    .then(data => {
      const anyLive = Object.values(data.platforms || {}).some(Boolean);
      if (!anyLive) {
        document.querySelector('.sidebar-footer').innerHTML = `
          <div class="demo-dot"></div>
          <span>Running in demo mode — no credentials configured</span>`;
      } else {
        document.querySelector('.sidebar-footer').innerHTML = `
          <div class="demo-dot" style="background:var(--success)"></div>
          <span>Live data connected</span>`;
      }
    })
    .catch(() => {});
});
