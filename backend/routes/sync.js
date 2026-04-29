const express = require('express');
const axios = require('axios');
const prisma = require('../db');
const { cache } = require('../middleware/cache');

const router = express.Router();
const BASE = 'https://graph.facebook.com/v19.0';

function igToken() { return process.env.INSTAGRAM_ACCESS_TOKEN; }
function igAccountId() { return process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID; }

// GET /api/sync/status
router.get('/status', async (req, res) => {
  const platforms = ['instagram', 'tiktok', 'youtube'];
  const rows = await prisma.syncLog.findMany({
    where: { platform: { in: platforms } },
  });
  const status = {};
  platforms.forEach(p => {
    const row = rows.find(r => r.platform === p);
    status[p] = row
      ? { lastSyncedAt: row.lastSyncedAt, syncedFrom: row.syncedFrom, syncedTo: row.syncedTo }
      : null;
  });
  res.json(status);
});

// POST /api/sync/instagram
router.post('/instagram', async (req, res) => {
  if (!igToken() || !igAccountId()) {
    return res.status(400).json({ error: 'Instagram credentials not configured' });
  }

  try {
    const lastSync = await prisma.syncLog.findUnique({ where: { platform: 'instagram' } });
    const syncFrom = lastSync
      ? new Date(lastSync.syncedTo)
      : new Date(Date.now() - 730 * 86400000);
    const syncTo = new Date();

    const since = Math.floor(syncFrom.getTime() / 1000);
    const until = Math.floor(syncTo.getTime() / 1000);

    // Chunk into 90-day windows
    const chunks = [];
    let chunkStart = since;
    while (chunkStart < until) {
      const chunkEnd = Math.min(chunkStart + 90 * 86400, until);
      chunks.push([chunkStart, chunkEnd]);
      chunkStart = chunkEnd;
    }

    // Fetch daily reach + total views for each chunk and upsert into DB
    let totalMetricsStored = 0;
    let totalViewsAccumulated = 0;
    const now = new Date();

    for (const [s, u] of chunks) {
      const [reachRes, viewsRes] = await Promise.all([
        axios.get(`${BASE}/${igAccountId()}/insights`, {
          params: { metric: 'reach', period: 'day', since: s, until: u, access_token: igToken() },
        }).catch(() => null),
        axios.get(`${BASE}/${igAccountId()}/insights`, {
          params: { metric: 'views', metric_type: 'total_value', period: 'day', since: s, until: u, access_token: igToken() },
        }).catch(() => null),
      ]);

      const values = reachRes?.data?.data?.[0]?.values || [];
      const chunkViews = viewsRes?.data?.data?.[0]?.values?.[0]?.value || 0;
      totalViewsAccumulated += chunkViews;

      await prisma.$transaction(
        values
          .filter(v => v.end_time)
          .map(v => {
            const date = v.end_time.split('T')[0];
            return prisma.igDailyMetric.upsert({
              where: { date },
              update: { reach: v.value || 0, syncedAt: now },
              create: { date, reach: v.value || 0, syncedAt: now },
            });
          })
      );

      totalMetricsStored += values.length;
    }

    // Fetch account info
    const accountRes = await axios.get(`${BASE}/${igAccountId()}`, {
      params: { fields: 'followers_count,username', access_token: igToken() },
    });

    // Add newly fetched views to any existing total
    const existingAccount = await prisma.igAccount.findUnique({ where: { id: 1 } });
    const cumulativeViews = (existingAccount?.views || 0) + totalViewsAccumulated;
    const followerCount = accountRes.data.followers_count || 0;

    await prisma.igAccount.upsert({
      where: { id: 1 },
      update: { followers: followerCount, username: accountRes.data.username || '', views: cumulativeViews, updatedAt: now },
      create: { id: 1, followers: followerCount, username: accountRes.data.username || '', views: cumulativeViews, updatedAt: now },
    });

    // Save follower snapshot for today
    const today = now.toISOString().split('T')[0];
    await prisma.igFollowerSnapshot.upsert({
      where: { date: today },
      update: { followers: followerCount, syncedAt: now },
      create: { date: today, followers: followerCount, syncedAt: now },
    });

    // Fetch recent posts
    const mediaRes = await axios.get(`${BASE}/${igAccountId()}/media`, {
      params: {
        fields: 'id,media_type,media_product_type,thumbnail_url,media_url,caption,timestamp,like_count,comments_count,video_duration',
        limit: 100,
        access_token: igToken(),
      },
    });
    const posts = mediaRes.data.data || [];

    // Fetch per-post insights
    const postInsights = await Promise.all(
      posts.map(p =>
        axios.get(`${BASE}/${p.id}/insights`, {
          params: { metric: 'reach,saved,shares,views,likes,comments', access_token: igToken() },
        })
        .then(r => ({ id: p.id, insights: r.data.data }))
        .catch(() => ({ id: p.id, insights: [] }))
      )
    );

    const insightMap = {};
    postInsights.forEach(({ id, insights }) => {
      insightMap[id] = {};
      (insights || []).forEach(m => { insightMap[id][m.name] = m.values?.[0]?.value ?? 0; });
    });

    // Fetch follows separately for all posts
    const followsInsights = await Promise.all(
      posts.map(p =>
        axios.get(`${BASE}/${p.id}/insights`, {
          params: { metric: 'follows', access_token: igToken() },
        })
        .then(r => ({ id: p.id, follows: r.data.data?.[0]?.values?.[0]?.value || 0 }))
        .catch(() => ({ id: p.id, follows: 0 }))
      )
    );
    followsInsights.forEach(({ id, follows }) => {
      if (insightMap[id]) insightMap[id].follows = follows;
    });

    // Fetch avg watch time for Reels only
    const reelPosts = posts.filter(p => p.media_product_type === 'REELS');
    const watchTimeInsights = await Promise.all(
      reelPosts.map(p =>
        axios.get(`${BASE}/${p.id}/insights`, {
          params: { metric: 'ig_reels_avg_watch_time', access_token: igToken() },
        })
        .then(r => ({ id: p.id, avgWatchTime: r.data.data?.[0]?.values?.[0]?.value || 0 }))
        .catch(() => ({ id: p.id, avgWatchTime: 0 }))
      )
    );
    watchTimeInsights.forEach(({ id, avgWatchTime }) => {
      if (insightMap[id]) insightMap[id].avgWatchTime = avgWatchTime;
    });

    await prisma.$transaction(
      posts.map(p => {
        const ins = insightMap[p.id] || {};
        const likes = ins.likes || p.like_count || 0;
        const comments = ins.comments || p.comments_count || 0;
        const shares = ins.shares || 0;
        const saves = ins.saved || 0;
        const reach = ins.reach || 0;
        const views = ins.views || 0;
        const follows = ins.follows || 0;
        const avgWatchTime = ins.avgWatchTime || 0;
        const videoDuration = Math.round((p.video_duration || 0) * 1000); // convert s → ms to match avgWatchTime
        const engagementRate = reach > 0 ? ((likes + comments + shares + saves) / reach) * 100 : 0;
        const mediaType = p.media_product_type === 'REELS' ? 'REEL' : (p.media_type || '');

        return prisma.igPost.upsert({
          where: { id: p.id },
          update: { mediaType, thumbnail: p.thumbnail_url || p.media_url || '', caption: (p.caption || '').slice(0, 200), likes, comments, shares, saves, reach, views, follows, avgWatchTime, engagementRate, postedAt: p.timestamp || '', syncedAt: now },
          create: { id: p.id, mediaType, thumbnail: p.thumbnail_url || p.media_url || '', caption: (p.caption || '').slice(0, 200), likes, comments, shares, saves, reach, views, follows, avgWatchTime, videoDuration: 0, engagementRate, postedAt: p.timestamp || '', syncedAt: now },
        });
      })
    );

    // Update sync log
    await prisma.syncLog.upsert({
      where: { platform: 'instagram' },
      update: { lastSyncedAt: now, syncedFrom: syncFrom, syncedTo: syncTo },
      create: { platform: 'instagram', lastSyncedAt: now, syncedFrom: syncFrom, syncedTo: syncTo },
    });

    cache.flushAll();

    res.json({
      success: true,
      lastSyncedAt: now.toISOString(),
      metricsStored: totalMetricsStored,
      postsStored: posts.length,
    });
  } catch (err) {
    console.error('[Sync:Instagram]', err.response?.data || err.message);
    res.status(500).json({
      error: 'Sync failed',
      detail: err.response?.data?.error?.message || err.message,
    });
  }
});

