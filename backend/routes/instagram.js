const express = require('express');
const { cacheMiddleware } = require('../middleware/cache');
const prisma = require('../db');

const router = express.Router();

function demoData(period) {
  const days = period === '7d' ? 7 : period === '90d' ? 90 : period === 'all' ? 365 : 30;
  const labels = [];
  const reach = [];
  let f = 12400;
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    labels.push(d.toISOString().split('T')[0]);
    f += Math.floor(Math.random() * 80 - 10);
    reach.push(Math.floor(3000 + Math.random() * 2000));
  }
  return {
    _demo: true,
    summary: {
      followers: f,
      reach: reach.reduce((a, b) => a + b, 0),
      periodFrom: labels[0] || null,
      impressions: 0,
      profileVisits: 0,
      engagementRate: (4.2 + Math.random()).toFixed(2),
    },
    timeSeries: { labels, reach, impressions: reach.map(v => Math.floor(v * 1.4)) },
    contentBreakdown: {
      labels: ['Reels', 'Static Posts', 'Carousels', 'Stories'],
      counts: [42, 28, 15, 90],
      engagements: [18200, 7400, 4100, 3200],
    },
    topPosts: [
      { id: 'demo1', mediaType: 'REEL', thumbnail: '', caption: '"Amazing Grace" — Sunday worship highlight', likes: 1842, comments: 134, shares: 89, saves: 312, reach: 24100, impressions: 31400, engagementRate: '9.8', timestamp: new Date(Date.now() - 86400000 * 3).toISOString() },
      { id: 'demo2', mediaType: 'IMAGE', thumbnail: '', caption: 'Psalm 23 — Verse of the week', likes: 1204, comments: 88, shares: 45, saves: 220, reach: 18300, impressions: 24700, engagementRate: '8.5', timestamp: new Date(Date.now() - 86400000 * 7).toISOString() },
      { id: 'demo3', mediaType: 'CAROUSEL_ALBUM', thumbnail: '', caption: 'Top 5 worship songs of the month', likes: 987, comments: 72, shares: 61, saves: 195, reach: 15600, impressions: 20100, engagementRate: '8.4', timestamp: new Date(Date.now() - 86400000 * 12).toISOString() },
    ],
    audienceDemographics: {
      genderSplit: { female: 58, male: 42 },
      ageGroups: [{ range: '18-24', pct: 22 }, { range: '25-34', pct: 35 }, { range: '35-44', pct: 24 }, { range: '45-54', pct: 12 }, { range: '55+', pct: 7 }],
      topLocations: ['United States', 'Nigeria', 'United Kingdom', 'Canada', 'Ghana'],
    },
  };
}

