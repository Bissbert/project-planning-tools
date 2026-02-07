/**
 * Sprint App Module - Init, state management, orchestration
 * Main entry point for the Sprint Planner application
 */

// Import shared modules
import { saveToStorage, loadFromStorage } from '../../../shared/js/storage.js';
import { createBackup } from '../../../shared/js/backup.js';
import { createUndoManager } from '../../../shared/js/undo.js';
import { downloadJSON, readJSONFile, sanitizeFilename } from '../../../shared/js/export.js';
import { createStatusManager } from '../../../shared/js/status.js';
import { initNavigation } from '../../../shared/js/navigation.js';

// Import unified data module
import {
  DATA_VERSION,
  STORAGE_KEY,
  BACKUP_KEY,
  migrateToLatest,
  cloneProjectData,
  defaultWorkflow,
  getCurrentWeek,
  generateSprintId,
  generateTaskId,
  getProductBacklog,
  getSprintTasks,
  calculateSprintPoints,
  calculateVelocity,
  getSprintWeekNumber
} from '../../../shared/js/unified-data.js';

// Import sprint modules
import { render } from './sprint-render.js';
import {
  addTask,
  updateTask,
  deleteTask,
  createSprint,
  updateSprint,
  deleteSprint,
  moveTaskToSprint,
  moveTaskToBacklog,
  reorderBacklogItem,
  reorderSprintItem,
  calculateDropPosition,
  showDropIndicator,
  hideDropIndicator
} from './sprint-edit.js';

// ========== APP STATE ==========

let projectData = null;
let editMode = false;
let activeSprintId = null;
let searchQuery = '';
let saveCount = 0;

// Drag state
let draggedTaskId = null;
let dragSource = null; // 'backlog' or 'sprint'

// Modal state
let currentEditTaskId = null;
let currentEditSprintId = null;

// Managers
let undoManager = null;
let statusManager = null;

// ========== INITIALIZATION ==========

export function init() {
  // Initialize managers
  undoManager = createUndoManager(50);
  statusManager = createStatusManager('status');

  // Initialize navigation
  initNavigation();

  // Load data
  loadData();

  // Setup event listeners
  setupEventListeners();

  // Setup cross-tab sync
  setupStorageSync();

  // Setup points selector handlers
  setupPointsSelectors();

  // Initial render
  renderApp();
}

