/**
 * Milestone Render Module - DOM rendering for both views
 */

import {
  getMilestones,
  calculateMilestoneProgress,
  calculateMilestoneStatus,
  getMilestoneDependencies
} from '../../../shared/js/unified-data.js';

// SVG icon for milestone diamond
const DIAMOND_SVG = `<svg viewBox="0 0 24 24" fill="currentColor">
  <polygon points="12 2 22 12 12 22 2 12"/>
</svg>`;

/**
 * Main render function for the Milestone Tracker
 * @param {Object} projectData - Full project data
 * @param {boolean} editMode - Whether edit mode is active
 * @param {string} currentView - 'timeline' or 'list'
 * @param {string|null} selectedMilestoneId - Currently selected milestone
 * @param {string} searchQuery - Search filter string
 * @param {string|null} statusFilter - Status filter
 * @param {Object} handlers - Event handlers
 */
export function render(projectData, editMode, currentView, selectedMilestoneId, searchQuery, statusFilter, handlers) {
  // Update header stats
  updateHeaderStats(projectData);

  // Update title
  document.getElementById('projectTitle').textContent = projectData.project.title;

  // Get filtered milestones
  let milestones = getMilestones(projectData.tasks);

  // Apply search filter
  if (searchQuery) {
    const query = searchQuery.toLowerCase();
    milestones = milestones.filter(m =>
      m.name.toLowerCase().includes(query) ||
      (m.milestoneNotes && m.milestoneNotes.toLowerCase().includes(query))
    );
  }

  // Apply status filter
  if (statusFilter) {
    milestones = milestones.filter(m => {
      const status = calculateMilestoneStatus(m, projectData.tasks, projectData.project);
      return status === statusFilter;
    });
  }

  // Sort milestones by deadline
  milestones.sort((a, b) => {
    const deadlineA = a.milestoneDeadline || '9999-12-31';
    const deadlineB = b.milestoneDeadline || '9999-12-31';
    return deadlineA.localeCompare(deadlineB);
  });

  // Render based on view
  if (currentView === 'timeline') {
    renderTimelineView(milestones, projectData, editMode, selectedMilestoneId, handlers);
  } else {
    renderListView(milestones, projectData, editMode, selectedMilestoneId, handlers);
  }
}

/**
 * Update header statistics
 * @param {Object} projectData - Project data
 */
function updateHeaderStats(projectData) {
  const milestones = getMilestones(projectData.tasks);

  document.getElementById('milestoneCount').textContent = milestones.length;

  // Count on-track milestones
  const onTrackCount = milestones.filter(m => {
    const status = calculateMilestoneStatus(m, projectData.tasks, projectData.project);
    return status === 'on-track' || status === 'complete';
  }).length;

  document.getElementById('onTrackCount').textContent = onTrackCount;
}

/**
 * Render the timeline view
 */
function renderTimelineView(milestones, projectData, editMode, selectedMilestoneId, handlers) {
  const timelineBody = document.getElementById('timelineBody');
  const timelineEmpty = document.getElementById('timelineEmpty');
  const timelineHeader = document.getElementById('timelineHeader');

  if (milestones.length === 0) {
    timelineBody.style.display = 'none';
    timelineHeader.style.display = 'none';
    timelineEmpty.style.display = '';
    return;
  }

  timelineBody.style.display = '';
  timelineHeader.style.display = '';
  timelineEmpty.style.display = 'none';

  // Render month headers
  renderTimelineHeader(timelineHeader, projectData);

  // Render milestone lanes
  timelineBody.innerHTML = milestones.map(milestone => {
    const progress = calculateMilestoneProgress(milestone, projectData.tasks);
    const status = calculateMilestoneStatus(milestone, projectData.tasks, projectData.project);
    const deps = getMilestoneDependencies(milestone, projectData.tasks);
    const isSelected = milestone.id === selectedMilestoneId;

    return renderMilestoneLane(milestone, progress, status, deps, isSelected, projectData);
  }).join('');

  // Add click handlers
  timelineBody.querySelectorAll('.milestone-lane').forEach(lane => {
    const milestoneId = lane.dataset.milestoneId;
    lane.addEventListener('click', () => handlers.onMilestoneClick(milestoneId));
    lane.addEventListener('dblclick', () => handlers.onMilestoneEdit(milestoneId));
  });
}

