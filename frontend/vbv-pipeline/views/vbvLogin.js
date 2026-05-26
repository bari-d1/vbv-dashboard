function vbvRenderLogin() {
  return `
    <div class="vbv-login-wrap">
      <div class="vbv-login-card">
        <div class="vbv-logo-mark">VBV <span>Pipeline</span></div>
        <p class="sub">Sign in to the creative workflow dashboard</p>
        <div id="vbv-login-error" class="vbv-alert vbv-alert-error" style="display:none;"></div>
        <form id="vbv-login-form">
          <div class="vbv-form-group">
            <label for="vbv-email">Email</label>
            <input type="email" id="vbv-email" required placeholder="you@example.com" autocomplete="email">
          </div>
          <div class="vbv-form-group">
            <label for="vbv-password">Password</label>
            <div class="vbv-pw-wrap">
              <input type="password" id="vbv-password" required placeholder="Your password" autocomplete="current-password">
              <button type="button" class="vbv-pw-toggle" onclick="vbvToggleLoginPw(this)">Show</button>
            </div>
          </div>
          <button type="submit" class="vbv-btn vbv-btn-primary" style="width:100%;">Sign In</button>
        </form>
      </div>
    </div>`;
}

function vbvBindLogin() {
  const form = document.getElementById('vbv-login-form');
  if (!form) return;
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const email = document.getElementById('vbv-email').value.trim();
    const password = document.getElementById('vbv-password').value;
    const errEl = document.getElementById('vbv-login-error');
    errEl.style.display = 'none';
    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true; btn.textContent = 'Signing in…';
    try {
      const res = await vbvApi('POST', '/vbv/auth/login', { email, password });
      localStorage.setItem('vbv_token', res.token);
      localStorage.setItem('vbv_user', JSON.stringify(res.user));
      vbvInit();
    } catch (err) {
      errEl.textContent = err.message || 'Login failed';
      errEl.style.display = 'block';
    } finally {
      btn.disabled = false; btn.textContent = 'Sign In';
    }
  });
}

function vbvToggleLoginPw(btn) {
  const input = btn.previousElementSibling;
  if (input.type === 'password') { input.type = 'text'; btn.textContent = 'Hide'; }
  else { input.type = 'password'; btn.textContent = 'Show'; }
}
