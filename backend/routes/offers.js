const router = require('express').Router();
const bcrypt = require('bcrypt');
const rateLimit = require('express-rate-limit');
const prisma = require('../db');

const viewLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});

const unlockLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts, please try again later.' },
});

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function gateShell({ churchName, slug }) {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(churchName)} | VBV Edits</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&display=swap" rel="stylesheet">
<style>
  :root { --bg: #f5f4ef; --text: #0a0a0a; --text-secondary: rgba(10,10,10,0.7); --accent: #e20415; --line: rgba(10,10,10,0.12); }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: var(--bg); color: var(--text); font-family: 'Space Mono', monospace; line-height: 1.5; min-height: 100vh; padding: 24px; }
  .wrap { max-width: 420px; margin: 0 auto; padding-top: 15vh; }
  h1 { font-size: 22px; font-weight: 700; margin-bottom: 12px; }
  p { color: var(--text-secondary); font-size: 15px; margin-bottom: 24px; }
  input { width: 100%; font-family: inherit; font-size: 16px; background: #fff; color: var(--text); border: 1px solid var(--line); padding: 14px; margin-bottom: 12px; }
  input:focus { outline: 2px solid var(--accent); outline-offset: -1px; }
  button { width: 100%; background: var(--accent); color: var(--bg); border: none; font-family: inherit; font-weight: 700; font-size: 16px; padding: 16px; cursor: pointer; }
  button:disabled { opacity: 0.5; cursor: not-allowed; }
  .error { display: none; color: var(--accent); font-size: 13px; margin-top: -4px; margin-bottom: 16px; }
  #offer-content { display: none; }
</style>
</head>
<body>
  <div class="wrap" id="gate">
    <h1>${escapeHtml(churchName)}</h1>
    <p>This page is protected. Enter the password your VBV Edits contact gave you.</p>
    <form id="unlock-form">
      <input type="password" id="password" placeholder="Password" required autofocus>
      <p class="error" id="unlock-error">Wrong password, try again.</p>
      <button type="submit" id="unlock-btn">Unlock</button>
    </form>
  </div>
  <div id="offer-content"></div>
  <script>
    var form = document.getElementById('unlock-form');
    var err = document.getElementById('unlock-error');
    var btn = document.getElementById('unlock-btn');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      err.style.display = 'none';
      btn.disabled = true;
      fetch(${JSON.stringify(`https://vbv-dashboard.dayoadebari.com/offer/${slug}/unlock`)}, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: document.getElementById('password').value }),
      })
        .then(function (res) { return res.json().then(function (data) { return { ok: res.ok, data: data }; }); })
        .then(function (result) {
          if (!result.ok) {
            err.style.display = 'block';
            btn.disabled = false;
            return;
          }
          document.getElementById('gate').style.display = 'none';
          var content = document.getElementById('offer-content');
          content.innerHTML = result.data.offerHtml;
          content.style.display = 'block';
        })
        .catch(function () {
          err.textContent = 'Something went wrong. Try again.';
          err.style.display = 'block';
          btn.disabled = false;
        });
    });
  </script>
</body>
</html>`;
}

function notFoundPage() {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>VBV Edits</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&display=swap" rel="stylesheet">
<style>
  body { background: #f5f4ef; color: #0a0a0a; font-family: 'Space Mono', monospace; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; text-align: center; }
</style>
</head>
<body><p>This page doesn't exist.</p></body>
</html>`;
}

// GET /offer/:slug
router.get('/:slug', viewLimiter, async (req, res) => {
  const { slug } = req.params;
  const offer = await prisma.vbvOffer.findUnique({ where: { slug } });

  if (!offer || !offer.isActive) {
    await prisma.vbvOfferAccessLog.create({
      data: { slug, type: 'VIEW', ipAddress: req.ip, userAgent: req.headers['user-agent'] || null },
    });
    return res.status(404).send(notFoundPage());
  }

  await prisma.vbvOfferAccessLog.create({
    data: { offerId: offer.id, slug, type: 'VIEW', ipAddress: req.ip, userAgent: req.headers['user-agent'] || null },
  });

  res.send(gateShell({ churchName: offer.churchName, slug }));
});

// POST /offer/:slug/unlock
router.post('/:slug/unlock', unlockLimiter, async (req, res) => {
  const { slug } = req.params;
  const { password } = req.body;

  const offer = await prisma.vbvOffer.findUnique({ where: { slug } });
  if (!offer || !offer.isActive) return res.status(404).json({ error: 'Not found' });

  const valid = password && await bcrypt.compare(password, offer.passwordHash);

  await prisma.vbvOfferAccessLog.create({
    data: {
      offerId: offer.id,
      slug,
      type: valid ? 'UNLOCK_SUCCESS' : 'UNLOCK_FAIL',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] || null,
    },
  });

  if (!valid) return res.status(401).json({ error: 'Wrong password' });

  res.json({ churchName: offer.churchName, offerHtml: offer.offerHtml });
});

module.exports = router;
