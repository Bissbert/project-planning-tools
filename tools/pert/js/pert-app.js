/**
 * PERT App Module - Init, state management, orchestration
 * Main entry point for the PERT Chart application
 * Uses vis-network for interactive diagram rendering
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
  getMilestones
} from '../../../shared/js/unified-data.js';

// Import PERT modules
import { buildGraph, runPertAnalysis } from './pert-calc.js';
import { renderTable, renderSidebar, renderStats } from './pert-render.js';
import {
  addDependency,
  removeDependency,
  reverseDependency,
  getPotentialPredecessors,
  validateDependencies
} from './pert-edit.js';

// Import vis-network module
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
  destroyNetwork,
  // Incremental update functions
  addEdgeToNetwork,
  removeEdgeFromNetwork,
  updateNodesAppearance,
  updateEdgesAppearance,
  hasNodes
} from './pert-vis.js';

// ========== APP STATE ==========

let projectData = null;
let editMode = false;
let drawMode = false;
let currentView = 'diagram'; // 'diagram' or 'table'
let dataScope = 'milestones'; // 'milestones' or 'all'
let selectedNodeId = null;
let searchQuery = '';
let saveCount = 0;

// Sort state for table
let sortColumn = 'slack';
let sortDirection = 'asc';

// PERT analysis results
let pertResults = null;

// Managers
let undoManager = null;
let statusManager = null;

// Network initialized flag
let networkInitialized = false;

// ========== INITIALIZATION ==========

export function init() {
  // Initialize managers
  undoManager = createUndoManager(50);
  statusManager = createStatusManager('status');

  // Initialize navigation
  initNavigation();

  // Load data
  loadData();

  // Initialize vis-network
  initializeNetwork();

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

  // Validate dependencies
  const invalidCount = validateDependencies(projectData);
  if (invalidCount > 0) {
    console.log(`Removed ${invalidCount} invalid dependencies`);
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
    retrospectives: [],
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

  // Create auto-backup every 10 saves
  saveCount++;
  if (saveCount % 10 === 0) {
    createBackup(BACKUP_KEY, projectData);
  }
}

function saveState() {
  undoManager.saveState(projectData);
}

// ========== DATA PROCESSING ==========

function getTasksForScope() {
  if (dataScope === 'milestones') {
    // Return only milestone tasks
    return getMilestones(projectData.tasks);
  } else {
    // Return all tasks
    return projectData.tasks || [];
  }
}

function runAnalysis() {
  const tasks = getTasksForScope();
  const graph = buildGraph(tasks);

  if (graph.nodes.size === 0) {
    pertResults = null;
    return;
  }

  pertResults = runPertAnalysis(graph);
}

// ========== RENDER ==========

function renderApp(options = {}) {
  const { fitView = true } = options;

  // Update project title
  document.getElementById('projectTitle').textContent = projectData.project.title;

  // Run PERT analysis
  runAnalysis();

  // Render based on view
  if (currentView === 'diagram') {
    renderDiagramView({ fitView });
  } else {
    renderTableView();
  }

  // Update stats
  updateStats();

  // Update sidebar if node selected
  if (selectedNodeId && pertResults) {
    openSidebar();
  }
}

function renderDiagramView(options = {}) {
  const { fitView = true } = options;
  const emptyEl = document.getElementById('diagramEmpty');
  const networkContainer = document.getElementById('networkContainer');

  if (!pertResults || pertResults.graph.nodes.size === 0) {
    // Show empty state
    emptyEl.style.display = 'flex';
    networkContainer.style.display = 'none';
    updateNetwork(null, new Set(), { fitView: false });
    return;
  }

  emptyEl.style.display = 'none';
  networkContainer.style.display = 'block';

  // Build critical path set
  const criticalSet = new Set(pertResults.criticalPath);

  // Update vis-network (preserve view when just adding/removing edges)
  updateNetwork(pertResults, criticalSet, { fitView });
}

function renderTableView() {
  const tableBody = document.getElementById('pertTableBody');

  if (!pertResults || pertResults.graph.nodes.size === 0) {
    document.getElementById('tableEmpty').style.display = 'flex';
    document.querySelector('.table-container').style.display = 'none';
    return;
  }

  document.getElementById('tableEmpty').style.display = 'none';
  document.querySelector('.table-container').style.display = '';

  renderTable({
    tableBody,
    graph: pertResults.graph,
    criticalPath: pertResults.criticalPath,
    selectedNodeId,
    sortColumn,
    sortDirection,
    handlers: getHandlers(),
    searchQuery
  });
}

/**
 * Update stats display without re-rendering the network
 */
