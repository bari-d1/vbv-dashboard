// One-time OAuth setup for Gmail inbound reply capture.
// Run with: node scripts/gmailAuth.js
// Requires GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET to already be set in .env
// (create an OAuth 2.0 "Desktop app" client in Google Cloud Console for these).

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const fs = require('fs');
const readline = require('readline');
const { google } = require('googleapis');

const ENV_PATH = path.join(__dirname, '..', '.env');

// "Desktop app" OAuth clients can use this loopback redirect without running a local server —
// Google redirects to a page that won't load, but the code is visible in its URL's query string.
const REDIRECT_URI = 'http://localhost';
const SCOPES = ['https://www.googleapis.com/auth/gmail.modify'];

function prompt(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (answer) => {
    rl.close();
    resolve(answer.trim());
  }));
}

// Adds or replaces a KEY=value line in .env, leaving every other line untouched.
function upsertEnvVar(key, value) {
  const lines = fs.existsSync(ENV_PATH) ? fs.readFileSync(ENV_PATH, 'utf8').split('\n') : [];
  const lineIndex = lines.findIndex((line) => line.startsWith(`${key}=`));
  const entry = `${key}=${value}`;
  if (lineIndex >= 0) lines[lineIndex] = entry;
  else lines.push(entry);
  fs.writeFileSync(ENV_PATH, lines.join('\n'));
}

async function main() {
  const { GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET } = process.env;
  if (!GMAIL_CLIENT_ID || !GMAIL_CLIENT_SECRET) {
    console.error('Set GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET in .env before running this script.');
    process.exit(1);
  }

  const oauth2Client = new google.auth.OAuth2(GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, REDIRECT_URI);

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent', // forces Google to issue a refresh token even if this account authorized before
    scope: SCOPES,
  });

  console.log('\n1. Open this URL and grant access to the inbox:\n');
  console.log(authUrl);
  console.log('\n2. Google will redirect to a page at http://localhost/?code=... that fails to load.');
  console.log('   That\'s expected — copy the value of the "code" parameter from the browser\'s address bar.\n');

  const code = await prompt('Paste the authorization code here: ');
  if (!code) {
    console.error('No code entered — aborting.');
    process.exit(1);
  }

  const { tokens } = await oauth2Client.getToken(code);
  if (!tokens.refresh_token) {
    console.error('\nGoogle did not return a refresh token. Revoke this app\'s access at');
    console.error('https://myaccount.google.com/permissions and re-run this script so a fresh one is issued.');
    process.exit(1);
  }

  upsertEnvVar('GMAIL_REFRESH_TOKEN', tokens.refresh_token);
  console.log('\nSaved GMAIL_REFRESH_TOKEN to .env — the Gmail poller can now authenticate on its own.');
}

main().catch((err) => {
  console.error('Gmail auth setup failed:', err.message);
  process.exit(1);
});
