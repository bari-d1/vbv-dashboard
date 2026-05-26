async function vbvRenderSocialDashboard() {
  return `
    <h1>Create Brief</h1>
    <div class="vbv-section">
      <div class="vbv-brief-toggle" id="vbv-brief-toggle">
        <button class="active" data-type="timestamp_clip">Timestamp Clip</button>
        <button data-type="full_edit">Full Edit</button>
      </div>
      <div id="vbv-brief-error" class="vbv-alert vbv-alert-error" style="display:none;"></div>
      <div id="vbv-brief-success" class="vbv-alert vbv-alert-info" style="display:none;"></div>
      <form id="vbv-brief-form">
        <div class="vbv-form-group">
          <label>Job Title *</label>
          <input type="text" id="vbv-brief-title" required placeholder="Easter Sunday Reel – Jordan feat. Mercy">
        </div>
        <div class="vbv-form-group">
          <label>Artist Name *</label>
          <input type="text" id="vbv-brief-artist" required placeholder="Jordan feat. Mercy">
        </div>
        <div class="vbv-form-group">
          <label>Google Drive Link *</label>
          <input type="url" id="vbv-brief-drive" required placeholder="https://drive.google.com/...">
        </div>

        <div id="vbv-clip-fields">
          <div class="vbv-form-group">
            <label>Start Timestamp (HH:MM:SS)</label>
            <input type="text" id="vbv-brief-start" placeholder="00:01:23">
          </div>
          <div class="vbv-form-group">
            <label>End Timestamp (HH:MM:SS)</label>
            <input type="text" id="vbv-brief-end" placeholder="00:02:45">
          </div>
          <div class="vbv-form-group">
            <label>Clip Notes</label>
            <textarea id="vbv-brief-clipnotes" placeholder="Any specific moments to highlight…"></textarea>
          </div>
        </div>

        <div id="vbv-edit-fields" style="display:none;">
          <div class="vbv-form-group">
            <label>Edit Instructions</label>
            <textarea id="vbv-brief-instructions" placeholder="Full edit brief — style, transitions, text overlays…" style="min-height:120px;"></textarea>
          </div>
        </div>

        <div class="vbv-form-group">
          <label>Platform Target *</label>
          <div class="vbv-checkboxes">
            <label><input type="checkbox" name="platform" value="Instagram"> Instagram</label>
            <label><input type="checkbox" name="platform" value="TikTok"> TikTok</label>
            <label><input type="checkbox" name="platform" value="YouTube"> YouTube</label>
          </div>
        </div>
        <div class="vbv-form-group">
          <label>Deadline *</label>
          <input type="date" id="vbv-brief-deadline" required>
        </div>
        <button type="submit" class="vbv-btn vbv-btn-primary">Submit Brief</button>
      </form>
    </div>`;
}

async function vbvRenderMyBriefs() {
  let jobs = [];
  try { jobs = await vbvApi('GET', '/vbv/jobs/mine'); } catch(e) { /* show empty */ }

  const rows = jobs.map(j => `
    <tr>
      <td>${escapeHtml(j.title)}</td>
      <td>${escapeHtml(j.artistName)}</td>
      <td>${vbvStatusBadge(j.briefType)}</td>
      <td>${new Date(j.deadline).toLocaleDateString('en-GB')}</td>
      <td>${vbvStatusBadge(j.status)}</td>
      <td>${j.assignedTo?.name ? escapeHtml(j.assignedTo.name) : '—'}</td>
    </tr>`).join('') || '<tr><td colspan="6"><div class="vbv-empty">No briefs created yet.</div></td></tr>';

  return `
    <h1>My Briefs</h1>
    <div class="vbv-table-wrap">
      <table class="vbv-table">
        <thead><tr><th>Title</th><th>Artist</th><th>Type</th><th>Deadline</th><th>Status</th><th>Assigned To</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

function vbvBindSocialDashboard() {
  let briefType = 'timestamp_clip';

  document.querySelectorAll('#vbv-brief-toggle button').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#vbv-brief-toggle button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      briefType = btn.dataset.type;
      document.getElementById('vbv-clip-fields').style.display = briefType === 'timestamp_clip' ? '' : 'none';
      document.getElementById('vbv-edit-fields').style.display = briefType === 'full_edit' ? '' : 'none';
    });
  });

  const form = document.getElementById('vbv-brief-form');
  if (!form) return;
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const errEl = document.getElementById('vbv-brief-error');
    const sucEl = document.getElementById('vbv-brief-success');
    errEl.style.display = 'none'; sucEl.style.display = 'none';

    const platforms = [...document.querySelectorAll('input[name="platform"]:checked')].map(c => c.value);
    if (!platforms.length) { errEl.textContent = 'Select at least one platform.'; errEl.style.display='block'; return; }

    const body = {
      title: document.getElementById('vbv-brief-title').value.trim(),
      artistName: document.getElementById('vbv-brief-artist').value.trim(),
      briefType,
      sourceDriveLink: document.getElementById('vbv-brief-drive').value.trim(),
      platformTargets: platforms,
      deadline: document.getElementById('vbv-brief-deadline').value,
    };

    if (briefType === 'timestamp_clip') {
      body.startTimestamp = document.getElementById('vbv-brief-start').value || null;
      body.endTimestamp = document.getElementById('vbv-brief-end').value || null;
      body.clipNotes = document.getElementById('vbv-brief-clipnotes').value || null;
    } else {
      body.editInstructions = document.getElementById('vbv-brief-instructions').value || null;
    }

    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true; btn.textContent = 'Submitting…';
    try {
      await vbvApi('POST', '/vbv/jobs', body);
      sucEl.textContent = 'Brief submitted successfully!'; sucEl.style.display = 'block';
      form.reset();
      document.querySelectorAll('#vbv-brief-toggle button').forEach(b => b.classList.remove('active'));
      document.querySelector('#vbv-brief-toggle button').classList.add('active');
      briefType = 'timestamp_clip';
      document.getElementById('vbv-clip-fields').style.display = '';
      document.getElementById('vbv-edit-fields').style.display = 'none';
      setTimeout(() => vbvNavigate('my-briefs'), 1500);
    } catch(err) {
      errEl.textContent = err.message; errEl.style.display = 'block';
    } finally {
      btn.disabled = false; btn.textContent = 'Submit Brief';
    }
  });
}
