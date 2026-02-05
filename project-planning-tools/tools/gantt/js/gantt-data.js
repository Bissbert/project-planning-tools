/**
 * Gantt Data Module - Data structure, defaults, migration
 */

// Data format version (increment when structure changes)
export const DATA_VERSION = 4;

// Storage keys
export const STORAGE_KEY = 'ganttProject';
export const BACKUP_KEY = 'ganttProject_backups';

// Default project data
export const defaultProjectData = {
  version: DATA_VERSION,
  project: {
    title: "8-Month Game Production",
    startDate: "2026-02-02",
    endDate: "2026-10-03",
    totalWeeks: 35
  },
  team: [],
  categories: {
    "Planning": "#4472C4",
    "Characters": "#ED7D31",
    "Env - Objectives": "#70AD47",
    "Env - Town": "#70AD47",
    "Env - Forest": "#70AD47",
    "Misc": "#7030A0"
  },
  tasks: [
    { id: 1, category: "Planning", name: "Plan game concept", startWeek: 1, endWeek: 1, reality: [] },
    { id: 2, category: "Planning", name: "Create mood boards", startWeek: 1, endWeek: 2, reality: [] },
    { id: 3, category: "Planning", name: "Style guide", startWeek: 2, endWeek: 3, reality: [] },
    { id: 4, category: "Planning", name: "List assets", startWeek: 2, endWeek: 2, reality: [] },
    { id: 5, category: "Planning", name: "Thumbnails", startWeek: 3, endWeek: 4, reality: [] },
    { id: 6, category: "Planning", name: "Concept sketches", startWeek: 3, endWeek: 4, reality: [] },
    { id: 7, category: "Planning", name: "Understanding Unity", startWeek: 1, endWeek: 4, reality: [] },
    { id: 8, category: "Characters", name: "Luna mesh", startWeek: 5, endWeek: 6, reality: [] },
    { id: 9, category: "Characters", name: "Weapon mesh", startWeek: 7, endWeek: 7, reality: [] },
    { id: 10, category: "Characters", name: "Enemy mesh", startWeek: 8, endWeek: 9, reality: [] },
    { id: 11, category: "Characters", name: "Luna texture", startWeek: 10, endWeek: 11, reality: [] },
    { id: 12, category: "Characters", name: "Weapon texture", startWeek: 11, endWeek: 12, reality: [] },
    { id: 13, category: "Characters", name: "Enemy texture", startWeek: 12, endWeek: 13, reality: [] },
    { id: 14, category: "Characters", name: "Luna animations", startWeek: 14, endWeek: 15, reality: [] },
    { id: 15, category: "Characters", name: "Enemy animations", startWeek: 16, endWeek: 17, reality: [] },
    { id: 16, category: "Env - Objectives", name: "Angel Fountain mesh", startWeek: 5, endWeek: 6, reality: [] },
    { id: 17, category: "Env - Objectives", name: "Vision Tower mesh", startWeek: 7, endWeek: 8, reality: [] },
    { id: 18, category: "Env - Objectives", name: "Chest mesh", startWeek: 8, endWeek: 9, reality: [] },
    { id: 19, category: "Env - Objectives", name: "Angel Fountain texture", startWeek: 9, endWeek: 10, reality: [] },
    { id: 20, category: "Env - Objectives", name: "Vision Tower texture", startWeek: 10, endWeek: 11, reality: [] },
    { id: 21, category: "Env - Objectives", name: "Chest texture", startWeek: 11, endWeek: 12, reality: [] },
    { id: 22, category: "Env - Town", name: "Floor tiles", startWeek: 12, endWeek: 13, reality: [] },
    { id: 23, category: "Env - Town", name: "House tiles", startWeek: 13, endWeek: 15, reality: [] },
    { id: 24, category: "Env - Town", name: "Trees", startWeek: 15, endWeek: 16, reality: [] },
    { id: 25, category: "Env - Town", name: "Rocks", startWeek: 16, endWeek: 16, reality: [] },
    { id: 26, category: "Env - Town", name: "Palisade", startWeek: 17, endWeek: 17, reality: [] },
    { id: 27, category: "Env - Forest", name: "Floor tiles", startWeek: 18, endWeek: 18, reality: [] },
    { id: 28, category: "Env - Forest", name: "Portal", startWeek: 19, endWeek: 20, reality: [] },
    { id: 29, category: "Env - Forest", name: "Bushes", startWeek: 21, endWeek: 21, reality: [] },
    { id: 30, category: "Misc", name: "Unity integration", startWeek: 22, endWeek: 27, reality: [] },
    { id: 31, category: "Misc", name: "VFX", startWeek: 26, endWeek: 29, reality: [] },
    { id: 32, category: "Misc", name: "Documentation", startWeek: 30, endWeek: 31, reality: [] },
    { id: 33, category: "Misc", name: "Cushion time", startWeek: 32, endWeek: 35, reality: [] }
  ]
};

