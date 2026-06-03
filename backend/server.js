require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const rateLimit = require('express-rate-limit');

const instagramRoutes = require('./routes/instagram');
const tiktokRoutes = require('./routes/tiktok');
const youtubeRoutes = require('./routes/youtube');
const syncRoutes = require('./routes/sync');
const postsRoutes = require('./routes/posts');
const fingerprintRoutes = require('./routes/fingerprint');
const leadsRoutes = require('./routes/leads');
const transcribeRoutes = require('./routes/transcribe');
const sourceYoutubeRoutes = require('./routes/sourceYoutube');
const sourceDriveRoutes = require('./routes/sourceDrive');
const sourceUploadRoutes = require('./routes/sourceUpload');
const sourceRouterRoutes = require('./routes/sourceRouter');
const detectRoutes = require('./routes/detect');
const pipelineRoutes = require('./routes/pipeline');
const candidatesRoutes = require('./routes/candidates');
const briefsRoutes = require('./routes/briefs');

// VBV Pipeline routes
const vbvAuthRoutes = require('./vbv-pipeline/routes/vbvAuth');
const vbvUsersRoutes = require('./vbv-pipeline/routes/vbvUsers');
const vbvJobsRoutes = require('./vbv-pipeline/routes/vbvJobs');
const vbvSubmissionsRoutes = require('./vbv-pipeline/routes/vbvSubmissions');
const vbvLogsRoutes = require('./vbv-pipeline/routes/vbvLogs');

const app = express();
const PORT = process.env.PORT || 3001;

app.set('trust proxy', 1);
app.use(cors());
app.use(express.json({ limit: '25mb' }));

// Serve static frontend
app.use(express.static(path.join(__dirname, '../frontend')));

// Rate limiting
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});

// Stricter limit for expensive pipeline endpoints (Whisper, yt-dlp, Claude API)
const pipelineLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Pipeline rate limit exceeded. Max 10 requests per 15 minutes.' },
});

// Status polling endpoint — registered before the pipeline limiter so polling
// requests don't exhaust the 10/15min expensive-operation quota.
const pipelineStatusLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Rate limit exceeded.' },
});
app.get('/api/pipeline/status/:jobId', pipelineStatusLimiter, (req, res) => {
  const job = pipelineRoutes.getJobStatus(req.params.jobId);
  if (!job) {
    return res.status(404).json({
      success: false,
      error: 'Job not found. The server may have restarted since your job was submitted.',
    });
  }
  res.json({ success: true, ...job });
});

app.get('/api/pipeline/jobs', pipelineStatusLimiter, (req, res) => {
  res.json({ success: true, jobs: pipelineRoutes.getAllJobs() });
});

app.use('/api', generalLimiter);
app.use('/vbv', generalLimiter);

app.use('/api/transcribe', pipelineLimiter);
app.use('/api/source', pipelineLimiter);
app.use('/api/detect', pipelineLimiter);
app.use('/api/pipeline', pipelineLimiter);

// API routes
app.use('/api/instagram', instagramRoutes);
app.use('/api/tiktok', tiktokRoutes);
app.use('/api/youtube', youtubeRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/posts', postsRoutes);
app.use('/api/fingerprint', fingerprintRoutes);
app.use('/api/leads', leadsRoutes);
app.use('/api/transcribe', transcribeRoutes);
app.use('/api/source/youtube', sourceYoutubeRoutes);
app.use('/api/source/drive', sourceDriveRoutes);
app.use('/api/source/upload', sourceUploadRoutes);
app.use('/api/source/route', sourceRouterRoutes);
app.use('/api/detect', detectRoutes);
app.use('/api/pipeline', pipelineRoutes);
app.use('/api/candidates', candidatesRoutes);
app.use('/api/briefs', briefsRoutes);

// VBV Pipeline
app.use('/vbv/auth', vbvAuthRoutes);
app.use('/vbv/users', vbvUsersRoutes);
app.use('/vbv/jobs', vbvJobsRoutes);
app.use('/vbv/submissions', vbvSubmissionsRoutes);
app.use('/vbv/logs', vbvLogsRoutes);

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

// Sermon candidate review page
app.get('/vbv-pipeline/review/:sessionId', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/vbv-pipeline/review.html'));
});

// Brief creation form
app.get('/vbv-pipeline/brief/:sessionId/:candidateIndex', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/vbv-pipeline/brief.html'));
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
