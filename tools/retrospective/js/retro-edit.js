/**
 * Retrospective Edit Module - CRUD operations for retrospectives and items
 */

import { generateRetroId, generateItemId } from '../../../shared/js/unified-data.js';

/**
 * Create a new retrospective
 * @param {Object} projectData - Project data
 * @param {Object} retroData - Retrospective data
 * @returns {Object} - The created retrospective
 */
export function createRetrospective(projectData, retroData) {
  if (!projectData.retrospectives) {
    projectData.retrospectives = [];
  }

  const newRetro = {
    id: generateRetroId(),
    name: retroData.name || 'New Retrospective',
    sprintId: retroData.sprintId || null,
    isAnonymous: retroData.isAnonymous !== false, // Default to true
    createdAt: new Date().toISOString(),
    items: []
  };

  projectData.retrospectives.push(newRetro);
  return newRetro;
}

/**
 * Update an existing retrospective
 * @param {Object} projectData - Project data
 * @param {string} retroId - Retrospective ID
 * @param {Object} updates - Updates to apply
 * @returns {Object|null} - Updated retrospective or null
 */
export function updateRetrospective(projectData, retroId, updates) {
  const retro = projectData.retrospectives?.find(r => r.id === retroId);
  if (!retro) return null;

  if (updates.name !== undefined) retro.name = updates.name;
  if (updates.sprintId !== undefined) retro.sprintId = updates.sprintId;
  if (updates.isAnonymous !== undefined) retro.isAnonymous = updates.isAnonymous;

  return retro;
}

/**
 * Delete a retrospective
 * @param {Object} projectData - Project data
 * @param {string} retroId - Retrospective ID
 * @returns {boolean} - Success
 */
export function deleteRetrospective(projectData, retroId) {
  if (!projectData.retrospectives) return false;

  const index = projectData.retrospectives.findIndex(r => r.id === retroId);
  if (index < 0) return false;

  projectData.retrospectives.splice(index, 1);
  return true;
}

/**
 * Add an item to a retrospective
 * @param {Object} projectData - Project data
 * @param {string} retroId - Retrospective ID
 * @param {Object} itemData - Item data
 * @returns {Object|null} - The created item or null
 */
export function addItem(projectData, retroId, itemData) {
  const retro = projectData.retrospectives?.find(r => r.id === retroId);
  if (!retro) return null;

  // Calculate position (at end of column)
  const columnItems = retro.items.filter(i => i.column === itemData.column && !i.groupId);
  const position = columnItems.length;

  const newItem = {
    id: generateItemId(),
    column: itemData.column || 'went-well',
    text: itemData.text || '',
    author: itemData.author || null,
    votes: 0,
    groupId: null,
    position: position,
    createdAt: new Date().toISOString()
  };

  retro.items.push(newItem);
  return newItem;
}

/**
 * Update an item in a retrospective
 * @param {Object} projectData - Project data
 * @param {string} retroId - Retrospective ID
 * @param {string} itemId - Item ID
 * @param {Object} updates - Updates to apply
 * @returns {Object|null} - Updated item or null
 */
export function updateItem(projectData, retroId, itemId, updates) {
  const retro = projectData.retrospectives?.find(r => r.id === retroId);
  if (!retro) return null;

  const item = retro.items.find(i => i.id === itemId);
  if (!item) return null;

  if (updates.text !== undefined) item.text = updates.text;
  if (updates.author !== undefined) item.author = updates.author;
  if (updates.column !== undefined) {
    // Moving to new column, update position
    if (item.column !== updates.column) {
      const newColumnItems = retro.items.filter(i => i.column === updates.column && !i.groupId);
      item.position = newColumnItems.length;
    }
    item.column = updates.column;
  }
  if (updates.position !== undefined) item.position = updates.position;
  if (updates.groupId !== undefined) item.groupId = updates.groupId;

  return item;
}

/**
 * Delete an item from a retrospective
 * @param {Object} projectData - Project data
 * @param {string} retroId - Retrospective ID
 * @param {string} itemId - Item ID
 * @returns {boolean} - Success
 */
export function deleteItem(projectData, retroId, itemId) {
  const retro = projectData.retrospectives?.find(r => r.id === retroId);
  if (!retro) return false;

  const index = retro.items.findIndex(i => i.id === itemId);
  if (index < 0) return false;

  // Also ungroup any children
  const itemToDelete = retro.items[index];
  retro.items.forEach(item => {
    if (item.groupId === itemToDelete.id) {
      item.groupId = null;
    }
  });

  retro.items.splice(index, 1);

  // Reposition remaining items in column
  repositionColumn(retro, itemToDelete.column);

  return true;
}

/**
 * Vote for an item (increment vote count)
 * @param {Object} projectData - Project data
 * @param {string} retroId - Retrospective ID
 * @param {string} itemId - Item ID
 * @returns {Object|null} - Updated item or null
 */
export function voteItem(projectData, retroId, itemId) {
  const retro = projectData.retrospectives?.find(r => r.id === retroId);
  if (!retro) return null;

  const item = retro.items.find(i => i.id === itemId);
  if (!item) return null;

  item.votes = (item.votes || 0) + 1;
  return item;
}

/**
 * Group items together (drag-to-group)
 * The source item becomes a child of the target item
 * @param {Object} projectData - Project data
 * @param {string} retroId - Retrospective ID
 * @param {string} targetId - Target item ID (becomes parent)
 * @param {string} sourceId - Source item ID (becomes child)
 * @returns {boolean} - Success
 */
