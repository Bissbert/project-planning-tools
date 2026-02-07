/**
 * Dashboard Render Module - Card rendering functions
 */

import {
  calculateProgress,
  calculateVelocity,
  getBurndownData,
  getMilestones,
  calculateMilestoneStatus,
  getColumnTasks,
  calculateTeamCapacity,
  getWeekStart,
  getWeekEnd,
  defaultWorkflow
} from '../../../shared/js/unified-data.js';

// Tool definitions for quick links
const TOOLS = [
  { id: 'gantt', number: '01', label: 'Gantt', path: 'gantt' },
  { id: 'kanban', number: '02', label: 'Kanban', path: 'kanban' },
  { id: 'sprint', number: '03', label: 'Sprint', path: 'sprint' },
  { id: 'time-tracker', number: '04', label: 'Time Tracker', path: 'time-tracker' },
  { id: 'burndown', number: '05', label: 'Burndown', path: 'burndown' },
  { id: 'resource-calendar', number: '06', label: 'Resources', path: 'resource-calendar' },
  { id: 'milestone-tracker', number: '07', label: 'Milestones', path: 'milestone-tracker' },
  { id: 'retrospective', number: '08', label: 'Retro Board', path: 'retrospective' },
  { id: 'pert', number: '09', label: 'PERT Chart', path: 'pert' }
];

/**
 * Render Project Health card
 */
export function renderProjectHealth(data, containerId) {
  const container = document.getElementById(containerId);
  if (!container || !data.project) return;

  const progress = calculateProgress(data.project);
  const startDate = new Date(data.project.startDate);
  const endDate = new Date(data.project.endDate);

  const formatDate = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  // Determine progress bar color based on time vs completion
  let progressClass = '';
  const tasksTotal = data.tasks?.length || 0;
  const tasksDone = (data.tasks || []).filter(t => t.board?.columnId === 'done').length;
  const taskProgress = tasksTotal > 0 ? (tasksDone / tasksTotal) * 100 : 0;

  if (progress.percent > 0 && taskProgress < progress.percent - 20) {
    progressClass = 'progress-bar__fill--warning';
  } else if (taskProgress >= progress.percent) {
    progressClass = 'progress-bar__fill--success';
  }

  container.innerHTML = `
    <div class="metric-primary">Week ${progress.currentWeek} of ${progress.totalWeeks}</div>
    <div class="metric-secondary">${progress.percent}% of timeline elapsed</div>
    <div class="progress-bar">
      <div class="progress-bar__fill ${progressClass}" style="width: ${progress.percent}%"></div>
    </div>
    <div class="date-range">
      <span>${formatDate(startDate)}</span>
      <span>${formatDate(endDate)}</span>
    </div>
  `;
}

/**
 * Render Sprint Status card
 */
export function renderSprintStatus(data, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  // Find active sprint
  const activeSprint = (data.sprints || []).find(s => s.status === 'active');

  if (!activeSprint) {
    container.innerHTML = `
      <div class="empty-state">
        <svg class="empty-state__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <path d="M12 6v6l4 2"/>
        </svg>
        <div class="empty-state__title">No Active Sprint</div>
        <div class="empty-state__text">Start a sprint in Sprint Planner</div>
        <a href="../sprint/index.html" class="empty-state__link">Go to Sprint Planner</a>
      </div>
    `;
    return;
  }

  const burndownData = getBurndownData(activeSprint, data.project, data.tasks || []);
  const startDate = new Date(burndownData.startDate);
  const endDate = new Date(burndownData.endDate);

  const formatDate = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  container.innerHTML = `
    <div class="sprint-info">
      <div class="sprint-name">${activeSprint.name}</div>
      <div class="sprint-dates">${formatDate(startDate)} - ${formatDate(endDate)}</div>
    </div>
    <div class="stat-list">
      <div class="stat-row">
        <span class="stat-row__label">Points Remaining</span>
        <span class="stat-row__value stat-row__value--accent">${burndownData.currentRemaining.points}</span>
      </div>
      <div class="stat-row">
        <span class="stat-row__label">Tasks Remaining</span>
        <span class="stat-row__value">${burndownData.currentRemaining.tasks}</span>
      </div>
      <div class="stat-row">
        <span class="stat-row__label">Days Left</span>
        <span class="stat-row__value">${burndownData.daysRemaining}</span>
      </div>
    </div>
  `;
}

