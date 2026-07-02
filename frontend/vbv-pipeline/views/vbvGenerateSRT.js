// ── Generate SRT ───────────────────────────────────────────────────────────

const SRT_JOB_KEY = 'vbv_srt_jobId';

let _srtPollInterval = null;

// ── Icons ──────────────────────────────────────────────────────────────────

const _SRT_ICON_PENDING = `<span class="sermon-clock">&#9716;</span>`;
const _SRT_ICON_PROCESSING = `<div class="sermon-spinner"></div>`;
const _SRT_ICON_COMPLETE = `
  <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>`;
const _SRT_ICON_FAILED = `
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#e20415" stroke-width="2.5" stroke-linecap="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>`;

// ── Status renderers ───────────────────────────────────────────────────────

function srtRenderPending(jobId) {
  return `
    <div class="vbv-card sermon-status-card" id="srt-status-view">
      <div class="sermon-status-icon sermon-status-icon-pending">${_SRT_ICON_PENDING}</div>
      <p class="sermon-status-title">In the queue</p>
      <p class="sermon-status-text">Your video is waiting to be processed. You can leave this page and come back.</p>
      <p class="sermon-job-id">Job ID: ${escapeHtml(jobId)}</p>
      <div class="sermon-status-actions">
        <button class="sermon-new-job-link" id="srt-new-job">Start a new job</button>
        <button class="sermon-stop-btn" id="srt-stop-job">Stop job</button>
      </div>
    </div>`;
}

function srtRenderProcessing(jobId, stage, percent) {
  let title, body;
  if (stage === 'downloading') {
    title = 'Downloading audio';
    body = `<p class="sermon-status-text">Fetching audio…</p><div class="sermon-loading-bar" style="margin-top:20px;"></div>`;
  } else if (stage === 'transcribing') {
    const pct = typeof percent === 'number' ? percent : 0;
    title = 'Transcribing audio';
    body = `
      <p class="sermon-status-text">Converting speech to text — ${pct}% complete</p>
      <div class="sermon-progress-wrap">
        <div class="sermon-progress-bar" style="width:${pct}%"></div>
      </div>`;
  } else if (stage === 'fetching_transcript') {
    title = 'Fetching transcript';
    body = `<p class="sermon-status-text">Retrieving captions from YouTube…</p><div class="sermon-loading-bar" style="margin-top:20px;"></div>`;
  } else {
    title = 'Processing';
    body = `<p class="sermon-status-text">This usually takes 10–20 minutes for longer videos.</p><div class="sermon-loading-bar" style="margin-top:20px;"></div>`;
  }

  return `
    <div class="vbv-card sermon-status-card" id="srt-status-view">
      <div class="sermon-status-icon sermon-status-icon-processing">${_SRT_ICON_PROCESSING}</div>
      <p class="sermon-status-title">${title}</p>
      ${body}
      <p class="sermon-status-note" style="margin-top:16px;">The server keeps running even if you close this tab.</p>
      <p class="sermon-job-id">Job ID: ${escapeHtml(jobId)}</p>
      <div class="sermon-status-actions">
        <button class="sermon-new-job-link" id="srt-new-job">Start a new job</button>
        <button class="sermon-stop-btn" id="srt-stop-job">Stop job</button>
      </div>
    </div>`;
}

function srtRenderComplete(jobId) {
  return `
    <div class="vbv-card sermon-status-card" id="srt-status-view">
      <div class="sermon-status-icon sermon-status-icon-complete">${_SRT_ICON_COMPLETE}</div>
      <p class="sermon-status-title">SRT file ready</p>
      <p class="sermon-status-text">Your subtitle file has been generated and is ready to download.</p>
      <div class="sermon-status-actions">
        <a href="/api/generate-srt/download/${escapeHtml(jobId)}"
           class="vbv-btn vbv-btn-primary"
           download>
          Download .srt file
        </a>
        <button class="sermon-new-job-link" id="srt-new-job" style="margin-top:12px;">Generate another</button>
      </div>
    </div>`;
}

function srtRenderFailed(jobId, error) {
  return `
    <div class="vbv-card sermon-status-card" id="srt-status-view">
      <div class="sermon-status-icon sermon-status-icon-failed">${_SRT_ICON_FAILED}</div>
      <p class="sermon-status-title">Generation failed</p>
      <div class="vbv-alert vbv-alert-error" style="text-align:left;margin-top:12px;">${escapeHtml(error || 'An unknown error occurred.')}</div>
      <div class="sermon-status-actions">
        <button class="vbv-btn vbv-btn-secondary" id="srt-try-again">Try Again</button>
      </div>
    </div>`;
}

// ── Queue section ──────────────────────────────────────────────────────────

