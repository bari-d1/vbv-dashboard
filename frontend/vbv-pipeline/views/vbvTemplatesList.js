// Shared editor state — null means "create new"; set before navigating to the edit view.
let vbvTemplateEditingId = null;

async function vbvRenderTemplatesList() {
  let templates = [];
  try { templates = await vbvApi('GET', '/api/templates'); } catch(e) {
    return `<div class="vbv-alert vbv-alert-error">${e.message}</div>`;
  }

  const rows = templates.map(t => `
    <tr>
      <td>${escapeHtml(t.name)}</td>
      <td>${escapeHtml(t.subject)}</td>
      <td>${new Date(t.updatedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
      <td><button class="vbv-btn vbv-btn-secondary vbv-btn-sm vbv-template-edit-btn" data-template-id="${t.id}">Edit</button></td>
    </tr>`).join('') || '<tr><td colspan="4"><div class="vbv-empty">No templates yet.</div></td></tr>';

  return `
    <div class="vbv-section-header">
      <h1>Templates</h1>
      <button class="vbv-btn vbv-btn-primary" id="vbv-new-template-btn">New Template</button>
    </div>
    <div class="vbv-section">
      <div class="vbv-table-wrap">
        <table class="vbv-table">
          <thead><tr>
            <th>Template Name</th><th>Subject</th><th>Last Updated</th><th></th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>`;
}

function vbvBindTemplatesList() {
  document.getElementById('vbv-new-template-btn')?.addEventListener('click', () => {
    vbvTemplateEditingId = null;
    vbvNavigate('template-edit');
  });

  document.querySelectorAll('.vbv-template-edit-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      vbvTemplateEditingId = btn.dataset.templateId;
      vbvNavigate('template-edit');
    });
  });
}
