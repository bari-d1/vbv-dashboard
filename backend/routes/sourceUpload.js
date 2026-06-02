const express = require('express');
const multer = require('multer');
const { randomUUID } = require('crypto');
const fs = require('fs');
const path = require('path');

const router = express.Router();

const AUDIO_DIR = '/tmp/vbv-audio';
const ALLOWED_EXTS = ['.mp3', '.mp4', '.wav', '.m4a', '.mov'];

function ensureDir() {
  if (!fs.existsSync(AUDIO_DIR)) fs.mkdirSync(AUDIO_DIR, { recursive: true });
}

ensureDir();

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, AUDIO_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `upload-${randomUUID()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 * 1024 }, // 2GB
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ALLOWED_EXTS.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${ext}. Allowed: ${ALLOWED_EXTS.join(', ')}`));
    }
  },
});

router.post('/', (req, res) => {
  upload.single('audioFile')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ success: false, error: err.message });
    }
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded. Field name must be "audioFile".' });
    }
    res.json({ success: true, audioPath: req.file.path });
  });
});

module.exports = router;
