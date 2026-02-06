/**
 * Burndown Render Module - DOM rendering functions
 * Handles sprint selector, sidebar, and sprint details rendering
 */

import {
  calculateVelocity,
  getBurndownData
} from '../../../shared/js/unified-data.js';

/**
 * Render the sprint selector buttons
 * @param {Array} sprints - All sprints
 * @param {string} selectedSprintId - Currently selected sprint ID
 * @param {Function} onSelect - Callback when sprint is selected
 */
export function renderSprintSelector(sprints, selectedSprintId, onSelect) {
  const container = document.getElementById('sprintSelector');
  if (!container) return;

  if (sprints.length === 0) {
    container.innerHTML = '<span class="sprint-selector__empty">No sprints available</span>';
    return;
  }

  // Sort sprints: active first, then planning, then completed (newest first)
  const sortedSprints = [...sprints].sort((a, b) => {
    const statusOrder = { active: 0, planning: 1, completed: 2 };
    const statusDiff = statusOrder[a.status] - statusOrder[b.status];
    if (statusDiff !== 0) return statusDiff;
    // Within same status, sort by start date (newest first for completed)
    return a.status === 'completed'
      ? (b.startDate || '').localeCompare(a.startDate || '')
      : (a.startDate || '').localeCompare(b.startDate || '');
  });

  container.innerHTML = sortedSprints.map(sprint => {
    const isActive = sprint.id === selectedSprintId;
    const activeClass = isActive ? ' sprint-btn--active' : '';
    const statusClass = `sprint-btn__status--${sprint.status}`;

    return `
      <button class="sprint-btn${activeClass}" data-sprint-id="${sprint.id}">
        ${escapeHtml(sprint.name)}
        <span class="sprint-btn__status ${statusClass}"></span>
      </button>
    `;
  }).join('');

  // Add click handlers
  container.querySelectorAll('.sprint-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const sprintId = btn.dataset.sprintId;
      onSelect(sprintId);
    });
  });
}

/**
 * Render sprint details in sidebar
 * @param {Object|null} sprint - Selected sprint
 * @param {Object} project - Project data
 * @param {Array} tasks - All tasks
 * @param {string} displayMode - 'points' or 'tasks'
 */
export function renderSprintDetails(sprint, project, tasks, displayMode) {
  if (!sprint) {
    document.getElementById('detailName').textContent = '-';
    document.getElementById('detailStatus').textContent = '-';
    document.getElementById('detailDuration').textContent = '-';
    document.getElementById('detailTotalPoints').textContent = '-';
    document.getElementById('detailTotalTasks').textContent = '-';
    document.getElementById('detailProgress').textContent = '-';
    return;
  }

  const burndownData = getBurndownData(sprint, project, tasks);

  // Name
  document.getElementById('detailName').textContent = sprint.name;

  // Status with styling
  const statusEl = document.getElementById('detailStatus');
  statusEl.textContent = capitalizeFirst(sprint.status);
  statusEl.className = 'sprint-detail__value';
  if (sprint.status === 'active') {
    statusEl.style.color = 'var(--status-success)';
  } else if (sprint.status === 'completed') {
    statusEl.style.color = 'var(--accent)';
  } else {
    statusEl.style.color = '';
  }

  // Duration
  const duration = `${burndownData.totalDays} days (${burndownData.startDate} to ${burndownData.endDate})`;
  document.getElementById('detailDuration').textContent = `${burndownData.totalDays} days`;

  // Total points
  document.getElementById('detailTotalPoints').textContent = `${burndownData.totalPoints} pts`;

  // Total tasks
  document.getElementById('detailTotalTasks').textContent = burndownData.totalTasks;

  // Progress
  const completed = displayMode === 'points'
    ? burndownData.totalPoints - burndownData.currentRemaining.points
    : burndownData.totalTasks - burndownData.currentRemaining.tasks;
  const total = displayMode === 'points' ? burndownData.totalPoints : burndownData.totalTasks;
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
  document.getElementById('detailProgress').textContent = `${percent}% (${completed}/${total})`;
}

/**
 * Render the sidebar with historical sprints
 * @param {Array} sprints - All sprints
 * @param {Array} tasks - All tasks
 * @param {string} selectedSprintId - Currently selected sprint
 */
export function renderSidebar(sprints, tasks, selectedSprintId) {
  const historyList = document.getElementById('historyList');
  const velocitySummary = document.getElementById('velocitySummary');

  // Get completed sprints
  const completedSprints = sprints.filter(s => s.status === 'completed');

  if (completedSprints.length === 0) {
    historyList.innerHTML = '<div class="history-empty">No completed sprints yet</div>';
  } else {
    historyList.innerHTML = completedSprints.map(sprint => {
      const sprintTasks = tasks.filter(t => t.sprintId === sprint.id);
      const completedTasks = sprintTasks.filter(t => t.board?.columnId === 'done');
      const completedPoints = completedTasks.reduce((sum, t) => sum + (t.storyPoints || 0), 0);
      const isSelected = sprint.id === selectedSprintId;
      const activeClass = isSelected ? ' history-item--active' : '';

      return `
        <div class="history-item${activeClass}">
          <span class="history-item__name">${escapeHtml(sprint.name)}</span>
          <span class="history-item__points">${completedPoints} pts</span>
        </div>
      `;
    }).join('');
  }

  // Calculate and display velocity
  const velocity = calculateVelocity(tasks, sprints);
  document.getElementById('avgVelocity').textContent = `${velocity.average} pts`;
}

/**
 * Render a full app state
 * @param {Object} projectData - Full project data
 * @param {boolean} editMode - Edit mode state
 * @param {string} selectedSprintId - Selected sprint ID
 * @param {string} displayMode - Display mode ('points' or 'tasks')
 */
export function render(projectData, editMode, selectedSprintId, displayMode) {
  // This is a convenience wrapper if we need full-app rendering
  // Individual functions are called from burndown-app.js
}

// ========== HELPER FUNCTIONS ==========

/**
 * Escape HTML to prevent XSS
 * @param {string} str - String to escape
 * @returns {string} - Escaped string
 */
function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/**
 * Capitalize first letter
 * @param {string} str - String to capitalize
 * @returns {string} - Capitalized string
 */
function capitalizeFirst(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}
