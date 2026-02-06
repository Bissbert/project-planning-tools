/**
 * Milestone Edit Module - CRUD operations, event handlers
 */

import { generateTaskId } from '../../../shared/js/unified-data.js';

/**
 * Create a new milestone task
 * @param {Object} projectData - Project data
 * @param {Object} milestoneData - Milestone data
 * @returns {Object} - The created milestone task
 */
export function createMilestone(projectData, milestoneData) {
  const newTask = {
    id: generateTaskId(),
    name: milestoneData.name || 'New Milestone',
    category: Object.keys(projectData.categories)[0] || 'General',
    assignee: '',
    priority: '',
    notes: '',
    planned: [],
    reality: [],
    isMilestone: true,
    board: {
      columnId: 'backlog',
      position: 0
    },
    storyPoints: null,
    sprintId: null,
    backlogPosition: projectData.tasks.length,
    // Milestone-specific fields
    milestoneDeadline: milestoneData.milestoneDeadline || null,
    milestoneDependencies: milestoneData.milestoneDependencies || [],
    milestoneProgressOverride: null,
    milestoneStatusOverride: null,
    milestoneNotes: milestoneData.milestoneNotes || ''
  };

  projectData.tasks.push(newTask);
  return newTask;
}

/**
 * Update an existing milestone
 * @param {Object} projectData - Project data
 * @param {string} milestoneId - Milestone ID
 * @param {Object} updates - Updates to apply
 * @returns {Object|null} - Updated milestone or null
 */
export function updateMilestone(projectData, milestoneId, updates) {
  const milestone = projectData.tasks.find(t => t.id === milestoneId && t.isMilestone);
  if (!milestone) return null;

  // Apply updates
  if (updates.name !== undefined) milestone.name = updates.name;
  if (updates.milestoneDeadline !== undefined) milestone.milestoneDeadline = updates.milestoneDeadline;
  if (updates.milestoneDependencies !== undefined) milestone.milestoneDependencies = updates.milestoneDependencies;
  if (updates.milestoneProgressOverride !== undefined) milestone.milestoneProgressOverride = updates.milestoneProgressOverride;
  if (updates.milestoneStatusOverride !== undefined) milestone.milestoneStatusOverride = updates.milestoneStatusOverride;
  if (updates.milestoneNotes !== undefined) milestone.milestoneNotes = updates.milestoneNotes;

  return milestone;
}

/**
 * Delete a milestone (removes the milestone flag, task remains)
 * @param {Object} projectData - Project data
 * @param {string} milestoneId - Milestone ID
 * @returns {boolean} - Success
 */
export function deleteMilestone(projectData, milestoneId) {
  const milestone = projectData.tasks.find(t => t.id === milestoneId);
  if (!milestone) return false;

  // Remove milestone flag and related fields
  milestone.isMilestone = false;
  delete milestone.milestoneDeadline;
  delete milestone.milestoneDependencies;
  delete milestone.milestoneProgressOverride;
  delete milestone.milestoneStatusOverride;
  delete milestone.milestoneNotes;

  return true;
}

/**
 * Convert an existing task to a milestone
 * @param {Object} projectData - Project data
 * @param {string} taskId - Task ID
 * @returns {Object|null} - Updated task or null
 */
export function convertTaskToMilestone(projectData, taskId) {
  const task = projectData.tasks.find(t => t.id === taskId);
  if (!task) return null;

  // Add milestone flag and fields
  task.isMilestone = true;
  if (!task.milestoneDeadline) task.milestoneDeadline = null;
  if (!task.milestoneDependencies) task.milestoneDependencies = [];
  if (task.milestoneProgressOverride === undefined) task.milestoneProgressOverride = null;
  if (task.milestoneStatusOverride === undefined) task.milestoneStatusOverride = null;
  if (!task.milestoneNotes) task.milestoneNotes = '';

  return task;
}

/**
 * Add a dependency to a milestone
 * @param {Object} projectData - Project data
 * @param {string} milestoneId - Milestone ID
 * @param {string} taskId - Task ID to add as dependency
 * @returns {boolean} - Success
 */
export function addDependencyToMilestone(projectData, milestoneId, taskId) {
  const milestone = projectData.tasks.find(t => t.id === milestoneId && t.isMilestone);
  if (!milestone) return false;

  if (!milestone.milestoneDependencies) {
    milestone.milestoneDependencies = [];
  }

  if (!milestone.milestoneDependencies.includes(taskId)) {
    milestone.milestoneDependencies.push(taskId);
  }

  return true;
}

/**
 * Remove a dependency from a milestone
 * @param {Object} projectData - Project data
 * @param {string} milestoneId - Milestone ID
 * @param {string} taskId - Task ID to remove
 * @returns {boolean} - Success
 */
export function removeDependencyFromMilestone(projectData, milestoneId, taskId) {
  const milestone = projectData.tasks.find(t => t.id === milestoneId && t.isMilestone);
  if (!milestone || !milestone.milestoneDependencies) return false;

  const index = milestone.milestoneDependencies.indexOf(taskId);
  if (index >= 0) {
    milestone.milestoneDependencies.splice(index, 1);
    return true;
  }

  return false;
}

/**
 * Set milestone deadline
 * @param {Object} projectData - Project data
 * @param {string} milestoneId - Milestone ID
 * @param {string|null} deadline - ISO date string or null
 * @returns {boolean} - Success
 */
export function setMilestoneDeadline(projectData, milestoneId, deadline) {
  const milestone = projectData.tasks.find(t => t.id === milestoneId && t.isMilestone);
  if (!milestone) return false;

  milestone.milestoneDeadline = deadline;
  return true;
}

/**
 * Set milestone progress override
 * @param {Object} projectData - Project data
 * @param {string} milestoneId - Milestone ID
 * @param {number|null} progress - Progress percentage (0-100) or null for auto
 * @returns {boolean} - Success
 */
export function setMilestoneProgressOverride(projectData, milestoneId, progress) {
  const milestone = projectData.tasks.find(t => t.id === milestoneId && t.isMilestone);
  if (!milestone) return false;

  milestone.milestoneProgressOverride = progress;
  return true;
}

/**
 * Set milestone status override
 * @param {Object} projectData - Project data
 * @param {string} milestoneId - Milestone ID
 * @param {string|null} status - Status string or null for auto
 * @returns {boolean} - Success
 */
export function setMilestoneStatusOverride(projectData, milestoneId, status) {
  const milestone = projectData.tasks.find(t => t.id === milestoneId && t.isMilestone);
  if (!milestone) return false;

  milestone.milestoneStatusOverride = status;
  return true;
}

/**
 * Bulk update milestone dependencies
 * @param {Object} projectData - Project data
 * @param {string} milestoneId - Milestone ID
 * @param {Array} taskIds - Array of task IDs
 * @returns {boolean} - Success
 */
export function setMilestoneDependencies(projectData, milestoneId, taskIds) {
  const milestone = projectData.tasks.find(t => t.id === milestoneId && t.isMilestone);
  if (!milestone) return false;

  milestone.milestoneDependencies = [...taskIds];
  return true;
}
