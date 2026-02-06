/**
 * Kanban App Module - Init, keyboard shortcuts, orchestration
 * Main entry point for the Kanban board application
 */

// Import shared modules
import { saveToStorage, loadFromStorage } from '../../../shared/js/storage.js';
import { createBackup } from '../../../shared/js/backup.js';
import { createUndoManager } from '../../../shared/js/undo.js';
import { downloadJSON, readJSONFile, sanitizeFilename } from '../../../shared/js/export.js';
import { createStatusManager } from '../../../shared/js/status.js';

// Import unified data module
import {
  DATA_VERSION,
  STORAGE_KEY,
  BACKUP_KEY,
  migrateToV7,
  cloneProjectData,
  defaultWorkflow,
  getCurrentWeek,
  syncGanttToKanban,
  generateColumnId,
  isDefaultColumn
} from '../../../shared/js/unified-data.js';

// Import kanban modules
import { render } from './kanban-render.js';
import {
  addTask,
  updateTask,
  deleteTask,
  moveTask,
  duplicateTask,
  updateColumn,
  calculateDropPosition,
  showDropIndicator,
  hideDropIndicator
} from './kanban-edit.js';

// ========== APP STATE ==========

let projectData = null;
let editMode = false;
let collapsedColumns = new Set();
let searchQuery = '';
let saveCount = 0;

// Drag state
let draggedTaskId = null;

// Modal state
let currentEditTaskId = null;
let newTaskColumnId = null;

// Managers
let undoManager = null;
let statusManager = null;

// ========== INITIALIZATION ==========

export function init() {
  // Initialize managers
  undoManager = createUndoManager(50);
  statusManager = createStatusManager('status');

  // Load data
  loadData();

  // Setup event listeners
  setupEventListeners();

  // Setup cross-tab sync
  setupStorageSync();

  // Initial render
  renderApp();
}

function loadData() {
  const saved = loadFromStorage(STORAGE_KEY);

  if (saved) {
    try {
      // Migrate if needed
      if (!saved.version || saved.version < DATA_VERSION) {
        console.log('Migrating data to v6 format...');
        projectData = migrateToV7(saved);
      } else {
        projectData = saved;
      }
    } catch (e) {
      console.error('Failed to parse saved data:', e);
      projectData = getDefaultProjectData();
    }
  } else {
    projectData = getDefaultProjectData();
  }

  // Ensure version is set
  projectData.version = DATA_VERSION;

  // Ensure workflow exists
  if (!projectData.workflow) {
    projectData.workflow = JSON.parse(JSON.stringify(defaultWorkflow));
  }

  // Save migrated data
  save();
}

function getDefaultProjectData() {
  return {
    version: DATA_VERSION,
    project: {
      title: "New Project",
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      totalWeeks: 13
    },
    team: [],
    categories: {
      "General": "#a78bfa"
    },
    workflow: JSON.parse(JSON.stringify(defaultWorkflow)),
    sprints: [],
    timeEntries: [],
    tasks: []
  };
}

// ========== SAVE/LOAD ==========

function save() {
  saveToStorage(STORAGE_KEY, projectData);
  statusManager.show('Saved', true);

  // Create auto-backup every 10 saves
  saveCount++;
  if (saveCount % 10 === 0) {
    createBackup(BACKUP_KEY, projectData);
  }
}

function saveState() {
  undoManager.saveState(projectData);
}

// ========== RENDER ==========

function renderApp() {
  render(projectData, editMode, collapsedColumns, searchQuery, getHandlers());
}

// ========== EVENT HANDLERS OBJECT ==========

