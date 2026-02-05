/**
 * Gantt Render Module - Main render, task rows
 */

import {
  generateMonthsFromDateRange,
  getCurrentWeek,
  getWeekDateRange,
  getTaskStatus,
  calculateProgress,
  calculateVariance
} from './gantt-data.js';

/**
 * Render project title
 * @param {Object} projectData - Project data
 * @param {boolean} editMode - Whether in edit mode
 * @param {Function} onEditTitle - Callback for title editing
 */
export function renderProjectTitle(projectData, editMode, onEditTitle) {
  const titleEl = document.getElementById('projectTitle');
  titleEl.textContent = projectData.project.title || '8-Month Game Production';

  // Remove old listeners by replacing the element
  const newTitleEl = titleEl.cloneNode(true);
  titleEl.parentNode.replaceChild(newTitleEl, titleEl);

  if (editMode) {
    // Add edit hint
    const hint = document.createElement('span');
    hint.className = 'edit-hint';
    hint.textContent = '(click to edit)';
    newTitleEl.appendChild(hint);

    newTitleEl.style.cursor = 'text';
    newTitleEl.addEventListener('click', onEditTitle);
  }
}

/**
 * Update progress stats display
 * @param {Object} projectData - Project data
 */
export function updateProgressStats(projectData) {
  const { currentWeek, totalWeeks, percent } = calculateProgress(projectData.project);
  const statsEl = document.getElementById('progressStats');
  if (currentWeek) {
    statsEl.textContent = `Week ${currentWeek}/${totalWeeks} (${percent}%)`;
  } else {
    statsEl.textContent = `${totalWeeks} weeks`;
  }
}

/**
 * Update variance card display
 * @param {Object} projectData - Project data
 */
export function updateVarianceCard(projectData) {
  const { totalPlanned, totalReality, diff } = calculateVariance(projectData.tasks);

  document.getElementById('variancePlanned').textContent = totalPlanned;
  document.getElementById('varianceReality').textContent = totalReality;

  const diffEl = document.getElementById('varianceDiffValue');
  const diffContainer = document.getElementById('varianceDiff');

  if (diff > 0) {
    diffEl.textContent = `+${diff}`;
    diffContainer.classList.remove('variance-stat--behind');
    diffContainer.classList.add('variance-stat--ahead');
  } else if (diff < 0) {
    diffEl.textContent = diff;
    diffContainer.classList.remove('variance-stat--ahead');
    diffContainer.classList.add('variance-stat--behind');
  } else {
    diffEl.textContent = '0';
    diffContainer.classList.remove('variance-stat--ahead', 'variance-stat--behind');
  }
}

/**
 * Update collapse all button text
 * @param {Set} collapsedCategories - Set of collapsed category names
 * @param {Array} allCategories - Array of all category names
 */
export function updateCollapseAllButton(collapsedCategories, allCategories) {
  const btn = document.getElementById('collapseAllBtn');
  if (btn) {
    btn.textContent = collapsedCategories.size === allCategories.length ? 'Expand All' : 'Collapse All';
  }
}

/**
 * Render legend
 * @param {Object} projectData - Project data
 */
export function renderLegend(projectData) {
  const legendEl = document.getElementById('legend');
  legendEl.innerHTML = '';

  // Category colors
  const uniqueCategories = {};
  Object.entries(projectData.categories).forEach(([cat, color]) => {
    if (!uniqueCategories[color]) {
      uniqueCategories[color] = cat;
    }
  });

  Object.entries(uniqueCategories).forEach(([color, cat]) => {
    const item = document.createElement('div');
    item.className = 'legend-item';
    item.innerHTML = `<span class="legend-color" style="background: ${color}"></span>${cat}`;
    legendEl.appendChild(item);
  });

  // Planned vs Reality
  const plannedItem = document.createElement('div');
  plannedItem.className = 'legend-item';
  plannedItem.innerHTML = `<span class="legend-color" style="background: #888"></span>Planned (click to edit)`;
  legendEl.appendChild(plannedItem);

  const realityItem = document.createElement('div');
  realityItem.className = 'legend-item';
  realityItem.innerHTML = `<span class="legend-color legend-color--reality" style="background: #888"></span>Reality (click to edit)`;
  legendEl.appendChild(realityItem);

  // Keyboard shortcuts hint
  const shortcutsHint = document.createElement('div');
  shortcutsHint.className = 'shortcuts-hint';
  shortcutsHint.innerHTML = `
    <span><kbd>E</kbd> Edit</span>
    <span><kbd>S</kbd> Export</span>
    <span><kbd>F</kbd> Filter</span>
    <span><kbd>Shift+Click</kbd> Week range</span>
    <span><kbd>Ctrl+Z</kbd> Undo</span>
  `;
  legendEl.appendChild(shortcutsHint);
}

