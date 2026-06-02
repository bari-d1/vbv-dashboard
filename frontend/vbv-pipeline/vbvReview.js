// ── Sermon Candidate Review Page ──────────────────────────────────────────

(function () {
  const sessionId = location.pathname.split('/').filter(Boolean).pop();
  let session = null;

  function escHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function getToken() {
    return localStorage.getItem('vbv_token') || '';
  }

  function deadlineIn5Days() {
    const d = new Date();
    d.setDate(d.getDate() + 5);
    return d.toISOString().split('T')[0];
  }

  // True when session has all data needed for one-click briefing
  function canAutoBrief() {
    return !!(session?.churchName && session?.sermonTitle && session?.platformTargets?.length && getToken());
  }

  function counts() {
    if (!session) return { total: 0, approved: 0, rejected: 0, briefed: 0, pending: 0 };
    const total    = session.candidates.length;
    const approved = session.candidates.filter(c => c.status === 'approved').length;
    const rejected = session.candidates.filter(c => c.status === 'rejected').length;
    const briefed  = session.candidates.filter(c => c.status === 'briefed').length;
    return { total, approved, rejected, briefed, pending: total - approved - rejected - briefed };
  }

  function updateCountBar() {
    const { total, approved, rejected, briefed, pending } = counts();
    document.getElementById('rv-count-approved').textContent = approved;
    document.getElementById('rv-count-rejected').textContent = rejected;
    document.getElementById('rv-count-briefed').textContent  = briefed;
    document.getElementById('rv-count-pending').textContent  = pending;
    document.getElementById('rv-count-total').textContent    = total;

    // Show Brief All only when there are approved candidates and auto-brief is possible
    const briefAllBtn = document.getElementById('rv-brief-all-btn');
    if (briefAllBtn) {
      briefAllBtn.style.display = (approved > 0 && canAutoBrief()) ? 'inline-block' : 'none';
    }
  }

  function cardClass(status) {
    if (status === 'approved') return 'rv-card rv-card-approved';
    if (status === 'rejected') return 'rv-card rv-card-rejected';
    if (status === 'briefed')  return 'rv-card rv-card-briefed';
    return 'rv-card';
  }

  function renderCard(c, idx) {
    const isApproved = c.status === 'approved';
    const isRejected = c.status === 'rejected';
    const isBriefed  = c.status === 'briefed';

    let actions = '';
    if (isBriefed) {
      actions = `
        <button class="vbv-btn vbv-btn-sm rv-btn-approve rv-btn-active" disabled>&#10003; Approved</button>
        <button class="vbv-btn vbv-btn-sm rv-btn-briefed-active" disabled>&#128196; Brief Created</button>`;
    } else {
      const createBriefBtn = isApproved
        ? (canAutoBrief()
            ? `<button class="vbv-btn vbv-btn-sm vbv-btn-primary rv-btn-create-brief" data-idx="${idx}">Create Brief</button>`
            : `<a class="vbv-btn vbv-btn-sm vbv-btn-primary" href="/vbv-pipeline/brief/${sessionId}/${idx}">Create Brief</a>`)
        : '';

      actions = `
        <button class="vbv-btn vbv-btn-sm rv-btn-approve ${isApproved ? 'rv-btn-active' : 'vbv-btn-secondary'}"
          data-idx="${idx}" ${isApproved ? 'disabled' : ''}>
          ${isApproved ? '&#10003; Approved' : 'Approve'}
        </button>
        <button class="vbv-btn vbv-btn-sm rv-btn-reject ${isRejected ? 'rv-btn-rejected-active' : 'vbv-btn-secondary'}"
          data-idx="${idx}" ${isRejected ? 'disabled' : ''}>
          ${isRejected ? '&#10007; Rejected' : 'Reject'}
        </button>
        ${createBriefBtn}`;
    }

    return `
      <div class="${cardClass(c.status)}" id="rv-card-${idx}">
        <div class="rv-card-header">
          <div class="rv-timestamps">${escHtml(c.start)} &ndash; ${escHtml(c.end)}</div>
          <span class="rv-status-badge rv-status-${c.status}">${c.status}</span>
        </div>
        <div class="rv-label">Hook</div>
        <p class="rv-hook">${escHtml(c.hook)}</p>
        <div class="rv-label" style="margin-top:10px;">Payoff</div>
        <p class="rv-payoff">${escHtml(c.payoff)}</p>
        <div class="rv-actions">${actions}</div>
      </div>`;
  }

  function renderAll() {
    const grid = document.getElementById('rv-grid');
    if (!session || !session.candidates.length) {
      grid.innerHTML = '<div class="vbv-empty">No candidates found in this session.</div>';
      return;
    }
    grid.innerHTML = session.candidates.map((c, i) => renderCard(c, i)).join('');
    bindCardActions();
    updateCountBar();
  }

  function refreshCard(idx) {
    const existing = document.getElementById(`rv-card-${idx}`);
    if (!existing) return;
    existing.outerHTML = renderCard(session.candidates[idx], idx);
    const newCard = document.getElementById(`rv-card-${idx}`);
    if (!newCard) return;
    newCard.querySelectorAll('.rv-btn-approve').forEach(b => b.addEventListener('click', handleApprove));
    newCard.querySelectorAll('.rv-btn-reject').forEach(b => b.addEventListener('click', handleReject));
    newCard.querySelectorAll('.rv-btn-create-brief').forEach(b => b.addEventListener('click', handleCreateBrief));
    updateCountBar();
  }

  async function patchStatus(idx, status) {
    const res = await fetch(`/api/candidates/${sessionId}/${idx}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed to update status');
    return data;
  }

  async function submitBrief(idx) {
    const c = session.candidates[idx];
    const res = await fetch('/api/briefs/vbv', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getToken()}`,
      },
      body: JSON.stringify({
        sessionId,
        candidateIndex: idx,
        sourceReference: session.sourceReference || '',
        start: c.start,
        end: c.end,
        hook: c.hook,
        payoff: c.payoff,
        churchName: session.churchName,
        sermonTitle: session.sermonTitle,
        platformTarget: session.platformTargets,
        deadline: deadlineIn5Days(),
        notes: '',
      }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Brief creation failed');
    // The backend already marks the candidate briefed in the file; keep local state in sync
    session.candidates[idx].status = 'briefed';
    return data;
  }

  async function handleApprove(e) {
    const idx = parseInt(e.target.dataset.idx, 10);
    e.target.disabled = true;
    try {
      await patchStatus(idx, 'approved');
      session.candidates[idx].status = 'approved';
      refreshCard(idx);
    } catch (err) {
      e.target.disabled = false;
      showError(err.message);
    }
  }

  async function handleReject(e) {
    const idx = parseInt(e.target.dataset.idx, 10);
    e.target.disabled = true;
    try {
      await patchStatus(idx, 'rejected');
      session.candidates[idx].status = 'rejected';
      refreshCard(idx);
    } catch (err) {
      e.target.disabled = false;
      showError(err.message);
    }
  }

  async function handleCreateBrief(e) {
    const idx = parseInt(e.target.dataset.idx, 10);
    e.target.disabled = true;
    e.target.textContent = 'Creating…';
    try {
      await submitBrief(idx);
      refreshCard(idx);
    } catch (err) {
      e.target.disabled = false;
      e.target.textContent = 'Create Brief';
      showError(err.message);
    }
  }

  async function handleBriefAll() {
    const btn = document.getElementById('rv-brief-all-btn');
    const approved = session.candidates
      .map((c, i) => ({ c, i }))
      .filter(({ c }) => c.status === 'approved');

    if (!approved.length) return;

    btn.disabled = true;
    let done = 0;
    const errors = [];

    for (const { i } of approved) {
      btn.textContent = `Briefing ${done + 1} of ${approved.length}…`;
      try {
        await submitBrief(i);
        refreshCard(i);
        done++;
      } catch (err) {
        errors.push(`Candidate ${i + 1}: ${err.message}`);
      }
    }

    btn.disabled = false;
    btn.textContent = 'Brief All';
    updateCountBar();

    if (errors.length) {
      showError(`${done} briefed. ${errors.length} failed:\n${errors.join('\n')}`);
    }
  }

  function bindCardActions() {
    document.querySelectorAll('.rv-btn-approve').forEach(b => b.addEventListener('click', handleApprove));
    document.querySelectorAll('.rv-btn-reject').forEach(b => b.addEventListener('click', handleReject));
    document.querySelectorAll('.rv-btn-create-brief').forEach(b => b.addEventListener('click', handleCreateBrief));
  }

  function showError(msg) {
    const el = document.getElementById('rv-error');
    if (!el) return;
    el.textContent = msg;
    el.style.display = 'block';
    setTimeout(() => { el.style.display = 'none'; }, 8000);
  }

  async function init() {
    if (!sessionId || sessionId === 'review') {
      document.getElementById('rv-loading').style.display = 'none';
      document.getElementById('rv-error').textContent = 'No session ID in URL.';
      document.getElementById('rv-error').style.display = 'block';
      return;
    }

    try {
      const res = await fetch(`/api/candidates/${sessionId}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to load session');
      session = data;

      document.getElementById('rv-loading').style.display = 'none';
      document.getElementById('rv-header-source').textContent = session.sourceReference || session.sourceType;
      document.getElementById('rv-header-count').textContent = `${session.candidates.length} candidates`;
      document.getElementById('rv-body').style.display = 'block';

      const briefAllBtn = document.getElementById('rv-brief-all-btn');
      if (briefAllBtn) briefAllBtn.addEventListener('click', handleBriefAll);

      renderAll();
    } catch (err) {
      document.getElementById('rv-loading').style.display = 'none';
      const errEl = document.getElementById('rv-error');
      errEl.textContent = err.message;
      errEl.style.display = 'block';
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