function getHandlers() {
  return {
    // Card events
    onCardClick: (taskId) => {
      openTaskEdit(taskId);
    },
    onEditTask: (taskId) => {
      openTaskEdit(taskId);
    },
    onDeleteTask: (taskId) => {
      if (!editMode) return;
      if (confirm('Delete this task?')) {
        saveState();
        if (deleteTask(projectData, taskId)) {
          save();
          renderApp();
          statusManager.show('Task deleted', true);
        }
      }
    },

    // Drag events
    onDragStart: (e, taskId) => handleDragStart(e, taskId),
    onDragEnd: (e, taskId) => handleDragEnd(e, taskId),
    onDragOver: (e, columnId) => handleDragOver(e, columnId),
    onDragLeave: (e, columnId) => handleDragLeave(e, columnId),
    onDrop: (e, columnId) => handleDrop(e, columnId),

    // Column events
    onToggleCollapse: (columnId) => {
      if (collapsedColumns.has(columnId)) {
        collapsedColumns.delete(columnId);
      } else {
        collapsedColumns.add(columnId);
      }
      renderApp();
    }
  };
}

// ========== DRAG AND DROP ==========

function handleDragStart(e, taskId) {
  if (!editMode) {
    e.preventDefault();
    return;
  }

  draggedTaskId = taskId;
  e.target.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', taskId);
}

function handleDragEnd(e, taskId) {
  draggedTaskId = null;
  e.target.classList.remove('dragging');

  // Clean up all drop indicators
  document.querySelectorAll('.column-cards').forEach(area => {
    area.classList.remove('drag-over');
    hideDropIndicator(area);
  });
}

function handleDragOver(e, columnId) {
  if (!draggedTaskId) return;

  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';

  const cardsArea = e.currentTarget;
  cardsArea.classList.add('drag-over');

  // Show drop indicator
  const position = calculateDropPosition(cardsArea, e.clientY);
  showDropIndicator(cardsArea, position);
}

function handleDragLeave(e, columnId) {
  const cardsArea = e.currentTarget;

  // Only remove if actually leaving the area
  if (!cardsArea.contains(e.relatedTarget)) {
    cardsArea.classList.remove('drag-over');
    hideDropIndicator(cardsArea);
  }
}

function handleDrop(e, columnId) {
  e.preventDefault();

  if (!draggedTaskId) return;

  const cardsArea = e.currentTarget;
  cardsArea.classList.remove('drag-over');
  hideDropIndicator(cardsArea);

  const position = calculateDropPosition(cardsArea, e.clientY);

  saveState();
  if (moveTask(projectData, draggedTaskId, columnId, position)) {
    save();
    renderApp();
    statusManager.show('Task moved', true);
  }

  draggedTaskId = null;
}

// ========== TASK EDIT MODAL ==========

function openTaskEdit(taskId) {
  const task = projectData.tasks.find(t => t.id === taskId);
  if (!task) return;

  currentEditTaskId = taskId;

  // Populate form
  document.getElementById('taskEditTitle').textContent = editMode ? 'Edit Task' : 'Task Details';
  document.getElementById('taskEditName').value = task.name;
  document.getElementById('taskEditName').disabled = !editMode;

  // Category dropdown
  const categorySelect = document.getElementById('taskEditCategory');
  categorySelect.innerHTML = '';
  categorySelect.disabled = !editMode;
  Object.keys(projectData.categories).forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat;
    opt.textContent = cat;
    if (cat === task.category) opt.selected = true;
    categorySelect.appendChild(opt);
  });

  // Assignee dropdown
  const assigneeSelect = document.getElementById('taskEditAssignee');
  assigneeSelect.innerHTML = '<option value="">Unassigned</option>';
  assigneeSelect.disabled = !editMode;
  (projectData.team || []).forEach(member => {
    const opt = document.createElement('option');
    opt.value = member;
    opt.textContent = member;
    if (member === task.assignee) opt.selected = true;
    assigneeSelect.appendChild(opt);
  });

  document.getElementById('taskEditPriority').value = task.priority || '';
  document.getElementById('taskEditPriority').disabled = !editMode;

  document.getElementById('taskEditMilestone').checked = task.isMilestone || false;
  document.getElementById('taskEditMilestone').disabled = !editMode;

  document.getElementById('taskEditNotes').value = task.notes || '';
  document.getElementById('taskEditNotes').disabled = !editMode;

  // Timeline (planned)
  const planned = task.planned || [];
  document.getElementById('taskEditStartWeek').value = planned.length > 0 ? Math.min(...planned) : '';
  document.getElementById('taskEditEndWeek').value = planned.length > 0 ? Math.max(...planned) : '';
  document.getElementById('taskEditStartWeek').disabled = !editMode;
  document.getElementById('taskEditEndWeek').disabled = !editMode;

  // Reality weeks
  renderRealityWeeks(task.reality || []);
  document.getElementById('taskEditAddRealityWeek').value = '';
  document.getElementById('taskEditAddRealityWeek').disabled = !editMode;

  // Progress
  updateProgressDisplay(task);

  // Mark as Done button - hide if already done
  const markDoneBtn = document.getElementById('markDoneBtn');
  const isDone = task.board?.columnId === 'done';
  markDoneBtn.style.display = isDone ? 'none' : '';
  markDoneBtn.disabled = !editMode;

  document.getElementById('taskEditModal').classList.add('active');
}

