// ── API helper ────────────────────────────────────────────────────────────
async function vbvApi(method, path, body) {
  const token = localStorage.getItem('vbv_token');
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(path, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

function vbvCurrentUser() {
  try { return JSON.parse(localStorage.getItem('vbv_user') || 'null'); } catch { return null; }
}

function vbvLogout() {
  localStorage.removeItem('vbv_token');
  localStorage.removeItem('vbv_user');
  vbvInit();
}

// ── Router ────────────────────────────────────────────────────────────────
const DEFAULT_VIEW = {
  admin:        'admin-panel',
  social_media: 'social-dashboard',
  editor:       'job-pool',
  lead_editor:  'lead-editor-dashboard',
};

async function vbvNavigate(view) {
  const app = document.getElementById('vbv-app');
  const user = vbvCurrentUser();
  if (!user) { vbvShowLogin(); return; }

  // Build shell with sidebar + main content area
  app.innerHTML = vbvRenderSidebar(user, view) + '<main class="vbv-main" id="vbv-main"><div class="vbv-loading">Loading…</div></main>';
  vbvSidebarBindEvents();

  const main = document.getElementById('vbv-main');
  let html = '';
  try {
    switch (view) {
      case 'admin-panel':
      case 'activity-log':
        html = await vbvRenderAdminPanel(view); break;
      case 'social-dashboard':
        html = await vbvRenderSocialDashboard(); break;
      case 'my-briefs':
        html = await vbvRenderMyBriefs(); break;
      case 'for-review':
        html = await vbvRenderForReview(); break;
      case 'job-pool':
        html = await vbvRenderJobPool(); break;
      case 'editor-dashboard':
        html = await vbvRenderEditorDashboard(); break;
      case 'lead-editor-dashboard':
        html = await vbvRenderLeadEditorDashboard(); break;
      default:
        html = '<div class="vbv-empty">View not found.</div>';
    }
  } catch(e) {
    html = `<div class="vbv-alert vbv-alert-error">Failed to load view: ${e.message}</div>`;
  }

  main.innerHTML = html;

  // Bind events for the rendered view
  switch (view) {
    case 'admin-panel':    vbvBindAdminPanel(); break;
    case 'activity-log':   vbvBindActivityLog(); break;
    case 'social-dashboard': vbvBindSocialDashboard(); break;
    case 'my-briefs': break;
    case 'for-review': vbvBindForReview(); break;
    case 'job-pool':       vbvBindJobPool(); break;
    case 'editor-dashboard': vbvBindEditorDashboard(); break;
    case 'lead-editor-dashboard': vbvBindLeadEditorDashboard(); break;
  }
}

function vbvShowLogin() {
  document.getElementById('vbv-app').innerHTML = vbvRenderLogin();
  vbvBindLogin();
}

function vbvInit() {
  const user = vbvCurrentUser();
  if (!user) { vbvShowLogin(); return; }
  vbvNavigate(DEFAULT_VIEW[user.role] || 'job-pool');
}

// Bootstrap
vbvInit();
