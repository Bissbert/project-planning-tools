/**
 * Gantt Edit Module - Edit mode, CRUD, drag-drop handlers
 */

import { generateTaskId, deriveColumnFromProgress } from '../../../shared/js/unified-data.js';

// ========== TASK CRUD OPERATIONS ==========

/**
 * Add a new task to a category
 * @param {Object} projectData - Project data
 * @param {string} category - Category name
 * @returns {Object|null} - New task or null if cancelled
 */
export function addTask(projectData, category) {
  const name = prompt('Enter task name:');
  if (!name || !name.trim()) return null;

  // Calculate board position (new tasks go to backlog)
  const backlogTasks = projectData.tasks.filter(t => t.board?.columnId === 'backlog');
  const boardPosition = backlogTasks.length;

  const newTask = {
    id: generateTaskId(),
    category: category,
    name: name.trim(),
    planned: [],
    reality: [],
    assignee: '',
    priority: '',
    notes: '',
    isMilestone: false,
    board: {
      columnId: 'backlog',
      position: boardPosition
    }
  };

  // Find last task in this category and insert after it
  const lastIndex = projectData.tasks.map((t, i) => t.category === category ? i : -1)
    .filter(i => i !== -1)
    .pop();

  if (lastIndex !== undefined) {
    projectData.tasks.splice(lastIndex + 1, 0, newTask);
  } else {
    projectData.tasks.push(newTask);
  }

  return newTask;
}

/**
 * Delete a task
 * @param {Object} projectData - Project data
 * @param {number} taskId - Task ID
 * @returns {boolean} - Whether task was deleted
 */
export function deleteTask(projectData, taskId) {
  const task = projectData.tasks.find(t => t.id === taskId);
  if (!task) return false;

  if (!confirm(`Delete task "${task.name}"?`)) return false;

  projectData.tasks = projectData.tasks.filter(t => t.id !== taskId);
  return true;
}

/**
 * Rename a task
 * @param {Object} projectData - Project data
 * @param {number} taskId - Task ID
 * @param {string} newName - New name
 * @returns {boolean} - Whether task was renamed
 */
export function renameTask(projectData, taskId, newName) {
  const task = projectData.tasks.find(t => t.id === taskId);
  if (!task) return false;

  const trimmedName = newName.trim();
  if (trimmedName && trimmedName !== task.name) {
    task.name = trimmedName;
    return true;
  }
  return false;
}

/**
 * Duplicate a task
 * @param {Object} projectData - Project data
 * @param {string} taskId - Task ID
 * @returns {Object|null} - New task or null
 */
export function duplicateTask(projectData, taskId) {
  const task = projectData.tasks.find(t => t.id === taskId);
  if (!task) return null;

  // Calculate board position (duplicated task goes to backlog)
  const backlogTasks = projectData.tasks.filter(t => t.board?.columnId === 'backlog');
  const boardPosition = backlogTasks.length;

  const newTask = {
    id: generateTaskId(),
    category: task.category,
    name: task.name + ' (copy)',
    planned: [...task.planned],
    reality: [],
    assignee: task.assignee || '',
    priority: task.priority || '',
    notes: task.notes || '',
    isMilestone: task.isMilestone || false,
    board: {
      columnId: 'backlog',
      position: boardPosition
    }
  };

  // Insert after the original task
  const taskIndex = projectData.tasks.findIndex(t => t.id === taskId);
  projectData.tasks.splice(taskIndex + 1, 0, newTask);

  return newTask;
}

/**
 * Copy planned weeks to reality
 * @param {Object} projectData - Project data
 * @param {number} taskId - Task ID
 * @returns {boolean} - Whether copy was successful
 */
export function copyPlannedToReality(projectData, taskId) {
  const task = projectData.tasks.find(t => t.id === taskId);
  if (!task) return false;

  if (!task.planned || task.planned.length === 0) {
    return false;
  }

  task.reality = [...task.planned];
  return true;
}

/**
 * Move task to different category
 * @param {Object} projectData - Project data
 * @param {number} taskId - Task ID
 * @param {string} newCategory - New category name
 * @returns {boolean} - Whether move was successful
 */
