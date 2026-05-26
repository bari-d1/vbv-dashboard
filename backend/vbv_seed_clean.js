require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const SEED_TAG = '[SEED]';
const SEED_EMAILS = [
  'seed.social@vbv.com',
  'seed.editor1@vbv.com',
  'seed.editor2@vbv.com',
  'seed.leadeditor@vbv.com',
];

async function main() {
  console.log('🧹 Cleaning up seeded VBV test data…\n');

  // Find seeded users and jobs
  const seedUsers = await prisma.vbvUser.findMany({ where: { email: { in: SEED_EMAILS } } });
  const seedUserIds = seedUsers.map(u => u.id);

  const seedJobs = await prisma.vbvJob.findMany({
    where: { title: { startsWith: SEED_TAG } },
  });
  const seedJobIds = seedJobs.map(j => j.id);

  console.log(`  Found ${seedUsers.length} seeded users and ${seedJobs.length} seeded jobs.`);

  // Delete in dependency order
  const tl = await prisma.vbvTimelineLog.deleteMany({ where: { jobId: { in: seedJobIds } } });
  console.log(`  🗑  Deleted ${tl.count} timeline log entries`);

  const subs = await prisma.vbvSubmission.deleteMany({ where: { jobId: { in: seedJobIds } } });
  console.log(`  🗑  Deleted ${subs.count} submissions`);

  const jobs = await prisma.vbvJob.deleteMany({ where: { id: { in: seedJobIds } } });
  console.log(`  🗑  Deleted ${jobs.count} jobs`);

  const al = await prisma.vbvActivityLog.deleteMany({ where: { actorId: { in: seedUserIds } } });
  console.log(`  🗑  Deleted ${al.count} activity log entries`);

  const creds = await prisma.vbvUserCredential.deleteMany({ where: { userId: { in: seedUserIds } } });
  console.log(`  🗑  Deleted ${creds.count} user credentials`);

  const users = await prisma.vbvUser.deleteMany({ where: { id: { in: seedUserIds } } });
  console.log(`  🗑  Deleted ${users.count} users`);

  console.log('\n✅ All seeded test data removed. Real data is untouched.\n');
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