function loadData() {
  const saved = loadFromStorage(STORAGE_KEY);

  if (saved) {
    try {
      // Migrate if needed
      if (!saved.version || saved.version < DATA_VERSION) {
        projectData = migrateToLatest(saved);
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

  // Ensure sprints array exists
  if (!projectData.sprints) {
    projectData.sprints = [];
  }

  // Set active sprint to the first non-completed sprint, or null
  const nonCompleted = projectData.sprints.filter(s => s.status !== 'completed');
  activeSprintId = nonCompleted.length > 0 ? nonCompleted[0].id : null;

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
  render(projectData, editMode, activeSprintId, searchQuery, getHandlers());
}

// ========== EVENT HANDLERS OBJECT ==========

function getHandlers() {
  return {
    // Task events
    onTaskClick: (taskId) => openTaskEdit(taskId),
    onDeleteTask: (taskId) => handleDeleteTask(taskId),

    // Sprint events
    onSprintTabClick: (sprintId) => {
      activeSprintId = sprintId;
      renderApp();
    },
    onSprintEdit: (sprintId) => openSprintEdit(sprintId),

    // Drag events
    onDragStart: (e, taskId, source) => handleDragStart(e, taskId, source),
    onDragEnd: (e) => handleDragEnd(e),
    onDragOverBacklog: (e) => handleDragOverBacklog(e),
    onDragLeaveBacklog: (e) => handleDragLeaveBacklog(e),
    onDropBacklog: (e) => handleDropBacklog(e),
    onDragOverSprint: (e, sprintId) => handleDragOverSprint(e, sprintId),
    onDragLeaveSprint: (e, sprintId) => handleDragLeaveSprint(e, sprintId),
    onDropSprint: (e, sprintId) => handleDropSprint(e, sprintId),

    // Move task to backlog
    onMoveToBacklog: (taskId) => handleMoveToBacklog(taskId)
  };
}

// ========== TASK HANDLERS ==========

function handleDeleteTask(taskId) {
  if (!editMode) return;
  if (confirm('Delete this task?')) {
    saveState();
    if (deleteTask(projectData, taskId)) {
      save();
      renderApp();
      statusManager.show('Task deleted', true);
    }
  }
}

function handleMoveToBacklog(taskId) {
  if (!editMode) return;
  saveState();
  if (moveTaskToBacklog(projectData, taskId)) {
    save();
    renderApp();
    statusManager.show('Moved to backlog', true);
  }
}

// ========== DRAG AND DROP ==========

function handleDragStart(e, taskId, source) {
  if (!editMode) {
    e.preventDefault();
    return;
  }

  draggedTaskId = taskId;
  dragSource = source;
  e.target.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', taskId);
}

function handleDragEnd(e) {
  draggedTaskId = null;
  dragSource = null;
  e.target.classList.remove('dragging');

  // Clean up all drop indicators
  document.querySelectorAll('.backlog-list, .sprint-tasks').forEach(area => {
    area.classList.remove('drag-over');
    hideDropIndicator(area);
  });
}

function handleDragOverBacklog(e) {
  if (!draggedTaskId) return;

  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';

  const backlogList = document.getElementById('backlogList');
  backlogList.classList.add('drag-over');

  const position = calculateDropPosition(backlogList, e.clientY, '.backlog-item');
  showDropIndicator(backlogList, position, '.backlog-item');
}

function handleDragLeaveBacklog(e) {
  const backlogList = document.getElementById('backlogList');
  if (!backlogList.contains(e.relatedTarget)) {
    backlogList.classList.remove('drag-over');
    hideDropIndicator(backlogList);
  }
}

function handleDropBacklog(e) {
  e.preventDefault();

  if (!draggedTaskId) return;

  const backlogList = document.getElementById('backlogList');
  backlogList.classList.remove('drag-over');
  hideDropIndicator(backlogList);

  const position = calculateDropPosition(backlogList, e.clientY, '.backlog-item');

  saveState();

  if (dragSource === 'sprint') {
    // Moving from sprint to backlog
    moveTaskToBacklog(projectData, draggedTaskId, position);
    statusManager.show('Moved to backlog', true);
  } else {
    // Reordering within backlog
    reorderBacklogItem(projectData, draggedTaskId, position);
    statusManager.show('Reordered', true);
  }

  save();
  renderApp();

  draggedTaskId = null;
  dragSource = null;
}

function handleDragOverSprint(e, sprintId) {
  if (!draggedTaskId) return;

  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';

  const sprintTasks = e.currentTarget;
  sprintTasks.classList.add('drag-over');

  const position = calculateDropPosition(sprintTasks, e.clientY, '.sprint-task');
  showDropIndicator(sprintTasks, position, '.sprint-task');
}

function handleDragLeaveSprint(e, sprintId) {
  const sprintTasks = e.currentTarget;
  if (!sprintTasks.contains(e.relatedTarget)) {
    sprintTasks.classList.remove('drag-over');
    hideDropIndicator(sprintTasks);
  }
}

function handleDropSprint(e, sprintId) {
  e.preventDefault();

  if (!draggedTaskId) return;

  const sprintTasks = e.currentTarget;
  sprintTasks.classList.remove('drag-over');
  hideDropIndicator(sprintTasks);

  const position = calculateDropPosition(sprintTasks, e.clientY, '.sprint-task');

  saveState();

  if (dragSource === 'backlog') {
    // Moving from backlog to sprint
    moveTaskToSprint(projectData, draggedTaskId, sprintId, position);
    statusManager.show('Added to sprint', true);
  } else if (dragSource === 'sprint') {
    // Moving within or between sprints
    const task = projectData.tasks.find(t => t.id === draggedTaskId);
    if (task && task.sprintId === sprintId) {
      // Reordering within same sprint
      reorderSprintItem(projectData, draggedTaskId, position);
      statusManager.show('Reordered', true);
    } else {
      // Moving to different sprint
      moveTaskToSprint(projectData, draggedTaskId, sprintId, position);
      statusManager.show('Moved to sprint', true);
    }
  }

  save();
  renderApp();

  draggedTaskId = null;
  dragSource = null;
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

  // Story points
  setSelectedPoints('pointsSelector', 'taskEditPoints', task.storyPoints);
  document.querySelectorAll('#pointsSelector .points-btn').forEach(btn => {
    btn.disabled = !editMode;
  });

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

  document.getElementById('taskEditNotes').value = task.notes || '';
  document.getElementById('taskEditNotes').disabled = !editMode;

  // Kanban column
  const columnSelect = document.getElementById('taskEditColumn');
  columnSelect.innerHTML = '';
  columnSelect.disabled = !editMode;
  (projectData.workflow?.columns || []).forEach(col => {
    const opt = document.createElement('option');
    opt.value = col.id;
    opt.textContent = col.name;
    if (col.id === task.board?.columnId) opt.selected = true;
    columnSelect.appendChild(opt);
  });

  document.getElementById('taskEditModal').classList.add('active');
}

window.closeTaskEdit = function() {
  document.getElementById('taskEditModal').classList.remove('active');
  currentEditTaskId = null;
};

window.saveTaskEdit = function() {
  if (!currentEditTaskId) return;

  const points = document.getElementById('taskEditPoints').value;

  saveState();

  updateTask(projectData, currentEditTaskId, {
    name: document.getElementById('taskEditName').value,
    storyPoints: points === '' ? null : parseInt(points),
    category: document.getElementById('taskEditCategory').value,
    assignee: document.getElementById('taskEditAssignee').value,
    priority: document.getElementById('taskEditPriority').value,
    notes: document.getElementById('taskEditNotes').value,
    columnId: document.getElementById('taskEditColumn').value
  });

  save();
  closeTaskEdit();
  renderApp();
  statusManager.show('Task updated', true);
};

window.deleteCurrentTask = function() {
  if (!currentEditTaskId || !editMode) return;
  handleDeleteTask(currentEditTaskId);
  closeTaskEdit();
};

// ========== NEW TASK MODAL ==========

window.openNewTask = function() {
  if (!editMode) return;

  document.getElementById('newTaskName').value = '';
  setSelectedPoints('newPointsSelector', 'newTaskPoints', null);

  // Category dropdown
  const categorySelect = document.getElementById('newTaskCategory');
  categorySelect.innerHTML = '';
  Object.keys(projectData.categories).forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat;
    opt.textContent = cat;
    categorySelect.appendChild(opt);
  });

  document.getElementById('newTaskModal').classList.add('active');
  document.getElementById('newTaskName').focus();
};

window.closeNewTask = function() {
  document.getElementById('newTaskModal').classList.remove('active');
};

window.createNewTask = function() {
  const name = document.getElementById('newTaskName').value.trim();
  if (!name) {
    statusManager.show('Enter a task name');
    return;
  }

  const points = document.getElementById('newTaskPoints').value;

  saveState();
  const newTask = addTask(projectData, {
    name,
    category: document.getElementById('newTaskCategory').value,
    storyPoints: points === '' ? null : parseInt(points)
  });

  if (newTask) {
    save();
    closeNewTask();
    renderApp();
    statusManager.show('Task created', true);
  }
};

// ========== SPRINT EDIT MODAL ==========

window.openNewSprint = function() {
  if (!editMode) return;

  currentEditSprintId = null;

  document.getElementById('sprintEditTitle').textContent = 'New Sprint';
  document.getElementById('sprintEditName').value = `Sprint ${projectData.sprints.length + 1}`;
  document.getElementById('sprintEditGoal').value = '';
  document.getElementById('sprintEditStatus').value = 'planning';

  // Calculate default weeks based on last sprint's end date
  const lastSprint = projectData.sprints[projectData.sprints.length - 1];
  let defaultStartWeek = 1;
  if (lastSprint && lastSprint.endDate && projectData.project?.startDate) {
    // Calculate week from last sprint's end date
    const projStart = new Date(projectData.project.startDate);
    const lastEnd = new Date(lastSprint.endDate);
    const diffDays = Math.floor((lastEnd - projStart) / (1000 * 60 * 60 * 24));
    defaultStartWeek = Math.floor(diffDays / 7) + 2; // +2 to start after end week
  }
  document.getElementById('sprintEditStartWeek').value = defaultStartWeek;
  document.getElementById('sprintEditEndWeek').value = defaultStartWeek + 1;

  // Hide action buttons for new sprint
  document.getElementById('startSprintBtn').style.display = 'none';
  document.getElementById('completeSprintBtn').style.display = 'none';
  document.getElementById('deleteSprintBtn').style.display = 'none';

  document.getElementById('sprintEditModal').classList.add('active');
  document.getElementById('sprintEditName').focus();
};

function openSprintEdit(sprintId) {
  if (!editMode) return;

  const sprint = projectData.sprints.find(s => s.id === sprintId);
  if (!sprint) return;

  currentEditSprintId = sprintId;

  document.getElementById('sprintEditTitle').textContent = 'Edit Sprint';
  document.getElementById('sprintEditName').value = sprint.name;
  document.getElementById('sprintEditGoal').value = sprint.goal || '';
  document.getElementById('sprintEditStatus').value = sprint.status;

  // Convert sprint dates to week numbers for display
  let startWeek = 1;
  let endWeek = 2;
  if (sprint.startDate && projectData.project?.startDate) {
    startWeek = getSprintWeekNumber(sprint, projectData.project);
  }
  if (sprint.endDate && projectData.project?.startDate) {
    const projStart = new Date(projectData.project.startDate);
    const sprintEnd = new Date(sprint.endDate);
    const diffDays = Math.floor((sprintEnd - projStart) / (1000 * 60 * 60 * 24));
    endWeek = Math.floor(diffDays / 7) + 1;
  }
  document.getElementById('sprintEditStartWeek').value = startWeek;
  document.getElementById('sprintEditEndWeek').value = endWeek;

  // Show/hide action buttons based on status
  document.getElementById('startSprintBtn').style.display = sprint.status === 'planning' ? '' : 'none';
  document.getElementById('completeSprintBtn').style.display = sprint.status === 'active' ? '' : 'none';
  document.getElementById('deleteSprintBtn').style.display = '';

  document.getElementById('sprintEditModal').classList.add('active');
}

window.closeSprintEdit = function() {
  document.getElementById('sprintEditModal').classList.remove('active');
  currentEditSprintId = null;
};

window.saveSprint = function() {
  const name = document.getElementById('sprintEditName').value.trim();
  if (!name) {
    statusManager.show('Enter a sprint name');
    return;
  }

  const sprintData = {
    name,
    goal: document.getElementById('sprintEditGoal').value.trim(),
    startWeek: parseInt(document.getElementById('sprintEditStartWeek').value) || 1,
    endWeek: parseInt(document.getElementById('sprintEditEndWeek').value) || 2,
    status: document.getElementById('sprintEditStatus').value
  };

  saveState();

  if (currentEditSprintId) {
    updateSprint(projectData, currentEditSprintId, sprintData);
    statusManager.show('Sprint updated', true);
  } else {
    const newSprint = createSprint(projectData, sprintData);
    activeSprintId = newSprint.id;
    statusManager.show('Sprint created', true);
  }

  save();
  closeSprintEdit();
  renderApp();
};

window.startSprint = function() {
  if (!currentEditSprintId) return;

  saveState();
  updateSprint(projectData, currentEditSprintId, { status: 'active' });
  save();
  closeSprintEdit();
  renderApp();
  statusManager.show('Sprint started', true);
};

window.completeSprint = function() {
  if (!currentEditSprintId) return;

  saveState();
  updateSprint(projectData, currentEditSprintId, { status: 'completed' });

  // Select next sprint or null
  const remaining = projectData.sprints.filter(s => s.status !== 'completed' && s.id !== currentEditSprintId);
  activeSprintId = remaining.length > 0 ? remaining[0].id : null;

  save();
  closeSprintEdit();
  renderApp();
  statusManager.show('Sprint completed', true);
};

window.deleteSprint = function() {
  if (!currentEditSprintId || !editMode) return;

  const sprint = projectData.sprints.find(s => s.id === currentEditSprintId);
  if (!sprint) return;

  const tasksInSprint = projectData.tasks.filter(t => t.sprintId === currentEditSprintId);
  const message = tasksInSprint.length > 0
    ? `Delete "${sprint.name}"? ${tasksInSprint.length} task(s) will be moved back to backlog.`
    : `Delete "${sprint.name}"?`;

  if (confirm(message)) {
    saveState();
    deleteSprint(projectData, currentEditSprintId);

    // Select another sprint
    if (activeSprintId === currentEditSprintId) {
      const remaining = projectData.sprints.filter(s => s.status !== 'completed');
      activeSprintId = remaining.length > 0 ? remaining[0].id : null;
    }

    save();
    closeSprintEdit();
    renderApp();
    statusManager.show('Sprint deleted', true);
  }
};

// ========== SETTINGS MODAL ==========

window.openSettings = function() {
  document.getElementById('settingsTitle').value = projectData.project.title;
  document.getElementById('settingsModal').classList.add('active');
};

window.closeSettings = function() {
  document.getElementById('settingsModal').classList.remove('active');
};

window.saveSettings = function() {
  saveState();

  projectData.project.title = document.getElementById('settingsTitle').value.trim() || 'Untitled Project';

  save();
  closeSettings();
  renderApp();
  statusManager.show('Settings saved', true);
};

// ========== POINTS SELECTOR ==========

function setupPointsSelectors() {
  setupPointsSelector('pointsSelector', 'taskEditPoints');
  setupPointsSelector('newPointsSelector', 'newTaskPoints');
}

function setupPointsSelector(selectorId, inputId) {
  const selector = document.getElementById(selectorId);
  if (!selector) return;

  selector.addEventListener('click', (e) => {
    const btn = e.target.closest('.points-btn');
    if (!btn || btn.disabled) return;

    // Update selection
    selector.querySelectorAll('.points-btn').forEach(b => b.classList.remove('points-btn--selected'));
    btn.classList.add('points-btn--selected');

    // Update hidden input
    document.getElementById(inputId).value = btn.dataset.points;
  });
}

function setSelectedPoints(selectorId, inputId, points) {
  const selector = document.getElementById(selectorId);
  const input = document.getElementById(inputId);
  if (!selector || !input) return;

  const value = points === null || points === undefined ? '' : String(points);
  input.value = value;

  selector.querySelectorAll('.points-btn').forEach(btn => {
    btn.classList.toggle('points-btn--selected', btn.dataset.points === value);
  });
}

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
  const filename = sanitizeFilename(projectData.project.title || projectData.project.name || "project");
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

    // Migrate to v9 if needed
    const migrated = migrateToLatest(imported);
    migrated.version = DATA_VERSION;

    projectData = migrated;

    // Reset active sprint
    const nonCompleted = projectData.sprints.filter(s => s.status !== 'completed');
    activeSprintId = nonCompleted.length > 0 ? nonCompleted[0].id : null;

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

          // Update active sprint if it no longer exists
          if (activeSprintId && !projectData.sprints.find(s => s.id === activeSprintId)) {
            const nonCompleted = projectData.sprints.filter(s => s.status !== 'completed');
            activeSprintId = nonCompleted.length > 0 ? nonCompleted[0].id : null;
          }

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
  closeSprintEdit();
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

  // Sprint name Enter key
  document.getElementById('sprintEditName').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') saveSprint();
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
    } else if (e.key === 'n' && !e.ctrlKey && !e.metaKey && editMode) {
      openNewTask();
      e.preventDefault();
    }
  });

  // Search input
  document.getElementById('searchInput').addEventListener('input', (e) => filterTasks(e.target.value));

  // Backlog drag events
  const backlogList = document.getElementById('backlogList');
  backlogList.addEventListener('dragover', (e) => handleDragOverBacklog(e));
  backlogList.addEventListener('dragleave', (e) => handleDragLeaveBacklog(e));
  backlogList.addEventListener('drop', (e) => handleDropBacklog(e));
}

// ========== INITIALIZE ==========

init();
