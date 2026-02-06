/**
 * Calendar Render Module - DOM rendering functions
 */

import {
  getMemberAvailability,
  calculateTeamCapacity,
  getWeekCapacityPercent,
  getWeekStart,
  getWeekDates,
  formatDateRange
} from '../../../shared/js/unified-data.js';

/**
 * Main render function
 */
export function render(projectData, editMode, currentView, viewDate, searchQuery, handlers) {
  // Update header
  renderHeader(projectData, viewDate);

  // Render team list
  renderTeamList(projectData, searchQuery, handlers);

  // Render capacity summary
  renderCapacitySummary(projectData, viewDate);

  // Render calendar grid
  if (currentView === 'week') {
    renderWeekView(projectData, viewDate, handlers);
  } else {
    renderMonthView(projectData, viewDate, handlers);
  }

  // Update date range display
  updateDateRange(currentView, viewDate);
}

/**
 * Render header stats
 */
function renderHeader(projectData, viewDate) {
  document.getElementById('projectTitle').textContent = projectData.project.title;
  document.getElementById('memberCount').textContent = (projectData.team || []).length;

  // Calculate week capacity percentage
  const weekStart = getWeekStart(viewDate);
  const capacityPercent = getWeekCapacityPercent(
    projectData.team,
    weekStart,
    projectData.calendarSettings
  );
  document.getElementById('weekCapacity').textContent = capacityPercent + '%';
}

/**
 * Render team member list in sidebar
 */
function renderTeamList(projectData, searchQuery, handlers) {
  const teamList = document.getElementById('teamList');
  const team = projectData.team || [];

  // Filter by search query
  const filtered = team.filter(member => {
    if (!searchQuery) return true;
    return member.name.toLowerCase().includes(searchQuery) ||
           (member.role || '').toLowerCase().includes(searchQuery);
  });

  if (filtered.length === 0) {
    teamList.innerHTML = `
      <div class="empty-state">
        <div class="empty-state__text">
          ${team.length === 0 ? 'No team members yet. Click "Add Member" to get started.' : 'No members match your search.'}
        </div>
      </div>
    `;
    return;
  }

  teamList.innerHTML = filtered.map(member => `
    <div class="team-member" data-member-id="${member.id}">
      <div class="team-member__color" style="background-color: ${member.color}"></div>
      <div class="team-member__info">
        <div class="team-member__name">${escapeHtml(member.name)}</div>
        ${member.role ? `<div class="team-member__role">${escapeHtml(member.role)}</div>` : ''}
      </div>
      <div class="team-member__hours">${member.hoursPerWeek}h/w</div>
    </div>
  `).join('');

  // Add click handlers
  teamList.querySelectorAll('.team-member').forEach(el => {
    el.addEventListener('click', () => {
      handlers.onMemberClick(el.dataset.memberId);
    });
  });
}

/**
 * Render capacity summary in sidebar
 */
function renderCapacitySummary(projectData, viewDate) {
  const container = document.getElementById('capacitySummary');
  const weekStart = getWeekStart(viewDate);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);

  const startStr = weekStart.toISOString().split('T')[0];
  const endStr = weekEnd.toISOString().split('T')[0];

  const capacity = calculateTeamCapacity(
    projectData.team,
    startStr,
    endStr,
    projectData.calendarSettings
  );

  // Calculate max possible
  const workDays = projectData.calendarSettings?.workDays || [1, 2, 3, 4, 5];
  const hoursPerDay = projectData.calendarSettings?.hoursPerDay || 8;
  let workDaysInWeek = 0;
  for (let d = new Date(weekStart); d <= weekEnd; d.setDate(d.getDate() + 1)) {
    if (workDays.includes(d.getDay())) {
      workDaysInWeek++;
    }
  }
  const maxHours = (projectData.team || []).length * workDaysInWeek * hoursPerDay;

  container.innerHTML = `
    <div class="capacity-summary__title">This Week</div>
    <div class="capacity-summary__stats">
      <div class="capacity-stat">
        <span class="capacity-stat__label">Available</span>
        <span class="capacity-stat__value capacity-stat__value--highlight">${capacity.totalHours}h</span>
      </div>
      <div class="capacity-stat">
        <span class="capacity-stat__label">Maximum</span>
        <span class="capacity-stat__value">${maxHours}h</span>
      </div>
    </div>
  `;
}

