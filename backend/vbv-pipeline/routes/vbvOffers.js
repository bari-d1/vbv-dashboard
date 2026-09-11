const router = require('express').Router();
const prisma = require('../../db');
const auth = require('../middleware/vbvAuthMiddleware');
const role = require('../middleware/vbvRoleMiddleware');

// GET /vbv/offers
router.get('/', auth, role('admin'), async (req, res) => {
  const offers = await prisma.vbvOffer.findMany({
    select: { id: true, slug: true, churchName: true, isActive: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  });
  res.json(offers);
});

// GET /vbv/offers/logs
router.get('/logs', auth, role('admin'), async (req, res) => {
  const { slug, type } = req.query;
  const where = {};
  if (slug) where.slug = slug;
  if (type) where.type = type;

  const logs = await prisma.vbvOfferAccessLog.findMany({
    where,
    include: { offer: { select: { churchName: true } } },
    orderBy: { createdAt: 'desc' },
    take: 500,
  });
  res.json(logs);
});

module.exports = router;