const _SRT_QUEUE_STATUS = {
  pending:    { dot: '#f59e0b', label: 'Pending' },
  processing: { dot: '#3b82f6', label: 'Processing' },
  complete:   { dot: '#10b981', label: 'Complete' },
  failed:     { dot: '#e20415', label: 'Failed' },
  cancelled:  { dot: '#9ca3af', label: 'Cancelled' },
};

function srtRenderQueueSection(jobs) {
  if (!jobs || jobs.length === 0) {
    return `<div id="srt-queue-section" style="max-width:640px;margin-top:28px;">
      <p style="font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;color:var(--text-muted);margin-bottom:10px;">SRT Job Queue</p>
      <p style="font-size:0.85rem;color:var(--text-muted);">No jobs submitted yet this session.</p>
    </div>`;
  }

  const myJobId = localStorage.getItem(SRT_JOB_KEY);

  const rows = jobs.map(j => {
    const st = _SRT_QUEUE_STATUS[j.status] || { dot: '#9ca3af', label: j.status };
    const isMine = j.jobId === myJobId;
    const title = escapeHtml(j.videoTitle || '—');
    const ago = sermonTimeAgo(j.createdAt);

    const action = j.status === 'complete'
      ? `<a href="/api/generate-srt/download/${escapeHtml(j.jobId)}" style="font-size:0.8rem;color:var(--accent);white-space:nowrap;" download>Download →</a>`
      : `<span style="color:var(--text-muted);font-size:0.8rem;">—</span>`;

    return `<tr style="${isMine ? 'background:#fafafa;' : ''}">
      <td style="padding:10px 12px;vertical-align:middle;white-space:nowrap;">
        <span style="display:inline-flex;align-items:center;gap:6px;font-size:0.82rem;font-weight:600;color:${st.dot};">
          <span style="width:7px;height:7px;border-radius:50%;background:${st.dot};display:inline-block;${j.status === 'processing' ? 'animation:sermon-spin 1s linear infinite;' : ''}"></span>
          ${st.label}
        </span>
      </td>
      <td style="padding:10px 12px;font-size:0.85rem;max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
        ${title}${isMine ? ' <span style="font-size:0.68rem;color:var(--text-muted);font-weight:600;text-transform:uppercase;letter-spacing:0.4px;">You</span>' : ''}
      </td>
      <td style="padding:10px 12px;font-size:0.78rem;color:var(--text-muted);white-space:nowrap;">${ago}</td>
      <td style="padding:10px 12px;text-align:right;">${action}</td>
    </tr>`;
  }).join('');

  return `<div id="srt-queue-section" style="max-width:640px;margin-top:28px;">
    <p style="font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;color:var(--text-muted);margin-bottom:10px;">
      SRT Job Queue
      <span style="font-weight:400;text-transform:none;letter-spacing:0;color:var(--text-muted);margin-left:6px;">(${jobs.length})</span>
    </p>
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:8px;overflow:hidden;">
      <table style="width:100%;border-collapse:collapse;font-size:0.85rem;">
        <thead>
          <tr style="background:var(--bg);">
            <th style="padding:8px 12px;font-size:0.72rem;text-transform:uppercase;letter-spacing:0.4px;color:var(--text-muted);font-weight:600;text-align:left;">Status</th>
            <th style="padding:8px 12px;font-size:0.72rem;text-transform:uppercase;letter-spacing:0.4px;color:var(--text-muted);font-weight:600;text-align:left;">Video</th>
            <th style="padding:8px 12px;font-size:0.72rem;text-transform:uppercase;letter-spacing:0.4px;color:var(--text-muted);font-weight:600;text-align:left;">Submitted</th>
            <th style="padding:8px 12px;"></th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  </div>`;
}

async function srtRefreshQueue() {
  try {
    const res = await fetch('/api/generate-srt/jobs');
    const data = await res.json();
    if (!data.success) return;
    const el = document.getElementById('srt-queue-section');
    if (!el) return;
    const tmp = document.createElement('div');
    tmp.innerHTML = srtRenderQueueSection(data.jobs);
    el.replaceWith(tmp.firstElementChild);
  } catch { /* ignore */ }
}

// ── Main view renderer ─────────────────────────────────────────────────────

function vbvRenderGenerateSRT() {
  const user = vbvCurrentUser();
  const allowed = ['admin', 'editor', 'lead_editor'];
  if (!user || !allowed.includes(user.role)) {
    return `<div class="vbv-alert vbv-alert-warning" style="max-width:480px;">
      You don't have access to Generate SRT.
    </div>`;
  }

  const savedJobId = localStorage.getItem(SRT_JOB_KEY);
  const statusHtml = savedJobId ? srtRenderPending(savedJobId) : '';

  return `
    <h1>Generate SRT</h1>
    ${statusHtml ? statusHtml : srtRenderForm()}
    ${srtRenderQueueSection([])}`;
}

