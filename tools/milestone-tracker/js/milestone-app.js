/**
 * Milestone App Module - Init, state management, orchestration
 * Main entry point for the Milestone Tracker application
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
  migrateToV9,
  cloneProjectData,
  defaultWorkflow,
  getMilestones,
  calculateMilestoneProgress,
  calculateMilestoneStatus,
  getMilestoneDependencies
} from '../../../shared/js/unified-data.js';

// Import milestone modules
import { render } from './milestone-render.js';
import {
  createMilestone,
  updateMilestone,
  deleteMilestone,
  convertTaskToMilestone,
  addDependencyToMilestone,
  removeDependencyFromMilestone
} from './milestone-edit.js';

// ========== APP STATE ==========

let projectData = null;
let editMode = false;
let currentView = 'timeline'; // 'timeline' or 'list'
let selectedMilestoneId = null;
let searchQuery = '';
let saveCount = 0;
let statusFilter = null; // null for all, or 'on-track', 'at-risk', 'delayed', 'complete', 'not-started'

// Modal state
let currentEditMilestoneId = null;

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
        console.log('Migrating data to v9 format...');
        projectData = migrateToV9(saved);
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
  render(projectData, editMode, currentView, selectedMilestoneId, searchQuery, statusFilter, getHandlers());
}

// ========== EVENT HANDLERS OBJECT ==========

function getHandlers() {
  return {
    onMilestoneClick: (milestoneId) => selectMilestone(milestoneId),
    onMilestoneEdit: (milestoneId) => window.openEditMilestone(milestoneId),
    onMilestoneDelete: (milestoneId) => handleDeleteMilestone(milestoneId)
  };
}

// ========== MILESTONE HANDLERS ==========

function selectMilestone(milestoneId) {
  selectedMilestoneId = milestoneId;
  renderApp();
}

function handleDeleteMilestone(milestoneId) {
  if (!editMode) return;

  const milestone = projectData.tasks.find(t => t.id === milestoneId);
  if (!milestone) return;

  if (confirm(`Delete milestone "${milestone.name}"? The task will remain but will no longer be marked as a milestone.`)) {
    saveState();
    deleteMilestone(projectData, milestoneId);

    if (selectedMilestoneId === milestoneId) {
      selectedMilestoneId = null;
    }

    save();
    renderApp();
    statusManager.show('Milestone removed', true);
  }
}

// ========== VIEW SWITCHING ==========

window.setView = function(view) {
  currentView = view;

  // Update button states
  document.getElementById('timelineViewBtn').classList.toggle('view-toggle-btn--active', view === 'timeline');
  document.getElementById('listViewBtn').classList.toggle('view-toggle-btn--active', view === 'list');

  // Show/hide views
  document.getElementById('timelineView').style.display = view === 'timeline' ? '' : 'none';
  document.getElementById('listView').style.display = view === 'list' ? '' : 'none';

  // Show/hide FAB only in timeline view during edit mode
  document.getElementById('fabAdd').style.display = view === 'timeline' && editMode ? '' : 'none';

  renderApp();
};

// ========== EDIT MODE ==========

window.toggleEditMode = function() {
  editMode = !editMode;
  document.body.classList.toggle('edit-mode', editMode);
  document.getElementById('editToggle').textContent = editMode ? 'View' : 'Edit';

  // Update FAB visibility
  const fab = document.getElementById('fabAdd');
  fab.style.display = editMode && currentView === 'timeline' ? '' : 'none';

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

// ========== NEW MILESTONE MODAL ==========

window.openNewMilestone = function() {
  if (!editMode) return;

  document.getElementById('newMilestoneName').value = '';

  // Default deadline to 2 weeks from now
  const defaultDeadline = new Date();
  defaultDeadline.setDate(defaultDeadline.getDate() + 14);
  document.getElementById('newMilestoneDeadline').value = defaultDeadline.toISOString().split('T')[0];

  document.getElementById('newMilestoneNotes').value = '';
  document.getElementById('newMilestoneModal').classList.add('active');
  document.getElementById('newMilestoneName').focus();
};

window.closeNewMilestone = function() {
  document.getElementById('newMilestoneModal').classList.remove('active');
};

window.createNewMilestone = function() {
  const name = document.getElementById('newMilestoneName').value.trim();
  if (!name) {
    statusManager.show('Enter a milestone name');
    return;
  }

  const deadline = document.getElementById('newMilestoneDeadline').value;
  const notes = document.getElementById('newMilestoneNotes').value.trim();

  saveState();
  const newMilestone = createMilestone(projectData, {
    name,
    milestoneDeadline: deadline || null,
    milestoneNotes: notes
  });

  if (newMilestone) {
    selectedMilestoneId = newMilestone.id;
    save();
    closeNewMilestone();
    renderApp();
    statusManager.show('Milestone created', true);
  }
};

// ========== EDIT MILESTONE MODAL ==========

window.openEditMilestone = function(milestoneId) {
  const milestone = projectData.tasks.find(t => t.id === milestoneId);
  if (!milestone) return;

  currentEditMilestoneId = milestoneId;

  document.getElementById('editMilestoneTitle').textContent = editMode ? 'Edit Milestone' : 'Milestone Details';
  document.getElementById('editMilestoneName').value = milestone.name;
  document.getElementById('editMilestoneName').disabled = !editMode;

  document.getElementById('editMilestoneDeadline').value = milestone.milestoneDeadline || '';
  document.getElementById('editMilestoneDeadline').disabled = !editMode;

  document.getElementById('editMilestoneNotes').value = milestone.milestoneNotes || '';
  document.getElementById('editMilestoneNotes').disabled = !editMode;

  document.getElementById('editMilestoneStatusOverride').value = milestone.milestoneStatusOverride || '';
  document.getElementById('editMilestoneStatusOverride').disabled = !editMode;

  document.getElementById('editMilestoneProgressOverride').value =
    milestone.milestoneProgressOverride !== null && milestone.milestoneProgressOverride !== undefined
      ? milestone.milestoneProgressOverride
      : '';
  document.getElementById('editMilestoneProgressOverride').disabled = !editMode;

  // Populate dependency picker
  populateDependencyPicker(milestone);

  document.getElementById('editMilestoneModal').classList.add('active');
}

function populateDependencyPicker(milestone) {
  const picker = document.getElementById('dependencyPicker');
  const dependencies = milestone.milestoneDependencies || [];

  // Get all non-milestone tasks
  const availableTasks = projectData.tasks.filter(t => !t.isMilestone || t.id === milestone.id);

  if (availableTasks.length === 0) {
    picker.innerHTML = '<div class="dependency-picker__empty">No tasks available</div>';
    return;
  }

  picker.innerHTML = availableTasks.map(task => {
    const isChecked = dependencies.includes(task.id);
    const columnName = getColumnName(task.board?.columnId);
    const disabled = !editMode;

    return `
      <label class="dependency-picker__item ${isChecked ? 'dependency-picker__item--checked' : ''} ${disabled ? 'dependency-picker__item--disabled' : ''}">
        <input type="checkbox" class="dependency-picker__checkbox"
               value="${task.id}"
               ${isChecked ? 'checked' : ''}
               ${disabled ? 'disabled' : ''}
               onchange="toggleDependency('${task.id}')">
        <span class="dependency-picker__name">${escapeHtml(task.name)}</span>
        <span class="dependency-picker__status">${columnName}</span>
      </label>
    `;
  }).join('');
}

function getColumnName(columnId) {
  const column = projectData.workflow?.columns?.find(c => c.id === columnId);
  return column ? column.name : 'Unknown';
}

window.toggleDependency = function(taskId) {
  if (!currentEditMilestoneId || !editMode) return;

  const milestone = projectData.tasks.find(t => t.id === currentEditMilestoneId);
  if (!milestone) return;

  if (!milestone.milestoneDependencies) {
    milestone.milestoneDependencies = [];
  }

  const index = milestone.milestoneDependencies.indexOf(taskId);
  if (index >= 0) {
    milestone.milestoneDependencies.splice(index, 1);
  } else {
    milestone.milestoneDependencies.push(taskId);
  }

  // Re-render the picker to update checked state
  populateDependencyPicker(milestone);
};

window.closeEditMilestone = function() {
  document.getElementById('editMilestoneModal').classList.remove('active');
  currentEditMilestoneId = null;
};

window.saveEditMilestone = function() {
  if (!currentEditMilestoneId) return;

  const progressOverride = document.getElementById('editMilestoneProgressOverride').value;

  saveState();

  updateMilestone(projectData, currentEditMilestoneId, {
    name: document.getElementById('editMilestoneName').value,
    milestoneDeadline: document.getElementById('editMilestoneDeadline').value || null,
    milestoneNotes: document.getElementById('editMilestoneNotes').value.trim(),
    milestoneStatusOverride: document.getElementById('editMilestoneStatusOverride').value || null,
    milestoneProgressOverride: progressOverride === '' ? null : parseInt(progressOverride)
  });

  save();
  closeEditMilestone();
  renderApp();
  statusManager.show('Milestone updated', true);
};

window.deleteCurrentMilestone = function() {
  if (!currentEditMilestoneId || !editMode) return;
  handleDeleteMilestone(currentEditMilestoneId);
  closeEditMilestone();
};

// ========== CONVERT TASK MODAL ==========

window.openConvertTask = function() {
  if (!editMode) return;

  const picker = document.getElementById('taskPickerList');

  // Get non-milestone tasks
  const availableTasks = projectData.tasks.filter(t => !t.isMilestone);

  if (availableTasks.length === 0) {
    picker.innerHTML = '<div class="task-picker-empty">No tasks available to convert</div>';
  } else {
    picker.innerHTML = availableTasks.map(task => {
      return `
        <div class="task-picker-item" onclick="convertTask('${task.id}')">
          <span class="task-picker-item__name">${escapeHtml(task.name)}</span>
          <span class="task-picker-item__category">${escapeHtml(task.category)}</span>
        </div>
      `;
    }).join('');
  }

  document.getElementById('convertTaskModal').classList.add('active');
};

window.closeConvertTask = function() {
  document.getElementById('convertTaskModal').classList.remove('active');
};

window.convertTask = function(taskId) {
  saveState();
  convertTaskToMilestone(projectData, taskId);
  selectedMilestoneId = taskId;
  save();
  closeConvertTask();
  renderApp();
  statusManager.show('Task converted to milestone', true);
};

// ========== SEARCH/FILTER ==========

function filterMilestones(query) {
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

    // Migrate to v9 if needed
    const migrated = migrateToV9(imported);
    migrated.version = DATA_VERSION;

    projectData = migrated;
    selectedMilestoneId = null;

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

          // Update selected milestone if it no longer exists
          if (selectedMilestoneId) {
            const milestone = projectData.tasks.find(t => t.id === selectedMilestoneId && t.isMilestone);
            if (!milestone) {
              selectedMilestoneId = null;
            }
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
  closeNewMilestone();
  closeEditMilestone();
  closeConvertTask();
  const searchInput = document.getElementById('searchInput');
  if (document.activeElement === searchInput) {
    searchInput.blur();
    searchInput.value = '';
    filterMilestones('');
  }
}

// ========== HELPER FUNCTIONS ==========

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text || '';
  return div.innerHTML;
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

  // New milestone Enter key
  document.getElementById('newMilestoneName').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') createNewMilestone();
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
      openNewMilestone();
      e.preventDefault();
    } else if (e.key === 't' && !e.ctrlKey && !e.metaKey) {
      setView('timeline');
      e.preventDefault();
    } else if (e.key === 'l' && !e.ctrlKey && !e.metaKey) {
      setView('list');
      e.preventDefault();
    } else if (e.key === 'ArrowLeft' && !e.ctrlKey && !e.metaKey) {
      navigateMilestones(-1);
      e.preventDefault();
    } else if (e.key === 'ArrowRight' && !e.ctrlKey && !e.metaKey) {
      navigateMilestones(1);
      e.preventDefault();
    } else if (e.key === 'Delete' && editMode && selectedMilestoneId) {
      handleDeleteMilestone(selectedMilestoneId);
      e.preventDefault();
    }
  });

  // Search input
  document.getElementById('searchInput').addEventListener('input', (e) => filterMilestones(e.target.value));
}

function navigateMilestones(direction) {
  const milestones = getMilestones(projectData.tasks);
  if (milestones.length === 0) return;

  if (!selectedMilestoneId) {
    selectedMilestoneId = milestones[0].id;
  } else {
    const currentIndex = milestones.findIndex(m => m.id === selectedMilestoneId);
    const newIndex = Math.max(0, Math.min(milestones.length - 1, currentIndex + direction));
    selectedMilestoneId = milestones[newIndex].id;
  }

  renderApp();
}

// ========== INITIALIZE ==========

init();
