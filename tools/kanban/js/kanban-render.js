/**
 * Kanban Render Module - DOM rendering for board, columns, cards
 */

import { getColumnTasks, deriveStatus, getCurrentWeek } from '../../../shared/js/unified-data.js';

/**
 * Render a single card
 * @param {Object} task - Task data
 * @param {Object} categories - Category colors
 * @param {boolean} editMode - Whether edit mode is active
 * @param {Object} handlers - Event handlers
 * @returns {HTMLElement} - Card element
 */
export function renderCard(task, categories, editMode, handlers) {
  const card = document.createElement('div');
  card.className = 'kanban-card';
  card.dataset.taskId = task.id;

  // Only allow dragging in edit mode
  if (editMode) {
    card.draggable = true;
  }

  // Priority class
  if (task.priority) {
    card.classList.add(`kanban-card--priority-${task.priority}`);
  }

  // Milestone class
  if (task.isMilestone) {
    card.classList.add('kanban-card--milestone');
  }

  // Category color
  const categoryColor = categories[task.category] || '#7c7c8a';

  // Calculate progress
  const planned = task.planned || [];
  const reality = task.reality || [];
  const progressPercent = planned.length > 0
    ? Math.round((reality.length / planned.length) * 100)
    : 0;

  // Build card HTML
  let html = `
    <div class="kanban-card__header">
      <span class="kanban-card__title">${escapeHtml(task.name)}</span>
      <span class="kanban-card__category" style="background: ${categoryColor}20;">
        <span class="kanban-card__category-dot" style="background: ${categoryColor};"></span>
        ${escapeHtml(task.category)}
      </span>
    </div>
  `;

  // Meta row
  const hasMeta = task.assignee || planned.length > 0 || task.notes;
  if (hasMeta) {
    html += '<div class="kanban-card__meta">';

    // Assignee
    if (task.assignee) {
      const initials = task.assignee.split(' ').map(n => n[0]).join('').slice(0, 2);
      html += `
        <span class="kanban-card__assignee">
          <span class="kanban-card__avatar">${initials}</span>
          ${escapeHtml(task.assignee)}
        </span>
      `;
    }

    // Notes indicator
    if (task.notes) {
      html += `
        <svg class="kanban-card__notes-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14,2 14,8 20,8"/>
          <line x1="16" y1="13" x2="8" y2="13"/>
          <line x1="16" y1="17" x2="8" y2="17"/>
        </svg>
      `;
    }

    // Timeline
    if (planned.length > 0) {
      const startWeek = Math.min(...planned);
      const endWeek = Math.max(...planned);
      const weekText = startWeek === endWeek ? `W${startWeek}` : `W${startWeek}-${endWeek}`;
      html += `
        <span class="kanban-card__timeline">
          <svg class="kanban-card__timeline-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
            <line x1="16" y1="2" x2="16" y2="6"/>
            <line x1="8" y1="2" x2="8" y2="6"/>
            <line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          ${weekText}
        </span>
      `;
    }

    html += '</div>';
  }

  // Progress bar (show if there's progress to track)
  if (planned.length > 0) {
    const isComplete = progressPercent >= 100;
    const fillClass = isComplete ? 'kanban-card__progress-fill--complete' : '';
    html += `
      <div class="kanban-card__progress">
        <div class="kanban-card__progress-bar">
          <div class="kanban-card__progress-fill ${fillClass}" style="width: ${progressPercent}%;"></div>
        </div>
        <span class="kanban-card__progress-text">${reality.length}/${planned.length} weeks</span>
      </div>
    `;
  }

  // Action buttons (shown in edit mode on hover)
  html += `
    <div class="kanban-card__actions">
      <button class="kanban-card__action" title="Edit" data-action="edit">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
        </svg>
      </button>
      <button class="kanban-card__action kanban-card__action--delete" title="Delete" data-action="delete">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="3 6 5 6 21 6"/>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
        </svg>
      </button>
    </div>
  `;

  card.innerHTML = html;

  // Event listeners
  card.addEventListener('click', (e) => {
    const action = e.target.closest('[data-action]');
    if (action) {
      e.stopPropagation();
      const actionType = action.dataset.action;
      if (actionType === 'edit') {
        handlers.onEditTask(task.id);
      } else if (actionType === 'delete') {
        handlers.onDeleteTask(task.id);
      }
    } else {
      handlers.onCardClick(task.id);
    }
  });

  // Drag events
  card.addEventListener('dragstart', (e) => handlers.onDragStart(e, task.id));
  card.addEventListener('dragend', (e) => handlers.onDragEnd(e, task.id));

  return card;
}

/**
 * Render a column
 * @param {Object} column - Column configuration
 * @param {Array} tasks - All tasks
 * @param {Object} categories - Category colors
 * @param {boolean} editMode - Whether edit mode is active
 * @param {Object} handlers - Event handlers
 * @returns {HTMLElement} - Column element
 */
