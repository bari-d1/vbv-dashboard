// ── Lead Generation ──────────────────────────────────────────────────────────

let leadsData = [];
let leadsMonitoring = false;
let leadsPollingInterval = null;
let leadsLastImageHash = null;
let leadsSortField = 'dateAdded';
let leadsSortOrder = 'desc';
let leadsExtracting = false;

async function loadLeads() {
  const container = document.getElementById('leads-content');
  container.innerHTML = renderLeadsShell();
  await fetchLeads();
  bindLeadsEvents();
}

function renderLeadsShell() {
  return `
    <!-- Monitor bar -->
    <div class="ld-monitor-bar chart-card mb-16">
      <div class="ld-monitor-left">
        <button class="ld-monitor-btn" id="ld-monitor-btn" onclick="toggleLeadsMonitoring()">
          Monitor
        </button>
        <span class="ld-monitor-hint" id="ld-monitor-hint">
          Take a screenshot of an Instagram post — the tool will detect it automatically and extract lead data.
        </span>
      </div>
      <div class="ld-monitor-right" id="ld-extract-status"></div>
    </div>

    <!-- Table card -->
    <div class="chart-card">
      <div class="ld-table-header">
        <div class="chart-title" style="margin-bottom:0">Leads <span class="chart-title-note" id="ld-lead-count"></span></div>
        <div class="ld-sort-controls">
          Sort by:
          <button class="ld-sort-btn ${leadsSortField === 'dateAdded' ? 'active' : ''}" data-field="dateAdded">Date</button>
          <button class="ld-sort-btn ${leadsSortField === 'status' ? 'active' : ''}" data-field="status">Status</button>
          <button class="ld-order-btn" id="ld-order-btn">${leadsSortOrder === 'desc' ? '↓' : '↑'}</button>
        </div>
      </div>
      <div id="ld-table-wrap" class="ld-table-wrap">
        <div class="fp-empty">Loading…</div>
      </div>
    </div>
  `;
}

function bindLeadsEvents() {
  document.querySelectorAll('.ld-sort-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      leadsSortField = btn.dataset.field;
      document.querySelectorAll('.ld-sort-btn').forEach(b => b.classList.toggle('active', b.dataset.field === leadsSortField));
      fetchLeads();
    });
  });
  document.getElementById('ld-order-btn').addEventListener('click', () => {
    leadsSortOrder = leadsSortOrder === 'desc' ? 'asc' : 'desc';
    document.getElementById('ld-order-btn').textContent = leadsSortOrder === 'desc' ? '↓' : '↑';
    fetchLeads();
  });
}

// ── Monitoring ────────────────────────────────────────────────────────────────

function toggleLeadsMonitoring() {
  if (leadsMonitoring) {
    stopLeadsMonitoring();
  } else {
    startLeadsMonitoring();
  }
}

function startLeadsMonitoring() {
  if (!navigator.clipboard || !navigator.clipboard.read) {
    setLeadsStatus('error', 'Clipboard API not supported in this browser. Try Chrome or Edge.');
    return;
  }

  leadsMonitoring = true;
  const btn = document.getElementById('ld-monitor-btn');
  btn.classList.add('active');
  btn.textContent = 'Stop Monitoring';

  const hint = document.getElementById('ld-monitor-hint');
  hint.innerHTML = '<span class="ld-pulse"></span> Monitoring active — allow clipboard access when prompted, then take a screenshot of any Instagram post.';

  leadsPollingInterval = setInterval(pollLeadsClipboard, 1500);
}

function stopLeadsMonitoring() {
  leadsMonitoring = false;
  clearInterval(leadsPollingInterval);
  leadsPollingInterval = null;

  const btn = document.getElementById('ld-monitor-btn');
  btn.classList.remove('active');
  btn.textContent = 'Monitor';

  const hint = document.getElementById('ld-monitor-hint');
  hint.textContent = 'Take a screenshot of an Instagram post — the tool will detect it automatically and extract lead data.';

  if (!leadsExtracting) setLeadsStatus('', '');
}

