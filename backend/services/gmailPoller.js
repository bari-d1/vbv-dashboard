const { google } = require('googleapis');
const prisma = require('../db');

const POLL_INTERVAL_MS = 5 * 60 * 1000;
const SCOPES = ['https://www.googleapis.com/auth/gmail.modify'];

// Tracks the start of the previous poll cycle so each run only fetches mail that's newly arrived.
let lastPolledAt = new Date(Date.now() - POLL_INTERVAL_MS);

function getGmailClient() {
  const { GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN } = process.env;
  const oauth2Client = new google.auth.OAuth2(GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET);
  oauth2Client.setCredentials({ refresh_token: GMAIL_REFRESH_TOKEN, scope: SCOPES.join(' ') });
  return google.gmail({ version: 'v1', auth: oauth2Client });
}

function getHeader(headers, name) {
  return headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value || '';
}

function parseSenderEmail(fromHeader) {
  const match = fromHeader.match(/<([^>]+)>/);
  return (match ? match[1] : fromHeader).trim().toLowerCase();
}

// Walks the MIME tree depth-first and returns the first text/plain part it finds.
function extractPlainTextBody(payload) {
  if (!payload) return '';
  if (payload.mimeType === 'text/plain' && payload.body?.data) {
    return Buffer.from(payload.body.data, 'base64url').toString('utf8');
  }
  for (const part of payload.parts || []) {
    const text = extractPlainTextBody(part);
    if (text) return text;
  }
  return '';
}

function resolveSentAt(headers, internalDate) {
  const parsed = new Date(getHeader(headers, 'Date'));
  if (!isNaN(parsed.getTime())) return parsed;
  return new Date(Number(internalDate));
}

async function processMessage(gmail, messageId) {
  // Skip messages we've already logged — guards against double-processing across poll cycles.
  const alreadyLogged = await prisma.vbvEmailLog.findUnique({ where: { gmailMessageId: messageId } });
  if (alreadyLogged) return;

  const { data: message } = await gmail.users.messages.get({ userId: 'me', id: messageId, format: 'full' });
  const headers = message.payload?.headers || [];

  const senderEmail = parseSenderEmail(getHeader(headers, 'From'));
  const subject = getHeader(headers, 'Subject');
  const body = extractPlainTextBody(message.payload);
  const sentAt = resolveSentAt(headers, message.internalDate);

  const lead = senderEmail
    ? await prisma.vbvLead.findUnique({ where: { email: senderEmail } })
    : null;

  await prisma.vbvEmailLog.create({
    data: {
      direction: 'RECEIVED',
      subject: subject || null,
      body,
      sentAt,
      gmailMessageId: messageId,
      leadId: lead?.id,
    },
  });

  await gmail.users.messages.modify({
    userId: 'me',
    id: messageId,
    requestBody: { removeLabelIds: ['UNREAD'] },
  });
}

async function poll() {
  const { GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN } = process.env;
  if (!GMAIL_CLIENT_ID || !GMAIL_CLIENT_SECRET || !GMAIL_REFRESH_TOKEN) {
    console.warn('[GmailPoller] GMAIL_CLIENT_ID/GMAIL_CLIENT_SECRET/GMAIL_REFRESH_TOKEN not set — skipping poll. Run scripts/gmailAuth.js to configure.');
    return;
  }

  const since = lastPolledAt;
  lastPolledAt = new Date();

  try {
    const gmail = getGmailClient();
    const { data } = await gmail.users.messages.list({
      userId: 'me',
      q: `is:unread after:${Math.floor(since.getTime() / 1000)}`,
    });

    for (const { id } of data.messages || []) {
      try {
        await processMessage(gmail, id);
      } catch (err) {
        console.error(`[GmailPoller] Failed to process message ${id}:`, err.message);
      }
    }
  } catch (err) {
    console.error('[GmailPoller] Poll failed:', err.message);
  }
}

function startGmailPoller() {
  poll();
  setInterval(poll, POLL_INTERVAL_MS);
  console.log('[GmailPoller] Started — polling Gmail inbox every 5 minutes.');
}

module.exports = { startGmailPoller };
