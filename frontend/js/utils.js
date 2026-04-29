// ── Formatting helpers ─────────────────────────────────────────────────────
function fmtNum(n) {
  if (n == null || isNaN(n)) return '—';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'K';
  return n.toLocaleString();
}

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtPct(v) {
  const n = parseFloat(v);
  if (!n || n === 0) return '—';
  return n.toFixed(1) + '%';
}

function rankClass(i) {
  if (i === 0) return 'gold';
  if (i === 1) return 'silver';
  if (i === 2) return 'bronze';
  return '';
}

function mediaTypeBadge(type) {
  const map = {
    REEL: ['reel', 'Reel'],
    IMAGE: ['image', 'Post'],
    CAROUSEL_ALBUM: ['carousel', 'Carousel'],
    VIDEO: ['video', 'Video'],
  };
  const [cls, label] = map[type] || ['default', type || 'Post'];
  return `<span class="media-type-badge ${cls}">${label}</span>`;
}

// ── Chart.js shared defaults ───────────────────────────────────────────────
const CHART_FONT = {
  family: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  size: 11,
};

const GRID_COLOR = 'rgba(0,0,0,0.06)';
const TICK_COLOR = '#6b7280';

function lineChartDefaults(labels, datasets) {
  return {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { labels: { color: TICK_COLOR, font: CHART_FONT, boxWidth: 12, padding: 16 } },
        tooltip: {
          backgroundColor: '#ffffff',
          borderColor: 'rgba(0,0,0,0.1)',
          borderWidth: 1,
          titleColor: '#111827',
          bodyColor: '#6b7280',
          padding: 10,
        },
      },
      scales: {
        x: {
          grid: { color: GRID_COLOR },
          ticks: { color: TICK_COLOR, font: CHART_FONT, maxTicksLimit: 8 },
        },
        y: {
          grid: { color: GRID_COLOR },
          ticks: { color: TICK_COLOR, font: CHART_FONT, callback: (v) => fmtNum(v) },
        },
      },
    },
  };
}

function barChartDefaults(labels, datasets) {
  return {
    type: 'bar',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: TICK_COLOR, font: CHART_FONT, boxWidth: 12, padding: 16 } },
        tooltip: {
          backgroundColor: '#ffffff',
          borderColor: 'rgba(0,0,0,0.1)',
          borderWidth: 1,
          titleColor: '#111827',
          bodyColor: '#6b7280',
          padding: 10,
        },
      },
      scales: {
        x: { grid: { color: GRID_COLOR }, ticks: { color: TICK_COLOR, font: CHART_FONT } },
        y: {
          grid: { color: GRID_COLOR },
          ticks: { color: TICK_COLOR, font: CHART_FONT, callback: (v) => fmtNum(v) },
        },
      },
    },
  };
}

function doughnutDefaults(labels, data, colors) {
  return {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{ data, backgroundColor: colors, borderColor: '#1c2230', borderWidth: 2 }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '65%',
      plugins: {
        legend: {
          position: 'right',
          labels: { color: TICK_COLOR, font: CHART_FONT, boxWidth: 12, padding: 12 },
        },
        tooltip: {
          backgroundColor: '#ffffff',
          borderColor: 'rgba(0,0,0,0.1)',
          borderWidth: 1,
          titleColor: '#111827',
          bodyColor: '#6b7280',
          padding: 10,
        },
      },
    },
  };
}

// ── Skeleton HTML ──────────────────────────────────────────────────────────
function skeletonStatCard(accentClass) {
  return `<div class="stat-card ${accentClass}">
    <div class="skeleton skeleton-text w50" style="margin-bottom:14px"></div>
    <div class="skeleton skeleton-stat-value"></div>
    <div class="skeleton skeleton-text w30" style="margin-top:10px"></div>
  </div>`;
}

function skeletonPostCard() {
  return `<div class="post-card">
    <div class="skeleton skeleton-thumb"></div>
    <div style="flex:1">
      <div class="skeleton skeleton-text w90"></div>
      <div class="skeleton skeleton-text w70"></div>
      <div class="skeleton skeleton-text w50"></div>
    </div>
  </div>`;
}

// ── Chart registry (to destroy before re-render) ───────────────────────────
const chartRegistry = {};

function renderChart(id, config) {
  if (chartRegistry[id]) {
    chartRegistry[id].destroy();
    delete chartRegistry[id];
  }
  const canvas = document.getElementById(id);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  chartRegistry[id] = new Chart(ctx, config);
}

// ── Demo banner ────────────────────────────────────────────────────────────
function demoBanner(platform) {
  return `<div class="demo-banner">
    <div><strong>Demo Mode</strong> — ${platform} credentials not configured.
    Add your tokens to <code>.env</code> to see live data.</div>
  </div>`;
}
