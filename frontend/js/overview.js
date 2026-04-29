// ── Overview page renderer ─────────────────────────────────────────────────

async function loadOverview(period) {
  const container = document.getElementById('overview-content');
  container.innerHTML = renderOverviewSkeleton();

  const [igRes, ttRes, ytRes] = await Promise.allSettled([
    fetch(`/api/instagram/insights?period=${period}`).then(r => r.json()),
    fetch(`/api/tiktok/insights?period=${period}`).then(r => r.json()),
    fetch(`/api/youtube/insights?period=${period}`).then(r => r.json()),
  ]);

  const ig = igRes.status === 'fulfilled' ? igRes.value : null;
  const tt = ttRes.status === 'fulfilled' ? ttRes.value : null;
  const yt = ytRes.status === 'fulfilled' ? ytRes.value : null;

  renderOverviewPage(ig, tt, yt, container);
}

function renderOverviewSkeleton() {
  return `
    <div class="platform-overview-grid mb-26">
      ${['ig','tt','yt'].map(c => `<div class="platform-card ${c}">
        <div class="skeleton skeleton-text w50" style="height:18px;margin-bottom:20px"></div>
        <div class="platform-metrics">
          ${Array(4).fill('<div><div class="skeleton skeleton-text w70"></div><div class="skeleton skeleton-text w50" style="height:20px"></div></div>').join('')}
        </div>
      </div>`).join('')}
    </div>
    <div class="chart-grid chart-grid-1 mb-26">
      <div class="chart-card"><div class="skeleton skeleton-chart" style="height:280px"></div></div>
    </div>`;
}

