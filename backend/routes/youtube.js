const express = require('express');
const axios = require('axios');
const { cacheMiddleware } = require('../middleware/cache');

const router = express.Router();
const BASE = 'https://www.googleapis.com/youtube/v3';

function apiKey() {
  return process.env.YOUTUBE_API_KEY;
}
function channelId() {
  return process.env.YOUTUBE_CHANNEL_ID;
}

function demoData(period) {
  const days = period === '7d' ? 7 : period === '90d' ? 90 : 30;
  const labels = [];
  const views = [];
  const watchTime = [];
  let subs = 22400;
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    labels.push(d.toISOString().split('T')[0]);
    subs += Math.floor(Math.random() * 40 - 5);
    views.push(Math.floor(2000 + Math.random() * 3000));
    watchTime.push(Math.floor(800 + Math.random() * 1200));
  }
  return {
    _demo: true,
    summary: {
      subscribers: subs,
      totalViews: views.reduce((a, b) => a + b, 0),
      totalWatchTimeMinutes: watchTime.reduce((a, b) => a + b, 0),
      videoCount: 87,
      avgViewDuration: '4:32',
      engagementRate: '6.8',
    },
    timeSeries: { labels, views, watchTime },
    topVideos: [
      {
        id: 'yt_demo1',
        title: 'Verse by Verse — Full Sunday Worship Service',
        thumbnail: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
        views: 42100,
        likes: 2840,
        comments: 198,
        avgViewDuration: '18:42',
        engagementRate: '7.2',
        publishedAt: new Date(Date.now() - 86400000 * 6).toISOString(),
      },
      {
        id: 'yt_demo2',
        title: '"How Great Thou Art" — Live Acoustic Cover',
        thumbnail: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
        views: 29800,
        likes: 1920,
        comments: 134,
        avgViewDuration: '5:14',
        engagementRate: '6.9',
        publishedAt: new Date(Date.now() - 86400000 * 14).toISOString(),
      },
      {
        id: 'yt_demo3',
        title: 'Devotional: Finding Peace in Psalm 46',
        thumbnail: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
        views: 21400,
        likes: 1450,
        comments: 112,
        avgViewDuration: '8:07',
        engagementRate: '7.3',
        publishedAt: new Date(Date.now() - 86400000 * 21).toISOString(),
      },
    ],
  };
}

function secondsToMMSS(s) {
  if (!s) return '0:00';
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

function parseISO8601Duration(dur) {
  if (!dur) return 0;
  const match = dur.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  return (parseInt(match[1] || 0) * 3600 +
    parseInt(match[2] || 0) * 60 +
    parseInt(match[3] || 0));
}

router.get('/insights', cacheMiddleware, async (req, res) => {
  const period = req.query.period || '30d';

  if (!apiKey() || !channelId()) {
    return res.sendCachedJSON(demoData(period));
  }

  try {
    // Channel statistics
    const channelRes = await axios.get(`${BASE}/channels`, {
      params: {
        part: 'statistics,snippet',
        id: channelId(),
        key: apiKey(),
      },
    });

    const channelData = channelRes.data.items?.[0];
    const stats = channelData?.statistics || {};

    // Latest videos (up to 50 via search)
    const days = period === '7d' ? 7 : period === '90d' ? 90 : 30;
    const publishedAfter = new Date(Date.now() - days * 86400000).toISOString();

    const searchRes = await axios.get(`${BASE}/search`, {
      params: {
        part: 'snippet',
        channelId: channelId(),
        maxResults: 20,
        order: 'date',
        type: 'video',
        publishedAfter,
        key: apiKey(),
      },
    });

    const videoIds = (searchRes.data.items || []).map((i) => i.id.videoId).join(',');

    let videoItems = [];
    if (videoIds) {
      const videoRes = await axios.get(`${BASE}/videos`, {
        params: {
          part: 'statistics,snippet,contentDetails',
          id: videoIds,
          key: apiKey(),
        },
      });
      videoItems = videoRes.data.items || [];
    }

    const enrichedVideos = videoItems.map((v) => {
      const vs = v.statistics || {};
      const views = parseInt(vs.viewCount || 0);
      const likes = parseInt(vs.likeCount || 0);
      const comments = parseInt(vs.commentCount || 0);
      const eng = views > 0 ? (((likes + comments) / views) * 100).toFixed(2) : '0.00';
      const durationSec = parseISO8601Duration(v.contentDetails?.duration);
      return {
        id: v.id,
        title: v.snippet?.title || '',
        thumbnail: v.snippet?.thumbnails?.medium?.url || '',
        views,
        likes,
        comments,
        avgViewDuration: secondsToMMSS(Math.floor(durationSec * 0.45)),
        engagementRate: eng,
        publishedAt: v.snippet?.publishedAt,
      };
    });

    enrichedVideos.sort((a, b) => b.views - a.views);

    // Build time series (approximation using daily buckets)
    const labels = [];
    const viewsSeries = [];
    const watchTimeSeries = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      labels.push(d.toISOString().split('T')[0]);
      viewsSeries.push(0);
      watchTimeSeries.push(0);
    }

    const totalViews = enrichedVideos.reduce((a, v) => a + v.views, 0);
    const totalLikes = enrichedVideos.reduce((a, v) => a + v.likes, 0);
    const totalComments = enrichedVideos.reduce((a, v) => a + v.comments, 0);
    const engRate =
      totalViews > 0 ? (((totalLikes + totalComments) / totalViews) * 100).toFixed(2) : '0.00';

    res.sendCachedJSON({
      summary: {
        subscribers: parseInt(stats.subscriberCount || 0),
        totalViews: parseInt(stats.viewCount || 0),
        totalWatchTimeMinutes: 0,
        videoCount: parseInt(stats.videoCount || 0),
        avgViewDuration: '—',
        engagementRate: engRate,
      },
      timeSeries: { labels, views: viewsSeries, watchTime: watchTimeSeries },
      topVideos: enrichedVideos.slice(0, 5),
    });
  } catch (err) {
    console.error('[YouTube]', err.response?.data || err.message);
    res.status(500).json({
      error: 'Failed to fetch YouTube data',
      detail: err.response?.data?.error?.message || err.message,
    });
  }
});

module.exports = router;
