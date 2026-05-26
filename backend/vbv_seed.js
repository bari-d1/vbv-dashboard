require('dotenv').config();
const bcrypt = require('bcrypt');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const SEED_TAG = '[SEED]';

const TEST_USERS = [
  { name: `${SEED_TAG} Social Media User`, email: 'seed.social@vbv.com',     role: 'social_media', password: 'Social1234!' },
  { name: `${SEED_TAG} Editor One`,        email: 'seed.editor1@vbv.com',    role: 'editor',       password: 'Editor1234!' },
  { name: `${SEED_TAG} Editor Two`,        email: 'seed.editor2@vbv.com',    role: 'editor',       password: 'Editor5678!' },
  { name: `${SEED_TAG} Lead Editor`,       email: 'seed.leadeditor@vbv.com', role: 'lead_editor',  password: 'Lead1234!'   },
];

async function main() {
  console.log('🌱 Seeding VBV pipeline with test data…\n');

  // ── Users ──────────────────────────────────────────────────────────────
  const createdUsers = {};
  for (const u of TEST_USERS) {
    const existing = await prisma.vbvUser.findUnique({ where: { email: u.email } });
    if (existing) {
      console.log(`  ⚠️  User ${u.email} already exists — skipping`);
      createdUsers[u.role] = createdUsers[u.role] || existing;
      continue;
    }
    const passwordHash = await bcrypt.hash(u.password, 10);
    const user = await prisma.vbvUser.create({
      data: {
        name: u.name, email: u.email, passwordHash, role: u.role,
        credential: { create: { email: u.email, plainPassword: u.password } },
      },
    });
    createdUsers[u.role] = createdUsers[u.role] || user;
    console.log(`  ✅ Created ${u.role}: ${u.email} / ${u.password}`);
  }

  const social     = await prisma.vbvUser.findUnique({ where: { email: 'seed.social@vbv.com' } });
  const editor1    = await prisma.vbvUser.findUnique({ where: { email: 'seed.editor1@vbv.com' } });
  const editor2    = await prisma.vbvUser.findUnique({ where: { email: 'seed.editor2@vbv.com' } });
  const leadEditor = await prisma.vbvUser.findUnique({ where: { email: 'seed.leadeditor@vbv.com' } });

  console.log('\n  Creating test jobs…\n');

  // ── 1. Open — timestamp clip ───────────────────────────────────────────
  const job1 = await prisma.vbvJob.create({ data: {
    title: `${SEED_TAG} Easter Sunday Reel`,
    artistName: 'Jordan feat. Mercy',
    briefType: 'timestamp_clip',
    sourceDriveLink: 'https://drive.google.com/seed-job-1',
    startTimestamp: '00:01:15', endTimestamp: '00:02:45',
    clipNotes: 'Highlight the bridge section. Keep the crowd reaction at the end.',
    platformTargets: ['Instagram', 'TikTok'],
    deadline: new Date(Date.now() + 3 * 86400000),
    status: 'open', createdById: social.id,
  }});
  await log(job1.id, social.id, 'created');
  console.log(`  ✅ Job 1 — open (timestamp clip)`);

  // ── 2. Open — full edit ────────────────────────────────────────────────
  const job2 = await prisma.vbvJob.create({ data: {
    title: `${SEED_TAG} Glory Season Promo`,
    artistName: 'VBV Choir',
    briefType: 'full_edit',
    sourceDriveLink: 'https://drive.google.com/seed-job-2',
    editInstructions: 'Full promo video. Use the intro hook at 0:00–0:15. Add text overlays for tour dates. Warm colour grade. 60-second cut for Instagram, full 3-min version for YouTube.',
    platformTargets: ['Instagram', 'YouTube'],
    deadline: new Date(Date.now() + 5 * 86400000),
    status: 'open', createdById: social.id,
  }});
  await log(job2.id, social.id, 'created');
  console.log(`  ✅ Job 2 — open (full edit)`);

  // ── 3. In progress — claimed by editor1 ───────────────────────────────
  const job3 = await prisma.vbvJob.create({ data: {
    title: `${SEED_TAG} Midnight Worship Clip`,
    artistName: 'Samuel & The Voices',
    briefType: 'timestamp_clip',
    sourceDriveLink: 'https://drive.google.com/seed-job-3',
    startTimestamp: '00:03:00', endTimestamp: '00:04:20',
    clipNotes: 'Moment where the whole congregation joins in. Use that as the hook.',
    platformTargets: ['TikTok'],
    deadline: new Date(Date.now() + 2 * 86400000),
    status: 'in_progress', createdById: social.id,
    assignedToId: editor1.id, claimedAt: new Date(),
  }});
  await log(job3.id, social.id, 'created');
  await log(job3.id, editor1.id, 'claimed');
  console.log(`  ✅ Job 3 — in_progress (Editor One)`);

  // ── 4. In progress — assigned by lead editor ──────────────────────────
  const job4 = await prisma.vbvJob.create({ data: {
    title: `${SEED_TAG} Friday Night Sessions Recap`,
    artistName: 'Various Artists',
    briefType: 'full_edit',
    sourceDriveLink: 'https://drive.google.com/seed-job-4',
    editInstructions: 'Highlight reel from the Friday Night Sessions. 90 seconds max. Energetic cuts, keep the audience reactions.',
    platformTargets: ['Instagram', 'TikTok', 'YouTube'],
    deadline: new Date(Date.now() + 4 * 86400000),
    status: 'in_progress', createdById: social.id,
    assignedToId: editor2.id, claimedAt: new Date(),
  }});
  await log(job4.id, social.id, 'created');
  await log(job4.id, leadEditor.id, 'assigned', 'Assigned to Editor Two by Lead Editor');
  console.log(`  ✅ Job 4 — in_progress (Editor Two, assigned by Lead Editor)`);

  // ── 5. Submitted ───────────────────────────────────────────────────────
  const job5 = await prisma.vbvJob.create({ data: {
    title: `${SEED_TAG} Hallelujah Live Cut`,
    artistName: 'Grace & Truth',
    briefType: 'timestamp_clip',
    sourceDriveLink: 'https://drive.google.com/seed-job-5',
    startTimestamp: '00:07:30', endTimestamp: '00:09:00',
    clipNotes: 'The key change moment. Let it breathe — no fast cuts here.',
    platformTargets: ['Instagram'],
    deadline: new Date(Date.now() + 1 * 86400000),
    status: 'submitted', createdById: social.id,
    assignedToId: editor1.id, claimedAt: new Date(Date.now() - 2 * 86400000),
  }});
  await log(job5.id, social.id, 'created');
  await log(job5.id, editor1.id, 'claimed');
  await prisma.vbvSubmission.create({ data: {
    jobId: job5.id, editorId: editor1.id,
    driveLink: 'https://drive.google.com/seed-submission-5',
    editorNotes: 'Happy with this one. Kept the key change moment and let it breathe as requested.',
  }});
  await log(job5.id, editor1.id, 'submitted');
  console.log(`  ✅ Job 5 — submitted (awaiting lead editor review)`);

  // ── 6. Sent back by lead editor ───────────────────────────────────────
  const job6 = await prisma.vbvJob.create({ data: {
    title: `${SEED_TAG} Rivers of Joy Promo`,
    artistName: 'Mercy Chinwo',
    briefType: 'full_edit',
    sourceDriveLink: 'https://drive.google.com/seed-job-6',
    editInstructions: 'Event promo. 45 seconds. Must include the event date and venue as text overlays.',
    platformTargets: ['Instagram', 'TikTok'],
    deadline: new Date(Date.now() + 6 * 86400000),
    status: 'sent_back_by_lead', createdById: social.id,
    assignedToId: editor2.id, claimedAt: new Date(Date.now() - 3 * 86400000),
  }});
  await log(job6.id, social.id, 'created');
  await log(job6.id, editor2.id, 'claimed');
  await prisma.vbvSubmission.create({ data: {
    jobId: job6.id, editorId: editor2.id,
    driveLink: 'https://drive.google.com/seed-submission-6',
    editorNotes: 'First pass done.',
    submittedAt: new Date(Date.now() - 1 * 86400000),
    reviewAction: 'sent_back_by_lead',
    reviewNote: 'Text overlays are missing the venue name. Also the cut at 0:30 is too abrupt — smooth it out.',
    reviewedAt: new Date(),
  }});
  await log(job6.id, editor2.id, 'submitted');
  await log(job6.id, leadEditor.id, 'sent_back_by_lead', 'Text overlays are missing the venue name. Also the cut at 0:30 is too abrupt — smooth it out.');
  console.log(`  ✅ Job 6 — sent_back_by_lead (editor needs to revise)`);

  // ── 7. Lead approved — with Social Media for review ───────────────────
  const job7 = await prisma.vbvJob.create({ data: {
    title: `${SEED_TAG} Throne Room Moment`,
    artistName: 'Nathaniel Bassey',
    briefType: 'timestamp_clip',
    sourceDriveLink: 'https://drive.google.com/seed-job-7',
    startTimestamp: '00:12:00', endTimestamp: '00:13:30',
    clipNotes: 'Pure worship moment. Minimal editing — just clean it up and colour grade.',
    platformTargets: ['Instagram', 'YouTube'],
    deadline: new Date(Date.now() + 2 * 86400000),
    status: 'lead_approved', createdById: social.id,
    assignedToId: editor1.id, claimedAt: new Date(Date.now() - 5 * 86400000),
  }});
  await log(job7.id, social.id, 'created');
  await log(job7.id, editor1.id, 'claimed');
  await prisma.vbvSubmission.create({ data: {
    jobId: job7.id, editorId: editor1.id,
    driveLink: 'https://drive.google.com/seed-submission-7',
    editorNotes: 'Clean grade applied. No music cuts needed.',
    submittedAt: new Date(Date.now() - 2 * 86400000),
    reviewAction: 'lead_approved',
    reviewedAt: new Date(Date.now() - 1 * 86400000),
  }});
  await log(job7.id, editor1.id, 'submitted');
  await log(job7.id, leadEditor.id, 'lead_approved');
  console.log(`  ✅ Job 7 — lead_approved (with Social Media for review)`);

  // ── 8. Sent back by SM ─────────────────────────────────────────────────
  const job8 = await prisma.vbvJob.create({ data: {
    title: `${SEED_TAG} Revival Night Recap`,
    artistName: 'House of Praise',
    briefType: 'full_edit',
    sourceDriveLink: 'https://drive.google.com/seed-job-8',
    editInstructions: 'Revival night recap. 2-minute cut. Open with the crowd, close on the altar call moment.',
    platformTargets: ['Instagram', 'YouTube'],
    deadline: new Date(Date.now() + 3 * 86400000),
    status: 'sent_back_by_sm', createdById: social.id,
    assignedToId: editor2.id, claimedAt: new Date(Date.now() - 7 * 86400000),
  }});
  await log(job8.id, social.id, 'created');
  await log(job8.id, editor2.id, 'claimed');
  await prisma.vbvSubmission.create({ data: {
    jobId: job8.id, editorId: editor2.id,
    driveLink: 'https://drive.google.com/seed-submission-8',
    editorNotes: 'Used the altar call as the close as requested.',
    submittedAt: new Date(Date.now() - 4 * 86400000),
    reviewAction: 'lead_approved',
    reviewedAt: new Date(Date.now() - 3 * 86400000),
    smReviewAction: 'sent_back_by_sm',
    smReviewNote: 'The opening crowd shot is too long — trim the first 8 seconds. Also the colour grade feels too cool, warm it up.',
    smReviewedAt: new Date(Date.now() - 1 * 86400000),
    smReviewedById: social.id,
  }});
  await log(job8.id, editor2.id, 'submitted');
  await log(job8.id, leadEditor.id, 'lead_approved');
  await log(job8.id, social.id, 'sent_back_by_sm', 'The opening crowd shot is too long — trim the first 8 seconds. Also the colour grade feels too cool, warm it up.');
  console.log(`  ✅ Job 8 — sent_back_by_sm (SM requested correction, editor to revise)`);

  // ── 9. SM Approved — pipeline complete ────────────────────────────────
  const job9 = await prisma.vbvJob.create({ data: {
    title: `${SEED_TAG} Overflow Sunday Highlights`,
    artistName: 'VBV Worship Team',
    briefType: 'timestamp_clip',
    sourceDriveLink: 'https://drive.google.com/seed-job-9',
    startTimestamp: '00:05:00', endTimestamp: '00:06:30',
    clipNotes: 'The spontaneous moment at the end. No heavy editing needed.',
    platformTargets: ['Instagram', 'TikTok'],
    deadline: new Date(Date.now() - 2 * 86400000),
    status: 'sm_approved', createdById: social.id,
    assignedToId: editor1.id, claimedAt: new Date(Date.now() - 10 * 86400000),
  }});
  await log(job9.id, social.id, 'created');
  await log(job9.id, editor1.id, 'claimed');
  await prisma.vbvSubmission.create({ data: {
    jobId: job9.id, editorId: editor1.id,
    driveLink: 'https://drive.google.com/seed-submission-9',
    editorNotes: 'Minimal cut — kept it authentic as requested.',
    submittedAt: new Date(Date.now() - 6 * 86400000),
    reviewAction: 'lead_approved',
    reviewedAt: new Date(Date.now() - 5 * 86400000),
    smReviewAction: 'sm_approved',
    smReviewedAt: new Date(Date.now() - 3 * 86400000),
    smReviewedById: social.id,
  }});
  await log(job9.id, editor1.id, 'submitted');
  await log(job9.id, leadEditor.id, 'lead_approved');
  await log(job9.id, social.id, 'sm_approved');
  console.log(`  ✅ Job 9 — sm_approved (pipeline complete)`);

  console.log('\n✅ Seed complete.\n');
  console.log('Test credentials:');
  for (const u of TEST_USERS) {
    console.log(`  ${u.role.padEnd(14)} ${u.email}  /  ${u.password}`);
  }
  console.log('\nRun `node vbv_seed_clean.js` to remove all seeded data.\n');
}

async function log(jobId, actorId, action, note) {
  await prisma.vbvTimelineLog.create({ data: { jobId, actorId, action, note: note || null } });
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