function srtRenderForm() {
  return `
    <p style="color:var(--text-muted);margin-bottom:28px;font-size:0.9rem;">
      Provide a video source and get a downloadable .srt subtitle file.
    </p>

    <div class="vbv-card" style="max-width:640px;" id="srt-form-card">

      <div style="margin-bottom:20px;padding-bottom:20px;border-bottom:1px solid var(--border);">
        <p style="font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;color:var(--text-muted);margin-bottom:14px;">Video Details</p>
        <div class="vbv-form-group" style="margin-bottom:0;">
          <label>Video Title <span style="font-weight:400;color:var(--text-muted);">(used for the filename)</span></label>
          <input type="text" id="srt-video-title" placeholder="e.g. Sunday Service 22 June 2026" />
        </div>
      </div>

      <div class="sermon-tabs" id="srt-tabs">
        <button class="sermon-tab active" data-tab="youtube">YouTube</button>
        <button class="sermon-tab" data-tab="drive">Google Drive</button>
        <button class="sermon-tab" data-tab="upload">Local Upload</button>
      </div>

      <div id="srt-tab-content" style="margin-top:20px;">

        <div id="srt-tab-youtube" class="sermon-tab-pane active">
          <div class="vbv-form-group">
            <label>YouTube URL</label>
            <input type="url" id="srt-yt-url" placeholder="https://www.youtube.com/watch?v=..." />
          </div>
          <button class="vbv-btn vbv-btn-primary" id="srt-run-youtube">Generate SRT</button>
        </div>

        <div id="srt-tab-drive" class="sermon-tab-pane" style="display:none;">
          <div class="vbv-form-group">
            <label>Google Drive Link</label>
            <input type="url" id="srt-drive-url" placeholder="https://drive.google.com/file/d/..." />
          </div>
          <button class="vbv-btn vbv-btn-primary" id="srt-run-drive">Generate SRT</button>
        </div>

        <div id="srt-tab-upload" class="sermon-tab-pane" style="display:none;">
          <div class="vbv-form-group">
            <label>Audio / Video File</label>
            <input type="file" id="srt-upload-file" accept=".mp3,.mp4,.wav,.m4a,.mov" />
            <p style="font-size:0.78rem;color:var(--text-muted);margin-top:4px;">Accepted: mp3, mp4, wav, m4a, mov — up to 2 GB</p>
          </div>
          <button class="vbv-btn vbv-btn-primary" id="srt-run-upload">Generate SRT</button>
        </div>

      </div>

      <div id="srt-form-error" class="vbv-alert vbv-alert-error" style="display:none;margin-top:20px;"></div>
    </div>`;
}

// ── Status management ──────────────────────────────────────────────────────

function srtShowStatus(status, data) {
  const main = document.getElementById('vbv-main');
  if (!main) return;

  let html = '<h1>Generate SRT</h1>';
  switch (status) {
    case 'pending':    html += srtRenderPending(data.jobId); break;
    case 'processing': html += srtRenderProcessing(data.jobId, data.stage, data.percent); break;
    case 'complete':   html += srtRenderComplete(data.jobId); break;
    case 'failed':     html += srtRenderFailed(data.jobId, data.error); break;
    case 'cancelled':  html += srtRenderFailed(data.jobId, 'Job was stopped.'); break;
    default:           html += srtRenderPending(data.jobId);
  }
  html += srtRenderQueueSection([]);
  main.innerHTML = html;
  srtBindStatusButtons(status, data);
  srtRefreshQueue();
}

function srtBindStatusButtons(status, data) {
  document.getElementById('srt-new-job')?.addEventListener('click', () => {
    srtClearJob();
    vbvNavigate('generate-srt');
  });

  document.getElementById('srt-stop-job')?.addEventListener('click', async () => {
    const btn = document.getElementById('srt-stop-job');
    if (btn) { btn.disabled = true; btn.textContent = 'Stopping…'; }
    try { await fetch(`/api/generate-srt/${data.jobId}`, { method: 'DELETE' }); } catch { /* ignore */ }
    srtClearJob();
    vbvNavigate('generate-srt');
  });

  if (status === 'failed') {
    document.getElementById('srt-try-again')?.addEventListener('click', () => {
      srtClearJob();
      vbvNavigate('generate-srt');
    });
  }
}

// ── Polling ────────────────────────────────────────────────────────────────

function srtStopPolling() {
  if (_srtPollInterval) { clearInterval(_srtPollInterval); _srtPollInterval = null; }
}