/**
 * Render reality weeks as tags in the container
 */
function renderRealityWeeks(reality) {
  const container = document.getElementById('taskEditRealityContainer');
  container.innerHTML = '';

  const sortedWeeks = [...reality].sort((a, b) => a - b);

  sortedWeeks.forEach(week => {
    const tag = document.createElement('span');
    tag.className = 'reality-week-tag';
    tag.innerHTML = `
      W${week}
      <button class="reality-week-tag__remove" onclick="removeRealityWeek(${week})" title="Remove week">&times;</button>
    `;
    container.appendChild(tag);
  });
}

/**
 * Update progress bar display
 */
function updateProgressDisplay(task) {
  const planned = task.planned || [];
  const reality = task.reality || [];
  const progressFill = document.getElementById('taskEditProgressFill');
  const progressText = document.getElementById('taskEditProgressText');
  const progressGroup = document.getElementById('taskEditProgressGroup');

  if (planned.length === 0) {
    progressGroup.style.display = 'none';
    return;
  }

  progressGroup.style.display = '';
  const percent = Math.round((reality.length / planned.length) * 100);
  progressFill.style.width = `${Math.min(percent, 100)}%`;

  if (percent >= 100) {
    progressFill.classList.add('task-progress-fill--complete');
    progressText.textContent = `Complete (${reality.length}/${planned.length} weeks)`;
  } else {
    progressFill.classList.remove('task-progress-fill--complete');
    progressText.textContent = `${reality.length}/${planned.length} weeks (${percent}%)`;
  }
}

window.closeTaskEdit = function() {
  document.getElementById('taskEditModal').classList.remove('active');
  currentEditTaskId = null;
};

/**
 * Get current reality weeks from the UI
 */
function getCurrentRealityWeeks() {
  const container = document.getElementById('taskEditRealityContainer');
  const tags = container.querySelectorAll('.reality-week-tag');
  const weeks = [];
  tags.forEach(tag => {
    const text = tag.textContent.trim();
    const match = text.match(/W(\d+)/);
    if (match) {
      weeks.push(parseInt(match[1]));
    }
  });
  return weeks.sort((a, b) => a - b);
}

/**
 * Add a reality week
 */
window.addRealityWeek = function() {
  if (!currentEditTaskId || !editMode) return;

  const input = document.getElementById('taskEditAddRealityWeek');
  const week = parseInt(input.value);

  if (!week || week < 1) {
    statusManager.show('Enter a valid week number');
    return;
  }

  const task = projectData.tasks.find(t => t.id === currentEditTaskId);
  if (!task) return;

  // Check if week already exists
  const currentWeeks = getCurrentRealityWeeks();
  if (currentWeeks.includes(week)) {
    statusManager.show(`Week ${week} already added`);
    return;
  }

  // Add the week and re-render
  currentWeeks.push(week);
  renderRealityWeeks(currentWeeks);
  updateProgressDisplay({ ...task, reality: currentWeeks });

  input.value = '';
  statusManager.show(`Week ${week} added`, true);
};

/**
 * Remove a reality week
 */
window.removeRealityWeek = function(week) {
  if (!currentEditTaskId || !editMode) return;

  const task = projectData.tasks.find(t => t.id === currentEditTaskId);
  if (!task) return;

  const currentWeeks = getCurrentRealityWeeks().filter(w => w !== week);
  renderRealityWeeks(currentWeeks);
  updateProgressDisplay({ ...task, reality: currentWeeks });

  statusManager.show(`Week ${week} removed`, true);
};