function updateStats() {
  if (pertResults) {
    renderStats({
      graph: pertResults.graph,
      criticalPath: pertResults.criticalPath,
      projectDuration: pertResults.projectDuration
    });
  } else {
    document.getElementById('nodeCount').textContent = '0';
    document.getElementById('projectDuration').textContent = '0w';
    document.getElementById('criticalCount').textContent = '0';
  }
}

/**
 * Refresh network appearance after PERT data changes
 * This updates node/edge labels and colors without rebuilding the network structure
 */
function refreshNetworkAppearance() {
  runAnalysis();
  const criticalSet = new Set(pertResults?.criticalPath || []);
  updateNodesAppearance(pertResults, criticalSet);
  updateEdgesAppearance(pertResults, criticalSet);
  updateStats();

  // Update sidebar if open
  if (selectedNodeId) {
    openSidebar();
  }
}

// ========== EVENT HANDLERS ==========

function getHandlers() {
  return {
    onNodeClick: handleNodeClick,
    onNodeDblClick: handleNodeDoubleClick
  };
}

function handleNodeSelect(nodeId) {
  selectedNodeId = nodeId;
  if (nodeId) {
    openSidebar();
  } else {
    closeSidebar();
  }
}

function handleNodeClick(nodeId, event) {
  selectedNodeId = nodeId;
  networkSelectNode(nodeId);
  openSidebar();
}

function handleNodeDoubleClick(nodeId) {
  selectedNodeId = nodeId;
  openTaskModal(nodeId);
}

function handleEdgeAdd(fromId, toId) {
  // Validate and add dependency
  saveState();
  if (addDependency(projectData, fromId, toId)) {
    save();
    statusManager.show('Dependency created', true);

    // Incremental update (doesn't rebuild the network)
    addEdgeToNetwork(fromId, toId, false);
    refreshNetworkAppearance();

    // Re-enter edge drawing mode (vis-network exits addEdgeMode after each edge)
    // This is now reliable because we're not rebuilding the network
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

    // Incremental update (doesn't rebuild the network)
    removeEdgeFromNetwork(fromId, toId);
    refreshNetworkAppearance();

    // Re-enter edge drawing mode if still in edit mode
    if (editMode && drawMode) {
      startEdgeDrawing();
    }
  }
}

// ========== VIEW SWITCHING ==========

window.setView = function(view) {
  currentView = view;

  // Update button states
  document.getElementById('diagramViewBtn').classList.toggle('view-toggle-btn--active', view === 'diagram');
  document.getElementById('tableViewBtn').classList.toggle('view-toggle-btn--active', view === 'table');

  // Show/hide views
  document.getElementById('diagramView').style.display = view === 'diagram' ? '' : 'none';
  document.getElementById('tableView').style.display = view === 'table' ? '' : 'none';

  // Exit draw mode when switching views
  if (drawMode) {
    exitDrawMode();
  }

  renderApp();
};

window.setDataScope = function(scope) {
  dataScope = scope;

  // Update button states
  document.getElementById('milestonesOnlyBtn').classList.toggle('scope-toggle-btn--active', scope === 'milestones');
  document.getElementById('allTasksBtn').classList.toggle('scope-toggle-btn--active', scope === 'all');

  // Clear selection
  selectedNodeId = null;
  networkSelectNode(null);
  closeSidebar();

  renderApp();
};

// ========== EDIT MODE ==========

window.toggleEditMode = function() {
  editMode = !editMode;
  document.body.classList.toggle('edit-mode', editMode);
  document.getElementById('editToggle').textContent = editMode ? 'View' : 'Edit';

  // Update vis-network manipulation mode
  setNetworkEditMode(editMode);

  if (!editMode && drawMode) {
    // Exit draw mode when leaving edit mode
    exitDrawMode();
  }

  renderApp({ fitView: false }); // Preserve view when toggling edit mode

  // Enter edge drawing mode AFTER render (so network state isn't reset)
  if (editMode && currentView === 'diagram') {
    setTimeout(() => enterDrawMode(), 50);
  }
};