router.get('/insights', cacheMiddleware, async (req, res) => {
  const period = req.query.period || '30d';
  const allTime = period === 'all';
  const days = period === '7d' ? 7 : period === '90d' ? 90 : 30;

  const count = await prisma.igDailyMetric.count();
  if (count === 0) {
    return res.sendCachedJSON(demoData(period));
  }

  const since = allTime ? null : new Date(Date.now() - days * 86400000).toISOString().split('T')[0];

  const [metrics, account, topPosts, typeCounts, periodViewsAgg, allPostsForScatter, postAgg, followerSnapshots] = await Promise.all([
    prisma.igDailyMetric.findMany({
      where: since ? { date: { gte: since } } : {},
      orderBy: { date: 'asc' },
    }),
    prisma.igAccount.findUnique({ where: { id: 1 } }),
    prisma.igPost.findMany({
      orderBy: { engagementRate: 'desc' },
      take: 5,
    }),
    prisma.igPost.groupBy({
      by: ['mediaType'],
      _count: { id: true },
    }),
    prisma.igPost.aggregate({
      where: since ? { postedAt: { gte: since } } : {},
      _sum: { views: true },
    }),
    prisma.igPost.findMany({
      select: { id: true, mediaType: true, engagementRate: true, postedAt: true, caption: true, follows: true, avgWatchTime: true, videoDuration: true, likes: true, comments: true, shares: true, saves: true, reach: true, views: true },
      orderBy: { postedAt: 'asc' },
    }),
    prisma.igPost.aggregate({
      _count: { id: true },
      _sum: { likes: true },
    }),
    prisma.igFollowerSnapshot.findMany({
      orderBy: { date: 'asc' },
    }),
  ]);

  const typeMap = { REEL: 0, IMAGE: 0, CAROUSEL_ALBUM: 0, VIDEO: 0 };
  typeCounts.forEach(r => { typeMap[r.mediaType] = r._count.id; });

  const labels = metrics.map(m => m.date);
  const reachValues = metrics.map(m => m.reach);
  const syncedReach = reachValues.reduce((a, b) => a + b, 0);
  const baseReach = allTime ? (account?.baseReach || 0) : 0;
  const totalReach = baseReach + syncedReach;
  const totalEng = topPosts.reduce((a, p) => a + p.likes + p.comments + p.shares + p.saves, 0);

  const reelPosts = allPostsForScatter.filter(p => p.mediaType === 'REEL' && p.avgWatchTime > 0);
  const avgWatchTimeMs = reelPosts.length
    ? Math.round(reelPosts.reduce((a, p) => a + p.avgWatchTime, 0) / reelPosts.length)
    : 0;

  const reelPostsWithDuration = reelPosts.filter(p => p.videoDuration > 0);
  const avgRetentionPct = reelPostsWithDuration.length
    ? parseFloat((reelPostsWithDuration.reduce((a, p) => a + (p.avgWatchTime / p.videoDuration) * 100, 0) / reelPostsWithDuration.length).toFixed(1))
    : null;

  const periodFrom = allTime ? '2025-09-25' : (labels[0] || since || null);

  res.sendCachedJSON({
    summary: {
      followers: account?.followers || 0,
      reach: totalReach,
      periodFrom,
      impressions: periodViewsAgg._sum.views || 0,
      profileVisits: 0,
      engagementRate: totalReach > 0 ? ((totalEng / totalReach) * 100).toFixed(2) : '0.00',
      totalPosts: postAgg._count.id || 0,
      totalLikes: postAgg._sum.likes || 0,
      avgWatchTimeMs,
      avgRetentionPct,
    },
    timeSeries: {
      labels,
      reach: reachValues,
      impressions: [],
      estimatedPoints: allTime ? [
        { date: '2025-10-11', reach: 84,  label: 'Est. Sep 25–Oct 27 avg' },
        { date: '2025-12-12', reach: 131, label: 'Est. Oct 28–Jan 25 avg' },
        { date: '2026-03-04', reach: 68,  label: 'Est. Jan 26–Apr 10 avg' },
      ] : [],
    },
    postScatter: allPostsForScatter.map(p => ({
      date: p.postedAt,
      er: parseFloat(p.engagementRate),
      mediaType: p.mediaType,
      caption: (p.caption || '').slice(0, 60),
    })),
    watchTimeData: allPostsForScatter
      .filter(p => p.mediaType === 'REEL' && p.videoDuration > 0)
      .map(p => ({
        caption: p.caption || '',
        postedAt: p.postedAt,
        avgWatchTime: p.avgWatchTime,
        videoDuration: p.videoDuration,
        watchPct: p.videoDuration > 0 ? Math.round((p.avgWatchTime / p.videoDuration) * 100) : 0,
        likes: p.likes,
        comments: p.comments,
        shares: p.shares,
        saves: p.saves,
        reach: p.reach,
        views: p.views,
        engagementRate: parseFloat(p.engagementRate).toFixed(2),
      })),
    followerGrowth: {
      labels: followerSnapshots.map(s => s.date),
      followers: followerSnapshots.map(s => s.followers),
    },
    followsPerPost: allPostsForScatter.map(p => ({
      date: p.postedAt,
      follows: p.follows || 0,
      caption: (p.caption || '').slice(0, 40),
      mediaType: p.mediaType,
    })),
    contentBreakdown: {
      labels: ['Reels', 'Static Posts', 'Carousels', 'Videos'],
      counts: [typeMap.REEL, typeMap.IMAGE, typeMap.CAROUSEL_ALBUM, typeMap.VIDEO],
      engagements: [0, 0, 0, 0],
    },
    topPosts: topPosts.map(p => ({
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
    })),
    audienceDemographics: { genderSplit: {}, ageGroups: [], topLocations: [] },
  });
});

module.exports = router;
