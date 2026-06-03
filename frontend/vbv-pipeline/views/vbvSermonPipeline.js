// ── Sermon Pipeline — Async Job Status UI ─────────────────────────────────

const SERMON_JOB_KEY = 'vbv_pipeline_jobId';

let _sermonPollInterval    = null;
let _sermonCountdownTimer  = null;

// ── Icons (inline SVG) ────────────────────────────────────────────────────

const _ICON_PENDING = `<span class="sermon-clock">&#9716;</span>`;

const _ICON_PROCESSING = `<div class="sermon-spinner"></div>`;

const _ICON_COMPLETE = `
  <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>`;

const _ICON_FAILED = `
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#e20415" stroke-width="2.5" stroke-linecap="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>`;

// ── Status state renderers ────────────────────────────────────────────────

function sermonRenderPending(jobId, queuePosition) {
  const queueLine = (typeof queuePosition === 'number')
    ? `<p class="sermon-status-queue">Your sermon is number <strong>${queuePosition}</strong> in the queue.</p>`
    : '';
  return `
    <div class="vbv-card sermon-status-card" id="sermon-status-view">
      <div class="sermon-status-icon sermon-status-icon-pending">${_ICON_PENDING}</div>
      <p class="sermon-status-title">In the queue</p>
      <p class="sermon-status-text">Your sermon is waiting to be processed.<br>You can leave this page and come back.</p>
      ${queueLine}
      <p class="sermon-job-id">Job ID: ${escapeHtml(jobId)}</p>
      <div class="sermon-status-actions">
        <button class="sermon-new-job-link" id="sermon-new-job">Start a new job</button>
      </div>
    </div>`;
}

function sermonRenderProcessing(jobId, stage, percent) {
  let title, body;
  if (stage === 'downloading') {
    title = 'Downloading audio';
    body = `
      <p class="sermon-status-text">Fetching audio from YouTube…</p>
      <div class="sermon-loading-bar" style="margin-top:20px;"></div>`;
  } else if (stage === 'transcribing') {
    const pct = typeof percent === 'number' ? percent : 0;
    title = 'Transcribing sermon';
    body = `
      <p class="sermon-status-text">Converting speech to text — ${pct}% complete</p>
      <div class="sermon-progress-wrap">
        <div class="sermon-progress-bar" style="width:${pct}%"></div>
      </div>`;
  } else if (stage === 'detecting') {
    title = 'Detecting candidates';
    body = `
      <p class="sermon-status-text">Analysing transcript for the strongest clip moments…</p>
      <div class="sermon-loading-bar" style="margin-top:20px;"></div>`;
  } else {
    title = 'Processing';
    body = `
      <p class="sermon-status-text">This usually takes 10–20 minutes depending on sermon length.</p>
      <div class="sermon-loading-bar" style="margin-top:20px;"></div>`;
  }

  return `
    <div class="vbv-card sermon-status-card" id="sermon-status-view">
      <div class="sermon-status-icon sermon-status-icon-processing">${_ICON_PROCESSING}</div>
      <p class="sermon-status-title">${title}</p>
      ${body}
      <p class="sermon-status-note" style="margin-top:16px;">The server keeps running even if you close this tab.</p>
      <p class="sermon-job-id">Job ID: ${escapeHtml(jobId)}</p>
      <div class="sermon-status-actions">
        <button class="sermon-new-job-link" id="sermon-new-job">Start a new job</button>
      </div>
    </div>`;
}

function sermonRenderComplete(jobId, sessionId) {
  return `
    <div class="vbv-card sermon-status-card" id="sermon-status-view">
      <div class="sermon-status-icon sermon-status-icon-complete">${_ICON_COMPLETE}</div>
      <p class="sermon-status-title">Candidates ready</p>
      <p class="sermon-status-text">Your clip candidates have been identified.</p>
      <div class="sermon-status-actions">
        <a href="/vbv-pipeline/review/${escapeHtml(sessionId)}"
           id="sermon-view-candidates"
           class="vbv-btn vbv-btn-primary"
           data-session-id="${escapeHtml(sessionId)}">
          View Candidates
        </a>
        <p class="sermon-countdown-text">Redirecting in <span id="sermon-countdown">3</span>s&hellip;</p>
        <button class="sermon-new-job-link" id="sermon-new-job">Start a new job</button>
      </div>
    </div>`;
}

