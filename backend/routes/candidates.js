const express = require('express');
const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');

const router = express.Router();

const DATA_DIR = path.resolve(__dirname, '../../data/candidates');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function sessionPath(sessionId) {
  // Sanitise: session IDs must be UUIDs (alphanumeric + hyphens only)
  if (!/^[a-f0-9-]{36}$/.test(sessionId)) return null;
  return path.join(DATA_DIR, `${sessionId}.json`);
}

// POST /api/candidates — save a new candidate session
router.post('/', (req, res) => {
  const { sourceType, sourceReference, churchName, sermonTitle, platformTargets, candidates } = req.body;
  if (!candidates || !Array.isArray(candidates)) {
    return res.status(400).json({ success: false, error: 'candidates must be an array' });
  }
  ensureDataDir();
  const sessionId = randomUUID();
  const session = {
    sessionId,
    createdAt: new Date().toISOString(),
    sourceType: sourceType || 'unknown',
    sourceReference: sourceReference || '',
    churchName: churchName || '',
    sermonTitle: sermonTitle || '',
    platformTargets: Array.isArray(platformTargets) ? platformTargets : [],
    candidates: candidates.map(c => ({ ...c, status: 'pending' })),
  };
  fs.writeFileSync(sessionPath(sessionId), JSON.stringify(session, null, 2));
  res.json({ success: true, sessionId, candidateCount: candidates.length });
});

// GET /api/candidates/:sessionId — retrieve a session
router.get('/:sessionId', (req, res) => {
  const filePath = sessionPath(req.params.sessionId);
  if (!filePath) return res.status(400).json({ success: false, error: 'Invalid session ID format' });
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ success: false, error: `Session '${req.params.sessionId}' not found` });
  }
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  res.json({ success: true, ...data });
});

// PATCH /api/candidates/:sessionId/:candidateIndex — update candidate status
router.patch('/:sessionId/:candidateIndex', (req, res) => {
  const { sessionId, candidateIndex } = req.params;
  const { status } = req.body;

  if (!['approved', 'rejected', 'pending'].includes(status)) {
    return res.status(400).json({ success: false, error: 'status must be "approved", "rejected", or "pending"' });
  }

  const filePath = sessionPath(sessionId);
  if (!filePath) return res.status(400).json({ success: false, error: 'Invalid session ID format' });
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ success: false, error: `Session '${sessionId}' not found` });
  }

  const idx = parseInt(candidateIndex, 10);
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

  if (isNaN(idx) || idx < 0 || idx >= data.candidates.length) {
    return res.status(404).json({ success: false, error: `Candidate index ${candidateIndex} is out of range` });
  }

  data.candidates[idx].status = status;
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  res.json({ success: true, candidateIndex: idx, status });
});

module.exports = router;
