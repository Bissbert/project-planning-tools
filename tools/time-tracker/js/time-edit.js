/**
 * Time Edit Module - CRUD operations for time entries
 */

import { generateTimeEntryId } from '../../../shared/js/unified-data.js';

/**
 * Add a new time entry
 * @param {Object} projectData - Project data
 * @param {Object} entryData - Entry data
 * @returns {Object|null} - Created entry or null if validation fails
 */
export function addTimeEntry(projectData, entryData) {
  const validation = validateTimeEntry(entryData);
  if (!validation.valid) {
    console.error('Invalid entry:', validation.errors);
    return null;
  }

  const entry = {
    id: generateTimeEntryId(),
    taskId: entryData.taskId || null,
    date: entryData.date,
    startTime: entryData.startTime,
    endTime: entryData.endTime,
    durationMinutes: calculateDuration(entryData.startTime, entryData.endTime),
    notes: entryData.notes || '',
    billable: entryData.billable || false
  };

  projectData.timeEntries.push(entry);
  return entry;
}

/**
 * Update an existing time entry
 * @param {Object} projectData - Project data
 * @param {string} entryId - Entry ID
 * @param {Object} updates - Fields to update
 * @returns {boolean} - Success
 */
export function updateTimeEntry(projectData, entryId, updates) {
  const entry = projectData.timeEntries.find(e => e.id === entryId);
  if (!entry) {
    console.error('Entry not found:', entryId);
    return false;
  }

  // Apply updates
  if (updates.taskId !== undefined) entry.taskId = updates.taskId || null;
  if (updates.date !== undefined) entry.date = updates.date;
  if (updates.startTime !== undefined) entry.startTime = updates.startTime;
  if (updates.endTime !== undefined) entry.endTime = updates.endTime;
  if (updates.notes !== undefined) entry.notes = updates.notes;
  if (updates.billable !== undefined) entry.billable = updates.billable;

  // Recalculate duration if times changed
  if (updates.startTime !== undefined || updates.endTime !== undefined) {
    entry.durationMinutes = calculateDuration(entry.startTime, entry.endTime);
  }

  return true;
}

/**
 * Delete a time entry
 * @param {Object} projectData - Project data
 * @param {string} entryId - Entry ID
 * @returns {boolean} - Success
 */
export function deleteTimeEntry(projectData, entryId) {
  const index = projectData.timeEntries.findIndex(e => e.id === entryId);
  if (index === -1) {
    console.error('Entry not found:', entryId);
    return false;
  }

  projectData.timeEntries.splice(index, 1);
  return true;
}

/**
 * Calculate duration in minutes between two times
 * @param {string} startTime - Start time in HH:MM format
 * @param {string} endTime - End time in HH:MM format
 * @returns {number} - Duration in minutes
 */
export function calculateDuration(startTime, endTime) {
  if (!startTime || !endTime) return 0;

  const [startHour, startMin] = startTime.split(':').map(Number);
  const [endHour, endMin] = endTime.split(':').map(Number);

  const startMinutes = startHour * 60 + startMin;
  let endMinutes = endHour * 60 + endMin;

  // Handle overnight entries
  if (endMinutes < startMinutes) {
    endMinutes += 24 * 60;
  }

  return endMinutes - startMinutes;
}

/**
 * Validate time entry data
 * @param {Object} entryData - Entry data to validate
 * @returns {Object} - {valid: boolean, errors: string[]}
 */
export function validateTimeEntry(entryData) {
  const errors = [];

  if (!entryData.date) {
    errors.push('Date is required');
  }

  if (!entryData.startTime) {
    errors.push('Start time is required');
  }

  if (!entryData.endTime) {
    errors.push('End time is required');
  }

  // Validate time format
  const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
  if (entryData.startTime && !timeRegex.test(entryData.startTime)) {
    errors.push('Invalid start time format');
  }
  if (entryData.endTime && !timeRegex.test(entryData.endTime)) {
    errors.push('Invalid end time format');
  }

  // Validate date format
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (entryData.date && !dateRegex.test(entryData.date)) {
    errors.push('Invalid date format');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Get the current time in HH:MM format
 * @returns {string} - Current time
 */
export function getCurrentTime() {
  const now = new Date();
  return now.toTimeString().slice(0, 5);
}

/**
 * Get today's date in YYYY-MM-DD format
 * @returns {string} - Today's date
 */
export function getTodayDate() {
  return new Date().toISOString().split('T')[0];
}

/**
 * Format date for display
 * @param {string} dateStr - ISO date string
 * @returns {string} - Formatted date
 */
export function formatDateDisplay(dateStr) {
  const date = new Date(dateStr + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const dateOnly = new Date(date);
  dateOnly.setHours(0, 0, 0, 0);

  if (dateOnly.getTime() === today.getTime()) {
    return 'Today';
  }
  if (dateOnly.getTime() === yesterday.getTime()) {
    return 'Yesterday';
  }

  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  });
}

/**
 * Format week range for display
 * @param {Date} weekStart - Start of week
 * @returns {string} - Formatted week range
 */
export function formatWeekRange(weekStart) {
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);

  const startMonth = weekStart.toLocaleDateString('en-US', { month: 'short' });
  const endMonth = weekEnd.toLocaleDateString('en-US', { month: 'short' });
  const startDay = weekStart.getDate();
  const endDay = weekEnd.getDate();
  const year = weekStart.getFullYear();

  if (startMonth === endMonth) {
    return `${startMonth} ${startDay} - ${endDay}, ${year}`;
  }
  return `${startMonth} ${startDay} - ${endMonth} ${endDay}, ${year}`;
}
