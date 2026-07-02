const prisma = require('../../db');
const { sendAssignmentEmail } = require('./vbvEmailService');

const ACTIVE_STATUSES = ['assigned', 'in_progress', 'submitted', 'sent_back_by_lead', 'lead_approved', 'sent_back_by_sm'];
const DEADLINE_DAYS = 5;

// Pulls open/unassigned jobs from the pool (oldest first) and assigns each one
// using church affinity + load-awareness:
//   1. Prefer editors who already have a job from the same church (artistName),
//      picking the one with the fewest active jobs among them.
//   2. Fall back to the least-loaded eligible editor if no church-affinity match.
// Always respects the 5-job cap and autoAssignEligible flag.
async function runAutoAssignment() {
  while (true) {
    const job = await prisma.vbvJob.findFirst({
      where: { status: 'open', assignedToId: null },
      orderBy: { createdAt: 'asc' },
    });
    if (!job) break;

    const editors = await prisma.vbvUser.findMany({ where: { role: 'editor', isActive: true, autoAssignEligible: true } });

    const eligible = [];
    for (const editor of editors) {
      const activeCount = await prisma.vbvJob.count({
        where: { assignedToId: editor.id, status: { in: ACTIVE_STATUSES } },
      });
      if (activeCount < 5) eligible.push({ ...editor, activeCount });
    }
    if (!eligible.length) break;

    // Among eligible editors, find those who already have a job from this church
    const churchEditorIds = await prisma.vbvJob.findMany({
      where: { artistName: job.artistName, assignedToId: { not: null } },
      select: { assignedToId: true },
      distinct: ['assignedToId'],
    }).then(rows => new Set(rows.map(r => r.assignedToId)));

    const affinityMatches = eligible.filter(e => churchEditorIds.has(e.id));
    const pool = affinityMatches.length ? affinityMatches : eligible;

    // Pick the least-loaded editor from the pool (random tiebreak)
    const minLoad = Math.min(...pool.map(e => e.activeCount));
    const candidates = pool.filter(e => e.activeCount === minLoad);
    const editor = candidates[Math.floor(Math.random() * candidates.length)];

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
