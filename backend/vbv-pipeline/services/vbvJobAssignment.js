const prisma = require('../../db');
const { sendAssignmentEmail } = require('./vbvEmailService');

const ACTIVE_STATUSES = ['assigned', 'in_progress', 'submitted', 'sent_back_by_lead', 'lead_approved', 'sent_back_by_sm'];
const DEADLINE_DAYS = 5;

// Pulls open/unassigned jobs from the pool (oldest first) and randomly hands
// each one to an editor who is below the 5-job cap, until either the pool
// or the eligible-editor list is exhausted.
async function runAutoAssignment() {
  while (true) {
    const job = await prisma.vbvJob.findFirst({
      where: { status: 'open', assignedToId: null },
      orderBy: { createdAt: 'asc' },
    });
    if (!job) break;

    const editors = await prisma.vbvUser.findMany({ where: { role: 'editor', isActive: true } });

    const eligible = [];
    for (const editor of editors) {
      const activeCount = await prisma.vbvJob.count({
        where: { assignedToId: editor.id, status: { in: ACTIVE_STATUSES } },
      });
      if (activeCount < 5) eligible.push(editor);
    }
    if (!eligible.length) break;

    const editor = eligible[Math.floor(Math.random() * eligible.length)];

    const result = await prisma.vbvJob.updateMany({
      where: { id: job.id, status: 'open', assignedToId: null },
      data: { assignedToId: editor.id, status: 'in_progress', claimedAt: new Date(), deadline: new Date(Date.now() + DEADLINE_DAYS * 86400000) },
    });
    if (result.count === 0) continue;

    await prisma.vbvTimelineLog.create({
      data: { jobId: job.id, actorId: editor.id, action: 'auto_assigned' },
    });
    await prisma.vbvActivityLog.create({
      data: { actorId: editor.id, actionType: 'job_auto_assigned', detail: `Auto-assigned job: ${job.title}` },
    });

    try {
      await sendAssignmentEmail({
        editorEmail: editor.email,
        editorName: editor.name,
        jobTitle: job.title,
        assignedBy: 'VBV Job Pool (auto-assigned)',
      });
    } catch (e) { console.error('Email error:', e.message); }
  }
}

module.exports = { runAutoAssignment };
