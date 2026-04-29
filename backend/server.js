require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const instagramRoutes = require('./routes/instagram');
const tiktokRoutes = require('./routes/tiktok');
const youtubeRoutes = require('./routes/youtube');
const syncRoutes = require('./routes/sync');
const postsRoutes = require('./routes/posts');
const fingerprintRoutes = require('./routes/fingerprint');
const leadsRoutes = require('./routes/leads');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '25mb' }));

// Serve static frontend
app.use(express.static(path.join(__dirname, '../frontend')));

// API routes
app.use('/api/instagram', instagramRoutes);
app.use('/api/tiktok', tiktokRoutes);
app.use('/api/youtube', youtubeRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/posts', postsRoutes);
app.use('/api/fingerprint', fingerprintRoutes);
app.use('/api/leads', leadsRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    platforms: {
      instagram: !!(process.env.INSTAGRAM_ACCESS_TOKEN && process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID),
      tiktok: !!process.env.TIKTOK_ACCESS_TOKEN,
      youtube: !!(process.env.YOUTUBE_API_KEY && process.env.YOUTUBE_CHANNEL_ID),
    },
  });
});

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`\nVerse by Verse Analytics Server`);
  console.log(`Running on http://localhost:${PORT}`);
  console.log(`Instagram: ${process.env.INSTAGRAM_ACCESS_TOKEN ? 'configured' : 'demo mode'}`);
  console.log(`TikTok:    ${process.env.TIKTOK_ACCESS_TOKEN ? 'configured' : 'demo mode'}`);
  console.log(`YouTube:   ${process.env.YOUTUBE_API_KEY ? 'configured' : 'demo mode'}\n`);
});
