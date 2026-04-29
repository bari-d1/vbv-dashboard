// ── Sync helpers ───────────────────────────────────────────────────────────

let syncStatus = {};

async function loadSyncStatus() {
  try {
    const res = await fetch('/api/sync/status');
    syncStatus = await res.json();
  } catch (_) {
    syncStatus = {};
  }
  return syncStatus;
}

function fmtSyncTime(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now - d;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1)    return 'just now';
  if (diffMins < 60)   return `${diffMins}m ago`;
  if (diffHours < 24)  return `${diffHours}h ago`;
  if (diffDays === 1)  return 'yesterday';
  if (diffDays < 7)    return `${diffDays}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function renderSyncBar(platform, onSync) {
  const status = syncStatus[platform];
  const lastSync = status?.lastSyncedAt;
  const id = `sync-bar-${platform}`;

  const statusHtml = lastSync
    ? `<span class="sync-status">Last synced <strong>${fmtSyncTime(lastSync)}</strong> &mdash; ${new Date(lastSync).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>`
    : `<span class="sync-status never">Never synced &mdash; click Sync to load your data</span>`;

  return `<div class="sync-bar" id="${id}">
    ${statusHtml}
    <div style="display:flex;gap:8px;flex-shrink:0">
      <button class="sync-btn" id="token-exchange-btn" onclick="exchangeToken()" title="Exchange for 60-day token">
        Refresh token
      </button>
      <button class="sync-btn" id="sync-btn-${platform}" onclick="triggerSync('${platform}')">
        Sync now
      </button>
    </div>
  </div>`;
}

async function exchangeToken() {
  const password = window.prompt('Enter token refresh password:');
  if (!password) return;
  const btn = document.getElementById('token-exchange-btn');
  if (!btn || btn.disabled) return;
  btn.disabled = true;
  btn.textContent = 'Exchanging...';

  try {
    const res = await fetch('/api/sync/token/exchange', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || data.error);
    btn.textContent = `Token valid for ${data.expiresInDays} days`;
    btn.style.borderColor = 'var(--success)';
    btn.style.color = 'var(--success)';
  } catch (err) {
    btn.textContent = err.message === 'Invalid password' ? 'Wrong password' : 'Exchange failed';
    btn.style.borderColor = 'var(--accent)';
    btn.style.color = 'var(--accent)';
    btn.disabled = false;
  }
}

async function triggerSync(platform) {
  const btn = document.getElementById(`sync-btn-${platform}`);
  const bar = document.getElementById(`sync-bar-${platform}`);
  if (!btn || btn.disabled) return;

  btn.disabled = true;
  btn.classList.add('syncing');
  btn.textContent = 'Syncing...';

  try {
    const res = await fetch(`/api/sync/${platform}`, { method: 'POST' });
    const data = await res.json();

    if (!res.ok) throw new Error(data.detail || data.error || 'Sync failed');

    // Update local status
    syncStatus[platform] = { lastSyncedAt: data.lastSyncedAt };

    // Reload the page data
    const key = `${platform}:${currentPeriod}`;
    delete loadedState[key];
    loadCurrentPage(true);

  } catch (err) {
    if (bar) {
      const errSpan = bar.querySelector('.sync-status');
      if (errSpan) errSpan.innerHTML = `<span style="color:var(--accent)">Sync failed: ${err.message}</span>`;
    }
    btn.disabled = false;
    btn.classList.remove('syncing');
    btn.textContent = 'Retry';
  }
}
