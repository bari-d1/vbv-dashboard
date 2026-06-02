const express = require('express');
const { spawn } = require('child_process');
const { google } = require('googleapis');
const multer = require('multer');
const { randomUUID } = require('crypto');
const fs = require('fs');
const path = require('path');

const router = express.Router();

const AUDIO_DIR = '/tmp/vbv-audio';
const ALLOWED_EXTS = ['.mp3', '.mp4', '.wav', '.m4a', '.mov'];
const CREDENTIALS_PATH = path.resolve(__dirname, '../../credentials/google-drive.json');

function ensureDir() {
  if (!fs.existsSync(AUDIO_DIR)) fs.mkdirSync(AUDIO_DIR, { recursive: true });
}

function extractDriveFileId(driveUrl) {
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

function ingestYoutube(url) {
  return new Promise((resolve, reject) => {
    ensureDir();
    const outputPath = path.join(AUDIO_DIR, `yt-${randomUUID()}.mp3`);

    const ytdlp = spawn('yt-dlp', [
      '--extract-audio', '--audio-format', 'mp3', '--audio-quality', '0',
      '--no-playlist', '-o', outputPath, url,
    ]);

    let stderr = '';
    ytdlp.stderr.on('data', (chunk) => { stderr += chunk; });

    ytdlp.on('error', (err) => {
      if (err.code === 'ENOENT') {
        reject(new Error('yt-dlp is not installed. Install it with: brew install yt-dlp (macOS) or pip install yt-dlp'));
      } else {
        reject(err);
      }
    });

    ytdlp.on('close', (code) => {
      if (code !== 0) reject(new Error(stderr.trim() || 'yt-dlp failed'));
      else resolve(outputPath);
    });
  });
}

async function ingestDrive(driveUrl) {
  const fileId = extractDriveFileId(driveUrl);
  if (!fileId) throw new Error('Could not extract file ID from Drive URL');

  if (!fs.existsSync(CREDENTIALS_PATH)) {
    throw new Error(`Google Drive credentials not found. Place your service account JSON at: ${CREDENTIALS_PATH}`);
  }

  ensureDir();

  const auth = new google.auth.GoogleAuth({
    keyFile: CREDENTIALS_PATH,
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
  });
  const drive = google.drive({ version: 'v3', auth });

  const meta = await drive.files.get({ fileId, fields: 'name' });
  const ext = path.extname(meta.data.name || '') || '.mp4';
  const outputPath = path.join(AUDIO_DIR, `drive-${randomUUID()}${ext}`);

  const response = await drive.files.get({ fileId, alt: 'media' }, { responseType: 'stream' });
  const dest = fs.createWriteStream(outputPath);

  await new Promise((resolve, reject) => {
    response.data.pipe(dest);
    response.data.on('error', reject);
    dest.on('finish', resolve);
    dest.on('error', reject);
  });

  return outputPath;
}

// Multer for the /route endpoint when sourceType=upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => { ensureDir(); cb(null, AUDIO_DIR); },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `upload-${randomUUID()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    ALLOWED_EXTS.includes(ext)
      ? cb(null, true)
      : cb(new Error(`Unsupported file type: ${ext}. Allowed: ${ALLOWED_EXTS.join(', ')}`));
  },
});

router.post('/', upload.single('audioFile'), async (req, res) => {
  const { sourceType, url, driveUrl } = req.body;

  if (!sourceType) {
    return res.status(400).json({ success: false, error: 'sourceType is required (youtube, drive, or upload)' });
  }

  try {
    let audioPath;

    if (sourceType === 'youtube') {
      if (!url) return res.status(400).json({ success: false, error: 'url is required for sourceType=youtube' });
      audioPath = await ingestYoutube(url);

    } else if (sourceType === 'drive') {
      if (!driveUrl) return res.status(400).json({ success: false, error: 'driveUrl is required for sourceType=drive' });
      audioPath = await ingestDrive(driveUrl);

    } else if (sourceType === 'upload') {
      if (!req.file) return res.status(400).json({ success: false, error: 'No file uploaded. Field name must be "audioFile".' });
      audioPath = req.file.path;

    } else {
      return res.status(400).json({ success: false, error: `Unknown sourceType: ${sourceType}. Must be youtube, drive, or upload.` });
    }

    res.json({ success: true, audioPath, sourceType });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