export function moveTaskToCategory(projectData, taskId, newCategory) {
  const task = projectData.tasks.find(t => t.id === taskId);
  if (!task) return false;

  // Don't move if same category
  if (task.category === newCategory) return false;

  // Remove task from current position
  const taskIndex = projectData.tasks.findIndex(t => t.id === taskId);
  projectData.tasks.splice(taskIndex, 1);

  // Update task's category
  task.category = newCategory;

  // Find the last task in the new category to insert after it
  let insertIndex = -1;
  for (let i = projectData.tasks.length - 1; i >= 0; i--) {
    if (projectData.tasks[i].category === newCategory) {
      insertIndex = i + 1;
      break;
    }
  }

  // If no tasks in new category, find where the category appears in order
  if (insertIndex === -1) {
    const newCatIndex = Object.keys(projectData.categories).indexOf(newCategory);

    // Find first task of a category that comes after newCategory
    for (let i = 0; i < projectData.tasks.length; i++) {
      const taskCatIndex = Object.keys(projectData.categories).indexOf(projectData.tasks[i].category);
      if (taskCatIndex > newCatIndex) {
        insertIndex = i;
        break;
      }
    }

    // If still not found, append at end
    if (insertIndex === -1) {
      insertIndex = projectData.tasks.length;
    }
  }

  // Insert task at new position
  projectData.tasks.splice(insertIndex, 0, task);
  return true;
}

/**
 * Update task details
 * @param {Object} projectData - Project data
 * @param {number} taskId - Task ID
 * @param {Object} details - {assignee, priority, isMilestone, notes}
 * @returns {boolean} - Whether update was successful
 */
export function updateTaskDetails(projectData, taskId, details) {
  const task = projectData.tasks.find(t => t.id === taskId);
  if (!task) return false;

  if (details.assignee !== undefined) task.assignee = details.assignee;
  if (details.priority !== undefined) task.priority = details.priority;
  if (details.isMilestone !== undefined) task.isMilestone = details.isMilestone;
  if (details.notes !== undefined) task.notes = details.notes;

  return true;
}

/**
 * Set task week range
 * @param {Object} projectData - Project data
 * @param {number} taskId - Task ID
 * @param {number} startWeek - Start week
 * @param {number} endWeek - End week
 * @returns {boolean} - Whether update was successful
 */
export function setTaskWeekRange(projectData, taskId, startWeek, endWeek) {
  const task = projectData.tasks.find(t => t.id === taskId);
  if (!task) return false;

  if (startWeek < 1 || endWeek < startWeek || endWeek > projectData.project.totalWeeks) {
    return false;
  }

  // Generate new planned array
  task.planned = [];
  for (let w = startWeek; w <= endWeek; w++) {
    task.planned.push(w);
  }

  return true;
}

/**
 * Toggle week for planned or reality
 * @param {Object} projectData - Project data
 * @param {number} taskId - Task ID
 * @param {number} week - Week number
 * @param {string} type - 'planned' or 'reality'
 * @returns {boolean} - New state of the week (true = active)
 */
export function toggleWeek(projectData, taskId, week, type) {
  const task = projectData.tasks.find(t => t.id === taskId);
  if (!task) return false;

  if (!task[type]) task[type] = [];

  const idx = task[type].indexOf(week);
  if (idx === -1) {
    task[type].push(week);
    task[type].sort((a, b) => a - b);
    return true;
  } else {
    task[type].splice(idx, 1);
    return false;
  }
}

/**
 * Fill week range (for shift+click)
 * @param {Object} projectData - Project data
 * @param {number} taskId - Task ID
 * @param {number} startWeek - Start week
 * @param {number} endWeek - End week
 * @param {string} type - 'planned' or 'reality'
 * @param {boolean} isAdding - Whether adding or removing weeks
 */
export function fillWeekRange(projectData, taskId, startWeek, endWeek, type, isAdding) {
  const task = projectData.tasks.find(t => t.id === taskId);
  if (!task) return;

  if (!task[type]) task[type] = [];

  const minWeek = Math.min(startWeek, endWeek);
  const maxWeek = Math.max(startWeek, endWeek);

  for (let w = minWeek; w <= maxWeek; w++) {
    const idx = task[type].indexOf(w);
    if (isAdding && idx === -1) {
      task[type].push(w);
    } else if (!isAdding && idx !== -1) {
      task[type].splice(idx, 1);
    }
  }

  task[type].sort((a, b) => a - b);
}

