const router = require('express').Router();
const prisma = require('../../db');
const auth = require('../middleware/vbvAuthMiddleware');
const role = require('../middleware/vbvRoleMiddleware');
const { sendReviewNotification, sendSmCorrectionEmail, sendSmApprovalEmail } = require('../services/vbvEmailService');

const ACTIVE_STATUSES = ['assigned', 'in_progress', 'submitted', 'sent_back_by_lead', 'lead_approved', 'sent_back_by_sm'];

// POST /vbv/jobs — social_media, lead_editor or admin creates a job
router.post('/', auth, role('social_media', 'lead_editor', 'admin'), async (req, res) => {
  const { title, artistName, briefType, sourceDriveLink, startTimestamp, endTimestamp,
          clipNotes, editInstructions, platformTargets, deadline } = req.body;

  if (!title || !artistName || !briefType || !sourceDriveLink || !platformTargets?.length || !deadline) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const job = await prisma.vbvJob.create({
    data: {
      title, artistName, briefType, sourceDriveLink,
      startTimestamp: startTimestamp || null,
      endTimestamp: endTimestamp || null,
      clipNotes: clipNotes || null,
      editInstructions: editInstructions || null,
      platformTargets,
      deadline: new Date(deadline),
      createdById: req.vbvUser.userId,
    },
  });

  await prisma.vbvTimelineLog.create({
    data: { jobId: job.id, actorId: req.vbvUser.userId, action: 'created' },
  });
  await prisma.vbvActivityLog.create({
    data: { actorId: req.vbvUser.userId, actionType: 'job_created', detail: `Created job: ${title}` },
  });

  res.status(201).json(job);
});