function renderOverviewPage(ig, tt, yt, container) {
  const igS = ig?.summary || {};
  const ttS = tt?.summary || {};
  const ytS = yt?.summary || {};

  // Combined totals
  const totalFollowers = (igS.followers || 0) + (ttS.followers || 0) + (ytS.subscribers || 0);
  const totalReach = (igS.reach || 0) + (ttS.totalViews || 0) + (ytS.totalViews || 0);

  container.innerHTML = `
    <!-- Hero totals -->
    <div class="stat-grid stat-grid-4 mb-26">
      <div class="stat-card all">
        <div class="stat-label">Total Followers / Subs</div>
        <div class="stat-value">${fmtNum(totalFollowers)}</div>
        <div class="stat-sub">Across all platforms</div>
      </div>
      <div class="stat-card all">
        <div class="stat-label">Total Reach / Views</div>
        <div class="stat-value">${fmtNum(totalReach)}</div>
        <div class="stat-sub">Period total</div>
      </div>
      <div class="stat-card ig">
        <div class="stat-label">Instagram Engagement Rate</div>
        <div class="stat-value">${fmtPct(igS.engagementRate)}</div>
      </div>
      <div class="stat-card tt">
        <div class="stat-label">TikTok Engagement Rate</div>
        <div class="stat-value">${fmtPct(ttS.engagementRate)}</div>
      </div>
    </div>

    <!-- Platform summary cards -->
    <div class="section-header mb-16">
      <div class="section-title">Platform Snapshots</div>
    </div>
    <div class="platform-overview-grid mb-26">
      <!-- Instagram -->
      <div class="platform-card ig" onclick="navigateTo('instagram')">
        <div class="nav-arrow">→</div>
        <div class="platform-card-header">
          <div class="platform-logo ig">IG</div>
          <div>
            <div class="platform-name">Instagram</div>
            <div class="platform-handle">@versebyverse</div>
          </div>
        </div>
        <div class="platform-metrics">
          <div>
            <div class="platform-metric-label">Followers</div>
            <div class="platform-metric-value">${fmtNum(igS.followers)}</div>
          </div>
          <div>
            <div class="platform-metric-label">Reach</div>
            <div class="platform-metric-value">${fmtNum(igS.reach)}</div>
          </div>
          <div>
            <div class="platform-metric-label">Impressions</div>
            <div class="platform-metric-value">${fmtNum(igS.impressions)}</div>
          </div>
          <div>
            <div class="platform-metric-label">Eng. Rate</div>
            <div class="platform-metric-value">${fmtPct(igS.engagementRate)}</div>
          </div>
        </div>
      </div>

      <!-- TikTok -->
      <div class="platform-card tt" onclick="navigateTo('tiktok')">
        <div class="nav-arrow">→</div>
        <div class="platform-card-header">
          <div class="platform-logo tt">TT</div>
          <div>
            <div class="platform-name">TikTok</div>
            <div class="platform-handle">@versebyverse</div>
          </div>
        </div>
        <div class="platform-metrics">
          <div>
            <div class="platform-metric-label">Followers</div>
            <div class="platform-metric-value">${fmtNum(ttS.followers)}</div>
          </div>
          <div>
            <div class="platform-metric-label">Views</div>
            <div class="platform-metric-value">${fmtNum(ttS.totalViews)}</div>
          </div>
          <div>
            <div class="platform-metric-label">Likes</div>
            <div class="platform-metric-value">${fmtNum(ttS.totalLikes)}</div>
          </div>
          <div>
            <div class="platform-metric-label">Eng. Rate</div>
            <div class="platform-metric-value">${fmtPct(ttS.engagementRate)}</div>
          </div>
        </div>
      </div>

      <!-- YouTube -->
      <div class="platform-card yt" onclick="navigateTo('youtube')">
        <div class="nav-arrow">→</div>
        <div class="platform-card-header">
          <div class="platform-logo yt">YT</div>
          <div>
            <div class="platform-name">YouTube</div>
            <div class="platform-handle">Verse by Verse</div>
          </div>
        </div>
        <div class="platform-metrics">
          <div>
            <div class="platform-metric-label">Subscribers</div>
            <div class="platform-metric-value">${fmtNum(ytS.subscribers)}</div>
          </div>
          <div>
            <div class="platform-metric-label">Total Views</div>
            <div class="platform-metric-value">${fmtNum(ytS.totalViews)}</div>
          </div>
          <div>
            <div class="platform-metric-label">Videos</div>
            <div class="platform-metric-value">${fmtNum(ytS.videoCount)}</div>
          </div>
          <div>
            <div class="platform-metric-label">Eng. Rate</div>
            <div class="platform-metric-value">${fmtPct(ytS.engagementRate)}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Comparison chart -->
    <div class="chart-grid chart-grid-1 mb-26">
      <div class="chart-card">
        <div class="chart-title">Cross-Platform Followers Comparison</div>
        <div class="chart-wrap short"><canvas id="overview-bar-chart"></canvas></div>
      </div>
    </div>

    <!-- Engagement comparison chart -->
    <div class="chart-grid chart-grid-2 mb-26">
      <div class="chart-card">
        <div class="chart-title">Engagement Rate by Platform</div>
        <div class="chart-wrap short"><canvas id="overview-eng-chart"></canvas></div>
      </div>
      <div class="chart-card">
        <div class="chart-title">Reach / Views by Platform</div>
        <div class="chart-wrap short"><canvas id="overview-reach-chart"></canvas></div>
      </div>
    </div>
  `;

  // Followers bar chart
  renderChart('overview-bar-chart', {
    type: 'bar',
    data: {
      labels: ['Instagram', 'TikTok', 'YouTube'],
      datasets: [{
        label: 'Followers / Subscribers',
        data: [igS.followers || 0, ttS.followers || 0, ytS.subscribers || 0],
        backgroundColor: [
          'rgba(131,58,180,0.7)',
          'rgba(105,201,208,0.7)',
          'rgba(255,0,0,0.7)',
        ],
        borderColor: ['#833ab4', '#69c9d0', '#ff0000'],
        borderWidth: 1,
        borderRadius: 6,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#ffffff',
          borderColor: 'rgba(0,0,0,0.1)',
          borderWidth: 1,
          titleColor: '#111827',
          bodyColor: '#6b7280',
          padding: 10,
          callbacks: { label: (ctx) => ` ${fmtNum(ctx.raw)} followers` },
        },
      },
      scales: {
        x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#8b949e' } },
        y: {
          grid: { color: 'rgba(255,255,255,0.05)' },
          ticks: { color: '#8b949e', callback: (v) => fmtNum(v) },
        },
      },
    },
  });

  // Engagement rate doughnut
  renderChart('overview-eng-chart', doughnutDefaults(
    ['Instagram', 'TikTok', 'YouTube'],
    [
      parseFloat(igS.engagementRate || 0),
      parseFloat(ttS.engagementRate || 0),
      parseFloat(ytS.engagementRate || 0),
    ],
    ['#833ab4', '#69c9d0', '#ff0000']
  ));

  // Reach bar chart
  renderChart('overview-reach-chart', {
    type: 'bar',
    data: {
      labels: ['Instagram', 'TikTok', 'YouTube'],
      datasets: [{
        label: 'Reach / Views',
        data: [igS.reach || 0, ttS.totalViews || 0, ytS.totalViews || 0],
        backgroundColor: [
          'rgba(131,58,180,0.6)',
          'rgba(238,29,82,0.6)',
          'rgba(255,100,0,0.6)',
        ],
        borderColor: ['#833ab4', '#ee1d52', '#ff6400'],
        borderWidth: 1,
        borderRadius: 6,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#ffffff',
          borderColor: 'rgba(0,0,0,0.1)',
          borderWidth: 1,
          titleColor: '#111827',
          bodyColor: '#6b7280',
          padding: 10,
          callbacks: { label: (ctx) => ` ${fmtNum(ctx.raw)}` },
        },
      },
      scales: {
        x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#8b949e' } },
        y: {
          grid: { color: 'rgba(255,255,255,0.05)' },
          ticks: { color: '#8b949e', callback: (v) => fmtNum(v) },
        },
      },
    },
  });
}
