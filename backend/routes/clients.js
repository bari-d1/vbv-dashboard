const express = require('express');
const prisma = require('../db');
const auth = require('../vbv-pipeline/middleware/vbvAuthMiddleware');
const role = require('../vbv-pipeline/middleware/vbvRoleMiddleware');
const { sendClientEmail } = require('../services/emailService');

const router = express.Router();

// GET /api/clients?status=ACTIVE
router.get('/', auth, role('vedits', 'admin'), async (req, res) => {
  const { status } = req.query;
  const clients = await prisma.vbvClient.findMany({
    where: status ? { status } : undefined,
    orderBy: { createdAt: 'desc' },
  });
  res.json(clients);
});

// GET /api/clients/:id
router.get('/:id', auth, role('vedits', 'admin'), async (req, res) => {
  const client = await prisma.vbvClient.findUnique({
    where: { id: req.params.id },
    include: { emailLogs: { orderBy: { sentAt: 'desc' } } },
  });
  if (!client) return res.status(404).json({ error: 'Client not found' });
  res.json(client);
});

// PATCH /api/clients/:id — tier/status/notes/startDate only; churchName and email are immutable here
router.patch('/:id', auth, role('vedits', 'admin'), async (req, res) => {
  const client = await prisma.vbvClient.findUnique({ where: { id: req.params.id } });
  if (!client) return res.status(404).json({ error: 'Client not found' });

  const data = {};
  if (req.body.tier !== undefined) data.tier = req.body.tier;
  if (req.body.status !== undefined) data.status = req.body.status;
  if (req.body.notes !== undefined) data.notes = req.body.notes;
  if (req.body.startDate !== undefined) data.startDate = req.body.startDate ? new Date(req.body.startDate) : null;

  const updated = await prisma.vbvClient.update({ where: { id: client.id }, data });
  res.json(updated);
});

// POST /api/clients/:id/send-email
router.post('/:id/send-email', auth, role('vedits', 'admin'), async (req, res) => {
  const { subject, body } = req.body;
  if (!subject || !body) return res.status(400).json({ error: 'subject and body are required' });

  const client = await prisma.vbvClient.findUnique({ where: { id: req.params.id } });
  if (!client) return res.status(404).json({ error: 'Client not found' });

  // sendClientEmail wraps `body` in the branded HTML shell, sends via Resend, and logs the
  // VbvEmailLog row itself (direction SENT, linked to this client by its email).
  await sendClientEmail(client.email, subject, body);

  res.json({ success: true });
});

module.exports = router;
