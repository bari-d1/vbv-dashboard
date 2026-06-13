async function vbvRenderJobPool() {
  let jobs = [];
  let atCap = false;
  const user = vbvCurrentUser();

  try {
    jobs = await vbvApi('GET', '/vbv/jobs/pool');
    if (user.role === 'lead_editor') {
      const mine = await vbvApi('GET', '/vbv/jobs/assigned');
      const active = mine.filter(j => ['in_progress','submitted'].includes(j.status));
      atCap = active.length >= 5;
    }
  } catch(e) { return `<div class="vbv-alert vbv-alert-error">${e.message}</div>`; }

  if (!jobs.length) {
    return `<h1>Job Pool</h1><div class="vbv-empty">No open jobs available right now.</div>`;
  }

  const cards = jobs.map(job => {
    const claimBtn = (user.role === 'lead_editor')
      ? `<button class="vbv-btn vbv-btn-primary vbv-btn-sm vbv-claim-btn" data-job-id="${job.id}" ${atCap ? 'disabled' : ''}>
           ${atCap ? 'At 5-job cap' : 'Claim Job'}
         </button>`
      : '';
    return vbvJobCardHTML(job, { actions: claimBtn });
  }).join('');

  return `
    <h1>Job Pool</h1>
    ${atCap ? `<div class="vbv-alert vbv-alert-warning">You have 5 active jobs. Submit or complete some before claiming more.</div>` : ''}
    <div id="vbv-pool-msg"></div>
    <div>${cards}</div>`;
}

function vbvBindJobPool() {
  document.querySelectorAll('.vbv-claim-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const jobId = btn.dataset.jobId;
      const msgEl = document.getElementById('vbv-pool-msg');
      btn.disabled = true; btn.textContent = 'Claiming…';
      try {
        await vbvApi('POST', `/vbv/jobs/${jobId}/claim`);
        vbvNavigate('editor-dashboard');
      } catch(err) {
        if (msgEl) { msgEl.innerHTML = `<div class="vbv-alert vbv-alert-error">${err.message}</div>`; }
        btn.disabled = false; btn.textContent = 'Claim Job';
      }
    });
  });
}
