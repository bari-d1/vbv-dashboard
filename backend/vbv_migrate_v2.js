require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🔄 Running VBV v2 migration (status rename + SM review fields)…\n');

  // 1. Add new VbvJobStatus enum values
  await prisma.$executeRawUnsafe(`ALTER TYPE "VbvJobStatus" ADD VALUE IF NOT EXISTS 'sent_back_by_lead'`);
  await prisma.$executeRawUnsafe(`ALTER TYPE "VbvJobStatus" ADD VALUE IF NOT EXISTS 'lead_approved'`);
  await prisma.$executeRawUnsafe(`ALTER TYPE "VbvJobStatus" ADD VALUE IF NOT EXISTS 'sent_back_by_sm'`);
  await prisma.$executeRawUnsafe(`ALTER TYPE "VbvJobStatus" ADD VALUE IF NOT EXISTS 'sm_approved'`);
  console.log('  ✅ Added new VbvJobStatus enum values');

  // 2. Migrate existing job status data
  const jobsSB = await prisma.$executeRawUnsafe(
    `UPDATE "VbvJob" SET status = 'sent_back_by_lead' WHERE status = 'sent_back'`
  );
  const jobsAP = await prisma.$executeRawUnsafe(
    `UPDATE "VbvJob" SET status = 'lead_approved' WHERE status = 'approved'`
  );
  console.log(`  ✅ Migrated ${jobsSB} job(s) sent_back → sent_back_by_lead`);
  console.log(`  ✅ Migrated ${jobsAP} job(s) approved → lead_approved`);

  // 3. Add new VbvReviewAction enum values
  await prisma.$executeRawUnsafe(`ALTER TYPE "VbvReviewAction" ADD VALUE IF NOT EXISTS 'lead_approved'`);
  await prisma.$executeRawUnsafe(`ALTER TYPE "VbvReviewAction" ADD VALUE IF NOT EXISTS 'sent_back_by_lead'`);
  console.log('  ✅ Added new VbvReviewAction enum values');

  // 4. Migrate existing submission reviewAction data
  const subAP = await prisma.$executeRawUnsafe(
    `UPDATE "VbvSubmission" SET "reviewAction" = 'lead_approved' WHERE "reviewAction" = 'approved'`
  );
  const subSB = await prisma.$executeRawUnsafe(
    `UPDATE "VbvSubmission" SET "reviewAction" = 'sent_back_by_lead' WHERE "reviewAction" = 'sent_back'`
  );
  console.log(`  ✅ Migrated ${subAP} submission(s) approved → lead_approved`);
  console.log(`  ✅ Migrated ${subSB} submission(s) sent_back → sent_back_by_lead`);

  // 5. Migrate timeline log action names
  const tlSB = await prisma.$executeRawUnsafe(
    `UPDATE "VbvTimelineLog" SET action = 'sent_back_by_lead' WHERE action = 'sent_back'`
  );
  const tlAP = await prisma.$executeRawUnsafe(
    `UPDATE "VbvTimelineLog" SET action = 'lead_approved' WHERE action = 'approved'`
  );
  console.log(`  ✅ Migrated ${tlSB} timeline log(s) sent_back → sent_back_by_lead`);
  console.log(`  ✅ Migrated ${tlAP} timeline log(s) approved → lead_approved`);

  // 6. Add SM review enum type if it doesn't exist
  await prisma.$executeRawUnsafe(`
    DO $$ BEGIN
      CREATE TYPE "VbvSmReviewAction" AS ENUM ('sm_approved', 'sent_back_by_sm');
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
  `);
  console.log('  ✅ Created VbvSmReviewAction enum');

  // 7. Add SM review columns to VbvSubmission if they don't exist
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "VbvSubmission"
      ADD COLUMN IF NOT EXISTS "smReviewNote"   TEXT,
      ADD COLUMN IF NOT EXISTS "smReviewedAt"   TIMESTAMP(3),
      ADD COLUMN IF NOT EXISTS "smReviewAction" "VbvSmReviewAction",
      ADD COLUMN IF NOT EXISTS "smReviewedById" TEXT
  `);
  console.log('  ✅ Added SM review columns to VbvSubmission');

  // 8. Add FK constraint for smReviewedById if it doesn't exist
  await prisma.$executeRawUnsafe(`
    DO $$ BEGIN
      ALTER TABLE "VbvSubmission"
        ADD CONSTRAINT "VbvSubmission_smReviewedById_fkey"
        FOREIGN KEY ("smReviewedById") REFERENCES "VbvUser"(id)
        ON DELETE SET NULL ON UPDATE CASCADE;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
  `);
  console.log('  ✅ Added FK constraint for smReviewedById');

  console.log('\n✅ Migration complete. Now run: npx prisma generate\n');
}

main().catch(e => { console.error('Migration failed:', e); process.exit(1); }).finally(() => prisma.$disconnect());
