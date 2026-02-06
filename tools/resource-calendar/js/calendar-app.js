/**
 * Calendar App Module - Init, state management, orchestration
 * Main entry point for the Resource Calendar application
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
  generateMemberId,
  getMemberAvailability,
  setMemberAvailability,
  calculateTeamCapacity,
  getWeekCapacityPercent,
  getWeekStart,
  getWeekEnd,
  getWeekDates,
  formatDateRange
} from '../../../shared/js/unified-data.js';

// Import calendar modules
import { render } from './calendar-render.js';
import {
  addMember,
  updateMember,
  deleteMember,
  setAvailability
} from './calendar-edit.js';

// ========== APP STATE ==========

let projectData = null;
let editMode = false;
let currentView = 'week'; // 'week' or 'month'
let viewDate = new Date(); // Current date for navigation
let searchQuery = '';
let saveCount = 0;

// Modal state
let currentEditMemberId = null;
let currentAvailabilityMemberId = null;
let currentAvailabilityDate = null;

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

  // Setup color picker
  setupColorPicker();

  // Setup availability type selector
  setupAvailabilityTypeSelector();

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

  // Ensure required fields exist
  if (!projectData.team) {
    projectData.team = [];
  }
  if (!projectData.calendarSettings) {
    projectData.calendarSettings = {
      workDays: [1, 2, 3, 4, 5],
      hoursPerDay: 8
    };
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
    workflow: {
      columns: [
        { id: 'backlog', name: 'Backlog', color: '#6366f1', position: 0 },
        { id: 'todo', name: 'To Do', color: '#a78bfa', position: 1 },
        { id: 'in-progress', name: 'In Progress', color: '#fbbf24', position: 2 },
        { id: 'done', name: 'Done', color: '#22c55e', position: 3 }
      ]
    },
    sprints: [],
    timeEntries: [],
    tasks: [],
    calendarSettings: {
      workDays: [1, 2, 3, 4, 5],
      hoursPerDay: 8
    }
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
  render(projectData, editMode, currentView, viewDate, searchQuery, getHandlers());
}

// ========== EVENT HANDLERS OBJECT ==========

function getHandlers() {
  return {
    // Member events
    onMemberClick: (memberId) => openEditMember(memberId),

    // Cell events
    onCellClick: (memberId, date) => openAvailabilityModal(memberId, date),

    // Month day click (drill down to week)
    onMonthDayClick: (date) => {
      viewDate = new Date(date);
      currentView = 'week';
      renderApp();
    }
  };
}

// ========== VIEW NAVIGATION ==========

window.setView = function(view) {
  currentView = view;
  document.getElementById('weekViewBtn').classList.toggle('view-btn--active', view === 'week');
  document.getElementById('monthViewBtn').classList.toggle('view-btn--active', view === 'month');
  renderApp();
};

window.navigatePrev = function() {
  if (currentView === 'week') {
    viewDate.setDate(viewDate.getDate() - 7);
  } else {
    viewDate.setMonth(viewDate.getMonth() - 1);
  }
  renderApp();
};

window.navigateNext = function() {
  if (currentView === 'week') {
    viewDate.setDate(viewDate.getDate() + 7);
  } else {
    viewDate.setMonth(viewDate.getMonth() + 1);
  }
  renderApp();
};

window.navigateToday = function() {
  viewDate = new Date();
  renderApp();
};

// ========== MEMBER MODAL ==========

window.openAddMember = function() {
  if (!editMode) return;

  currentEditMemberId = null;

  document.getElementById('memberModalTitle').textContent = 'Add Team Member';
  document.getElementById('memberName').value = '';
  document.getElementById('memberRole').value = '';
  document.getElementById('memberHours').value = '40';
  document.getElementById('memberColor').value = '#a78bfa';
  document.getElementById('deleteMemberBtn').style.display = 'none';

  // Reset color picker
  document.querySelectorAll('#colorPicker .color-btn').forEach(btn => {
    btn.classList.toggle('color-btn--selected', btn.dataset.color === '#a78bfa');
  });

  document.getElementById('memberModal').classList.add('active');
  document.getElementById('memberName').focus();
};

function openEditMember(memberId) {
  if (!editMode) return;

  const member = projectData.team.find(m => m.id === memberId);
  if (!member) return;

  currentEditMemberId = memberId;

  document.getElementById('memberModalTitle').textContent = 'Edit Team Member';
  document.getElementById('memberName').value = member.name;
  document.getElementById('memberRole').value = member.role || '';
  document.getElementById('memberHours').value = member.hoursPerWeek || 40;
  document.getElementById('memberColor').value = member.color || '#a78bfa';
  document.getElementById('deleteMemberBtn').style.display = '';

  // Set color picker
  document.querySelectorAll('#colorPicker .color-btn').forEach(btn => {
    btn.classList.toggle('color-btn--selected', btn.dataset.color === member.color);
  });

  document.getElementById('memberModal').classList.add('active');
}

window.closeMemberModal = function() {
  document.getElementById('memberModal').classList.remove('active');
  currentEditMemberId = null;
};

window.saveMember = function() {
  const name = document.getElementById('memberName').value.trim();
  if (!name) {
    statusManager.show('Enter a name');
    return;
  }

  const memberData = {
    name,
    role: document.getElementById('memberRole').value.trim(),
    color: document.getElementById('memberColor').value,
    hoursPerWeek: parseInt(document.getElementById('memberHours').value) || 40
  };

  saveState();

  if (currentEditMemberId) {
    updateMember(projectData, currentEditMemberId, memberData);
    statusManager.show('Member updated', true);
  } else {
    addMember(projectData, memberData);
    statusManager.show('Member added', true);
  }

  save();
  closeMemberModal();
  renderApp();
};

window.deleteMember = function() {
  if (!currentEditMemberId || !editMode) return;

  const member = projectData.team.find(m => m.id === currentEditMemberId);
  if (!member) return;

  if (confirm(`Delete "${member.name}"?`)) {
    saveState();
    deleteMember(projectData, currentEditMemberId);
    save();
    closeMemberModal();
    renderApp();
    statusManager.show('Member deleted', true);
  }
};

// ========== AVAILABILITY MODAL ==========

function openAvailabilityModal(memberId, date) {
  if (!editMode) return;

  const member = projectData.team.find(m => m.id === memberId);
  if (!member) return;

  currentAvailabilityMemberId = memberId;
  currentAvailabilityDate = date;

  // Set member name with color indicator
  const nameEl = document.getElementById('availabilityMemberName');
  nameEl.textContent = member.name;
  nameEl.style.setProperty('--member-color', member.color);
  nameEl.querySelector('::before')?.style?.setProperty('background', member.color);

  // Set dates
  document.getElementById('availabilityStartDate').value = date;
  document.getElementById('availabilityEndDate').value = date;

  // Get current availability
  const current = getMemberAvailability(member, date, projectData.calendarSettings);

  // Set type selector
  const type = current.type === 'weekend' ? 'available' : current.type;
  document.querySelectorAll('#availabilityTypeSelector .availability-type-btn').forEach(btn => {
    btn.classList.toggle('availability-type-btn--selected', btn.dataset.type === type);
  });

  // Show/hide partial hours
  document.getElementById('partialHoursGroup').style.display = type === 'partial' ? '' : 'none';
  document.getElementById('availabilityHours').value = current.hours || 4;

  // Set reason
  document.getElementById('availabilityReason').value = current.reason || '';

  document.getElementById('availabilityModal').classList.add('active');
}

window.closeAvailabilityModal = function() {
  document.getElementById('availabilityModal').classList.remove('active');
  currentAvailabilityMemberId = null;
  currentAvailabilityDate = null;
};

window.saveAvailability = function() {
  if (!currentAvailabilityMemberId) return;

  const member = projectData.team.find(m => m.id === currentAvailabilityMemberId);
  if (!member) return;

  const startDate = document.getElementById('availabilityStartDate').value;
  const endDate = document.getElementById('availabilityEndDate').value || startDate;
  const type = document.querySelector('#availabilityTypeSelector .availability-type-btn--selected')?.dataset.type || 'available';
  const reason = document.getElementById('availabilityReason').value.trim();

  let hours = projectData.calendarSettings?.hoursPerDay || 8;
  if (type === 'partial') {
    hours = parseInt(document.getElementById('availabilityHours').value) || 4;
  } else if (type === 'unavailable' || type === 'holiday') {
    hours = 0;
  }

  saveState();

  setAvailability(projectData, currentAvailabilityMemberId, startDate, endDate, {
    type,
    hours,
    reason
  });

  save();
  closeAvailabilityModal();
  renderApp();
  statusManager.show('Availability updated', true);
};

// ========== SETTINGS MODAL ==========

window.openSettings = function() {
  document.getElementById('settingsTitle').value = projectData.project.title;
  document.getElementById('settingsHoursPerDay').value = projectData.calendarSettings?.hoursPerDay || 8;

  // Set workdays checkboxes
  const workDays = projectData.calendarSettings?.workDays || [1, 2, 3, 4, 5];
  document.querySelectorAll('#workdaysSelector input').forEach(input => {
    const day = parseInt(input.dataset.day);
    input.checked = workDays.includes(day);
  });

  document.getElementById('settingsModal').classList.add('active');
};

window.closeSettings = function() {
  document.getElementById('settingsModal').classList.remove('active');
};

window.saveSettings = function() {
  saveState();

  projectData.project.title = document.getElementById('settingsTitle').value.trim() || 'Untitled Project';
  projectData.calendarSettings.hoursPerDay = parseInt(document.getElementById('settingsHoursPerDay').value) || 8;

  // Get workdays
  const workDays = [];
  document.querySelectorAll('#workdaysSelector input:checked').forEach(input => {
    workDays.push(parseInt(input.dataset.day));
  });
  projectData.calendarSettings.workDays = workDays;

  save();
  closeSettings();
  renderApp();
  statusManager.show('Settings saved', true);
};

// ========== COLOR PICKER ==========

function setupColorPicker() {
  const colorPicker = document.getElementById('colorPicker');
  if (!colorPicker) return;

  colorPicker.addEventListener('click', (e) => {
    const btn = e.target.closest('.color-btn');
    if (!btn) return;

    // Update selection
    colorPicker.querySelectorAll('.color-btn').forEach(b => b.classList.remove('color-btn--selected'));
    btn.classList.add('color-btn--selected');

    // Update hidden input
    document.getElementById('memberColor').value = btn.dataset.color;
  });
}

// ========== AVAILABILITY TYPE SELECTOR ==========

function setupAvailabilityTypeSelector() {
  const selector = document.getElementById('availabilityTypeSelector');
  if (!selector) return;

  selector.addEventListener('click', (e) => {
    const btn = e.target.closest('.availability-type-btn');
    if (!btn) return;

    // Update selection
    selector.querySelectorAll('.availability-type-btn').forEach(b => b.classList.remove('availability-type-btn--selected'));
    btn.classList.add('availability-type-btn--selected');

    // Show/hide partial hours
    const isPartial = btn.dataset.type === 'partial';
    document.getElementById('partialHoursGroup').style.display = isPartial ? '' : 'none';
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

function filterMembers(query) {
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
    const migrated = migrateToLatest(imported);
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
  closeMemberModal();
  closeAvailabilityModal();
  const searchInput = document.getElementById('searchInput');
  if (document.activeElement === searchInput) {
    searchInput.blur();
    searchInput.value = '';
    filterMembers('');
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

  // Member name Enter key
  document.getElementById('memberName').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') saveMember();
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
    } else if (e.key === 'w' && !e.ctrlKey && !e.metaKey) {
      setView('week');
      e.preventDefault();
    } else if (e.key === 'm' && !e.ctrlKey && !e.metaKey) {
      setView('month');
      e.preventDefault();
    } else if (e.key === 't' && !e.ctrlKey && !e.metaKey) {
      navigateToday();
      e.preventDefault();
    } else if (e.key === 'ArrowLeft' && !e.ctrlKey && !e.metaKey) {
      navigatePrev();
      e.preventDefault();
    } else if (e.key === 'ArrowRight' && !e.ctrlKey && !e.metaKey) {
      navigateNext();
      e.preventDefault();
    }
  });

  // Search input
  document.getElementById('searchInput').addEventListener('input', (e) => filterMembers(e.target.value));
}

// ========== INITIALIZE ==========

init();
