/**
 * Unified Data Module - Shared data model for Gantt, Kanban, Sprint, and Time Tracker
 * Provides data structure, migrations, and bidirectional sync
 */

// Data format version (v11 adds retrospectives)
export const DATA_VERSION = 11;

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
 * Generate a unique sprint ID
 * @returns {string} - Unique ID
 */
export function generateSprintId() {
  return 'sprint_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

/**
 * Generate a unique time entry ID
 * @returns {string} - Unique ID
 */
export function generateTimeEntryId() {
  return 'time_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

/**
 * Generate a unique retrospective ID
 * @returns {string} - Unique ID
 */
export function generateRetroId() {
  return 'retro_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

/**
 * Generate a unique retrospective item ID
 * @returns {string} - Unique ID
 */
export function generateItemId() {
  return 'item_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
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
 * Migrate project data from v4 to v5 format
 * @param {Object} data - Project data to migrate
 * @returns {Object} - Migrated data
 */
function migrateV4ToV5(data) {
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

  // Update version to 5 (will be updated to 6 by migrateToV6)
  data.version = 5;

  return data;
}

/**
 * Migrate project data from v5 to v6 format (adds sprint planning)
 * @param {Object} data - Project data to migrate
 * @returns {Object} - Migrated data
 */
function migrateV5ToV6(data) {

  // Add sprints array if missing
  if (!data.sprints) {
    data.sprints = [];
    console.log('Added sprints array');
  }

  // Migrate tasks with sprint-related properties
  data.tasks = data.tasks.map((task, index) => {
    // Add story points if missing (null = unestimated)
    if (task.storyPoints === undefined) {
      task.storyPoints = null;
    }

    // Add sprint assignment if missing (null = product backlog)
    if (task.sprintId === undefined) {
      task.sprintId = null;
    }

    // Add backlog position if missing (for priority ordering)
    if (task.backlogPosition === undefined) {
      task.backlogPosition = index;
    }

    // Add completedAt for tasks in 'done' column that don't have it (for burndown calculation)
    if (task.board?.columnId === 'done' && !task.completedAt) {
      task.completedAt = new Date().toISOString();
      console.log(`Set completedAt for completed task: ${task.name}`);
    }

    return task;
  });

  // Update version to 6
  data.version = 6;

  return data;
}

/**
 * Migrate project data from v6 to v7 format (adds time tracking)
 * @param {Object} data - Project data to migrate
 * @returns {Object} - Migrated data
 */
function migrateV6ToV7(data) {
  // Add timeEntries array if missing
  if (!data.timeEntries) {
    data.timeEntries = [];
  }

  return data;
}

/**
 * Migrate project data from v7 to v8 format (adds burndown tracking)
 * @param {Object} data - Project data to migrate
 * @returns {Object} - Migrated data
 */
function migrateV7ToV8(data) {
  // Initialize burndown arrays for existing sprints (will be removed in v10)
  if (data.sprints) {
    data.sprints.forEach(sprint => {
      if (!sprint.burndown) {
        sprint.burndown = [];
      }
    });
  }

  return data;
}

/**
 * Migrate project data from v8 to v9 format (adds resource calendar)
 * @param {Object} data - Project data to migrate
 * @returns {Object} - Migrated data
 */
function migrateV8ToV9(data) {
  // Default team member colors palette
  const defaultColors = [
    '#a78bfa', '#f472b6', '#38bdf8', '#4ade80',
    '#fbbf24', '#fb923c', '#f87171', '#a3e635'
  ];

  // Migrate team members with new fields
  if (data.team && Array.isArray(data.team)) {
    // Check if team is old format (array of strings)
    if (data.team.length > 0 && typeof data.team[0] === 'string') {
      data.team = data.team.map((name, index) => ({
        id: 'member_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
        name: name,
        role: '',
        color: defaultColors[index % defaultColors.length],
        hoursPerWeek: 40,
        availability: []
      }));
      console.log('Migrated team members from string format to object format');
    } else {
      // Team is already object format, add missing fields
      data.team = data.team.map((member, index) => {
        if (typeof member === 'string') {
          return {
            id: 'member_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
            name: member,
            role: '',
            color: defaultColors[index % defaultColors.length],
            hoursPerWeek: 40,
            availability: []
          };
        }
        // Ensure all fields exist
        return {
          id: member.id || 'member_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
          name: member.name || member,
          role: member.role || '',
          color: member.color || defaultColors[index % defaultColors.length],
          hoursPerWeek: member.hoursPerWeek || 40,
          availability: member.availability || []
        };
      });
    }
  }

  // Add calendar settings if missing
  if (!data.calendarSettings) {
    data.calendarSettings = {
      workDays: [1, 2, 3, 4, 5], // Mon-Fri (0=Sun, 6=Sat)
      hoursPerDay: 8
    };
  }

  // Ensure completedAt is set for tasks in 'done' column (for burndown calculation)
  (data.tasks || []).forEach(task => {
    if (task.board?.columnId === 'done' && !task.completedAt) {
      task.completedAt = new Date().toISOString();
      console.log(`Set completedAt for completed task: ${task.name}`);
    }
  });

  return data;
}

/**
 * Migrate project data from v9 to v10 format
 * - Converts sprint startWeek/endWeek to ISO dates
 * - Removes sprint.burndown arrays (now calculated from completedAt)
 * - Adds assigneeId field linking to team member IDs
 * @param {Object} data - Project data to migrate
 * @returns {Object} - Migrated data
 */
function migrateV9ToV10(data) {
  // 1. Convert sprint dates to ISO format, remove week numbers and burndown
  (data.sprints || []).forEach(sprint => {
    // Convert startWeek to startDate
    if (!sprint.startDate && sprint.startWeek && data.project?.startDate) {
      const start = new Date(data.project.startDate);
      start.setDate(start.getDate() + (sprint.startWeek - 1) * 7);
      sprint.startDate = start.toISOString().split('T')[0];
    }
    // Convert endWeek to endDate
    if (!sprint.endDate && sprint.endWeek && data.project?.startDate) {
      const start = new Date(data.project.startDate);
      start.setDate(start.getDate() + (sprint.endWeek * 7) - 1);
      sprint.endDate = start.toISOString().split('T')[0];
    }
    // Clean up deprecated fields
    delete sprint.startWeek;
    delete sprint.endWeek;
    delete sprint.burndown; // Calculated from completedAt now
  });

  // 2. Add assigneeId links based on existing assignee names
  (data.tasks || []).forEach(task => {
    if (task.assignee && !task.assigneeId) {
      const member = (data.team || []).find(m =>
        m.name === task.assignee || m === task.assignee
      );
      if (member?.id) {
        task.assigneeId = member.id;
      }
    }
  });

  return data;
}

/**
 * Migrate project data from v10 to v11 format (adds retrospectives)
 * @param {Object} data - Project data to migrate
 * @returns {Object} - Migrated data
 */
function migrateV10ToV11(data) {
  // Add retrospectives array if missing
  if (!data.retrospectives) {
    data.retrospectives = [];
  }

  return data;
}

// ========== MIGRATION REGISTRY ==========

/**
 * Internal migration registry - maps version numbers to migration functions
 * Each migration function upgrades data from version N-1 to version N
 */
const migrations = {
  5: migrateV4ToV5,
  6: migrateV5ToV6,
  7: migrateV6ToV7,
  8: migrateV7ToV8,
  9: migrateV8ToV9,
  10: migrateV9ToV10,
  11: migrateV10ToV11
};

/**
 * Migrate data to latest version
 * Automatically chains through all necessary migrations
 * @param {Object} data - Project data (any version)
 * @returns {Object} - Migrated data at latest version
 */
export function migrateToLatest(data) {
  let currentVersion = data.version || 4;

  while (currentVersion < DATA_VERSION) {
    const nextVersion = currentVersion + 1;
    const migrateFn = migrations[nextVersion];

    if (!migrateFn) {
      console.error(`No migration found for v${nextVersion}`);
      break;
    }

    console.log(`Migrating v${currentVersion} → v${nextVersion}...`);
    data = migrateFn(data);
    data.version = nextVersion;
    currentVersion = nextVersion;
  }

  return data;
}

/**
 * @deprecated Use migrateToLatest() instead
 * Kept for backwards compatibility with existing tool imports
 */
export function migrateToV9(data) {
  console.warn('migrateToV9 is deprecated, use migrateToLatest instead');
  return migrateToLatest(data);
}

// ========== HELPER FUNCTIONS ==========

/**
 * Get sprint week number from dates (replaces stored startWeek)
 * @param {Object} sprint - Sprint with startDate
 * @param {Object} project - Project with startDate
 * @returns {number} - Week number relative to project start
 */
export function getSprintWeekNumber(sprint, project) {
  if (!sprint.startDate || !project.startDate) return 1;
  const projectStart = new Date(project.startDate);
  const sprintStart = new Date(sprint.startDate);
  const diffDays = Math.floor((sprintStart - projectStart) / (1000 * 60 * 60 * 24));
  return Math.floor(diffDays / 7) + 1;
}

/**
 * Get task assignee object (uses assigneeId with name fallback)
 * @param {Object} task - Task object
 * @param {Array} team - Team members array
 * @returns {Object|null} - Team member object or null
 */
export function getTaskAssignee(task, team) {
  if (!team || !Array.isArray(team)) return null;
  if (task.assigneeId) {
    return team.find(m => m.id === task.assigneeId) || null;
  }
  if (task.assignee) {
    return team.find(m => m.name === task.assignee) || null;
  }
  return null;
}

// ========== BURNDOWN HELPERS ==========

/**
 * @deprecated Burndown is now calculated from task.completedAt timestamps
 * This function is kept for backwards compatibility but does nothing useful
 */
export function recordBurndownSnapshot(sprint, tasks) {
  console.warn('recordBurndownSnapshot is deprecated - burndown is now calculated from completedAt');
  return { date: new Date().toISOString().split('T')[0], remainingPoints: 0, remainingTasks: 0 };
}

/**
 * Get the start date for a sprint (from startWeek or startDate)
 * @param {Object} sprint - Sprint object
 * @param {Object} project - Project object
 * @returns {Date} - Sprint start date
 */
export function getSprintStartDate(sprint, project) {
  if (sprint.startDate) {
    return new Date(sprint.startDate);
  }
  // Calculate from project start and sprint week
  if (sprint.startWeek && project.startDate) {
    const start = new Date(project.startDate);
    start.setDate(start.getDate() + (sprint.startWeek - 1) * 7);
    return start;
  }
  return new Date();
}

/**
 * Get the end date for a sprint (from endWeek or endDate)
 * @param {Object} sprint - Sprint object
 * @param {Object} project - Project object
 * @returns {Date} - Sprint end date
 */
export function getSprintEndDate(sprint, project) {
  if (sprint.endDate) {
    return new Date(sprint.endDate);
  }
  // Calculate from project start and sprint week
  if (sprint.endWeek && project.startDate) {
    const start = new Date(project.startDate);
    start.setDate(start.getDate() + sprint.endWeek * 7 - 1);
    return start;
  }
  // Default to 2 weeks from start
  const startDate = getSprintStartDate(sprint, project);
  const endDate = new Date(startDate);
  endDate.setDate(startDate.getDate() + 13);
  return endDate;
}

/**
 * Calculate the ideal burndown line for a sprint
 * @param {Object} sprint - Sprint object
 * @param {Object} project - Project object
 * @param {number} totalPoints - Total story points at sprint start
 * @param {number} totalTasks - Total task count at sprint start
 * @returns {Array} - Array of {date, points, tasks} for ideal line
 */
export function calculateIdealBurndown(sprint, project, totalPoints, totalTasks) {
  const start = getSprintStartDate(sprint, project);
  const end = getSprintEndDate(sprint, project);
  const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;

  const ideal = [];
  for (let i = 0; i < days; i++) {
    const date = new Date(start);
    date.setDate(date.getDate() + i);
    const progress = i / (days - 1);
    ideal.push({
      date: date.toISOString().split('T')[0],
      points: Math.round(totalPoints * (1 - progress) * 10) / 10,
      tasks: Math.round(totalTasks * (1 - progress) * 10) / 10
    });
  }
  return ideal;
}

/**
 * Calculate actual burndown from task completion timestamps
 * Derives the burndown line from when tasks were completed (completedAt field)
 * @param {Object} sprint - Sprint object
 * @param {Object} project - Project object
 * @param {Array} tasks - All tasks
 * @returns {Array} - Array of {date, remainingPoints, remainingTasks} for actual line
 */
export function calculateBurndownActual(sprint, project, tasks) {
  const sprintTasks = tasks.filter(t => t.sprintId === sprint.id);
  const totalPoints = sprintTasks.reduce((sum, t) => sum + (t.storyPoints || 0), 0);
  const totalTasks = sprintTasks.length;

  const start = getSprintStartDate(sprint, project);
  const end = getSprintEndDate(sprint, project);
  const today = new Date();
  today.setHours(23, 59, 59, 999); // Include all of today

  // Use the earlier of end date or today
  const actualEnd = today < end ? today : end;

  const actual = [];
  const currentDate = new Date(start);
  currentDate.setHours(0, 0, 0, 0);

  while (currentDate <= actualEnd) {
    const dateStr = currentDate.toISOString().split('T')[0];
    const endOfDay = dateStr + 'T23:59:59.999Z';

    // Count tasks NOT completed by end of this day
    // A task is remaining if: no completedAt, or completedAt is after this day
    const remainingTasks = sprintTasks.filter(t => {
      if (!t.completedAt) return true; // Not completed
      return t.completedAt > endOfDay; // Completed after this day
    });

    const remainingPoints = remainingTasks.reduce((sum, t) => sum + (t.storyPoints || 0), 0);

    actual.push({
      date: dateStr,
      remainingPoints,
      remainingTasks: remainingTasks.length
    });

    currentDate.setDate(currentDate.getDate() + 1);
  }

  return actual;
}

/**
 * Get comprehensive burndown data for a sprint
 * Actual burndown is calculated from task completion timestamps (completedAt field)
 * @param {Object} sprint - Sprint object
 * @param {Object} project - Project object
 * @param {Array} tasks - All tasks
 * @returns {Object} - {sprint, totalPoints, totalTasks, ideal, actual, currentRemaining, daysRemaining, daysElapsed}
 */
export function getBurndownData(sprint, project, tasks) {
  const sprintTasks = tasks.filter(t => t.sprintId === sprint.id);
  const totalPoints = sprintTasks.reduce((sum, t) => sum + (t.storyPoints || 0), 0);
  const totalTasks = sprintTasks.length;

  // Calculate current remaining
  const remaining = sprintTasks.filter(t => t.board?.columnId !== 'done');
  const currentRemainingPoints = remaining.reduce((sum, t) => sum + (t.storyPoints || 0), 0);
  const currentRemainingTasks = remaining.length;

  // Calculate days info
  const start = getSprintStartDate(sprint, project);
  const end = getSprintEndDate(sprint, project);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const totalDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
  const daysElapsed = Math.max(0, Math.ceil((today - start) / (1000 * 60 * 60 * 24)));
  const daysRemaining = Math.max(0, Math.ceil((end - today) / (1000 * 60 * 60 * 24)) + 1);

  // Calculate actual burndown from task completion timestamps
  const actual = calculateBurndownActual(sprint, project, tasks);

  return {
    sprint,
    totalPoints,
    totalTasks,
    ideal: calculateIdealBurndown(sprint, project, totalPoints, totalTasks),
    actual,
    currentRemaining: {
      points: currentRemainingPoints,
      tasks: currentRemainingTasks
    },
    daysElapsed,
    daysRemaining,
    totalDays,
    startDate: start.toISOString().split('T')[0],
    endDate: end.toISOString().split('T')[0]
  };
}

// ========== TIME ENTRY HELPERS ==========

/**
 * Get time entries for a specific date
 * @param {Array} entries - All time entries
 * @param {string} date - ISO date string (YYYY-MM-DD)
 * @returns {Array} - Entries for that date, sorted by start time
 */
export function getEntriesForDate(entries, date) {
  return entries
    .filter(e => e.date === date)
    .sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));
}

/**
 * Get time entries for a date range
 * @param {Array} entries - All time entries
 * @param {string} startDate - Start date (inclusive)
 * @param {string} endDate - End date (inclusive)
 * @returns {Array} - Entries in range, sorted by date and start time
 */
export function getEntriesForDateRange(entries, startDate, endDate) {
  return entries
    .filter(e => e.date >= startDate && e.date <= endDate)
    .sort((a, b) => {
      const dateCompare = a.date.localeCompare(b.date);
      if (dateCompare !== 0) return dateCompare;
      return (a.startTime || '').localeCompare(b.startTime || '');
    });
}

/**
 * Get time entries for a specific task
 * @param {Array} entries - All time entries
 * @param {string} taskId - Task ID
 * @returns {Array} - Entries for that task, sorted by date
 */
export function getEntriesForTask(entries, taskId) {
  return entries
    .filter(e => e.taskId === taskId)
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Calculate total minutes from an array of entries
 * @param {Array} entries - Time entries
 * @returns {number} - Total minutes
 */
export function calculateTotalMinutes(entries) {
  return entries.reduce((sum, e) => sum + (e.durationMinutes || 0), 0);
}

/**
 * Format minutes as hours and minutes string
 * @param {number} totalMinutes - Total minutes
 * @returns {string} - Formatted string like "2h 30m" or "45m"
 */
export function formatDuration(totalMinutes) {
  if (totalMinutes === 0) return '0m';
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

/**
 * Format minutes as HH:MM:SS timer display
 * @param {number} totalSeconds - Total seconds
 * @returns {string} - Formatted string like "02:34:15"
 */
export function formatTimerDisplay(totalSeconds) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds]
    .map(n => String(n).padStart(2, '0'))
    .join(':');
}

/**
 * Group time entries by task
 * @param {Array} entries - Time entries
 * @param {Array} tasks - All tasks
 * @returns {Array} - Array of {task, totalMinutes, entries}
 */
export function groupEntriesByTask(entries, tasks) {
  const taskMap = new Map();

  // Initialize with null for entries without task
  taskMap.set(null, { task: null, totalMinutes: 0, entries: [] });

  entries.forEach(entry => {
    const taskId = entry.taskId || null;
    if (!taskMap.has(taskId)) {
      const task = tasks.find(t => t.id === taskId);
      taskMap.set(taskId, { task, totalMinutes: 0, entries: [] });
    }
    const group = taskMap.get(taskId);
    group.totalMinutes += entry.durationMinutes || 0;
    group.entries.push(entry);
  });

  // Convert to array and sort by total time (descending)
  return Array.from(taskMap.values())
    .filter(g => g.entries.length > 0)
    .sort((a, b) => b.totalMinutes - a.totalMinutes);
}

/**
 * Group time entries by category (via task)
 * @param {Array} entries - Time entries
 * @param {Array} tasks - All tasks
 * @param {Object} categories - Category name to color map
 * @returns {Array} - Array of {category, color, totalMinutes, entries}
 */
export function groupEntriesByCategory(entries, tasks, categories) {
  const categoryMap = new Map();

  // Initialize uncategorized
  categoryMap.set('Uncategorized', {
    category: 'Uncategorized',
    color: '#7c7c8a',
    totalMinutes: 0,
    entries: []
  });

  entries.forEach(entry => {
    let category = 'Uncategorized';
    let color = '#7c7c8a';

    if (entry.taskId) {
      const task = tasks.find(t => t.id === entry.taskId);
      if (task && task.category) {
        category = task.category;
        color = categories[category] || '#7c7c8a';
      }
    }

    if (!categoryMap.has(category)) {
      categoryMap.set(category, {
        category,
        color,
        totalMinutes: 0,
        entries: []
      });
    }

    const group = categoryMap.get(category);
    group.totalMinutes += entry.durationMinutes || 0;
    group.entries.push(entry);
  });

  // Convert to array and sort by total time (descending)
  return Array.from(categoryMap.values())
    .filter(g => g.entries.length > 0)
    .sort((a, b) => b.totalMinutes - a.totalMinutes);
}

/**
 * Get the start of the week (Monday) for a given date
 * @param {Date} date - Reference date
 * @returns {Date} - Start of week
 */
export function getWeekStart(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Get the end of the week (Sunday) for a given date
 * @param {Date} date - Reference date
 * @returns {Date} - End of week
 */
export function getWeekEnd(date) {
  const start = getWeekStart(date);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return end;
}

/**
 * Get tasks in the product backlog (not assigned to any sprint)
 * @param {Array} tasks - All tasks
 * @returns {Array} - Tasks sorted by backlog position
 */
export function getProductBacklog(tasks) {
  return tasks
    .filter(t => t.sprintId === null || t.sprintId === undefined)
    .sort((a, b) => (a.backlogPosition || 0) - (b.backlogPosition || 0));
}

/**
 * Get tasks assigned to a specific sprint
 * @param {Array} tasks - All tasks
 * @param {string} sprintId - Sprint ID
 * @returns {Array} - Tasks sorted by backlog position
 */
export function getSprintTasks(tasks, sprintId) {
  return tasks
    .filter(t => t.sprintId === sprintId)
    .sort((a, b) => (a.backlogPosition || 0) - (b.backlogPosition || 0));
}

/**
 * Calculate total story points for tasks
 * @param {Array} tasks - Tasks to sum
 * @returns {Object} - {total, estimated, unestimated}
 */
export function calculateSprintPoints(tasks) {
  let total = 0;
  let estimated = 0;
  let unestimated = 0;

  tasks.forEach(task => {
    if (task.storyPoints !== null && task.storyPoints !== undefined) {
      total += task.storyPoints;
      estimated++;
    } else {
      unestimated++;
    }
  });

  return { total, estimated, unestimated };
}

/**
 * Calculate velocity from completed sprints
 * @param {Array} tasks - All tasks
 * @param {Array} sprints - All sprints
 * @returns {Object} - {average, sprints: [{id, name, points}]}
 */
export function calculateVelocity(tasks, sprints) {
  const completedSprints = sprints.filter(s => s.status === 'completed');
  const sprintData = [];

  completedSprints.forEach(sprint => {
    // Get tasks that were completed in this sprint
    const sprintTasks = tasks.filter(t =>
      t.sprintId === sprint.id &&
      t.board?.columnId === 'done'
    );

    const points = sprintTasks.reduce((sum, t) =>
      sum + (t.storyPoints || 0), 0);

    sprintData.push({
      id: sprint.id,
      name: sprint.name,
      points
    });
  });

  const average = sprintData.length > 0
    ? Math.round(sprintData.reduce((sum, s) => sum + s.points, 0) / sprintData.length)
    : 0;

  return { average, sprints: sprintData };
}

/**
 * Sync Gantt changes to Kanban board state
 * Called when reality array changes in Gantt
 * @param {Object} task - Task that was updated
 * @param {Object} workflow - Workflow configuration
 * @returns {Object} - Updated task with synced board state
 */
export function syncGanttToKanban(task, workflow) {
  const oldColumnId = task.board.columnId;
  const newColumnId = deriveColumnFromProgress(task);

  // Only update if column actually changed
  if (oldColumnId !== newColumnId) {
    task.board.columnId = newColumnId;

    // Track completion timestamp for burndown
    if (newColumnId === 'done' && oldColumnId !== 'done') {
      task.completedAt = new Date().toISOString();
      console.log(`Synced task "${task.name}" to done, set completedAt`);
    } else if (newColumnId !== 'done' && oldColumnId === 'done') {
      task.completedAt = null;
      console.log(`Synced task "${task.name}" out of done, cleared completedAt`);
    } else {
      console.log(`Synced task "${task.name}" to column: ${newColumnId}`);
    }
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

  // Moving to Done: record completion timestamp for burndown tracking
  // Reality should reflect actual work done, which may differ from planned
  // A task can be "done" even if it took fewer weeks or different weeks than planned
  if (newColumnId === 'done' && oldColumnId !== 'done') {
    task.completedAt = new Date().toISOString();
    console.log(`Moved task "${task.name}" to Done at ${task.completedAt}`);
  }

  // Moving back from Done: clear completion timestamp
  if (newColumnId !== 'done' && oldColumnId === 'done') {
    task.completedAt = null;
    console.log(`Moved task "${task.name}" out of Done, cleared completedAt`);
  }

  // Moving to In Progress: optionally add current week if reality is empty
  if (newColumnId === 'in-progress' && oldColumnId !== 'in-progress' && oldColumnId !== 'done') {
    if ((!task.reality || task.reality.length === 0) && currentWeek) {
      task.reality = [currentWeek];
      console.log(`Started task "${task.name}" in week ${currentWeek}`);
    }
  }

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

// ========== RESOURCE CALENDAR HELPERS ==========

/**
 * Generate a unique team member ID
 * @returns {string} - Unique ID
 */
export function generateMemberId() {
  return 'member_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

/**
 * Get availability for a team member on a specific date
 * @param {Object} member - Team member object
 * @param {string} date - ISO date string (YYYY-MM-DD)
 * @param {Object} calendarSettings - Calendar settings with workDays and hoursPerDay
 * @returns {Object} - {type, hours, reason}
 */
export function getMemberAvailability(member, date, calendarSettings) {
  // Check if there's a specific entry for this date
  const entry = (member.availability || []).find(a => a.date === date);
  if (entry) {
    return {
      type: entry.type,
      hours: entry.hours,
      reason: entry.reason || ''
    };
  }

  // Check if it's a weekend/non-work day
  const dayOfWeek = new Date(date).getDay();
  const workDays = calendarSettings?.workDays || [1, 2, 3, 4, 5];
  if (!workDays.includes(dayOfWeek)) {
    return {
      type: 'weekend',
      hours: 0,
      reason: ''
    };
  }

  // Default: fully available
  const hoursPerDay = calendarSettings?.hoursPerDay || 8;
  return {
    type: 'available',
    hours: hoursPerDay,
    reason: ''
  };
}

/**
 * Set availability for a team member on a date or date range
 * @param {Object} member - Team member object
 * @param {string} startDate - Start date (YYYY-MM-DD)
 * @param {string} endDate - End date (YYYY-MM-DD), optional
 * @param {Object} availability - {type, hours, reason}
 * @returns {Object} - Updated member
 */
export function setMemberAvailability(member, startDate, endDate, availability) {
  if (!member.availability) {
    member.availability = [];
  }

  const end = endDate || startDate;
  const start = new Date(startDate);
  const finish = new Date(end);

  // Iterate through each day in range
  for (let d = new Date(start); d <= finish; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().split('T')[0];

    // Remove existing entry for this date
    member.availability = member.availability.filter(a => a.date !== dateStr);

    // Add new entry (unless it's default available)
    if (availability.type !== 'available' || availability.hours !== 8) {
      member.availability.push({
        date: dateStr,
        type: availability.type,
        hours: availability.hours,
        reason: availability.reason || ''
      });
    }
  }

  // Sort by date
  member.availability.sort((a, b) => a.date.localeCompare(b.date));

  return member;
}

/**
 * Calculate team capacity for a date range
 * @param {Array} team - Team members array
 * @param {string} startDate - Start date (YYYY-MM-DD)
 * @param {string} endDate - End date (YYYY-MM-DD)
 * @param {Object} calendarSettings - Calendar settings
 * @returns {Object} - {totalHours, perMember: {memberId: hours}}
 */
export function calculateTeamCapacity(team, startDate, endDate, calendarSettings) {
  const result = {
    totalHours: 0,
    perMember: {}
  };

  const start = new Date(startDate);
  const end = new Date(endDate);

  (team || []).forEach(member => {
    let memberHours = 0;

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      const availability = getMemberAvailability(member, dateStr, calendarSettings);
      memberHours += availability.hours;
    }

    result.perMember[member.id] = memberHours;
    result.totalHours += memberHours;
  });

  return result;
}

/**
 * Get capacity percentage for a week
 * @param {Array} team - Team members array
 * @param {Date} weekStart - Start of week
 * @param {Object} calendarSettings - Calendar settings
 * @returns {number} - Percentage (0-100)
 */
export function getWeekCapacityPercent(team, weekStart, calendarSettings) {
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);

  const startStr = weekStart.toISOString().split('T')[0];
  const endStr = weekEnd.toISOString().split('T')[0];

  const capacity = calculateTeamCapacity(team, startStr, endStr, calendarSettings);

  // Calculate max possible hours (all members fully available)
  const workDays = calendarSettings?.workDays || [1, 2, 3, 4, 5];
  const hoursPerDay = calendarSettings?.hoursPerDay || 8;

  let workDaysInWeek = 0;
  for (let d = new Date(weekStart); d <= weekEnd; d.setDate(d.getDate() + 1)) {
    if (workDays.includes(d.getDay())) {
      workDaysInWeek++;
    }
  }

  const maxHours = (team || []).length * workDaysInWeek * hoursPerDay;

  if (maxHours === 0) return 100;
  return Math.round((capacity.totalHours / maxHours) * 100);
}

/**
 * Get dates for a week starting from a given date
 * @param {Date} weekStart - Start of week (Monday)
 * @returns {Array} - Array of date objects for the week
 */
export function getWeekDates(weekStart) {
  const dates = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    dates.push(d);
  }
  return dates;
}

/**
 * Format date as short string (e.g., "Mon 5")
 * @param {Date} date - Date object
 * @returns {string} - Formatted string
 */
export function formatDateShort(date) {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return `${days[date.getDay()]} ${date.getDate()}`;
}

/**
 * Format date range as string
 * @param {Date} start - Start date
 * @param {Date} end - End date
 * @returns {string} - Formatted string like "Feb 3 - 9, 2025"
 */
export function formatDateRange(start, end) {
  const opts = { month: 'short', day: 'numeric' };
  const startStr = start.toLocaleDateString('en-US', opts);
  const endStr = end.toLocaleDateString('en-US', { day: 'numeric' });
  const year = end.getFullYear();
  return `${startStr} - ${endStr}, ${year}`;
}

// ========== MILESTONE HELPERS ==========

/**
 * Get all milestones from tasks
 * @param {Array} tasks - All tasks
 * @returns {Array} - Tasks with isMilestone=true, sorted by deadline
 */
export function getMilestones(tasks) {
  return (tasks || [])
    .filter(t => t.isMilestone === true)
    .sort((a, b) => {
      const deadlineA = a.milestoneDeadline || '9999-12-31';
      const deadlineB = b.milestoneDeadline || '9999-12-31';
      return deadlineA.localeCompare(deadlineB);
    });
}

/**
 * Calculate milestone progress from dependency completion
 * @param {Object} milestone - Milestone task
 * @param {Array} tasks - All tasks
 * @returns {Object} - {percent, completed, total}
 */
export function calculateMilestoneProgress(milestone, tasks) {
  // If progress override is set, use it
  if (milestone.milestoneProgressOverride !== null && milestone.milestoneProgressOverride !== undefined) {
    const deps = getMilestoneDependencies(milestone, tasks);
    const completed = deps.filter(t => t.board?.columnId === 'done').length;
    return {
      percent: milestone.milestoneProgressOverride,
      completed,
      total: deps.length
    };
  }

  const deps = getMilestoneDependencies(milestone, tasks);

  if (deps.length === 0) {
    return { percent: 0, completed: 0, total: 0 };
  }

  const completed = deps.filter(t => t.board?.columnId === 'done').length;
  const percent = Math.round((completed / deps.length) * 100);

  return { percent, completed, total: deps.length };
}

/**
 * Calculate milestone status based on deadline and progress
 * @param {Object} milestone - Milestone task
 * @param {Array} tasks - All tasks
 * @param {Object} project - Project data
 * @returns {string} - Status: 'complete', 'on-track', 'at-risk', 'delayed', 'not-started'
 */
export function calculateMilestoneStatus(milestone, tasks, project) {
  // If status override is set, use it
  if (milestone.milestoneStatusOverride) {
    return milestone.milestoneStatusOverride;
  }

  const progress = calculateMilestoneProgress(milestone, tasks);
  const deps = getMilestoneDependencies(milestone, tasks);

  // All dependencies done = complete
  if (deps.length > 0 && progress.completed === deps.length) {
    return 'complete';
  }

  // No dependencies completed yet = not started
  if (progress.completed === 0 && deps.length > 0) {
    return 'not-started';
  }

  // No dependencies at all = not started
  if (deps.length === 0) {
    return 'not-started';
  }

  // Check deadline proximity
  if (!milestone.milestoneDeadline) {
    // No deadline set, base on progress only
    if (progress.percent >= 50) return 'on-track';
    return 'at-risk';
  }

  const deadline = new Date(milestone.milestoneDeadline);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const daysUntil = Math.ceil((deadline - today) / (1000 * 60 * 60 * 24));

  // Calculate expected progress based on time elapsed
  let expectedProgress = 100;
  if (project && project.startDate) {
    const projectStart = new Date(project.startDate);
    const totalDays = Math.ceil((deadline - projectStart) / (1000 * 60 * 60 * 24));
    const elapsedDays = Math.ceil((today - projectStart) / (1000 * 60 * 60 * 24));

    if (totalDays > 0) {
      expectedProgress = Math.min(100, Math.round((elapsedDays / totalDays) * 100));
    }
  }

  // Deadline passed
  if (daysUntil < 0) {
    return 'delayed';
  }

  // Very behind (progress < expected by >25%)
  if (progress.percent < expectedProgress - 25) {
    return 'delayed';
  }

  // Somewhat behind (progress < expected by >10%) OR deadline within 3-7 days
  if (progress.percent < expectedProgress - 10 || (daysUntil <= 7 && daysUntil > 0)) {
    return 'at-risk';
  }

  return 'on-track';
}

/**
 * Get dependency task objects for a milestone
 * @param {Object} milestone - Milestone task
 * @param {Array} tasks - All tasks
 * @returns {Array} - Array of task objects
 */
export function getMilestoneDependencies(milestone, tasks) {
  const depIds = milestone.milestoneDependencies || [];
  return depIds
    .map(id => tasks.find(t => t.id === id))
    .filter(t => t !== undefined);
}
