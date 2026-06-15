// Google Drive access via the same OAuth client used for Gmail, authorized
// separately with the drive.readonly scope. Run scripts/driveAuth.js once to
// populate GOOGLE_DRIVE_REFRESH_TOKEN.

const { google } = require('googleapis');

const REDIRECT_URI = 'http://localhost';

function getDriveAuthClient() {
  const { GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GOOGLE_DRIVE_REFRESH_TOKEN } = process.env;
  if (!GMAIL_CLIENT_ID || !GMAIL_CLIENT_SECRET || !GOOGLE_DRIVE_REFRESH_TOKEN) {
    throw new Error('Google Drive credentials not configured. Run `node scripts/driveAuth.js` and set GOOGLE_DRIVE_REFRESH_TOKEN.');
  }
  const oauth2Client = new google.auth.OAuth2(GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, REDIRECT_URI);
  oauth2Client.setCredentials({ refresh_token: GOOGLE_DRIVE_REFRESH_TOKEN });
  return oauth2Client;
}

module.exports = { getDriveAuthClient };