/**
 * Migrate old data format to new format
 * @param {Object} data - Data to migrate
 * @returns {Object} - Migrated data
 */
export function migrateProjectData(data) {
  // If old format with months array, calculate endDate
  if (data.months && data.months.length > 0 && !data.project.endDate) {
    const calculatedWeeks = data.months.reduce((sum, m) => sum + (m.weeks || 0), 0);
    data.project.totalWeeks = calculatedWeeks;

    // Calculate endDate from startDate + totalWeeks
    const start = new Date(data.project.startDate);
    const end = new Date(start);
    end.setDate(start.getDate() + (calculatedWeeks * 7) - 1);
    data.project.endDate = end.toISOString().split('T')[0];

    // Remove months array - will be generated dynamically
    delete data.months;
    console.log('Migrated months array to endDate:', data.project.endDate);
  }

  // If old format with totalWeeks but no endDate
  if (!data.project.endDate && data.project.totalWeeks) {
    const start = new Date(data.project.startDate);
    const end = new Date(start);
    end.setDate(start.getDate() + (data.project.totalWeeks * 7) - 1);
    data.project.endDate = end.toISOString().split('T')[0];
    console.log('Added endDate from totalWeeks:', data.project.endDate);
  }

  return data;
}

/**
 * Migrate task format (startWeek/endWeek to planned array)
 * @param {Object} task - Task to migrate
 * @returns {Object} - Migrated task
 */
export function migrateTask(task) {
  // Convert startWeek/endWeek to planned array if not already
  if (!task.planned && task.startWeek && task.endWeek) {
    task.planned = [];
    for (let w = task.startWeek; w <= task.endWeek; w++) {
      task.planned.push(w);
    }
  }
  if (!task.planned) task.planned = [];
  if (!task.reality) task.reality = [];

  // Ensure v3 fields exist
  if (task.assignee === undefined) task.assignee = '';
  if (task.priority === undefined) task.priority = '';
  if (task.notes === undefined) task.notes = '';
  if (task.isMilestone === undefined) task.isMilestone = false;

  return task;
}

/**
 * Calculate total weeks from start and end dates
 * @param {string} startDate - Start date string
 * @param {string} endDate - End date string
 * @returns {number} - Total weeks
 */
export function calculateWeeksFromDates(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffMs = end - start;
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24)) + 1; // inclusive
  return Math.ceil(diffDays / 7);
}

/**
 * Generate months array from start date and total weeks
 * @param {Object} project - Project data with startDate and totalWeeks
 * @returns {Array} - Array of {name, weeks} objects
 */