/**
 * Render week view
 */
function renderWeekView(projectData, viewDate, handlers) {
  const grid = document.getElementById('calendarGrid');
  const team = projectData.team || [];
  const weekStart = getWeekStart(viewDate);
  const dates = getWeekDates(weekStart);
  const today = new Date().toISOString().split('T')[0];
  const workDays = projectData.calendarSettings?.workDays || [1, 2, 3, 4, 5];

  if (team.length === 0) {
    grid.innerHTML = `
      <div class="no-team-message">
        <svg class="no-team-message__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
          <circle cx="9" cy="7" r="4"/>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
          <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
        </svg>
        <div class="no-team-message__title">No Team Members</div>
        <div class="no-team-message__text">Add team members to start tracking availability and capacity.</div>
      </div>
    `;
    return;
  }

  // Build header row
  const headerCells = dates.map(date => {
    const dateStr = date.toISOString().split('T')[0];
    const isToday = dateStr === today;
    const isWeekend = !workDays.includes(date.getDay());
    const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
    const dayNum = date.getDate();

    let classes = 'week-grid__day-header';
    if (isToday) classes += ' week-grid__day-header--today';
    if (isWeekend) classes += ' week-grid__day-header--weekend';

    return `
      <div class="${classes}">
        <span class="day-header__name">${dayName}</span>
        <span class="day-header__date">${dayNum}</span>
      </div>
    `;
  }).join('');

  // Build member rows
  const memberRows = team.map(member => {
    const cells = dates.map(date => {
      const dateStr = date.toISOString().split('T')[0];
      const isToday = dateStr === today;
      const isWeekend = !workDays.includes(date.getDay());

      const availability = getMemberAvailability(member, dateStr, projectData.calendarSettings);

      let cellClasses = 'availability-cell';
      if (isToday) cellClasses += ' availability-cell--today';
      if (isWeekend || availability.type === 'weekend') cellClasses += ' availability-cell--weekend';

      const indicator = renderAvailabilityIndicator(availability, isWeekend);

      return `
        <div class="${cellClasses}" data-member-id="${member.id}" data-date="${dateStr}" title="${availability.reason || ''}">
          ${indicator}
        </div>
      `;
    }).join('');

    return `
      <div class="week-grid__row">
        <div class="week-grid__member">
          <div class="week-grid__member-color" style="background-color: ${member.color}"></div>
          <div class="week-grid__member-name">${escapeHtml(member.name)}</div>
        </div>
        ${cells}
      </div>
    `;
  }).join('');

  // Build totals row
  const totalsCells = dates.map(date => {
    const dateStr = date.toISOString().split('T')[0];
    const isWeekend = !workDays.includes(date.getDay());

    let totalHours = 0;
    team.forEach(member => {
      const availability = getMemberAvailability(member, dateStr, projectData.calendarSettings);
      totalHours += availability.hours;
    });

    let classes = 'week-grid__totals-cell';
    if (isWeekend) classes += ' week-grid__totals-cell--weekend';

    return `<div class="${classes}">${totalHours}h</div>`;
  }).join('');

  grid.innerHTML = `
    <div class="week-grid">
      <div class="week-grid__header">
        <div class="week-grid__corner">Team</div>
        ${headerCells}
      </div>
      <div class="week-grid__body">
        ${memberRows}
      </div>
      <div class="week-grid__totals">
        <div class="week-grid__totals-label">Total</div>
        ${totalsCells}
      </div>
    </div>
  `;

  // Add cell click handlers
  grid.querySelectorAll('.availability-cell').forEach(cell => {
    cell.addEventListener('click', () => {
      handlers.onCellClick(cell.dataset.memberId, cell.dataset.date);
    });
  });
}

/**
 * Render availability indicator
 */