// ========== DRAW MODE ==========

function enterDrawMode() {
  if (!pertResults || pertResults.graph.nodes.size === 0) {
    return;
  }
  drawMode = true;
  startEdgeDrawing();
}

function exitDrawMode() {
  drawMode = false;
  stopEdgeDrawing();
}

// ========== ZOOM/PAN ==========

window.zoomIn = function() {
  networkZoomIn();
};

window.zoomOut = function() {
  networkZoomOut();
};

window.resetZoom = function() {
  networkResetView();
};

// ========== SIDEBAR ==========

function openSidebar() {
  const sidebar = document.getElementById('pertSidebar');
  sidebar.classList.add('pert-sidebar--open');

  if (pertResults && selectedNodeId) {
    renderSidebar({
      container: document.getElementById('sidebarContent'),
      graph: pertResults.graph,
      nodeId: selectedNodeId,
      editMode,
      handlers: getHandlers()
    });
  }
}

window.closeSidebar = function() {
  const sidebar = document.getElementById('pertSidebar');
  sidebar.classList.remove('pert-sidebar--open');
  selectedNodeId = null;
  networkSelectNode(null);
};

// Expose closeSidebar for internal use
function closeSidebar() {
  window.closeSidebar();
}

// ========== TASK MODAL ==========

function openTaskModal(nodeId) {
  if (!pertResults) return;

  const node = pertResults.graph.nodes.get(nodeId);
  if (!node) return;

  document.getElementById('taskModalTitle').textContent = node.name;

  // Populate PERT values
  const valuesEl = document.getElementById('taskPertValues');
  valuesEl.innerHTML = `
    <div class="pert-value-card">
      <span class="pert-value-card__label">ES</span>
      <span class="pert-value-card__value">${node.es}</span>
    </div>
    <div class="pert-value-card">
      <span class="pert-value-card__label">EF</span>
      <span class="pert-value-card__value">${node.ef}</span>
    </div>
    <div class="pert-value-card">
      <span class="pert-value-card__label">LS</span>
      <span class="pert-value-card__value">${node.ls}</span>
    </div>
    <div class="pert-value-card">
      <span class="pert-value-card__label">LF</span>
      <span class="pert-value-card__value">${node.lf}</span>
    </div>
    <div class="pert-value-card">
      <span class="pert-value-card__label">Duration</span>
      <span class="pert-value-card__value">${node.duration}w</span>
    </div>
    <div class="pert-value-card ${node.slack === 0 ? 'pert-value-card--highlight' : ''}">
      <span class="pert-value-card__label">Slack</span>
      <span class="pert-value-card__value">${node.slack}</span>
    </div>
  `;

  // Populate predecessors
  const predsEl = document.getElementById('taskPredecessors');
  const predecessors = [];
  pertResults.graph.reverse.get(nodeId)?.forEach(predId => {
    const pred = pertResults.graph.nodes.get(predId);
    if (pred) predecessors.push(pred);
  });

  predsEl.innerHTML = predecessors.length > 0
    ? predecessors.map(pred => `
        <div class="dependency-item">
          <div class="dependency-item__info">
            <span class="dependency-item__name">${escapeHtml(pred.name)}</span>
            ${pred.isCritical ? '<span class="dependency-item__badge dependency-item__badge--critical">Critical</span>' : ''}
          </div>
          ${editMode ? `<button class="dependency-item__remove" onclick="removePredecessor('${pred.id}', '${nodeId}')">&times;</button>` : ''}
        </div>
      `).join('')
    : '<p class="dependency-empty">No predecessors</p>';

  // Populate successors
  const succsEl = document.getElementById('taskSuccessors');
  const successors = [];
  pertResults.graph.adjacency.get(nodeId)?.forEach(succId => {
    const succ = pertResults.graph.nodes.get(succId);
    if (succ) successors.push(succ);
  });

  succsEl.innerHTML = successors.length > 0
    ? successors.map(succ => `
        <div class="dependency-item">
          <div class="dependency-item__info">
            <span class="dependency-item__name">${escapeHtml(succ.name)}</span>
            ${succ.isCritical ? '<span class="dependency-item__badge dependency-item__badge--critical">Critical</span>' : ''}
          </div>
          ${editMode ? `<button class="dependency-item__remove" onclick="removeSuccessor('${nodeId}', '${succ.id}')">&times;</button>` : ''}
        </div>
      `).join('')
    : '<p class="dependency-empty">No successors</p>';

  // Populate add dependency dropdown
  const addSelect = document.getElementById('addDependencySelect');
  const potentialPreds = getPotentialPredecessors(projectData, nodeId);
  addSelect.innerHTML = '<option value="">Select a predecessor...</option>' +
    potentialPreds.map(t => `<option value="${t.id}">${escapeHtml(t.name)}</option>`).join('');

  document.getElementById('taskModal').classList.add('active');
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

    // Incremental update
    addEdgeToNetwork(predId, selectedNodeId, false);
    refreshNetworkAppearance();

    // Refresh the modal to show updated dependencies
    openTaskModal(selectedNodeId);
  }
};

