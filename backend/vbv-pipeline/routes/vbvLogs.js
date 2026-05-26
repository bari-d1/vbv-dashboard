const router = require('express').Router();
const prisma = require('../../db');
const auth = require('../middleware/vbvAuthMiddleware');
const role = require('../middleware/vbvRoleMiddleware');

// GET /vbv/logs/activity
router.get('/activity', auth, role('admin'), async (req, res) => {
  const { roleFilter, userId, actionType, dateFrom, dateTo } = req.query;

  const where = {};
  if (userId) where.actorId = userId;
  if (actionType) where.actionType = actionType;
  if (dateFrom || dateTo) {
    where.createdAt = {};
    if (dateFrom) where.createdAt.gte = new Date(dateFrom);
    if (dateTo) where.createdAt.lte = new Date(dateTo);
  }
  if (roleFilter) where.actor = { role: roleFilter };

  const logs = await prisma.vbvActivityLog.findMany({
    where,
    include: { actor: { select: { name: true, email: true, role: true } } },
    orderBy: { createdAt: 'desc' },
    take: 500,
  });

  res.json(logs);
});

// GET /vbv/logs/timeline/:jobId
router.get('/timeline/:jobId', auth, async (req, res) => {
  const logs = await prisma.vbvTimelineLog.findMany({
    where: { jobId: req.params.jobId },
    include: { actor: { select: { name: true } } },
    orderBy: { createdAt: 'asc' },
  });
  res.json(logs);
});

module.exports = router;
