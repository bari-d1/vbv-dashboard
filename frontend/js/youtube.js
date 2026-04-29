// ── YouTube page renderer ──────────────────────────────────────────────────

async function loadYouTube(period) {
  const container = document.getElementById('yt-content');
  container.innerHTML = renderYTSkeleton();

  try {
    const res = await fetch(`/api/youtube/insights?period=${period}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    renderYouTubePage(data, container);
  } catch (err) {
    container.innerHTML = `<div class="error-state">
      <div class="error-icon">📵</div>
      <div class="error-msg">Could not load YouTube data.<br><small>${err.message}</small></div>
    </div>`;
  }
}

function renderYTSkeleton() {
  return `
    <div class="stat-grid stat-grid-4 mb-26">
      ${Array(4).fill(skeletonStatCard('yt')).join('')}
    </div>
    <div class="chart-grid chart-grid-1 mb-26">
      <div class="chart-card"><div class="skeleton skeleton-chart" style="height:260px"></div></div>
    </div>
    <div class="posts-grid">
      ${Array(3).fill(skeletonPostCard()).join('')}
    </div>`;
}

function renderYouTubePage(data, container) {
  const s = data.summary || {};
  const ts = data.timeSeries || {};
  const videos = data.topVideos || [];

  container.innerHTML = `
    ${data._demo ? demoBanner('YouTube') : ''}

    <!-- Summary stats -->
    <div class="stat-grid stat-grid-4 mb-26">
      <div class="stat-card yt">
        <div class="stat-label">Subscribers</div>
        <div class="stat-value">${fmtNum(s.subscribers)}</div>
      </div>
      <div class="stat-card yt">
        <div class="stat-label">Total Views</div>
        <div class="stat-value">${fmtNum(s.totalViews)}</div>
      </div>
      <div class="stat-card yt">
        <div class="stat-label">Avg View Duration</div>
        <div class="stat-value" style="font-size:1.3rem">${s.avgViewDuration || '—'}</div>
      </div>
      <div class="stat-card yt">
        <div class="stat-label">Engagement Rate</div>
        <div class="stat-value">${fmtPct(s.engagementRate)}</div>
        <div class="stat-sub">Likes + comments / views</div>
      </div>
    </div>

    <!-- Secondary stats -->
    <div class="stat-grid stat-grid-2 mb-26">
      <div class="stat-card yt">
        <div class="stat-label">Total Videos</div>
        <div class="stat-value">${fmtNum(s.videoCount)}</div>
      </div>
      <div class="stat-card yt">
        <div class="stat-label">Watch Time</div>
        <div class="stat-value" style="font-size:1.3rem">${s.totalWatchTimeMinutes ? fmtNum(s.totalWatchTimeMinutes) + ' min' : '—'}</div>
      </div>
    </div>

    <!-- Views chart -->
    <div class="chart-grid chart-grid-1 mb-26">
      <div class="chart-card">
        <div class="chart-title">Views over time</div>
        <div class="chart-wrap tall"><canvas id="yt-views-chart"></canvas></div>
      </div>
    </div>

    <!-- Top videos -->
    <div class="section-header mb-16">
      <div class="section-title">Top Performing Videos</div>
    </div>
    <div class="posts-grid" id="yt-videos-list">
      ${videos.length ? videos.map(renderYTVideo).join('') : '<div class="text-muted fs-12" style="padding:20px">No videos found for this period.</div>'}
    </div>
  `;

  renderChart('yt-views-chart', lineChartDefaults(ts.labels || [], [
    {
      label: 'Views',
      data: ts.views || [],
      borderColor: '#ff0000',
      backgroundColor: 'rgba(255,0,0,0.1)',
      fill: true,
      tension: 0.4,
      pointRadius: 2,
    },
    {
      label: 'Watch Time (min)',
      data: ts.watchTime || [],
      borderColor: '#aaaaaa',
      backgroundColor: 'rgba(170,170,170,0.05)',
      fill: true,
      tension: 0.4,
      pointRadius: 2,
    },
  ].filter(d => (d.data || []).some(v => v > 0))));
}

function renderYTVideo(video, i) {
  const thumbHtml = video.thumbnail
    ? `<img src="${video.thumbnail}" alt="" loading="lazy" onerror="this.style.display='none'">`
    : '▶';
  return `<div class="post-card">
    <div class="post-rank ${rankClass(i)}">${i + 1}</div>
    <div class="post-thumb" style="width:90px; height:60px">${thumbHtml}</div>
    <div class="post-info">
      <div class="media-type-badge video">YouTube Video</div>
      <div class="post-caption">${video.title || '(untitled)'}</div>
      <div class="post-meta">
        <div class="post-meta-item">Views <span class="val">${fmtNum(video.views)}</span></div>
        <div class="post-meta-item">Likes <span class="val">${fmtNum(video.likes)}</span></div>
        <div class="post-meta-item">Comments <span class="val">${fmtNum(video.comments)}</span></div>
        <div class="post-meta-item">Avg duration <span class="val">${video.avgViewDuration || '—'}</span></div>
        <div class="post-meta-item"><span class="val">${fmtDate(video.publishedAt)}</span></div>
      </div>
    </div>
    <div class="post-eng-badge">${fmtPct(video.engagementRate)} ER</div>
  </div>`;
}
