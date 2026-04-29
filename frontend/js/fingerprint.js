// ── Repost Detector ──────────────────────────────────────────────────────────

let fpLibrary = [];

async function loadFingerprint() {
  const container = document.getElementById('fingerprint-content');
  container.innerHTML = renderFingerprintShell();
  await refreshLibrary();
  bindFingerprintEvents();
}

function renderFingerprintShell() {
  return `
    <div class="fp-layout">

      <!-- Left: Upload panels -->
      <div class="fp-left">

        <!-- Compare panel -->
        <div class="chart-card mb-16">
          <div class="chart-title">Check a video for similarity</div>
          <p class="fp-desc">Upload a video to compare it against every video in your library. Results are ranked by similarity.</p>
          <div class="fp-drop-zone" id="fp-compare-drop">
            <div class="fp-drop-icon">▶</div>
            <div class="fp-drop-label">Drop video here or <label class="fp-file-link" for="fp-compare-input">browse</label></div>
            <div class="fp-drop-sub">MP4, MOV, MKV, WebM · max 500 MB</div>
            <input type="file" id="fp-compare-input" accept=".mp4,.mov,.avi,.mkv,.webm,.m4v" style="display:none">
          </div>
          <div id="fp-compare-status"></div>
          <button class="fp-btn fp-btn-primary" id="fp-compare-btn" disabled>Compare</button>
        </div>

        <!-- Register panel -->
        <div class="chart-card">
          <div class="chart-title">Add video to library</div>
          <p class="fp-desc">Register a video so future uploads can be compared against it. Fingerprints are computed once and cached.</p>
          <div class="fp-drop-zone" id="fp-register-drop">
            <div class="fp-drop-icon">+</div>
            <div class="fp-drop-label">Drop video here or <label class="fp-file-link" for="fp-register-input">browse</label></div>
            <div class="fp-drop-sub">MP4, MOV, MKV, WebM · max 500 MB</div>
            <input type="file" id="fp-register-input" accept=".mp4,.mov,.avi,.mkv,.webm,.m4v" style="display:none">
          </div>
          <div id="fp-register-status"></div>
          <button class="fp-btn fp-btn-secondary" id="fp-register-btn" disabled>Register</button>
        </div>

      </div>

      <!-- Right: Results + library -->
      <div class="fp-right">

        <!-- Results -->
        <div class="chart-card mb-16" id="fp-results-card" style="display:none">
          <div class="chart-title-row">
            <div>Similarity results <span class="chart-title-note" id="fp-results-meta"></span></div>
            <button class="fp-clear-btn" id="fp-clear-btn" onclick="clearComparison()">New comparison</button>
          </div>
          <div id="fp-results-body"></div>
        </div>

        <!-- Library -->
        <div class="chart-card">
          <div class="chart-title">Video library <span class="chart-title-note" id="fp-lib-count"></span></div>
          <div id="fp-library-body"><div class="fp-empty">No videos registered yet.</div></div>
        </div>

      </div>
    </div>

    <!-- Risk legend -->
    <div class="fp-legend mb-26">
      <span class="fp-risk fp-risk-green">● &lt;40% — Low risk</span>
      <span class="fp-risk fp-risk-amber">● 40–69% — Caution</span>
      <span class="fp-risk fp-risk-red">● ≥70% — High risk (Instagram repost threshold)</span>
    </div>
  `;
}

function bindFingerprintEvents() {
  bindDropZone('fp-compare-drop', 'fp-compare-input', 'fp-compare-status', 'fp-compare-btn');
  bindDropZone('fp-register-drop', 'fp-register-input', 'fp-register-status', 'fp-register-btn');

  document.getElementById('fp-compare-btn').addEventListener('click', runCompare);
  document.getElementById('fp-register-btn').addEventListener('click', runRegister);
}

function bindDropZone(dropId, inputId, statusId, btnId) {
  const drop = document.getElementById(dropId);
  const input = document.getElementById(inputId);
  const btn = document.getElementById(btnId);

  input.addEventListener('change', () => {
    if (input.files[0]) selectFile(input.files[0], drop, statusId, btnId);
  });

  drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('fp-drop-active'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('fp-drop-active'));
  drop.addEventListener('drop', e => {
    e.preventDefault();
    drop.classList.remove('fp-drop-active');
    const file = e.dataTransfer.files[0];
    if (file) selectFile(file, drop, statusId, btnId);
  });
}

function selectFile(file, drop, statusId, btnId) {
  const label = drop.querySelector('.fp-drop-label');
  label.textContent = file.name;
  drop.dataset.file = file.name;
  drop._file = file;
  document.getElementById(statusId).textContent = '';
  document.getElementById(btnId).disabled = false;
}

async function runCompare() {
  const drop = document.getElementById('fp-compare-drop');
  const file = drop._file;
  if (!file) return;

  const btn = document.getElementById('fp-compare-btn');
  const status = document.getElementById('fp-compare-status');
  btn.disabled = true;
  btn.textContent = 'Analysing…';
  status.innerHTML = '<span class="fp-processing">Processing frames and audio fingerprint — this may take a moment…</span>';

  const form = new FormData();
  form.append('video', file);

  try {
    const res = await fetch('/api/fingerprint/compare', { method: 'POST', body: form });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || data.error);

    status.textContent = '';
    renderResults(data.results, file.name, data.comparedAt);
  } catch (err) {
    status.innerHTML = `<span class="fp-error">Error: ${err.message}</span>`;
  } finally {
    btn.disabled = false;
    btn.textContent = 'Compare';
  }
}

