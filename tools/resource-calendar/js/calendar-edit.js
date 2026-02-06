/**
 * Calendar Edit Module - Data manipulation functions
 */

import {
  generateMemberId,
  setMemberAvailability
} from '../../../shared/js/unified-data.js';

/**
 * Add a new team member
 * @param {Object} projectData - Project data
 * @param {Object} memberData - {name, role, color, hoursPerWeek}
 * @returns {Object} - The new member
 */
export function addMember(projectData, memberData) {
  if (!projectData.team) {
    projectData.team = [];
  }

  const newMember = {
    id: generateMemberId(),
    name: memberData.name,
    role: memberData.role || '',
    color: memberData.color || '#a78bfa',
    hoursPerWeek: memberData.hoursPerWeek || 40,
    availability: []
  };

  projectData.team.push(newMember);

  return newMember;
}

/**
 * Update an existing team member
 * @param {Object} projectData - Project data
 * @param {string} memberId - Member ID
 * @param {Object} updates - Fields to update
 * @returns {Object|null} - Updated member or null
 */
export function updateMember(projectData, memberId, updates) {
  const member = projectData.team?.find(m => m.id === memberId);
  if (!member) return null;

  if (updates.name !== undefined) member.name = updates.name;
  if (updates.role !== undefined) member.role = updates.role;
  if (updates.color !== undefined) member.color = updates.color;
  if (updates.hoursPerWeek !== undefined) member.hoursPerWeek = updates.hoursPerWeek;

  return member;
}

/**
 * Delete a team member
 * @param {Object} projectData - Project data
 * @param {string} memberId - Member ID
 * @returns {boolean} - Success
 */
export function deleteMember(projectData, memberId) {
  if (!projectData.team) return false;

  const index = projectData.team.findIndex(m => m.id === memberId);
  if (index === -1) return false;

  projectData.team.splice(index, 1);

  // Also remove member from any task assignees (if using object format)
  // Note: tasks use string assignees in some places, this handles object format
  if (projectData.tasks) {
    projectData.tasks.forEach(task => {
      if (task.assigneeId === memberId) {
        task.assigneeId = null;
        task.assignee = '';
      }
    });
  }

  return true;
}

/**
 * Set availability for a team member
 * @param {Object} projectData - Project data
 * @param {string} memberId - Member ID
 * @param {string} startDate - Start date (YYYY-MM-DD)
 * @param {string} endDate - End date (YYYY-MM-DD)
 * @param {Object} availability - {type, hours, reason}
 * @returns {Object|null} - Updated member or null
 */
export function setAvailability(projectData, memberId, startDate, endDate, availability) {
  const member = projectData.team?.find(m => m.id === memberId);
  if (!member) return null;

  return setMemberAvailability(member, startDate, endDate, availability);
}

/**
 * Clear availability for a team member on a date range
 * @param {Object} projectData - Project data
 * @param {string} memberId - Member ID
 * @param {string} startDate - Start date (YYYY-MM-DD)
 * @param {string} endDate - End date (YYYY-MM-DD)
 * @returns {Object|null} - Updated member or null
 */
export function clearAvailability(projectData, memberId, startDate, endDate) {
  const member = projectData.team?.find(m => m.id === memberId);
  if (!member) return null;

  if (!member.availability) return member;

  const start = new Date(startDate);
  const end = new Date(endDate || startDate);

  // Remove entries in the date range
  member.availability = member.availability.filter(a => {
    const aDate = new Date(a.date);
    return aDate < start || aDate > end;
  });

  return member;
}

/**
 * Copy availability from one member to another
 * @param {Object} projectData - Project data
 * @param {string} sourceMemberId - Source member ID
 * @param {string} targetMemberId - Target member ID
 * @param {string} startDate - Start date (YYYY-MM-DD)
 * @param {string} endDate - End date (YYYY-MM-DD)
 * @returns {Object|null} - Updated target member or null
 */
export function copyAvailability(projectData, sourceMemberId, targetMemberId, startDate, endDate) {
  const source = projectData.team?.find(m => m.id === sourceMemberId);
  const target = projectData.team?.find(m => m.id === targetMemberId);

  if (!source || !target) return null;

  const start = new Date(startDate);
  const end = new Date(endDate || startDate);

  // Get entries from source in date range
  const sourceEntries = (source.availability || []).filter(a => {
    const aDate = new Date(a.date);
    return aDate >= start && aDate <= end;
  });

  // Apply to target
  sourceEntries.forEach(entry => {
    setMemberAvailability(target, entry.date, entry.date, {
      type: entry.type,
      hours: entry.hours,
      reason: entry.reason
    });
  });

  return target;
}

/**
 * Set a holiday for all team members
 * @param {Object} projectData - Project data
 * @param {string} date - Date (YYYY-MM-DD)
 * @param {string} reason - Holiday name/reason
 * @returns {number} - Number of members updated
 */
export function setTeamHoliday(projectData, date, reason) {
  if (!projectData.team) return 0;

  let count = 0;
  projectData.team.forEach(member => {
    setMemberAvailability(member, date, date, {
      type: 'holiday',
      hours: 0,
      reason: reason
    });
    count++;
  });

  return count;
}

/**
 * Get all dates with special availability in a range
 * @param {Object} projectData - Project data
 * @param {string} startDate - Start date (YYYY-MM-DD)
 * @param {string} endDate - End date (YYYY-MM-DD)
 * @returns {Array} - Array of {date, members: [{member, availability}]}
 */
export function getSpecialDates(projectData, startDate, endDate) {
  const dateMap = new Map();
  const start = new Date(startDate);
  const end = new Date(endDate);

  (projectData.team || []).forEach(member => {
    (member.availability || []).forEach(entry => {
      const entryDate = new Date(entry.date);
      if (entryDate >= start && entryDate <= end) {
        if (!dateMap.has(entry.date)) {
          dateMap.set(entry.date, []);
        }
        dateMap.get(entry.date).push({
          member,
          availability: entry
        });
      }
    });
  });

  // Convert to sorted array
  return Array.from(dateMap.entries())
    .map(([date, members]) => ({ date, members }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