/**
 * Mark task as done - moves to Done column without changing reality
 * Reality reflects actual work done, which may differ from planned
 */
window.markTaskAsDone = function() {
  if (!currentEditTaskId || !editMode) return;

  const task = projectData.tasks.find(t => t.id === currentEditTaskId);
  if (!task) return;

  saveState();

  // Just move to Done - don't modify reality
  // Reality should reflect actual weeks worked, not planned weeks
  task.reality = getCurrentRealityWeeks();
  task.board.columnId = 'done';

  save();
  closeTaskEdit();
  renderApp();
  statusManager.show('Task marked as done', true);
};

window.saveTaskEdit = function() {
  if (!currentEditTaskId) return;

  const startWeek = parseInt(document.getElementById('taskEditStartWeek').value) || null;
  const endWeek = parseInt(document.getElementById('taskEditEndWeek').value) || startWeek;

  // Get reality weeks from UI
  const reality = getCurrentRealityWeeks();

  saveState();

  // Find the task to update
  const task = projectData.tasks.find(t => t.id === currentEditTaskId);
  if (!task) return;

  // Update task fields
  updateTask(projectData, currentEditTaskId, {
    name: document.getElementById('taskEditName').value,
    category: document.getElementById('taskEditCategory').value,
    assignee: document.getElementById('taskEditAssignee').value,
    priority: document.getElementById('taskEditPriority').value,
    isMilestone: document.getElementById('taskEditMilestone').checked,
    notes: document.getElementById('taskEditNotes').value,
    startWeek,
    endWeek
  });

  // Update reality separately and sync to Kanban column
  task.reality = reality;
  syncGanttToKanban(task, projectData.workflow);

  save();
  closeTaskEdit();
  renderApp();
  statusManager.show('Task updated', true);
};

window.deleteCurrentTask = function() {
  if (!currentEditTaskId || !editMode) return;

  if (confirm('Delete this task?')) {
    saveState();
    if (deleteTask(projectData, currentEditTaskId)) {
      save();
      closeTaskEdit();
      renderApp();
      statusManager.show('Task deleted', true);
    }
  }
};

// ========== NEW TASK MODAL ==========

window.openNewTaskInColumn = function(columnId) {
  if (!editMode) return;

  newTaskColumnId = columnId;

  document.getElementById('newTaskName').value = '';

  // Category dropdown
  const categorySelect = document.getElementById('newTaskCategory');
  categorySelect.innerHTML = '';
  Object.keys(projectData.categories).forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat;
    opt.textContent = cat;
    categorySelect.appendChild(opt);
  });

  // Column dropdown
  const columnSelect = document.getElementById('newTaskColumn');
  columnSelect.innerHTML = '';
  projectData.workflow.columns.forEach(col => {
    const opt = document.createElement('option');
    opt.value = col.id;
    opt.textContent = col.name;
    if (col.id === columnId) opt.selected = true;
    columnSelect.appendChild(opt);
  });

  document.getElementById('newTaskModal').classList.add('active');
  document.getElementById('newTaskName').focus();
};

window.closeNewTask = function() {
  document.getElementById('newTaskModal').classList.remove('active');
  newTaskColumnId = null;
};

window.createNewTask = function() {
  const name = document.getElementById('newTaskName').value.trim();
  if (!name) {
    statusManager.show('Enter a task name');
    return;
  }

  saveState();
  const newTask = addTask(projectData, {
    name,
    category: document.getElementById('newTaskCategory').value,
    columnId: document.getElementById('newTaskColumn').value
  });

  if (newTask) {
    save();
    closeNewTask();
    renderApp();
    statusManager.show('Task created', true);
  }
};

// ========== SETTINGS MODAL ==========

// Track column order during drag
let settingsDraggedColumnId = null;

// Store original state to detect unsaved changes
let settingsOriginalState = null;

