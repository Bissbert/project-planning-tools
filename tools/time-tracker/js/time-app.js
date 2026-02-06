/**
 * Time Tracker App Module - Init, state, timer logic, orchestration
 * Main entry point for the Time Tracker application
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
  migrateToV7,
  cloneProjectData,
  defaultWorkflow,
  formatTimerDisplay,
  getWeekStart,
  getWeekEnd
} from '../../../shared/js/unified-data.js';

// Import time tracker modules
import { render } from './time-render.js';
import {
  addTimeEntry,
  updateTimeEntry,
  deleteTimeEntry,
  calculateDuration,
  getCurrentTime,
  getTodayDate,
  formatDateDisplay
} from './time-edit.js';

// ========== APP STATE ==========

let projectData = null;
let editMode = false;
let activeView = 'today'; // 'today', 'week', 'reports'
let selectedDate = new Date();
let searchQuery = '';
let saveCount = 0;

// Timer state (MEMORY ONLY - not persisted)
let timerState = {
  isRunning: false,
  isPaused: false,
  taskId: null,
  startTime: null,
  pausedTime: null,
  accumulatedMs: 0
};

let timerInterval = null;

// Modal state
let currentEditEntryId = null;

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

  // Initial render
  renderApp();
}

function loadData() {
  const saved = loadFromStorage(STORAGE_KEY);

  if (saved) {
    try {
      // Migrate if needed
      if (!saved.version || saved.version < DATA_VERSION) {
        console.log('Migrating data to v7 format...');
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

  // Ensure timeEntries array exists
  if (!projectData.timeEntries) {
    projectData.timeEntries = [];
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
  render(projectData, editMode, activeView, selectedDate, searchQuery, getHandlers());
}

function getHandlers() {
  return {
    onEntryClick: (entryId) => openEntryEdit(entryId),
    onDeleteEntry: (entryId) => deleteEntry(entryId)
  };
}

// ========== TIMER FUNCTIONS ==========

window.startTimer = function() {
  if (!editMode) {
    statusManager.show('Enable edit mode to start timer');
    return;
  }

  if (timerState.isRunning) return;

  timerState.isRunning = true;
  timerState.isPaused = false;
  timerState.startTime = new Date();
  timerState.accumulatedMs = 0;
  timerState.taskId = document.getElementById('timerTaskSelect').value || null;

  startTimerInterval();
  updateTimerUI();
  statusManager.show('Timer started', true);
};

window.pauseTimer = function() {
  if (!timerState.isRunning || timerState.isPaused) return;

  timerState.isPaused = true;
  timerState.pausedTime = new Date();
  timerState.accumulatedMs += timerState.pausedTime - timerState.startTime;

  stopTimerInterval();
  updateTimerUI();
  statusManager.show('Timer paused', true);
};

window.resumeTimer = function() {
  if (!timerState.isRunning || !timerState.isPaused) return;

  timerState.isPaused = false;
  timerState.startTime = new Date();
  timerState.pausedTime = null;

  startTimerInterval();
  updateTimerUI();
  statusManager.show('Timer resumed', true);
};

window.stopTimer = function() {
  if (!timerState.isRunning) return;

  // Calculate final duration
  let totalMs = timerState.accumulatedMs;
  if (!timerState.isPaused) {
    totalMs += new Date() - timerState.startTime;
  }

  const totalMinutes = Math.round(totalMs / 60000);

  if (totalMinutes < 1) {
    statusManager.show('Entry too short (< 1 minute)');
    resetTimer();
    return;
  }

  // Create entry
  const now = new Date();
  const startMs = now.getTime() - totalMs;
  const startDate = new Date(startMs);
  const endDate = now;

  // Format times
  const startTime = startDate.toTimeString().slice(0, 5);
  const endTime = endDate.toTimeString().slice(0, 5);
  const date = startDate.toISOString().split('T')[0];

  saveState();
  const entry = addTimeEntry(projectData, {
    taskId: timerState.taskId,
    date,
    startTime,
    endTime,
    notes: '',
    billable: false
  });

  if (entry) {
    save();
    statusManager.show(`Logged ${formatTimerDisplay(Math.round(totalMs / 1000))}`, true);
  }

  resetTimer();
  renderApp();
};

function startTimerInterval() {
  stopTimerInterval();
  timerInterval = setInterval(updateTimerDisplay, 1000);
}

function stopTimerInterval() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

function resetTimer() {
  stopTimerInterval();
  timerState = {
    isRunning: false,
    isPaused: false,
    taskId: null,
    startTime: null,
    pausedTime: null,
    accumulatedMs: 0
  };
  updateTimerUI();
}

function updateTimerDisplay() {
  let totalMs = timerState.accumulatedMs;
  if (timerState.isRunning && !timerState.isPaused) {
    totalMs += new Date() - timerState.startTime;
  }

  const totalSeconds = Math.floor(totalMs / 1000);
  document.getElementById('timerDisplay').textContent = formatTimerDisplay(totalSeconds);
}

function updateTimerUI() {
  const display = document.getElementById('timerDisplay');
  const status = document.getElementById('timerStatus');
  const startBtn = document.getElementById('timerStartBtn');
  const pauseBtn = document.getElementById('timerPauseBtn');
  const resumeBtn = document.getElementById('timerResumeBtn');
  const stopBtn = document.getElementById('timerStopBtn');

  // Reset classes
  display.classList.remove('timer-display--running', 'timer-display--paused');
  status.classList.remove('timer-status--running', 'timer-status--paused');

  if (timerState.isRunning) {
    if (timerState.isPaused) {
      status.textContent = 'Paused';
      status.classList.add('timer-status--paused');
      display.classList.add('timer-display--paused');
      startBtn.style.display = 'none';
      pauseBtn.style.display = 'none';
      resumeBtn.style.display = 'flex';
      stopBtn.style.display = 'flex';
    } else {
      status.textContent = 'Running';
      status.classList.add('timer-status--running');
      display.classList.add('timer-display--running');
      startBtn.style.display = 'none';
      pauseBtn.style.display = 'flex';
      resumeBtn.style.display = 'none';
      stopBtn.style.display = 'flex';
    }
  } else {
    status.textContent = 'Stopped';
    display.textContent = '00:00:00';
    startBtn.style.display = 'flex';
    pauseBtn.style.display = 'none';
    resumeBtn.style.display = 'none';
    stopBtn.style.display = 'none';
  }
}

// ========== QUICK ADD ==========

window.quickAddEntry = function() {
  if (!editMode) {
    statusManager.show('Enable edit mode to add entries');
    return;
  }

  const startTime = document.getElementById('quickAddStart').value;
  const endTime = document.getElementById('quickAddEnd').value;
  const taskId = document.getElementById('quickAddTask').value || null;
  const notes = document.getElementById('quickAddNotes').value;

  if (!startTime || !endTime) {
    statusManager.show('Enter start and end times');
    return;
  }

  saveState();
  const entry = addTimeEntry(projectData, {
    taskId,
    date: getTodayDate(),
    startTime,
    endTime,
    notes,
    billable: false
  });

  if (entry) {
    save();
    renderApp();

    // Clear form
    document.getElementById('quickAddStart').value = '';
    document.getElementById('quickAddEnd').value = '';
    document.getElementById('quickAddNotes').value = '';

    statusManager.show('Entry added', true);
  } else {
    statusManager.show('Invalid entry data');
  }
};

// ========== ENTRY EDIT MODAL ==========

window.openEntryEdit = function(entryId) {
  const entry = projectData.timeEntries.find(e => e.id === entryId);
  if (!entry) return;

  currentEditEntryId = entryId;

  document.getElementById('entryEditTitle').textContent = editMode ? 'Edit Entry' : 'Entry Details';
  document.getElementById('entryEditDate').value = entry.date;
  document.getElementById('entryEditDate').disabled = !editMode;
  document.getElementById('entryEditStartTime').value = entry.startTime;
  document.getElementById('entryEditStartTime').disabled = !editMode;
  document.getElementById('entryEditEndTime').value = entry.endTime;
  document.getElementById('entryEditEndTime').disabled = !editMode;
  document.getElementById('entryEditTask').value = entry.taskId || '';
  document.getElementById('entryEditTask').disabled = !editMode;
  document.getElementById('entryEditNotes').value = entry.notes || '';
  document.getElementById('entryEditNotes').disabled = !editMode;
  document.getElementById('entryEditBillable').checked = entry.billable || false;
  document.getElementById('entryEditBillable').disabled = !editMode;

  updateDurationDisplay();

  document.getElementById('entryEditModal').classList.add('active');
};

function updateDurationDisplay() {
  const startTime = document.getElementById('entryEditStartTime').value;
  const endTime = document.getElementById('entryEditEndTime').value;
  const duration = calculateDuration(startTime, endTime);

  const hours = Math.floor(duration / 60);
  const minutes = duration % 60;
  const display = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;

  document.getElementById('entryEditDuration').textContent = display;
}

window.closeEntryEdit = function() {
  document.getElementById('entryEditModal').classList.remove('active');
  currentEditEntryId = null;
};

window.saveEntryEdit = function() {
  if (!currentEditEntryId) return;

  saveState();

  updateTimeEntry(projectData, currentEditEntryId, {
    date: document.getElementById('entryEditDate').value,
    startTime: document.getElementById('entryEditStartTime').value,
    endTime: document.getElementById('entryEditEndTime').value,
    taskId: document.getElementById('entryEditTask').value || null,
    notes: document.getElementById('entryEditNotes').value,
    billable: document.getElementById('entryEditBillable').checked
  });

  save();
  closeEntryEdit();
  renderApp();
  statusManager.show('Entry updated', true);
};

window.deleteCurrentEntry = function() {
  if (!currentEditEntryId || !editMode) return;
  deleteEntry(currentEditEntryId);
  closeEntryEdit();
};

window.deleteEntry = function(entryId) {
  if (!editMode) return;

  if (confirm('Delete this entry?')) {
    saveState();
    if (deleteTimeEntry(projectData, entryId)) {
      save();
      renderApp();
      statusManager.show('Entry deleted', true);
    }
  }
};

// ========== VIEW NAVIGATION ==========

window.setView = function(view) {
  activeView = view;
  renderApp();
};

window.navigatePrev = function() {
  if (activeView === 'today') {
    selectedDate.setDate(selectedDate.getDate() - 1);
  } else if (activeView === 'week') {
    selectedDate.setDate(selectedDate.getDate() - 7);
  }
  renderApp();
};

window.navigateNext = function() {
  if (activeView === 'today') {
    selectedDate.setDate(selectedDate.getDate() + 1);
  } else if (activeView === 'week') {
    selectedDate.setDate(selectedDate.getDate() + 7);
  }
  renderApp();
};

window.navigateToday = function() {
  selectedDate = new Date();
  renderApp();
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

// ========== EDIT MODE ==========

window.toggleEditMode = function() {
  editMode = !editMode;
  document.body.classList.toggle('edit-mode', editMode);
  document.getElementById('editToggle').textContent = editMode ? 'View' : 'Edit';
  renderApp();
};

// ========== SEARCH/FILTER ==========

function filterEntries(query) {
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

    // Migrate to v7 if needed
    const migrated = migrateToV7(imported);
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
  closeEntryEdit();
  const searchInput = document.getElementById('searchInput');
  if (document.activeElement === searchInput) {
    searchInput.blur();
    searchInput.value = '';
    filterEntries('');
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

  // Duration update on time change
  document.getElementById('entryEditStartTime').addEventListener('change', updateDurationDisplay);
  document.getElementById('entryEditEndTime').addEventListener('change', updateDurationDisplay);

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
    } else if (e.key === 't' && !e.ctrlKey && !e.metaKey && editMode) {
      // Toggle timer
      if (timerState.isRunning) {
        if (timerState.isPaused) {
          resumeTimer();
        } else {
          pauseTimer();
        }
      } else {
        startTimer();
      }
      e.preventDefault();
    }
  });

  // Search input
  document.getElementById('searchInput').addEventListener('input', (e) => filterEntries(e.target.value));
}

// ========== INITIALIZE ==========

init();