/**
 * Render status indicator icon
 * @param {string} status - Task status
 * @returns {Object} - {icon, label}
 */
function getStatusInfo(status) {
  const statusIcons = {
    'on-track': '\u25CF',
    'behind': '!',
    'ahead': '\u2191',
    'complete': '\u2713',
    'not-started': '\u25CB'
  };
  const statusLabels = {
    'on-track': 'On Track',
    'behind': 'Behind Schedule',
    'ahead': 'Ahead of Schedule',
    'complete': 'Complete',
    'not-started': 'Not Started'
  };
  return {
    icon: statusIcons[status] || '\u25CB',
    label: statusLabels[status] || status
  };
}

/**
 * Render a single task row (planned or reality)
 * @param {HTMLElement} container - Container element
 * @param {Object} task - Task data
 * @param {string} type - 'planned' or 'reality'
 * @param {number|null} currentWeek - Current week number
 * @param {Object} projectData - Project data
 * @param {boolean} editMode - Whether in edit mode
 * @param {Object} handlers - Event handlers
 */
export function renderTaskRow(container, task, type, currentWeek, projectData, editMode, handlers) {
  const row = document.createElement('div');
  row.className = `task-row task-row--${type}`;
  row.dataset.taskId = task.id;
  row.dataset.type = type;

  const color = projectData.categories[task.category] || '#666';

  // Task name cell (only show content on planned row)
  const nameDiv = document.createElement('div');
  nameDiv.className = 'task-name';

  if (type === 'planned') {
    // Drag handle (edit mode only)
    if (editMode) {
      const dragHandle = document.createElement('span');
      dragHandle.className = 'drag-handle edit-only';
      dragHandle.innerHTML = '\u22EE\u22EE';
      dragHandle.draggable = true;
      dragHandle.addEventListener('dragstart', (e) => handlers.onDragStart(e, task.id));
      dragHandle.addEventListener('dragend', handlers.onDragEnd);
      nameDiv.appendChild(dragHandle);

      row.addEventListener('dragover', (e) => handlers.onDragOver(e, task.id));
      row.addEventListener('drop', (e) => handlers.onDrop(e, task.id, task.category));
    }

    // Status indicator with icon
    const status = getTaskStatus(task, currentWeek);
    const statusInfo = getStatusInfo(status);
    const statusIndicator = document.createElement('span');
    statusIndicator.className = `status-indicator status-indicator--${status}`;
    statusIndicator.textContent = statusInfo.icon;
    statusIndicator.title = statusInfo.label;
    nameDiv.appendChild(statusIndicator);

    // Milestone marker (if milestone)
    if (task.isMilestone) {
      const milestoneMarker = document.createElement('span');
      milestoneMarker.className = 'milestone-marker';
      milestoneMarker.title = 'Milestone';
      nameDiv.appendChild(milestoneMarker);
      row.classList.add('task-row--milestone');
    }

    // Task name text
    const nameText = document.createElement('span');
    nameText.className = 'task-name-text' + (editMode ? ' task-name--editable' : '');
    nameText.textContent = task.name;
    nameText.title = task.name;
    if (editMode) {
      nameText.addEventListener('click', () => handlers.onRenameTask(nameText, task.id));
    }
    nameDiv.appendChild(nameText);

    // Priority badge
    if (task.priority) {
      const priorityBadge = document.createElement('span');
      priorityBadge.className = `priority-badge priority-badge--${task.priority}`;
      priorityBadge.textContent = task.priority.charAt(0).toUpperCase();
      priorityBadge.title = `${task.priority.charAt(0).toUpperCase() + task.priority.slice(1)} Priority`;
      nameDiv.appendChild(priorityBadge);
    }

    // Assignee display
    if (task.assignee) {
      const assigneeSpan = document.createElement('span');
      assigneeSpan.className = 'task-assignee';
      assigneeSpan.textContent = task.assignee;
      assigneeSpan.title = `Assigned to ${task.assignee}`;
      nameDiv.appendChild(assigneeSpan);
    }

    // Notes indicator
    if (task.notes) {
      const notesIcon = document.createElement('span');
      notesIcon.className = 'task-notes-icon';
      notesIcon.innerHTML = '\uD83D\uDCDD';
      notesIcon.title = task.notes;
      nameDiv.appendChild(notesIcon);
    }

    // Task action buttons (edit mode only)
    if (editMode) {
      const actionsDiv = document.createElement('div');
      actionsDiv.className = 'task-actions edit-only';

      // Persistent trigger (always visible indicator)
      const trigger = document.createElement('span');
      trigger.className = 'task-actions-trigger';
      trigger.innerHTML = '\u2022\u2022\u2022';
      trigger.title = 'Hover for actions';
      actionsDiv.appendChild(trigger);

      // Expandable buttons wrapper
      const buttonsDiv = document.createElement('div');
      buttonsDiv.className = 'task-actions-buttons';

      // Copy planned to reality button
      const copyBtn = document.createElement('button');
      copyBtn.className = 'task-btn task-btn--copy';
      copyBtn.innerHTML = '\u2713';
      copyBtn.title = 'Copy planned to reality';
      copyBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        handlers.onCopyToReality(task.id);
      });
      buttonsDiv.appendChild(copyBtn);

      // Duplicate button
      const dupBtn = document.createElement('button');
      dupBtn.className = 'task-btn task-btn--duplicate';
      dupBtn.innerHTML = '\u29C9';
      dupBtn.title = 'Duplicate task';
      dupBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        handlers.onDuplicate(task.id);
      });
      buttonsDiv.appendChild(dupBtn);

      // Move to category dropdown
      const moveDropdown = document.createElement('div');
      moveDropdown.className = 'move-dropdown';

      const moveBtn = document.createElement('button');
      moveBtn.className = 'task-btn task-btn--move';
      moveBtn.innerHTML = '\u2192';
      moveBtn.title = 'Move to category';
      moveBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        handlers.onToggleMoveDropdown(moveDropdown, task);
      });
      moveDropdown.appendChild(moveBtn);

      const dropdownContent = document.createElement('div');
      dropdownContent.className = 'move-dropdown-content';
      dropdownContent.dataset.taskId = task.id;
      moveDropdown.appendChild(dropdownContent);

      buttonsDiv.appendChild(moveDropdown);

      // Edit task details button
      const editDetailsBtn = document.createElement('button');
      editDetailsBtn.className = 'task-btn task-btn--edit-details';
      editDetailsBtn.innerHTML = '\u2699';
      editDetailsBtn.title = 'Edit details (assignee, priority, notes)';
      editDetailsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        handlers.onOpenPopover(task.id, editDetailsBtn);
      });
      buttonsDiv.appendChild(editDetailsBtn);

      // Week range picker button
      const rangeBtn = document.createElement('button');
      rangeBtn.className = 'task-btn task-btn--range';
      rangeBtn.innerHTML = '\uD83D\uDCC5';
      rangeBtn.title = 'Set week range';
      rangeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        handlers.onOpenRangePicker(task.id);
      });
      buttonsDiv.appendChild(rangeBtn);

      // Delete button
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'btn-delete';
      deleteBtn.innerHTML = '\u00D7';
      deleteBtn.title = 'Delete task';
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        handlers.onDelete(task.id);
      });
      buttonsDiv.appendChild(deleteBtn);

      actionsDiv.appendChild(buttonsDiv);
      nameDiv.appendChild(actionsDiv);
    }
  }

  nameDiv.style.display = 'flex';
  nameDiv.style.alignItems = 'center';
  nameDiv.style.gap = '6px';
  row.appendChild(nameDiv);

  // Type indicator
  const typeDiv = document.createElement('div');
  typeDiv.className = `task-type task-type--${type}`;
  typeDiv.textContent = type === 'planned' ? 'Plan' : 'Real';
  row.appendChild(typeDiv);

  // Calculate month boundaries for visual separators
  const months = generateMonthsFromDateRange(projectData.project);
  let weekStart = 1;
  const monthStarts = [1];
  months.forEach(month => {
    weekStart += month.weeks;
    monthStarts.push(weekStart);
  });

  // Week cells
  for (let w = 1; w <= projectData.project.totalWeeks; w++) {
    const cellDiv = document.createElement('div');
    cellDiv.className = `week-cell week-cell--${type}`;
    cellDiv.style.setProperty('--task-color', color);
    cellDiv.title = getWeekDateRange(projectData.project, w);

    // Month separator
    if (monthStarts.includes(w)) {
      cellDiv.classList.add('week-cell--month-start');
    }

    // Today marker
    if (w === currentWeek) {
      cellDiv.classList.add('week-cell--today');
    }

    if (type === 'planned') {
      // Planned: show bar if in planned array
      if (task.planned && task.planned.includes(w)) {
        cellDiv.classList.add('week-cell--active');
      }
      cellDiv.addEventListener('click', (e) => handlers.onWeekClick(e, task.id, w, 'planned'));
    } else {
      // Reality: interactive + show saved state
      if (task.reality && task.reality.includes(w)) {
        cellDiv.classList.add('week-cell--active');
      }
      cellDiv.addEventListener('click', (e) => handlers.onWeekClick(e, task.id, w, 'reality'));
    }

    row.appendChild(cellDiv);
  }

  container.appendChild(row);
}