window.openSettings = function() {
  // Store original state for change detection
  settingsOriginalState = {
    title: projectData.project.title,
    columns: JSON.parse(JSON.stringify(projectData.workflow.columns))
  };

  document.getElementById('settingsTitle').value = projectData.project.title;
  renderColumnSettings();
  document.getElementById('settingsModal').classList.add('active');
};

/**
 * Check if settings have unsaved changes
 */
function hasSettingsChanged() {
  if (!settingsOriginalState) return false;

  // Check title
  const currentTitle = document.getElementById('settingsTitle').value.trim();
  if (currentTitle !== settingsOriginalState.title) return true;

  // Check columns count
  const currentColumns = projectData.workflow.columns;
  if (currentColumns.length !== settingsOriginalState.columns.length) return true;

  // Check each column's properties and order
  const sortedCurrent = [...currentColumns].sort((a, b) => a.position - b.position);
  const sortedOriginal = [...settingsOriginalState.columns].sort((a, b) => a.position - b.position);

  for (let i = 0; i < sortedCurrent.length; i++) {
    const curr = sortedCurrent[i];
    const orig = sortedOriginal[i];

    if (!orig || curr.id !== orig.id) return true;
    if (curr.position !== orig.position) return true;

    // Check name from input (might not be saved to projectData yet)
    const nameInput = document.querySelector(`input[data-column-id="${curr.id}"].column-setting-row__name-input`);
    const currentName = nameInput ? nameInput.value.trim() : curr.name;
    if (currentName !== orig.name) return true;

    // Check color from input
    const colorInput = document.querySelector(`input[data-column-id="${curr.id}"].column-setting-row__color-input`);
    const currentColor = colorInput ? colorInput.value : curr.color;
    if (currentColor !== orig.color) return true;
  }

  return false;
}

function renderColumnSettings() {
  const container = document.getElementById('columnSettings');
  container.innerHTML = '';

  const sortedColumns = [...projectData.workflow.columns].sort((a, b) => a.position - b.position);

  sortedColumns.forEach(col => {
    const isDefault = isDefaultColumn(col.id);
    const row = document.createElement('div');
    row.className = `column-setting-row ${isDefault ? 'column-setting-row--default' : ''}`;
    row.dataset.columnId = col.id;
    row.draggable = true;

    row.innerHTML = `
      <span class="column-setting-row__drag" title="Drag to reorder">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="8" y1="6" x2="16" y2="6"/>
          <line x1="8" y1="12" x2="16" y2="12"/>
          <line x1="8" y1="18" x2="16" y2="18"/>
        </svg>
      </span>
      <input type="color" class="column-setting-row__color-input"
             data-column-id="${col.id}"
             value="${col.color}"
             title="Change color">
      <input type="text" class="column-setting-row__name-input"
             data-column-id="${col.id}"
             value="${col.name}"
             placeholder="Column name">
      ${isDefault ? '<span class="column-setting-row__badge">Default</span>' : ''}
      <button class="column-setting-row__delete"
              onclick="deleteColumn('${col.id}')"
              ${isDefault ? 'disabled' : ''}
              title="${isDefault ? 'Default columns cannot be deleted' : 'Delete column'}">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="3 6 5 6 21 6"/>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
        </svg>
      </button>
    `;

    // Drag events for reordering
    row.addEventListener('dragstart', handleColumnDragStart);
    row.addEventListener('dragend', handleColumnDragEnd);
    row.addEventListener('dragover', handleColumnDragOver);
    row.addEventListener('dragleave', handleColumnDragLeave);
    row.addEventListener('drop', handleColumnDrop);

    container.appendChild(row);
  });
}

function handleColumnDragStart(e) {
  settingsDraggedColumnId = e.currentTarget.dataset.columnId;
  e.currentTarget.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
}

function handleColumnDragEnd(e) {
  settingsDraggedColumnId = null;
  e.currentTarget.classList.remove('dragging');
  document.querySelectorAll('.column-setting-row').forEach(row => {
    row.classList.remove('drag-over');
  });
}

function handleColumnDragOver(e) {
  e.preventDefault();
  if (!settingsDraggedColumnId) return;
  if (e.currentTarget.dataset.columnId === settingsDraggedColumnId) return;

  e.currentTarget.classList.add('drag-over');
  e.dataTransfer.dropEffect = 'move';
}

