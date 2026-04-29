const express = require('express');
const axios = require('axios');
const prisma = require('../db');

const router = express.Router();

const SYSTEM_PROMPT = `You are a data extraction assistant. The user will send you a screenshot of an Instagram post. Extract the following information and return it as a JSON object with exactly these keys: display_name, instagram_handle, event_name, event_date, event_location, contact_email, contact_phone, collaborators. For display_name and instagram_handle, extract the account that made the post. For collaborators, return an array of any other accounts, handles, or pages visibly tagged or credited in the post. If a field is not visible in the screenshot, return null for that field. For collaborators, return an empty array if none are found. Return only the JSON object, no explanation, no markdown, no additional text.`;

function parseLead(lead) {
  return { ...lead, collaborators: JSON.parse(lead.collaborators || '[]') };
}

// POST /api/leads/extract
router.post('/extract', async (req, res) => {
  const { imageData, mediaType = 'image/png' } = req.body;
  if (!imageData) return res.status(400).json({ error: 'No image data provided' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured in .env' });

  const base64Data = imageData.replace(/^data:image\/[a-zA-Z+]+;base64,/, '');

  try {
    const response = await axios.post('https://api.anthropic.com/v1/messages', {
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64Data } },
          { type: 'text', text: 'Extract the lead information from this Instagram post screenshot.' },
        ],
      }],
    }, {
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
    });

    const raw = response.data.content[0].text.trim();
    // Strip markdown code fences if model wraps output anyway
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    const extracted = JSON.parse(cleaned);
    res.json({ extracted });
  } catch (err) {
    console.error('[Leads:Extract]', err.response?.data || err.message);
    res.status(500).json({
      error: 'Extraction failed',
      detail: err.response?.data?.error?.message || err.message,
    });
  }
});

// GET /api/leads
router.get('/', async (req, res) => {
  const { sort = 'dateAdded', order = 'desc' } = req.query;
  const allowed = ['dateAdded', 'status'];
  const sortField = allowed.includes(sort) ? sort : 'dateAdded';

  const leads = await prisma.lead.findMany({
    orderBy: { [sortField]: order === 'asc' ? 'asc' : 'desc' },
  });
  res.json(leads.map(parseLead));
});

// POST /api/leads
router.post('/', async (req, res) => {
  const { displayName, instagramHandle, eventName, eventDate, eventLocation, contactEmail, contactPhone, collaborators } = req.body;

  const lead = await prisma.lead.create({
    data: {
      displayName:     displayName     || null,
      instagramHandle: instagramHandle || null,
      eventName:       eventName       || null,
      eventDate:       eventDate       || null,
      eventLocation:   eventLocation   || null,
      contactEmail:    contactEmail    || null,
      contactPhone:    contactPhone    || null,
      collaborators:   JSON.stringify(Array.isArray(collaborators) ? collaborators : []),
    },
  });
  res.json(parseLead(lead));
});

// PATCH /api/leads/:id  — status and/or notes only
router.patch('/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  const data = {};
  if (req.body.status !== undefined) data.status = req.body.status;
  if (req.body.notes  !== undefined) data.notes  = req.body.notes;

  try {
    const lead = await prisma.lead.update({ where: { id }, data });
    res.json(parseLead(lead));
  } catch {
    res.status(404).json({ error: 'Lead not found' });
  }
});

// DELETE /api/leads/:id
router.delete('/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    await prisma.lead.delete({ where: { id } });
    res.json({ success: true });
  } catch {
    res.status(404).json({ error: 'Lead not found' });
  }
});

module.exports = router;