function sermonRenderFailed(jobId, error) {
  return `
    <div class="vbv-card sermon-status-card" id="sermon-status-view">
      <div class="sermon-status-icon sermon-status-icon-failed">${_ICON_FAILED}</div>
      <p class="sermon-status-title">Transcription failed</p>
      <div class="vbv-alert vbv-alert-error" style="text-align:left;margin-top:12px;">${escapeHtml(error || 'An unknown error occurred.')}</div>
      <div class="sermon-status-actions">
        <button class="vbv-btn vbv-btn-secondary" id="sermon-try-again">Try Again</button>
      </div>
    </div>`;
}

// ── Queue section ─────────────────────────────────────────────────────────

function sermonTimeAgo(isoString) {
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const _QUEUE_STATUS = {
  pending:    { dot: '#f59e0b', label: 'Pending' },
  processing: { dot: '#3b82f6', label: 'Processing' },
  complete:   { dot: '#10b981', label: 'Complete' },
  failed:     { dot: '#e20415', label: 'Failed' },
};

function sermonRenderQueueSection(jobs) {
  if (!jobs || jobs.length === 0) {
    return `<div id="sermon-queue-section" style="max-width:640px;margin-top:28px;">
      <p style="font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;color:var(--text-muted);margin-bottom:10px;">
        Clip Job Queue
      </p>
      <p style="font-size:0.85rem;color:var(--text-muted);">No jobs submitted yet this session.</p>
    </div>`;
  }

  const myJobId = localStorage.getItem(SERMON_JOB_KEY);

  const rows = jobs.map(j => {
    const st = _QUEUE_STATUS[j.status] || { dot: '#9ca3af', label: j.status };
    const isMine = j.jobId === myJobId;
    const title = escapeHtml(j.sermonTitle || '—');
    const church = escapeHtml(j.churchName || '—');
    const ago = sermonTimeAgo(j.createdAt);
    const sourceBadge = j.sourceType ? `<span style="font-size:0.7rem;color:var(--text-muted);text-transform:capitalize;">${escapeHtml(j.sourceType)}</span>` : '';

    const action = j.status === 'complete' && j.sessionId
      ? `<a href="/vbv-pipeline/review/${escapeHtml(j.sessionId)}" style="font-size:0.8rem;color:var(--accent);white-space:nowrap;">View →</a>`
      : `<span style="color:var(--text-muted);font-size:0.8rem;">—</span>`;

    const rowBg = isMine ? 'background:#fafafa;' : '';

    return `<tr style="${rowBg}">
      <td style="padding:10px 12px;vertical-align:middle;white-space:nowrap;">
        <span style="display:inline-flex;align-items:center;gap:6px;font-size:0.82rem;font-weight:600;color:${st.dot};">
          <span style="width:7px;height:7px;border-radius:50%;background:${st.dot};display:inline-block;${j.status === 'processing' ? 'animation:sermon-spin 1s linear infinite;' : ''}"></span>
          ${st.label}
        </span>
      </td>
      <td style="padding:10px 12px;font-size:0.85rem;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
        ${title}${isMine ? ' <span style="font-size:0.68rem;color:var(--text-muted);font-weight:600;text-transform:uppercase;letter-spacing:0.4px;">You</span>' : ''}
      </td>
      <td style="padding:10px 12px;font-size:0.82rem;color:var(--text-muted);max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${church}</td>
      <td style="padding:10px 12px;">${sourceBadge}</td>
      <td style="padding:10px 12px;font-size:0.78rem;color:var(--text-muted);white-space:nowrap;">${ago}</td>
      <td style="padding:10px 12px;text-align:right;">${action}</td>
    </tr>`;
  }).join('');

  return `<div id="sermon-queue-section" style="max-width:640px;margin-top:28px;">
    <p style="font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;color:var(--text-muted);margin-bottom:10px;">
      Clip Job Queue
      <span style="font-weight:400;text-transform:none;letter-spacing:0;color:var(--text-muted);margin-left:6px;">(${jobs.length})</span>
    </p>
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:8px;overflow:hidden;">
      <table style="width:100%;border-collapse:collapse;font-size:0.85rem;">
        <thead>
          <tr style="background:var(--bg);">
            <th style="padding:8px 12px;font-size:0.72rem;text-transform:uppercase;letter-spacing:0.4px;color:var(--text-muted);font-weight:600;text-align:left;">Status</th>
            <th style="padding:8px 12px;font-size:0.72rem;text-transform:uppercase;letter-spacing:0.4px;color:var(--text-muted);font-weight:600;text-align:left;">Sermon</th>
            <th style="padding:8px 12px;font-size:0.72rem;text-transform:uppercase;letter-spacing:0.4px;color:var(--text-muted);font-weight:600;text-align:left;">Church</th>
            <th style="padding:8px 12px;font-size:0.72rem;text-transform:uppercase;letter-spacing:0.4px;color:var(--text-muted);font-weight:600;text-align:left;">Source</th>
            <th style="padding:8px 12px;font-size:0.72rem;text-transform:uppercase;letter-spacing:0.4px;color:var(--text-muted);font-weight:600;text-align:left;">Submitted</th>
            <th style="padding:8px 12px;"></th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  </div>`;
}

async function sermonRefreshQueue() {
  try {
    const res = await fetch('/api/pipeline/jobs');
    const data = await res.json();
    if (!data.success) return;
    const el = document.getElementById('sermon-queue-section');
    if (!el) return;
    const newSection = document.createElement('div');
    newSection.innerHTML = sermonRenderQueueSection(data.jobs);
    el.replaceWith(newSection.firstElementChild);
  } catch { /* ignore */ }
}

// ── Main view renderer ────────────────────────────────────────────────────

function vbvRenderSermonPipeline() {
  const user = vbvCurrentUser();
  if (!user || (user.role !== 'admin' && user.role !== 'vedits' && !user.sermonPipelineAccess)) {
    return `<div class="vbv-alert vbv-alert-warning" style="max-width:480px;">
      You don't have access to the Clipping Tool. Ask an admin to enable it for your account.
    </div>`;
  }

  const savedJobId = localStorage.getItem(SERMON_JOB_KEY);
  const statusHtml = savedJobId ? sermonRenderPending(savedJobId, null) : '';

  return `
    <h1>Clipping Tool</h1>
    ${statusHtml ? statusHtml : sermonRenderForm()}
    ${sermonRenderQueueSection([])}`;  // populated after bind
}

function sermonRenderForm() {
  return `
    <p style="color:var(--text-muted);margin-bottom:28px;font-size:0.9rem;">
      Fill in the sermon details, then provide the source. The pipeline will transcribe the audio and identify the strongest clip candidates.
    </p>

    <div class="vbv-card" style="max-width:640px;" id="sermon-form-card">

      <div style="margin-bottom:20px;padding-bottom:20px;border-bottom:1px solid var(--border);">
        <p style="font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;color:var(--text-muted);margin-bottom:14px;">Sermon Details</p>

        <div class="vbv-form-group">
          <label>Church / Speaker Name *</label>
          <input type="text" id="sermon-church" placeholder="e.g. Elevation Church — Steven Furtick" />
        </div>

        <div class="vbv-form-group">
          <label>Sermon Title or Series Name *</label>
          <input type="text" id="sermon-title" placeholder="e.g. Greater Is Coming — Part 3" />
        </div>

        <div class="vbv-form-group" style="margin-bottom:0;">
          <label>Platform Target *</label>
          <div class="vbv-checkboxes">
            <label><input type="checkbox" name="sermon-platform" value="Instagram" checked> Instagram</label>
            <label><input type="checkbox" name="sermon-platform" value="TikTok" checked> TikTok</label>
            <label><input type="checkbox" name="sermon-platform" value="YouTube"> YouTube</label>
          </div>
        </div>
      </div>

      <div class="sermon-tabs" id="sermon-tabs">
        <button class="sermon-tab active" data-tab="youtube">YouTube</button>
        <button class="sermon-tab" data-tab="drive">Google Drive</button>
        <button class="sermon-tab" data-tab="upload">Local Upload</button>
      </div>

      <div id="sermon-tab-content" style="margin-top:20px;">

        <div id="sermon-tab-youtube" class="sermon-tab-pane active">
          <div class="vbv-form-group">
            <label>YouTube URL</label>
            <input type="url" id="sermon-yt-url" placeholder="https://www.youtube.com/watch?v=..." />
          </div>
          <button class="vbv-btn vbv-btn-primary" id="sermon-run-youtube">Run Pipeline</button>
        </div>

        <div id="sermon-tab-drive" class="sermon-tab-pane" style="display:none;">
          <div class="vbv-form-group">
            <label>Google Drive Link</label>
            <input type="url" id="sermon-drive-url" placeholder="https://drive.google.com/file/d/..." />
          </div>
          <button class="vbv-btn vbv-btn-primary" id="sermon-run-drive">Run Pipeline</button>
        </div>

        <div id="sermon-tab-upload" class="sermon-tab-pane" style="display:none;">
          <div class="vbv-form-group">
            <label>Audio / Video File</label>
            <input type="file" id="sermon-upload-file" accept=".mp3,.mp4,.wav,.m4a,.mov" />
            <p style="font-size:0.78rem;color:var(--text-muted);margin-top:4px;">Accepted: mp3, mp4, wav, m4a, mov — up to 2 GB</p>
          </div>
          <button class="vbv-btn vbv-btn-primary" id="sermon-run-upload">Run Pipeline</button>
        </div>

      </div>

      <div id="sermon-form-error" class="vbv-alert vbv-alert-error" style="display:none;margin-top:20px;"></div>
    </div>`;
}

// ── Field helpers ─────────────────────────────────────────────────────────

function sermonGetSharedFields() {
  const churchName = document.getElementById('sermon-church')?.value.trim()
    || sessionStorage.getItem('vbv_sermon_church') || '';
  const sermonTitle = document.getElementById('sermon-title')?.value.trim()
    || sessionStorage.getItem('vbv_sermon_title') || '';
  const checked = document.querySelectorAll('input[name="sermon-platform"]:checked');
  const platformTargets = checked.length
    ? Array.from(checked).map((c) => c.value)
    : JSON.parse(sessionStorage.getItem('vbv_sermon_platforms') || '[]');
  return { churchName, sermonTitle, platformTargets };
}

function sermonPersistSharedFields() {
  const { churchName, sermonTitle, platformTargets } = sermonGetSharedFields();
  sessionStorage.setItem('vbv_sermon_church', churchName);
  sessionStorage.setItem('vbv_sermon_title', sermonTitle);
  sessionStorage.setItem('vbv_sermon_platforms', JSON.stringify(platformTargets));
}

function sermonClearPersistedFields() {
  sessionStorage.removeItem('vbv_sermon_church');
  sessionStorage.removeItem('vbv_sermon_title');
  sessionStorage.removeItem('vbv_sermon_platforms');
}

function sermonShowFormError(msg) {
  const el = document.getElementById('sermon-form-error');
  if (el) { el.textContent = msg; el.style.display = 'block'; }
  else alert(`Pipeline error: ${msg}`);
}

function sermonValidateSharedFields() {
  const { churchName, sermonTitle, platformTargets } = sermonGetSharedFields();
  if (!churchName)             { sermonShowFormError('Please enter the church or speaker name.'); return false; }
  if (!sermonTitle)            { sermonShowFormError('Please enter the sermon title.'); return false; }
  if (!platformTargets.length) { sermonShowFormError('Select at least one platform target.'); return false; }
  return true;
}

// ── Status view management ────────────────────────────────────────────────

function sermonShowStatus(status, data) {
  const main = document.getElementById('vbv-main');
  if (!main) return;

  let html = '<h1>Clipping Tool</h1>';
  switch (status) {
    case 'pending':    html += sermonRenderPending(data.jobId, data.queuePosition); break;
    case 'processing': html += sermonRenderProcessing(data.jobId, data.stage, data.percent); break;
    case 'complete':   html += sermonRenderComplete(data.jobId, data.sessionId); break;
    case 'failed':     html += sermonRenderFailed(data.jobId, data.error); break;
    default:           html += sermonRenderPending(data.jobId, null);
  }
  html += sermonRenderQueueSection([]);
  main.innerHTML = html;
  sermonBindStatusButtons(status, data);
  sermonRefreshQueue();
}

function sermonBindStatusButtons(status, data) {
  const newJobBtn = document.getElementById('sermon-new-job');
  if (newJobBtn) {
    newJobBtn.addEventListener('click', (e) => {
      e.preventDefault();
      sermonClearJob();
      vbvNavigate('sermon-pipeline');
    });
  }

  if (status === 'complete') {
    const viewBtn = document.getElementById('sermon-view-candidates');
    if (viewBtn) {
      viewBtn.addEventListener('click', () => {
        sermonClearJob();
        sermonClearPersistedFields();
      });
    }
    sermonStartCountdown(data.sessionId);
  }

  if (status === 'failed') {
    const retryBtn = document.getElementById('sermon-try-again');
    if (retryBtn) {
      retryBtn.addEventListener('click', () => {
        sermonClearJob();
        vbvNavigate('sermon-pipeline');
      });
    }
  }
}

// ── Countdown for auto-redirect ───────────────────────────────────────────

function sermonStartCountdown(sessionId) {
  if (_sermonCountdownTimer) clearInterval(_sermonCountdownTimer);
  let seconds = 3;
  _sermonCountdownTimer = setInterval(() => {
    seconds -= 1;
    const el = document.getElementById('sermon-countdown');
    if (el) el.textContent = seconds;
    if (seconds <= 0) {
      clearInterval(_sermonCountdownTimer);
      _sermonCountdownTimer = null;
      sermonClearJob();
      sermonClearPersistedFields();
      window.location.href = `/vbv-pipeline/review/${sessionId}`;
    }
  }, 1000);
}

// ── Job lifecycle ─────────────────────────────────────────────────────────

function sermonClearJob() {
  sermonStopPolling();
  if (_sermonCountdownTimer) { clearInterval(_sermonCountdownTimer); _sermonCountdownTimer = null; }
  localStorage.removeItem(SERMON_JOB_KEY);
}

function sermonStopPolling() {
  if (_sermonPollInterval) { clearInterval(_sermonPollInterval); _sermonPollInterval = null; }
}

function sermonStartPolling(jobId) {
  sermonStopPolling();
  _sermonPollInterval = setInterval(() => sermonPollOnce(jobId), 10000);
}

async function sermonPollOnce(jobId) {
  let data;
  try {
    const res = await fetch(`/api/pipeline/status/${jobId}`);
    data = await res.json();
  } catch {
    return; // transient network error, keep polling
  }

  if (!data.success) {
    // Job not found (server restarted) — treat as failed, clear key so polling doesn't restart
    sermonStopPolling();
    localStorage.removeItem(SERMON_JOB_KEY);
    const onView = !!document.getElementById('sermon-status-view');
    if (onView) sermonShowStatus('failed', { jobId, error: data.error || 'Job not found.' });
    return;
  }

  if (data.status === 'complete' || data.status === 'failed') {
    sermonStopPolling();
    localStorage.removeItem(SERMON_JOB_KEY);
    if (data.status === 'complete') sermonNotifyComplete(data.sessionId);
  }

  const onView = !!document.getElementById('sermon-status-view');
  if (onView) sermonShowStatus(data.status, data);
}

// ── Notifications ─────────────────────────────────────────────────────────

function sermonRequestNotificationPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

function sermonNotifyComplete(sessionId) {
  sermonPlayCompletionTone();
  if ('Notification' in window && Notification.permission === 'granted') {
    const n = new Notification('Clip candidates ready', {
      body: 'Your sermon has been transcribed and clip candidates are ready to review.',
      icon: '/favicon.ico',
    });
    n.onclick = () => {
      window.focus();
      window.location.href = `/vbv-pipeline/review/${sessionId}`;
    };
  }
}

function sermonPlayCompletionTone() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.setValueAtTime(1100, ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.6);
  } catch { /* audio not supported */ }
}

