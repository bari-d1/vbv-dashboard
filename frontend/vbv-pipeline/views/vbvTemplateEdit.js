async function vbvRenderTemplateEdit() {
  const isNew = !vbvTemplateEditingId;
  let template = { name: '', subject: '', bodyHtml: '' };

  if (!isNew) {
    try { template = await vbvApi('GET', `/api/templates/${vbvTemplateEditingId}`); }
    catch(e) { return `<div class="vbv-alert vbv-alert-error">${e.message}</div>`; }
  }

  return `
    <button class="vbv-btn vbv-btn-secondary vbv-btn-sm" id="vbv-template-back-btn" style="margin-bottom:16px;">&larr; Back to Templates</button>
    <h1>${isNew ? 'New Template' : 'Edit Template'}</h1>
    <div id="vbv-template-edit-error" class="vbv-alert vbv-alert-error" style="display:none;margin:16px 0;"></div>
    <div class="vbv-template-editor">
      <div class="vbv-template-editor-form">
        <div class="vbv-form-group">
          <label>Name *</label>
          <input type="text" id="vbv-template-name" value="${escapeHtml(template.name)}">
        </div>
        <div class="vbv-form-group">
          <label>Subject *</label>
          <input type="text" id="vbv-template-subject" value="${escapeHtml(template.subject)}">
        </div>
        <div class="vbv-form-group">
          <label>Body (HTML) *</label>
          <textarea id="vbv-template-body" style="min-height:440px;font-family:monospace;font-size:0.82rem;line-height:1.5;">${escapeHtml(template.bodyHtml)}</textarea>
        </div>
        <div style="display:flex;gap:10px;">
          <button class="vbv-btn vbv-btn-secondary" id="vbv-template-cancel-btn">Cancel</button>
          <button class="vbv-btn vbv-btn-primary" id="vbv-template-save-btn">${isNew ? 'Create Template' : 'Save Changes'}</button>
        </div>
      </div>
      <div class="vbv-template-editor-preview">
        <label>Live Preview</label>
        <iframe id="vbv-template-edit-preview" sandbox="" title="Template preview" style="width:100%;height:480px;border:1px solid var(--border);border-radius:8px;background:#fff;"></iframe>
      </div>
    </div>`;
}

function vbvBindTemplateEdit() {
  const isNew = !vbvTemplateEditingId;

  document.getElementById('vbv-template-back-btn')?.addEventListener('click', () => vbvNavigate('templates'));
  document.getElementById('vbv-template-cancel-btn')?.addEventListener('click', () => vbvNavigate('templates'));

  const bodyInput = document.getElementById('vbv-template-body');
  const preview = document.getElementById('vbv-template-edit-preview');

  function updatePreview() { preview.srcdoc = bodyInput.value; }
  updatePreview();
  bodyInput.addEventListener('input', updatePreview);

  document.getElementById('vbv-template-save-btn')?.addEventListener('click', async () => {
    const errEl = document.getElementById('vbv-template-edit-error');
    errEl.style.display = 'none';

    const name = document.getElementById('vbv-template-name').value.trim();
    const subject = document.getElementById('vbv-template-subject').value.trim();
    const bodyHtml = bodyInput.value;
    if (!name || !subject || !bodyHtml.trim()) {
      errEl.textContent = 'Name, subject, and body are required.';
      errEl.style.display = 'block';
      return;
    }

    const btn = document.getElementById('vbv-template-save-btn');
    btn.disabled = true; btn.textContent = 'Saving…';
    try {
      if (isNew) {
        const created = await vbvApi('POST', '/api/templates', { name, subject, bodyHtml });
        vbvTemplateEditingId = created.id;
      } else {
        await vbvApi('PATCH', `/api/templates/${vbvTemplateEditingId}`, { name, subject, bodyHtml });
      }
      vbvNavigate('templates');
    } catch(err) {
      errEl.textContent = err.message; errEl.style.display = 'block';
      btn.disabled = false; btn.textContent = isNew ? 'Create Template' : 'Save Changes';
    }
  });
}
