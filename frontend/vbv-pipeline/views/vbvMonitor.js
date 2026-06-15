// ── Monitor: read-only weekly calendar of all editors' active jobs ─────────

const VBV_MONITOR_MILESTONE_LABELS = {
  claimed:           'Claimed',
  submitted:         'Submitted',
  lead_approved:     'Lead Approved',
  sent_back_by_lead: 'Sent Back',
  sm_approved:       'SM Approved',
  sent_back_by_sm:   'Sent Back (SM)',
};

const VBV_MONITOR_MILESTONE_COLORS = {
  claimed:           '#3B82F6',
  submitted:         '#F59E0B',
  lead_approved:     '#8B5CF6',
  sent_back_by_lead: '#F97316',
  sm_approved:       '#10B981',
  sent_back_by_sm:   '#EF4444',
};

const VBV_MONITOR_DEADLINE_COLOR = '#374151';

const VBV_MONITOR_STATUS_LABELS = {
  open:              'Open',
  assigned:          'Assigned',
  in_progress:       'In Progress',
  submitted:         'Submitted',
  sent_back_by_lead: 'Sent Back',
  lead_approved:     'In Review',
  sent_back_by_sm:   'Correction Requested',
  sm_approved:       'Approved',
};

let vbvMonitorState = {
  weekStart: vbvMonitorGetMonday(new Date()),
  editorId: null,
  includeUnclaimed: false,
  selectedJobId: null,
};

let vbvMonitorOutsideClickHandler = null;

function vbvMonitorGetMonday(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function vbvMonitorWeekDays(weekStart) {
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    days.push(d);
  }
  return days;
}

function vbvMonitorIsSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

async function vbvRenderMonitor() {
  return `<h1>Monitor</h1><div id="vbv-monitor-root"></div>`;
}

function vbvBindMonitor() {
  vbvMonitorLoad();
}

async function vbvMonitorLoad() {
  const root = document.getElementById('vbv-monitor-root');
  if (!root) return;
  root.innerHTML = '<div class="vbv-loading">Loading…</div>';

  let editors = [], jobs = [];
  try {
    const params = new URLSearchParams();
    if (vbvMonitorState.editorId) params.set('editorId', vbvMonitorState.editorId);
    if (vbvMonitorState.includeUnclaimed) params.set('includeUnclaimed', 'true');

    [editors, jobs] = await Promise.all([
      vbvApi('GET', '/vbv/monitor/editors'),
      vbvApi('GET', `/vbv/monitor/jobs?${params.toString()}`),
    ]);
  } catch (e) {
    root.innerHTML = `<div class="vbv-alert vbv-alert-error">${e.message}</div>`;
    return;
  }

  root.innerHTML = vbvMonitorRenderContent(editors, jobs);
  vbvMonitorBindContent(jobs);
}

function vbvMonitorRenderContent(editors, jobs) {
  const weekDays = vbvMonitorWeekDays(vbvMonitorState.weekStart);
  const weekEnd = new Date(weekDays[6]);
  weekEnd.setHours(23, 59, 59, 999);

  return `
    <div class="vbv-monitor-layout">
      ${vbvMonitorRenderFilterPanel(editors)}
      ${vbvMonitorRenderJobListPanel(jobs)}
      ${vbvMonitorRenderCalendarPanel(editors, jobs, weekDays, weekEnd)}
    </div>`;
}

// ── Editor Filter Panel ──────────────────────────────────────────────────

function vbvMonitorRenderFilterPanel(editors) {
  const allActive = !vbvMonitorState.editorId ? 'active' : '';
  const items = editors.map(e => {
    const active = vbvMonitorState.editorId === e.id ? 'active' : '';
    return `<button class="vbv-monitor-editor-btn ${active}" data-editor-id="${e.id}">${escapeHtml(e.name)}</button>`;
  }).join('') || '<div class="vbv-empty">No active editors.</div>';

  return `
    <div class="vbv-monitor-col vbv-monitor-filter">
      <h2>Editors</h2>
      <div class="vbv-monitor-editor-list">
        <button class="vbv-monitor-editor-btn ${allActive}" data-editor-id="">Show All</button>
        ${items}
      </div>
    </div>`;
}