window.removePredecessor = function(predId, taskId) {
  saveState();
  if (removeDependency(projectData, predId, taskId)) {
    save();
    statusManager.show('Dependency removed', true);

    // Incremental update
    removeEdgeFromNetwork(predId, taskId);
    refreshNetworkAppearance();

    // Refresh the modal to show updated dependencies
    openTaskModal(taskId);
  }
};

window.removeSuccessor = function(taskId, succId) {
  saveState();
  if (removeDependency(projectData, taskId, succId)) {
    save();
    statusManager.show('Dependency removed', true);

    // Incremental update
    removeEdgeFromNetwork(taskId, succId);
    refreshNetworkAppearance();

    // Refresh the modal to show updated dependencies
    openTaskModal(taskId);
  }
};

// Global function for sidebar
window.removeDependency = function(fromId, toId) {
  saveState();
  if (removeDependency(projectData, fromId, toId)) {
    save();
    statusManager.show('Dependency removed', true);

    // Incremental update
    removeEdgeFromNetwork(fromId, toId);
    refreshNetworkAppearance();
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

window.exportToPNG = async function() {
  if (!pertResults || pertResults.graph.nodes.size === 0) {
    statusManager.show('Nothing to export');
    return;
  }

  try {
    const dataUrl = await networkExportToPNG();

    // Download
    const link = document.createElement('a');
    link.download = `${sanitizeFilename(projectData.project.title)}-pert.png`;
    link.href = dataUrl;
    link.click();

    statusManager.show('PNG exported', true);
  } catch (err) {
    console.error('Failed to export PNG:', err);
    statusManager.show('Export failed');
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

    // Validate structure
    if (!imported.project || !imported.tasks || !imported.categories) {
      throw new Error('Invalid project file structure');
    }

    // Migrate if needed
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

          // Update selected node if it no longer exists
          if (selectedNodeId) {
            const task = projectData.tasks.find(t => t.id === selectedNodeId);
            if (!task) {
              selectedNodeId = null;
              networkSelectNode(null);
              closeSidebar();
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
  closeTaskModal();
  const searchInput = document.getElementById('searchInput');
  if (document.activeElement === searchInput) {
    searchInput.blur();
    searchInput.value = '';
    filterNodes('');
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

  // Search input
  document.getElementById('searchInput').addEventListener('input', (e) => filterNodes(e.target.value));

  // Table header sorting
  document.querySelectorAll('.pert-table th.sortable').forEach(th => {
    th.addEventListener('click', () => {
      const column = th.dataset.sort;
      if (sortColumn === column) {
        sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
      } else {
        sortColumn = column;
        sortDirection = 'asc';
      }

      // Update UI
      document.querySelectorAll('.pert-table th.sortable').forEach(h => {
        h.classList.remove('sorted-asc', 'sorted-desc');
      });
      th.classList.add(`sorted-${sortDirection}`);

      renderApp();
    });
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    const inInput = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA';

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
    } else if (e.key === 'g' && !e.ctrlKey && !e.metaKey) {
      setView('diagram');
      e.preventDefault();
    } else if (e.key === 't' && !e.ctrlKey && !e.metaKey) {
      setView('table');
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
