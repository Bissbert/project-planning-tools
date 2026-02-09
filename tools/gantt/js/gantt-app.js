/**
 * Gantt App Module - Init, keyboard shortcuts, orchestration
 * Main entry point for the Gantt chart application
 */

// Import shared modules
import { saveToStorage, loadFromStorage } from '../../../shared/js/storage.js';
import { createBackup, restoreBackup as restoreFromBackup } from '../../../shared/js/backup.js';
import { createUndoManager } from '../../../shared/js/undo.js';
import { downloadJSON, readJSONFile, sanitizeFilename, triggerPrint } from '../../../shared/js/export.js';
import { createStatusManager } from '../../../shared/js/status.js';
import { initNavigation } from '../../../shared/js/navigation.js';
import { initExportDropdown } from '../../../shared/js/export-dropdown.js';

// Import gantt-specific modules
import {
  DATA_VERSION,
  STORAGE_KEY,
  BACKUP_KEY,
  defaultProjectData,
  migrateProjectData,
  migrateTask,
  calculateWeeksFromDates,
  generateMonthsFromDateRange,
  cloneProjectData,
  syncGanttToKanban
} from './gantt-data.js';

import { render } from './gantt-render.js';

import {
  addTask,
  deleteTask,
  duplicateTask,
  copyPlannedToReality,
  moveTaskToCategory,
  updateTaskDetails,
  setTaskWeekRange,
  toggleWeek,
  fillWeekRange,
  addCategory,
  deleteCategory,
  setCategoryColor,
  reorderCategories,
  reorderTasks,
  startRenameTask,
  startRenameCategory,
  startEditTitle
} from './gantt-edit.js';

// ========== APP STATE ==========

let projectData = null;
let editMode = false;
let collapsedCategories = new Set();
let searchQuery = '';
let saveCount = 0;

// Drag state
let draggedTaskId = null;
let draggedCategory = null;
let rangeStartCell = null;
let activeDropdown = null;

// Popover state
let currentPopoverTaskId = null;
let currentRangeTaskId = null;

// Temp team for settings
let tempTeam = [];

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

  // Initialize export dropdown
  initExportDropdown();

  // Try to load from localStorage first
  const saved = loadFromStorage(STORAGE_KEY);
  if (saved) {
    try {
      // Check version - if old or missing, migrate
      if (!saved.version || saved.version < DATA_VERSION) {
        console.log('Migrating data to new format...');
        projectData = migrateProjectData(saved);
      } else {
        projectData = saved;
      }
    } catch (e) {
      console.error('Failed to parse saved data:', e);
      projectData = cloneProjectData(defaultProjectData);
    }
  } else {
    projectData = cloneProjectData(defaultProjectData);
  }

  // Ensure version is set
  projectData.version = DATA_VERSION;

  // Ensure team array exists (v3 migration)
  if (!projectData.team) {
    projectData.team = [];
  }

  // Ensure endDate exists (v4 migration)
  if (!projectData.project.endDate) {
    migrateProjectData(projectData);
  }

  // Remove months array if it still exists (cleanup)
  if (projectData.months) {
    delete projectData.months;
  }

  // Migrate tasks
  projectData.tasks.forEach(task => migrateTask(task));

  // Save migrated data and create initial backup
  save();
  createBackup(BACKUP_KEY, projectData);

  // Setup event listeners
  setupEventListeners();

  // Setup cross-tab sync
  setupStorageSync();

  // Initial render
  renderApp();
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
  render(projectData, editMode, collapsedCategories, searchQuery, getHandlers());
}

// ========== EVENT HANDLERS OBJECT ==========

