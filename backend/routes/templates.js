const express = require('express');
const prisma = require('../db');
const auth = require('../vbv-pipeline/middleware/vbvAuthMiddleware');
const role = require('../vbv-pipeline/middleware/vbvRoleMiddleware');

const router = express.Router();

// GET /api/templates
router.get('/', auth, role('vedits', 'admin'), async (req, res) => {
  const templates = await prisma.vbvTemplate.findMany({ orderBy: { name: 'asc' } });
  res.json(templates);
});

// GET /api/templates/:id
router.get('/:id', auth, role('vedits', 'admin'), async (req, res) => {
  const template = await prisma.vbvTemplate.findUnique({ where: { id: req.params.id } });
  if (!template) return res.status(404).json({ error: 'Template not found' });
  res.json(template);
});

// POST /api/templates
router.post('/', auth, role('vedits', 'admin'), async (req, res) => {
  const { name, subject, bodyHtml } = req.body;
  if (!name || !subject || !bodyHtml) {
    return res.status(400).json({ error: 'name, subject, and bodyHtml are required' });
  }

  const template = await prisma.vbvTemplate.create({ data: { name, subject, bodyHtml } });
  res.json(template);
});

// PATCH /api/templates/:id
router.patch('/:id', auth, role('vedits', 'admin'), async (req, res) => {
  const template = await prisma.vbvTemplate.findUnique({ where: { id: req.params.id } });
  if (!template) return res.status(404).json({ error: 'Template not found' });

  const data = {};
  if (req.body.name !== undefined) data.name = req.body.name;
  if (req.body.subject !== undefined) data.subject = req.body.subject;
  if (req.body.bodyHtml !== undefined) data.bodyHtml = req.body.bodyHtml;

  const updated = await prisma.vbvTemplate.update({ where: { id: template.id }, data });
  res.json(updated);
});

module.exports = router;
