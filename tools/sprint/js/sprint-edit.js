/**
 * Sprint Edit Module - CRUD operations and drag-drop logic
 */

import {
  generateTaskId,
  generateSprintId,
  getProductBacklog,
  getSprintTasks,
  syncKanbanToGantt,
  getCurrentWeek,
  getSprintWeekNumber
} from '../../../shared/js/unified-data.js';

// ========== TASK CRUD ==========

/**
 * Add a new task to the product backlog
 * @param {Object} projectData - Project data
 * @param {Object} taskData - Task data
 * @returns {Object|null} - Created task or null
 */
export function addTask(projectData, taskData) {
  const { name, category, storyPoints } = taskData;

  if (!name || !name.trim()) {
    console.error('Task name is required');
    return null;
  }

  // Calculate backlog position (add to end)
  const backlogTasks = getProductBacklog(projectData.tasks);
  const maxPosition = backlogTasks.reduce((max, t) =>
    Math.max(max, t.backlogPosition || 0), -1);

  const newTask = {
    id: generateTaskId(),
    name: name.trim(),
    category: category || Object.keys(projectData.categories)[0] || 'General',
    planned: [],
    reality: [],
    assignee: '',
    priority: '',
    notes: '',
    isMilestone: false,
    board: {
      columnId: 'backlog',
      position: projectData.tasks.length
    },
    // Sprint-specific fields
    storyPoints: storyPoints !== undefined ? storyPoints : null,
    sprintId: null,
    backlogPosition: maxPosition + 1
  };

  projectData.tasks.push(newTask);
  return newTask;
}

/**
 * Update an existing task
 * @param {Object} projectData - Project data
 * @param {string} taskId - Task ID
 * @param {Object} updates - Fields to update
 * @returns {boolean} - Success
 */
