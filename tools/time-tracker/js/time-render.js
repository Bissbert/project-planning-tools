/**
 * Time Render Module - DOM rendering for time tracker
 */

import {
  formatDuration,
  getEntriesForDate,
  getEntriesForDateRange,
  calculateTotalMinutes,
  groupEntriesByTask,
  groupEntriesByCategory,
  getWeekStart,
  getWeekEnd
} from '../../../shared/js/unified-data.js';

import { formatDateDisplay, formatWeekRange, getTodayDate } from './time-edit.js';

/**
 * Main render function
 * @param {Object} projectData - Project data
 * @param {boolean} editMode - Edit mode state
 * @param {string} activeView - 'today', 'week', or 'reports'
 * @param {Date} selectedDate - Currently selected date
 * @param {string} searchQuery - Search filter
 * @param {Object} handlers - Event handlers
 */
export function render(projectData, editMode, activeView, selectedDate, searchQuery, handlers) {
  renderHeader(projectData, selectedDate);
  renderTaskSelectors(projectData);
  renderDateNav(activeView, selectedDate);
  renderViewTabs(activeView);
  renderEntriesContent(projectData, editMode, activeView, selectedDate, searchQuery, handlers);
}

/**
 * Render header stats
 */
function renderHeader(projectData, selectedDate) {
  document.getElementById('projectTitle').textContent = projectData.project.title;

  const today = getTodayDate();
  const todayEntries = getEntriesForDate(projectData.timeEntries, today);
  const todayMinutes = calculateTotalMinutes(todayEntries);
  document.getElementById('todayTotal').textContent = formatDuration(todayMinutes);

  const weekStart = getWeekStart(selectedDate);
  const weekEnd = getWeekEnd(selectedDate);
  const weekStartStr = weekStart.toISOString().split('T')[0];
  const weekEndStr = weekEnd.toISOString().split('T')[0];
  const weekEntries = getEntriesForDateRange(projectData.timeEntries, weekStartStr, weekEndStr);
  const weekMinutes = calculateTotalMinutes(weekEntries);
  document.getElementById('weekTotal').textContent = formatDuration(weekMinutes);

  document.getElementById('entryCount').textContent = projectData.timeEntries.length;
}

/**
 * Render task selectors (timer, quick add, modal)
 */
function renderTaskSelectors(projectData) {
  const options = '<option value="">No task</option>' +
    projectData.tasks.map(t => `<option value="${t.id}">${t.name}</option>`).join('');

  document.getElementById('timerTaskSelect').innerHTML = options;
  document.getElementById('quickAddTask').innerHTML = options;
  document.getElementById('entryEditTask').innerHTML = options;
}

/**
 * Render view tabs
 */
function renderViewTabs(activeView) {
  document.querySelectorAll('.view-tab').forEach(tab => {
    tab.classList.toggle('view-tab--active', tab.dataset.view === activeView);
  });
}

/**
 * Render date navigation
 */
function renderDateNav(activeView, selectedDate) {
  const dateNav = document.getElementById('dateNav');
  const label = document.getElementById('dateNavLabel');

  if (activeView === 'reports') {
    dateNav.style.display = 'none';
    return;
  }

  dateNav.style.display = 'flex';

  if (activeView === 'today') {
    label.textContent = formatDateDisplay(selectedDate.toISOString().split('T')[0]);
  } else if (activeView === 'week') {
    const weekStart = getWeekStart(selectedDate);
    label.textContent = formatWeekRange(weekStart);
  }
}

/**
 * Render entries content based on active view
 */
function renderEntriesContent(projectData, editMode, activeView, selectedDate, searchQuery, handlers) {
  const container = document.getElementById('entriesContent');

  if (activeView === 'today') {
    renderTodayView(container, projectData, editMode, selectedDate, searchQuery, handlers);
  } else if (activeView === 'week') {
    renderWeekView(container, projectData, editMode, selectedDate, searchQuery, handlers);
  } else if (activeView === 'reports') {
    renderReportsView(container, projectData, selectedDate);
  }
}

/**
 * Render today (single day) view
 */
