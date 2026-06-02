const express = require('express');
const { spawn } = require('child_process');
const { randomUUID } = require('crypto');
const fs = require('fs');
const path = require('path');

const router = express.Router();

const AUDIO_DIR = '/tmp/vbv-audio';

function ensureDir() {
  if (!fs.existsSync(AUDIO_DIR)) fs.mkdirSync(AUDIO_DIR, { recursive: true });
}

router.post('/', (req, res) => {
  const { url } = req.body;

  if (!url || typeof url !== 'string') {
    return res.status(400).json({ success: false, error: 'url is required' });
  }

  ensureDir();

  const filename = `yt-${randomUUID()}.mp3`;
  const outputPath = path.join(AUDIO_DIR, filename);

  const ytdlp = spawn('yt-dlp', [
    '--extract-audio',
    '--audio-format', 'mp3',
    '--audio-quality', '0',
    '--no-playlist',
    '-o', outputPath,
    url,
  ]);

  let stderr = '';
  ytdlp.stderr.on('data', (chunk) => { stderr += chunk; });

  ytdlp.on('error', (err) => {
    if (err.code === 'ENOENT') {
      return res.status(500).json({
        success: false,
        error: 'yt-dlp is not installed. Install it with: brew install yt-dlp (macOS) or pip install yt-dlp',
      });
    }
    res.status(500).json({ success: false, error: err.message });
  });

  ytdlp.on('close', (code) => {
    if (res.headersSent) return;

    if (code !== 0) {
      return res.status(500).json({
        success: false,
        error: stderr.trim() || 'yt-dlp failed with no output',
      });
    }

    res.json({ success: true, audioPath: outputPath });
  });
});

module.exports = router;
