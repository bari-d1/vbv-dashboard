const express = require('express');
const axios = require('axios');
const { cacheMiddleware } = require('../middleware/cache');

const router = express.Router();

function token() {
  return process.env.TIKTOK_ACCESS_TOKEN;
}

function demoData(period) {
  const days = period === '7d' ? 7 : period === '90d' ? 90 : 30;
  const labels = [];
  const views = [];
  const followers = [];
  let f = 8900;
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    labels.push(d.toISOString().split('T')[0]);
    f += Math.floor(Math.random() * 60 - 5);
    followers.push(f);
    views.push(Math.floor(4000 + Math.random() * 6000));
  }
  return {
    _demo: true,
    summary: {
      followers: f,
      totalViews: views.reduce((a, b) => a + b, 0),
      totalLikes: Math.floor(views.reduce((a, b) => a + b, 0) * 0.08),
      totalComments: Math.floor(views.reduce((a, b) => a + b, 0) * 0.012),
      totalShares: Math.floor(views.reduce((a, b) => a + b, 0) * 0.018),
      engagementRate: '10.7',
    },
    timeSeries: { labels, views, followers },
    topVideos: [
      {
        id: 'tt_demo1',
        title: '"Oceans" cover — worship night',
        thumbnail: '',
        views: 84200,
        likes: 7100,
        comments: 312,
        shares: 1840,
        engagementRate: '11.0',
        duration: 62,
        createTime: new Date(Date.now() - 86400000 * 4).toISOString(),
      },
      {
        id: 'tt_demo2',
        title: 'Isaiah 41:10 — daily verse',
        thumbnail: '',
        views: 61400,
        likes: 5400,
        comments: 210,
        shares: 1290,
        engagementRate: '11.2',
        duration: 30,
        createTime: new Date(Date.now() - 86400000 * 9).toISOString(),
      },
      {
        id: 'tt_demo3',
        title: 'Behind the song — "Worthy Is The Lamb"',
        thumbnail: '',
        views: 47800,
        likes: 4200,
        comments: 188,
        shares: 920,
        engagementRate: '11.1',
        duration: 95,
        createTime: new Date(Date.now() - 86400000 * 15).toISOString(),
      },
    ],
  };
}

router.get('/insights', cacheMiddleware, async (req, res) => {
  const period = req.query.period || '30d';

  if (!token()) {
    return res.sendCachedJSON(demoData(period));
  }

  try {
    // TikTok Display API — user info
    const userRes = await axios.get('https://open.tiktokapis.com/v2/user/info/', {
      params: {
        fields: 'open_id,display_name,follower_count,following_count,likes_count,video_count',
      },
      headers: { Authorization: `Bearer ${token()}` },
    });

    const userInfo = userRes.data.data?.user || {};

    // Video list
    const videoRes = await axios.post(
      'https://open.tiktokapis.com/v2/video/list/',
      { max_count: 20 },
      {
        params: {
          fields: 'id,title,cover_image_url,view_count,like_count,comment_count,share_count,duration,create_time',
        },
        headers: {
          Authorization: `Bearer ${token()}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const videos = videoRes.data.data?.videos || [];

    const enriched = videos.map((v) => {
      const total = (v.like_count || 0) + (v.comment_count || 0) + (v.share_count || 0);
      const rate = v.view_count > 0 ? ((total / v.view_count) * 100).toFixed(2) : '0.00';
      return {
        id: v.id,
        title: v.title || '',
        thumbnail: v.cover_image_url || '',
        views: v.view_count || 0,
        likes: v.like_count || 0,
        comments: v.comment_count || 0,
        shares: v.share_count || 0,
        engagementRate: rate,
        duration: v.duration || 0,
        createTime: new Date((v.create_time || 0) * 1000).toISOString(),
      };
    });

    enriched.sort((a, b) => b.views - a.views);

    const days = period === '7d' ? 7 : period === '90d' ? 90 : 30;
    const labels = [];
    const viewsSeries = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      labels.push(d.toISOString().split('T')[0]);
      viewsSeries.push(0);
    }

    const totalViews = enriched.reduce((a, v) => a + v.views, 0);
    const totalLikes = enriched.reduce((a, v) => a + v.likes, 0);
    const totalComments = enriched.reduce((a, v) => a + v.comments, 0);
    const totalShares = enriched.reduce((a, v) => a + v.shares, 0);
    const totalEng = totalLikes + totalComments + totalShares;
    const engRate = totalViews > 0 ? ((totalEng / totalViews) * 100).toFixed(2) : '0.00';

    res.sendCachedJSON({
      summary: {
        followers: userInfo.follower_count || 0,
        totalViews,
        totalLikes,
        totalComments,
        totalShares,
        engagementRate: engRate,
      },
      timeSeries: { labels, views: viewsSeries, followers: [] },
      topVideos: enriched.slice(0, 5),
    });
  } catch (err) {
    console.error('[TikTok]', err.response?.data || err.message);
    res.status(500).json({
      error: 'Failed to fetch TikTok data',
      detail: err.response?.data?.error?.message || err.message,
    });
  }
});

module.exports = router;
