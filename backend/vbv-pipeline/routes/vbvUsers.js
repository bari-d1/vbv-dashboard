const router = require('express').Router();
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const prisma = require('../../db');
const auth = require('../middleware/vbvAuthMiddleware');
const role = require('../middleware/vbvRoleMiddleware');
const { sendWelcomeEmail } = require('../services/vbvEmailService');

function generatePassword() {
  return crypto.randomBytes(9).toString('base64').slice(0, 12);
}

// GET /vbv/users/editors — active editors list for lead_editor assignment dropdown
router.get('/editors', auth, role('admin', 'lead_editor'), async (req, res) => {
  const editors = await prisma.vbvUser.findMany({
    where: { role: { in: ['editor', 'lead_editor'] }, isActive: true },
    select: { id: true, name: true, role: true },
    orderBy: { name: 'asc' },
  });
  res.json(editors);
});

// GET /vbv/users
router.get('/', auth, role('admin'), async (req, res) => {
  const users = await prisma.vbvUser.findMany({
    include: { credential: true },
    orderBy: { createdAt: 'desc' },
  });
  res.json(users);
});

// POST /vbv/users
router.post('/', auth, role('admin'), async (req, res) => {
  const { name, email, roleValue } = req.body;
  if (!name || !email || !roleValue) return res.status(400).json({ error: 'name, email, and role are required' });

  const plainPassword = generatePassword();
  const passwordHash = await bcrypt.hash(plainPassword, 10);

  let user;
  try {
    user = await prisma.vbvUser.create({
      data: {
        name,
        email,
        passwordHash,
        role: roleValue,
        credential: { create: { email, plainPassword } },
      },
    });
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ error: `A user with email "${email}" already exists` });
    throw err;
  }

  await prisma.vbvActivityLog.create({
    data: { actorId: req.vbvUser.userId, actionType: 'user_created', detail: `Created user ${name} (${email}) as ${roleValue}` },
  });

  try {
    await sendWelcomeEmail({ name, email, role: roleValue, password: plainPassword });
  } catch (err) {
    console.error('Welcome email failed:', err.message);
  }

  res.status(201).json({ ...user, plainPassword });
});

// PATCH /vbv/users/:id
router.patch('/:id', auth, role('admin'), async (req, res) => {
  const { roleValue, isActive, sermonPipelineAccess, autoAssignEligible } = req.body;
  const data = {};
  if (roleValue !== undefined) data.role = roleValue;
  if (isActive !== undefined) data.isActive = isActive;
  if (sermonPipelineAccess !== undefined) data.sermonPipelineAccess = sermonPipelineAccess;
  if (autoAssignEligible !== undefined) data.autoAssignEligible = autoAssignEligible;

  const user = await prisma.vbvUser.update({ where: { id: req.params.id }, data });
  await prisma.vbvActivityLog.create({
    data: { actorId: req.vbvUser.userId, actionType: 'user_updated', detail: `Updated user ${user.name}` },
  });
  res.json(user);
});

// DELETE /vbv/users/:id
router.delete('/:id', auth, role('admin'), async (req, res) => {
  const { id } = req.params;
  const user = await prisma.vbvUser.findUnique({ where: { id } });
  if (!user) return res.status(404).json({ error: 'User not found' });

  // Collect jobs created by this user so we can cascade their children
  const ownedJobs = await prisma.vbvJob.findMany({ where: { createdById: id }, select: { id: true } });
  const ownedJobIds = ownedJobs.map(j => j.id);

  await prisma.vbvTimelineLog.deleteMany({ where: { OR: [{ actorId: id }, { jobId: { in: ownedJobIds } }] } });
  await prisma.vbvActivityLog.deleteMany({ where: { actorId: id } });
  await prisma.vbvSubmission.updateMany({ where: { smReviewedById: id }, data: { smReviewedById: null } });
  await prisma.vbvSubmission.deleteMany({ where: { OR: [{ editorId: id }, { jobId: { in: ownedJobIds } }] } });
  await prisma.vbvJob.updateMany({ where: { assignedToId: id }, data: { assignedToId: null } });
  await prisma.vbvJob.deleteMany({ where: { createdById: id } });
  await prisma.vbvUserCredential.deleteMany({ where: { userId: id } });
  await prisma.vbvUser.delete({ where: { id } });

  await prisma.vbvActivityLog.create({
    data: { actorId: req.vbvUser.userId, actionType: 'user_deleted', detail: `Deleted user ${user.name} (${user.email})` },
  });
  res.json({ success: true });
});

module.exports = router;
