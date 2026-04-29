// ── Compare Posts page ──────────────────────────────────────────────────────

let compareSelection = []; // array of post objects

function loadCompare() { renderComparePage(); }

function addToCompare(post, btn) {
  if (compareSelection.find(p => p.id === post.id)) return;
  compareSelection.push(post);
  if (btn) {
    btn.textContent = 'Added';
    btn.disabled = true;
    btn.style.opacity = '0.5';
  }
  // If already on compare page, re-render
  if (document.getElementById('page-compare').classList.contains('active')) {
    renderComparePage();
  }
}

function removeFromCompare(id) {
  compareSelection = compareSelection.filter(p => p.id !== id);
  renderComparePage();
  // Re-enable the button on posts page if visible
  const btn = document.querySelector(`.add-to-compare-btn[data-id="${id}"]`);
  if (btn) { btn.textContent = '+ Compare'; btn.disabled = false; btn.style.opacity = ''; }
}

function clearCompare() {
  compareSelection = [];
  document.querySelectorAll('.add-to-compare-btn').forEach(btn => {
    btn.textContent = '+ Compare';
    btn.disabled = false;
    btn.style.opacity = '';
  });
  renderComparePage();
}

function renderComparePage() {
  const container = document.getElementById('compare-content');
  if (!container) return;

  if (compareSelection.length === 0) {
    container.innerHTML = `
      <div class="compare-empty">
        <div class="compare-empty-icon">↔</div>
        <div class="compare-empty-title">No posts selected</div>
        <div class="compare-empty-sub">Go to <strong>All Posts</strong> and click <strong>+ Compare</strong> on any posts you want to compare.</div>
      </div>`;
    return;
  }

  const metrics = [
    { key: 'engagementRate', label: 'Engagement Rate', fmt: v => `${v}%` },
    { key: 'reach',     label: 'Reach',     fmt: fmtNum },
    { key: 'likes',     label: 'Likes',     fmt: fmtNum },
    { key: 'comments',  label: 'Comments',  fmt: fmtNum },
    { key: 'shares',    label: 'Shares',    fmt: fmtNum },
    { key: 'saves',     label: 'Saves',     fmt: fmtNum },
    { key: 'views',     label: 'Views',     fmt: fmtNum },
  ];

  // Find max value per metric for bar scaling
  const maxVals = {};
  metrics.forEach(m => {
    maxVals[m.key] = Math.max(...compareSelection.map(p => parseFloat(p[m.key]) || 0), 1);
  });

  const postColors = ['#833ab4', '#e20415', '#fcb045', '#58a6ff', '#1a7f37', '#fd1d1d'];

  container.innerHTML = `
    <div class="compare-header mb-16">
      <div>
        <div class="section-title">Comparing ${compareSelection.length} post${compareSelection.length !== 1 ? 's' : ''}</div>
      </div>
      <button class="sync-btn" onclick="clearCompare()">Clear all</button>
    </div>

    <!-- Post cards row -->
    <div class="compare-posts-row mb-26">
      ${compareSelection.map((post, i) => `
        <div class="compare-post-card" style="border-top: 3px solid ${postColors[i % postColors.length]}">
          <button class="compare-remove-btn" onclick="removeFromCompare('${post.id}')" title="Remove">×</button>
          <div class="compare-thumb">
            ${post.thumbnail
              ? `<img src="${post.thumbnail}" alt="" loading="lazy" onerror="this.style.display='none'">`
              : '<div class="compare-thumb-placeholder"></div>'}
          </div>
          <div class="compare-post-type">${mediaTypeBadge(post.mediaType)}</div>
          <div class="compare-post-caption">${post.caption || '(no caption)'}</div>
          <div class="compare-post-date">${fmtDate(post.timestamp)}</div>
          <div class="compare-post-er" style="color:${postColors[i % postColors.length]}">${fmtPct(post.engagementRate)} ER</div>
        </div>
      `).join('')}
    </div>

    <!-- Metric comparison bars -->
    <div class="section-header mb-16">
      <div class="section-title">Metric Breakdown</div>
    </div>
    <div class="compare-metrics-table mb-26">
      ${metrics.map(m => `
        <div class="compare-metric-row">
          <div class="compare-metric-label">${m.label}</div>
          <div class="compare-metric-bars">
            ${compareSelection.map((post, i) => {
              const val = parseFloat(post[m.key]) || 0;
              const pct = (val / maxVals[m.key]) * 100;
              return `<div class="compare-bar-row">
                <div class="compare-bar-track">
                  <div class="compare-bar-fill" style="width:${pct}%;background:${postColors[i % postColors.length]}"></div>
                </div>
                <div class="compare-bar-val">${m.fmt(post[m.key])}</div>
              </div>`;
            }).join('')}
          </div>
        </div>
      `).join('')}
    </div>

    <!-- Chart -->
    <div class="section-header mb-16">
      <div class="section-title">Visual Comparison</div>
    </div>
    <div class="chart-card mb-26">
      <div class="chart-wrap" style="height:300px">
        <canvas id="compare-chart"></canvas>
      </div>
    </div>
  `;

  // Render grouped bar chart
  const labels = metrics.map(m => m.label);
  const datasets = compareSelection.map((post, i) => ({
    label: post.caption ? post.caption.slice(0, 30) + (post.caption.length > 30 ? '…' : '') : `Post ${i + 1}`,
    data: metrics.map(m => {
      const val = parseFloat(post[m.key]) || 0;
      const max = maxVals[m.key];
      return max > 0 ? parseFloat(((val / max) * 100).toFixed(1)) : 0;
    }),
    backgroundColor: postColors[i % postColors.length] + '99',
    borderColor: postColors[i % postColors.length],
    borderWidth: 1.5,
    borderRadius: 4,
  }));

  renderChart('compare-chart', {
    type: 'bar',
    data: { labels, datasets },
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
            label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.y}% of max`,
          },
        },
      },
      scales: {
        x: { grid: { color: 'rgba(0,0,0,0.06)' }, ticks: { color: '#6b7280', font: { size: 11 } } },
        y: {
          grid: { color: 'rgba(0,0,0,0.06)' },
          ticks: { color: '#6b7280', font: { size: 11 }, callback: v => v + '%' },
          max: 100,
        },
      },
    },
  });
}