export function updateTask(projectData, taskId, updates) {
  const task = projectData.tasks.find(t => t.id === taskId);
  if (!task) return false;

  // Apply direct updates
  if (updates.name !== undefined) task.name = updates.name.trim();
  if (updates.category !== undefined) task.category = updates.category;
  if (updates.assignee !== undefined) task.assignee = updates.assignee;
  if (updates.priority !== undefined) task.priority = updates.priority;
  if (updates.notes !== undefined) task.notes = updates.notes;
  if (updates.storyPoints !== undefined) task.storyPoints = updates.storyPoints;

  // Handle Kanban column update (use sync to track completedAt for burndown)
  if (updates.columnId !== undefined && task.board) {
    const currentWeek = getCurrentWeek(projectData.project);
    syncKanbanToGantt(task, updates.columnId, currentWeek);
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

  projectData.tasks.splice(index, 1);
  return true;
}

// ========== SPRINT CRUD ==========

/**
 * Create a new sprint
 * @param {Object} projectData - Project data
 * @param {Object} sprintData - Sprint data (startDate/endDate as ISO strings, or startWeek/endWeek for backwards compat)
 * @returns {Object} - Created sprint
 */
export function createSprint(projectData, sprintData) {
  const { name, goal, startDate, endDate, startWeek, endWeek, status } = sprintData;

  // Calculate dates from weeks if not provided directly
  let finalStartDate = startDate;
  let finalEndDate = endDate;

  if (!finalStartDate && startWeek && projectData.project?.startDate) {
    const projStart = new Date(projectData.project.startDate);
    projStart.setDate(projStart.getDate() + (startWeek - 1) * 7);
    finalStartDate = projStart.toISOString().split('T')[0];
  }

  if (!finalEndDate && endWeek && projectData.project?.startDate) {
    const projStart = new Date(projectData.project.startDate);
    projStart.setDate(projStart.getDate() + (endWeek * 7) - 1);
    finalEndDate = projStart.toISOString().split('T')[0];
  }

  // Default to 2-week sprint starting from today if nothing provided
  if (!finalStartDate) {
    finalStartDate = new Date().toISOString().split('T')[0];
  }
  if (!finalEndDate) {
    const end = new Date(finalStartDate);
    end.setDate(end.getDate() + 13); // 2 weeks
    finalEndDate = end.toISOString().split('T')[0];
  }

  const newSprint = {
    id: generateSprintId(),
    name: name || `Sprint ${projectData.sprints.length + 1}`,
    goal: goal || '',
    startDate: finalStartDate,
    endDate: finalEndDate,
    status: status || 'planning'
  };

  projectData.sprints.push(newSprint);
  return newSprint;
}

/**
 * Update an existing sprint
 * @param {Object} projectData - Project data
 * @param {string} sprintId - Sprint ID
 * @param {Object} updates - Fields to update (startDate/endDate or startWeek/endWeek for backwards compat)
 * @returns {boolean} - Success
 */
export function updateSprint(projectData, sprintId, updates) {
  const sprint = projectData.sprints.find(s => s.id === sprintId);
  if (!sprint) return false;

  if (updates.name !== undefined) sprint.name = updates.name.trim();
  if (updates.goal !== undefined) sprint.goal = updates.goal;
  if (updates.status !== undefined) sprint.status = updates.status;

  // Handle date updates (prefer startDate/endDate over startWeek/endWeek)
  if (updates.startDate !== undefined) {
    sprint.startDate = updates.startDate;
  } else if (updates.startWeek !== undefined && projectData.project?.startDate) {
    // Convert week to date for backwards compatibility
    const projStart = new Date(projectData.project.startDate);
    projStart.setDate(projStart.getDate() + (updates.startWeek - 1) * 7);
    sprint.startDate = projStart.toISOString().split('T')[0];
  }

  if (updates.endDate !== undefined) {
    sprint.endDate = updates.endDate;
  } else if (updates.endWeek !== undefined && projectData.project?.startDate) {
    // Convert week to date for backwards compatibility
    const projStart = new Date(projectData.project.startDate);
    projStart.setDate(projStart.getDate() + (updates.endWeek * 7) - 1);
    sprint.endDate = projStart.toISOString().split('T')[0];
  }

  return true;
}

/**
 * Delete a sprint (moves tasks back to backlog)
 * @param {Object} projectData - Project data
 * @param {string} sprintId - Sprint ID
 * @returns {boolean} - Success
 */
export function deleteSprint(projectData, sprintId) {
  const index = projectData.sprints.findIndex(s => s.id === sprintId);
  if (index === -1) return false;

  // Move all tasks in this sprint back to backlog
  projectData.tasks.forEach(task => {
    if (task.sprintId === sprintId) {
      task.sprintId = null;
    }
  });

  // Reorder backlog positions
  reorderBacklogPositions(projectData);

  // Remove the sprint
  projectData.sprints.splice(index, 1);
  return true;
}

// ========== TASK MOVEMENT ==========

/**
 * Move a task from backlog to a sprint
 * @param {Object} projectData - Project data
 * @param {string} taskId - Task ID
 * @param {string} sprintId - Target sprint ID
 * @param {number} position - Position in sprint
 * @returns {boolean} - Success
 */
export function moveTaskToSprint(projectData, taskId, sprintId, position = 0) {
  const task = projectData.tasks.find(t => t.id === taskId);
  if (!task) return false;

  const sprint = projectData.sprints.find(s => s.id === sprintId);
  if (!sprint) return false;

  // Assign to sprint
  task.sprintId = sprintId;
  task.backlogPosition = position;

  // Optionally sync planned weeks to sprint dates
  if (sprint.startDate && sprint.endDate && projectData.project?.startDate) {
    // Only set planned if it's empty
    if (!task.planned || task.planned.length === 0) {
      const projectStart = new Date(projectData.project.startDate);
      const sprintStart = new Date(sprint.startDate);
      const sprintEnd = new Date(sprint.endDate);

      // Calculate start and end weeks relative to project
      const startDiffDays = Math.floor((sprintStart - projectStart) / (1000 * 60 * 60 * 24));
      const endDiffDays = Math.floor((sprintEnd - projectStart) / (1000 * 60 * 60 * 24));
      const startWeek = Math.floor(startDiffDays / 7) + 1;
      const endWeek = Math.floor(endDiffDays / 7) + 1;

      task.planned = [];
      for (let w = startWeek; w <= endWeek; w++) {
        task.planned.push(w);
      }
    }
  }

  // Reorder sprint items
  reorderSprintPositions(projectData, sprintId);

  return true;
}

/**
 * Move a task from sprint back to backlog
 * @param {Object} projectData - Project data
 * @param {string} taskId - Task ID
 * @param {number} position - Position in backlog (optional)
 * @returns {boolean} - Success
 */
export function moveTaskToBacklog(projectData, taskId, position = null) {
  const task = projectData.tasks.find(t => t.id === taskId);
  if (!task) return false;

  // Clear sprint assignment
  task.sprintId = null;

  // Set backlog position
  if (position !== null) {
    task.backlogPosition = position;
  } else {
    // Add to end of backlog
    const backlogTasks = getProductBacklog(projectData.tasks);
    const maxPosition = backlogTasks.reduce((max, t) =>
      Math.max(max, t.backlogPosition || 0), -1);
    task.backlogPosition = maxPosition + 1;
  }

  // Reorder backlog
  reorderBacklogPositions(projectData);

  return true;
}

/**
 * Reorder a task within the backlog
 * @param {Object} projectData - Project data
 * @param {string} taskId - Task ID
 * @param {number} newPosition - New position
 * @returns {boolean} - Success
 */
export function reorderBacklogItem(projectData, taskId, newPosition) {
  const task = projectData.tasks.find(t => t.id === taskId);
  if (!task || task.sprintId !== null) return false;

  task.backlogPosition = newPosition;
  reorderBacklogPositions(projectData);

  return true;
}

/**
 * Reorder a task within a sprint
 * @param {Object} projectData - Project data
 * @param {string} taskId - Task ID
 * @param {number} newPosition - New position
 * @returns {boolean} - Success
 */
export function reorderSprintItem(projectData, taskId, newPosition) {
  const task = projectData.tasks.find(t => t.id === taskId);
  if (!task || !task.sprintId) return false;

  task.backlogPosition = newPosition;
  reorderSprintPositions(projectData, task.sprintId);

  return true;
}

// ========== POSITION HELPERS ==========

/**
 * Reorder backlog positions to be sequential
 * @param {Object} projectData - Project data
 */
function reorderBacklogPositions(projectData) {
  const backlogTasks = getProductBacklog(projectData.tasks);
  backlogTasks.sort((a, b) => (a.backlogPosition || 0) - (b.backlogPosition || 0));
  backlogTasks.forEach((task, index) => {
    task.backlogPosition = index;
  });
}

/**
 * Reorder sprint positions to be sequential
 * @param {Object} projectData - Project data
 * @param {string} sprintId - Sprint ID
 */
function reorderSprintPositions(projectData, sprintId) {
  const sprintTasks = getSprintTasks(projectData.tasks, sprintId);
  sprintTasks.sort((a, b) => (a.backlogPosition || 0) - (b.backlogPosition || 0));
  sprintTasks.forEach((task, index) => {
    task.backlogPosition = index;
  });
}

// ========== DRAG & DROP HELPERS ==========

/**
 * Calculate drop position based on mouse Y coordinate
 * @param {HTMLElement} container - Drop container
 * @param {number} clientY - Mouse Y position
 * @param {string} itemSelector - CSS selector for items
 * @returns {number} - Position index
 */
export function calculateDropPosition(container, clientY, itemSelector) {
  const items = Array.from(container.querySelectorAll(itemSelector));

  if (items.length === 0) {
    return 0;
  }

  for (let i = 0; i < items.length; i++) {
    const rect = items[i].getBoundingClientRect();
    const midY = rect.top + rect.height / 2;

    if (clientY < midY) {
      return i;
    }
  }

  return items.length;
}

/**
 * Show drop indicator at position
 * @param {HTMLElement} container - Drop container
 * @param {number} position - Position index
 * @param {string} itemSelector - CSS selector for items
 */
export function showDropIndicator(container, position, itemSelector) {
  // Remove existing indicator
  hideDropIndicator(container);

  const items = Array.from(container.querySelectorAll(itemSelector));
  const indicator = document.createElement('div');
  indicator.className = 'drop-indicator';

  if (items.length === 0) {
    container.appendChild(indicator);
  } else if (position >= items.length) {
    container.appendChild(indicator);
  } else {
    items[position].parentNode.insertBefore(indicator, items[position]);
  }
}

/**
 * Hide drop indicator
 * @param {HTMLElement} container - Drop container
 */
export function hideDropIndicator(container) {
  const indicator = container.querySelector('.drop-indicator');
  if (indicator) {
    indicator.remove();
  }
}
