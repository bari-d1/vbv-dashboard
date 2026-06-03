const express = require('express');
const { spawn } = require('child_process');
const { google } = require('googleapis');
const multer = require('multer');
const { randomUUID } = require('crypto');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const axios = require('axios');
const { detectCandidates } = require('./detect');

const router = express.Router();

const AUDIO_DIR = '/tmp/vbv-audio';
const CANDIDATES_DIR = path.resolve(__dirname, '../../data/candidates');
const CREDENTIALS_PATH = path.resolve(__dirname, '../../credentials/google-drive.json');
const HETZNER_URL = 'http://5.78.235.93:5000/transcribe';
const HETZNER_STATUS_URL = 'http://5.78.235.93:5000/status';
const ALLOWED_EXTS = ['.mp3', '.mp4', '.wav', '.m4a', '.mov'];

// In-memory job store — survives requests, cleared on server restart
const jobs = new Map();

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// ── Ingestion ───────────────────────────────────────────────────────────────

function ytdlpFriendlyError(stderr) {
  const s = stderr.toLowerCase();
  if (s.includes('sign in') || s.includes('not a bot') || s.includes('confirm your age') || s.includes('cookies')) {
    return 'YouTube is blocking the download — your cookies have expired or are missing. Re-export your YouTube cookies from Chrome and update the YT_COOKIES environment variable in Render, then redeploy.';
  }
  if (s.includes('video unavailable') || s.includes('private video')) {
    return 'This YouTube video is unavailable or private.';
  }
  if (s.includes('no such format') || s.includes('requested format')) {
    return 'Could not find a downloadable audio format for this video.';
  }
  return stderr.trim() || 'yt-dlp failed';
}

function ingestYoutube(url) {
  return new Promise((resolve, reject) => {
    ensureDir(AUDIO_DIR);
    const baseName = `yt-${randomUUID()}`;
    const outputTemplate = path.join(AUDIO_DIR, `${baseName}.%(ext)s`);
    const cookiesPath = '/tmp/yt-cookies.txt';
    if (process.env.YT_COOKIES && !fs.existsSync(cookiesPath)) {
      fs.writeFileSync(cookiesPath, process.env.YT_COOKIES);
    }
    const cookiesExist = fs.existsSync(cookiesPath);
    console.log(`[yt-dlp] cookies file present: ${cookiesExist}, YT_COOKIES env set: ${!!process.env.YT_COOKIES}`);
    const cookiesArgs = cookiesExist ? ['--cookies', cookiesPath] : [];
    const ytdlp = spawn('yt-dlp', [
      '-f', 'bestaudio[ext=m4a]/bestaudio',
      '--no-playlist', '--js-runtimes', 'node',
      ...cookiesArgs,
      '-o', outputTemplate, url,
    ]);
    let stderr = '';
    ytdlp.stderr.on('data', (c) => { stderr += c; });
    ytdlp.on('error', (err) => {
      reject(err.code === 'ENOENT'
        ? new Error('yt-dlp is not installed on this server.')
        : err);
    });
    ytdlp.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(ytdlpFriendlyError(stderr)));
        return;
      }
      const files = fs.readdirSync(AUDIO_DIR).filter(f => f.startsWith(baseName));
      if (!files.length) { reject(new Error('yt-dlp finished but output file was not found.')); return; }
      resolve(path.join(AUDIO_DIR, files[0]));
    });
  });
}

function extractDriveFileId(driveUrl) {
  for (const re of [/\/file\/d\/([a-zA-Z0-9_-]+)/, /[?&]id=([a-zA-Z0-9_-]+)/, /\/open\?id=([a-zA-Z0-9_-]+)/]) {
    const m = driveUrl.match(re);
    if (m) return m[1];
  }
  return null;
}