/**
 * Render Task Distribution card
 */
export function renderTaskDistribution(data, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const tasks = data.tasks || [];
  const workflow = data.workflow || defaultWorkflow;

  if (tasks.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <svg class="empty-state__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="3" width="18" height="18" rx="2"/>
          <path d="M9 3v18M15 3v18"/>
        </svg>
        <div class="empty-state__title">No Tasks</div>
        <div class="empty-state__text">Create tasks in Gantt or Kanban</div>
        <a href="../kanban/index.html" class="empty-state__link">Go to Kanban</a>
      </div>
    `;
    return;
  }

  // Count tasks per column
  const counts = {};
  workflow.columns.forEach(col => {
    counts[col.id] = getColumnTasks(tasks, col.id).length;
  });

  const total = tasks.length;
  const maxCount = Math.max(...Object.values(counts), 1);

  const distributionHTML = workflow.columns.map(col => {
    const count = counts[col.id] || 0;
    const percent = (count / maxCount) * 100;
    const fillClass = `distribution-row__fill--${col.id}`;

    return `
      <div class="distribution-row">
        <span class="distribution-row__label">${col.name}</span>
        <div class="distribution-row__bar">
          <div class="distribution-row__fill ${fillClass}" style="width: ${percent}%; background: ${col.color}"></div>
        </div>
        <span class="distribution-row__count">${count}</span>
      </div>
    `;
  }).join('');

  container.innerHTML = `
    <div class="distribution-list">
      ${distributionHTML}
    </div>
    <div class="distribution-total">Total: ${total} tasks</div>
  `;
}

/**
 * Render Milestones card
 */
export function renderMilestones(data, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const milestones = getMilestones(data.tasks || []);

  if (milestones.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <svg class="empty-state__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/>
          <line x1="4" y1="22" x2="4" y2="15"/>
        </svg>
        <div class="empty-state__title">No Milestones</div>
        <div class="empty-state__text">Mark tasks as milestones</div>
        <a href="../milestone-tracker/index.html" class="empty-state__link">Go to Milestone Tracker</a>
      </div>
    `;
    return;
  }

  // Get next 3 upcoming milestones (not complete)
  const upcoming = milestones
    .filter(m => calculateMilestoneStatus(m, data.tasks, data.project) !== 'complete')
    .slice(0, 3);

  // Count by status
  const statusCounts = {
    'on-track': 0,
    'at-risk': 0,
    'delayed': 0,
    'complete': 0,
    'not-started': 0
  };

  milestones.forEach(m => {
    const status = calculateMilestoneStatus(m, data.tasks, data.project);
    statusCounts[status] = (statusCounts[status] || 0) + 1;
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const milestonesHTML = upcoming.map(m => {
    const status = calculateMilestoneStatus(m, data.tasks, data.project);
    let daysText = 'No deadline';

    if (m.milestoneDeadline) {
      const deadline = new Date(m.milestoneDeadline);
      const daysUntil = Math.ceil((deadline - today) / (1000 * 60 * 60 * 24));

      if (daysUntil < 0) {
        daysText = `${Math.abs(daysUntil)}d overdue`;
      } else if (daysUntil === 0) {
        daysText = 'Today';
      } else {
        daysText = `${daysUntil}d`;
      }
    }

    return `
      <div class="milestone-item">
        <div class="milestone-item__status milestone-item__status--${status}"></div>
        <div class="milestone-item__name">${m.name}</div>
        <div class="milestone-item__days">${daysText}</div>
      </div>
    `;
  }).join('');

  // Summary of status counts
  const summaryParts = [];
  if (statusCounts['at-risk'] > 0) summaryParts.push(`${statusCounts['at-risk']} at risk`);
  if (statusCounts['delayed'] > 0) summaryParts.push(`${statusCounts['delayed']} delayed`);
  if (statusCounts['complete'] > 0) summaryParts.push(`${statusCounts['complete']} complete`);

  container.innerHTML = `
    <div class="milestone-list">
      ${milestonesHTML || '<div class="empty-state__text">All milestones complete!</div>'}
    </div>
    ${summaryParts.length > 0 ? `<div class="milestone-summary">${summaryParts.join(', ')}</div>` : ''}
  `;
}

/**
 * Render Velocity card
 */
export function renderVelocity(data, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const velocityData = calculateVelocity(data.tasks || [], data.sprints || []);

  if (velocityData.sprints.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <svg class="empty-state__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M3 3v18h18"/>
          <path d="M18 17V9"/>
          <path d="M13 17V5"/>
          <path d="M8 17v-3"/>
        </svg>
        <div class="empty-state__title">No Velocity Data</div>
        <div class="empty-state__text">Complete sprints to track velocity</div>
        <a href="../sprint/index.html" class="empty-state__link">Go to Sprint Planner</a>
      </div>
    `;
    return;
  }

  // Get last 3 sprints
  const recentSprints = velocityData.sprints.slice(-3);

  const sprintsHTML = recentSprints.map(s => `
    <div class="velocity-sprint">
      <div class="velocity-sprint__value">${s.points}</div>
      <div class="velocity-sprint__label">${truncate(s.name, 10)}</div>
    </div>
  `).join('');

  container.innerHTML = `
    <div class="velocity-avg">
      <div class="metric-primary">${velocityData.average} pts/sprint</div>
      <div class="metric-label">Average Velocity</div>
    </div>
    <div class="velocity-history">
      ${sprintsHTML}
    </div>
  `;
}

/**
 * Render Team Capacity card
 */
export function renderTeamCapacity(data, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const team = data.team || [];

  if (team.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <svg class="empty-state__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
          <circle cx="9" cy="7" r="4"/>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
          <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
        </svg>
        <div class="empty-state__title">No Team Members</div>
        <div class="empty-state__text">Add team members to track capacity</div>
        <a href="../resource-calendar/index.html" class="empty-state__link">Go to Resource Calendar</a>
      </div>
    `;
    return;
  }

  // Calculate this week's capacity
  const today = new Date();
  const weekStart = getWeekStart(today);
  const weekEnd = getWeekEnd(today);

  const calendarSettings = data.calendarSettings || { workDays: [1, 2, 3, 4, 5], hoursPerDay: 8 };

  const capacity = calculateTeamCapacity(
    team,
    weekStart.toISOString().split('T')[0],
    weekEnd.toISOString().split('T')[0],
    calendarSettings
  );

  // Calculate max possible hours
  const workDays = calendarSettings.workDays || [1, 2, 3, 4, 5];
  const hoursPerDay = calendarSettings.hoursPerDay || 8;

  let workDaysInWeek = 0;
  for (let d = new Date(weekStart); d <= weekEnd; d.setDate(d.getDate() + 1)) {
    if (workDays.includes(d.getDay())) {
      workDaysInWeek++;
    }
  }

  const maxHours = team.length * workDaysInWeek * hoursPerDay;
  const capacityPercent = maxHours > 0 ? Math.round((capacity.totalHours / maxHours) * 100) : 100;

  container.innerHTML = `
    <div class="capacity-summary">
      <div class="capacity-stat">
        <div class="capacity-stat__value">${capacityPercent}%</div>
        <div class="capacity-stat__label">This Week</div>
      </div>
      <div class="capacity-stat">
        <div class="capacity-stat__value">${team.length}</div>
        <div class="capacity-stat__label">Team Members</div>
      </div>
    </div>
    <div class="progress-bar" style="margin-top: var(--spacing-lg)">
      <div class="progress-bar__fill ${capacityPercent < 70 ? 'progress-bar__fill--warning' : ''}" style="width: ${capacityPercent}%"></div>
    </div>
    <div class="date-range">
      <span>${capacity.totalHours} hrs available</span>
      <span>${maxHours} hrs max</span>
    </div>
  `;
}

/**
 * Render Quick Links card
 */
export function renderQuickLinks(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const linksHTML = TOOLS.map(tool => `
    <a href="../${tool.path}/index.html" class="quick-link">
      <span class="quick-link__number">${tool.number}</span>
      <span class="quick-link__label">${tool.label}</span>
    </a>
  `).join('');

  container.innerHTML = `
    <div class="quick-links">
      ${linksHTML}
    </div>
  `;
}

/**
 * Truncate string with ellipsis
 */
function truncate(str, maxLength) {
  if (!str) return '';
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength - 1) + '...';
}
