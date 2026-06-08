const router = require('express').Router();
const prisma = require('../../db');
const auth = require('../middleware/vbvAuthMiddleware');
const role = require('../middleware/vbvRoleMiddleware');
const { sendOutreachEmail } = require('../../services/emailService');

// POST /vbv/leads
router.post('/', auth, role('vedits', 'admin'), async (req, res) => {
  const { churchName, email, driveLink } = req.body;
  if (!churchName || !email) return res.status(400).json({ error: 'churchName and email are required' });

  try {
    const lead = await prisma.vbvLead.create({
      data: { churchName, email, driveLink: driveLink || null, status: 'NO_RESPONSE' },
    });
    res.json(lead);
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ error: `A lead with email "${email}" already exists` });
    throw err;
  }
});

// GET /vbv/leads?status=CONTACTED
router.get('/', auth, role('vedits', 'admin'), async (req, res) => {
  const { status } = req.query;
  const leads = await prisma.vbvLead.findMany({
    where: status ? { status } : undefined,
    include: { _count: { select: { emailLogs: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json(leads);
});

// GET /vbv/leads/:id
router.get('/:id', auth, role('vedits', 'admin'), async (req, res) => {
  const lead = await prisma.vbvLead.findUnique({
    where: { id: req.params.id },
    include: { emailLogs: { orderBy: { sentAt: 'desc' } } },
  });
  if (!lead) return res.status(404).json({ error: 'Lead not found' });
  res.json(lead);
});

// PATCH /vbv/leads/:id — partial update; converting to CONVERTED also spins up a VbvClient
router.patch('/:id', auth, role('vedits', 'admin'), async (req, res) => {
  const lead = await prisma.vbvLead.findUnique({ where: { id: req.params.id } });
  if (!lead) return res.status(404).json({ error: 'Lead not found' });

  const data = {};
  if (req.body.churchName !== undefined) data.churchName = req.body.churchName;
  if (req.body.email !== undefined) data.email = req.body.email;
  if (req.body.driveLink !== undefined) data.driveLink = req.body.driveLink;
  if (req.body.status !== undefined) data.status = req.body.status;

  try {
    if (data.status === 'CONVERTED') {
      const [updatedLead, client] = await prisma.$transaction([
        prisma.vbvLead.update({ where: { id: lead.id }, data }),
        prisma.vbvClient.create({
          data: {
            churchName: data.churchName ?? lead.churchName,
            email: data.email ?? lead.email,
            // tier/status are required by the schema but not specified for auto-conversion —
            // a freshly converted lead starts as an active, base-tier client.
            tier: 'TIER_1',
            status: 'ACTIVE',
            leadId: lead.id,
          },
        }),
      ]);
      return res.json({ lead: updatedLead, client });
    }

    const updatedLead = await prisma.vbvLead.update({ where: { id: lead.id }, data });
    res.json(updatedLead);
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'A lead or client with that email already exists' });
    throw err;
  }
});

// DELETE /vbv/leads/:id — admin only
router.delete('/:id', auth, role('admin'), async (req, res) => {
  const lead = await prisma.vbvLead.findUnique({ where: { id: req.params.id } });
  if (!lead) return res.status(404).json({ error: 'Lead not found' });

  await prisma.vbvLead.delete({ where: { id: lead.id } });
  res.json({ success: true });
});

// POST /vbv/leads/:id/send-email
router.post('/:id/send-email', auth, role('vedits', 'admin'), async (req, res) => {
  const { templateId } = req.body;
  if (!templateId) return res.status(400).json({ error: 'templateId required' });

  const lead = await prisma.vbvLead.findUnique({ where: { id: req.params.id } });
  if (!lead) return res.status(404).json({ error: 'Lead not found' });

  const template = await prisma.vbvTemplate.findUnique({ where: { id: templateId } });
  if (!template) return res.status(404).json({ error: 'Template not found' });

  // sendOutreachEmail fills the {churchName}/{driveLink} placeholders, sends via Resend, and
  // logs the VbvEmailLog row itself (direction SENT, linked to this lead by its email).
  await sendOutreachEmail(
    lead.email,
    template.bodyHtml,
    { churchName: lead.churchName, driveLink: lead.driveLink || '' },
    template.subject,
  );

  res.json({ success: true });
});

module.exports = router;