/**
 * Render category row
 * @param {HTMLElement} container - Container element
 * @param {string} category - Category name
 * @param {boolean} isCollapsed - Whether category is collapsed
 * @param {Object} projectData - Project data
 * @param {boolean} editMode - Whether in edit mode
 * @param {Object} handlers - Event handlers
 */
export function renderCategoryRow(container, category, isCollapsed, projectData, editMode, handlers) {
  const catRow = document.createElement('div');
  catRow.className = 'category-row';
  catRow.dataset.category = category;
  const catDiv = document.createElement('div');
  const color = projectData.categories[category] || '#666';

  // Drag handle for category reordering (edit mode only)
  if (editMode) {
    const dragHandle = document.createElement('span');
    dragHandle.className = 'category-drag-handle edit-only';
    dragHandle.innerHTML = '\u22EE\u22EE';
    dragHandle.draggable = true;
    dragHandle.addEventListener('dragstart', (e) => handlers.onCategoryDragStart(e, category));
    dragHandle.addEventListener('dragend', handlers.onCategoryDragEnd);
    catDiv.appendChild(dragHandle);

    catRow.addEventListener('dragover', (e) => handlers.onCategoryDragOver(e, category));
    catRow.addEventListener('drop', (e) => handlers.onCategoryDrop(e, category));
  }

  // Collapse toggle
  const collapseToggle = document.createElement('span');
  collapseToggle.className = 'collapse-toggle' + (isCollapsed ? ' collapse-toggle--collapsed' : '');
  collapseToggle.textContent = '\u25BC'; // Down arrow
  collapseToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    handlers.onToggleCollapse(category);
  });
  catDiv.appendChild(collapseToggle);

  // Category name (editable in edit mode)
  const nameSpan = document.createElement('span');
  nameSpan.innerHTML = `<span class="category-dot" style="background: ${color}"></span>`;

  const nameText = document.createElement('span');
  nameText.textContent = category;
  nameText.style.cursor = editMode ? 'text' : 'default';
  if (editMode) {
    nameText.addEventListener('click', (e) => {
      e.stopPropagation();
      handlers.onRenameCategory(nameText, category);
    });
  }
  nameSpan.appendChild(nameText);
  catDiv.appendChild(nameSpan);

  // Category controls (edit mode only)
  if (editMode) {
    const controls = document.createElement('div');
    controls.className = 'category-controls edit-only';

    const colorPicker = document.createElement('input');
    colorPicker.type = 'color';
    colorPicker.className = 'color-picker';
    colorPicker.value = color;
    colorPicker.addEventListener('change', (e) => handlers.onSetCategoryColor(category, e.target.value));
    controls.appendChild(colorPicker);

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn-delete';
    deleteBtn.innerHTML = '\u00D7';
    deleteBtn.addEventListener('click', () => handlers.onDeleteCategory(category));
    controls.appendChild(deleteBtn);

    catDiv.appendChild(controls);
  }

  catRow.appendChild(catDiv);

  // Second cell (type column) - empty sticky placeholder
  const catTypeDiv = document.createElement('div');
  catRow.appendChild(catTypeDiv);

  // Third cell - spacer that fills remaining columns
  const catSpacerDiv = document.createElement('div');
  catRow.appendChild(catSpacerDiv);

  container.appendChild(catRow);
}

