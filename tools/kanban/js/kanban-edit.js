/**
 * Kanban Edit Module - CRUD operations, drag-drop
 */

import {
  generateTaskId,
  syncKanbanToGantt,
  repositionColumn,
  getCurrentWeek
} from '../../../shared/js/unified-data.js';

/**
 * Add a new task
 * @param {Object} projectData - Project data
 * @param {Object} taskData - New task data
 * @returns {Object|null} - Created task or null
 */
export function addTask(projectData, taskData) {
  const {
    name,
    category,
    columnId = 'backlog',
    assignee = '',
    priority = '',
    notes = '',
    startWeek = null,
    endWeek = null
  } = taskData;

  if (!name || !name.trim()) return null;

  // Calculate position (end of column)
  const columnTasks = projectData.tasks.filter(t => t.board?.columnId === columnId);
  const position = columnTasks.length;

  // Build planned array from weeks
  const planned = [];
  if (startWeek && endWeek) {
    for (let w = startWeek; w <= endWeek; w++) {
      planned.push(w);
    }
  }

  const newTask = {
    id: generateTaskId(),
    name: name.trim(),
    category: category || Object.keys(projectData.categories)[0] || 'General',
    planned,
    reality: [],
    assignee,
    priority,
    notes,
    isMilestone: false,
    board: {
      columnId,
      position
    }
  };

  projectData.tasks.push(newTask);
  return newTask;
}

/**
 * Update task details
 * @param {Object} projectData - Project data
 * @param {string} taskId - Task ID
 * @param {Object} updates - Updates to apply
 * @returns {boolean} - Success
 */
export function updateTask(projectData, taskId, updates) {
  const task = projectData.tasks.find(t => t.id === taskId);
  if (!task) return false;

  // Apply simple field updates
  const allowedFields = ['name', 'category', 'assignee', 'priority', 'notes', 'isMilestone'];
  allowedFields.forEach(field => {
    if (updates[field] !== undefined) {
      task[field] = updates[field];
    }
  });

  // Handle week range update
  if (updates.startWeek !== undefined || updates.endWeek !== undefined) {
    const startWeek = updates.startWeek ?? (task.planned.length > 0 ? Math.min(...task.planned) : 1);
    const endWeek = updates.endWeek ?? (task.planned.length > 0 ? Math.max(...task.planned) : startWeek);

    if (startWeek > 0 && endWeek >= startWeek) {
      task.planned = [];
      for (let w = startWeek; w <= endWeek; w++) {
        task.planned.push(w);
      }
    }
  }

  return true;
}

/**
 * Delete a task
 * @param {Object} projectData - Project data
 * @param {string} taskId - Task ID
 * @returns {boolean} - Success
 */
export function deleteTask(projectData, taskId) {
  const index = projectData.tasks.findIndex(t => t.id === taskId);
  if (index === -1) return false;

  const task = projectData.tasks[index];
  const columnId = task.board?.columnId;

  projectData.tasks.splice(index, 1);

  // Reposition remaining tasks in column
  if (columnId) {
    repositionColumn(projectData.tasks, columnId);
  }

  return true;
}

/**
 * Move task to a different column
 * @param {Object} projectData - Project data
 * @param {string} taskId - Task ID
 * @param {string} targetColumnId - Target column
 * @param {number} targetPosition - Position in target column
 * @returns {boolean} - Success
 */
export function moveTask(projectData, taskId, targetColumnId, targetPosition) {
  const task = projectData.tasks.find(t => t.id === taskId);
  if (!task) return false;

  const sourceColumnId = task.board?.columnId;
  const currentWeek = getCurrentWeek(projectData.project);

  // Apply sync rules (Kanban -> Gantt)
  syncKanbanToGantt(task, targetColumnId, currentWeek);

  // Update position
  task.board.position = targetPosition;

  // Reorder target column
  const targetTasks = projectData.tasks
    .filter(t => t.board?.columnId === targetColumnId && t.id !== taskId)
    .sort((a, b) => a.board.position - b.board.position);

  // Shift tasks to make room
  targetTasks.forEach((t, index) => {
    if (index >= targetPosition) {
      t.board.position = index + 1;
    } else {
      t.board.position = index;
    }
  });

  // Reposition source column if different
  if (sourceColumnId && sourceColumnId !== targetColumnId) {
    repositionColumn(projectData.tasks, sourceColumnId);
  }

  return true;
}

/**
 * Duplicate a task
 * @param {Object} projectData - Project data
 * @param {string} taskId - Task to duplicate
 * @returns {Object|null} - New task or null
 */
export function duplicateTask(projectData, taskId) {
  const task = projectData.tasks.find(t => t.id === taskId);
  if (!task) return null;

  const columnTasks = projectData.tasks.filter(t => t.board?.columnId === task.board?.columnId);

  const newTask = {
    ...JSON.parse(JSON.stringify(task)),
    id: generateTaskId(),
    name: `${task.name} (copy)`,
    reality: [], // Reset progress
    board: {
      columnId: task.board?.columnId || 'backlog',
      position: columnTasks.length
    }
  };

  projectData.tasks.push(newTask);
  return newTask;
}

/**
 * Update workflow column settings
 * @param {Object} projectData - Project data
 * @param {string} columnId - Column ID
 * @param {Object} updates - Updates to apply
 * @returns {boolean} - Success
 */
export function updateColumn(projectData, columnId, updates) {
  if (!projectData.workflow) return false;

  const column = projectData.workflow.columns.find(c => c.id === columnId);
  if (!column) return false;

  const allowedFields = ['name', 'color'];
  allowedFields.forEach(field => {
    if (updates[field] !== undefined) {
      column[field] = updates[field];
    }
  });

  return true;
}

/**
 * Calculate drop position from mouse coordinates
 * @param {HTMLElement} cardsArea - Cards container
 * @param {number} clientY - Mouse Y coordinate
 * @returns {number} - Position index
 */
export function calculateDropPosition(cardsArea, clientY) {
  const cards = Array.from(cardsArea.querySelectorAll('.kanban-card'));

  if (cards.length === 0) return 0;

  for (let i = 0; i < cards.length; i++) {
    const rect = cards[i].getBoundingClientRect();
    const midY = rect.top + rect.height / 2;

    if (clientY < midY) {
      return i;
    }
  }

  return cards.length;
}

/**
 * Show drop indicator at position
 * @param {HTMLElement} cardsArea - Cards container
 * @param {number} position - Position index
 */
export function showDropIndicator(cardsArea, position) {
  // Remove existing indicator
  hideDropIndicator(cardsArea);

  const indicator = document.createElement('div');
  indicator.className = 'drop-indicator';

  const cards = cardsArea.querySelectorAll('.kanban-card');

  if (position >= cards.length) {
    cardsArea.appendChild(indicator);
  } else {
    cardsArea.insertBefore(indicator, cards[position]);
  }
}

/**
 * Hide drop indicator
 * @param {HTMLElement} cardsArea - Cards container
 */
export function hideDropIndicator(cardsArea) {
  const existing = cardsArea.querySelector('.drop-indicator');
  if (existing) {
    existing.remove();
  }
}
