// ── All Posts page ──────────────────────────────────────────────────────────

let postsState = {
  sort: 'engagementRate',
  order: 'desc',
  type: '',
  page: 1,
  total: 0,
  pages: 0,
  posts: [],
};

async function loadPosts() {
  const container = document.getElementById('posts-content');
  container.innerHTML = renderPostsSkeleton();
  await fetchAndRenderPosts(container);
}

async function fetchAndRenderPosts(container) {
  if (!container) container = document.getElementById('posts-content');

  const { sort, order, type, page } = postsState;
  const params = new URLSearchParams({ sort, order, page, limit: 20 });
  if (type) params.set('type', type);

  try {
    const res = await fetch(`/api/posts?${params}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    postsState.posts = data.posts;
    postsState.total = data.total;
    postsState.pages = data.pages;

    renderPostsPage(data, container);
  } catch (err) {
    container.innerHTML = `<div class="error-state">
      <div class="error-msg">Could not load posts.<br><small>${err.message}</small></div>
    </div>`;
  }
}

function renderPostsSkeleton() {
  return `<div class="posts-toolbar mb-16" style="height:40px;background:var(--bg-card);border-radius:var(--radius-md);"></div>
    <div class="posts-grid">${Array(6).fill(skeletonPostCard()).join('')}</div>`;
}

function renderPostsPage(data, container) {
  const { posts, total, pages } = data;
  const { sort, order, type, page } = postsState;

  container.innerHTML = `
    <!-- Toolbar -->
    <div class="posts-toolbar mb-16">
      <div class="posts-toolbar-left">
        <span class="posts-count">${fmtNum(total)} post${total !== 1 ? 's' : ''}</span>

        <div class="filter-group">
          <button class="filter-btn ${!type ? 'active' : ''}" data-type="">All</button>
          <button class="filter-btn ${type === 'REEL' ? 'active' : ''}" data-type="REEL">Reels</button>
          <button class="filter-btn ${type === 'IMAGE' ? 'active' : ''}" data-type="IMAGE">Posts</button>
          <button class="filter-btn ${type === 'CAROUSEL_ALBUM' ? 'active' : ''}" data-type="CAROUSEL_ALBUM">Carousels</button>
        </div>
      </div>

      <div class="posts-toolbar-right">
        <select class="sort-select" id="posts-sort-select">
          <option value="engagementRate" ${sort === 'engagementRate' ? 'selected' : ''}>Engagement Rate</option>
          <option value="reach"          ${sort === 'reach'          ? 'selected' : ''}>Reach</option>
          <option value="likes"          ${sort === 'likes'          ? 'selected' : ''}>Likes</option>
          <option value="comments"       ${sort === 'comments'       ? 'selected' : ''}>Comments</option>
          <option value="shares"         ${sort === 'shares'         ? 'selected' : ''}>Shares</option>
          <option value="saves"          ${sort === 'saves'          ? 'selected' : ''}>Saves</option>
          <option value="views"          ${sort === 'views'          ? 'selected' : ''}>Views</option>
          <option value="postedAt"       ${sort === 'postedAt'       ? 'selected' : ''}>Date</option>
        </select>
        <button class="order-btn" id="posts-order-btn" title="Toggle order">
          ${order === 'desc' ? '↓' : '↑'}
        </button>
      </div>
    </div>

    <!-- Posts list -->
    <div class="posts-full-grid" id="posts-full-list">
      ${posts.length
        ? posts.map((p, i) => renderFullPost(p, i, page)).join('')
        : '<div class="text-muted fs-12" style="padding:24px">No posts found.</div>'}
    </div>

    <!-- Pagination -->
    ${pages > 1 ? renderPagination(page, pages) : ''}
  `;

  // Filter buttons
  container.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      postsState.type = btn.dataset.type;
      postsState.page = 1;
      fetchAndRenderPosts(container);
    });
  });

  // Sort select
  container.querySelector('#posts-sort-select').addEventListener('change', e => {
    postsState.sort = e.target.value;
    postsState.page = 1;
    fetchAndRenderPosts(container);
  });

  // Order toggle
  container.querySelector('#posts-order-btn').addEventListener('click', () => {
    postsState.order = postsState.order === 'desc' ? 'asc' : 'desc';
    postsState.page = 1;
    fetchAndRenderPosts(container);
  });

  // Pagination
  container.querySelectorAll('.page-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      postsState.page = parseInt(btn.dataset.page);
      fetchAndRenderPosts(container);
      document.getElementById('posts-content').scrollIntoView({ behavior: 'smooth' });
    });
  });

  // Add to compare buttons
  container.querySelectorAll('.add-to-compare-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const post = postsState.posts.find(p => p.id === btn.dataset.id);
      if (post) addToCompare(post, btn);
    });
  });

  // Duration save buttons
  container.querySelectorAll('.duration-save-btn').forEach(btn => {
    btn.addEventListener('click', () => saveDuration(btn.dataset.id));
  });
  container.querySelectorAll('.duration-edit-input').forEach(input => {
    input.addEventListener('keydown', e => { if (e.key === 'Enter') saveDuration(input.id.replace('dur-input-', '')); });
  });
}

async function saveDuration(postId) {
  const input = document.getElementById(`dur-input-${postId}`);
  const status = document.getElementById(`dur-status-${postId}`);
  const btn = input?.nextElementSibling;
  if (!input) return;

  const seconds = parseFloat(input.value);
  if (isNaN(seconds) || seconds < 0) {
    status.textContent = 'Invalid value';
    status.style.color = 'var(--accent)';
    return;
  }

  if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }
  status.textContent = '';

  try {
    const res = await fetch(`/api/posts/${postId}/duration`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoDuration: seconds }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Save failed');

    // Update in-memory state
    const post = postsState.posts.find(p => p.id === postId);
    if (post) post.videoDuration = data.videoDuration;

    status.textContent = 'Saved ✓';
    status.style.color = 'var(--success)';
    if (btn) { btn.disabled = false; btn.textContent = 'Save'; }

    // Refresh the duration display metric block
    const metricVal = document.querySelector(`#dur-row-${postId}`)?.closest('.post-card-full')?.querySelector('.post-metric-lbl:last-of-type');
    setTimeout(() => { status.textContent = ''; }, 3000);
  } catch (err) {
    status.textContent = err.message;
    status.style.color = 'var(--accent)';
    if (btn) { btn.disabled = false; btn.textContent = 'Save'; }
  }
}

function renderFullPost(post, i, page) {
  const rank = (page - 1) * 20 + i + 1;
  const thumbHtml = post.thumbnail
    ? `<img src="${post.thumbnail}" alt="" loading="lazy" onerror="this.style.display='none'">`
    : '';

  return `<div class="post-card post-card-full">
    <div class="post-rank ${rankClass(i)}">${rank}</div>
    <div class="post-thumb">${thumbHtml}</div>
    <div class="post-info">
      ${mediaTypeBadge(post.mediaType)}
      <div class="post-caption">${post.caption || '(no caption)'}</div>
      <div class="post-metrics-row">
        <div class="post-metric-block">
          <div class="post-metric-val">${fmtNum(post.likes)}</div>
          <div class="post-metric-lbl">Likes</div>
        </div>
        <div class="post-metric-block">
          <div class="post-metric-val">${fmtNum(post.comments)}</div>
          <div class="post-metric-lbl">Comments</div>
        </div>
        <div class="post-metric-block">
          <div class="post-metric-val">${fmtNum(post.shares)}</div>
          <div class="post-metric-lbl">Shares</div>
        </div>
        <div class="post-metric-block">
          <div class="post-metric-val">${fmtNum(post.saves)}</div>
          <div class="post-metric-lbl">Saves</div>
        </div>
        <div class="post-metric-block">
          <div class="post-metric-val">${fmtNum(post.reach)}</div>
          <div class="post-metric-lbl">Reach</div>
        </div>
        <div class="post-metric-block">
          <div class="post-metric-val">${fmtNum(post.views)}</div>
          <div class="post-metric-lbl">Views</div>
        </div>
        <div class="post-metric-block">
          <div class="post-metric-val">${fmtNum(post.impressions)}</div>
          <div class="post-metric-lbl">Impressions</div>
        </div>
        <div class="post-metric-block">
          <div class="post-metric-val">${fmtNum(post.profileVisits)}</div>
          <div class="post-metric-lbl">Profile Visits</div>
        </div>
        <div class="post-metric-block">
          <div class="post-metric-val">${fmtNum(post.follows)}</div>
          <div class="post-metric-lbl">Follows</div>
        </div>
        <div class="post-metric-block">
          <div class="post-metric-val" style="color:var(--success)">${fmtPct(post.engagementRate)}</div>
          <div class="post-metric-lbl">Eng. Rate</div>
        </div>
        ${post.mediaType === 'REEL' ? `
        <div class="post-metric-block">
          <div class="post-metric-val">${post.avgWatchTime > 0 ? (post.avgWatchTime / 1000).toFixed(1) + 's' : '—'}</div>
          <div class="post-metric-lbl">Avg Watch</div>
        </div>
        <div class="post-metric-block">
          <div class="post-metric-val">${post.videoDuration > 0 ? (post.videoDuration / 1000).toFixed(1) + 's' : '—'}</div>
          <div class="post-metric-lbl">Duration</div>
        </div>` : ''}
      </div>
      ${post.mediaType === 'REEL' ? `
      <div class="duration-edit-row" id="dur-row-${post.id}">
        <label class="duration-edit-label">Set duration (seconds):</label>
        <input class="duration-edit-input" id="dur-input-${post.id}" type="number" min="0" step="0.1"
          value="${post.videoDuration > 0 ? (post.videoDuration / 1000).toFixed(1) : ''}"
          placeholder="e.g. 30.5">
        <button class="duration-save-btn" data-id="${post.id}">Save</button>
        <span class="duration-save-status" id="dur-status-${post.id}"></span>
      </div>` : ''}
      <div class="post-footer">
        <span class="post-date">${fmtDate(post.timestamp)}</span>
        <button class="add-to-compare-btn" data-id="${post.id}">+ Compare</button>
      </div>
    </div>
  </div>`;
}

function renderPagination(current, total) {
  const pages = [];
  for (let i = 1; i <= total; i++) {
    if (i === 1 || i === total || Math.abs(i - current) <= 2) {
      pages.push(i);
    } else if (pages[pages.length - 1] !== '…') {
      pages.push('…');
    }
  }
  return `<div class="pagination">
    ${pages.map(p =>
      p === '…'
        ? `<span class="page-ellipsis">…</span>`
        : `<button class="page-btn ${p === current ? 'active' : ''}" data-page="${p}">${p}</button>`
    ).join('')}
  </div>`;
}