function srtStartPolling(jobId) {
  srtStopPolling();
  _srtPollInterval = setInterval(() => srtPollOnce(jobId), 10000);
}

async function srtPollOnce(jobId) {
  let data;
  try {
    const res = await fetch(`/api/generate-srt/status/${jobId}`);
    data = await res.json();
  } catch { return; }

  if (!data.success) {
    srtStopPolling();
    localStorage.removeItem(SRT_JOB_KEY);
    if (document.getElementById('srt-status-view')) {
      srtShowStatus('failed', { jobId, error: data.error || 'Job not found.' });
    }
    return;
  }

  if (data.status === 'complete' || data.status === 'failed' || data.status === 'cancelled') {
    srtStopPolling();
    localStorage.removeItem(SRT_JOB_KEY);
  }

  if (document.getElementById('srt-status-view')) srtShowStatus(data.status, data);
}

function srtClearJob() {
  srtStopPolling();
  localStorage.removeItem(SRT_JOB_KEY);
}

// ── Submission ─────────────────────────────────────────────────────────────

function srtShowFormError(msg) {
  const el = document.getElementById('srt-form-error');
  if (el) { el.textContent = msg; el.style.display = 'block'; }
  else alert(msg);
}

async function srtSubmitJob(sourceType, opts) {
  const videoTitle = document.getElementById('srt-video-title')?.value.trim() || '';

  let body;
  const headers = {};

  if (sourceType === 'upload') {
    body = new FormData();
    body.append('sourceType', 'upload');
    body.append('audioFile', opts.file);
    body.append('videoTitle', videoTitle);
  } else {
    body = JSON.stringify({ sourceType, url: opts.url, driveUrl: opts.driveUrl, videoTitle });
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch('/api/generate-srt', { method: 'POST', headers, body });
  const data = await res.json();
  if (!data.success || !data.jobId) throw new Error(data.error || 'Failed to submit SRT job');
  return data;
}

async function srtHandleSubmit(sourceType, opts) {
  document.querySelectorAll('#srt-tab-content .vbv-btn').forEach(b => { b.disabled = true; b.textContent = 'Submitting…'; });

  let data;
  try {
    data = await srtSubmitJob(sourceType, opts);
  } catch (err) {
    document.querySelectorAll('#srt-tab-content .vbv-btn').forEach(b => { b.disabled = false; b.textContent = 'Generate SRT'; });
    srtShowFormError(err.message);
    return;
  }

  localStorage.setItem(SRT_JOB_KEY, data.jobId);
  srtShowStatus('pending', { jobId: data.jobId });
  srtStartPolling(data.jobId);
}

// ── Bind ───────────────────────────────────────────────────────────────────

function vbvBindGenerateSRT() {
  srtStopPolling();

  const savedJobId = localStorage.getItem(SRT_JOB_KEY);
  if (savedJobId) {
    srtPollOnce(savedJobId).then(() => {
      const activeJobId = localStorage.getItem(SRT_JOB_KEY);
      if (activeJobId && document.getElementById('srt-status-view')) {
        srtStartPolling(activeJobId);
      }
    });
    return;
  }

  srtRefreshQueue();

  // Tab switching
  document.querySelectorAll('#srt-tabs .sermon-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#srt-tabs .sermon-tab').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.sermon-tab-pane').forEach(p => { p.style.display = 'none'; });
      btn.classList.add('active');
      document.getElementById(`srt-tab-${btn.dataset.tab}`).style.display = 'block';
    });
  });

  function getYouTubeUrl() {
    let url = document.getElementById('srt-yt-url').value.trim();
    const liveMatch = url.match(/youtube\.com\/live\/([a-zA-Z0-9_-]+)/);
    if (liveMatch) {
      url = `https://www.youtube.com/watch?v=${liveMatch[1]}`;
      document.getElementById('srt-yt-url').value = url;
    }
    return url;
  }

  document.getElementById('srt-run-youtube')?.addEventListener('click', async () => {
    const url = getYouTubeUrl();
    if (!url) return srtShowFormError('Please enter a YouTube URL.');
    await srtHandleSubmit('youtube_transcript', { url });
  });

  document.getElementById('srt-run-drive')?.addEventListener('click', async () => {
    const driveUrl = document.getElementById('srt-drive-url').value.trim();
    if (!driveUrl) return srtShowFormError('Please enter a Google Drive link.');
    await srtHandleSubmit('drive', { driveUrl });
  });

  document.getElementById('srt-run-upload')?.addEventListener('click', async () => {
    const fileInput = document.getElementById('srt-upload-file');
    if (!fileInput.files || !fileInput.files[0]) return srtShowFormError('Please select a file.');
    await srtHandleSubmit('upload', { file: fileInput.files[0] });
  });
}