// ── Job List Panel ───────────────────────────────────────────────────────

function vbvMonitorRenderJobListPanel(jobs) {
  const now = new Date();
  const rows = jobs.length
    ? jobs.map(job => {
        const overdue = job.deadline && new Date(job.deadline) < now && job.status !== 'sm_approved';
        const selected = vbvMonitorState.selectedJobId === job.id ? 'selected' : '';
        return `
          <div class="vbv-monitor-job-entry ${selected}" data-job-id="${job.id}">
            <div class="vbv-monitor-job-title">${escapeHtml(job.title)}</div>
            <div class="vbv-monitor-job-meta">${escapeHtml(job.assignedTo?.name || 'Unassigned')} &bull; ${vbvStatusBadge(job.status)}</div>
            <div class="vbv-monitor-job-deadline ${overdue ? 'overdue' : ''}">Deadline: ${vbvFormatDeadline(job.deadline)}${overdue ? ' (Overdue)' : ''}</div>
          </div>`;
      }).join('')
    : '<div class="vbv-empty">No jobs to show.</div>';

  return `
    <div class="vbv-monitor-col vbv-monitor-joblist">
      <div class="vbv-monitor-joblist-header">
        <h2>Jobs</h2>
        <label class="vbv-monitor-toggle">
          <input type="checkbox" id="vbv-monitor-unclaimed-toggle" ${vbvMonitorState.includeUnclaimed ? 'checked' : ''}>
          Show all active (incl. unclaimed)
        </label>
      </div>
      <div class="vbv-monitor-job-entries">${rows}</div>
    </div>`;
}

// ── Weekly Calendar Panel ────────────────────────────────────────────────

function vbvMonitorRenderCalendarPanel(editors, jobs, weekDays, weekEnd) {
  const weekStart = weekDays[0];
  const weekLabel = `${weekStart.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} – ${weekEnd.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`;

  const today = new Date();
  const dayHeaders = weekDays.map(d => {
    const isToday = vbvMonitorIsSameDay(d, today) ? 'today' : '';
    return `<div class="vbv-monitor-cal-day-header ${isToday}">${d.toLocaleDateString('en-GB', { weekday: 'short' })} ${d.getDate()}/${d.getMonth() + 1}</div>`;
  }).join('');

  const calendarEditors = vbvMonitorState.editorId
    ? editors.filter(e => e.id === vbvMonitorState.editorId)
    : editors;

  const editorBlocks = calendarEditors.length
    ? calendarEditors.map(editor => vbvMonitorRenderEditorBlock(editor, jobs, weekStart, weekEnd)).join('')
    : '<div class="vbv-empty">No active editors.</div>';

  return `
    <div class="vbv-monitor-col vbv-monitor-calendar">
      ${vbvMonitorRenderLegend()}
      <div class="vbv-monitor-calendar-header">
        <button id="vbv-monitor-prev-week" class="vbv-btn vbv-btn-secondary vbv-btn-sm">&larr;</button>
        <strong>${weekLabel}</strong>
        <button id="vbv-monitor-next-week" class="vbv-btn vbv-btn-secondary vbv-btn-sm">&rarr;</button>
      </div>
      <div class="vbv-monitor-cal-header-row">
        <div class="vbv-monitor-cal-label-cell"></div>
        <div class="vbv-monitor-cal-days">${dayHeaders}</div>
      </div>
      ${editorBlocks}
    </div>`;
}

function vbvMonitorRenderLegend() {
  const items = Object.entries(VBV_MONITOR_MILESTONE_LABELS).map(([action, label]) =>
    `<span class="vbv-monitor-legend-item"><span class="vbv-monitor-legend-dot" style="background:${VBV_MONITOR_MILESTONE_COLORS[action]}"></span>${escapeHtml(label)}</span>`
  ).join('');

  return `
    <div class="vbv-monitor-legend">
      ${items}
      <span class="vbv-monitor-legend-item"><span class="vbv-monitor-legend-dot" style="background:${VBV_MONITOR_DEADLINE_COLOR}"></span>Deadline</span>
    </div>`;
}

