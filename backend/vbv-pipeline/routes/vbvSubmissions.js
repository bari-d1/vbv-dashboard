const router = require('express').Router();
const prisma = require('../../db');
const auth = require('../middleware/vbvAuthMiddleware');
const role = require('../middleware/vbvRoleMiddleware');
const { sendSubmissionEmail } = require('../services/vbvEmailService');

// POST /vbv/submissions/:jobId — editor submits an edit
router.post('/:jobId', auth, role('editor', 'lead_editor'), async (req, res) => {
  const { driveLink, editorNotes } = req.body;
  if (!driveLink) return res.status(400).json({ error: 'Drive link is required' });

  const job = await prisma.vbvJob.findUnique({ where: { id: req.params.jobId } });
  if (!job) return res.status(404).json({ error: 'Job not found' });
  if (job.assignedToId !== req.vbvUser.userId) return res.status(403).json({ error: 'This job is not assigned to you' });
  if (!['in_progress', 'sent_back_by_lead', 'sent_back_by_sm'].includes(job.status)) {
    return res.status(400).json({ error: 'This job cannot be submitted in its current state' });
  }

  const submission = await prisma.vbvSubmission.create({
    data: { jobId: req.params.jobId, editorId: req.vbvUser.userId, driveLink, editorNotes: editorNotes || null },
  });

  await prisma.vbvJob.update({ where: { id: req.params.jobId }, data: { status: 'submitted' } });

  await prisma.vbvTimelineLog.create({
    data: { jobId: req.params.jobId, actorId: req.vbvUser.userId, action: 'submitted' },
  });
  await prisma.vbvActivityLog.create({
    data: { actorId: req.vbvUser.userId, actionType: 'job_submitted', detail: `Submitted edit for: ${job.title}` },
  });

  const leadEditors = await prisma.vbvUser.findMany({ where: { role: 'lead_editor' }, select: { email: true } });
  sendSubmissionEmail({ jobTitle: job.title, editorName: req.vbvUser.name, leadEditors }).catch(() => {});

  res.status(201).json(submission);
});

module.exports = router;