function renderAvailabilityIndicator(availability, isWeekend) {
  if (isWeekend || availability.type === 'weekend') {
    return `<div class="availability-indicator">-</div>`;
  }

  let classes = 'availability-indicator';
  let content = '';

  switch (availability.type) {
    case 'available':
      classes += ' availability-indicator--available';
      content = availability.hours;
      break;
    case 'partial':
      classes += ' availability-indicator--partial';
      content = availability.hours;
      break;
    case 'unavailable':
      classes += ' availability-indicator--unavailable';
      content = ''; // × is added via CSS
      break;
    case 'holiday':
      classes += ' availability-indicator--holiday';
      content = ''; // ★ is added via CSS
      break;
    default:
      classes += ' availability-indicator--available';
      content = availability.hours;
  }

  return `<div class="${classes}">${content}</div>`;
}

/**
 * Render month view
 */
function renderMonthView(projectData, viewDate, handlers) {
  const grid = document.getElementById('calendarGrid');
  const team = projectData.team || [];
  const workDays = projectData.calendarSettings?.workDays || [1, 2, 3, 4, 5];
  const today = new Date().toISOString().split('T')[0];

  // Get first and last day of month
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  // Get the Monday of the first week
  const startDate = getWeekStart(firstDay);

  // Get the Sunday of the last week
  const endDate = new Date(lastDay);
  while (endDate.getDay() !== 0) {
    endDate.setDate(endDate.getDate() + 1);
  }

  // Build day names header
  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const headerCells = dayNames.map((name, i) => {
    const dayIndex = i === 6 ? 0 : i + 1; // Convert to JS day index (0=Sun)
    const isWeekend = !workDays.includes(dayIndex);
    let classes = 'month-grid__day-name';
    if (isWeekend) classes += ' month-grid__day-name--weekend';
    return `<div class="${classes}">${name}</div>`;
  }).join('');

  // Build weeks
  const weeks = [];
  let currentDate = new Date(startDate);

  while (currentDate <= endDate) {
    const weekDays = [];

    for (let i = 0; i < 7; i++) {
      const dateStr = currentDate.toISOString().split('T')[0];
      const dayOfWeek = currentDate.getDay();
      const isCurrentMonth = currentDate.getMonth() === month;
      const isToday = dateStr === today;
      const isWeekend = !workDays.includes(dayOfWeek);

      let classes = 'month-grid__day';
      if (!isCurrentMonth) classes += ' month-grid__day--outside';
      if (isWeekend) classes += ' month-grid__day--weekend';
      if (isToday) classes += ' month-grid__day--today';

      // Get availability dots for all team members
      const dots = team.map(member => {
        const availability = getMemberAvailability(member, dateStr, projectData.calendarSettings);
        if (isWeekend || availability.type === 'weekend') return '';

        let dotClass = 'month-availability__dot';
        switch (availability.type) {
          case 'available':
            dotClass += ' month-availability__dot--available';
            break;
          case 'partial':
            dotClass += ' month-availability__dot--partial';
            break;
          case 'unavailable':
            dotClass += ' month-availability__dot--unavailable';
            break;
          case 'holiday':
            dotClass += ' month-availability__dot--holiday';
            break;
        }

        return `<div class="${dotClass}" style="background-color: ${member.color}" title="${member.name}"></div>`;
      }).join('');

      weekDays.push(`
        <div class="${classes}" data-date="${dateStr}">
          <div class="month-grid__day-number">${currentDate.getDate()}</div>
          <div class="month-availability">${dots}</div>
        </div>
      `);

      currentDate.setDate(currentDate.getDate() + 1);
    }

    weeks.push(`<div class="month-grid__week">${weekDays.join('')}</div>`);
  }

  grid.innerHTML = `
    <div class="month-grid">
      <div class="month-grid__header">${headerCells}</div>
      <div class="month-grid__body">${weeks.join('')}</div>
    </div>
  `;

  // Add click handlers to drill into week view
  grid.querySelectorAll('.month-grid__day').forEach(day => {
    day.addEventListener('click', () => {
      handlers.onMonthDayClick(day.dataset.date);
    });
  });
}

/**
 * Update date range display
 */
function updateDateRange(currentView, viewDate) {
  const dateRange = document.getElementById('dateRange');

  if (currentView === 'week') {
    const weekStart = getWeekStart(viewDate);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    dateRange.textContent = formatDateRange(weekStart, weekEnd);
  } else {
    const monthName = viewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    dateRange.textContent = monthName;
  }
}

/**
 * Escape HTML entities
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