function vbvMonitorRenderEditorBlock(editor, jobs, weekStart, weekEnd) {
  const editorJobs = jobs.filter(j => j.assignedTo?.id === editor.id);
  const bars = editorJobs
    .map(job => vbvMonitorBuildBar(job, weekStart, weekEnd))
    .filter(Boolean);

  const rows = bars.length
    ? bars.map(bar => vbvMonitorRenderJobRow(bar)).join('')
    : '<div class="vbv-monitor-job-row vbv-monitor-empty-row"></div>';

  return `
    <div class="vbv-monitor-editor-block">
      <div class="vbv-monitor-editor-label">${escapeHtml(editor.name)}</div>
      <div class="vbv-monitor-editor-jobs">${rows}</div>
    </div>`;
}

// Builds a calendar bar for a job within the given week. The bar always starts
// at VbvJob.claimedAt (clamped to Monday if claiming happened in a prior week),
// and extends to cover the deadline and any timeline milestones within the week.
function vbvMonitorBuildBar(job, weekStart, weekEnd) {
  if (!job.claimedAt) return null;

  const claimedDate = new Date(job.claimedAt);

  const points = [{ date: claimedDate, label: 'Claimed', action: 'claimed' }];
  if (job.deadline) points.push({ date: new Date(job.deadline), label: 'Deadline', isDeadline: true });
  (job.timelineLogs || []).forEach(log => {
    if (log.action === 'claimed') return; // already represented by claimedAt above
    const label = VBV_MONITOR_MILESTONE_LABELS[log.action];
    if (label) points.push({ date: new Date(log.createdAt), label, action: log.action });
  });

  const lastPoint = new Date(Math.max(...points.map(p => p.date.getTime())));

  // Jobs not yet sm_approved are still "in flight" — keep them visible in the
  // current week (e.g. as an overdue bar) even if their deadline/milestones
  // are all in the past.
  const now = new Date();
  const end = (job.status !== 'sm_approved' && now > lastPoint) ? now : lastPoint;

  if (end < weekStart || claimedDate > weekEnd) return null;

  const startedBeforeWeek = claimedDate < weekStart;
  const clampedStart = startedBeforeWeek ? weekStart : claimedDate;
  const clampedEnd = end > weekEnd ? weekEnd : end;

  const startCol = Math.floor((clampedStart - weekStart) / 86400000) + 1;
  const endCol = Math.floor((clampedEnd - weekStart) / 86400000) + 1;
  const span = endCol - startCol + 1;

  const overdue = !!(job.deadline && new Date(job.deadline) < now && job.status !== 'sm_approved');
  const dueThisWeek = !!(job.deadline && new Date(job.deadline) >= weekStart && new Date(job.deadline) <= weekEnd);

  const markers = points
    .filter(p => p.date >= weekStart && p.date <= weekEnd)
    .map(p => {
      const dayIdx = Math.floor((p.date - weekStart) / 86400000);
      const rawPosition = ((dayIdx - (startCol - 1) + 0.5) / span) * 100;
      // Clamp so markers outside the bar's own span (e.g. a deadline that
      // predates claimedAt) still render inside the bar rather than offscreen.
      const position = Math.max(0, Math.min(100, rawPosition));
      const color = p.isDeadline ? VBV_MONITOR_DEADLINE_COLOR : (VBV_MONITOR_MILESTONE_COLORS[p.action] || '#6b7280');
      return { ...p, position, color };
    });

  const selected = vbvMonitorState.selectedJobId === job.id;

  return { job, startCol, endCol, overdue, dueThisWeek, startedBeforeWeek, markers, selected };
}

function vbvMonitorJobTooltip(job) {
  const parts = [
    job.title,
    `Editor: ${job.assignedTo?.name || 'Unassigned'}`,
    `Status: ${VBV_MONITOR_STATUS_LABELS[job.status] || job.status}`,
    `Deadline: ${vbvFormatDeadline(job.deadline)}`,
  ];
  return parts.join('\n');
}

