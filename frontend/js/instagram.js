// ── Instagram page renderer ────────────────────────────────────────────────

async function loadInstagram(period) {
  const container = document.getElementById('ig-content');
  container.innerHTML = renderIGSkeleton();

  await loadSyncStatus();

  try {
    const res = await fetch(`/api/instagram/insights?period=${period}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    renderInstagramPage(data, container);
  } catch (err) {
    container.innerHTML = `<div class="error-state">
      <div class="error-icon">📵</div>
      <div class="error-msg">Could not load Instagram data.<br><small>${err.message}</small></div>
    </div>`;
  }
}

function renderIGSkeleton() {
  return `
    <div class="stat-grid stat-grid-4 mb-26">
      ${Array(4).fill(skeletonStatCard('ig')).join('')}
    </div>
    <div class="chart-grid chart-grid-2 mb-26">
      <div class="chart-card"><div class="skeleton skeleton-chart"></div></div>
      <div class="chart-card"><div class="skeleton skeleton-chart"></div></div>
    </div>
    <div class="posts-grid">
      ${Array(3).fill(skeletonPostCard()).join('')}
    </div>`;
}

function renderInstagramPage(data, container) {
  const s = data.summary || {};
  const ts = data.timeSeries || {};
  const cb = data.contentBreakdown || {};
  const posts = data.topPosts || [];
  const demo = data.audienceDemographics || {};
  const scatter = data.postScatter || [];
  const fg = data.followerGrowth || { labels: [], followers: [] };
  const followsPerPost = data.followsPerPost || [];
  const watchTimeData = data.watchTimeData || [];

  container.innerHTML = `
    ${renderSyncBar('instagram')}
    ${data._demo ? demoBanner('Instagram') : ''}

    <!-- Summary stats -->
    <div class="stat-grid stat-grid-4 mb-26">
      <div class="stat-card ig">
        <div class="stat-label">Followers</div>
        <div class="stat-value">${fmtNum(s.followers)}</div>
      </div>
      <div class="stat-card ig">
        <div class="stat-label">Reach</div>
        <div class="stat-value">${fmtNum(s.reach)}</div>
        <div class="stat-sub">Since ${s.periodFrom ? fmtDate(s.periodFrom) : 'start of period'}</div>
      </div>
      <div class="stat-card ig">
        <div class="stat-label">Views</div>
        <div class="stat-value">${fmtNum(s.impressions)}</div>
        <div class="stat-sub">Total views for period</div>
      </div>
      <div class="stat-card ig">
        <div class="stat-label">Engagement Rate</div>
        <div class="stat-value">${fmtPct(s.engagementRate)}</div>
        <div class="stat-sub">Likes + comments + saves + shares</div>
      </div>
    </div>

    <!-- Secondary stats -->
    <div class="stat-grid stat-grid-4 mb-26">
      <div class="stat-card ig">
        <div class="stat-label">Total Posts</div>
        <div class="stat-value">${fmtNum(s.totalPosts)}</div>
        <div class="stat-sub">All time</div>
      </div>
      <div class="stat-card ig">
        <div class="stat-label">Total Likes</div>
        <div class="stat-value">${fmtNum(s.totalLikes)}</div>
        <div class="stat-sub">Across all posts</div>
      </div>
      <div class="stat-card ig">
        <div class="stat-label">Avg Watch Time</div>
        <div class="stat-value">${s.avgWatchTimeMs ? (s.avgWatchTimeMs / 1000).toFixed(1) + 's' : '—'}</div>
        <div class="stat-sub">Across all Reels</div>
      </div>
      <div class="stat-card ig">
        <div class="stat-label">Avg Retention Rate</div>
        <div class="stat-value">${s.avgRetentionPct != null ? s.avgRetentionPct + '%' : '—'}</div>
        <div class="stat-sub">Avg watch / duration · Reels</div>
      </div>
    </div>

    <!-- Charts row -->
    <div class="chart-grid chart-grid-2 mb-26">
      <div class="chart-card">
        <div class="chart-title">Reach over time${ts.estimatedPoints?.length ? ' <span class="chart-title-note">· actual data from Apr 11, 2026</span>' : ''}</div>
        <div class="chart-wrap"><canvas id="ig-reach-chart"></canvas></div>
      </div>
      <div class="chart-card">
        <div class="chart-title">Content type breakdown</div>
        <div class="chart-wrap"><canvas id="ig-content-chart"></canvas></div>
      </div>
    </div>

    <!-- ER scatter -->
    <div class="chart-card mb-26">
      <div class="chart-title">Engagement rate per post over time</div>
      <div class="chart-wrap tall"><canvas id="ig-er-scatter"></canvas></div>
    </div>

    <!-- Watch time vs duration -->
    <div class="chart-card mb-26">
      <div class="chart-title-row">
        <div>Avg watch time vs video duration <span class="chart-title-note">· Reels only · x = duration, y = avg watch time</span></div>
        <button class="chart-reset-btn" id="watchtime-reset-btn" onclick="resetWatchtimeZoom()" title="Reset zoom">Reset zoom</button>
      </div>
      <div class="chart-wrap tall"><canvas id="ig-watchtime-chart"></canvas></div>
    </div>

    <!-- Retention % vs duration -->
    <div class="chart-card mb-26">
      <div class="chart-title">Retention rate vs video duration <span class="chart-title-note">· Reels only · does length affect how much people watch?</span></div>
      <div class="chart-wrap tall"><canvas id="ig-retention-scatter"></canvas></div>
    </div>

    <!-- Retention by duration block -->
    <div class="chart-card mb-26">
      <div class="chart-title">Avg retention by video length <span class="chart-title-note">· Reels grouped by duration</span></div>
      <div class="chart-wrap"><canvas id="ig-retention-blocks-chart"></canvas></div>
    </div>

    <!-- Follower growth + follows per post -->
    <div class="chart-grid chart-grid-2 mb-26">
      <div class="chart-card">
        <div class="chart-title">Follower growth</div>
        <div class="chart-wrap"><canvas id="ig-follower-chart"></canvas></div>
      </div>
      <div class="chart-card">
        <div class="chart-title">New followers per post</div>
        <div class="chart-wrap"><canvas id="ig-follows-chart"></canvas></div>
      </div>
    </div>

    <!-- Top posts -->
    <div class="section-header mb-16">
      <div class="section-title">Top Performing Posts</div>
    </div>
    <div class="posts-grid mb-26" id="ig-posts-list">
      ${posts.length ? posts.map(renderIGPost).join('') : '<div class="text-muted fs-12" style="padding:20px">No posts found for this period.</div>'}
    </div>

    <!-- Demographics -->
    ${renderIGDemographics(demo)}
  `;

  // Reach chart — merge estimated historical points with actual daily data
  const estPoints = ts.estimatedPoints || [];
  const allLabels = [...estPoints.map(p => p.date), ...(ts.labels || [])];
  const actualData = [...estPoints.map(() => null), ...(ts.reach || [])];
  const estimatedData = [...estPoints.map(p => p.reach), ...(ts.labels || []).map(() => null)];

  const reachDatasets = [
    {
      label: 'Daily reach (actual)',
      data: actualData,
      borderColor: '#833ab4',
      backgroundColor: 'rgba(131,58,180,0.12)',
      fill: true,
      tension: 0.4,
      pointRadius: 2,
      spanGaps: false,
    },
  ];

  if (estPoints.length) {
    reachDatasets.unshift({
      label: 'Avg daily reach (estimated)',
      data: estimatedData,
      borderColor: '#833ab4',
      backgroundColor: 'transparent',
      borderDash: [6, 4],
      tension: 0.4,
      pointRadius: 5,
      pointStyle: 'circle',
      fill: false,
      spanGaps: false,
    });
  }

  renderChart('ig-reach-chart', lineChartDefaults(allLabels, reachDatasets));

  // Content type doughnut
  renderChart('ig-content-chart', doughnutDefaults(
    cb.labels || [],
    cb.counts || [],
    ['#833ab4', '#fd1d1d', '#fcb045', '#58a6ff']
  ));

  // Watch time vs duration scatter chart
  if (watchTimeData.length) {
    const scatterPoints = watchTimeData.map(p => ({
      x: parseFloat((p.videoDuration / 1000).toFixed(1)),
      y: parseFloat((p.avgWatchTime / 1000).toFixed(1)),
      caption: p.caption || '—',
      watchPct: p.watchPct,
      postedAt: p.postedAt,
      likes: p.likes,
      comments: p.comments,
      shares: p.shares,
      saves: p.saves,
      reach: p.reach,
      views: p.views,
      engagementRate: p.engagementRate,
    }));

    const xVals = scatterPoints.map(p => p.x);
    const yVals = scatterPoints.map(p => p.y);
    const xPad = (Math.max(...xVals) - Math.min(...xVals)) * 0.12 || 2;
    const yPad = (Math.max(...yVals) - Math.min(...yVals)) * 0.12 || 1;
    const xMin = Math.max(0, Math.min(...xVals) - xPad);
    const xMax = Math.max(...xVals) + xPad;
    const yMin = Math.max(0, Math.min(...yVals) - yPad);
    const yMax = Math.max(...yVals) + yPad;

    // Diagonal reference line y=x (perfect retention), clipped to visible range
    const refLine = [{ x: xMin, y: xMin }, { x: xMax, y: xMax }];

    renderChart('ig-watchtime-chart', {
      type: 'scatter',
      data: {
        datasets: [
          {
            label: 'Reels',
            data: scatterPoints,
            backgroundColor: scatterPoints.map(p =>
              p.watchPct >= 75 ? 'rgba(34,197,94,0.8)' :
              p.watchPct >= 50 ? 'rgba(252,176,69,0.8)' :
              'rgba(131,58,180,0.7)'
            ),
            borderColor: scatterPoints.map(p =>
              p.watchPct >= 75 ? '#22c55e' :
              p.watchPct >= 50 ? '#fcb045' :
              '#833ab4'
            ),
            borderWidth: 1.5,
            pointRadius: 7,
            pointHoverRadius: 9,
          },
          {
            label: '100% retention line',
            data: refLine,
            type: 'line',
            borderColor: 'rgba(0,0,0,0.15)',
            borderDash: [5, 4],
            borderWidth: 1.5,
            pointRadius: 0,
            fill: false,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            labels: {
              color: '#6b7280',
              font: { size: 11 },
              filter: item => item.text !== '100% retention line',
              generateLabels: chart => [
                { text: '≥75% retained', fillStyle: 'rgba(34,197,94,0.8)', strokeStyle: '#22c55e', lineWidth: 1.5, hidden: false },
                { text: '50–74% retained', fillStyle: 'rgba(252,176,69,0.8)', strokeStyle: '#fcb045', lineWidth: 1.5, hidden: false },
                { text: '<50% retained', fillStyle: 'rgba(131,58,180,0.7)', strokeStyle: '#833ab4', lineWidth: 1.5, hidden: false },
              ],
            },
          },
          tooltip: {
            backgroundColor: '#ffffff',
            titleColor: '#111827',
            bodyColor: '#6b7280',
            borderColor: 'rgba(0,0,0,0.08)',
            borderWidth: 1,
            callbacks: {
              title: items => {
                const p = items[0]?.raw;
                return p?.caption ? p.caption.slice(0, 70) + (p.caption.length > 70 ? '…' : '') : '';
              },
              label: () => '',
              afterLabel: item => {
                const p = item.raw;
                return [
                  `Posted: ${fmtDate(p.postedAt)}`,
                  `Duration: ${item.parsed.x}s  ·  Avg watch: ${item.parsed.y}s`,
                  `Retention: ${p.watchPct}%`,
                  `─────────────────────`,
                  `Reach: ${fmtNum(p.reach)}  ·  Views: ${fmtNum(p.views)}`,
                  `Likes: ${fmtNum(p.likes)}  ·  Comments: ${fmtNum(p.comments)}`,
                  `Shares: ${fmtNum(p.shares)}  ·  Saves: ${fmtNum(p.saves)}`,
                  `Engagement rate: ${p.engagementRate}%`,
                ];
              },
            },
          },
        },
        scales: {
          x: {
            min: xMin,
            max: xMax,
            title: { display: true, text: 'Video duration (s)', color: '#6b7280', font: { size: 11 } },
            grid: { color: 'rgba(0,0,0,0.06)' },
            ticks: { color: '#6b7280', font: { size: 11 }, callback: v => v + 's' },
          },
          y: {
            min: yMin,
            max: yMax,
            title: { display: true, text: 'Avg watch time (s)', color: '#6b7280', font: { size: 11 } },
            grid: { color: 'rgba(0,0,0,0.06)' },
            ticks: { color: '#6b7280', font: { size: 11 }, callback: v => v + 's' },
          },
        },
        plugins: {
          zoom: {
            pan: { enabled: true, mode: 'xy', scaleMode: 'xy', rangeMin: { x: 0, y: 0 } },
            zoom: {
              wheel: { enabled: true },
              pinch: { enabled: true },
              mode: 'xy',
              onZoom: () => { const btn = document.getElementById('watchtime-reset-btn'); if (btn) btn.style.opacity = '1'; },
              onZoomComplete: ({ chart }) => {
                if (chart.scales.x.min < 0) chart.scales.x.options.min = 0;
                if (chart.scales.y.min < 0) chart.scales.y.options.min = 0;
                chart.update('none');
              },
            },
          },
        },
      },
    });
    window._watchtimeChart = Chart.getChart('ig-watchtime-chart');

    // Retention % vs duration scatter
    const retPoints = scatterPoints.map(p => ({
      x: p.x,
      y: p.watchPct,
      caption: p.caption,
      postedAt: p.postedAt,
      avgWatchTime: p.y,
      likes: p.likes,
      comments: p.comments,
      shares: p.shares,
      saves: p.saves,
      reach: p.reach,
      views: p.views,
      engagementRate: p.engagementRate,
    }));

    const rxPad = (Math.max(...retPoints.map(p => p.x)) - Math.min(...retPoints.map(p => p.x))) * 0.12 || 2;
    const ryPad = (Math.max(...retPoints.map(p => p.y)) - Math.min(...retPoints.map(p => p.y))) * 0.12 || 5;
    const rxMin = Math.max(0, Math.min(...retPoints.map(p => p.x)) - rxPad);
    const rxMax = Math.max(...retPoints.map(p => p.x)) + rxPad;
    const ryMin = Math.max(0, Math.min(...retPoints.map(p => p.y)) - ryPad);
    const ryMax = Math.min(100, Math.max(...retPoints.map(p => p.y)) + ryPad);

    renderChart('ig-retention-scatter', {
      type: 'scatter',
      data: {
        datasets: [{
          label: 'Reels',
          data: retPoints,
          backgroundColor: retPoints.map(p =>
            p.y >= 75 ? 'rgba(34,197,94,0.8)' :
            p.y >= 50 ? 'rgba(252,176,69,0.8)' :
            'rgba(131,58,180,0.7)'
          ),
          borderColor: retPoints.map(p =>
            p.y >= 75 ? '#22c55e' :
            p.y >= 50 ? '#fcb045' :
            '#833ab4'
          ),
          borderWidth: 1.5,
          pointRadius: 7,
          pointHoverRadius: 9,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            labels: {
              color: '#6b7280',
              font: { size: 11 },
              generateLabels: () => [
                { text: '≥75% retained', fillStyle: 'rgba(34,197,94,0.8)', strokeStyle: '#22c55e', lineWidth: 1.5 },
                { text: '50–74% retained', fillStyle: 'rgba(252,176,69,0.8)', strokeStyle: '#fcb045', lineWidth: 1.5 },
                { text: '<50% retained', fillStyle: 'rgba(131,58,180,0.7)', strokeStyle: '#833ab4', lineWidth: 1.5 },
              ],
            },
          },
          tooltip: {
            backgroundColor: '#ffffff',
            titleColor: '#111827',
            bodyColor: '#6b7280',
            borderColor: 'rgba(0,0,0,0.08)',
            borderWidth: 1,
            callbacks: {
              title: items => {
                const p = items[0]?.raw;
                return p?.caption ? p.caption.slice(0, 70) + (p.caption.length > 70 ? '…' : '') : '';
              },
              label: () => '',
              afterLabel: item => {
                const p = item.raw;
                return [
                  `Posted: ${fmtDate(p.postedAt)}`,
                  `Duration: ${p.x}s  ·  Avg watch: ${p.avgWatchTime}s`,
                  `Retention: ${p.y}%`,
                  `─────────────────────`,
                  `Reach: ${fmtNum(p.reach)}  ·  Views: ${fmtNum(p.views)}`,
                  `Likes: ${fmtNum(p.likes)}  ·  Comments: ${fmtNum(p.comments)}`,
                  `Shares: ${fmtNum(p.shares)}  ·  Saves: ${fmtNum(p.saves)}`,
                  `Engagement rate: ${p.engagementRate}%`,
                ];
              },
            },
          },
        },
        scales: {
          x: {
            min: rxMin,
            max: rxMax,
            title: { display: true, text: 'Video duration (s)', color: '#6b7280', font: { size: 11 } },
            grid: { color: 'rgba(0,0,0,0.06)' },
            ticks: { color: '#6b7280', font: { size: 11 }, callback: v => v + 's' },
          },
          y: {
            min: ryMin,
            max: ryMax,
            title: { display: true, text: 'Retention rate (%)', color: '#6b7280', font: { size: 11 } },
            grid: { color: 'rgba(0,0,0,0.06)' },
            ticks: { color: '#6b7280', font: { size: 11 }, callback: v => v + '%' },
          },
        },
      },
    });
    window._retentionChart = Chart.getChart('ig-retention-scatter');

    // Retention by duration blocks bar chart
    const durationBuckets = [
      { label: '0–15s',   min: 0,   max: 15  },
      { label: '15–30s',  min: 15,  max: 30  },
      { label: '30–60s',  min: 30,  max: 60  },
      { label: '60–120s', min: 60,  max: 120 },
      { label: '120s+',   min: 120, max: Infinity },
    ];

    const bucketData = durationBuckets.map(b => {
      const group = retPoints.filter(p => p.x >= b.min && p.x < b.max);
      const avg = group.length
        ? parseFloat((group.reduce((a, p) => a + p.y, 0) / group.length).toFixed(1))
        : null;
      return { label: b.label, avg, count: group.length };
    }).filter(b => b.count > 0);

    if (bucketData.length) {
      renderChart('ig-retention-blocks-chart', {
        type: 'bar',
        data: {
          labels: bucketData.map(b => `${b.label}\n(${b.count} reel${b.count !== 1 ? 's' : ''})`),
          datasets: [{
            label: 'Avg retention %',
            data: bucketData.map(b => b.avg),
            backgroundColor: bucketData.map(b =>
              b.avg >= 75 ? 'rgba(34,197,94,0.8)' :
              b.avg >= 50 ? 'rgba(252,176,69,0.8)' :
              'rgba(131,58,180,0.7)'
            ),
            borderColor: bucketData.map(b =>
              b.avg >= 75 ? '#22c55e' :
              b.avg >= 50 ? '#fcb045' :
              '#833ab4'
            ),
            borderWidth: 1.5,
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
              titleColor: '#111827',
              bodyColor: '#6b7280',
              borderColor: 'rgba(0,0,0,0.08)',
              borderWidth: 1,
              callbacks: {
                title: items => items[0].label.replace('\n', ' '),
                label: item => ` Avg retention: ${item.parsed.y}%`,
              },
            },
          },
          scales: {
            x: {
              grid: { display: false },
              ticks: { color: '#6b7280', font: { size: 11 } },
            },
            y: {
              min: 0,
              max: 100,
              grid: { color: 'rgba(0,0,0,0.06)' },
              ticks: { color: '#6b7280', font: { size: 11 }, callback: v => v + '%' },
            },
          },
        },
      });
    } else {
      const rc = document.getElementById('ig-retention-blocks-chart');
      if (rc) rc.parentElement.innerHTML = '<div class="text-muted fs-12" style="padding:20px;text-align:center">Not enough data yet.</div>';
    }

  } else {
    const wc = document.getElementById('ig-watchtime-chart');
    if (wc) wc.parentElement.innerHTML = '<div class="text-muted fs-12" style="padding:20px;text-align:center">Watch time data will appear after next sync.</div>';
  }

  // Follower growth chart
  if (fg.labels.length) {
    renderChart('ig-follower-chart', lineChartDefaults(fg.labels, [{
      label: 'Followers',
      data: fg.followers,
      borderColor: '#833ab4',
      backgroundColor: 'rgba(131,58,180,0.12)',
      fill: true,
      tension: 0.4,
      pointRadius: 4,
    }]));
  } else {
    const fc = document.getElementById('ig-follower-chart');
    if (fc) fc.parentElement.innerHTML = '<div class="text-muted fs-12" style="padding:20px;text-align:center">Syncing will start recording follower counts from today.</div>';
  }

  // Follows per post bar chart
  const followsPosts = followsPerPost.filter(p => p.follows > 0);
  if (followsPosts.length) {
    renderChart('ig-follows-chart', {
      type: 'bar',
      data: {
        labels: followsPosts.map(p => p.caption || fmtDate(p.date)),
        datasets: [{
          label: 'Follows',
          data: followsPosts.map(p => p.follows),
          backgroundColor: '#833ab4cc',
          borderColor: '#833ab4',
          borderWidth: 1,
          borderRadius: 4,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#ffffff',
            titleColor: '#111827',
            bodyColor: '#6b7280',
            borderColor: 'rgba(0,0,0,0.08)',
            borderWidth: 1,
            callbacks: {
              title: items => followsPosts[items[0].dataIndex]?.caption || '',
              label: item => ` ${item.parsed.y} new followers`,
            },
          },
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: '#6b7280', font: { size: 10 }, maxRotation: 45, callback: (_, i) => followsPosts[i]?.caption?.slice(0, 20) || '' } },
          y: { grid: { color: 'rgba(0,0,0,0.06)' }, ticks: { color: '#6b7280', font: { size: 11 }, stepSize: 1 } },
        },
      },
    });
  } else {
    const fc = document.getElementById('ig-follows-chart');
    if (fc) fc.parentElement.innerHTML = '<div class="text-muted fs-12" style="padding:20px;text-align:center">Follows data will appear after next sync.</div>';
  }

  // ER scatter plot — exclude statistical outliers (mean + 2σ)
  const allER = scatter.map(p => parseFloat(p.er));
  const erMean = allER.reduce((a, b) => a + b, 0) / (allER.length || 1);
  const erStd = Math.sqrt(allER.reduce((a, b) => a + (b - erMean) ** 2, 0) / (allER.length || 1));
  const erCeiling = erMean + 2 * erStd;
  const scatterFiltered = scatter.filter(p => parseFloat(p.er) <= erCeiling);

  const scatterColors = { REEL: '#833ab4', IMAGE: '#e20415', CAROUSEL_ALBUM: '#fcb045' };
  const scatterLabels = { REEL: 'Reels', IMAGE: 'Posts', CAROUSEL_ALBUM: 'Carousels' };
  const scatterByType = {};
  scatterFiltered.forEach(p => {
    const t = p.mediaType || 'OTHER';
    if (!scatterByType[t]) scatterByType[t] = [];
    scatterByType[t].push({ x: p.date, y: parseFloat(p.er), caption: p.caption });
  });

  const scatterDatasets = Object.entries(scatterByType).map(([type, points]) => ({
    label: scatterLabels[type] || type,
    data: points,
    backgroundColor: (scatterColors[type] || '#888') + 'cc',
    borderColor: scatterColors[type] || '#888',
    borderWidth: 1,
    pointRadius: 6,
    pointHoverRadius: 8,
  }));

  renderChart('ig-er-scatter', {
    type: 'scatter',
    data: { datasets: scatterDatasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: '#6b7280', font: { size: 11 } } },
        tooltip: {
          backgroundColor: '#ffffff',
          titleColor: '#111827',
          bodyColor: '#6b7280',
          borderColor: 'rgba(0,0,0,0.08)',
          borderWidth: 1,
          callbacks: {
            title: items => items[0]?.raw?.caption || '',
            label: item => ` ${fmtDate(item.raw.x)}  ·  ${parseFloat(item.raw.y).toFixed(1)}% ER`,
          },
        },
      },
      scales: {
        x: {
          type: 'category',
          grid: { color: 'rgba(0,0,0,0.06)' },
          ticks: { color: '#6b7280', font: { size: 10 }, maxRotation: 45 },
        },
        y: {
          grid: { color: 'rgba(0,0,0,0.06)' },
          ticks: { color: '#6b7280', font: { size: 11 }, callback: v => v + '%' },
          title: { display: true, text: 'Engagement Rate', color: '#9ca3af', font: { size: 10 } },
        },
      },
    },
  });

}

function renderIGPost(post, i) {
  const thumbHtml = post.thumbnail
    ? `<img src="${post.thumbnail}" alt="" loading="lazy" onerror="this.style.display='none'">`
    : '📸';
  return `<div class="post-card">
    <div class="post-rank ${rankClass(i)}">${i + 1}</div>
    <div class="post-thumb">${thumbHtml}</div>
    <div class="post-info">
      ${mediaTypeBadge(post.mediaType)}
      <div class="post-caption">${post.caption || '(no caption)'}</div>
      <div class="post-meta">
        <div class="post-meta-item">Likes <span class="val">${fmtNum(post.likes)}</span></div>
        <div class="post-meta-item">Comments <span class="val">${fmtNum(post.comments)}</span></div>
        <div class="post-meta-item">Shares <span class="val">${fmtNum(post.shares)}</span></div>
        <div class="post-meta-item">Saves <span class="val">${fmtNum(post.saves)}</span></div>
        <div class="post-meta-item">Reach <span class="val">${fmtNum(post.reach)}</span></div>
        <div class="post-meta-item">Impressions <span class="val">${fmtNum(post.impressions)}</span></div>
        <div class="post-meta-item">Profile Visits <span class="val">${fmtNum(post.profileVisits)}</span></div>
        <div class="post-meta-item">Follows <span class="val">${fmtNum(post.follows)}</span></div>
        <div class="post-meta-item"><span class="val">${fmtDate(post.timestamp)}</span></div>
      </div>
    </div>
    <div class="post-eng-badge">${fmtPct(post.engagementRate)} ER</div>
  </div>`;
}


function resetWatchtimeZoom() {
  const chart = window._watchtimeChart;
  if (chart) chart.resetZoom();
  const btn = document.getElementById('watchtime-reset-btn');
  if (btn) btn.style.opacity = '0.4';
}

function renderIGDemographics(demo) {
  if (!demo || (!demo.genderSplit?.female && !demo.ageGroups?.length)) return '';

  const genderHtml = demo.genderSplit
    ? `<div class="gender-bars">
        <div class="gender-bar-row">
          <div class="gender-bar-label">Female</div>
          <div class="gender-bar-track"><div class="gender-bar-fill female" style="width:${demo.genderSplit.female || 0}%"></div></div>
          <div class="gender-bar-pct">${demo.genderSplit.female || 0}%</div>
        </div>
        <div class="gender-bar-row">
          <div class="gender-bar-label">Male</div>
          <div class="gender-bar-track"><div class="gender-bar-fill male" style="width:${demo.genderSplit.male || 0}%"></div></div>
          <div class="gender-bar-pct">${demo.genderSplit.male || 0}%</div>
        </div>
      </div>` : '';

  const ageHtml = (demo.ageGroups || []).map(a =>
    `<div class="age-row">
      <div class="age-label">${a.range}</div>
      <div class="age-track"><div class="age-fill" style="width:${a.pct}%"></div></div>
      <div class="age-pct">${a.pct}%</div>
    </div>`
  ).join('');

  const locHtml = (demo.topLocations || []).map((loc, i) =>
    `<div class="location-row">
      <div class="flex-center gap-8">
        <div class="location-rank">${i + 1}</div>
        <div class="location-name">${loc}</div>
      </div>
    </div>`
  ).join('');

  return `
    <div class="section-header mb-16">
      <div class="section-title">Audience Demographics</div>
    </div>
    <div class="demo-row mb-26">
      <div class="chart-card">
        <div class="chart-title">Gender split</div>
        ${genderHtml}
        ${ageHtml ? `<div class="chart-title" style="margin-top:20px">Age groups</div><div class="age-list">${ageHtml}</div>` : ''}
      </div>
      <div class="chart-card">
        <div class="chart-title">Top locations</div>
        <div class="location-list">${locHtml || '<div class="text-muted fs-12">No data</div>'}</div>
      </div>
    </div>`;
}
