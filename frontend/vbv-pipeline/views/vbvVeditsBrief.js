async function vbvRenderVeditsBrief() {
  return `
    <h1>Create Vedits Brief</h1>
    <div class="vbv-section">
      <div id="vbv-vedits-brief-error" class="vbv-alert vbv-alert-error" style="display:none;"></div>
      <div id="vbv-vedits-brief-success" class="vbv-alert vbv-alert-info" style="display:none;"></div>
      <form id="vbv-vedits-brief-form">
        <div class="vbv-form-group">
          <label>Job Title *</label>
          <input type="text" id="vb-title" required placeholder="Easter Sunday Reel – Jordan feat. Mercy">
        </div>
        <div class="vbv-form-group">
          <label>Artist Name *</label>
          <input type="text" id="vb-artist" required placeholder="Jordan feat. Mercy">
        </div>
        <div class="vbv-form-group">
          <label>Google Drive Link *</label>
          <input type="url" id="vb-drive" required placeholder="https://drive.google.com/...">
        </div>
        <div class="vbv-form-group">
          <label>Start Timestamp (HH:MM:SS)</label>
          <input type="text" id="vb-start" placeholder="00:01:23">
        </div>
        <div class="vbv-form-group">
          <label>End Timestamp (HH:MM:SS)</label>
          <input type="text" id="vb-end" placeholder="00:02:45">
        </div>
        <div class="vbv-form-group">
          <label>Hook &amp; Payoff / Clip Notes</label>
          <textarea id="vb-clipnotes" placeholder="Describe the hook, the payoff, and any moments to highlight…" style="min-height:100px;"></textarea>
        </div>
        <div class="vbv-form-group">
          <label>Platform Target *</label>
          <div class="vbv-checkboxes">
            <label><input type="checkbox" name="vb-platform" value="Instagram"> Instagram</label>
            <label><input type="checkbox" name="vb-platform" value="TikTok"> TikTok</label>
            <label><input type="checkbox" name="vb-platform" value="YouTube"> YouTube</label>
          </div>
        </div>
        <div class="vbv-form-group">
          <label>Deadline *</label>
          <input type="date" id="vb-deadline" required>
        </div>
        <button type="submit" class="vbv-btn vbv-btn-primary">Submit Brief</button>
      </form>
    </div>`;
}

function vbvBindVeditsBrief() {
  const form = document.getElementById('vbv-vedits-brief-form');
  if (!form) return;

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const errEl = document.getElementById('vbv-vedits-brief-error');
    const sucEl = document.getElementById('vbv-vedits-brief-success');
    errEl.style.display = 'none'; sucEl.style.display = 'none';

    const platforms = [...document.querySelectorAll('input[name="vb-platform"]:checked')].map(c => c.value);
    if (!platforms.length) { errEl.textContent = 'Select at least one platform.'; errEl.style.display = 'block'; return; }

    const body = {
      title:          document.getElementById('vb-title').value.trim(),
      artistName:     document.getElementById('vb-artist').value.trim(),
      briefType:      'vedits',
      sourceDriveLink: document.getElementById('vb-drive').value.trim(),
      startTimestamp: document.getElementById('vb-start').value || null,
      endTimestamp:   document.getElementById('vb-end').value || null,
      clipNotes:      document.getElementById('vb-clipnotes').value || null,
      platformTargets: platforms,
      deadline:       document.getElementById('vb-deadline').value,
    };

    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true; btn.textContent = 'Submitting…';
    try {
      await vbvApi('POST', '/vbv/jobs', body);
      sucEl.textContent = 'Brief submitted successfully!'; sucEl.style.display = 'block';
      form.reset();
      setTimeout(() => vbvNavigate('vedits-jobs'), 1500);
    } catch(err) {
      errEl.textContent = err.message; errEl.style.display = 'block';
    } finally {
      btn.disabled = false; btn.textContent = 'Submit Brief';
    }
  });
}