function vbvMonitorRenderJobRow(bar) {
  const { job, startCol, endCol, overdue, dueThisWeek, startedBeforeWeek, markers, selected } = bar;
  const classes = ['vbv-monitor-job-bar'];
  if (overdue) classes.push('overdue');
  else if (dueThisWeek) classes.push('due-this-week');
  if (startedBeforeWeek) classes.push('started-before-week');
  if (selected) classes.push('selected');

  const markerHtml = markers.map(m =>
    `<span class="vbv-monitor-marker" style="left:${m.position}%;color:${m.color}" title="${escapeHtml(m.label)} — ${m.date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}">●</span>`
  ).join('');

  return `
    <div class="vbv-monitor-job-row">
      <div class="${classes.join(' ')}" style="grid-column: ${startCol} / ${endCol + 1};" data-job-id="${job.id}" title="${escapeHtml(vbvMonitorJobTooltip(job))}">
        <span class="vbv-monitor-job-bar-title">${escapeHtml(job.title)}</span>
        ${markerHtml}
      </div>
    </div>`;
}

// ── Event binding ────────────────────────────────────────────────────────

function vbvMonitorBindContent(jobs) {
  document.querySelectorAll('.vbv-monitor-editor-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.editorId || null;
      vbvMonitorState.editorId = vbvMonitorState.editorId === id ? null : id;
      vbvMonitorLoad();
    });
  });

  const unclaimedToggle = document.getElementById('vbv-monitor-unclaimed-toggle');
  if (unclaimedToggle) {
    unclaimedToggle.addEventListener('change', () => {
      vbvMonitorState.includeUnclaimed = unclaimedToggle.checked;
      vbvMonitorLoad();
    });
  }

  function vbvMonitorSelectJob(id) {
    if (vbvMonitorState.selectedJobId === id) {
      vbvMonitorState.selectedJobId = null;
      vbvMonitorLoad();
      return;
    }
    vbvMonitorState.selectedJobId = id;

    // Jump the calendar to the week containing the job's claim date if needed
    const job = jobs.find(j => j.id === id);
    if (job?.claimedAt) {
      const claimed = new Date(job.claimedAt);
      const weekDays = vbvMonitorWeekDays(vbvMonitorState.weekStart);
      const weekEnd = new Date(weekDays[6]);
      weekEnd.setHours(23, 59, 59, 999);
      if (claimed < vbvMonitorState.weekStart || claimed > weekEnd) {
        vbvMonitorState.weekStart = vbvMonitorGetMonday(claimed);
      }
    }
    vbvMonitorLoad();
  }

  document.querySelectorAll('.vbv-monitor-job-entry').forEach(entry => {
    entry.addEventListener('click', () => vbvMonitorSelectJob(entry.dataset.jobId));
  });

  document.querySelectorAll('.vbv-monitor-job-bar').forEach(bar => {
    bar.addEventListener('click', (e) => {
      e.stopPropagation();
      vbvMonitorSelectJob(bar.dataset.jobId);
    });
  });

  // Clicking anywhere outside a job entry/bar deselects the active job
  if (vbvMonitorOutsideClickHandler) {
    document.removeEventListener('click', vbvMonitorOutsideClickHandler);
    vbvMonitorOutsideClickHandler = null;
  }
  if (vbvMonitorState.selectedJobId) {
    vbvMonitorOutsideClickHandler = (e) => {
      if (!e.target.closest('.vbv-monitor-job-entry') && !e.target.closest('.vbv-monitor-job-bar')) {
        vbvMonitorState.selectedJobId = null;
        vbvMonitorLoad();
      }
    };
    document.addEventListener('click', vbvMonitorOutsideClickHandler);
  }

  const prevBtn = document.getElementById('vbv-monitor-prev-week');
  const nextBtn = document.getElementById('vbv-monitor-next-week');
  if (prevBtn) prevBtn.addEventListener('click', () => {
    const d = new Date(vbvMonitorState.weekStart);
    d.setDate(d.getDate() - 7);
    vbvMonitorState.weekStart = d;
    vbvMonitorLoad();
  });
  if (nextBtn) nextBtn.addEventListener('click', () => {
    const d = new Date(vbvMonitorState.weekStart);
    d.setDate(d.getDate() + 7);
    vbvMonitorState.weekStart = d;
    vbvMonitorLoad();
  });
}