async function ingestDrive(driveUrl) {
  const fileId = extractDriveFileId(driveUrl);
  if (!fileId) throw new Error('Could not extract file ID from Drive URL');
  if (!fs.existsSync(CREDENTIALS_PATH)) {
    throw new Error(`Google Drive credentials not found. Place service account JSON at: ${CREDENTIALS_PATH}`);
  }
  ensureDir(AUDIO_DIR);
  const auth = new google.auth.GoogleAuth({ keyFile: CREDENTIALS_PATH, scopes: ['https://www.googleapis.com/auth/drive.readonly'] });
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

// ── Transcription ───────────────────────────────────────────────────────────

async function pollForResult(hetznerJobId) {
  const apiKey = process.env.VBV_API_KEY;

  while (true) {
    let statusData;
    try {
      const res = await axios.get(`${HETZNER_STATUS_URL}/${hetznerJobId}`, {
        headers: { 'X-API-Key': apiKey },
      });
      statusData = res.data;
    } catch (err) {
      const message = err.response?.data?.error || err.message;
      throw new Error(`Status check failed: ${message}`);
    }

    if (statusData.status === 'complete') return statusData.segments;
    if (statusData.status === 'failed') throw new Error(statusData.error || 'Transcription failed');

    await new Promise((resolve) => setTimeout(resolve, 10000));
  }
}

async function transcribeAudio(audioPath) {
  if (!process.env.VBV_API_KEY) throw new Error('VBV_API_KEY environment variable is not set');

  const form = new FormData();
  form.append('audio', fs.createReadStream(audioPath), path.basename(audioPath));

  let submitData;
  try {
    const response = await axios.post(HETZNER_URL, form, {
      headers: { ...form.getHeaders(), 'X-API-Key': process.env.VBV_API_KEY },
    });
    submitData = response.data;
  } catch (err) {
    const message = err.response?.data?.error || err.message;
    throw new Error(`Transcription server error: ${message}`);
  }

  if (!submitData.success || !submitData.jobId) {
    throw new Error(submitData.error || 'Failed to queue transcription job');
  }

  return pollForResult(submitData.jobId);
}

// ── Candidate session save ──────────────────────────────────────────────────

function saveCandidates({ sourceType, sourceReference, churchName, sermonTitle, platformTargets, candidates }) {
  ensureDir(CANDIDATES_DIR);
  const sessionId = randomUUID();
  const session = {
    sessionId,
    createdAt: new Date().toISOString(),
    sourceType: sourceType || 'unknown',
    sourceReference: sourceReference || '',
    churchName: churchName || '',
    sermonTitle: sermonTitle || '',
    platformTargets: Array.isArray(platformTargets) ? platformTargets : [],
    candidates: candidates.map((c) => ({ ...c, status: 'pending' })),
  };
  fs.writeFileSync(
    path.join(CANDIDATES_DIR, `${sessionId}.json`),
    JSON.stringify(session, null, 2)
  );
  return sessionId;
}

// ── Background pipeline runner ──────────────────────────────────────────────

async function runPipelineBackground(jobId, opts) {
  const { sourceType, url, driveUrl, audioPath: uploadedPath, churchName, sermonTitle, platformTargets, sourceReference } = opts;
  let audioPath = uploadedPath;

  if (sourceType !== 'upload') {
    try {
      if (sourceType === 'youtube') audioPath = await ingestYoutube(url);
      else if (sourceType === 'drive') audioPath = await ingestDrive(driveUrl);
    } catch (err) {
      jobs.set(jobId, { ...jobs.get(jobId), status: 'failed', error: `Ingestion failed: ${err.message}` });
      return;
    }
  }

  jobs.set(jobId, { ...jobs.get(jobId), status: 'processing' });

  let segments;
  try {
    segments = await transcribeAudio(audioPath);
  } catch (err) {
    fs.unlink(audioPath, () => {});
    jobs.set(jobId, { ...jobs.get(jobId), status: 'failed', error: `Transcription failed: ${err.message}` });
    return;
  }
  fs.unlink(audioPath, () => {});

  let candidates;
  try {
    candidates = await detectCandidates(segments);
  } catch (err) {
    jobs.set(jobId, { ...jobs.get(jobId), status: 'failed', error: `Analysis failed: ${err.message}` });
    return;
  }

  let sessionId;
  try {
    sessionId = saveCandidates({ sourceType, sourceReference, churchName, sermonTitle, platformTargets, candidates });
  } catch (err) {
    jobs.set(jobId, { ...jobs.get(jobId), status: 'failed', error: `Save failed: ${err.message}` });
    return;
  }

  jobs.set(jobId, { ...jobs.get(jobId), status: 'complete', sessionId });
}

// ── Multer ──────────────────────────────────────────────────────────────────

const storage = multer.diskStorage({
  destination: (req, file, cb) => { ensureDir(AUDIO_DIR); cb(null, AUDIO_DIR); },
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

// ── Route: submit ───────────────────────────────────────────────────────────

router.post('/', upload.single('audioFile'), (req, res) => {
  const { sourceType, url, driveUrl, churchName, sermonTitle } = req.body;

  let platformTargets = req.body.platformTargets;
  if (typeof platformTargets === 'string') {
    try { platformTargets = JSON.parse(platformTargets); } catch { platformTargets = [platformTargets].filter(Boolean); }
  }
  if (!Array.isArray(platformTargets)) platformTargets = [];

  if (!sourceType) {
    return res.status(400).json({ success: false, error: 'sourceType is required (youtube, drive, or upload)' });
  }

  let uploadedPath = null;
  let sourceReference = '';

  if (sourceType === 'youtube') {
    if (!url) return res.status(400).json({ success: false, error: 'url is required for sourceType=youtube' });
    sourceReference = url;
  } else if (sourceType === 'drive') {
    if (!driveUrl) return res.status(400).json({ success: false, error: 'driveUrl is required for sourceType=drive' });
    sourceReference = driveUrl;
  } else if (sourceType === 'upload') {
    if (!req.file) return res.status(400).json({ success: false, error: 'No file uploaded. Field name must be "audioFile".' });
    uploadedPath = req.file.path;
    sourceReference = req.file.originalname;
  } else {
    return res.status(400).json({ success: false, error: `Unknown sourceType: ${sourceType}` });
  }

  const jobId = randomUUID();
  jobs.set(jobId, {
    jobId,
    status: 'pending',
    error: null,
    sessionId: null,
    churchName: churchName || '',
    sermonTitle: sermonTitle || '',
    sourceType,
    createdAt: new Date().toISOString(),
  });

  runPipelineBackground(jobId, {
    sourceType, url, driveUrl,
    audioPath: uploadedPath,
    churchName: churchName || '',
    sermonTitle: sermonTitle || '',
    platformTargets,
    sourceReference,
  }).catch((err) => {
    const existing = jobs.get(jobId);
    if (existing && existing.status !== 'complete' && existing.status !== 'failed') {
      jobs.set(jobId, { ...existing, status: 'failed', error: err.message });
    }
  });

  res.status(202).json({ success: true, jobId, status: 'pending' });
});

module.exports = router;
module.exports.getJobStatus = (jobId) => jobs.get(jobId) || null;
module.exports.getAllJobs   = () => Array.from(jobs.values())
  .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
