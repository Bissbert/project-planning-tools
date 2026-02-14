/**
 * Dependencies App Module - Init, state management, orchestration
 * Simple dependency visualization: what depends on what
 * No PERT values -- just task name, category, status-based coloring
 */

// Import shared modules
import { saveToStorage, loadFromStorage } from '../../../shared/js/storage.js';
import { createBackup } from '../../../shared/js/backup.js';
import { createUndoManager } from '../../../shared/js/undo.js';
import { downloadJSON, readJSONFile, sanitizeFilename } from '../../../shared/js/export.js';
import { createStatusManager } from '../../../shared/js/status.js';
import { initNavigation } from '../../../shared/js/navigation.js';
import { initExportDropdown } from '../../../shared/js/export-dropdown.js';

// Import unified data module
import {
  DATA_VERSION,
  STORAGE_KEY,
  BACKUP_KEY,
  migrateToLatest,
  defaultWorkflow
} from '../../../shared/js/unified-data.js';

// Import deps modules
import {
  addDependency,
  removeDependency,
  getPotentialPredecessors,
  validateDependencies
} from './deps-edit.js';

import {
  initNetwork,
  updateNetwork,
  setEditMode as setNetworkEditMode,
  startEdgeDrawing,
  stopEdgeDrawing,
  zoomIn as networkZoomIn,
  zoomOut as networkZoomOut,
  resetView as networkResetView,
  selectNode as networkSelectNode,
  exportToPNG as networkExportToPNG,
  addEdgeToNetwork,
  removeEdgeFromNetwork,
  hasNodes
} from './deps-vis.js';

// ========== APP STATE ==========

let projectData = null;
let editMode = false;
let drawMode = false;
let searchQuery = '';
let categoryFilter = null;
let statusFilter = null;
let selectedNodeId = null;
let saveCount = 0;

// Managers
let undoManager = null;
let statusManager = null;

let networkInitialized = false;

// ========== INITIALIZATION ==========

export function init() {
  undoManager = createUndoManager(50);
  statusManager = createStatusManager('status');

  initNavigation();
  initExportDropdown();

  loadData();
  initializeNetwork();
  setupEventListeners();
  setupStorageSync();

  renderApp();
}

