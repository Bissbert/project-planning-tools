/**
 * Sprint Render Module - DOM rendering for backlog, sprints, tasks
 */

import {
  getProductBacklog,
  getSprintTasks,
  calculateSprintPoints,
  calculateVelocity
} from '../../../shared/js/unified-data.js';

/**
 * Main render function for the Sprint Planner
 * @param {Object} projectData - Full project data
 * @param {boolean} editMode - Whether edit mode is active
 * @param {string|null} activeSprintId - Currently selected sprint
 * @param {string} searchQuery - Search filter string
 * @param {Object} handlers - Event handlers
 */
export function render(projectData, editMode, activeSprintId, searchQuery, handlers) {
  // Update header stats
  updateHeaderStats(projectData);

  // Render backlog
  renderBacklog(projectData, editMode, searchQuery, handlers);

  // Render sprint tabs
  renderSprintTabs(projectData, editMode, activeSprintId, handlers);

  // Render sprint board
  renderSprintBoard(projectData, editMode, activeSprintId, searchQuery, handlers);

  // Update title
  document.getElementById('projectTitle').textContent = projectData.project.title;
}

/**
 * Update header statistics
 * @param {Object} projectData - Project data
 */
function updateHeaderStats(projectData) {
  const tasks = projectData.tasks || [];
  const sprints = projectData.sprints || [];

  // Calculate total points (all estimated tasks)
  const pointsData = calculateSprintPoints(tasks);
  document.getElementById('totalPoints').textContent = pointsData.total;

  // Calculate velocity from completed sprints
  const velocityData = calculateVelocity(tasks, sprints);
  document.getElementById('velocity').textContent = velocityData.average;

  // Sprint count (non-completed)
  const activeSprints = sprints.filter(s => s.status !== 'completed').length;
  document.getElementById('sprintCount').textContent = activeSprints;
}

/**
 * Render the product backlog
 * @param {Object} projectData - Project data
 * @param {boolean} editMode - Edit mode flag
 * @param {string} searchQuery - Search filter
 * @param {Object} handlers - Event handlers
 */
function renderBacklog(projectData, editMode, searchQuery, handlers) {
  const backlogList = document.getElementById('backlogList');
  backlogList.innerHTML = '';

  let backlogTasks = getProductBacklog(projectData.tasks);

  // Apply search filter
  if (searchQuery) {
    const query = searchQuery.toLowerCase();
    backlogTasks = backlogTasks.filter(t =>
      t.name.toLowerCase().includes(query) ||
      t.category.toLowerCase().includes(query) ||
      (t.assignee && t.assignee.toLowerCase().includes(query))
    );
  }

  // Update backlog stats
  const pointsData = calculateSprintPoints(backlogTasks);
  document.getElementById('backlogCount').textContent = backlogTasks.length;
  document.getElementById('backlogPoints').textContent = pointsData.total;

  if (backlogTasks.length === 0) {
    backlogList.innerHTML = `
      <div class="backlog-empty">
        <svg class="backlog-empty__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
          <line x1="12" y1="8" x2="12" y2="16"/>
          <line x1="8" y1="12" x2="16" y2="12"/>
        </svg>
        <span class="backlog-empty__text">${searchQuery ? 'No matching tasks' : 'No items in backlog'}</span>
      </div>
    `;
    return;
  }

  backlogTasks.forEach(task => {
    backlogList.appendChild(renderBacklogItem(task, projectData.categories, editMode, handlers));
  });
}

/**
 * Render a single backlog item
 * @param {Object} task - Task data
 * @param {Object} categories - Category colors
 * @param {boolean} editMode - Edit mode flag
 * @param {Object} handlers - Event handlers
 * @returns {HTMLElement} - Backlog item element
 */