// POST /api/sync/token/exchange
// Exchanges a short-lived token for a 60-day long-lived token and saves it to .env
router.post('/token/exchange', async (req, res) => {
  const { password } = req.body;
  const expectedPassword = process.env.TOKEN_REFRESH_PASSWORD || 'changeme';
  if (!password || password !== expectedPassword) {
    return res.status(401).json({ error: 'Invalid password' });
  }

  const appId = process.env.FACEBOOK_APP_ID;
  const appSecret = process.env.FACEBOOK_APP_SECRET;
  const currentToken = igToken();

  if (!appId || !appSecret) {
    return res.status(400).json({ error: 'FACEBOOK_APP_ID and FACEBOOK_APP_SECRET must be set in .env' });
  }
  if (!currentToken) {
    return res.status(400).json({ error: 'No INSTAGRAM_ACCESS_TOKEN found in .env' });
  }

  try {
    const r = await axios.get(`${BASE}/oauth/access_token`, {
      params: {
        grant_type: 'fb_exchange_token',
        client_id: appId,
        client_secret: appSecret,
        fb_exchange_token: currentToken,
      },
    });

    const newToken = r.data.access_token;
    const expiresIn = r.data.expires_in; // seconds

    // Update in memory immediately so sync works without restart
    process.env.INSTAGRAM_ACCESS_TOKEN = newToken;

    // Write back to .env file for persistence
    const fs = require('fs');
    const path = require('path');
    const envPath = path.join(__dirname, '../.env');
    let envContent = fs.readFileSync(envPath, 'utf8');
    envContent = envContent.replace(
      /^INSTAGRAM_ACCESS_TOKEN=.*/m,
      `INSTAGRAM_ACCESS_TOKEN=${newToken}`
    );
    fs.writeFileSync(envPath, envContent, 'utf8');

    const expiresAt = new Date(Date.now() + expiresIn * 1000);

    res.json({
      success: true,
      expiresAt: expiresAt.toISOString(),
      expiresInDays: Math.round(expiresIn / 86400),
    });
  } catch (err) {
    res.status(500).json({
      error: 'Token exchange failed',
      detail: err.response?.data?.error?.message || err.message,
    });
  }
});

module.exports = router;