function getHandlers() {
  return {
    // Title
    onEditTitle: () => {
      if (!editMode) return;
      saveState();
      startEditTitle(projectData, () => {
        save();
        renderApp();
      });
    },

    // Tasks
    onAddTask: (category) => {
      saveState();
      if (addTask(projectData, category)) {
        save();
        renderApp();
      }
    },
    onDelete: (taskId) => {
      saveState();
      if (deleteTask(projectData, taskId)) {
        save();
        renderApp();
      }
    },
    onRenameTask: (element, taskId) => {
      if (!editMode) return;
      saveState();
      startRenameTask(element, taskId, projectData, () => {
        save();
        renderApp();
      });
    },
    onDuplicate: (taskId) => {
      saveState();
      if (duplicateTask(projectData, taskId)) {
        save();
        renderApp();
        statusManager.show('Task duplicated', true);
      }
    },
    onCopyToReality: (taskId) => {
      saveState();
      if (copyPlannedToReality(projectData, taskId)) {
        // Sync to Kanban
        const task = projectData.tasks.find(t => t.id === taskId);
        if (task) {
          syncGanttToKanban(task, projectData.workflow);
        }
        save();
        renderApp();
        statusManager.show('Copied to reality', true);
      } else {
        statusManager.show('No planned weeks to copy');
      }
    },

    // Week cells
    onWeekClick: (e, taskId, week, type) => handleWeekClick(e, taskId, week, type),

    // Task drag-drop
    onDragStart: (e, taskId) => handleDragStart(e, taskId),
    onDragEnd: handleDragEnd,
    onDragOver: (e, taskId) => handleDragOver(e, taskId),
    onDrop: (e, taskId, category) => handleDrop(e, taskId, category),

    // Categories
    onAddCategory: () => {
      saveState();
      if (addCategory(projectData)) {
        save();
        renderApp();
      }
    },
    onDeleteCategory: (categoryName) => {
      saveState();
      if (deleteCategory(projectData, categoryName)) {
        save();
        renderApp();
      }
    },
    onSetCategoryColor: (categoryName, color) => {
      saveState();
      setCategoryColor(projectData, categoryName, color);
      save();
      renderApp();
    },
    onRenameCategory: (element, categoryName) => {
      if (!editMode) return;
      saveState();
      startRenameCategory(element, categoryName, projectData, () => {
        save();
        renderApp();
      });
    },
    onToggleCollapse: (category) => {
      if (collapsedCategories.has(category)) {
        collapsedCategories.delete(category);
      } else {
        collapsedCategories.add(category);
      }
      renderApp();
    },

    // Category drag-drop
    onCategoryDragStart: (e, category) => handleCategoryDragStart(e, category),
    onCategoryDragEnd: handleCategoryDragEnd,
    onCategoryDragOver: (e, category) => handleCategoryDragOver(e, category),
    onCategoryDrop: (e, category) => handleCategoryDrop(e, category),

    // Dropdowns and modals
    onToggleMoveDropdown: (dropdown, task) => toggleMoveDropdown(dropdown, task),
    onOpenPopover: (taskId, anchorEl) => openTaskPopover(taskId, anchorEl),
    onOpenRangePicker: (taskId) => openRangePicker(taskId)
  };
}

// ========== WEEK CLICK HANDLING ==========

function handleWeekClick(e, taskId, week, type) {
  const task = projectData.tasks.find(t => t.id === taskId);
  if (!task) return;

  if (e.shiftKey && rangeStartCell && rangeStartCell.taskId === taskId && rangeStartCell.type === type) {
    // Shift+click: fill range
    saveState();
    const isAdding = !task[type].includes(rangeStartCell.week);
    fillWeekRange(projectData, taskId, rangeStartCell.week, week, type, isAdding);
    rangeStartCell = null;

    // Sync to Kanban if reality changed
    if (type === 'reality') {
      syncGanttToKanban(task, projectData.workflow);
    }

    save();
    renderApp();
  } else {
    // Regular click: toggle single cell and set as range start
    rangeStartCell = { taskId, week, type };
    saveState();
    toggleWeek(projectData, taskId, week, type);

    // Sync to Kanban if reality changed
    if (type === 'reality') {
      syncGanttToKanban(task, projectData.workflow);
    }

    save();
    renderApp();
  }
}

// ========== TASK DRAG AND DROP ==========

function handleDragStart(e, taskId) {
  draggedTaskId = taskId;
  e.target.closest('.task-row')?.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
}

function handleDragEnd() {
  draggedTaskId = null;
  document.querySelectorAll('.task-row').forEach(row => {
    row.classList.remove('dragging', 'drag-over');
  });
}

