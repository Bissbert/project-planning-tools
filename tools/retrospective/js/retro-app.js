/**
 * Retrospective App Module - Init, state management, orchestration
 * Main entry point for the Retrospective Board application
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
  defaultWorkflow
} from '../../../shared/js/unified-data.js';

// Import retrospective modules
import { render } from './retro-render.js';
import {
  createRetrospective,
  updateRetrospective,
  deleteRetrospective,
  addItem,
  updateItem,
  deleteItem,
  voteItem,
  groupItems,
  moveItem,
  exportActionItemsText
} from './retro-edit.js';

// ========== APP STATE ==========

let projectData = null;
let editMode = false;
let activeRetroId = null;
let selectedItemId = null;
let searchQuery = '';
let saveCount = 0;

// Modal state
let currentEditRetroId = null;
let currentEditItemId = null;
let currentNewItemColumn = 'went-well';

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

  // Ensure retrospectives array exists
  if (!projectData.retrospectives) {
    projectData.retrospectives = [];
  }

  // Normalize retrospective items to array format
  // (handles legacy object format: {'went-well': [...], ...})
  projectData.retrospectives.forEach(retro => {
    if (retro.items && !Array.isArray(retro.items)) {
      const flatItems = [];
      Object.entries(retro.items).forEach(([columnKey, items]) => {
        if (Array.isArray(items)) {
          items.forEach((item, index) => {
            flatItems.push({
              ...item,
              column: columnKey,
              position: item.position ?? index
            });
          });
        }
      });
      retro.items = flatItems;
    }
    // Ensure items is always an array
    if (!retro.items) {
      retro.items = [];
    }
  });

  // Auto-select most recent retro
  if (projectData.retrospectives.length > 0 && !activeRetroId) {
    const sorted = [...projectData.retrospectives].sort((a, b) =>
      new Date(b.createdAt) - new Date(a.createdAt)
    );
    activeRetroId = sorted[0].id;
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
    tasks: [],
    retrospectives: []
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
  render(projectData, editMode, activeRetroId, searchQuery, getHandlers());
}

// ========== EVENT HANDLERS OBJECT ==========

function getHandlers() {
  return {
    onVote: (itemId) => handleVote(itemId),
    onEditItem: (itemId) => window.openEditItem(itemId),
    onDeleteItem: (itemId) => handleDeleteItem(itemId),
    onItemClick: (itemId) => selectItem(itemId),
    onGroup: (targetId, sourceId) => handleGroup(targetId, sourceId),
    onMoveToColumn: (itemId, column) => handleMoveToColumn(itemId, column)
  };
}

// ========== ITEM HANDLERS ==========

function selectItem(itemId) {
  selectedItemId = itemId;
  // Could add visual selection state here
}

function handleVote(itemId) {
  if (!activeRetroId) return;

  saveState();
  voteItem(projectData, activeRetroId, itemId);
  save();
  renderApp();
}

function handleDeleteItem(itemId) {
  if (!editMode || !activeRetroId) return;

  if (confirm('Delete this item?')) {
    saveState();
    deleteItem(projectData, activeRetroId, itemId);

    if (selectedItemId === itemId) {
      selectedItemId = null;
    }

    save();
    renderApp();
    statusManager.show('Item deleted', true);
  }
}

function handleGroup(targetId, sourceId) {
  if (!editMode || !activeRetroId) return;

  saveState();
  const success = groupItems(projectData, activeRetroId, targetId, sourceId);

  if (success) {
    save();
    renderApp();
    statusManager.show('Items grouped', true);
  }
}

function handleMoveToColumn(itemId, column) {
  if (!editMode || !activeRetroId) return;

  const retro = projectData.retrospectives.find(r => r.id === activeRetroId);
  if (!retro) return;

  const item = retro.items.find(i => i.id === itemId);
  if (!item || item.column === column) return;

  saveState();
  const success = moveItem(projectData, activeRetroId, itemId, column, 0);

  if (success) {
    save();
    renderApp();
    statusManager.show('Item moved', true);
  }
}

// ========== RETROSPECTIVE SELECTOR ==========

window.onRetroSelect = function(retroId) {
  activeRetroId = retroId;
  selectedItemId = null;
  renderApp();
};

// ========== EDIT MODE ==========

window.toggleEditMode = function() {
  editMode = !editMode;
  document.body.classList.toggle('edit-mode', editMode);
  document.getElementById('editToggle').textContent = editMode ? 'View' : 'Edit';
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

// ========== NEW RETROSPECTIVE MODAL ==========

window.openNewRetro = function() {
  if (!editMode) {
    // Auto-enable edit mode
    toggleEditMode();
  }

  document.getElementById('newRetroName').value = '';
  document.getElementById('newRetroAnonymous').checked = true;

  // Populate sprint selector
  populateSprintSelector('newRetroSprintId', null);

  document.getElementById('newRetroModal').classList.add('active');
  document.getElementById('newRetroName').focus();
};

window.closeNewRetro = function() {
  document.getElementById('newRetroModal').classList.remove('active');
};

window.createNewRetro = function() {
  const name = document.getElementById('newRetroName').value.trim();
  if (!name) {
    statusManager.show('Enter a retrospective name');
    return;
  }

  const sprintId = document.getElementById('newRetroSprintId').value || null;
  const isAnonymous = document.getElementById('newRetroAnonymous').checked;

  saveState();
  const newRetro = createRetrospective(projectData, {
    name,
    sprintId,
    isAnonymous
  });

  if (newRetro) {
    activeRetroId = newRetro.id;
    save();
    closeNewRetro();
    renderApp();
    statusManager.show('Retrospective created', true);
  }
};

// ========== EDIT RETROSPECTIVE MODAL ==========

window.openEditRetro = function() {
  if (!activeRetroId) return;

  const retro = projectData.retrospectives.find(r => r.id === activeRetroId);
  if (!retro) return;

  currentEditRetroId = activeRetroId;

  document.getElementById('editRetroTitle').textContent = editMode ? 'Edit Retrospective' : 'Retrospective Details';
  document.getElementById('editRetroName').value = retro.name;
  document.getElementById('editRetroName').disabled = !editMode;

  document.getElementById('editRetroAnonymous').checked = retro.isAnonymous;
  document.getElementById('editRetroAnonymous').disabled = !editMode;

  populateSprintSelector('editRetroSprintId', retro.sprintId);
  document.getElementById('editRetroSprintId').disabled = !editMode;

  document.getElementById('editRetroModal').classList.add('active');
};

window.closeEditRetro = function() {
  document.getElementById('editRetroModal').classList.remove('active');
  currentEditRetroId = null;
};

window.saveEditRetro = function() {
  if (!currentEditRetroId) return;

  saveState();

  updateRetrospective(projectData, currentEditRetroId, {
    name: document.getElementById('editRetroName').value.trim() || 'Untitled',
    sprintId: document.getElementById('editRetroSprintId').value || null,
    isAnonymous: document.getElementById('editRetroAnonymous').checked
  });

  save();
  closeEditRetro();
  renderApp();
  statusManager.show('Retrospective updated', true);
};

window.deleteCurrentRetro = function() {
  if (!currentEditRetroId || !editMode) return;

  const retro = projectData.retrospectives.find(r => r.id === currentEditRetroId);
  if (!retro) return;

  if (confirm(`Delete "${retro.name}"? This will remove all items in this retrospective.`)) {
    saveState();
    deleteRetrospective(projectData, currentEditRetroId);

    if (activeRetroId === currentEditRetroId) {
      // Select another retro or null
      activeRetroId = projectData.retrospectives.length > 0
        ? projectData.retrospectives[0].id
        : null;
    }

    save();
    closeEditRetro();
    renderApp();
    statusManager.show('Retrospective deleted', true);
  }
};

// ========== NEW ITEM MODAL ==========

window.openNewItem = function(column) {
  if (!editMode || !activeRetroId) return;

  currentNewItemColumn = column || 'went-well';

  const titles = {
    'went-well': 'Add: Went Well',
    'went-poorly': 'Add: Didn\'t Go Well',
    'action-items': 'Add: Action Item'
  };

  document.getElementById('newItemTitle').textContent = titles[currentNewItemColumn];
  document.getElementById('newItemText').value = '';
  document.getElementById('newItemAuthor').value = '';

  // Show/hide author field based on anonymous mode
  const retro = projectData.retrospectives.find(r => r.id === activeRetroId);
  const authorGroup = document.getElementById('newItemAuthorGroup');
  authorGroup.style.display = retro?.isAnonymous ? 'none' : '';

  document.getElementById('newItemModal').classList.add('active');
  document.getElementById('newItemText').focus();
};

window.closeNewItem = function() {
  document.getElementById('newItemModal').classList.remove('active');
};

window.createNewItem = function() {
  const text = document.getElementById('newItemText').value.trim();
  if (!text) {
    statusManager.show('Enter some text');
    return;
  }

  const author = document.getElementById('newItemAuthor').value.trim() || null;

  saveState();
  addItem(projectData, activeRetroId, {
    column: currentNewItemColumn,
    text,
    author
  });

  save();
  closeNewItem();
  renderApp();
  statusManager.show('Item added', true);
};

// ========== EDIT ITEM MODAL ==========

window.openEditItem = function(itemId) {
  if (!activeRetroId) return;

  const retro = projectData.retrospectives.find(r => r.id === activeRetroId);
  if (!retro) return;

  const item = retro.items.find(i => i.id === itemId);
  if (!item) return;

  currentEditItemId = itemId;

  document.getElementById('editItemText').value = item.text;
  document.getElementById('editItemText').disabled = !editMode;

  document.getElementById('editItemColumn').value = item.column;
  document.getElementById('editItemColumn').disabled = !editMode;

  document.getElementById('editItemModal').classList.add('active');
};

window.closeEditItem = function() {
  document.getElementById('editItemModal').classList.remove('active');
  currentEditItemId = null;
};

window.saveEditItem = function() {
  if (!currentEditItemId || !activeRetroId) return;

  saveState();

  updateItem(projectData, activeRetroId, currentEditItemId, {
    text: document.getElementById('editItemText').value.trim() || 'Item',
    column: document.getElementById('editItemColumn').value
  });

  save();
  closeEditItem();
  renderApp();
  statusManager.show('Item updated', true);
};

window.deleteCurrentItem = function() {
  if (!currentEditItemId || !editMode) return;
  handleDeleteItem(currentEditItemId);
  closeEditItem();
};

// ========== HELPER FUNCTIONS ==========

function populateSprintSelector(selectId, selectedSprintId) {
  const select = document.getElementById(selectId);

  // Get completed sprints (most recent first)
  const completedSprints = (projectData.sprints || [])
    .filter(s => s.status === 'completed')
    .sort((a, b) => {
      const dateA = a.endDate || a.startDate || '';
      const dateB = b.endDate || b.startDate || '';
      return dateB.localeCompare(dateA);
    });

  const activeSprints = (projectData.sprints || [])
    .filter(s => s.status === 'active');

  const plannedSprints = (projectData.sprints || [])
    .filter(s => s.status === 'planned');

  let options = '<option value="">No sprint link</option>';

  if (completedSprints.length > 0) {
    options += '<optgroup label="Completed">';
    completedSprints.forEach(s => {
      const selected = s.id === selectedSprintId ? ' selected' : '';
      options += `<option value="${s.id}"${selected}>${escapeHtml(s.name)}</option>`;
    });
    options += '</optgroup>';
  }

  if (activeSprints.length > 0) {
    options += '<optgroup label="Active">';
    activeSprints.forEach(s => {
      const selected = s.id === selectedSprintId ? ' selected' : '';
      options += `<option value="${s.id}"${selected}>${escapeHtml(s.name)}</option>`;
    });
    options += '</optgroup>';
  }

  if (plannedSprints.length > 0) {
    options += '<optgroup label="Planned">';
    plannedSprints.forEach(s => {
      const selected = s.id === selectedSprintId ? ' selected' : '';
      options += `<option value="${s.id}"${selected}>${escapeHtml(s.name)}</option>`;
    });
    options += '</optgroup>';
  }

  select.innerHTML = options;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text || '';
  return div.innerHTML;
}

// ========== SEARCH/FILTER ==========

function filterItems(query) {
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

window.exportActionItems = function() {
  if (!activeRetroId) {
    statusManager.show('Select a retrospective first');
    return;
  }

  const retro = projectData.retrospectives.find(r => r.id === activeRetroId);
  if (!retro) return;

  const text = exportActionItemsText(retro);

  // Create and download text file
  const blob = new Blob([text], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = sanitizeFilename(`${retro.name}-actions`) + '.txt';
  a.click();
  URL.revokeObjectURL(url);

  statusManager.show('Action items exported', true);
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

    // Migrate if needed
    const migrated = migrateToLatest(imported);
    migrated.version = DATA_VERSION;

    projectData = migrated;

    // Select first retro if exists
    activeRetroId = projectData.retrospectives?.length > 0
      ? projectData.retrospectives[0].id
      : null;

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

          // Update active retro if it no longer exists
          if (activeRetroId) {
            const retro = projectData.retrospectives?.find(r => r.id === activeRetroId);
            if (!retro) {
              activeRetroId = projectData.retrospectives?.length > 0
                ? projectData.retrospectives[0].id
                : null;
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
  closeNewRetro();
  closeEditRetro();
  closeNewItem();
  closeEditItem();
  const searchInput = document.getElementById('searchInput');
  if (document.activeElement === searchInput) {
    searchInput.blur();
    searchInput.value = '';
    filterItems('');
  }
}

// ========== EVENT LISTENERS ==========

function setupEventListeners() {
  // File input
  document.getElementById('fileInput').addEventListener('change', handleFileImport);

  // Retro selector
  document.getElementById('retroSelector').addEventListener('change', (e) => {
    window.onRetroSelect(e.target.value);
  });

  // Modal overlays - close on background click
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target.classList.contains('modal-overlay')) {
        closeModals();
      }
    });
  });

  // New retro Enter key
  document.getElementById('newRetroName').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') createNewRetro();
  });

  // New item Enter key (with Ctrl/Cmd for multiline)
  document.getElementById('newItemText').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      createNewItem();
    }
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
    } else if (e.key === 'n' && !e.ctrlKey && !e.metaKey && editMode) {
      openNewRetro();
      e.preventDefault();
    } else if (e.key === '1' && editMode && activeRetroId) {
      openNewItem('went-well');
      e.preventDefault();
    } else if (e.key === '2' && editMode && activeRetroId) {
      openNewItem('went-poorly');
      e.preventDefault();
    } else if (e.key === '3' && editMode && activeRetroId) {
      openNewItem('action-items');
      e.preventDefault();
    }
  });

  // Search input
  document.getElementById('searchInput').addEventListener('input', (e) => filterItems(e.target.value));
}

// ========== INITIALIZE ==========

init();
