const router = require('express').Router();
const prisma = require('../../db');
const auth = require('../middleware/vbvAuthMiddleware');
const role = require('../middleware/vbvRoleMiddleware');

// GET /vbv/monitor/editors — active editors for the filter panel, plus any other
// active user currently assigned to a non-completed job (e.g. a lead editor covering edits)
router.get('/editors', auth, role('admin', 'lead_editor'), async (req, res) => {
  const editors = await prisma.vbvUser.findMany({
    where: { role: 'editor', isActive: true },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });

  const activeAssignees = await prisma.vbvUser.findMany({
    where: { isActive: true, assignedJobs: { some: { status: { not: 'sm_approved' } } } },
    select: { id: true, name: true },
  });

  const merged = new Map();
  [...editors, ...activeAssignees].forEach(u => merged.set(u.id, u));

  res.json(Array.from(merged.values()).sort((a, b) => a.name.localeCompare(b.name)));
});

// GET /vbv/monitor/jobs — active jobs with timeline logs for the weekly calendar
router.get('/jobs', auth, role('admin', 'lead_editor'), async (req, res) => {
  const { editorId, includeUnclaimed } = req.query;

  const where = { status: { not: 'sm_approved' } };
  if (includeUnclaimed !== 'true') where.claimedAt = { not: null };
  if (editorId) where.assignedToId = editorId;

  const jobs = await prisma.vbvJob.findMany({
    where,
    include: {
      assignedTo: { select: { id: true, name: true } },
      timelineLogs: { orderBy: { createdAt: 'asc' } },
    },
    orderBy: { claimedAt: 'desc' },
  });
  res.json(jobs);
});

module.exports = router;