function renderBacklogItem(task, categories, editMode, handlers) {
  const item = document.createElement('div');
  item.className = 'backlog-item';
  item.dataset.taskId = task.id;

  if (editMode) {
    item.draggable = true;
  }

  // Priority class
  if (task.priority) {
    item.classList.add(`backlog-item--priority-${task.priority}`);
  }

  // Story points badge class
  const pointsClass = getPointsBadgeClass(task.storyPoints);
  const pointsDisplay = task.storyPoints !== null && task.storyPoints !== undefined
    ? task.storyPoints
    : '?';

  item.innerHTML = `
    <span class="backlog-item__drag">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="8" y1="6" x2="16" y2="6"/>
        <line x1="8" y1="12" x2="16" y2="12"/>
        <line x1="8" y1="18" x2="16" y2="18"/>
      </svg>
    </span>
    <div class="backlog-item__content">
      <div class="backlog-item__name">${escapeHtml(task.name)}</div>
      <div class="backlog-item__meta">
        <span class="backlog-item__category">${escapeHtml(task.category)}</span>
        ${task.assignee ? `<span class="backlog-item__assignee">${escapeHtml(task.assignee)}</span>` : ''}
      </div>
    </div>
    <span class="points-badge ${pointsClass}">${pointsDisplay}</span>
    <div class="task-actions">
      <button class="task-action" title="Edit" data-action="edit">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
        </svg>
      </button>
      <button class="task-action task-action--delete" title="Delete" data-action="delete">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="3 6 5 6 21 6"/>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
        </svg>
      </button>
    </div>
  `;

  // Event listeners
  item.addEventListener('click', (e) => {
    const action = e.target.closest('[data-action]');
    if (action) {
      e.stopPropagation();
      if (action.dataset.action === 'delete') {
        handlers.onDeleteTask(task.id);
      } else {
        handlers.onTaskClick(task.id);
      }
    } else {
      handlers.onTaskClick(task.id);
    }
  });

  // Drag events
  item.addEventListener('dragstart', (e) => handlers.onDragStart(e, task.id, 'backlog'));
  item.addEventListener('dragend', (e) => handlers.onDragEnd(e));

  return item;
}

/**
 * Render sprint tabs
 * @param {Object} projectData - Project data
 * @param {boolean} editMode - Edit mode flag
 * @param {string|null} activeSprintId - Active sprint ID
 * @param {Object} handlers - Event handlers
 */
function renderSprintTabs(projectData, editMode, activeSprintId, handlers) {
  const tabsContainer = document.getElementById('sprintTabs');

  // Keep the add button
  const addButton = tabsContainer.querySelector('.sprint-tab--add');

  // Clear existing tabs (except add button)
  tabsContainer.querySelectorAll('.sprint-tab:not(.sprint-tab--add)').forEach(tab => tab.remove());

  // Sort sprints by startWeek
  const sortedSprints = [...(projectData.sprints || [])].sort((a, b) =>
    (a.startWeek || 0) - (b.startWeek || 0)
  );

  sortedSprints.forEach(sprint => {
    const tab = document.createElement('button');
    tab.className = 'sprint-tab';
    if (sprint.id === activeSprintId) {
      tab.classList.add('sprint-tab--active');
    }

    const statusClass = `sprint-tab__status--${sprint.status}`;

    tab.innerHTML = `
      ${escapeHtml(sprint.name)}
      <span class="sprint-tab__status ${statusClass}"></span>
      <span class="sprint-tab__edit">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
        </svg>
      </span>
    `;

    tab.addEventListener('click', (e) => {
      if (e.target.closest('.sprint-tab__edit')) {
        e.stopPropagation();
        handlers.onSprintEdit(sprint.id);
      } else {
        handlers.onSprintTabClick(sprint.id);
      }
    });

    tabsContainer.insertBefore(tab, addButton);
  });
}

/**
 * Render the sprint board
 * @param {Object} projectData - Project data
 * @param {boolean} editMode - Edit mode flag
 * @param {string|null} activeSprintId - Active sprint ID
 * @param {string} searchQuery - Search filter
 * @param {Object} handlers - Event handlers
 */