function handleDragOver(e, taskId) {
  e.preventDefault();
  if (draggedTaskId === null || draggedTaskId === taskId) return;

  document.querySelectorAll('.task-row').forEach(row => row.classList.remove('drag-over'));

  const row = e.target.closest('.task-row');
  if (row) row.classList.add('drag-over');
}

function handleDrop(e, targetTaskId, targetCategory) {
  e.preventDefault();
  if (draggedTaskId === null) return;

  saveState();
  if (reorderTasks(projectData, draggedTaskId, targetTaskId, targetCategory)) {
    save();
    renderApp();
  }
  draggedTaskId = null;
}

// ========== CATEGORY DRAG AND DROP ==========

function handleCategoryDragStart(e, category) {
  draggedCategory = category;
  e.target.closest('.category-row')?.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
}

function handleCategoryDragEnd() {
  draggedCategory = null;
  document.querySelectorAll('.category-row').forEach(row => {
    row.classList.remove('dragging', 'drag-over');
  });
}

function handleCategoryDragOver(e, targetCategory) {
  e.preventDefault();
  if (draggedCategory === null || draggedCategory === targetCategory) return;

  document.querySelectorAll('.category-row').forEach(row => row.classList.remove('drag-over'));

  const row = e.target.closest('.category-row');
  if (row) row.classList.add('drag-over');
}

function handleCategoryDrop(e, targetCategory) {
  e.preventDefault();
  if (draggedCategory === null || draggedCategory === targetCategory) return;

  saveState();
  if (reorderCategories(projectData, draggedCategory, targetCategory)) {
    save();
    renderApp();
    statusManager.show('Category reordered', true);
  }
  draggedCategory = null;
}

// ========== MOVE DROPDOWN ==========

function toggleMoveDropdown(dropdownEl, task) {
  const content = dropdownEl.querySelector('.move-dropdown-content');

  // Close other dropdowns first
  if (activeDropdown && activeDropdown !== content) {
    activeDropdown.classList.remove('show');
  }

  // Toggle this dropdown
  const isOpen = content.classList.contains('show');

  if (isOpen) {
    content.classList.remove('show');
    activeDropdown = null;
  } else {
    // Populate dropdown with categories
    content.innerHTML = '';
    Object.entries(projectData.categories).forEach(([cat, color]) => {
      const item = document.createElement('div');
      item.className = 'move-dropdown-item' + (cat === task.category ? ' current' : '');
      item.innerHTML = `<span class="category-dot" style="background: ${color}"></span>${cat}${cat === task.category ? ' (current)' : ''}`;

      if (cat !== task.category) {
        item.addEventListener('click', (e) => {
          e.stopPropagation();
          saveState();
          moveTaskToCategory(projectData, task.id, cat);
          closeMoveDropdowns();
          save();
          renderApp();
          statusManager.show(`Moved to ${cat}`, true);
        });
      }
      content.appendChild(item);
    });

    content.classList.add('show');
    activeDropdown = content;
  }
}

function closeMoveDropdowns() {
  document.querySelectorAll('.move-dropdown-content').forEach(d => d.classList.remove('show'));
  activeDropdown = null;
}

// ========== TASK EDIT POPOVER ==========

function openTaskPopover(taskId, anchorEl) {
  const task = projectData.tasks.find(t => t.id === taskId);
  if (!task) return;

  currentPopoverTaskId = taskId;

  // Populate form
  document.getElementById('popoverTaskName').textContent = task.name;

  // Populate assignee dropdown
  const assigneeSelect = document.getElementById('popoverAssignee');
  assigneeSelect.innerHTML = '<option value="">Unassigned</option>';
  (projectData.team || []).forEach(member => {
    const opt = document.createElement('option');
    opt.value = member;
    opt.textContent = member;
    if (member === task.assignee) opt.selected = true;
    assigneeSelect.appendChild(opt);
  });

  document.getElementById('popoverPriority').value = task.priority || '';
  document.getElementById('popoverMilestone').checked = task.isMilestone || false;
  document.getElementById('popoverNotes').value = task.notes || '';

  // Position popover near anchor
  const popover = document.getElementById('taskEditPopover');
  const rect = anchorEl.getBoundingClientRect();
  popover.style.top = `${rect.bottom + 8}px`;
  popover.style.left = `${Math.min(rect.left, window.innerWidth - 280)}px`;
  popover.classList.add('active');

  // Close on outside click
  setTimeout(() => {
    document.addEventListener('click', handlePopoverOutsideClick);
  }, 0);
}