function handleColumnDragLeave(e) {
  e.currentTarget.classList.remove('drag-over');
}

function handleColumnDrop(e) {
  e.preventDefault();
  const targetId = e.currentTarget.dataset.columnId;
  e.currentTarget.classList.remove('drag-over');

  if (!settingsDraggedColumnId || settingsDraggedColumnId === targetId) return;

  // Reorder columns
  const columns = projectData.workflow.columns;
  const draggedCol = columns.find(c => c.id === settingsDraggedColumnId);
  const targetCol = columns.find(c => c.id === targetId);

  if (!draggedCol || !targetCol) return;

  const oldPos = draggedCol.position;
  const newPos = targetCol.position;

  // Shift positions
  if (oldPos < newPos) {
    columns.forEach(c => {
      if (c.position > oldPos && c.position <= newPos) {
        c.position--;
      }
    });
  } else {
    columns.forEach(c => {
      if (c.position >= newPos && c.position < oldPos) {
        c.position++;
      }
    });
  }
  draggedCol.position = newPos;

  renderColumnSettings();
  settingsDraggedColumnId = null;
}

window.addNewColumn = function() {
  const columns = projectData.workflow.columns;

  // Find max position and insert before "done" column
  const doneColumn = columns.find(c => c.id === 'done');
  const insertPosition = doneColumn ? doneColumn.position : columns.length;

  // Shift done and any columns after it
  columns.forEach(c => {
    if (c.position >= insertPosition) {
      c.position++;
    }
  });

  // Add new column
  const newColumn = {
    id: generateColumnId(),
    name: 'New Column',
    color: '#7c7c8a',
    position: insertPosition
  };

  columns.push(newColumn);
  renderColumnSettings();

  // Focus the new column's name input
  setTimeout(() => {
    const input = document.querySelector(`input[data-column-id="${newColumn.id}"].column-setting-row__name-input`);
    if (input) {
      input.focus();
      input.select();
    }
  }, 50);
};

window.deleteColumn = function(columnId) {
  if (isDefaultColumn(columnId)) {
    statusManager.show('Default columns cannot be deleted', false);
    return;
  }

  const column = projectData.workflow.columns.find(c => c.id === columnId);
  if (!column) return;

  // Check if any tasks are in this column
  const tasksInColumn = projectData.tasks.filter(t => t.board?.columnId === columnId);
  if (tasksInColumn.length > 0) {
    if (!confirm(`This column has ${tasksInColumn.length} task(s). They will be moved to Backlog. Continue?`)) {
      return;
    }
    // Move tasks to backlog
    tasksInColumn.forEach(task => {
      task.board.columnId = 'backlog';
    });
  }

  const deletedPosition = column.position;

  // Remove column
  projectData.workflow.columns = projectData.workflow.columns.filter(c => c.id !== columnId);

  // Reposition remaining columns
  projectData.workflow.columns.forEach(c => {
    if (c.position > deletedPosition) {
      c.position--;
    }
  });

  renderColumnSettings();
};

window.closeSettings = function(skipConfirm = false) {
  if (!skipConfirm && hasSettingsChanged()) {
    if (!confirm('You have unsaved changes. Discard them?')) {
      return;
    }
    // Restore original column state
    if (settingsOriginalState) {
      projectData.workflow.columns = JSON.parse(JSON.stringify(settingsOriginalState.columns));
    }
  }

  settingsOriginalState = null;
  document.getElementById('settingsModal').classList.remove('active');
};

window.saveSettings = function() {
  saveState();

  projectData.project.title = document.getElementById('settingsTitle').value.trim() || 'Untitled Project';

  // Update column names and colors from inputs
  document.querySelectorAll('.column-setting-row__name-input').forEach(input => {
    const columnId = input.dataset.columnId;
    const name = input.value.trim() || 'Unnamed';
    updateColumn(projectData, columnId, { name });
  });

  document.querySelectorAll('.column-setting-row__color-input').forEach(input => {
    const columnId = input.dataset.columnId;
    const color = input.value;
    updateColumn(projectData, columnId, { color });
  });

  save();
  closeSettings(true); // Skip confirmation since we're saving
  renderApp();
  statusManager.show('Settings saved', true);
};

