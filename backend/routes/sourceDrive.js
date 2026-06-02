const express = require('express');
const { google } = require('googleapis');
const { randomUUID } = require('crypto');
const fs = require('fs');
const path = require('path');

const router = express.Router();

const AUDIO_DIR = '/tmp/vbv-audio';
// Place your Google Drive API service account key at this path:
const CREDENTIALS_PATH = path.resolve(__dirname, '../../credentials/google-drive.json');

function ensureDir() {
  if (!fs.existsSync(AUDIO_DIR)) fs.mkdirSync(AUDIO_DIR, { recursive: true });
}

function extractFileId(driveUrl) {
  const patterns = [
    /\/file\/d\/([a-zA-Z0-9_-]+)/,
    /[?&]id=([a-zA-Z0-9_-]+)/,
    /\/open\?id=([a-zA-Z0-9_-]+)/,
  ];
  for (const re of patterns) {
    const m = driveUrl.match(re);
    if (m) return m[1];
  }
  return null;
}

function getAuthClient() {
  if (!fs.existsSync(CREDENTIALS_PATH)) {
    throw new Error(
      `Google Drive credentials not found. Place your service account JSON at: ${CREDENTIALS_PATH}`
    );
  }
  return new google.auth.GoogleAuth({
    keyFile: CREDENTIALS_PATH,
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
  });
}

router.post('/', async (req, res) => {
  const { driveUrl } = req.body;

  if (!driveUrl || typeof driveUrl !== 'string') {
    return res.status(400).json({ success: false, error: 'driveUrl is required' });
  }

  const fileId = extractFileId(driveUrl);
  if (!fileId) {
    return res.status(400).json({ success: false, error: 'Could not extract file ID from Drive URL' });
  }

  ensureDir();

  let auth;
  try {
    auth = getAuthClient();
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }

  try {
    const drive = google.drive({ version: 'v3', auth });

    // Get filename and mime type
    const meta = await drive.files.get({ fileId, fields: 'name,mimeType' });
    const originalName = meta.data.name || 'audio';
    const ext = path.extname(originalName) || '.mp4';
    const filename = `drive-${randomUUID()}${ext}`;
    const outputPath = path.join(AUDIO_DIR, filename);

    const response = await drive.files.get(
      { fileId, alt: 'media' },
      { responseType: 'stream' }
    );

    const dest = fs.createWriteStream(outputPath);
    await new Promise((resolve, reject) => {
      response.data.pipe(dest);
      response.data.on('error', reject);
      dest.on('finish', resolve);
      dest.on('error', reject);
    });

    res.json({ success: true, audioPath: outputPath });
  } catch (err) {
    const message = err.response?.data?.error?.message || err.message;
    const status = err.response?.status;

    if (status === 403 || status === 404) {
      return res.status(400).json({
        success: false,
        error: `Drive file is not accessible (${status}). Ensure the file is shared with the service account or set to "Anyone with the link".`,
      });
    }

    res.status(500).json({ success: false, error: message });
  }
});

module.exports = router;