function handlePopoverOutsideClick(e) {
  const popover = document.getElementById('taskEditPopover');
  if (!popover.contains(e.target)) {
    closeTaskPopover();
  }
}

function closeTaskPopover() {
  document.getElementById('taskEditPopover').classList.remove('active');
  document.removeEventListener('click', handlePopoverOutsideClick);
  currentPopoverTaskId = null;
}

function saveTaskPopover() {
  if (!currentPopoverTaskId) return;

  saveState();
  updateTaskDetails(projectData, currentPopoverTaskId, {
    assignee: document.getElementById('popoverAssignee').value,
    priority: document.getElementById('popoverPriority').value,
    isMilestone: document.getElementById('popoverMilestone').checked,
    notes: document.getElementById('popoverNotes').value
  });

  save();
  closeTaskPopover();
  renderApp();
  statusManager.show('Task updated', true);
}

// ========== WEEK RANGE PICKER ==========

function openRangePicker(taskId) {
  const task = projectData.tasks.find(t => t.id === taskId);
  if (!task) return;

  currentRangeTaskId = taskId;

  const planned = task.planned || [];
  const startWeek = planned.length > 0 ? Math.min(...planned) : 1;
  const endWeek = planned.length > 0 ? Math.max(...planned) : 1;

  document.getElementById('rangeStartWeek').value = startWeek;
  document.getElementById('rangeEndWeek').value = endWeek;
  document.getElementById('rangeStartWeek').max = projectData.project.totalWeeks;
  document.getElementById('rangeEndWeek').max = projectData.project.totalWeeks;

  document.getElementById('rangePickerOverlay').classList.add('active');
  document.getElementById('rangeStartWeek').focus();
}

function closeRangePicker(e) {
  if (e && e.target !== document.getElementById('rangePickerOverlay')) return;
  document.getElementById('rangePickerOverlay').classList.remove('active');
  currentRangeTaskId = null;
}

function applyWeekRange() {
  if (!currentRangeTaskId) return;

  const startWeek = parseInt(document.getElementById('rangeStartWeek').value) || 1;
  const endWeek = parseInt(document.getElementById('rangeEndWeek').value) || startWeek;

  saveState();
  if (setTaskWeekRange(projectData, currentRangeTaskId, startWeek, endWeek)) {
    save();
    closeRangePicker();
    renderApp();
    statusManager.show('Week range updated', true);
  } else {
    statusManager.show('Invalid week range', false);
  }
}

// ========== SETTINGS MODAL ==========

function openSettings() {
  document.getElementById('settingsTitle').value = projectData.project.title || projectData.project.name || '';
  document.getElementById('settingsStartDate').value = projectData.project.startDate;
  document.getElementById('settingsEndDate').value = projectData.project.endDate;
  updateProjectDatesPreview();
  // Initialize team list
  tempTeam = [...(projectData.team || [])];
  renderTeamList();
  document.getElementById('settingsModal').classList.add('active');
}

function closeSettings() {
  document.getElementById('settingsModal').classList.remove('active');
}

function updateProjectDatesPreview() {
  const startDate = document.getElementById('settingsStartDate').value;
  const endDate = document.getElementById('settingsEndDate').value;
  const datesEl = document.getElementById('projectDates');

  if (!startDate || !endDate) {
    datesEl.textContent = 'Select both start and end dates';
    return;
  }

  const start = new Date(startDate);
  const end = new Date(endDate);

  if (end <= start) {
    datesEl.innerHTML = '<span style="color: #ef4444;">End date must be after start date</span>';
    return;
  }

  const totalWeeks = calculateWeeksFromDates(startDate, endDate);

  const fmt = (d) => d.toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
  });

  datesEl.innerHTML = `
    <strong>Duration:</strong> ${totalWeeks} weeks (~${Math.round(totalWeeks / 4.33)} months)<br>
    <strong>Timeline:</strong> ${fmt(start)} \u2192 ${fmt(end)}
  `;
}