export function generateMonthsFromDateRange(project) {
  const start = new Date(project.startDate);
  const totalWeeks = project.totalWeeks;
  const monthMap = new Map(); // Preserves insertion order

  for (let week = 1; week <= totalWeeks; week++) {
    const weekStart = new Date(start);
    weekStart.setDate(start.getDate() + (week - 1) * 7);

    const year = weekStart.getFullYear();
    const monthIndex = weekStart.getMonth();
    const monthName = weekStart.toLocaleDateString('en-US', { month: 'short' });
    const key = `${year}-${monthIndex}-${monthName}`;

    monthMap.set(key, (monthMap.get(key) || 0) + 1);
  }

  // Convert to array maintaining order
  const months = [];
  for (const [key, weeks] of monthMap) {
    const monthName = key.split('-')[2];
    months.push({ name: monthName, weeks });
  }

  return months;
}

/**
 * Get current week number based on project start date
 * @param {Object} project - Project data with startDate and totalWeeks
 * @returns {number|null} - Current week number or null if outside range
 */
export function getCurrentWeek(project) {
  const start = new Date(project.startDate);
  const today = new Date();
  const diffDays = Math.floor((today - start) / (1000 * 60 * 60 * 24));
  const week = Math.floor(diffDays / 7) + 1;
  return week >= 1 && week <= project.totalWeeks ? week : null;
}

/**
 * Get date range string for a week
 * @param {Object} project - Project data with startDate
 * @param {number} weekNum - Week number
 * @returns {string} - Formatted date range
 */
export function getWeekDateRange(project, weekNum) {
  const start = new Date(project.startDate);
  const weekStart = new Date(start);
  weekStart.setDate(start.getDate() + (weekNum - 1) * 7);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);

  const fmt = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${fmt(weekStart)} - ${fmt(weekEnd)}, ${weekStart.getFullYear()}`;
}

/**
 * Get task status based on planned vs reality
 * @param {Object} task - Task object
 * @param {number|null} currentWeek - Current week number
 * @returns {string} - Status: 'on-track', 'behind', 'ahead', 'complete', 'not-started'
 */
export function getTaskStatus(task, currentWeek) {
  if (!currentWeek || !task.planned || !task.planned.length) return 'not-started';

  const plannedUpToNow = task.planned.filter(w => w <= currentWeek);
  const realityUpToNow = (task.reality || []).filter(w => w <= currentWeek);

  // Check if all planned weeks have reality marked
  if (task.planned.every(w => (task.reality || []).includes(w))) return 'complete';

  // Check if ahead (more reality than planned up to now)
  if (realityUpToNow.length > plannedUpToNow.length) return 'ahead';

  // Check if on track (reality matches plan for weeks that should be done)
  if (realityUpToNow.length >= plannedUpToNow.length && plannedUpToNow.length > 0) return 'on-track';

  // Check if not started yet (current week is before first planned week)
  if (currentWeek < task.planned[0]) return 'not-started';

  // Otherwise behind
  if (plannedUpToNow.length > 0 && realityUpToNow.length < plannedUpToNow.length) return 'behind';

  return 'not-started';
}

/**
 * Calculate progress percentage
 * @param {Object} project - Project data
 * @returns {Object} - {currentWeek, totalWeeks, percent}
 */
export function calculateProgress(project) {
  const currentWeek = getCurrentWeek(project) || 0;
  const totalWeeks = project.totalWeeks;
  const percent = Math.round((currentWeek / totalWeeks) * 100);
  return { currentWeek, totalWeeks, percent };
}

/**
 * Calculate variance between planned and reality
 * @param {Array} tasks - Array of tasks
 * @returns {Object} - {totalPlanned, totalReality, diff}
 */
export function calculateVariance(tasks) {
  let totalPlanned = 0;
  let totalReality = 0;

  tasks.forEach(task => {
    totalPlanned += (task.planned || []).length;
    totalReality += (task.reality || []).length;
  });

  const diff = totalReality - totalPlanned;
  return { totalPlanned, totalReality, diff };
}

/**
 * Clone project data deeply
 * @param {Object} data - Project data
 * @returns {Object} - Deep clone
 */
export function cloneProjectData(data) {
  return JSON.parse(JSON.stringify(data));
}