function renderTodayView(container, projectData, editMode, selectedDate, searchQuery, handlers) {
  const dateStr = selectedDate.toISOString().split('T')[0];
  let entries = getEntriesForDate(projectData.timeEntries, dateStr);

  // Apply search filter
  if (searchQuery) {
    entries = filterEntries(entries, projectData.tasks, searchQuery);
  }

  if (entries.length === 0) {
    container.innerHTML = renderEmptyState('No entries', 'Start the timer or add an entry manually.');
    return;
  }

  const totalMinutes = calculateTotalMinutes(entries);

  container.innerHTML = `
    <div class="day-group">
      <div class="day-group__header">
        <span class="day-group__date">${formatDateDisplay(dateStr)}</span>
        <span class="day-group__total">${formatDuration(totalMinutes)}</span>
      </div>
      <div class="day-group__entries">
        ${entries.map(e => renderEntryCard(e, projectData, editMode, handlers)).join('')}
      </div>
    </div>
  `;
}

/**
 * Render week view
 */
function renderWeekView(container, projectData, editMode, selectedDate, searchQuery, handlers) {
  const weekStart = getWeekStart(selectedDate);
  const weekEnd = getWeekEnd(selectedDate);
  const weekStartStr = weekStart.toISOString().split('T')[0];
  const weekEndStr = weekEnd.toISOString().split('T')[0];

  let entries = getEntriesForDateRange(projectData.timeEntries, weekStartStr, weekEndStr);

  // Apply search filter
  if (searchQuery) {
    entries = filterEntries(entries, projectData.tasks, searchQuery);
  }

  if (entries.length === 0) {
    container.innerHTML = renderEmptyState('No entries this week', 'Start tracking time to see entries here.');
    return;
  }

  // Group entries by day
  const dayGroups = new Map();
  entries.forEach(entry => {
    if (!dayGroups.has(entry.date)) {
      dayGroups.set(entry.date, []);
    }
    dayGroups.get(entry.date).push(entry);
  });

  // Sort days (most recent first)
  const sortedDays = Array.from(dayGroups.keys()).sort((a, b) => b.localeCompare(a));

  container.innerHTML = sortedDays.map(date => {
    const dayEntries = dayGroups.get(date);
    const totalMinutes = calculateTotalMinutes(dayEntries);

    return `
      <div class="day-group">
        <div class="day-group__header">
          <span class="day-group__date">${formatDateDisplay(date)}</span>
          <span class="day-group__total">${formatDuration(totalMinutes)}</span>
        </div>
        <div class="day-group__entries">
          ${dayEntries.map(e => renderEntryCard(e, projectData, editMode, handlers)).join('')}
        </div>
      </div>
    `;
  }).join('');
}

/**
 * Render reports view
 */
function renderReportsView(container, projectData, selectedDate) {
  const weekStart = getWeekStart(selectedDate);
  const weekEnd = getWeekEnd(selectedDate);
  const weekStartStr = weekStart.toISOString().split('T')[0];
  const weekEndStr = weekEnd.toISOString().split('T')[0];

  const entries = getEntriesForDateRange(projectData.timeEntries, weekStartStr, weekEndStr);
  const totalMinutes = calculateTotalMinutes(entries);
  const billableEntries = entries.filter(e => e.billable);
  const billableMinutes = calculateTotalMinutes(billableEntries);

  // Group by task
  const taskGroups = groupEntriesByTask(entries, projectData.tasks);

  // Group by category
  const categoryGroups = groupEntriesByCategory(entries, projectData.tasks, projectData.categories);

  container.innerHTML = `
    <div class="summary-cards">
      <div class="summary-card summary-card--accent">
        <div class="summary-card__value">${formatDuration(totalMinutes)}</div>
        <div class="summary-card__label">Total Time</div>
      </div>
      <div class="summary-card summary-card--success">
        <div class="summary-card__value">${formatDuration(billableMinutes)}</div>
        <div class="summary-card__label">Billable</div>
      </div>
      <div class="summary-card">
        <div class="summary-card__value">${entries.length}</div>
        <div class="summary-card__label">Entries</div>
      </div>
    </div>

    ${renderReportSection('By Task', taskGroups, totalMinutes, projectData.categories, 'task')}
    ${renderReportSection('By Category', categoryGroups, totalMinutes, projectData.categories, 'category')}
  `;
}

