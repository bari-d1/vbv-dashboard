const express = require('express');
const { sendLandingLeadNotification } = require('../services/emailService');

const router = express.Router();

const ATTENDANCE_OPTIONS = ['under 100', '100-250', '250-500', '500+'];

function normalizeUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url.toString();
  } catch (e) {
    return null;
  }
}

// POST /api/landing-lead
router.post('/', async (req, res) => {
  const { name, church, youtube, attendance } = req.body;

  if (!name || !church || !youtube || !attendance) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  if (!ATTENDANCE_OPTIONS.includes(attendance)) {
    return res.status(400).json({ error: 'Invalid attendance value' });
  }

  const cleanUrl = normalizeUrl(youtube);
  if (!cleanUrl) {
    return res.status(400).json({ error: 'Invalid YouTube link' });
  }

  try {
    await sendLandingLeadNotification({ name, church, youtube: cleanUrl, attendance });
    res.json({ ok: true });
  } catch (err) {
    console.error('[LandingLead]', err.message);
    res.status(500).json({ error: 'Failed to send notification' });
  }
});

module.exports = router;
