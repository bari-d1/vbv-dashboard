const express = require('express');
const { cacheMiddleware } = require('../middleware/cache');
const prisma = require('../db');

const router = express.Router();

// GET /api/posts?sort=engagementRate&order=desc&type=REEL&page=1
router.get('/', cacheMiddleware, async (req, res) => {
  const { sort = 'engagementRate', order = 'desc', type, page = 1, limit = 50 } = req.query;

  const allowedSorts = ['engagementRate', 'likes', 'comments', 'shares', 'saves', 'reach', 'views', 'postedAt'];
  const sortField = allowedSorts.includes(sort) ? sort : 'engagementRate';
  const sortOrder = order === 'asc' ? 'asc' : 'desc';

  const where = type ? { mediaType: type } : {};
  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [posts, total] = await Promise.all([
    prisma.igPost.findMany({
      where,
      orderBy: { [sortField]: sortOrder },
      skip,
      take: parseInt(limit),
    }),
    prisma.igPost.count({ where }),
  ]);

  res.sendCachedJSON({
    posts: posts.map(p => ({
      id: p.id,
      mediaType: p.mediaType,
      thumbnail: p.thumbnail,
      caption: p.caption,
      likes: p.likes,
      comments: p.comments,
      shares: p.shares,
      saves: p.saves,
      reach: p.reach,
      views: p.views,
      impressions: p.impressions,
      profileVisits: p.profileVisits,
      follows: p.follows,
      engagementRate: parseFloat(p.engagementRate).toFixed(2),
      avgWatchTime: p.avgWatchTime,
      videoDuration: p.videoDuration,
      timestamp: p.postedAt,
    })),
    total,
    page: parseInt(page),
    pages: Math.ceil(total / parseInt(limit)),
  });
});

// GET /api/posts/compare?ids=id1,id2,id3
router.get('/compare', async (req, res) => {
  const ids = (req.query.ids || '').split(',').map(s => s.trim()).filter(Boolean);
  if (ids.length < 2) return res.status(400).json({ error: 'Provide at least 2 post IDs' });

  const posts = await prisma.igPost.findMany({ where: { id: { in: ids } } });

  res.json(posts.map(p => ({
    id: p.id,
    mediaType: p.mediaType,
    thumbnail: p.thumbnail,
    caption: p.caption,
    likes: p.likes,
    comments: p.comments,
    shares: p.shares,
    saves: p.saves,
    reach: p.reach,
    views: p.views,
    impressions: p.impressions,
    profileVisits: p.profileVisits,
    follows: p.follows,
    engagementRate: parseFloat(p.engagementRate).toFixed(2),
    timestamp: p.postedAt,
  })));
});

// PATCH /api/posts/:id/duration  { videoDuration: <seconds> }
router.patch('/:id/duration', async (req, res) => {
  const { id } = req.params;
  const seconds = parseFloat(req.body.videoDuration);
  if (isNaN(seconds) || seconds < 0) {
    return res.status(400).json({ error: 'videoDuration must be a non-negative number (seconds)' });
  }

  const post = await prisma.igPost.findUnique({ where: { id } });
  if (!post) return res.status(404).json({ error: 'Post not found' });

  const videoDuration = Math.round(seconds * 1000); // store as ms
  await prisma.igPost.update({ where: { id }, data: { videoDuration } });

  const { cache } = require('../middleware/cache');
  cache.flushAll();

  res.json({ success: true, id, videoDuration });
});

module.exports = router;