/**
 * Render a report section
 */
function renderReportSection(title, groups, totalMinutes, categories, type) {
  if (groups.length === 0) {
    return '';
  }

  return `
    <div class="reports-section">
      <div class="reports-section__header">
        <span class="reports-section__title">${title}</span>
        <span class="reports-section__total">${formatDuration(totalMinutes)}</span>
      </div>
      <div class="reports-section__content">
        ${groups.map(group => {
          const name = type === 'task'
            ? (group.task ? group.task.name : 'No task')
            : group.category;
          const color = type === 'task'
            ? (group.task ? (categories[group.task.category] || '#7c7c8a') : '#7c7c8a')
            : group.color;
          const percent = totalMinutes > 0 ? Math.round((group.totalMinutes / totalMinutes) * 100) : 0;

          return `
            <div class="report-item">
              <div class="report-item__color" style="background: ${color}"></div>
              <div class="report-item__name">${name}</div>
              <div class="report-item__bar">
                <div class="report-item__bar-fill" style="width: ${percent}%; background: ${color}"></div>
              </div>
              <div class="report-item__duration">${formatDuration(group.totalMinutes)}</div>
              <div class="report-item__percent">${percent}%</div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

/**
 * Render a single entry card
 */
function renderEntryCard(entry, projectData, editMode, handlers) {
  const task = entry.taskId ? projectData.tasks.find(t => t.id === entry.taskId) : null;
  const taskName = task ? task.name : 'No task';
  const taskClass = task ? '' : 'entry-card__task--none';
  const category = task ? task.category : null;
  const categoryColor = category ? (projectData.categories[category] || '#7c7c8a') : null;

  const timeRange = `${entry.startTime} - ${entry.endTime}`;

  return `
    <div class="entry-card" onclick="openEntryEdit('${entry.id}')">
      <div class="entry-card__time">
        <span class="entry-card__time-range">${timeRange}</span>
        <span class="entry-card__duration">${formatDuration(entry.durationMinutes)}</span>
      </div>
      <div class="entry-card__content">
        <div class="entry-card__task ${taskClass}">${taskName}</div>
        ${entry.notes ? `<div class="entry-card__notes">${escapeHtml(entry.notes)}</div>` : ''}
        ${category ? `
          <div class="entry-card__category">
            <span class="entry-card__category-dot" style="background: ${categoryColor}"></span>
            ${category}
          </div>
        ` : ''}
      </div>
      <div class="entry-card__meta">
        ${entry.billable ? '<span class="entry-card__billable">Billable</span>' : ''}
        <div class="entry-card__actions">
          <button class="entry-card__action" onclick="event.stopPropagation(); openEntryEdit('${entry.id}')" title="Edit">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
          <button class="entry-card__action entry-card__action--delete edit-only" onclick="event.stopPropagation(); deleteEntry('${entry.id}')" title="Delete">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  `;
}

/**
 * Render empty state
 */
function renderEmptyState(title, text) {
  return `
    <div class="empty-state">
      <svg class="empty-state__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <circle cx="12" cy="12" r="10"/>
        <polyline points="12 6 12 12 16 14"/>
      </svg>
      <div class="empty-state__title">${title}</div>
      <div class="empty-state__text">${text}</div>
    </div>
  `;
}

/**
 * Filter entries by search query
 */
function filterEntries(entries, tasks, query) {
  const q = query.toLowerCase();
  return entries.filter(entry => {
    // Search in notes
    if (entry.notes && entry.notes.toLowerCase().includes(q)) return true;

    // Search in task name
    if (entry.taskId) {
      const task = tasks.find(t => t.id === entry.taskId);
      if (task && task.name.toLowerCase().includes(q)) return true;
      if (task && task.category && task.category.toLowerCase().includes(q)) return true;
    }

    return false;
  });
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