// ========== CATEGORY CRUD OPERATIONS ==========

/**
 * Add a new category
 * @param {Object} projectData - Project data
 * @returns {string|null} - New category name or null if cancelled
 */
export function addCategory(projectData) {
  const name = prompt('Enter category name:');
  if (!name || !name.trim()) return null;

  const trimmedName = name.trim();
  if (projectData.categories[trimmedName]) {
    alert('Category already exists');
    return null;
  }

  // Generate a random color
  const colors = ['#4472C4', '#ED7D31', '#70AD47', '#7030A0', '#FFC000', '#5B9BD5', '#44546A'];
  const usedColors = Object.values(projectData.categories);
  const availableColors = colors.filter(c => !usedColors.includes(c));
  const newColor = availableColors[0] || colors[Math.floor(Math.random() * colors.length)];

  projectData.categories[trimmedName] = newColor;
  return trimmedName;
}

/**
 * Delete a category
 * @param {Object} projectData - Project data
 * @param {string} categoryName - Category name
 * @returns {boolean} - Whether category was deleted
 */
export function deleteCategory(projectData, categoryName) {
  const tasksInCategory = projectData.tasks.filter(t => t.category === categoryName);

  if (tasksInCategory.length > 0) {
    if (!confirm(`Delete category "${categoryName}" and its ${tasksInCategory.length} tasks?`)) return false;
  } else {
    if (!confirm(`Delete empty category "${categoryName}"?`)) return false;
  }

  if (tasksInCategory.length > 0) {
    projectData.tasks = projectData.tasks.filter(t => t.category !== categoryName);
  }
  delete projectData.categories[categoryName];
  return true;
}

/**
 * Set category color
 * @param {Object} projectData - Project data
 * @param {string} categoryName - Category name
 * @param {string} color - New color
 */
export function setCategoryColor(projectData, categoryName, color) {
  projectData.categories[categoryName] = color;
}

/**
 * Rename a category
 * @param {Object} projectData - Project data
 * @param {string} oldName - Old category name
 * @param {string} newName - New category name
 * @returns {boolean} - Whether rename was successful
 */
export function renameCategory(projectData, oldName, newName) {
  const trimmedName = newName.trim();
  if (!trimmedName || trimmedName === oldName) return false;

  if (projectData.categories[trimmedName] && trimmedName !== oldName) {
    alert('Category name already exists');
    return false;
  }

  // Update category
  const color = projectData.categories[oldName];
  delete projectData.categories[oldName];
  projectData.categories[trimmedName] = color;

  // Update all tasks with this category
  projectData.tasks.forEach(task => {
    if (task.category === oldName) {
      task.category = trimmedName;
    }
  });

  return true;
}

/**
 * Reorder categories
 * @param {Object} projectData - Project data
 * @param {string} draggedCategory - Category being dragged
 * @param {string} targetCategory - Category to drop on
 * @returns {boolean} - Whether reorder was successful
 */
export function reorderCategories(projectData, draggedCategory, targetCategory) {
  if (draggedCategory === targetCategory) return false;

  // Get category order from categories object
  const categoryOrder = Object.keys(projectData.categories);
  const draggedIndex = categoryOrder.indexOf(draggedCategory);
  const targetIndex = categoryOrder.indexOf(targetCategory);

  if (draggedIndex === -1 || targetIndex === -1) return false;

  // Reorder the categories object
  const newCategories = {};
  const entries = Object.entries(projectData.categories);
  const [draggedEntry] = entries.splice(draggedIndex, 1);
  entries.splice(targetIndex, 0, draggedEntry);

  entries.forEach(([key, value]) => {
    newCategories[key] = value;
  });

  projectData.categories = newCategories;

  // Reorder tasks to match new category order
  const newTasks = [];
  Object.keys(newCategories).forEach(cat => {
    const catTasks = projectData.tasks.filter(t => t.category === cat);
    newTasks.push(...catTasks);
  });

  projectData.tasks = newTasks;
  return true;
}