async function pollLeadsClipboard() {
  if (leadsExtracting) return;
  try {
    const items = await navigator.clipboard.read();
    for (const item of items) {
      const imageType = item.types.find(t => t.startsWith('image/'));
      if (!imageType) continue;

      const blob = await item.getType(imageType);
      const base64 = await blobToBase64(blob);
      const hash = base64.slice(0, 120) + base64.length;

      if (hash === leadsLastImageHash) break;
      leadsLastImageHash = hash;

      await extractLeadFromImage(base64, imageType);
      break;
    }
  } catch {
    // Permission denied or clipboard empty — silent
  }
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// ── Extraction ────────────────────────────────────────────────────────────────

async function extractLeadFromImage(base64DataUrl, mediaType) {
  leadsExtracting = true;
  setLeadsStatus('loading', 'Extracting lead data…');

  try {
    const res = await fetch('/api/leads/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageData: base64DataUrl, mediaType }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || data.error);

    const e = data.extracted;
    // Check if all extractable fields are null
    const allNull = ['display_name', 'instagram_handle', 'event_name', 'event_date',
      'event_location', 'contact_email', 'contact_phone'].every(k => e[k] == null)
      && (!e.collaborators || e.collaborators.length === 0);

    if (allNull) {
      setLeadsStatus('error', 'This image does not appear to contain Instagram post data. Try another screenshot.');
      return;
    }

    await saveLead(e);
    setLeadsStatus('success', `Lead extracted: ${e.display_name || e.instagram_handle || 'Unknown'}`);
    setTimeout(() => { if (!leadsExtracting) setLeadsStatus('', ''); }, 4000);
  } catch (err) {
    setLeadsStatus('error', `Extraction failed: ${err.message}`);
  } finally {
    leadsExtracting = false;
  }
}

// ── CRUD ──────────────────────────────────────────────────────────────────────

async function saveLead(extracted) {
  const res = await fetch('/api/leads', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      displayName:     extracted.display_name,
      instagramHandle: extracted.instagram_handle,
      eventName:       extracted.event_name,
      eventDate:       extracted.event_date,
      eventLocation:   extracted.event_location,
      contactEmail:    extracted.contact_email,
      contactPhone:    extracted.contact_phone,
      collaborators:   extracted.collaborators || [],
    }),
  });
  if (!res.ok) throw new Error('Failed to save lead');
  const lead = await res.json();
  leadsData.unshift(lead);
  renderLeadsTable();
}

async function fetchLeads() {
  try {
    const res = await fetch(`/api/leads?sort=${leadsSortField}&order=${leadsSortOrder}`);
    leadsData = await res.json();
  } catch {
    leadsData = [];
  }
  renderLeadsTable();
}

