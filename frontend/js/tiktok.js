// ── TikTok page renderer ───────────────────────────────────────────────────

async function loadTikTok(period) {
  const container = document.getElementById('tt-content');
  container.innerHTML = renderTTSkeleton();

  try {
    const res = await fetch(`/api/tiktok/insights?period=${period}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    renderTikTokPage(data, container);
  } catch (err) {
    container.innerHTML = `<div class="error-state">
      <div class="error-icon">📵</div>
      <div class="error-msg">Could not load TikTok data.<br><small>${err.message}</small></div>
    </div>`;
  }
}

function renderTTSkeleton() {
  return `
    <div class="stat-grid stat-grid-4 mb-26">
      ${Array(4).fill(skeletonStatCard('tt')).join('')}
    </div>
    <div class="chart-grid chart-grid-1 mb-26">
      <div class="chart-card"><div class="skeleton skeleton-chart" style="height:260px"></div></div>
    </div>
    <div class="posts-grid">
      ${Array(3).fill(skeletonPostCard()).join('')}
    </div>`;
}

function renderTikTokPage(data, container) {
  const s = data.summary || {};
  const ts = data.timeSeries || {};
  const videos = data.topVideos || [];

  container.innerHTML = `
    ${data._demo ? demoBanner('TikTok') : ''}

    <!-- Summary stats -->
    <div class="stat-grid stat-grid-4 mb-26">
      <div class="stat-card tt">
        <div class="stat-label">Followers</div>
        <div class="stat-value">${fmtNum(s.followers)}</div>
      </div>
      <div class="stat-card tt">
        <div class="stat-label">Total Views</div>
        <div class="stat-value">${fmtNum(s.totalViews)}</div>
      </div>
      <div class="stat-card tt">
        <div class="stat-label">Total Likes</div>
        <div class="stat-value">${fmtNum(s.totalLikes)}</div>
      </div>
      <div class="stat-card tt">
        <div class="stat-label">Engagement Rate</div>
        <div class="stat-value">${fmtPct(s.engagementRate)}</div>
        <div class="stat-sub">Likes + comments + shares / views</div>
      </div>
    </div>

    <!-- Secondary stats -->
    <div class="stat-grid stat-grid-2 mb-26">
      <div class="stat-card tt">
        <div class="stat-label">Total Comments</div>
        <div class="stat-value">${fmtNum(s.totalComments)}</div>
      </div>
      <div class="stat-card tt">
        <div class="stat-label">Total Shares</div>
        <div class="stat-value">${fmtNum(s.totalShares)}</div>
      </div>
    </div>

    <!-- Views chart -->
    <div class="chart-grid chart-grid-1 mb-26">
      <div class="chart-card">
        <div class="chart-title">Video views over time</div>
        <div class="chart-wrap tall"><canvas id="tt-views-chart"></canvas></div>
      </div>
    </div>

    <!-- Top videos -->
    <div class="section-header mb-16">
      <div class="section-title">Top Performing Videos</div>
    </div>
    <div class="posts-grid" id="tt-posts-list">
      ${videos.length ? videos.map(renderTTVideo).join('') : '<div class="text-muted fs-12" style="padding:20px">No videos found.</div>'}
    </div>
  `;

  // Views line chart
  renderChart('tt-views-chart', lineChartDefaults(ts.labels || [], [
    {
      label: 'Views',
      data: ts.views || [],
      borderColor: '#69c9d0',
      backgroundColor: 'rgba(105,201,208,0.1)',
      fill: true,
      tension: 0.4,
      pointRadius: 2,
    },
    {
      label: 'Followers',
      data: ts.followers || [],
      borderColor: '#ee1d52',
      backgroundColor: 'rgba(238,29,82,0.08)',
      fill: true,
      tension: 0.4,
      pointRadius: 2,
      yAxisID: 'y1',
    },
  ].filter(d => (d.data || []).some(v => v > 0))));

  // Add second y-axis if followers data exists
  const ttChart = chartRegistry['tt-views-chart'];
  if (ttChart && (ts.followers || []).some(v => v > 0)) {
    ttChart.options.scales.y1 = {
      type: 'linear',
      position: 'right',
      grid: { drawOnChartArea: false },
      ticks: { color: '#8b949e', font: { size: 11 }, callback: (v) => fmtNum(v) },
    };
    ttChart.update();
  }
}

function renderTTVideo(video, i) {
  const thumbHtml = video.thumbnail
    ? `<img src="${video.thumbnail}" alt="" loading="lazy" onerror="this.style.display='none'">`
    : '🎵';
  const durationStr = video.duration
    ? `${Math.floor(video.duration / 60)}:${String(video.duration % 60).padStart(2, '0')}`
    : '—';
  return `<div class="post-card">
    <div class="post-rank ${rankClass(i)}">${i + 1}</div>
    <div class="post-thumb">${thumbHtml}</div>
    <div class="post-info">
      <div class="media-type-badge video">Video · ${durationStr}s</div>
      <div class="post-caption">${video.title || '(untitled)'}</div>
      <div class="post-meta">
        <div class="post-meta-item">Views <span class="val">${fmtNum(video.views)}</span></div>
        <div class="post-meta-item">Likes <span class="val">${fmtNum(video.likes)}</span></div>
        <div class="post-meta-item">Comments <span class="val">${fmtNum(video.comments)}</span></div>
        <div class="post-meta-item">Shares <span class="val">${fmtNum(video.shares)}</span></div>
        <div class="post-meta-item"><span class="val">${fmtDate(video.createTime)}</span></div>
      </div>
    </div>
    <div class="post-eng-badge">${fmtPct(video.engagementRate)} ER</div>
  </div>`;
}
