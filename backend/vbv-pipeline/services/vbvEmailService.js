const { Resend } = require('resend');

function getClient() {
  return new Resend(process.env.RESEND_API_KEY);
}

async function sendWelcomeEmail({ name, email, role, password }) {
  const dashboardUrl = process.env.VBV_DASHBOARD_URL || 'http://localhost:3001/vbv.html';
  await getClient().emails.send({
    from: process.env.EMAIL_FROM,
    to: email,
    subject: 'Your VBV Dashboard Login Details',
    html: `
      <h2>Welcome to the VBV Creative Pipeline, ${name}!</h2>
      <p><strong>Role:</strong> ${role.replace('_', ' ')}</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Password:</strong> ${password}</p>
      <p><a href="${dashboardUrl}">Open Dashboard</a></p>
    `,
  });
}

async function sendReviewNotification({ editorEmail, editorName, jobTitle, action, reviewNote }) {
  const dashboardUrl = process.env.VBV_DASHBOARD_URL || 'http://localhost:3001/vbv-pipeline/vbv.html';
  const label = action === 'lead_approved' ? 'Approved by Lead Editor — awaiting Social Media review' : 'Sent Back by Lead Editor';
  await getClient().emails.send({
    from: process.env.EMAIL_FROM,
    to: editorEmail,
    subject: `Update on your edit: ${jobTitle}`,
    html: `
      <h2>Hi ${editorName},</h2>
      <p>Your edit for <strong>${jobTitle}</strong> has been reviewed by the Lead Editor.</p>
      <p><strong>Decision:</strong> ${label}</p>
      ${reviewNote ? `<p><strong>Note:</strong> ${reviewNote}</p>` : ''}
      <p><a href="${dashboardUrl}">View in Dashboard</a></p>
    `,
  });
}

async function sendSmCorrectionEmail({ jobTitle, editor, leadEditors, smNote }) {
  const dashboardUrl = process.env.VBV_DASHBOARD_URL || 'http://localhost:3001/vbv-pipeline/vbv.html';
  await getClient().emails.send({
    from: process.env.EMAIL_FROM,
    to: editor?.email,
    cc: leadEditors.map(le => le.email),
    subject: `Correction requested: ${jobTitle}`,
    html: `
      <h2>Hi ${editor?.name},</h2>
      <p>A correction has been requested on <strong>${jobTitle}</strong>.</p>
      <p><strong>Correction note:</strong> ${smNote}</p>
      <p>Please revise your edit and resubmit for Lead Editor review.</p>
      <p><a href="${dashboardUrl}">View in Dashboard</a></p>
    `,
  });
}

async function sendAssignmentEmail({ editorEmail, editorName, jobTitle, assignedBy }) {
  const dashboardUrl = process.env.VBV_DASHBOARD_URL || 'http://localhost:3001/vbv-pipeline/vbv.html';
  await getClient().emails.send({
    from: process.env.EMAIL_FROM,
    to: editorEmail,
    subject: `You've been assigned a job: ${jobTitle}`,
    html: `
      <h2>Hi ${editorName},</h2>
      <p>You have been assigned a new edit job by <strong>${assignedBy}</strong>.</p>
      <p><strong>Job:</strong> ${jobTitle}</p>
      <p>Please log in to accept or view the details.</p>
      <p><a href="${dashboardUrl}">Open Dashboard</a></p>
    `,
  });
}

async function sendSmApprovalEmail({ jobTitle, editor, leadEditors }) {
  const dashboardUrl = process.env.VBV_DASHBOARD_URL || 'http://localhost:3001/vbv-pipeline/vbv.html';
  const allRecipients = [editor?.email, ...leadEditors.map(le => le.email)].filter(Boolean);
  await getClient().emails.send({
    from: process.env.EMAIL_FROM,
    to: allRecipients,
    subject: `Edit approved: ${jobTitle}`,
    html: `
      <h2>Pipeline complete ✓</h2>
      <p>The edit for <strong>${jobTitle}</strong> has been approved.</p>
      <p>This job is now complete.</p>
      <p><a href="${dashboardUrl}">View in Dashboard</a></p>
    `,
  });
}

module.exports = { sendWelcomeEmail, sendAssignmentEmail, sendReviewNotification, sendSmCorrectionEmail, sendSmApprovalEmail };
