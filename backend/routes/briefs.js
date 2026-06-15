const express = require('express');
const fs = require('fs');
const path = require('path');
const prisma = require('../db');
const vbvAuth = require('../vbv-pipeline/middleware/vbvAuthMiddleware');

const router = express.Router();

const DATA_DIR = path.resolve(__dirname, '../../data/candidates');

function sessionPath(sessionId) {
  if (!/^[a-f0-9-]{36}$/.test(sessionId)) return null;
  return path.join(DATA_DIR, `${sessionId}.json`);
}

// POST /api/briefs/vbv — create a VBV pipeline brief from an approved candidate
router.post('/vbv', vbvAuth, async (req, res) => {
  const {
    sessionId, candidateIndex,
    sourceReference, start, end, hook, payoff,
    churchName, sermonTitle, platformTarget, notes,
  } = req.body;

  // Validate required fields
  const missing = [];
  if (!sessionId)        missing.push('sessionId');
  if (candidateIndex == null) missing.push('candidateIndex');
  if (!start)            missing.push('start');
  if (!end)              missing.push('end');
  if (!hook)             missing.push('hook');
  if (!payoff)           missing.push('payoff');
  if (!churchName?.trim())   missing.push('churchName');
  if (!sermonTitle?.trim())  missing.push('sermonTitle');
  if (!platformTarget?.length) missing.push('platformTarget');
  if (missing.length) {
    return res.status(400).json({ success: false, error: `Missing required fields: ${missing.join(', ')}` });
  }

  // Verify the candidate session exists and candidate is approved
  const filePath = sessionPath(sessionId);
  if (!filePath || !fs.existsSync(filePath)) {
    return res.status(404).json({ success: false, error: `Session '${sessionId}' not found` });
  }
  const session = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const idx = parseInt(candidateIndex, 10);
  if (isNaN(idx) || idx < 0 || idx >= session.candidates.length) {
    return res.status(404).json({ success: false, error: `Candidate index ${candidateIndex} out of range` });
  }
  const candidate = session.candidates[idx];
  if (candidate.status !== 'approved') {
    return res.status(400).json({ success: false, error: `Candidate must be approved before creating a brief (current status: ${candidate.status})` });
  }

  // Build clip notes from hook + payoff + optional user notes
  const clipNotes = `Hook: ${hook}\n\nPayoff: ${payoff}${notes?.trim() ? `\n\nNotes: ${notes.trim()}` : ''}`;

  // Write to the VBV job pool
  let job;
  try {
    job = await prisma.vbvJob.create({
      data: {
        title: sermonTitle.trim(),
        artistName: churchName.trim(),
        briefType: 'vedits',
        sourceDriveLink: sourceReference || '',
        startTimestamp: start,
        endTimestamp: end,
        clipNotes,
        platformTargets: Array.isArray(platformTarget) ? platformTarget : [platformTarget],
        createdById: req.vbvUser.userId,
      },
    });
  } catch (err) {
    console.error('[Briefs] Failed to create job:', err.message);
    return res.status(500).json({ success: false, error: 'Failed to write brief to job pool' });
  }

  // Log the action
  await prisma.vbvTimelineLog.create({
    data: { jobId: job.id, actorId: req.vbvUser.userId, action: 'created' },
  }).catch(() => {});
  await prisma.vbvActivityLog.create({
    data: { actorId: req.vbvUser.userId, actionType: 'job_created', detail: `Created sermon brief: ${sermonTitle}` },
  }).catch(() => {});

  // Mark candidate as briefed in the session file
  session.candidates[idx].status = 'briefed';
  session.candidates[idx].briefId = job.id;
  fs.writeFileSync(filePath, JSON.stringify(session, null, 2));

  res.status(201).json({ success: true, briefId: job.id });
});

module.exports = router;
