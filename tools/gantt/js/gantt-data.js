/**
 * Gantt Data Module - Re-exports unified data with Gantt-specific additions
 * This module bridges the unified data layer with the Gantt tool
 */

// Re-export everything from unified data
export {
  DATA_VERSION,
  STORAGE_KEY,
  BACKUP_KEY,
  generateTaskId,
  deriveColumnFromProgress,
  deriveStatus,
  migrateTaskToV5,
  migrateToV5,
  syncGanttToKanban,
  syncKanbanToGantt,
  repositionColumn,
  moveTaskToColumn,
  getColumnTasks,
  calculateWeeksFromDates,
  generateMonthsFromDateRange,
  getCurrentWeek,
  getWeekDateRange,
  calculateProgress,
  calculateVariance,
  cloneProjectData
} from '../../../shared/js/unified-data.js';

// Import what we need for local use
import {
  DATA_VERSION,
  migrateToV5 as migrateProjectToV5,
  migrateTaskToV5,
  deriveStatus
} from '../../../shared/js/unified-data.js';

// Default project data (Gantt-specific example project)
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
  workflow: {
    columns: [
      { id: 'backlog', name: 'Backlog', color: '#6366f1', wipLimit: null, position: 0 },
      { id: 'todo', name: 'To Do', color: '#a78bfa', wipLimit: 5, position: 1 },
      { id: 'in-progress', name: 'In Progress', color: '#fbbf24', wipLimit: 3, position: 2 },
      { id: 'done', name: 'Done', color: '#22c55e', wipLimit: null, position: 3 }
    ],
    enableWipLimits: true
  },
  tasks: [
    { id: "task_1", category: "Planning", name: "Plan game concept", planned: [1], reality: [], board: { columnId: "todo", position: 0 } },
    { id: "task_2", category: "Planning", name: "Create mood boards", planned: [1, 2], reality: [], board: { columnId: "todo", position: 1 } },
    { id: "task_3", category: "Planning", name: "Style guide", planned: [2, 3], reality: [], board: { columnId: "todo", position: 2 } },
    { id: "task_4", category: "Planning", name: "List assets", planned: [2], reality: [], board: { columnId: "todo", position: 3 } },
    { id: "task_5", category: "Planning", name: "Thumbnails", planned: [3, 4], reality: [], board: { columnId: "backlog", position: 0 } },
    { id: "task_6", category: "Planning", name: "Concept sketches", planned: [3, 4], reality: [], board: { columnId: "backlog", position: 1 } },
    { id: "task_7", category: "Planning", name: "Understanding Unity", planned: [1, 2, 3, 4], reality: [], board: { columnId: "todo", position: 4 } },
    { id: "task_8", category: "Characters", name: "Luna mesh", planned: [5, 6], reality: [], board: { columnId: "backlog", position: 2 } },
    { id: "task_9", category: "Characters", name: "Weapon mesh", planned: [7], reality: [], board: { columnId: "backlog", position: 3 } },
    { id: "task_10", category: "Characters", name: "Enemy mesh", planned: [8, 9], reality: [], board: { columnId: "backlog", position: 4 } },
    { id: "task_11", category: "Characters", name: "Luna texture", planned: [10, 11], reality: [], board: { columnId: "backlog", position: 5 } },
    { id: "task_12", category: "Characters", name: "Weapon texture", planned: [11, 12], reality: [], board: { columnId: "backlog", position: 6 } },
    { id: "task_13", category: "Characters", name: "Enemy texture", planned: [12, 13], reality: [], board: { columnId: "backlog", position: 7 } },
    { id: "task_14", category: "Characters", name: "Luna animations", planned: [14, 15], reality: [], board: { columnId: "backlog", position: 8 } },
    { id: "task_15", category: "Characters", name: "Enemy animations", planned: [16, 17], reality: [], board: { columnId: "backlog", position: 9 } },
    { id: "task_16", category: "Env - Objectives", name: "Angel Fountain mesh", planned: [5, 6], reality: [], board: { columnId: "backlog", position: 10 } },
    { id: "task_17", category: "Env - Objectives", name: "Vision Tower mesh", planned: [7, 8], reality: [], board: { columnId: "backlog", position: 11 } },
    { id: "task_18", category: "Env - Objectives", name: "Chest mesh", planned: [8, 9], reality: [], board: { columnId: "backlog", position: 12 } },
    { id: "task_19", category: "Env - Objectives", name: "Angel Fountain texture", planned: [9, 10], reality: [], board: { columnId: "backlog", position: 13 } },
    { id: "task_20", category: "Env - Objectives", name: "Vision Tower texture", planned: [10, 11], reality: [], board: { columnId: "backlog", position: 14 } },
    { id: "task_21", category: "Env - Objectives", name: "Chest texture", planned: [11, 12], reality: [], board: { columnId: "backlog", position: 15 } },
    { id: "task_22", category: "Env - Town", name: "Floor tiles", planned: [12, 13], reality: [], board: { columnId: "backlog", position: 16 } },
    { id: "task_23", category: "Env - Town", name: "House tiles", planned: [13, 14, 15], reality: [], board: { columnId: "backlog", position: 17 } },
    { id: "task_24", category: "Env - Town", name: "Trees", planned: [15, 16], reality: [], board: { columnId: "backlog", position: 18 } },
    { id: "task_25", category: "Env - Town", name: "Rocks", planned: [16], reality: [], board: { columnId: "backlog", position: 19 } },
    { id: "task_26", category: "Env - Town", name: "Palisade", planned: [17], reality: [], board: { columnId: "backlog", position: 20 } },
    { id: "task_27", category: "Env - Forest", name: "Floor tiles", planned: [18], reality: [], board: { columnId: "backlog", position: 21 } },
    { id: "task_28", category: "Env - Forest", name: "Portal", planned: [19, 20], reality: [], board: { columnId: "backlog", position: 22 } },
    { id: "task_29", category: "Env - Forest", name: "Bushes", planned: [21], reality: [], board: { columnId: "backlog", position: 23 } },
    { id: "task_30", category: "Misc", name: "Unity integration", planned: [22, 23, 24, 25, 26, 27], reality: [], board: { columnId: "backlog", position: 24 } },
    { id: "task_31", category: "Misc", name: "VFX", planned: [26, 27, 28, 29], reality: [], board: { columnId: "backlog", position: 25 } },
    { id: "task_32", category: "Misc", name: "Documentation", planned: [30, 31], reality: [], board: { columnId: "backlog", position: 26 } },
    { id: "task_33", category: "Misc", name: "Cushion time", planned: [32, 33, 34, 35], reality: [], board: { columnId: "backlog", position: 27 } }
  ]
};

/**
 * Migrate old data format to new format
 * Wrapper for migrateToV5 for backwards compatibility
 * @param {Object} data - Data to migrate
 * @returns {Object} - Migrated data
 */
export function migrateProjectData(data) {
  return migrateProjectToV5(data);
}

/**
 * Migrate task format (startWeek/endWeek to planned array)
 * Wrapper for migrateTaskToV5 for backwards compatibility
 * @param {Object} task - Task to migrate
 * @returns {Object} - Migrated task
 */
export function migrateTask(task) {
  return migrateTaskToV5(task, 0);
}

/**
 * Get task status based on planned vs reality
 * Wrapper for deriveStatus for backwards compatibility
 * @param {Object} task - Task object
 * @param {number|null} currentWeek - Current week number
 * @returns {string} - Status: 'on-track', 'behind', 'ahead', 'complete', 'not-started'
 */
export function getTaskStatus(task, currentWeek) {
  return deriveStatus(task, currentWeek);
}
