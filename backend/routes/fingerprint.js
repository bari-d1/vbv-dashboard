const express = require('express');
const multer = require('multer');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { registerVideo, compareVideo, listVideos, deleteVideo, VIDEOS_DIR } = require('../services/videoFingerprint');

const router = express.Router();

const ALLOWED_EXTS = ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.m4v'];

const upload = multer({
  dest: os.tmpdir(),
  limits: { fileSize: 500 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, ALLOWED_EXTS.includes(ext));
  },
});

// POST /api/fingerprint/register
router.post('/register', upload.single('video'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No valid video file provided' });

  const filename = req.file.originalname;
  const destPath = path.join(VIDEOS_DIR, filename);

  try {
    fs.renameSync(req.file.path, destPath);
    const result = await registerVideo(destPath, filename);
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('[Fingerprint:Register]', err.message);
    try { fs.unlinkSync(req.file.path); } catch {}
    try { fs.unlinkSync(destPath); } catch {}
    res.status(500).json({ error: 'Registration failed', detail: err.message });
  }
});

// POST /api/fingerprint/compare
router.post('/compare', upload.single('video'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No valid video file provided' });

  try {
    const results = await compareVideo(req.file.path);
    res.json({ results, comparedAt: new Date().toISOString() });
  } catch (err) {
    console.error('[Fingerprint:Compare]', err.message);
    res.status(500).json({ error: 'Comparison failed', detail: err.message });
  } finally {
    try { fs.unlinkSync(req.file.path); } catch {}
  }
});

// GET /api/fingerprint/library
router.get('/library', (req, res) => {
  res.json(listVideos());
});

// DELETE /api/fingerprint/library/:filename
router.delete('/library/:filename', (req, res) => {
  const deleted = deleteVideo(decodeURIComponent(req.params.filename));
  if (!deleted) return res.status(404).json({ error: 'Video not found in library' });
  res.json({ success: true });
});

module.exports = router;
