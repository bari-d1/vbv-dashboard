// ── Brief Creation Page ───────────────────────────────────────────────────

(function () {
  const parts = location.pathname.split('/').filter(Boolean);
  // /vbv-pipeline/brief/:sessionId/:candidateIndex
  const sessionId = parts[2];
  const candidateIndex = parseInt(parts[3], 10);

  let session = null;
  let candidate = null;

  function escHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function getToken() {
    return localStorage.getItem('vbv_token') || '';
  }

  function showError(msg) {
    const el = document.getElementById('bf-error');
    if (!el) return;
    el.textContent = msg;
    el.style.display = 'block';
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function fieldError(id, msg) {
    const el = document.getElementById(id);
    if (el) { el.textContent = msg; el.style.display = msg ? 'block' : 'none'; }
  }

  function clearFieldErrors() {
    document.querySelectorAll('.bf-field-error').forEach(el => { el.style.display = 'none'; el.textContent = ''; });
    const errEl = document.getElementById('bf-error');
    if (errEl) errEl.style.display = 'none';
  }

  async function init() {
    if (!sessionId || isNaN(candidateIndex)) {
      document.getElementById('bf-loading').style.display = 'none';
      showError('Invalid brief URL — missing session ID or candidate index.');
      return;
    }

    try {
      const res = await fetch(`/api/candidates/${sessionId}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Session not found');
      session = data;

      if (candidateIndex < 0 || candidateIndex >= session.candidates.length) {
        throw new Error(`Candidate index ${candidateIndex} is out of range`);
      }
      candidate = session.candidates[candidateIndex];

      if (candidate.status !== 'approved') {
        // Redirect back to review with a message
        location.href = `/vbv-pipeline/review/${sessionId}?msg=not-approved`;
        return;
      }

      document.getElementById('bf-loading').style.display = 'none';
      renderForm();
    } catch (err) {
      document.getElementById('bf-loading').style.display = 'none';
      showError(err.message);
    }
  }

  function renderForm() {
    document.getElementById('bf-body').style.display = 'block';

    // Back link
    document.getElementById('bf-back-link').href = `/vbv-pipeline/review/${sessionId}`;

    // Auto-populated read-only fields
    document.getElementById('bf-source').value = session.sourceReference || session.sourceType || '—';
    document.getElementById('bf-start').value = candidate.start;
    document.getElementById('bf-end').value = candidate.end;
    document.getElementById('bf-hook').value = candidate.hook;
    document.getElementById('bf-payoff').value = candidate.payoff;

    // Default deadline to 5 days from now; keep tomorrow as the minimum
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const fiveDays = new Date();
    fiveDays.setDate(fiveDays.getDate() + 5);
    const deadlineInput = document.getElementById('bf-deadline');
    deadlineInput.min = tomorrow.toISOString().split('T')[0];
    deadlineInput.value = fiveDays.toISOString().split('T')[0];

    // Pre-populate manual fields from session if collected during pipeline setup
    if (session.churchName)  document.getElementById('bf-church').value = session.churchName;
    if (session.sermonTitle) document.getElementById('bf-sermon-title').value = session.sermonTitle;
    if (session.platformTargets?.length) {
      document.querySelectorAll('input[name="bf-platform"]').forEach(cb => {
        cb.checked = session.platformTargets.includes(cb.value);
      });
    }

    document.getElementById('bf-form').addEventListener('submit', handleSubmit);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    clearFieldErrors();

    const churchName = document.getElementById('bf-church').value.trim();
    const sermonTitle = document.getElementById('bf-sermon-title').value.trim();
    const deadline = document.getElementById('bf-deadline').value;
    const notes = document.getElementById('bf-notes').value.trim();
    const platformCheckboxes = document.querySelectorAll('input[name="bf-platform"]:checked');
    const platformTarget = Array.from(platformCheckboxes).map(c => c.value);

    let valid = true;
    if (!churchName) { fieldError('bf-err-church', 'Church / speaker name is required.'); valid = false; }
    if (!sermonTitle) { fieldError('bf-err-sermon-title', 'Sermon title is required.'); valid = false; }
    if (!deadline) { fieldError('bf-err-deadline', 'Deadline is required.'); valid = false; }
    if (!platformTarget.length) { fieldError('bf-err-platform', 'Select at least one platform.'); valid = false; }
    if (!valid) return;

    const btn = document.getElementById('bf-submit');
    btn.disabled = true;
    btn.textContent = 'Submitting…';

    try {
      const res = await fetch('/api/briefs/vbv', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`,
        },
        body: JSON.stringify({
          sessionId,
          candidateIndex,
          sourceReference: session.sourceReference || '',
          start: candidate.start,
          end: candidate.end,
          hook: candidate.hook,
          payoff: candidate.payoff,
          churchName,
          sermonTitle,
          platformTarget,
          deadline,
          notes,
        }),
      });

      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Submission failed');

      // Show success state
      document.getElementById('bf-form-wrap').style.display = 'none';
      const success = document.getElementById('bf-success');
      success.style.display = 'block';
      document.getElementById('bf-success-review-link').href = `/vbv-pipeline/review/${sessionId}`;
    } catch (err) {
      btn.disabled = false;
      btn.textContent = 'Submit Brief';
      showError(err.message);
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