async function runRegister() {
  const drop = document.getElementById('fp-register-drop');
  const file = drop._file;
  if (!file) return;

  const btn = document.getElementById('fp-register-btn');
  const status = document.getElementById('fp-register-status');
  btn.disabled = true;
  btn.textContent = 'Registering…';
  status.innerHTML = '<span class="fp-processing">Computing fingerprint — this may take a moment…</span>';

  const form = new FormData();
  form.append('video', file);

  try {
    const res = await fetch('/api/fingerprint/register', { method: 'POST', body: form });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || data.error);

    status.innerHTML = `<span class="fp-success">✓ Registered "${data.filename}" — ${data.frameCount} frames, ${fmtDuration(data.duration)}</span>`;
    const label = drop.querySelector('.fp-drop-label');
    label.innerHTML = `Drop video here or <label class="fp-file-link" for="fp-register-input">browse</label>`;
    drop._file = null;
    btn.disabled = true;
    btn.textContent = 'Register';
    await refreshLibrary();
  } catch (err) {
    status.innerHTML = `<span class="fp-error">Error: ${err.message}</span>`;
    btn.disabled = false;
    btn.textContent = 'Register';
  }
}

function renderResults(results, uploadedName, comparedAt) {
  const card = document.getElementById('fp-results-card');
  const meta = document.getElementById('fp-results-meta');
  const body = document.getElementById('fp-results-body');

  card.style.display = '';

  if (!results.length) {
    meta.textContent = '';
    body.innerHTML = '<div class="fp-empty">No videos in library to compare against. Register some videos first.</div>';
    return;
  }

  const highest = results[0].combinedScore;
  meta.textContent = `· "${uploadedName}" · ${results.length} comparison${results.length !== 1 ? 's' : ''} · highest match: ${highest}%`;

  body.innerHTML = `
    <table class="fp-table">
      <thead>
        <tr>
          <th>Library video</th>
          <th>Visual</th>
          <th>Audio</th>
          <th>Combined</th>
          <th>Risk</th>
        </tr>
      </thead>
      <tbody>
        ${results.map(r => {
          const risk = riskLevel(r.combinedScore);
          return `<tr>
            <td class="fp-filename">
              <div>${r.filename}</div>
              <div class="fp-file-meta">${fmtDuration(r.duration)} · added ${fmtDate(r.registeredAt)}</div>
            </td>
            <td>${r.visualScore}%</td>
            <td>${r.audioScore}%</td>
            <td><strong>${r.combinedScore}%</strong></td>
            <td><span class="fp-risk-badge fp-risk-badge-${risk.cls}">${risk.label}</span></td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
  `;

  card.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function clearComparison() {
  // Hide results
  const card = document.getElementById('fp-results-card');
  if (card) card.style.display = 'none';

  // Reset drop zone
  const drop = document.getElementById('fp-compare-drop');
  if (drop) {
    drop._file = null;
    const label = drop.querySelector('.fp-drop-label');
    if (label) label.innerHTML = `Drop video here or <label class="fp-file-link" for="fp-compare-input">browse</label>`;
  }

  // Reset input so the same file can be re-selected
  const input = document.getElementById('fp-compare-input');
  if (input) input.value = '';

  // Reset status and button
  const status = document.getElementById('fp-compare-status');
  if (status) status.textContent = '';
  const btn = document.getElementById('fp-compare-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Compare'; }
}

async function refreshLibrary() {
  try {
    const res = await fetch('/api/fingerprint/library');
    fpLibrary = await res.json();
  } catch {
    fpLibrary = [];
  }
  renderLibrary();
}

function renderLibrary() {
  const body = document.getElementById('fp-library-body');
  const count = document.getElementById('fp-lib-count');
  if (!body) return;

  count.textContent = fpLibrary.length ? `· ${fpLibrary.length} video${fpLibrary.length !== 1 ? 's' : ''}` : '';

  if (!fpLibrary.length) {
    body.innerHTML = '<div class="fp-empty">No videos registered yet.</div>';
    return;
  }

  body.innerHTML = `
    <table class="fp-table">
      <thead>
        <tr><th>Filename</th><th>Duration</th><th>Frames</th><th>Registered</th><th></th></tr>
      </thead>
      <tbody>
        ${fpLibrary.map(v => `
          <tr>
            <td class="fp-filename">${v.filename}</td>
            <td>${fmtDuration(v.duration)}</td>
            <td>${v.frameCount}</td>
            <td>${fmtDate(v.registeredAt)}</td>
            <td><button class="fp-delete-btn" data-filename="${encodeURIComponent(v.filename)}">Remove</button></td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;

  body.querySelectorAll('.fp-delete-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm(`Remove "${decodeURIComponent(btn.dataset.filename)}" from library?`)) return;
      btn.disabled = true;
      try {
        await fetch(`/api/fingerprint/library/${btn.dataset.filename}`, { method: 'DELETE' });
        await refreshLibrary();
      } catch {
        btn.disabled = false;
      }
    });
  });
}

function riskLevel(score) {
  if (score >= 70) return { cls: 'red',   label: 'High risk' };
  if (score >= 40) return { cls: 'amber', label: 'Caution' };
  return                  { cls: 'green', label: 'Low risk' };
}

function fmtDuration(secs) {
  if (!secs) return '—';
  const m = Math.floor(secs / 60);
  const s = Math.round(secs % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}
