/**
 * Unified Data Module - Shared data model for Gantt and Kanban
 * Provides data structure, migrations, and bidirectional sync
 */

// Data format version (v5 adds workflow and board data)
export const DATA_VERSION = 5;

// Storage key (shared between tools)
export const STORAGE_KEY = 'ganttProject';
export const BACKUP_KEY = 'ganttProject_backups';

// Default column IDs (cannot be deleted)
export const DEFAULT_COLUMN_IDS = ['backlog', 'todo', 'in-progress', 'done'];

// Default workflow configuration for Kanban
export const defaultWorkflow = {
  columns: [
    { id: 'backlog', name: 'Backlog', color: '#6366f1', position: 0 },
    { id: 'todo', name: 'To Do', color: '#a78bfa', position: 1 },
    { id: 'in-progress', name: 'In Progress', color: '#fbbf24', position: 2 },
    { id: 'done', name: 'Done', color: '#22c55e', position: 3 }
  ]
};

/**
 * Generate a unique column ID
 * @returns {string} - Unique ID
 */
export function generateColumnId() {
  return 'col_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

/**
 * Check if a column is a default column (cannot be deleted)
 * @param {string} columnId - Column ID to check
 * @returns {boolean} - True if default column
 */
export function isDefaultColumn(columnId) {
  return DEFAULT_COLUMN_IDS.includes(columnId);
}

// Default board data for a task
export const defaultBoardData = {
  columnId: 'backlog',
  position: 0
};

/**
 * Generate a unique task ID
 * @returns {string} - Unique ID
 */
export function generateTaskId() {
  return 'task_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

/**
 * Derive Kanban column from task progress
 * Used during migration and sync
 * @param {Object} task - Task with planned/reality arrays
 * @returns {string} - Column ID
 */
export function deriveColumnFromProgress(task) {
  const planned = task.planned || [];
  const reality = task.reality || [];

  // If all planned weeks are in reality, task is done
  if (planned.length > 0 && planned.every(w => reality.includes(w))) {
    return 'done';
  }

  // If any reality weeks exist, task is in progress
  if (reality.length > 0) {
    return 'in-progress';
  }

  // If planned weeks exist, task is ready to start
  if (planned.length > 0) {
    return 'todo';
  }

  // Otherwise, task is in backlog
  return 'backlog';
}

/**
 * Derive task status for display purposes
 * @param {Object} task - Task object
 * @param {number|null} currentWeek - Current week number
 * @returns {string} - Status: 'on-track', 'behind', 'ahead', 'complete', 'not-started'
 */
export function deriveStatus(task, currentWeek) {
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
 * Migrate task from v3/v4 format to v5
 * Adds board data and ensures string ID
 * @param {Object} task - Task to migrate
 * @param {number} index - Position index for board ordering
 * @returns {Object} - Migrated task
 */
export function migrateTaskToV5(task, index = 0) {
  // Ensure task has string ID
  if (typeof task.id === 'number') {
    task.id = 'task_' + task.id;
  } else if (!task.id) {
    task.id = generateTaskId();
  }

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

  // Add board data if missing (v5)
  if (!task.board) {
    task.board = {
      columnId: deriveColumnFromProgress(task),
      position: index
    };
  }

  return task;
}

/**
 * Migrate project data to v5 format
 * @param {Object} data - Project data to migrate
 * @returns {Object} - Migrated data
 */
export function migrateToV5(data) {
  // If old format with months array, calculate endDate
  if (data.months && data.months.length > 0 && !data.project.endDate) {
    const calculatedWeeks = data.months.reduce((sum, m) => sum + (m.weeks || 0), 0);
    data.project.totalWeeks = calculatedWeeks;

    const start = new Date(data.project.startDate);
    const end = new Date(start);
    end.setDate(start.getDate() + (calculatedWeeks * 7) - 1);
    data.project.endDate = end.toISOString().split('T')[0];

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

  // Ensure team array exists (v3 migration)
  if (!data.team) {
    data.team = [];
  }

  // Add workflow config if missing (v5)
  if (!data.workflow) {
    data.workflow = JSON.parse(JSON.stringify(defaultWorkflow));
    console.log('Added default workflow configuration');
  }

  // Calculate position indices per column for board ordering
  const columnPositions = {};

  // Migrate tasks
  data.tasks = data.tasks.map((task, index) => {
    const migrated = migrateTaskToV5(task, index);

    // Calculate correct position within column
    const columnId = migrated.board.columnId;
    if (!columnPositions[columnId]) {
      columnPositions[columnId] = 0;
    }
    migrated.board.position = columnPositions[columnId]++;

    return migrated;
  });

  // Update version
  data.version = DATA_VERSION;

  return data;
}

/**
 * Sync Gantt changes to Kanban board state
 * Called when reality array changes in Gantt
 * @param {Object} task - Task that was updated
 * @param {Object} workflow - Workflow configuration
 * @returns {Object} - Updated task with synced board state
 */
export function syncGanttToKanban(task, workflow) {
  const newColumnId = deriveColumnFromProgress(task);

  // Only update if column actually changed
  if (task.board.columnId !== newColumnId) {
    task.board.columnId = newColumnId;
    // Position will be recalculated by the Kanban view
    console.log(`Synced task "${task.name}" to column: ${newColumnId}`);
  }

  return task;
}

/**
 * Sync Kanban changes to Gantt timeline
 * Called when card moves to a different column
 * @param {Object} task - Task being moved
 * @param {string} newColumnId - Target column ID
 * @param {number} currentWeek - Current week number (for in-progress)
 * @returns {Object} - Updated task with synced reality
 */
export function syncKanbanToGantt(task, newColumnId, currentWeek) {
  const oldColumnId = task.board.columnId;

  // Moving to Done: DON'T auto-fill reality
  // Reality should reflect actual work done, which may differ from planned
  // A task can be "done" even if it took fewer weeks or different weeks than planned
  if (newColumnId === 'done' && oldColumnId !== 'done') {
    console.log(`Moved task "${task.name}" to Done (reality unchanged:`, task.reality, ')');
  }

  // Moving to In Progress: optionally add current week if reality is empty
  if (newColumnId === 'in-progress' && oldColumnId !== 'in-progress' && oldColumnId !== 'done') {
    if ((!task.reality || task.reality.length === 0) && currentWeek) {
      task.reality = [currentWeek];
      console.log(`Started task "${task.name}" in week ${currentWeek}`);
    }
  }

  // Moving back from Done: keep reality as-is (user can manually adjust)
  // Moving to Backlog/To Do: no change to reality

  // Update board column
  task.board.columnId = newColumnId;

  return task;
}

/**
 * Reposition tasks within a column
 * @param {Array} tasks - All tasks
 * @param {string} columnId - Column to reposition
 * @returns {Array} - Tasks with updated positions
 */
export function repositionColumn(tasks, columnId) {
  const columnTasks = tasks
    .filter(t => t.board.columnId === columnId)
    .sort((a, b) => a.board.position - b.board.position);

  columnTasks.forEach((task, index) => {
    task.board.position = index;
  });

  return tasks;
}

/**
 * Move task to new column and position
 * @param {Array} tasks - All tasks
 * @param {string} taskId - Task to move
 * @param {string} targetColumnId - Target column
 * @param {number} targetPosition - Position in target column
 * @param {number} currentWeek - Current week for sync
 * @returns {Array} - Updated tasks
 */
export function moveTaskToColumn(tasks, taskId, targetColumnId, targetPosition, currentWeek) {
  const task = tasks.find(t => t.id === taskId);
  if (!task) return tasks;

  const sourceColumnId = task.board.columnId;

  // Apply Kanban → Gantt sync
  syncKanbanToGantt(task, targetColumnId, currentWeek);

  // Update position
  task.board.position = targetPosition;

  // Reorder tasks in target column to make room
  const targetTasks = tasks
    .filter(t => t.board.columnId === targetColumnId && t.id !== taskId)
    .sort((a, b) => a.board.position - b.board.position);

  targetTasks.forEach((t, index) => {
    if (index >= targetPosition) {
      t.board.position = index + 1;
    } else {
      t.board.position = index;
    }
  });

  // Reorder source column if different
  if (sourceColumnId !== targetColumnId) {
    repositionColumn(tasks, sourceColumnId);
  }

  return tasks;
}

/**
 * Get tasks for a specific column, sorted by position
 * @param {Array} tasks - All tasks
 * @param {string} columnId - Column ID
 * @returns {Array} - Sorted tasks for the column
 */
export function getColumnTasks(tasks, columnId) {
  return tasks
    .filter(t => t.board.columnId === columnId)
    .sort((a, b) => a.board.position - b.board.position);
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
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24)) + 1;
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
  const monthMap = new Map();

  for (let week = 1; week <= totalWeeks; week++) {
    const weekStart = new Date(start);
    weekStart.setDate(start.getDate() + (week - 1) * 7);

    const year = weekStart.getFullYear();
    const monthIndex = weekStart.getMonth();
    const monthName = weekStart.toLocaleDateString('en-US', { month: 'short' });
    const key = `${year}-${monthIndex}-${monthName}`;

    monthMap.set(key, (monthMap.get(key) || 0) + 1);
  }

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