/**
 * Render timeline month headers
 */
function renderTimelineHeader(header, projectData) {
  const startDate = new Date(projectData.project.startDate);
  const endDate = new Date(projectData.project.endDate);
  const today = new Date();

  const months = [];
  const current = new Date(startDate);
  current.setDate(1);

  while (current <= endDate) {
    const monthName = current.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
    const isCurrent = today.getMonth() === current.getMonth() && today.getFullYear() === current.getFullYear();
    months.push({ name: monthName, isCurrent });
    current.setMonth(current.getMonth() + 1);
  }

  header.innerHTML = months.map(month =>
    `<div class="timeline-month ${month.isCurrent ? 'timeline-month--current' : ''}">${month.name}</div>`
  ).join('');
}

/**
 * Render a milestone lane in timeline view
 */
function renderMilestoneLane(milestone, progress, status, deps, isSelected, projectData) {
  const deadline = milestone.milestoneDeadline
    ? new Date(milestone.milestoneDeadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : 'No deadline';

  const statusLabel = formatStatus(status);
  const progressValue = milestone.milestoneProgressOverride ?? progress.percent;

  // Calculate segment widths
  const segments = calculateSegments(deps);

  // Calculate timeline positions
  const timelineData = calculateTimelinePosition(milestone, projectData);

  return `
    <div class="milestone-lane milestone-lane--${status} ${isSelected ? 'milestone-lane--selected' : ''}"
         data-milestone-id="${milestone.id}">
      <div class="milestone-lane__header">
        <div class="milestone-lane__diamond">${DIAMOND_SVG}</div>
        <div class="milestone-lane__info">
          <div class="milestone-lane__name">${escapeHtml(milestone.name)}</div>
          <div class="milestone-lane__meta">
            <span class="milestone-lane__deadline">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/>
                <line x1="8" y1="2" x2="8" y2="6"/>
                <line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
              ${deadline}
            </span>
            <span class="milestone-lane__status">
              <span class="milestone-lane__status-dot"></span>
              ${statusLabel}
            </span>
          </div>
        </div>
        <span class="milestone-lane__progress-value">${progressValue}%</span>
      </div>
      <div class="timeline-bar" style="--timeline-cell-width: 40px;">
        <div class="timeline-bar__track"></div>
        <div class="timeline-bar__progress" style="--progress-start: ${timelineData.startPercent}%; --progress-width: ${timelineData.widthPercent}%;">
          ${segments.map(seg => `<div class="timeline-bar__segment timeline-bar__segment--${seg.type}" style="flex: ${seg.count};"></div>`).join('')}
        </div>
        ${timelineData.deadlinePercent !== null ? `
        <div class="timeline-bar__deadline" style="--deadline-position: ${timelineData.deadlinePercent}%;">
          ${DIAMOND_SVG}
        </div>
        ` : ''}
        ${timelineData.todayPercent !== null ? `
        <div class="timeline-bar__today" style="--today-position: ${timelineData.todayPercent}%;"></div>
        ` : ''}
      </div>
    </div>
  `;
}

/**
 * Calculate timeline bar positions as percentages
 */
function calculateTimelinePosition(milestone, projectData) {
  const projectStart = new Date(projectData.project.startDate);
  const projectEnd = new Date(projectData.project.endDate);
  const totalDays = (projectEnd - projectStart) / (1000 * 60 * 60 * 24);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Calculate today position
  let todayPercent = null;
  if (today >= projectStart && today <= projectEnd) {
    const todayDays = (today - projectStart) / (1000 * 60 * 60 * 24);
    todayPercent = (todayDays / totalDays) * 100;
  }

  // Calculate deadline position
  let deadlinePercent = null;
  if (milestone.milestoneDeadline) {
    const deadline = new Date(milestone.milestoneDeadline);
    const deadlineDays = (deadline - projectStart) / (1000 * 60 * 60 * 24);
    deadlinePercent = Math.max(0, Math.min(100, (deadlineDays / totalDays) * 100));
  }

  // Progress bar spans from project start to deadline (or end)
  const startPercent = 0;
  const widthPercent = deadlinePercent !== null ? deadlinePercent : 100;

  return { startPercent, widthPercent, deadlinePercent, todayPercent };
}

/**
 * Calculate segments for progress bar
 */
function calculateSegments(deps) {
  const segments = [];
  let done = 0, inProgress = 0, todo = 0, backlog = 0;

  deps.forEach(task => {
    const columnId = task.board?.columnId || 'backlog';
    if (columnId === 'done') done++;
    else if (columnId === 'in-progress') inProgress++;
    else if (columnId === 'todo') todo++;
    else backlog++;
  });

  if (done > 0) segments.push({ type: 'done', count: done });
  if (inProgress > 0) segments.push({ type: 'in-progress', count: inProgress });
  if (todo > 0) segments.push({ type: 'todo', count: todo });
  if (backlog > 0) segments.push({ type: 'backlog', count: backlog });

  // Default segment if no dependencies
  if (segments.length === 0) {
    segments.push({ type: 'backlog', count: 1 });
  }

  return segments;
}

/**
 * Render the list view (two-panel)
 */
function renderListView(milestones, projectData, editMode, selectedMilestoneId, handlers) {
  renderMilestoneList(milestones, projectData, selectedMilestoneId, handlers);
  renderMilestoneStats(milestones, projectData);

  if (selectedMilestoneId) {
    const milestone = milestones.find(m => m.id === selectedMilestoneId);
    if (milestone) {
      renderDetailPanel(milestone, projectData, editMode, handlers);
    } else {
      renderEmptyDetail();
    }
  } else {
    renderEmptyDetail();
  }
}

/**
 * Render the milestone list (sidebar)
 */
function renderMilestoneList(milestones, projectData, selectedMilestoneId, handlers) {
  const list = document.getElementById('milestoneList');

  if (milestones.length === 0) {
    list.innerHTML = `
      <div class="dependency-empty">
        <p>No milestones yet</p>
      </div>
    `;
    return;
  }

  list.innerHTML = milestones.map(milestone => {
    const progress = calculateMilestoneProgress(milestone, projectData.tasks);
    const status = calculateMilestoneStatus(milestone, projectData.tasks, projectData.project);
    const isSelected = milestone.id === selectedMilestoneId;
    const progressValue = milestone.milestoneProgressOverride ?? progress.percent;

    const deadline = milestone.milestoneDeadline
      ? new Date(milestone.milestoneDeadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      : 'No deadline';

    return `
      <div class="milestone-item milestone-item--${status} ${isSelected ? 'milestone-item--selected' : ''}"
           data-milestone-id="${milestone.id}">
        <div class="milestone-item__diamond">${DIAMOND_SVG}</div>
        <div class="milestone-item__content">
          <div class="milestone-item__name">${escapeHtml(milestone.name)}</div>
          <div class="milestone-item__deadline">${deadline}</div>
        </div>
        <div class="milestone-item__progress">${progressValue}%</div>
      </div>
    `;
  }).join('');

  // Add click handlers
  list.querySelectorAll('.milestone-item').forEach(item => {
    const milestoneId = item.dataset.milestoneId;
    item.addEventListener('click', () => handlers.onMilestoneClick(milestoneId));
    item.addEventListener('dblclick', () => handlers.onMilestoneEdit(milestoneId));
  });
}

/**
 * Render milestone stats
 */
function renderMilestoneStats(milestones, projectData) {
  const stats = document.getElementById('milestoneStats');

  const statusCounts = {
    complete: 0,
    'on-track': 0,
    'at-risk': 0,
    delayed: 0,
    'not-started': 0
  };

  milestones.forEach(m => {
    const status = calculateMilestoneStatus(m, projectData.tasks, projectData.project);
    if (statusCounts[status] !== undefined) {
      statusCounts[status]++;
    }
  });

  stats.innerHTML = `
    <div class="milestone-stats__grid">
      <div class="milestone-stats__item">
        <span class="milestone-stats__dot milestone-stats__dot--complete"></span>
        <span class="milestone-stats__count">${statusCounts.complete}</span>
        <span class="milestone-stats__label">Complete</span>
      </div>
      <div class="milestone-stats__item">
        <span class="milestone-stats__dot milestone-stats__dot--on-track"></span>
        <span class="milestone-stats__count">${statusCounts['on-track']}</span>
        <span class="milestone-stats__label">On Track</span>
      </div>
      <div class="milestone-stats__item">
        <span class="milestone-stats__dot milestone-stats__dot--at-risk"></span>
        <span class="milestone-stats__count">${statusCounts['at-risk']}</span>
        <span class="milestone-stats__label">At Risk</span>
      </div>
      <div class="milestone-stats__item">
        <span class="milestone-stats__dot milestone-stats__dot--delayed"></span>
        <span class="milestone-stats__count">${statusCounts.delayed}</span>
        <span class="milestone-stats__label">Delayed</span>
      </div>
    </div>
  `;
}

/**
 * Render empty detail panel
 */
function renderEmptyDetail() {
  document.getElementById('detailEmpty').style.display = '';
  document.getElementById('detailContent').style.display = 'none';
}

/**
 * Render the detail panel for a milestone
 */
function renderDetailPanel(milestone, projectData, editMode, handlers) {
  document.getElementById('detailEmpty').style.display = 'none';
  const content = document.getElementById('detailContent');
  content.style.display = '';

  const progress = calculateMilestoneProgress(milestone, projectData.tasks);
  const status = calculateMilestoneStatus(milestone, projectData.tasks, projectData.project);
  const deps = getMilestoneDependencies(milestone, projectData.tasks);

  const statusLabel = formatStatus(status);
  const progressValue = milestone.milestoneProgressOverride ?? progress.percent;
  const hasProgressOverride = milestone.milestoneProgressOverride !== null && milestone.milestoneProgressOverride !== undefined;
  const hasStatusOverride = milestone.milestoneStatusOverride !== null && milestone.milestoneStatusOverride !== undefined;

  // Format deadline
  let deadlineHtml = '';
  if (milestone.milestoneDeadline) {
    const deadline = new Date(milestone.milestoneDeadline);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const daysUntil = Math.ceil((deadline - today) / (1000 * 60 * 60 * 24));

    let relativeClass = '';
    let relativeText = '';
    if (daysUntil < 0) {
      relativeClass = 'detail-deadline__relative--past';
      relativeText = `${Math.abs(daysUntil)} days overdue`;
    } else if (daysUntil === 0) {
      relativeClass = 'detail-deadline__relative--soon';
      relativeText = 'Due today';
    } else if (daysUntil <= 7) {
      relativeClass = 'detail-deadline__relative--soon';
      relativeText = `${daysUntil} days remaining`;
    } else {
      relativeText = `${daysUntil} days remaining`;
    }

    deadlineHtml = `
      <div class="detail-deadline">
        <div class="detail-deadline__icon">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
            <line x1="16" y1="2" x2="16" y2="6"/>
            <line x1="8" y1="2" x2="8" y2="6"/>
            <line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
        </div>
        <div class="detail-deadline__content">
          <div class="detail-deadline__date">${deadline.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
          <div class="detail-deadline__relative ${relativeClass}">${relativeText}</div>
        </div>
      </div>
    `;
  } else {
    deadlineHtml = `
      <div class="detail-deadline">
        <div class="detail-deadline__icon">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
            <line x1="16" y1="2" x2="16" y2="6"/>
            <line x1="8" y1="2" x2="8" y2="6"/>
            <line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
        </div>
        <div class="detail-deadline__content">
          <div class="detail-deadline__date">No deadline set</div>
        </div>
      </div>
    `;
  }

  // Calculate segment widths
  const segments = calculateSegments(deps);

  // Dependency chips
  let dependencyHtml = '';
  if (deps.length === 0) {
    dependencyHtml = '<div class="dependency-empty">No dependencies assigned</div>';
  } else {
    const maxChips = 6;
    const visibleDeps = deps.slice(0, maxChips);
    const remainingCount = deps.length - maxChips;

    dependencyHtml = `
      <div class="dependency-grid">
        ${visibleDeps.map(task => {
          const columnId = task.board?.columnId || 'backlog';
          return `
            <span class="dependency-chip">
              <span class="dependency-chip__status dependency-chip__status--${columnId}"></span>
              ${escapeHtml(task.name)}
            </span>
          `;
        }).join('')}
        ${remainingCount > 0 ? `<span class="dependency-chip dependency-chip--more">+${remainingCount} more</span>` : ''}
      </div>
    `;
  }

  content.innerHTML = `
    <div class="detail-header">
      <div class="detail-header__top">
        <h2 class="detail-header__title">${escapeHtml(milestone.name)}</h2>
        <div class="detail-header__actions">
          ${editMode ? `
          <button class="btn btn--sm" onclick="openEditMilestone && openEditMilestone('${milestone.id}')">Edit</button>
          ` : ''}
        </div>
      </div>
      <div class="detail-status detail-status--${status}">
        <span class="detail-status__dot"></span>
        ${statusLabel}
        ${hasStatusOverride ? '<span class="override-indicator">Override</span>' : ''}
      </div>
    </div>

    <div class="detail-section">
      <h3 class="detail-section__title">Deadline</h3>
      ${deadlineHtml}
    </div>

    <div class="detail-section">
      <h3 class="detail-section__title">Progress</h3>
      <div class="detail-progress">
        <div class="detail-progress__header">
          <span class="detail-progress__value">${progressValue}%</span>
          <span class="detail-progress__label">
            ${progress.completed} of ${progress.total} tasks
            ${hasProgressOverride ? '<span class="detail-progress__override">Override</span>' : ''}
          </span>
        </div>
        <div class="segmented-progress">
          ${segments.map(seg => `<div class="segmented-progress__segment segmented-progress__segment--${seg.type}" style="flex: ${seg.count};"></div>`).join('')}
        </div>
        <div class="detail-progress__legend">
          <span class="detail-progress__legend-item">
            <span class="detail-progress__legend-dot detail-progress__legend-dot--done"></span>
            Done
          </span>
          <span class="detail-progress__legend-item">
            <span class="detail-progress__legend-dot detail-progress__legend-dot--in-progress"></span>
            In Progress
          </span>
          <span class="detail-progress__legend-item">
            <span class="detail-progress__legend-dot detail-progress__legend-dot--todo"></span>
            To Do
          </span>
        </div>
      </div>
    </div>

    <div class="detail-section">
      <h3 class="detail-section__title">Dependencies (${deps.length})</h3>
      ${dependencyHtml}
    </div>

    ${milestone.milestoneNotes ? `
    <div class="detail-section">
      <h3 class="detail-section__title">Notes</h3>
      <div class="detail-notes">${escapeHtml(milestone.milestoneNotes)}</div>
    </div>
    ` : ''}
  `;

  // Re-bind edit button
  const editBtn = content.querySelector('.detail-header__actions .btn');
  if (editBtn) {
    editBtn.onclick = () => handlers.onMilestoneEdit(milestone.id);
  }
}

/**
 * Format status for display
 */
function formatStatus(status) {
  const labels = {
    'complete': 'Complete',
    'on-track': 'On Track',
    'at-risk': 'At Risk',
    'delayed': 'Delayed',
    'not-started': 'Not Started'
  };
  return labels[status] || status;
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text || '';
  return div.innerHTML;
}