function saveSettings() {
  const title = document.getElementById('settingsTitle').value.trim();
  const startDate = document.getElementById('settingsStartDate').value;
  const endDate = document.getElementById('settingsEndDate').value;

  if (!startDate || !endDate) {
    alert('Please set both start and end dates');
    return;
  }

  if (new Date(endDate) <= new Date(startDate)) {
    alert('End date must be after start date');
    return;
  }

  const totalWeeks = calculateWeeksFromDates(startDate, endDate);

  if (totalWeeks < 1) {
    alert('Project must have at least 1 week');
    return;
  }

  saveState();

  // Update project data
  projectData.project.title = title || 'Untitled Project';
  projectData.project.startDate = startDate;
  projectData.project.endDate = endDate;
  projectData.project.totalWeeks = totalWeeks;
  projectData.team = [...tempTeam];

  save();
  createBackup(BACKUP_KEY, projectData);
  closeSettings();
  renderApp();
  statusManager.show('Settings saved', true);
}

function renderTeamList() {
  const container = document.getElementById('teamList');
  container.innerHTML = '';

  tempTeam.forEach((member, index) => {
    const memberDiv = document.createElement('div');
    memberDiv.className = 'team-member';

    const nameSpan = document.createElement('span');
    nameSpan.textContent = member;
    memberDiv.appendChild(nameSpan);

    const removeBtn = document.createElement('button');
    removeBtn.className = 'team-member__remove';
    removeBtn.innerHTML = '\u00D7';
    removeBtn.title = 'Remove team member';
    removeBtn.addEventListener('click', () => {
      tempTeam.splice(index, 1);
      renderTeamList();
    });
    memberDiv.appendChild(removeBtn);

    container.appendChild(memberDiv);
  });
}

function addTeamMember() {
  const input = document.getElementById('newTeamMember');
  const name = input.value.trim();

  if (name && !tempTeam.includes(name)) {
    tempTeam.push(name);
    renderTeamList();
    input.value = '';
  }
  input.focus();
}

// ========== EDIT MODE ==========

function toggleEditMode() {
  editMode = !editMode;
  document.body.classList.toggle('edit-mode', editMode);
  document.getElementById('editToggle').textContent = editMode ? 'View' : 'Edit';
  renderApp();
}

// ========== COLLAPSE ALL ==========

function toggleAllCategories() {
  const categories = [...new Set(projectData.tasks.map(t => t.category))];
  if (collapsedCategories.size === categories.length) {
    collapsedCategories.clear();
  } else {
    categories.forEach(c => collapsedCategories.add(c));
  }
  renderApp();
}

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

function exportToJSON() {
  const projectName = projectData.project.title || projectData.project.name || 'project';
  const filename = sanitizeFilename(projectName);
  downloadJSON(projectData, filename);
  statusManager.show('JSON exported', true);
}

