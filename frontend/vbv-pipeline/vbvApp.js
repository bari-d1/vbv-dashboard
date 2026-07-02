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
  if (res.status === 401) { vbvLogout(); return; }
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
  vedits:       'vedits-jobs',
};

async function vbvNavigate(view) {
  const app = document.getElementById('vbv-app');
  const user = vbvCurrentUser();
  if (!user) { vbvShowLogin(); return; }

  // Build shell with mobile header, sidebar drawer, overlay, and main content
  app.innerHTML =
    `<div class="vbv-mobile-header">
      <button class="vbv-hamburger" id="vbv-hamburger" aria-label="Open menu">
        <span></span><span></span><span></span>
      </button>
      <span class="vbv-mobile-title">VBV <em>Pipeline</em></span>
    </div>
    <div class="vbv-sidebar-overlay" id="vbv-sidebar-overlay"></div>` +
    vbvRenderSidebar(user, view) +
    '<main class="vbv-main" id="vbv-main"><div class="vbv-loading">Loading…</div></main>';
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
      case 'all-jobs':
        html = await vbvRenderAllJobs(); break;
      case 'vedits-create-brief':
        html = await vbvRenderVeditsBrief(); break;
      case 'vedits-jobs':
        html = await vbvRenderVeditsJobs(); break;
      case 'lead-editor-dashboard':
        html = await vbvRenderLeadEditorDashboard(); break;
      case 'monitor':
        html = await vbvRenderMonitor(); break;
      case 'sermon-pipeline':
        html = vbvRenderSermonPipeline(); break;
      case 'generate-srt':
        html = vbvRenderGenerateSRT(); break;
      case 'outreach':
        html = await vbvRenderOutreachLeads(); break;
      case 'outreach-lead-detail':
        html = await vbvRenderOutreachLeadDetail(); break;
      case 'templates':
        html = await vbvRenderTemplatesList(); break;
      case 'template-edit':
        html = await vbvRenderTemplateEdit(); break;
      case 'clients':
        html = await vbvRenderClientsList(); break;
      case 'client-detail':
        html = await vbvRenderClientDetail(); break;
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
    case 'all-jobs':              vbvBindAllJobs(); break;
    case 'vedits-create-brief':   vbvBindVeditsBrief(); break;
    case 'vedits-jobs':           vbvBindVeditsJobs(); break;
    case 'lead-editor-dashboard': vbvBindLeadEditorDashboard(); break;
    case 'monitor': vbvBindMonitor(); break;
    case 'sermon-pipeline': vbvBindSermonPipeline(); break;
    case 'generate-srt': vbvBindGenerateSRT(); break;
    case 'outreach': vbvBindOutreachLeads(); break;
    case 'outreach-lead-detail': vbvBindOutreachLeadDetail(); break;
    case 'templates': vbvBindTemplatesList(); break;
    case 'template-edit': vbvBindTemplateEdit(); break;
    case 'clients': vbvBindClientsList(); break;
    case 'client-detail': vbvBindClientDetail(); break;
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