export function groupItems(projectData, retroId, targetId, sourceId) {
  const retro = projectData.retrospectives?.find(r => r.id === retroId);
  if (!retro) return false;

  const target = retro.items.find(i => i.id === targetId);
  const source = retro.items.find(i => i.id === sourceId);

  if (!target || !source) return false;

  // Cannot group if:
  // - Same item
  // - Source is already a parent (has children)
  // - Target is a child
  if (targetId === sourceId) return false;
  if (target.groupId) return false;

  const hasChildren = retro.items.some(i => i.groupId === sourceId);
  if (hasChildren) return false;

  // Move source to target's column and group
  source.column = target.column;
  source.groupId = targetId;
  source.position = 0;

  // Reposition original column
  repositionColumn(retro, source.column);

  return true;
}

/**
 * Ungroup an item (remove from group)
 * @param {Object} projectData - Project data
 * @param {string} retroId - Retrospective ID
 * @param {string} itemId - Item ID to ungroup
 * @returns {boolean} - Success
 */
export function ungroupItem(projectData, retroId, itemId) {
  const retro = projectData.retrospectives?.find(r => r.id === retroId);
  if (!retro) return false;

  const item = retro.items.find(i => i.id === itemId);
  if (!item || !item.groupId) return false;

  item.groupId = null;

  // Reposition in column
  const columnItems = retro.items.filter(i => i.column === item.column && !i.groupId);
  item.position = columnItems.length - 1;

  return true;
}

/**
 * Move an item to a new column and position
 * @param {Object} projectData - Project data
 * @param {string} retroId - Retrospective ID
 * @param {string} itemId - Item ID
 * @param {string} newColumn - Target column
 * @param {number} newPosition - Position in target column
 * @returns {boolean} - Success
 */
export function moveItem(projectData, retroId, itemId, newColumn, newPosition) {
  const retro = projectData.retrospectives?.find(r => r.id === retroId);
  if (!retro) return false;

  const item = retro.items.find(i => i.id === itemId);
  if (!item) return false;

  const oldColumn = item.column;

  // If item has a group, ungroup it first
  if (item.groupId) {
    item.groupId = null;
  }

  // Move any children along
  const children = retro.items.filter(i => i.groupId === itemId);
  children.forEach(child => {
    child.column = newColumn;
  });

  item.column = newColumn;
  item.position = newPosition;

  // Reposition both columns
  if (oldColumn !== newColumn) {
    repositionColumn(retro, oldColumn);
  }
  repositionColumn(retro, newColumn);

  return true;
}

/**
 * Get items for a column, sorted by position
 * Handles both array format [{column: 'went-well', ...}] and
 * legacy object format {'went-well': [...], ...}
 * @param {Object} retro - Retrospective object
 * @param {string} column - Column ID
 * @returns {Array} - Sorted items
 */
export function getColumnItems(retro, column) {
  if (!retro || !retro.items) return [];

  // Handle array format (current)
  if (Array.isArray(retro.items)) {
    return retro.items
      .filter(i => i.column === column && !i.groupId)
      .sort((a, b) => (a.position || 0) - (b.position || 0));
  }

  // Handle legacy object format
  if (typeof retro.items === 'object' && retro.items[column]) {
    const items = retro.items[column];
    if (Array.isArray(items)) {
      return items
        .filter(i => !i.groupId)
        .sort((a, b) => (a.position || 0) - (b.position || 0));
    }
  }

  return [];
}

/**
 * Get child items of a parent
 * @param {Object} retro - Retrospective object
 * @param {string} parentId - Parent item ID
 * @returns {Array} - Child items
 */
export function getChildItems(retro, parentId) {
  if (!retro || !retro.items) return [];

  return retro.items
    .filter(i => i.groupId === parentId)
    .sort((a, b) => (a.position || 0) - (b.position || 0));
}

/**
 * Get total votes for an item including children
 * @param {Object} retro - Retrospective object
 * @param {string} itemId - Item ID
 * @returns {number} - Total votes
 */
export function getTotalVotes(retro, itemId) {
  if (!retro || !retro.items) return 0;

  const item = retro.items.find(i => i.id === itemId);
  if (!item) return 0;

  let total = item.votes || 0;

  const children = retro.items.filter(i => i.groupId === itemId);
  children.forEach(child => {
    total += child.votes || 0;
  });

  return total;
}

/**
 * Reposition items in a column (normalize positions)
 * @param {Object} retro - Retrospective object
 * @param {string} column - Column ID
 */
function repositionColumn(retro, column) {
  const items = retro.items
    .filter(i => i.column === column && !i.groupId)
    .sort((a, b) => (a.position || 0) - (b.position || 0));

  items.forEach((item, index) => {
    item.position = index;
  });
}

/**
 * Get action items from a retrospective
 * @param {Object} retro - Retrospective object
 * @returns {Array} - Action items sorted by votes
 */
export function getActionItems(retro) {
  if (!retro || !retro.items) return [];

  return retro.items
    .filter(i => i.column === 'action-items')
    .sort((a, b) => (b.votes || 0) - (a.votes || 0));
}

/**
 * Export action items as text
 * @param {Object} retro - Retrospective object
 * @returns {string} - Formatted text
 */
export function exportActionItemsText(retro) {
  if (!retro) return '';

  const items = getActionItems(retro);
  if (items.length === 0) return 'No action items';

  let text = `ACTION ITEMS - ${retro.name}\n`;
  text += `${'='.repeat(40)}\n\n`;

  items.forEach((item, index) => {
    text += `${index + 1}. ${item.text}\n`;
    if (item.votes > 0) {
      text += `   Votes: ${item.votes}\n`;
    }
    text += '\n';
  });

  text += `\nGenerated: ${new Date().toLocaleString()}`;

  return text;
}
