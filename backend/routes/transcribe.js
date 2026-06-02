const express = require('express');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const axios = require('axios');

const router = express.Router();

const HETZNER_URL = 'http://5.78.235.93:5000/transcribe';
const HETZNER_STATUS_URL = 'http://5.78.235.93:5000/status';

async function pollForResult(jobId, apiKey) {
  while (true) {
    let statusData;
    try {
      const res = await axios.get(`${HETZNER_STATUS_URL}/${jobId}`, {
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

router.post('/', async (req, res) => {
  if (!process.env.VBV_API_KEY) {
    return res.status(500).json({ success: false, error: 'VBV_API_KEY environment variable is not set' });
  }

  const { audioPath } = req.body;

  if (!audioPath || typeof audioPath !== 'string') {
    return res.status(400).json({ success: false, error: 'audioPath is required' });
  }

  if (!fs.existsSync(audioPath)) {
    return res.status(400).json({ success: false, error: `Audio file not found: ${audioPath}` });
  }

  const form = new FormData();
  form.append('audio', fs.createReadStream(audioPath), path.basename(audioPath));

  let submitData;
  try {
    const response = await axios.post(HETZNER_URL, form, {
      headers: { ...form.getHeaders(), 'X-API-Key': process.env.VBV_API_KEY },
    });
    submitData = response.data;
  } catch (err) {
    const status = err.response?.status;
    const message = err.response?.data?.error || err.message;
    return res.status(502).json({ success: false, error: `Transcription server error${status ? ` (${status})` : ''}: ${message}` });
  }

  if (!submitData.success || !submitData.jobId) {
    return res.status(500).json({ success: false, error: submitData.error || 'Failed to queue transcription job' });
  }

  let segments;
  try {
    segments = await pollForResult(submitData.jobId, process.env.VBV_API_KEY);
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }

  res.json({ success: true, segments });
});

module.exports = router;