function loadData() {
  const saved = loadFromStorage(STORAGE_KEY);

  if (saved) {
    try {
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

  projectData.version = DATA_VERSION;

  const invalidCount = validateDependencies(projectData);
  if (invalidCount > 0) {
    console.log(`Removed ${invalidCount} invalid dependencies`);
  }

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
    categories: { "General": "#a78bfa" },
    workflow: JSON.parse(JSON.stringify(defaultWorkflow)),
    sprints: [],
    timeEntries: [],
    tasks: []
  };
}

function initializeNetwork() {
  const container = document.getElementById('networkContainer');
  if (!container) {
    console.error('Network container not found');
    return;
  }

  initNetwork(container, {
    onNodeSelect: handleNodeSelect,
    onNodeDoubleClick: handleNodeDoubleClick,
    onEdgeAdd: handleEdgeAdd,
    onEdgeDelete: handleEdgeDelete
  });

  networkInitialized = true;
}

// ========== SAVE/LOAD ==========

function save() {
  saveToStorage(STORAGE_KEY, projectData);
  statusManager.show('Saved', true);

  saveCount++;
  if (saveCount % 10 === 0) {
    createBackup(BACKUP_KEY, projectData);
  }
}

function saveState() {
  undoManager.saveState(projectData);
}

// ========== RENDER ==========

function renderApp(options = {}) {
  const { fitView = true } = options;

  // Update title
  document.getElementById('projectTitle').textContent = projectData.project.title;

  // Update print data
  const container = document.querySelector('.deps-container');
  if (container) {
    container.setAttribute('data-project-title', projectData.project.title);
    container.setAttribute('data-print-date', new Date().toLocaleDateString());
  }

  // Get tasks with dependencies (only tasks that have or are referenced by dependencies)
  const allTasks = projectData.tasks || [];
  const tasksWithDeps = getTasksWithDependencies(allTasks);

  // Populate filter dropdowns
  populateFilters(allTasks);

  // Update stats
  updateStats(tasksWithDeps);

  // Render network
  renderDiagram(tasksWithDeps, { fitView });
}

function getTasksWithDependencies(tasks) {
  // Collect all task IDs that are involved in dependencies
  const involvedIds = new Set();

  tasks.forEach(task => {
    const deps = task.dependencies || [];
    const milestoneDeps = task.milestoneDependencies || [];
    const allDeps = [...deps, ...milestoneDeps];

    if (allDeps.length > 0) {
      involvedIds.add(task.id);
      allDeps.forEach(id => involvedIds.add(id));
    }
  });

  // Return all tasks that are involved in at least one dependency
  // If no dependencies exist, return all tasks so users can create connections
  if (involvedIds.size === 0) {
    return tasks;
  }

  return tasks.filter(t => involvedIds.has(t.id));
}

function renderDiagram(tasks, options = {}) {
  const { fitView = true } = options;
  const emptyEl = document.getElementById('diagramEmpty');
  const networkContainer = document.getElementById('networkContainer');

  if (!tasks || tasks.length === 0) {
    emptyEl.style.display = 'flex';
    networkContainer.style.display = 'none';
    updateNetwork(null, null, { fitView: false });
    return;
  }

  emptyEl.style.display = 'none';
  networkContainer.style.display = 'block';

  updateNetwork(tasks, projectData.workflow, {
    fitView,
    searchQuery,
    categoryFilter,
    statusFilter
  });
}

function populateFilters(tasks) {
  // Category filter
  const categorySelect = document.getElementById('categoryFilter');
  if (categorySelect) {
    const categories = [...new Set(tasks.map(t => t.category).filter(Boolean))].sort();
    const currentValue = categorySelect.value;

    categorySelect.innerHTML = '<option value="">All Categories</option>' +
      categories.map(c => `<option value="${c}" ${c === currentValue ? 'selected' : ''}>${c}</option>`).join('');
  }

  // Status filter
  const statusSelect = document.getElementById('statusFilter');
  if (statusSelect) {
    const columns = projectData.workflow?.columns || [];
    const currentValue = statusSelect.value;

    statusSelect.innerHTML = '<option value="">All Statuses</option>' +
      columns.map(c => `<option value="${c.id}" ${c.id === currentValue ? 'selected' : ''}>${c.name}</option>`).join('');
  }
}

function updateStats(tasks) {
  const nodeCount = tasks.length;
  let edgeCount = 0;

  tasks.forEach(task => {
    const deps = task.dependencies || [];
    const milestoneDeps = task.milestoneDependencies || [];
    edgeCount += deps.length + milestoneDeps.length;
  });

  document.getElementById('nodeCount').textContent = nodeCount;
  document.getElementById('edgeCount').textContent = edgeCount;
}

// ========== EVENT HANDLERS ==========

function handleNodeSelect(nodeId) {
  selectedNodeId = nodeId;
}

function handleNodeDoubleClick(nodeId) {
  selectedNodeId = nodeId;
  openTaskModal(nodeId);
}

function handleEdgeAdd(fromId, toId) {
  saveState();
  if (addDependency(projectData, fromId, toId)) {
    save();
    statusManager.show('Dependency created', true);
    addEdgeToNetwork(fromId, toId);
    renderApp({ fitView: false });

    if (editMode && drawMode) {
      startEdgeDrawing();
    }
  }
}

function handleEdgeDelete(fromId, toId) {
  saveState();
  if (removeDependency(projectData, fromId, toId)) {
    save();
    statusManager.show('Dependency removed', true);
    removeEdgeFromNetwork(fromId, toId);
    renderApp({ fitView: false });

    if (editMode && drawMode) {
      startEdgeDrawing();
    }
  }
}

// ========== EDIT MODE ==========

window.toggleEditMode = function() {
  editMode = !editMode;
  document.body.classList.toggle('edit-mode', editMode);
  document.getElementById('editToggle').textContent = editMode ? 'View' : 'Edit';

  setNetworkEditMode(editMode);

  if (!editMode && drawMode) {
    exitDrawMode();
  }

  renderApp({ fitView: false });

  if (editMode) {
    setTimeout(() => enterDrawMode(), 50);
  }
};

function enterDrawMode() {
  if (!hasNodes()) return;
  drawMode = true;
  startEdgeDrawing();
}

function exitDrawMode() {
  drawMode = false;
  stopEdgeDrawing();
}

// ========== ZOOM/PAN ==========

window.zoomIn = function() { networkZoomIn(); };
window.zoomOut = function() { networkZoomOut(); };
window.resetZoom = function() { networkResetView(); };

// ========== TASK MODAL ==========

function openTaskModal(nodeId) {
  const task = projectData.tasks.find(t => t.id === nodeId);
  if (!task) return;

  document.getElementById('taskModalTitle').textContent = task.name;

  // Info section
  const infoEl = document.getElementById('taskInfo');
  const columnName = getColumnName(task.board?.columnId);
  infoEl.innerHTML = `
    <div class="task-info-item">
      <span class="task-info-item__label">Category</span>
      <span class="task-info-item__value">${escapeHtml(task.category || 'None')}</span>
    </div>
    <div class="task-info-item">
      <span class="task-info-item__label">Status</span>
      <span class="task-info-item__value">${escapeHtml(columnName)}</span>
    </div>
    <div class="task-info-item">
      <span class="task-info-item__label">Assignee</span>
      <span class="task-info-item__value">${escapeHtml(task.assignee || 'Unassigned')}</span>
    </div>
  `;

  // Predecessors
  const predsEl = document.getElementById('taskPredecessors');
  const predecessors = (task.dependencies || [])
    .map(id => projectData.tasks.find(t => t.id === id))
    .filter(Boolean);

  predsEl.innerHTML = predecessors.length > 0
    ? predecessors.map(pred => `
        <div class="dependency-item">
          <div class="dependency-item__info">
            <span class="dependency-item__name">${escapeHtml(pred.name)}</span>
          </div>
          ${editMode ? `<button class="dependency-item__remove" onclick="removePredecessor('${pred.id}', '${nodeId}')">&times;</button>` : ''}
        </div>
      `).join('')
    : '<p class="dependency-empty">No predecessors</p>';

  // Successors
  const succsEl = document.getElementById('taskSuccessors');
  const successors = projectData.tasks.filter(t =>
    (t.dependencies || []).includes(nodeId) ||
    (t.milestoneDependencies || []).includes(nodeId)
  );

  succsEl.innerHTML = successors.length > 0
    ? successors.map(succ => `
        <div class="dependency-item">
          <div class="dependency-item__info">
            <span class="dependency-item__name">${escapeHtml(succ.name)}</span>
          </div>
          ${editMode ? `<button class="dependency-item__remove" onclick="removeSuccessor('${nodeId}', '${succ.id}')">&times;</button>` : ''}
        </div>
      `).join('')
    : '<p class="dependency-empty">No successors</p>';

  // Add dependency dropdown
  const addSelect = document.getElementById('addDependencySelect');
  const potentialPreds = getPotentialPredecessors(projectData, nodeId);
  addSelect.innerHTML = '<option value="">Select a predecessor...</option>' +
    potentialPreds.map(t => `<option value="${t.id}">${escapeHtml(t.name)}</option>`).join('');

  document.getElementById('taskModal').classList.add('active');
}

function getColumnName(columnId) {
  const column = projectData.workflow?.columns?.find(c => c.id === columnId);
  return column ? column.name : 'Unknown';
}

window.closeTaskModal = function() {
  document.getElementById('taskModal').classList.remove('active');
};

window.addDependencyFromModal = function() {
  const select = document.getElementById('addDependencySelect');
  const predId = select.value;
  if (!predId || !selectedNodeId) return;

  saveState();
  if (addDependency(projectData, predId, selectedNodeId)) {
    save();
    statusManager.show('Dependency added', true);
    addEdgeToNetwork(predId, selectedNodeId);
    renderApp({ fitView: false });
    openTaskModal(selectedNodeId);
  }
};

window.removePredecessor = function(predId, taskId) {
  saveState();
  if (removeDependency(projectData, predId, taskId)) {
    save();
    statusManager.show('Dependency removed', true);
    removeEdgeFromNetwork(predId, taskId);
    renderApp({ fitView: false });
    openTaskModal(taskId);
  }
};

window.removeSuccessor = function(taskId, succId) {
  saveState();
  if (removeDependency(projectData, taskId, succId)) {
    save();
    statusManager.show('Dependency removed', true);
    removeEdgeFromNetwork(taskId, succId);
    renderApp({ fitView: false });
    openTaskModal(taskId);
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

// ========== SEARCH ==========

function filterNodes(query) {
  searchQuery = query.toLowerCase();
  renderApp({ fitView: false });
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

window.exportToPNG = async function() {
  if (!hasNodes()) {
    statusManager.show('Nothing to export');
    return;
  }

  statusManager.show('Exporting PNG...');

  try {
    const dataUrl = await networkExportToPNG();
    const link = document.createElement('a');
    link.download = `${sanitizeFilename(projectData.project?.title || 'dependencies')}-deps.png`;
    link.href = dataUrl;
    link.click();
    statusManager.show('PNG exported', true);
  } catch (err) {
    console.error('Failed to export PNG:', err);
    statusManager.show('Export failed: ' + err.message);
  }
};

window.importProject = function() {
  document.getElementById('fileInput').click();
};

async function handleFileImport(e) {
  const file = e.target.files[0];
  if (!file) return;

  try {
    const imported = await readJSONFile(file);
    if (!imported.project || !imported.tasks || !imported.categories) {
      throw new Error('Invalid project file structure');
    }

    const migrated = migrateToLatest(imported);
    migrated.version = DATA_VERSION;

    projectData = migrated;
    selectedNodeId = null;

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
          selectedNodeId = null;
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
  closeTaskModal();
  const searchInput = document.getElementById('searchInput');
  if (document.activeElement === searchInput) {
    searchInput.blur();
    searchInput.value = '';
    filterNodes('');
  }
}

// ========== HELPER ==========

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text || '';
  return div.innerHTML;
}

// ========== EVENT LISTENERS ==========

function setupEventListeners() {
  // File input
  document.getElementById('fileInput').addEventListener('change', handleFileImport);

  // Modal overlays
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target.classList.contains('modal-overlay')) {
        closeModals();
      }
    });
  });

  // Search input
  document.getElementById('searchInput').addEventListener('input', (e) => filterNodes(e.target.value));

  // Category filter
  document.getElementById('categoryFilter').addEventListener('change', (e) => {
    categoryFilter = e.target.value || null;
    renderApp({ fitView: true });
  });

  // Status filter
  document.getElementById('statusFilter').addEventListener('change', (e) => {
    statusFilter = e.target.value || null;
    renderApp({ fitView: true });
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    const inInput = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT';

    if (e.key === 'Escape') {
      if (drawMode) {
        exitDrawMode();
      } else {
        closeModals();
      }
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
    } else if (e.key === '+' || e.key === '=') {
      zoomIn();
      e.preventDefault();
    } else if (e.key === '-') {
      zoomOut();
      e.preventDefault();
    } else if (e.key === '0') {
      resetZoom();
      e.preventDefault();
    }
  });
}

// ========== INITIALIZE ==========

init();