// ========== TASK DRAG AND DROP ==========

/**
 * Reorder tasks within or across categories via drag-drop
 * @param {Object} projectData - Project data
 * @param {number} draggedTaskId - Task ID being dragged
 * @param {number} targetTaskId - Task ID to drop on
 * @param {string} targetCategory - Category of drop target
 * @returns {boolean} - Whether reorder was successful
 */
export function reorderTasks(projectData, draggedTaskId, targetTaskId, targetCategory) {
  const draggedTask = projectData.tasks.find(t => t.id === draggedTaskId);
  if (!draggedTask) return false;

  // Remove from current position
  projectData.tasks = projectData.tasks.filter(t => t.id !== draggedTaskId);

  // Update category if dropping on different category
  if (targetCategory && draggedTask.category !== targetCategory) {
    draggedTask.category = targetCategory;
  }

  // Find target index
  let targetIndex = projectData.tasks.length;
  if (targetTaskId !== null) {
    targetIndex = projectData.tasks.findIndex(t => t.id === targetTaskId);
    if (targetIndex === -1) targetIndex = projectData.tasks.length;
  }

  // Insert at new position
  projectData.tasks.splice(targetIndex, 0, draggedTask);
  return true;
}

// ========== INLINE EDITING HELPERS ==========

/**
 * Start inline edit of task name
 * @param {HTMLElement} element - Element containing task name
 * @param {number} taskId - Task ID
 * @param {Object} projectData - Project data
 * @param {Function} onSave - Callback when save complete
 */
export function startRenameTask(element, taskId, projectData, onSave) {
  const task = projectData.tasks.find(t => t.id === taskId);
  if (!task) return;

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'inline-edit';
  input.value = task.name;

  const finish = () => {
    const newName = input.value.trim();
    if (newName && newName !== task.name) {
      task.name = newName;
      onSave();
    } else {
      onSave();
    }
  };

  input.addEventListener('blur', finish);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      input.blur();
    } else if (e.key === 'Escape') {
      input.value = task.name;
      input.blur();
    }
  });

  element.innerHTML = '';
  element.appendChild(input);
  input.focus();
  input.select();
}

/**
 * Start inline edit of category name
 * @param {HTMLElement} element - Element containing category name
 * @param {string} categoryName - Current category name
 * @param {Object} projectData - Project data
 * @param {Function} onSave - Callback when save complete
 */
export function startRenameCategory(element, categoryName, projectData, onSave) {
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'inline-edit';
  input.value = categoryName;
  input.style.width = '150px';

  const finish = () => {
    const newName = input.value.trim();
    if (newName && newName !== categoryName) {
      if (projectData.categories[newName] && newName !== categoryName) {
        alert('Category name already exists');
        onSave();
        return;
      }

      // Update category
      const color = projectData.categories[categoryName];
      delete projectData.categories[categoryName];
      projectData.categories[newName] = color;

      // Update all tasks with this category
      projectData.tasks.forEach(task => {
        if (task.category === categoryName) {
          task.category = newName;
        }
      });

      onSave();
    } else {
      onSave();
    }
  };

  input.addEventListener('blur', finish);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      input.blur();
    } else if (e.key === 'Escape') {
      input.value = categoryName;
      input.blur();
    }
  });

  element.innerHTML = '';
  element.appendChild(input);
  input.focus();
  input.select();
}

/**
 * Start inline edit of project title
 * @param {Object} projectData - Project data
 * @param {Function} onSave - Callback when save complete
 */
export function startEditTitle(projectData, onSave) {
  const titleEl = document.getElementById('projectTitle');
  const currentTitle = projectData.project.title || '8-Month Game Production';

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'title-edit-input';
  input.value = currentTitle;

  titleEl.textContent = '';
  titleEl.appendChild(input);
  input.focus();
  input.select();

  const finish = () => {
    const newTitle = input.value.trim();
    if (newTitle && newTitle !== projectData.project.title) {
      projectData.project.title = newTitle;
    }
    onSave();
  };

  input.addEventListener('blur', finish);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      input.blur();
    } else if (e.key === 'Escape') {
      input.value = currentTitle;
      input.blur();
    }
  });
}
