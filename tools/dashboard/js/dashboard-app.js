/**
 * Dashboard App Module - Init, state management, orchestration
 * Main entry point for the Dashboard application
 */

// Import shared modules
import { saveToStorage, loadFromStorage } from '../../../shared/js/storage.js';
import { downloadJSON, readJSONFile, sanitizeFilename } from '../../../shared/js/export.js';
import { createStatusManager } from '../../../shared/js/status.js';
import { initNavigation } from '../../../shared/js/navigation.js';

// Import unified data module
import {
  DATA_VERSION,
  STORAGE_KEY,
  migrateToLatest,
  calculateProgress,
  calculateVariance,
  calculateVelocity,
  getBurndownData,
  getMilestones,
  calculateMilestoneStatus,
  getColumnTasks,
  calculateTeamCapacity,
  getWeekCapacityPercent,
  getWeekStart,
  getWeekEnd,
  defaultWorkflow
} from '../../../shared/js/unified-data.js';

// Import render module
import {
  renderProjectHealth,
  renderSprintStatus,
  renderTaskDistribution,
  renderMilestones,
  renderVelocity,
  renderTeamCapacity,
  renderQuickLinks
} from './dashboard-render.js';

// ========== APP STATE ==========

let projectData = null;
let statusManager = null;

// ========== INITIALIZATION ==========

export function init() {
  // Initialize managers
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
}

function getDefaultProjectData() {
  const today = new Date();
  const endDate = new Date(today);
  endDate.setDate(today.getDate() + 90); // 13 weeks

  return {
    version: DATA_VERSION,
    project: {
      title: 'New Project',
      startDate: today.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
      totalWeeks: 13
    },
    tasks: [],
    team: [],
    sprints: [],
    workflow: JSON.parse(JSON.stringify(defaultWorkflow)),
    timeEntries: [],
    retrospectives: [],
    calendarSettings: {
      workDays: [1, 2, 3, 4, 5],
      hoursPerDay: 8
    }
  };
}

// ========== RENDERING ==========

function renderApp() {
  // Update title
  document.getElementById('projectTitle').textContent = projectData.project.title || 'Dashboard';

  // Render all cards
  renderProjectHealth(projectData, 'projectHealthContent');
  renderSprintStatus(projectData, 'sprintStatusContent');
  renderTaskDistribution(projectData, 'taskDistributionContent');
  renderMilestones(projectData, 'milestonesContent');
  renderVelocity(projectData, 'velocityContent');
  renderTeamCapacity(projectData, 'teamCapacityContent');
  renderQuickLinks('quickLinksContent');
}

// ========== EVENT LISTENERS ==========

function setupEventListeners() {
  // File input for import
  const fileInput = document.getElementById('fileInput');
  if (fileInput) {
    fileInput.addEventListener('change', handleFileSelect);
  }

  // Card click navigation
  setupCardNavigation();

  // Keyboard shortcuts
  document.addEventListener('keydown', handleKeydown);
}

function setupCardNavigation() {
  const cardMappings = {
    'cardProjectHealth': '../gantt/index.html',
    'cardSprintStatus': '../burndown/index.html',
    'cardTaskDistribution': '../kanban/index.html',
    'cardMilestones': '../milestone-tracker/index.html',
    'cardVelocity': '../sprint/index.html',
    'cardTeamCapacity': '../resource-calendar/index.html'
  };

  Object.entries(cardMappings).forEach(([cardId, url]) => {
    const card = document.getElementById(cardId);
    if (card) {
      card.classList.add('dashboard-card--clickable');
      card.addEventListener('click', () => {
        window.location.href = url;
      });
      card.setAttribute('role', 'button');
      card.setAttribute('tabindex', '0');
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          window.location.href = url;
        }
      });
    }
  });
}

function handleKeydown(e) {
  // Skip if in input
  if (e.target.matches('input, textarea, select')) return;

  switch (e.key) {
    case '1':
      window.location.href = '../gantt/index.html';
      break;
    case '2':
      window.location.href = '../kanban/index.html';
      break;
    case '3':
      window.location.href = '../sprint/index.html';
      break;
    case '4':
      window.location.href = '../time-tracker/index.html';
      break;
    case '5':
      window.location.href = '../burndown/index.html';
      break;
    case '6':
      window.location.href = '../resource-calendar/index.html';
      break;
    case '7':
      window.location.href = '../milestone-tracker/index.html';
      break;
    case '8':
      window.location.href = '../retrospective/index.html';
      break;
    case '9':
      window.location.href = '../pert/index.html';
      break;
    case '?':
      showKeyboardHelp();
      break;
  }
}

function showKeyboardHelp() {
  statusManager.show('Shortcuts: 1-9 = tools, ? = help', 'info');
}

// ========== CROSS-TAB SYNC ==========

function setupStorageSync() {
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY && e.newValue) {
      try {
        const newData = JSON.parse(e.newValue);
        projectData = migrateToLatest(newData);
        renderApp();
        statusManager.show('Data synced from another tab', 'info');
      } catch (err) {
        console.error('Failed to sync data:', err);
      }
    }
  });
}

// ========== IMPORT/EXPORT ==========

async function handleFileSelect(e) {
  const file = e.target.files[0];
  if (!file) return;

  try {
    const data = await readJSONFile(file);
    projectData = migrateToLatest(data);
    saveToStorage(STORAGE_KEY, projectData);
    renderApp();
    statusManager.show('Project imported successfully', 'success');
  } catch (err) {
    statusManager.show('Failed to import: ' + err.message, 'error');
  }

  // Reset input
  e.target.value = '';
}

// Global function for button onclick
window.importProject = function() {
  document.getElementById('fileInput').click();
};

window.exportToJSON = function() {
  const filename = sanitizeFilename(projectData.project.title || 'project') + '.json';
  downloadJSON(projectData, filename);
  statusManager.show('Exported as ' + filename, 'success');
};

// ========== INIT ON DOM READY ==========

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