async function updateLeadField(id, field, value) {
  await fetch(`/api/leads/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ [field]: value }),
  });
  const lead = leadsData.find(l => l.id === id);
  if (lead) lead[field] = value;
}

async function deleteLead(id, rowEl) {
  if (!confirm('Delete this lead?')) return;
  rowEl.style.opacity = '0.4';
  await fetch(`/api/leads/${id}`, { method: 'DELETE' });
  leadsData = leadsData.filter(l => l.id !== id);
  renderLeadsTable();
}

// ── Table rendering ───────────────────────────────────────────────────────────

const STATUS_OPTIONS = ['Not Contacted', 'Contacted', 'Follow Up', 'Yes', 'No'];
const STATUS_CLS = {
  'Not Contacted': 'ld-status-default',
  'Contacted':     'ld-status-blue',
  'Follow Up':     'ld-status-amber',
  'Yes':           'ld-status-green',
  'No':            'ld-status-red',
};

function renderLeadsTable() {
  const wrap = document.getElementById('ld-table-wrap');
  const countEl = document.getElementById('ld-lead-count');
  if (!wrap) return;

  if (countEl) countEl.textContent = leadsData.length ? `· ${leadsData.length} lead${leadsData.length !== 1 ? 's' : ''}` : '';

  if (!leadsData.length) {
    wrap.innerHTML = '<div class="fp-empty">No leads yet. Start monitoring and take a screenshot of an Instagram post.</div>';
    return;
  }

  wrap.innerHTML = `
    <table class="ld-table">
      <thead>
        <tr>
          <th>Display Name</th>
          <th>Instagram Handle</th>
          <th>Event Name</th>
          <th>Event Date</th>
          <th>Event Location</th>
          <th>Contact Email</th>
          <th>Contact Phone</th>
          <th>Collaborators</th>
          <th>Status</th>
          <th>Notes</th>
          <th>Date Added</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        ${leadsData.map(lead => renderLeadRow(lead)).join('')}
      </tbody>
    </table>
  `;

  // Bind status dropdowns
  wrap.querySelectorAll('.ld-status-select').forEach(sel => {
    sel.addEventListener('change', () => {
      const id = parseInt(sel.dataset.id);
      updateLeadField(id, 'status', sel.value);
      sel.className = `ld-status-select ${STATUS_CLS[sel.value] || ''}`;
    });
  });

  // Bind notes inputs (save on blur)
  wrap.querySelectorAll('.ld-notes-input').forEach(input => {
    input.addEventListener('blur', () => {
      updateLeadField(parseInt(input.dataset.id), 'notes', input.value);
    });
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') input.blur();
    });
  });

  // Bind delete buttons
  wrap.querySelectorAll('.ld-delete-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const row = btn.closest('tr');
      deleteLead(parseInt(btn.dataset.id), row);
    });
  });
}

function renderLeadRow(lead) {
  const collab = Array.isArray(lead.collaborators) ? lead.collaborators.join(', ') : '';
  const dateAdded = lead.dateAdded ? new Date(lead.dateAdded).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
  const statusCls = STATUS_CLS[lead.status] || 'ld-status-default';

  return `<tr data-id="${lead.id}">
    <td class="ld-cell-name">${lead.displayName || '—'}</td>
    <td class="ld-cell-handle">${lead.instagramHandle || '—'}</td>
    <td>${lead.eventName || '—'}</td>
    <td>${lead.eventDate || '—'}</td>
    <td>${lead.eventLocation || '—'}</td>
    <td>${lead.contactEmail || '—'}</td>
    <td>${lead.contactPhone || '—'}</td>
    <td class="ld-cell-collab">${collab || '—'}</td>
    <td>
      <select class="ld-status-select ${statusCls}" data-id="${lead.id}">
        ${STATUS_OPTIONS.map(opt => `<option value="${opt}" ${lead.status === opt ? 'selected' : ''}>${opt}</option>`).join('')}
      </select>
    </td>
    <td>
      <input class="ld-notes-input" type="text" data-id="${lead.id}"
        value="${(lead.notes || '').replace(/"/g, '&quot;')}"
        placeholder="Add notes…">
    </td>
    <td class="ld-cell-date">${dateAdded}</td>
    <td>
      <button class="ld-delete-btn" data-id="${lead.id}" title="Delete lead">✕</button>
    </td>
  </tr>`;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function setLeadsStatus(type, message) {
  const el = document.getElementById('ld-extract-status');
  if (!el) return;
  if (!type || !message) { el.innerHTML = ''; return; }
  const cls = type === 'loading' ? 'ld-status-loading' : type === 'success' ? 'ld-status-ok' : 'ld-status-err';
  const icon = type === 'loading' ? '<span class="ld-spinner"></span>' : type === 'success' ? '✓' : '✕';
  el.innerHTML = `<span class="${cls}">${icon} ${message}</span>`;
}