// GET /vbv/jobs/mine — social_media, lead_editor or admin's own created jobs
router.get('/mine', auth, role('social_media', 'lead_editor', 'admin'), async (req, res) => {
  const jobs = await prisma.vbvJob.findMany({
    where: { createdById: req.vbvUser.userId },
    include: { assignedTo: { select: { name: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json(jobs);
});

// GET /vbv/jobs/for-review — lead_approved jobs created by this social_media user
router.get('/for-review', auth, role('social_media', 'admin'), async (req, res) => {
  const jobs = await prisma.vbvJob.findMany({
    where: { status: 'lead_approved', createdById: req.vbvUser.userId },
    include: {
      assignedTo: { select: { id: true, name: true, email: true } },
      submissions: { orderBy: { submittedAt: 'desc' }, take: 1 },
      timelineLogs: { include: { actor: { select: { name: true } } }, orderBy: { createdAt: 'asc' } },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json(jobs);
});

// GET /vbv/jobs/pool — open unassigned jobs
router.get('/pool', auth, role('editor', 'lead_editor', 'admin'), async (req, res) => {
  const jobs = await prisma.vbvJob.findMany({
    where: { status: 'open', assignedToId: null },
    include: { createdBy: { select: { name: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json(jobs);
});

// GET /vbv/jobs/assigned — editor's or lead_editor's own assigned jobs
router.get('/assigned', auth, role('editor', 'lead_editor'), async (req, res) => {
  const jobs = await prisma.vbvJob.findMany({
    where: { assignedToId: req.vbvUser.userId },
    include: {
      createdBy: { select: { name: true } },
      submissions: { orderBy: { submittedAt: 'desc' } },
      timelineLogs: { include: { actor: { select: { name: true } } }, orderBy: { createdAt: 'asc' } },
    },
    orderBy: { claimedAt: 'desc' },
  });
  res.json(jobs);
});

// GET /vbv/jobs/review-queue — lead_editor review queue (submitted jobs)
router.get('/review-queue', auth, role('lead_editor', 'admin'), async (req, res) => {
  const jobs = await prisma.vbvJob.findMany({
    where: { status: 'submitted' },
    include: {
      assignedTo: { select: { id: true, name: true, email: true } },
      submissions: { orderBy: { submittedAt: 'desc' }, take: 1 },
      timelineLogs: { include: { actor: { select: { name: true } } }, orderBy: { createdAt: 'asc' } },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json(jobs);
});

// GET /vbv/jobs/in-sm-review — lead_approved jobs (read-only visibility for lead editor)
router.get('/in-sm-review', auth, role('lead_editor', 'admin'), async (req, res) => {
  const jobs = await prisma.vbvJob.findMany({
    where: { status: 'lead_approved' },
    include: {
      assignedTo: { select: { name: true } },
      createdBy: { select: { name: true } },
      submissions: { orderBy: { submittedAt: 'desc' }, take: 1 },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json(jobs);
});

// GET /vbv/jobs/completed — sm_approved jobs
router.get('/completed', auth, role('lead_editor', 'admin'), async (req, res) => {
  const jobs = await prisma.vbvJob.findMany({
    where: { status: 'sm_approved' },
    include: {
      assignedTo: { select: { name: true } },
      createdBy: { select: { name: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json(jobs);
});

// POST /vbv/jobs/:id/claim — editor or lead_editor claims a job
router.post('/:id/claim', auth, role('editor', 'lead_editor'), async (req, res) => {
  const activeCount = await prisma.vbvJob.count({
    where: { assignedToId: req.vbvUser.userId, status: { in: ACTIVE_STATUSES } },
  });
  if (activeCount >= 5) {
    return res.status(400).json({ error: 'You already have 5 active jobs. A slot frees only when a job is fully approved by Social Media.' });
  }

  const job = await prisma.vbvJob.findUnique({ where: { id: req.params.id } });
  if (!job || job.status !== 'open' || job.assignedToId) {
    return res.status(409).json({ error: 'Job is no longer available' });
  }

  const updated = await prisma.vbvJob.update({
    where: { id: req.params.id },
    data: { assignedToId: req.vbvUser.userId, status: 'in_progress', claimedAt: new Date() },
  });

  await prisma.vbvTimelineLog.create({
    data: { jobId: updated.id, actorId: req.vbvUser.userId, action: 'claimed' },
  });
  await prisma.vbvActivityLog.create({
    data: { actorId: req.vbvUser.userId, actionType: 'job_claimed', detail: `Claimed job: ${updated.title}` },
  });

  res.json(updated);
});

// POST /vbv/jobs/:id/assign — lead_editor or admin assigns a job to an editor
router.post('/:id/assign', auth, role('lead_editor', 'admin'), async (req, res) => {
  const { editorId } = req.body;
  if (!editorId) return res.status(400).json({ error: 'editorId required' });

  const updated = await prisma.vbvJob.update({
    where: { id: req.params.id },
    data: { assignedToId: editorId, status: 'assigned', claimedAt: new Date() },
  });

  await prisma.vbvTimelineLog.create({
    data: { jobId: updated.id, actorId: req.vbvUser.userId, action: 'assigned', note: 'Assigned to editor' },
  });
  await prisma.vbvActivityLog.create({
    data: { actorId: req.vbvUser.userId, actionType: 'job_assigned', detail: `Assigned job: ${updated.title}` },
  });

  res.json(updated);
});

// POST /vbv/jobs/:id/accept — editor accepts an assigned job → in_progress
router.post('/:id/accept', auth, role('editor', 'lead_editor'), async (req, res) => {
  const job = await prisma.vbvJob.findUnique({ where: { id: req.params.id } });
  if (!job) return res.status(404).json({ error: 'Job not found' });
  if (job.assignedToId !== req.vbvUser.userId) return res.status(403).json({ error: 'This job is not assigned to you' });
  if (job.status !== 'assigned') return res.status(400).json({ error: 'Job is not pending acceptance' });

  const updated = await prisma.vbvJob.update({
    where: { id: req.params.id },
    data: { status: 'in_progress' },
  });
  await prisma.vbvTimelineLog.create({
    data: { jobId: updated.id, actorId: req.vbvUser.userId, action: 'accepted' },
  });
  await prisma.vbvActivityLog.create({
    data: { actorId: req.vbvUser.userId, actionType: 'job_accepted', detail: `Accepted job: ${updated.title}` },
  });
  res.json(updated);
});

// POST /vbv/jobs/:id/approve — lead editor approves → moves to lead_approved
router.post('/:id/approve', auth, role('lead_editor', 'admin'), async (req, res) => {
  const job = await prisma.vbvJob.findUnique({
    where: { id: req.params.id },
    include: { submissions: { orderBy: { submittedAt: 'desc' }, take: 1 }, assignedTo: true },
  });
  if (!job) return res.status(404).json({ error: 'Job not found' });

  const latest = job.submissions[0];
  if (latest) {
    await prisma.vbvSubmission.update({
      where: { id: latest.id },
      data: { reviewAction: 'lead_approved', reviewedAt: new Date() },
    });
  }

  await prisma.vbvJob.update({ where: { id: req.params.id }, data: { status: 'lead_approved' } });

  await prisma.vbvTimelineLog.create({
    data: { jobId: req.params.id, actorId: req.vbvUser.userId, action: 'lead_approved' },
  });
  await prisma.vbvActivityLog.create({
    data: { actorId: req.vbvUser.userId, actionType: 'job_lead_approved', detail: `Lead approved job: ${job.title}` },
  });

  if (job.assignedTo) {
    try {
      await sendReviewNotification({
        editorEmail: job.assignedTo.email,
        editorName: job.assignedTo.name,
        jobTitle: job.title,
        action: 'lead_approved',
      });
    } catch (e) { console.error('Email error:', e.message); }
  }

  res.json({ success: true });
});

// POST /vbv/jobs/:id/send-back — lead editor sends back → sent_back_by_lead
router.post('/:id/send-back', auth, role('lead_editor', 'admin'), async (req, res) => {
  const { reviewNote } = req.body;
  if (!reviewNote?.trim()) return res.status(400).json({ error: 'Review note is required when sending back' });

  const job = await prisma.vbvJob.findUnique({
    where: { id: req.params.id },
    include: { submissions: { orderBy: { submittedAt: 'desc' }, take: 1 }, assignedTo: true },
  });
  if (!job) return res.status(404).json({ error: 'Job not found' });

  const latest = job.submissions[0];
  if (latest) {
    await prisma.vbvSubmission.update({
      where: { id: latest.id },
      data: { reviewAction: 'sent_back_by_lead', reviewNote, reviewedAt: new Date() },
    });
  }

  await prisma.vbvJob.update({ where: { id: req.params.id }, data: { status: 'sent_back_by_lead' } });

  await prisma.vbvTimelineLog.create({
    data: { jobId: req.params.id, actorId: req.vbvUser.userId, action: 'sent_back_by_lead', note: reviewNote },
  });
  await prisma.vbvActivityLog.create({
    data: { actorId: req.vbvUser.userId, actionType: 'job_sent_back_by_lead', detail: `Sent back job: ${job.title}` },
  });

  if (job.assignedTo) {
    try {
      await sendReviewNotification({
        editorEmail: job.assignedTo.email,
        editorName: job.assignedTo.name,
        jobTitle: job.title,
        action: 'sent_back_by_lead',
        reviewNote,
      });
    } catch (e) { console.error('Email error:', e.message); }
  }

  res.json({ success: true });
});

// POST /vbv/jobs/:id/sm-approve — social media approves → sm_approved
router.post('/:id/sm-approve', auth, role('social_media', 'admin'), async (req, res) => {
  const job = await prisma.vbvJob.findUnique({
    where: { id: req.params.id },
    include: {
      submissions: { orderBy: { submittedAt: 'desc' }, take: 1 },
      assignedTo: true,
    },
  });
  if (!job) return res.status(404).json({ error: 'Job not found' });
  if (job.createdById !== req.vbvUser.userId && req.vbvUser.role !== 'admin') {
    return res.status(403).json({ error: 'You can only review briefs you created' });
  }

  const latest = job.submissions[0];
  if (latest) {
    await prisma.vbvSubmission.update({
      where: { id: latest.id },
      data: { smReviewAction: 'sm_approved', smReviewedAt: new Date(), smReviewedById: req.vbvUser.userId },
    });
  }

  await prisma.vbvJob.update({ where: { id: req.params.id }, data: { status: 'sm_approved' } });

  await prisma.vbvTimelineLog.create({
    data: { jobId: req.params.id, actorId: req.vbvUser.userId, action: 'sm_approved' },
  });
  await prisma.vbvActivityLog.create({
    data: { actorId: req.vbvUser.userId, actionType: 'job_sm_approved', detail: `SM approved job: ${job.title}` },
  });

  const leadEditors = await prisma.vbvUser.findMany({ where: { role: 'lead_editor', isActive: true } });
  try {
    await sendSmApprovalEmail({
      jobTitle: job.title,
      editor: job.assignedTo,
      leadEditors,
    });
  } catch (e) { console.error('Email error:', e.message); }

  res.json({ success: true });
});

// POST /vbv/jobs/:id/sm-send-back — social media sends back → sent_back_by_sm
router.post('/:id/sm-send-back', auth, role('social_media', 'admin'), async (req, res) => {
  const { smNote } = req.body;
  if (!smNote?.trim()) return res.status(400).json({ error: 'Correction note is required' });

  const job = await prisma.vbvJob.findUnique({
    where: { id: req.params.id },
    include: {
      submissions: { orderBy: { submittedAt: 'desc' }, take: 1 },
      assignedTo: true,
    },
  });
  if (!job) return res.status(404).json({ error: 'Job not found' });
  if (job.createdById !== req.vbvUser.userId && req.vbvUser.role !== 'admin') {
    return res.status(403).json({ error: 'You can only review briefs you created' });
  }

  const latest = job.submissions[0];
  if (latest) {
    await prisma.vbvSubmission.update({
      where: { id: latest.id },
      data: { smReviewAction: 'sent_back_by_sm', smReviewNote: smNote, smReviewedAt: new Date(), smReviewedById: req.vbvUser.userId },
    });
  }

  await prisma.vbvJob.update({ where: { id: req.params.id }, data: { status: 'sent_back_by_sm' } });

  await prisma.vbvTimelineLog.create({
    data: { jobId: req.params.id, actorId: req.vbvUser.userId, action: 'sent_back_by_sm', note: smNote },
  });
  await prisma.vbvActivityLog.create({
    data: { actorId: req.vbvUser.userId, actionType: 'job_sent_back_by_sm', detail: `SM sent back job: ${job.title}` },
  });

  const leadEditors = await prisma.vbvUser.findMany({ where: { role: 'lead_editor', isActive: true } });
  try {
    await sendSmCorrectionEmail({
      jobTitle: job.title,
      editor: job.assignedTo,
      leadEditors,
      smNote,
    });
  } catch (e) { console.error('Email error:', e.message); }

  res.json({ success: true });
});

module.exports = router;