function renderSprintBoard(projectData, editMode, activeSprintId, searchQuery, handlers) {
  const board = document.getElementById('sprintBoard');
  board.innerHTML = '';

  if (!activeSprintId) {
    board.innerHTML = `
      <div class="empty-state">
        <svg class="empty-state__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
          <line x1="16" y1="2" x2="16" y2="6"/>
          <line x1="8" y1="2" x2="8" y2="6"/>
          <line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
        <h3 class="empty-state__title">No Sprint Selected</h3>
        <p class="empty-state__text">
          ${projectData.sprints.length === 0
            ? 'Create your first sprint to start planning.'
            : 'Select a sprint from the tabs above.'}
        </p>
      </div>
    `;
    return;
  }

  const sprint = projectData.sprints.find(s => s.id === activeSprintId);
  if (!sprint) return;

  // Sprint info header
  const sprintInfo = renderSprintInfo(sprint, projectData, handlers);
  board.appendChild(sprintInfo);

  // Sprint tasks
  let sprintTasks = getSprintTasks(projectData.tasks, activeSprintId);

  // Apply search filter
  if (searchQuery) {
    const query = searchQuery.toLowerCase();
    sprintTasks = sprintTasks.filter(t =>
      t.name.toLowerCase().includes(query) ||
      t.category.toLowerCase().includes(query) ||
      (t.assignee && t.assignee.toLowerCase().includes(query))
    );
  }

  const tasksContainer = document.createElement('div');
  tasksContainer.className = 'sprint-tasks';
  tasksContainer.dataset.sprintId = activeSprintId;

  const header = document.createElement('div');
  header.className = 'sprint-tasks__header';
  header.innerHTML = `
    <span class="sprint-tasks__title">Sprint Items (${sprintTasks.length})</span>
  `;
  tasksContainer.appendChild(header);

  if (sprintTasks.length === 0) {
    tasksContainer.innerHTML += `
      <div class="backlog-empty" style="min-height: 100px;">
        <svg class="backlog-empty__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="7 10 12 15 17 10"/>
          <line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
        <span class="backlog-empty__text">Drag tasks from the backlog</span>
      </div>
    `;
  } else {
    sprintTasks.forEach(task => {
      tasksContainer.appendChild(renderSprintTask(task, projectData, editMode, handlers));
    });
  }

  // Drag events for sprint tasks area
  tasksContainer.addEventListener('dragover', (e) => handlers.onDragOverSprint(e, activeSprintId));
  tasksContainer.addEventListener('dragleave', (e) => handlers.onDragLeaveSprint(e, activeSprintId));
  tasksContainer.addEventListener('drop', (e) => handlers.onDropSprint(e, activeSprintId));

  board.appendChild(tasksContainer);

  // Capacity bar
  const capacityBar = renderCapacityBar(sprintTasks, projectData);
  board.appendChild(capacityBar);
}

/**
 * Render sprint info header
 * @param {Object} sprint - Sprint data
 * @param {Object} projectData - Project data
 * @param {Object} handlers - Event handlers
 * @returns {HTMLElement} - Sprint info element
 */
function renderSprintInfo(sprint, projectData, handlers) {
  const info = document.createElement('div');
  info.className = 'sprint-info';

  const statusClass = `sprint-info__status--${sprint.status}`;
  const statusText = sprint.status.charAt(0).toUpperCase() + sprint.status.slice(1);

  info.innerHTML = `
    <div class="sprint-info__header">
      <h2 class="sprint-info__title">${escapeHtml(sprint.name)}</h2>
      <div style="display: flex; gap: 8px; align-items: center;">
        <span class="sprint-info__status ${statusClass}">${statusText}</span>
        <button class="sprint-info__edit" onclick="openSprintEdit && openSprintEdit('${sprint.id}')">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
          Edit
        </button>
      </div>
    </div>
    ${sprint.goal ? `<p class="sprint-info__goal">${escapeHtml(sprint.goal)}</p>` : ''}
    <div class="sprint-info__weeks">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: -2px; margin-right: 4px;">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
        <line x1="16" y1="2" x2="16" y2="6"/>
        <line x1="8" y1="2" x2="8" y2="6"/>
        <line x1="3" y1="10" x2="21" y2="10"/>
      </svg>
      Week ${sprint.startWeek || '?'} - Week ${sprint.endWeek || '?'}
    </div>
  `;

  // Make edit button work
  const editBtn = info.querySelector('.sprint-info__edit');
  if (editBtn) {
    editBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      handlers.onSprintEdit(sprint.id);
    });
  }

  return info;
}

/**
 * Render a sprint task card
 * @param {Object} task - Task data
 * @param {Object} projectData - Project data
 * @param {boolean} editMode - Edit mode flag
 * @param {Object} handlers - Event handlers
 * @returns {HTMLElement} - Sprint task element
 */