// ========== EDIT MODE ==========

window.toggleEditMode = function() {
  editMode = !editMode;
  document.body.classList.toggle('edit-mode', editMode);
  document.getElementById('editToggle').textContent = editMode ? 'View' : 'Edit';
  renderApp();
};

// ========== SEARCH/FILTER ==========

function filterTasks(query) {
  searchQuery = query.toLowerCase();
  renderApp();
}

function focusSearch() {
  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    searchInput.focus();
    searchInput.select();
  }
}

// ========== UNDO/REDO ==========

function undo() {
  const previousState = undoManager.undo(projectData);
  if (previousState) {
    projectData = previousState;
    save();
    renderApp();
    statusManager.show('Undone', true);
  } else {
    statusManager.show('Nothing to undo');
  }
}

function redo() {
  const nextState = undoManager.redo(projectData);
  if (nextState) {
    projectData = nextState;
    save();
    renderApp();
    statusManager.show('Redone', true);
  } else {
    statusManager.show('Nothing to redo');
  }
}

// ========== EXPORT/IMPORT ==========

window.exportToJSON = function() {
  const filename = sanitizeFilename(projectData.project.title);
  downloadJSON(projectData, filename);
  statusManager.show('JSON exported', true);
};

window.importProject = function() {
  document.getElementById('fileInput').click();
};

async function handleFileImport(e) {
  const file = e.target.files[0];
  if (!file) return;

  try {
    const imported = await readJSONFile(file);

    // Validate structure
    if (!imported.project || !imported.tasks || !imported.categories) {
      throw new Error('Invalid project file structure');
    }

    // Migrate to v6 if needed
    const migrated = migrateToV6(imported);
    migrated.version = DATA_VERSION;

    projectData = migrated;
    save();
    renderApp();
    statusManager.show('Imported', true);
  } catch (err) {
    alert('Failed to import: ' + err.message);
    statusManager.show('Import failed');
  }

  e.target.value = '';
}

// ========== CROSS-TAB SYNC ==========

function setupStorageSync() {
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY && e.newValue) {
      try {
        const newData = JSON.parse(e.newValue);
        if (newData.version >= DATA_VERSION) {
          projectData = newData;
          renderApp();
          statusManager.show('Synced from another tab', true);
        }
      } catch (err) {
        console.error('Failed to sync from storage event:', err);
      }
    }
  });
}

// ========== CLOSE MODALS ==========

function closeModals() {
  closeSettings();
  closeTaskEdit();
  closeNewTask();
  const searchInput = document.getElementById('searchInput');
  if (document.activeElement === searchInput) {
    searchInput.blur();
    searchInput.value = '';
    filterTasks('');
  }
}

// ========== EVENT LISTENERS ==========

function setupEventListeners() {
  // File input
  document.getElementById('fileInput').addEventListener('change', handleFileImport);

  // Modal overlays - close on background click
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target.classList.contains('modal-overlay')) {
        closeModals();
      }
    });
  });

  // New task Enter key
  document.getElementById('newTaskName').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') createNewTask();
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    const inInput = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA';

    if (e.key === 'Escape') {
      closeModals();
      return;
    }

    if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
      if (e.shiftKey) {
        redo();
      } else {
        undo();
      }
      e.preventDefault();
      return;
    }

    if (inInput) return;

    if (e.key === 'e' && !e.ctrlKey && !e.metaKey) {
      toggleEditMode();
      e.preventDefault();
    } else if (e.key === 'f' && !e.ctrlKey && !e.metaKey) {
      focusSearch();
      e.preventDefault();
    } else if (e.key === 's' && !e.ctrlKey && !e.metaKey) {
      exportToJSON();
      e.preventDefault();
    }
  });

  // Search input
  document.getElementById('searchInput').addEventListener('input', (e) => filterTasks(e.target.value));
}

// ========== EXPOSE GLOBAL FUNCTIONS ==========
// (Most are exposed via window.fn = fn pattern above)

// Initialize on load
init();
