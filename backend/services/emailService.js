const { Resend } = require('resend');
const prisma = require('../db');

const FROM = 'VBV Edits <info@versebyverse.studio>';
const REPLY_TO = 'versebyversestudio@gmail.com';

const BRAND = {
  background: '#0a0a0a',
  accent: '#e20415',
  text: '#cccccc',
  font: "'Space Mono', 'Courier New', monospace",
};

function getClient() {
  return new Resend(process.env.RESEND_API_KEY);
}

// Replaces {variableName} placeholders with values from `vars`; leaves unmatched placeholders untouched.
function fillTemplate(str, vars = {}) {
  return String(str).replace(/\{(\w+)\}/g, (match, key) => (
    Object.prototype.hasOwnProperty.call(vars, key) ? String(vars[key]) : match
  ));
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Wraps plain-text body copy in the branded VBV Edits HTML shell (header wordmark + footer signature).
function brandedEmailShell(bodyText) {
  const paragraphs = escapeHtml(bodyText)
    .split(/\n{2,}/)
    .map((block) => `<p style="margin: 0 0 16px; white-space: pre-line;">${block}</p>`)
    .join('');

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <link href="https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&display=swap" rel="stylesheet" />
  </head>
  <body style="margin: 0; padding: 0; background-color: ${BRAND.background};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: ${BRAND.background};">
      <tr>
        <td align="center" style="padding: 32px 16px;">
          <table role="presentation" width="100%" style="max-width: 560px;" cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding-bottom: 24px; border-bottom: 1px solid #222222;">
                <span style="font-family: ${BRAND.font}; font-size: 20px; font-weight: 700; letter-spacing: 1px; color: ${BRAND.accent};">VBV EDITS</span>
              </td>
            </tr>
            <tr>
              <td style="padding: 32px 0; font-family: ${BRAND.font}; font-size: 15px; line-height: 1.6; color: ${BRAND.text};">
                ${paragraphs}
              </td>
            </tr>
            <tr>
              <td style="padding-top: 24px; border-top: 1px solid #222222; font-family: ${BRAND.font}; font-size: 13px; color: ${BRAND.text};">
                <p style="margin: 0 0 4px;">Dayo Adebari</p>
                <p style="margin: 0; color: ${BRAND.accent};">VBV Edits</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

// Looks up the matching VbvLead/VbvClient by recipient email so the log row links to the right record.
async function logSentEmail({ to, subject, html, linkTo }) {
  const data = { direction: 'SENT', subject, body: html, sentAt: new Date() };

  if (linkTo === 'lead') {
    const lead = await prisma.vbvLead.findUnique({ where: { email: to } });
    if (lead) data.leadId = lead.id;
  } else if (linkTo === 'client') {
    const client = await prisma.vbvClient.findUnique({ where: { email: to } });
    if (client) data.clientId = client.id;
  }

  await prisma.vbvEmailLog.create({ data });
}

/**
 * Sends an outreach email built from a template, substituting {variableName} placeholders with `vars`.
 * `subject` also goes through substitution and defaults to a generic line, since Resend requires one
 * but the outreach templates only define HTML bodies.
 */
async function sendOutreachEmail(to, templateHtml, vars = {}, subject = 'A note from VBV Edits') {
  const html = fillTemplate(templateHtml, vars);
  const filledSubject = fillTemplate(subject, vars);

  const response = await getClient().emails.send({
    from: FROM,
    to,
    replyTo: REPLY_TO,
    subject: filledSubject,
    html,
  });

  await logSentEmail({ to, subject: filledSubject, html, linkTo: 'lead' });

  return response;
}

// Sends a plain-text message wrapped in the branded VBV Edits HTML shell.
async function sendClientEmail(to, subject, bodyText) {
  const html = brandedEmailShell(bodyText);

  const response = await getClient().emails.send({
    from: FROM,
    to,
    replyTo: REPLY_TO,
    subject,
    html,
  });

  await logSentEmail({ to, subject, html, linkTo: 'client' });

  return response;
}

module.exports = { sendOutreachEmail, sendClientEmail };
