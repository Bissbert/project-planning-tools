/**
 * Burndown App Module - Init, state management, orchestration
 * Main entry point for the Burndown Chart application
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
  calculateVelocity,
  getBurndownData
} from '../../../shared/js/unified-data.js';

// Import burndown modules
import { render, renderSprintSelector, renderSidebar, renderSprintDetails } from './burndown-render.js';
import { renderChart, exportChartAsImage } from './burndown-chart.js';

// ========== APP STATE ==========

let projectData = null;
let editMode = false;
let selectedSprintId = null;
let displayMode = 'points'; // 'points' or 'tasks'
let saveCount = 0;

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

  // Note: Burndown is now calculated dynamically from task.completedAt timestamps
  // No snapshot recording needed - data is always current

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

  // Select active sprint, or first non-completed, or first sprint
  const activeSprint = projectData.sprints.find(s => s.status === 'active');
  if (activeSprint) {
    selectedSprintId = activeSprint.id;
  } else {
    const nonCompleted = projectData.sprints.filter(s => s.status !== 'completed');
    selectedSprintId = nonCompleted.length > 0 ? nonCompleted[0].id :
                       (projectData.sprints.length > 0 ? projectData.sprints[0].id : null);
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
  // Update header
  document.getElementById('projectTitle').textContent = projectData.project.title;

  // Get selected sprint
  const sprint = projectData.sprints.find(s => s.id === selectedSprintId);

  // Update stats
  if (sprint) {
    const burndownData = getBurndownData(sprint, projectData.project, projectData.tasks);
    const remaining = displayMode === 'points'
      ? burndownData.currentRemaining.points
      : burndownData.currentRemaining.tasks;
    document.getElementById('remainingPoints').textContent = remaining;
    document.getElementById('daysRemaining').textContent = burndownData.daysRemaining;
  } else {
    document.getElementById('remainingPoints').textContent = '-';
    document.getElementById('daysRemaining').textContent = '-';
  }

  // Render sprint selector
  renderSprintSelector(projectData.sprints, selectedSprintId, handleSprintSelect);

  // Render chart
  const chartEmpty = document.getElementById('chartEmpty');
  if (sprint) {
    const burndownData = getBurndownData(sprint, projectData.project, projectData.tasks);
    renderChart(burndownData, displayMode);
    chartEmpty.classList.add('hidden');

    // Update chart wrapper data attribute for print
    document.querySelector('.chart-wrapper').setAttribute('data-title',
      `${projectData.project.title} - ${sprint.name} Burndown`);
  } else {
    chartEmpty.classList.remove('hidden');
    // Clear the chart
    document.getElementById('burndownChart').innerHTML = '';
  }

  // Render sidebar
  renderSprintDetails(sprint, projectData.project, projectData.tasks, displayMode);
  renderSidebar(projectData.sprints, projectData.tasks, selectedSprintId);

  // Update mode buttons
  document.getElementById('modePoints').classList.toggle('mode-btn--active', displayMode === 'points');
  document.getElementById('modeTasks').classList.toggle('mode-btn--active', displayMode === 'tasks');
}

// ========== SPRINT SELECTION ==========

function handleSprintSelect(sprintId) {
  selectedSprintId = sprintId;
  renderApp();
}

// ========== MODE TOGGLE ==========

function setDisplayMode(mode) {
  displayMode = mode;
  renderApp();
}

// ========== EDIT MODE ==========

window.toggleEditMode = function() {
  editMode = !editMode;
  document.body.classList.toggle('edit-mode', editMode);
  document.getElementById('editToggle').textContent = editMode ? 'View' : 'Edit';
  renderApp();
};

// ========== SYNC MODAL ==========

window.openSnapshotModal = function() {
  if (!editMode) return;

  const sprint = projectData.sprints.find(s => s.id === selectedSprintId);
  if (!sprint) {
    statusManager.show('No sprint selected');
    return;
  }

  const today = new Date().toISOString().split('T')[0];
  const sprintTasks = projectData.tasks.filter(t => t.sprintId === sprint.id);
  const remaining = sprintTasks.filter(t => t.board?.columnId !== 'done');
  const remainingPoints = remaining.reduce((sum, t) => sum + (t.storyPoints || 0), 0);
  const remainingTasks = remaining.length;

  // Check for tasks missing completedAt
  const doneTasks = sprintTasks.filter(t => t.board?.columnId === 'done');
  const missingTimestamps = doneTasks.filter(t => !t.completedAt);

  document.getElementById('snapshotDate').textContent = today;
  document.getElementById('snapshotPoints').textContent = `${remainingPoints} pts`;
  document.getElementById('snapshotTasks').textContent = remainingTasks;

  document.getElementById('snapshotModal').classList.add('active');
};

window.closeSnapshotModal = function() {
  document.getElementById('snapshotModal').classList.remove('active');
};

window.recordSnapshot = function() {
  const sprint = projectData.sprints.find(s => s.id === selectedSprintId);
  if (!sprint) return;

  saveState();

  // Sync completedAt timestamps for any done tasks missing them
  const sprintTasks = projectData.tasks.filter(t => t.sprintId === sprint.id);
  let synced = 0;
  sprintTasks.forEach(task => {
    if (task.board?.columnId === 'done' && !task.completedAt) {
      task.completedAt = new Date().toISOString();
      synced++;
    }
  });

  save();
  closeSnapshotModal();
  renderApp();
  statusManager.show(synced > 0 ? `Synced ${synced} tasks` : 'Already synced', true);
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

// ========== EXPORT ==========

window.exportToJSON = function() {
  const filename = sanitizeFilename(projectData.project.title);
  downloadJSON(projectData, filename);
  statusManager.show('JSON exported', true);
};

window.exportChart = function() {
  const sprint = projectData.sprints.find(s => s.id === selectedSprintId);
  if (!sprint) {
    statusManager.show('No sprint selected');
    return;
  }

  const filename = sanitizeFilename(`${projectData.project.title}-${sprint.name}-burndown`);
  exportChartAsImage(filename);
  statusManager.show('Chart exported', true);
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

    // Reset selected sprint
    const activeSprint = projectData.sprints.find(s => s.status === 'active');
    selectedSprintId = activeSprint ? activeSprint.id :
                       (projectData.sprints.length > 0 ? projectData.sprints[0].id : null);

    save();
    renderApp();
    statusManager.show('Imported', true);
  } catch (err) {
    alert('Failed to import: ' + err.message);
    statusManager.show('Import failed');
  }

  e.target.value = '';
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

// ========== CROSS-TAB SYNC ==========

function setupStorageSync() {
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY && e.newValue) {
      try {
        const newData = JSON.parse(e.newValue);
        if (newData.version >= DATA_VERSION) {
          projectData = newData;

          // Update selected sprint if it no longer exists
          if (selectedSprintId && !projectData.sprints.find(s => s.id === selectedSprintId)) {
            const activeSprint = projectData.sprints.find(s => s.status === 'active');
            selectedSprintId = activeSprint ? activeSprint.id :
                               (projectData.sprints.length > 0 ? projectData.sprints[0].id : null);
          }

          // Burndown is calculated dynamically, just re-render
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
  closeSnapshotModal();
}

// ========== EVENT LISTENERS ==========

function setupEventListeners() {
  // File input
  document.getElementById('fileInput').addEventListener('change', handleFileImport);

  // Mode toggle buttons
  document.getElementById('modePoints').addEventListener('click', () => setDisplayMode('points'));
  document.getElementById('modeTasks').addEventListener('click', () => setDisplayMode('tasks'));

  // Modal overlays - close on background click
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target.classList.contains('modal-overlay')) {
        closeModals();
      }
    });
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
    } else if (e.key === 's' && !e.ctrlKey && !e.metaKey) {
      exportToJSON();
      e.preventDefault();
    } else if (e.key === 'p' && !e.ctrlKey && !e.metaKey) {
      setDisplayMode('points');
      e.preventDefault();
    } else if (e.key === 't' && !e.ctrlKey && !e.metaKey) {
      setDisplayMode('tasks');
      e.preventDefault();
    } else if (e.key === 'r' && !e.ctrlKey && !e.metaKey && editMode) {
      openSnapshotModal();
      e.preventDefault();
    }
  });

  // Window resize - re-render chart
  let resizeTimeout;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      renderApp();
    }, 200);
  });
}

// ========== INITIALIZE ==========

init();