export function renderColumn(column, tasks, categories, editMode, handlers) {
  const columnTasks = getColumnTasks(tasks, column.id);

  const col = document.createElement('div');
  col.className = 'kanban-column';
  col.dataset.columnId = column.id;

  // Column header
  const header = document.createElement('div');
  header.className = 'column-header';
  header.innerHTML = `
    <span class="column-header__color" style="background: ${column.color};"></span>
    <span class="column-header__title">${escapeHtml(column.name)}</span>
    <span class="column-header__count">${columnTasks.length}</span>
    <button class="column-header__collapse" title="Collapse column">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="15 18 9 12 15 6"/>
      </svg>
    </button>
  `;

  // Collapse toggle
  header.querySelector('.column-header__collapse').addEventListener('click', () => {
    handlers.onToggleCollapse(column.id);
  });

  col.appendChild(header);

  // Cards area
  const cardsArea = document.createElement('div');
  cardsArea.className = 'column-cards';
  cardsArea.dataset.columnId = column.id;

  if (columnTasks.length === 0) {
    cardsArea.innerHTML = `
      <div class="column-empty-state">
        <svg class="column-empty-state__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
          <line x1="12" y1="8" x2="12" y2="16"/>
          <line x1="8" y1="12" x2="16" y2="12"/>
        </svg>
        <span class="column-empty-state__text">Drop tasks here</span>
      </div>
    `;
  } else {
    columnTasks.forEach(task => {
      cardsArea.appendChild(renderCard(task, categories, editMode, handlers));
    });
  }

  // Drop zone events
  cardsArea.addEventListener('dragover', (e) => handlers.onDragOver(e, column.id));
  cardsArea.addEventListener('dragleave', (e) => handlers.onDragLeave(e, column.id));
  cardsArea.addEventListener('drop', (e) => handlers.onDrop(e, column.id));

  col.appendChild(cardsArea);

  // Footer with add button (edit mode)
  const footer = document.createElement('div');
  footer.className = 'column-footer';
  footer.innerHTML = `
    <button class="column-add-btn edit-only" onclick="openNewTaskInColumn('${column.id}')">
      + Add Task
    </button>
  `;
  col.appendChild(footer);

  return col;
}

/**
 * Main render function for the Kanban board
 * @param {Object} projectData - Full project data
 * @param {boolean} editMode - Whether edit mode is active
 * @param {Set} collapsedColumns - Set of collapsed column IDs
 * @param {string} searchQuery - Search filter string
 * @param {Object} handlers - Event handlers
 */
export function render(projectData, editMode, collapsedColumns, searchQuery, handlers) {
  const board = document.getElementById('kanbanBoard');
  board.classList.remove('loading');
  board.innerHTML = '';

  // Set data attributes for print
  board.dataset.title = projectData.project.title;
  board.dataset.printDate = new Date().toLocaleDateString();

  // Update header stats
  updateHeaderStats(projectData);

  // Filter tasks by search
  let tasks = projectData.tasks;
  if (searchQuery) {
    const query = searchQuery.toLowerCase();
    tasks = tasks.filter(t =>
      t.name.toLowerCase().includes(query) ||
      t.category.toLowerCase().includes(query) ||
      (t.assignee && t.assignee.toLowerCase().includes(query))
    );
  }

  // Render columns
  const workflow = projectData.workflow || { columns: [] };
  const sortedColumns = [...workflow.columns].sort((a, b) => a.position - b.position);

  sortedColumns.forEach(column => {
    const colElement = renderColumn(
      column,
      tasks,
      projectData.categories,
      editMode,
      handlers
    );

    // Handle collapsed state
    if (collapsedColumns.has(column.id)) {
      colElement.classList.add('kanban-column--collapsed');
    }

    board.appendChild(colElement);
  });

  // Update title
  document.getElementById('projectTitle').textContent = projectData.project.title;
}

/**
 * Update header statistics
 * @param {Object} projectData - Project data
 */
function updateHeaderStats(projectData) {
  const tasks = projectData.tasks || [];
  const workflow = projectData.workflow || { columns: [] };

  // Count by column
  let backlogCount = 0;
  let progressCount = 0;
  let doneCount = 0;

  tasks.forEach(task => {
    const columnId = task.board?.columnId || 'backlog';
    if (columnId === 'backlog' || columnId === 'todo') {
      backlogCount++;
    } else if (columnId === 'in-progress') {
      progressCount++;
    } else if (columnId === 'done') {
      doneCount++;
    } else {
      // Custom columns - find position to categorize
      const column = workflow.columns.find(c => c.id === columnId);
      if (column) {
        if (column.position <= 1) backlogCount++;
        else if (column.position >= workflow.columns.length - 1) doneCount++;
        else progressCount++;
      }
    }
  });

  document.getElementById('countBacklog').textContent = backlogCount;
  document.getElementById('countProgress').textContent = progressCount;
  document.getElementById('countDone').textContent = doneCount;
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
