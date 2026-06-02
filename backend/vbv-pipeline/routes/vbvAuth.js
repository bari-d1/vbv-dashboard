const router = require('express').Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const prisma = require('../../db');

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  const user = await prisma.vbvUser.findUnique({ where: { email } });
  if (!user || !user.isActive) return res.status(401).json({ error: 'Invalid credentials' });

  const match = await bcrypt.compare(password, user.passwordHash);
  if (!match) return res.status(401).json({ error: 'Invalid credentials' });

  const sermonAccess = user.role === 'admin' || user.role === 'vedits' || user.sermonPipelineAccess;
  const token = jwt.sign(
    { userId: user.id, role: user.role, name: user.name, email: user.email, sermonPipelineAccess: sermonAccess },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
  res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role, sermonPipelineAccess: sermonAccess } });
});

module.exports = router;