/**
 * Render add task button
 * @param {HTMLElement} container - Container element
 * @param {string} category - Category name
 * @param {Function} onAddTask - Callback for adding task
 */
export function renderAddTaskRow(container, category, onAddTask) {
  const addRow = document.createElement('div');
  addRow.className = 'add-task-row edit-only';
  const addBtn = document.createElement('button');
  addBtn.className = 'btn-add';
  addBtn.innerHTML = '+ Add Task';
  addBtn.addEventListener('click', () => onAddTask(category));
  addRow.appendChild(addBtn);
  container.appendChild(addRow);
}

/**
 * Render add category button
 * @param {HTMLElement} container - Container element
 * @param {Function} onAddCategory - Callback for adding category
 */
export function renderAddCategoryRow(container, onAddCategory) {
  const addCatRow = document.createElement('div');
  addCatRow.className = 'add-category-row edit-only';
  const addCatBtn = document.createElement('button');
  addCatBtn.className = 'btn-add';
  addCatBtn.innerHTML = '+ Add Category';
  addCatBtn.addEventListener('click', onAddCategory);
  addCatRow.appendChild(addCatBtn);
  container.appendChild(addCatRow);
}

/**
 * Render the entire Gantt chart
 * @param {Object} projectData - Project data
 * @param {boolean} editMode - Whether in edit mode
 * @param {Set} collapsedCategories - Set of collapsed category names
 * @param {string} searchQuery - Current search query
 * @param {Object} handlers - Event handlers
 */