// ── Job submission ────────────────────────────────────────────────────────

async function sermonSubmitJob(sourceType, opts) {
  const { churchName, sermonTitle, platformTargets } = sermonGetSharedFields();

  let body;
  const headers = {};

  if (sourceType === 'upload') {
    body = new FormData();
    body.append('sourceType', 'upload');
    body.append('audioFile', opts.file);
    body.append('churchName', churchName);
    body.append('sermonTitle', sermonTitle);
    body.append('platformTargets', JSON.stringify(platformTargets));
  } else {
    body = JSON.stringify({ sourceType, url: opts.url, driveUrl: opts.driveUrl, churchName, sermonTitle, platformTargets });
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch('/api/pipeline', { method: 'POST', headers, body });
  const data = await res.json();
  if (!data.success || !data.jobId) throw new Error(data.error || 'Failed to submit pipeline job');
  return data;
}

// ── Bind ──────────────────────────────────────────────────────────────────

function vbvBindSermonPipeline() {
  sermonStopPolling();
  if (_sermonCountdownTimer) { clearInterval(_sermonCountdownTimer); _sermonCountdownTimer = null; }

  // Page-load recovery: if a job is already in flight, resume status tracking
  const savedJobId = localStorage.getItem(SERMON_JOB_KEY);
  if (savedJobId) {
    sermonPollOnce(savedJobId).then(() => {
      // sermonPollOnce removes the key on complete/failed; only resume if still active
      const activeJobId = localStorage.getItem(SERMON_JOB_KEY);
      if (activeJobId && document.getElementById('sermon-status-view')) {
        sermonStartPolling(activeJobId);
      }
    });
    return; // don't bind form — status view is showing (sermonPollOnce refreshes queue)
  }

  // Initial queue fetch for the form view
  sermonRefreshQueue();

  // Restore persisted form values
  const church = sessionStorage.getItem('vbv_sermon_church');
  const title  = sessionStorage.getItem('vbv_sermon_title');
  const platforms = JSON.parse(sessionStorage.getItem('vbv_sermon_platforms') || '[]');
  if (church) { const el = document.getElementById('sermon-church'); if (el) el.value = church; }
  if (title)  { const el = document.getElementById('sermon-title');  if (el) el.value = title;  }
  if (platforms.length) {
    document.querySelectorAll('input[name="sermon-platform"]').forEach((cb) => {
      cb.checked = platforms.includes(cb.value);
    });
  }

  // Tab switching
  document.querySelectorAll('.sermon-tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.sermon-tab').forEach((b) => b.classList.remove('active'));
      document.querySelectorAll('.sermon-tab-pane').forEach((p) => { p.style.display = 'none'; });
      btn.classList.add('active');
      document.getElementById(`sermon-tab-${btn.dataset.tab}`).style.display = 'block';
    });
  });

  // Submit handlers
  document.getElementById('sermon-run-youtube')?.addEventListener('click', async () => {
    if (!sermonValidateSharedFields()) return;
    const url = document.getElementById('sermon-yt-url').value.trim();
    if (!url) return sermonShowFormError('Please enter a YouTube URL.');
    await sermonHandleSubmit('youtube', { url });
  });

  document.getElementById('sermon-run-drive')?.addEventListener('click', async () => {
    if (!sermonValidateSharedFields()) return;
    const driveUrl = document.getElementById('sermon-drive-url').value.trim();
    if (!driveUrl) return sermonShowFormError('Please enter a Google Drive link.');
    await sermonHandleSubmit('drive', { driveUrl });
  });

  document.getElementById('sermon-run-upload')?.addEventListener('click', async () => {
    if (!sermonValidateSharedFields()) return;
    const fileInput = document.getElementById('sermon-upload-file');
    if (!fileInput.files || !fileInput.files[0]) return sermonShowFormError('Please select a file.');
    await sermonHandleSubmit('upload', { file: fileInput.files[0] });
  });
}

async function sermonHandleSubmit(sourceType, opts) {
  sermonPersistSharedFields();
  sermonRequestNotificationPermission();

  // Disable submit buttons while posting
  document.querySelectorAll('.sermon-tab-pane .vbv-btn').forEach((b) => { b.disabled = true; b.textContent = 'Submitting…'; });

  let data;
  try {
    data = await sermonSubmitJob(sourceType, opts);
  } catch (err) {
    document.querySelectorAll('.sermon-tab-pane .vbv-btn').forEach((b) => { b.disabled = false; b.textContent = 'Run Pipeline'; });
    sermonShowFormError(err.message);
    return;
  }

  localStorage.setItem(SERMON_JOB_KEY, data.jobId);
  sermonShowStatus('pending', { jobId: data.jobId, queuePosition: data.queuePosition });
  sermonStartPolling(data.jobId);
}