function exportToExcel() {
  const projectName = projectData.project.title || projectData.project.name || 'project';
  const xml = generateExcelXML();
  const blob = new Blob([xml], { type: 'application/vnd.ms-excel' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `${sanitizeFilename(projectName)}.xls`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  statusManager.show('Excel exported', true);
}

function generateExcelXML() {
  const totalWeeks = projectData.project.totalWeeks;

  // Helper to convert hex color to SpreadsheetML format
  const formatColor = (hex) => hex.replace('#', '').toUpperCase();

  // Build styles for each category color
  let styles = `
    <Style ss:ID="Default">
      <Font ss:FontName="Arial" ss:Size="10"/>
    </Style>
    <Style ss:ID="Title">
      <Font ss:FontName="Arial" ss:Size="14" ss:Bold="1"/>
    </Style>
    <Style ss:ID="Header">
      <Font ss:FontName="Arial" ss:Size="9" ss:Bold="1" ss:Color="#FFFFFF"/>
      <Interior ss:Color="#2A2A2A" ss:Pattern="Solid"/>
      <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#444444"/>
        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#444444"/>
      </Borders>
    </Style>
    <Style ss:ID="WeekHeader">
      <Font ss:FontName="Arial" ss:Size="8" ss:Bold="1" ss:Color="#333333"/>
      <Interior ss:Color="#F0F0F0" ss:Pattern="Solid"/>
      <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#CCCCCC"/>
        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#DDDDDD"/>
      </Borders>
    </Style>
    <Style ss:ID="TaskName">
      <Font ss:FontName="Arial" ss:Size="9"/>
      <Alignment ss:Vertical="Center"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E5E5"/>
      </Borders>
    </Style>
    <Style ss:ID="TypePlan">
      <Font ss:FontName="Arial" ss:Size="8" ss:Color="#666666"/>
      <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E5E5"/>
      </Borders>
    </Style>
    <Style ss:ID="TypeReal">
      <Font ss:FontName="Arial" ss:Size="8" ss:Color="#999999" ss:Italic="1"/>
      <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E5E5"/>
      </Borders>
    </Style>
    <Style ss:ID="EmptyCell">
      <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E5E5"/>
        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#EEEEEE"/>
      </Borders>
    </Style>`;

  // Add category-specific styles
  Object.entries(projectData.categories).forEach(([cat, color]) => {
    const colorHex = formatColor(color);
    const styleId = cat.replace(/[^a-zA-Z0-9]/g, '');
    styles += `
    <Style ss:ID="Cat${styleId}">
      <Font ss:FontName="Arial" ss:Size="9" ss:Bold="1" ss:Color="#FFFFFF"/>
      <Interior ss:Color="#${colorHex}" ss:Pattern="Solid"/>
      <Alignment ss:Vertical="Center"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#333333"/>
      </Borders>
    </Style>
    <Style ss:ID="Active${styleId}">
      <Interior ss:Color="#${colorHex}" ss:Pattern="Solid"/>
      <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E5E5"/>
        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#EEEEEE"/>
      </Borders>
    </Style>`;
  });

  // Build rows
  let rows = '';

  // Title row
  const excelTitle = projectData.project.title || projectData.project.name || 'Project';
  rows += `<Row ss:Height="20">
    <Cell ss:StyleID="Title"><Data ss:Type="String">${excelTitle}</Data></Cell>
  </Row>
  <Row ss:Height="16">
    <Cell><Data ss:Type="String">Start: ${projectData.project.startDate} | Weeks: ${totalWeeks}</Data></Cell>
  </Row>
  <Row></Row>`;

  // Month header row
  const months = generateMonthsFromDateRange(projectData.project);
  rows += `<Row ss:Height="22">
    <Cell ss:StyleID="Header"><Data ss:Type="String">Task</Data></Cell>
    <Cell ss:StyleID="Header"><Data ss:Type="String">Type</Data></Cell>`;
  months.forEach(month => {
    rows += `<Cell ss:StyleID="Header" ss:MergeAcross="${month.weeks - 1}"><Data ss:Type="String">${month.name}</Data></Cell>`;
  });
  rows += `</Row>`;

  // Week header row
  rows += `<Row ss:Height="18">
    <Cell ss:StyleID="WeekHeader"></Cell>
    <Cell ss:StyleID="WeekHeader"></Cell>`;
  for (let w = 1; w <= totalWeeks; w++) {
    rows += `<Cell ss:StyleID="WeekHeader"><Data ss:Type="String">W${w}</Data></Cell>`;
  }
  rows += `</Row>`;

  // Category and task rows
  const categories = [...new Set(projectData.tasks.map(t => t.category))];
  categories.forEach(category => {
    const styleId = category.replace(/[^a-zA-Z0-9]/g, '');

    // Category row
    rows += `<Row ss:Height="20">
      <Cell ss:StyleID="Cat${styleId}" ss:MergeAcross="${totalWeeks + 1}"><Data ss:Type="String">${category}</Data></Cell>
    </Row>`;

    // Tasks
    const categoryTasks = projectData.tasks.filter(t => t.category === category);
    categoryTasks.forEach(task => {
      // Planned row
      rows += `<Row ss:Height="18">
        <Cell ss:StyleID="TaskName"><Data ss:Type="String">${task.name}</Data></Cell>
        <Cell ss:StyleID="TypePlan"><Data ss:Type="String">Plan</Data></Cell>`;
      for (let w = 1; w <= totalWeeks; w++) {
        const isActive = task.planned && task.planned.includes(w);
        rows += `<Cell ss:StyleID="${isActive ? 'Active' + styleId : 'EmptyCell'}"><Data ss:Type="String">${isActive ? '\u25A0' : ''}</Data></Cell>`;
      }
      rows += `</Row>`;

      // Reality row
      rows += `<Row ss:Height="18">
        <Cell ss:StyleID="TaskName"></Cell>
        <Cell ss:StyleID="TypeReal"><Data ss:Type="String">Real</Data></Cell>`;
      for (let w = 1; w <= totalWeeks; w++) {
        const isActive = task.reality && task.reality.includes(w);
        rows += `<Cell ss:StyleID="${isActive ? 'Active' + styleId : 'EmptyCell'}"><Data ss:Type="String">${isActive ? '\u25A1' : ''}</Data></Cell>`;
      }
      rows += `</Row>`;
    });
  });

  // Footer
  rows += `<Row></Row>
  <Row>
    <Cell><Data ss:Type="String">Exported: ${new Date().toLocaleDateString()}</Data></Cell>
  </Row>`;

  // Assemble full XML
  return `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Styles>${styles}
  </Styles>
  <Worksheet ss:Name="Gantt Chart">
    <Table ss:DefaultColumnWidth="24" ss:DefaultRowHeight="16">
      <Column ss:Width="180"/>
      <Column ss:Width="50"/>
      ${rows}
    </Table>
  </Worksheet>
</Workbook>`;
}

function exportToPDF() {
  statusManager.show('Enable "Background graphics" in print dialog for colors', false);
  triggerPrint();
}

function importProject() {
  document.getElementById('fileInput').click();
}

async function handleFileImport(e) {
  const file = e.target.files[0];
  if (!file) return;

  try {
    const imported = await readJSONFile(file);

    // Validate structure
    if (!imported.project || !imported.tasks || !imported.categories) {
      throw new Error('Invalid project file structure');
    }

    // Migrate tasks to new format if needed
    imported.tasks.forEach(task => migrateTask(task));

    imported.version = DATA_VERSION;
    projectData = imported;
    save();
    renderApp();
    statusManager.show('Imported', true);
  } catch (err) {
    alert('Failed to import: ' + err.message);
    statusManager.show('Import failed');
  }

  // Reset input so same file can be selected again
  e.target.value = '';
}

// ========== CLOSE MODALS ==========

function closeModals() {
  closeSettings();
  closeRangePicker();
  closeTaskPopover();
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

  // Settings modal
  document.getElementById('settingsModal')?.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) {
      closeSettings();
    }
  });

  // Range picker keyboard support
  document.getElementById('rangeStartWeek').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') applyWeekRange();
  });
  document.getElementById('rangeEndWeek').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') applyWeekRange();
  });

  // Team member input keyboard support
  document.getElementById('newTeamMember').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addTeamMember();
  });

  // Settings date change
  document.getElementById('settingsStartDate').addEventListener('change', updateProjectDatesPreview);
  document.getElementById('settingsEndDate').addEventListener('change', updateProjectDatesPreview);

  // Close dropdowns when clicking outside
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.move-dropdown')) {
      closeMoveDropdowns();
    }
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    // Ignore if in input field (except for Escape and Ctrl+Z)
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
    } else if (e.key === 'f' && !e.ctrlKey && !e.metaKey) {
      focusSearch();
      e.preventDefault();
    }
  });

  // Search input
  document.getElementById('searchInput').addEventListener('input', (e) => filterTasks(e.target.value));
}

// ========== EXPOSE GLOBAL FUNCTIONS ==========
// These need to be callable from onclick handlers in HTML

window.toggleEditMode = toggleEditMode;
window.exportToJSON = exportToJSON;
window.exportToExcel = exportToExcel;
window.exportToPDF = exportToPDF;
window.importProject = importProject;
window.openSettings = openSettings;
window.closeSettings = closeSettings;
window.saveSettings = saveSettings;
window.addTeamMember = addTeamMember;
window.toggleAllCategories = toggleAllCategories;
window.filterTasks = filterTasks;
window.closeRangePicker = closeRangePicker;
window.applyWeekRange = applyWeekRange;
window.closeTaskPopover = closeTaskPopover;
window.saveTaskPopover = saveTaskPopover;

// Initialize on load
init();