export function render(projectData, editMode, collapsedCategories, searchQuery, handlers) {
  // Update header elements
  renderProjectTitle(projectData, editMode, handlers.onEditTitle);
  updateProgressStats(projectData);
  updateVarianceCard(projectData);

  const allCategories = [...new Set(projectData.tasks.map(t => t.category))];
  updateCollapseAllButton(collapsedCategories, allCategories);

  const container = document.getElementById('ganttChart');
  container.className = 'gantt';
  container.innerHTML = '';
  container.style.setProperty('--total-weeks', projectData.project.totalWeeks);

  const currentWeek = getCurrentWeek(projectData.project);

  // Generate months dynamically from date range
  const months = generateMonthsFromDateRange(projectData.project);

  // Month header row
  const monthHeader = document.createElement('div');
  monthHeader.className = 'month-header';
  monthHeader.innerHTML = '<div>Task</div><div>Type</div>';

  months.forEach(month => {
    const monthDiv = document.createElement('div');
    monthDiv.textContent = month.name;
    monthDiv.style.gridColumn = `span ${month.weeks}`;
    monthHeader.appendChild(monthDiv);
  });
  container.appendChild(monthHeader);

  // Week header row
  const weekHeader = document.createElement('div');
  weekHeader.className = 'week-header';
  weekHeader.innerHTML = '<div></div><div></div>';

  for (let w = 1; w <= projectData.project.totalWeeks; w++) {
    const weekDiv = document.createElement('div');
    weekDiv.textContent = `W${w}`;
    weekDiv.title = getWeekDateRange(projectData.project, w);
    if (w === currentWeek) {
      weekDiv.classList.add('week-cell--today');
    }
    weekHeader.appendChild(weekDiv);
  }
  container.appendChild(weekHeader);

  // Group tasks by category
  const categories = [...new Set(projectData.tasks.map(t => t.category))];

  categories.forEach((category) => {
    const isCollapsed = collapsedCategories.has(category);

    // Render category row
    renderCategoryRow(container, category, isCollapsed, projectData, editMode, handlers);

    // Skip tasks if category is collapsed
    if (isCollapsed) {
      // Still show add task button in edit mode
      if (editMode) {
        renderAddTaskRow(container, category, handlers.onAddTask);
      }
      return;
    }

    // Tasks in this category (with search filter)
    let categoryTasks = projectData.tasks.filter(t => t.category === category);
    if (searchQuery) {
      categoryTasks = categoryTasks.filter(t =>
        t.name.toLowerCase().includes(searchQuery) ||
        (t.assignee && t.assignee.toLowerCase().includes(searchQuery)) ||
        (t.notes && t.notes.toLowerCase().includes(searchQuery))
      );
    }

    categoryTasks.forEach(task => {
      // Planned row
      renderTaskRow(container, task, 'planned', currentWeek, projectData, editMode, handlers);
      // Reality row
      renderTaskRow(container, task, 'reality', currentWeek, projectData, editMode, handlers);
    });

    // Add task button (edit mode only)
    if (editMode) {
      renderAddTaskRow(container, category, handlers.onAddTask);
    }
  });

  // Add category button (edit mode only)
  if (editMode) {
    renderAddCategoryRow(container, handlers.onAddCategory);
  }

  // Render legend
  renderLegend(projectData);
}