function renderSprintTask(task, projectData, editMode, handlers) {
  const card = document.createElement('div');
  card.className = 'sprint-task';
  card.dataset.taskId = task.id;

  if (editMode) {
    card.draggable = true;
  }

  // Priority class
  if (task.priority) {
    card.classList.add(`sprint-task--priority-${task.priority}`);
  }

  // Category color
  const categoryColor = projectData.categories[task.category] || '#7c7c8a';

  // Story points
  const pointsClass = getPointsBadgeClass(task.storyPoints);
  const pointsDisplay = task.storyPoints !== null && task.storyPoints !== undefined
    ? task.storyPoints
    : '?';

  // Kanban status
  const columnId = task.board?.columnId || 'backlog';
  const statusClass = `status-chip--${columnId}`;
  const column = projectData.workflow?.columns?.find(c => c.id === columnId);
  const statusText = column ? column.name : 'Unknown';

  // Assignee initials
  let assigneeHtml = '';
  if (task.assignee) {
    const initials = task.assignee.split(' ').map(n => n[0]).join('').slice(0, 2);
    assigneeHtml = `
      <span class="sprint-task__assignee">
        <span class="sprint-task__avatar">${initials}</span>
        ${escapeHtml(task.assignee)}
      </span>
    `;
  }

  card.innerHTML = `
    <span class="sprint-task__drag">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="8" y1="6" x2="16" y2="6"/>
        <line x1="8" y1="12" x2="16" y2="12"/>
        <line x1="8" y1="18" x2="16" y2="18"/>
      </svg>
    </span>
    <div class="sprint-task__content">
      <div class="sprint-task__header">
        <span class="sprint-task__name">${escapeHtml(task.name)}</span>
        <span class="sprint-task__category" style="background: ${categoryColor}20;">
          <span class="sprint-task__category-dot" style="background: ${categoryColor};"></span>
          ${escapeHtml(task.category)}
        </span>
      </div>
      <div class="sprint-task__meta">
        ${assigneeHtml}
        <span class="status-chip ${statusClass}">${statusText}</span>
      </div>
    </div>
    <span class="points-badge ${pointsClass}">${pointsDisplay}</span>
    <button class="move-to-backlog" data-action="move-backlog">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="15 18 9 12 15 6"/>
      </svg>
      Backlog
    </button>
    <div class="task-actions">
      <button class="task-action" title="Edit" data-action="edit">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
        </svg>
      </button>
      <button class="task-action task-action--delete" title="Delete" data-action="delete">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="3 6 5 6 21 6"/>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
        </svg>
      </button>
    </div>
  `;

  // Event listeners
  card.addEventListener('click', (e) => {
    const action = e.target.closest('[data-action]');
    if (action) {
      e.stopPropagation();
      if (action.dataset.action === 'delete') {
        handlers.onDeleteTask(task.id);
      } else if (action.dataset.action === 'move-backlog') {
        handlers.onMoveToBacklog(task.id);
      } else {
        handlers.onTaskClick(task.id);
      }
    } else {
      handlers.onTaskClick(task.id);
    }
  });

  // Drag events
  card.addEventListener('dragstart', (e) => handlers.onDragStart(e, task.id, 'sprint'));
  card.addEventListener('dragend', (e) => handlers.onDragEnd(e));

  return card;
}

/**
 * Render capacity bar
 * @param {Array} sprintTasks - Tasks in current sprint
 * @param {Object} projectData - Project data
 * @returns {HTMLElement} - Capacity bar element
 */
function renderCapacityBar(sprintTasks, projectData) {
  const bar = document.createElement('div');
  bar.className = 'capacity-bar';

  // Calculate committed points
  const pointsData = calculateSprintPoints(sprintTasks);
  const committed = pointsData.total;

  // Calculate velocity
  const velocityData = calculateVelocity(projectData.tasks, projectData.sprints);
  const velocity = velocityData.average || 20; // Default to 20 if no historical data

  // Calculate percentage
  const percent = velocity > 0 ? Math.round((committed / velocity) * 100) : 0;

  // Determine fill class
  let fillClass = '';
  if (percent > 120) {
    fillClass = 'capacity-bar__fill--danger';
  } else if (percent > 100) {
    fillClass = 'capacity-bar__fill--warning';
  }

  // Marker position (velocity indicator)
  const markerPosition = velocity > 0 ? Math.min((velocity / Math.max(committed, velocity)) * 100, 100) : 100;

  bar.innerHTML = `
    <div class="capacity-bar__header">
      <span class="capacity-bar__label">Sprint Capacity</span>
      <span class="capacity-bar__values">
        <span class="capacity-bar__committed">${committed} pts</span>
        ${velocityData.average > 0 ? ` / <span class="capacity-bar__velocity">${velocity} avg</span>` : ''}
      </span>
    </div>
    <div class="capacity-bar__track">
      <div class="capacity-bar__fill ${fillClass}" style="width: ${Math.min(percent, 150)}%;"></div>
      ${velocityData.average > 0 ? `<div class="capacity-bar__marker" style="left: ${markerPosition}%;"></div>` : ''}
    </div>
  `;

  return bar;
}

/**
 * Get CSS class for points badge based on value
 * @param {number|null} points - Story points
 * @returns {string} - CSS class
 */
function getPointsBadgeClass(points) {
  if (points === null || points === undefined) {
    return 'points-badge--unestimated';
  }
  if (points <= 3) {
    return 'points-badge--small';
  }
  if (points <= 8) {
    return 'points-badge--medium';
  }
  return 'points-badge--large';
}

/**
 * Escape HTML to prevent XSS
 * @param {string} text - Text to escape
 * @returns {string} - Escaped text
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
