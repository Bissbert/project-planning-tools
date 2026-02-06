/**
 * Retrospective Render Module - DOM rendering for the board
 */

import { getColumnItems, getChildItems, getTotalVotes } from './retro-edit.js';

// SVG icons
const VOTE_ICON = `<svg class="retro-vote__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
  <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/>
</svg>`;

const EDIT_ICON = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
</svg>`;

const DELETE_ICON = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
  <polyline points="3 6 5 6 21 6"/>
  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
</svg>`;

const CHEVRON_DOWN = `<svg class="retro-group__expand" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
  <polyline points="6 9 12 15 18 9"/>
</svg>`;

const MESSAGE_ICON = `<svg class="retro-column-empty__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
</svg>`;

/**
 * Main render function for the Retrospective Board
 * @param {Object} projectData - Full project data
 * @param {boolean} editMode - Whether edit mode is active
 * @param {string|null} activeRetroId - Currently selected retrospective ID
 * @param {string} searchQuery - Search filter string
 * @param {Object} handlers - Event handlers
 */
export function render(projectData, editMode, activeRetroId, searchQuery, handlers) {
  // Update header stats
  updateHeaderStats(projectData);

  // Update title
  document.getElementById('projectTitle').textContent = projectData.project.title;

  // Get retrospectives
  const retrospectives = projectData.retrospectives || [];

  // Render retro selector
  renderRetroSelector(retrospectives, activeRetroId, projectData.sprints);

  // Show/hide empty state vs board
  const retroEmpty = document.getElementById('retroEmpty');
  const retroBoard = document.getElementById('retroBoard');

  if (retrospectives.length === 0 || !activeRetroId) {
    retroEmpty.style.display = '';
    retroBoard.style.display = 'none';
    return;
  }

  const activeRetro = retrospectives.find(r => r.id === activeRetroId);
  if (!activeRetro) {
    retroEmpty.style.display = '';
    retroBoard.style.display = 'none';
    return;
  }

  retroEmpty.style.display = 'none';
  retroBoard.style.display = '';

  // Update anonymous indicator
  const anonymousIndicator = document.getElementById('anonymousIndicator');
  anonymousIndicator.style.display = activeRetro.isAnonymous ? '' : 'none';

  // Render columns
  renderColumn('went-well', activeRetro, searchQuery, editMode, handlers);
  renderColumn('went-poorly', activeRetro, searchQuery, editMode, handlers);
  renderColumn('action-items', activeRetro, searchQuery, editMode, handlers);
}

/**
 * Update header statistics
 * @param {Object} projectData - Project data
 */
function updateHeaderStats(projectData) {
  const retrospectives = projectData.retrospectives || [];
  const totalItems = retrospectives.reduce((sum, r) => sum + (r.items?.length || 0), 0);

  document.getElementById('retroCount').textContent = retrospectives.length;
  document.getElementById('itemCount').textContent = totalItems;
}

/**
 * Render the retrospective selector dropdown
 * @param {Array} retrospectives - All retrospectives
 * @param {string|null} activeRetroId - Currently active retro ID
 * @param {Array} sprints - All sprints for labeling
 */
function renderRetroSelector(retrospectives, activeRetroId, sprints) {
  const selector = document.getElementById('retroSelector');

  if (retrospectives.length === 0) {
    selector.innerHTML = '<option value="">No retrospectives</option>';
    selector.disabled = true;
    return;
  }

  selector.disabled = false;

  // Sort by creation date, newest first
  const sorted = [...retrospectives].sort((a, b) =>
    new Date(b.createdAt) - new Date(a.createdAt)
  );

  selector.innerHTML = sorted.map(retro => {
    const sprintLabel = retro.sprintId
      ? ` (${getSprintName(retro.sprintId, sprints)})`
      : '';
    const selected = retro.id === activeRetroId ? ' selected' : '';
    return `<option value="${retro.id}"${selected}>${escapeHtml(retro.name)}${sprintLabel}</option>`;
  }).join('');
}

/**
 * Get sprint name by ID
 * @param {string} sprintId - Sprint ID
 * @param {Array} sprints - All sprints
 * @returns {string} - Sprint name
 */
function getSprintName(sprintId, sprints) {
  const sprint = (sprints || []).find(s => s.id === sprintId);
  return sprint ? sprint.name : 'Unknown Sprint';
}

/**
 * Render a single column
 * @param {string} columnId - Column ID
 * @param {Object} retro - Retrospective object
 * @param {string} searchQuery - Search filter
 * @param {boolean} editMode - Edit mode state
 * @param {Object} handlers - Event handlers
 */
function renderColumn(columnId, retro, searchQuery, editMode, handlers) {
  // Map column ID to container ID
  const containerMap = {
    'went-well': 'wentWellItems',
    'went-poorly': 'wentPoorlyItems',
    'action-items': 'actionItemsItems'
  };
  const actualContainer = document.getElementById(containerMap[columnId]);
  if (!actualContainer) return;

  // Get top-level items for this column
  let items = getColumnItems(retro, columnId);

  // Apply search filter
  if (searchQuery) {
    const query = searchQuery.toLowerCase();
    items = items.filter(item => {
      // Check item text
      if (item.text.toLowerCase().includes(query)) return true;
      // Check author
      if (item.author && item.author.toLowerCase().includes(query)) return true;
      // Check children
      const children = getChildItems(retro, item.id);
      return children.some(child =>
        child.text.toLowerCase().includes(query) ||
        (child.author && child.author.toLowerCase().includes(query))
      );
    });
  }

  // Update count
  const countId = columnId.replace(/-([a-z])/g, (g) => g[1].toUpperCase()) + 'Count';
  const countEl = document.getElementById(countId);
  if (countEl) {
    countEl.textContent = items.length;
  }

  // Render items
  if (items.length === 0) {
    actualContainer.innerHTML = renderEmptyColumn(columnId);
  } else {
    actualContainer.innerHTML = items.map(item => {
      const children = getChildItems(retro, item.id);
      if (children.length > 0) {
        return renderGroup(item, children, retro, editMode, handlers);
      }
      return renderItem(item, false, retro, editMode, handlers);
    }).join('');

    // Bind event listeners for items
    bindItemEvents(actualContainer, retro, editMode, handlers);
  }

  // Setup column drop zone for moving items between columns (always, even when empty)
  if (editMode) {
    setupColumnDropZone(actualContainer, columnId, handlers);
  }
}

/**
 * Render an empty column message
 * @param {string} columnId - Column ID
 * @returns {string} - HTML
 */
function renderEmptyColumn(columnId) {
  const messages = {
    'went-well': 'What went well this sprint?',
    'went-poorly': 'What could be improved?',
    'action-items': 'What actions should we take?'
  };

  return `
    <div class="retro-column-empty">
      ${MESSAGE_ICON}
      <p class="retro-column-empty__text">${messages[columnId]}</p>
    </div>
  `;
}

/**
 * Render a single item card
 * @param {Object} item - Item object
 * @param {boolean} isChild - Whether this is a child in a group
 * @param {Object} retro - Retrospective object
 * @param {boolean} editMode - Edit mode state
 * @param {Object} handlers - Event handlers
 * @returns {string} - HTML
 */
function renderItem(item, isChild, retro, editMode, handlers) {
  if (isChild) {
    return `
      <div class="retro-child" data-item-id="${item.id}">
        <div class="retro-child__text">${escapeHtml(item.text)}</div>
        <div class="retro-child__footer">
          ${!retro.isAnonymous && item.author ? `<span class="retro-child__author">${escapeHtml(item.author)}</span>` : '<span></span>'}
          <button class="retro-vote${item.votes > 0 ? ' retro-vote--voted' : ''}" data-item-id="${item.id}" data-action="vote">
            ${VOTE_ICON}
            <span class="retro-vote__count">${item.votes || 0}</span>
          </button>
        </div>
      </div>
    `;
  }

  return `
    <div class="retro-item" data-item-id="${item.id}" draggable="${editMode}">
      <div class="retro-item__content">
        <div class="retro-item__text">${escapeHtml(item.text)}</div>
        ${!retro.isAnonymous && item.author ? `<div class="retro-item__author">${escapeHtml(item.author)}</div>` : ''}
      </div>
      <div class="retro-item__footer">
        <button class="retro-vote${item.votes > 0 ? ' retro-vote--voted' : ''}" data-item-id="${item.id}" data-action="vote">
          ${VOTE_ICON}
          <span class="retro-vote__count">${item.votes || 0}</span>
        </button>
        <div class="retro-item__actions">
          <button class="retro-action-btn edit-only" data-item-id="${item.id}" data-action="edit" title="Edit">
            ${EDIT_ICON}
          </button>
          <button class="retro-action-btn retro-action-btn--delete edit-only" data-item-id="${item.id}" data-action="delete" title="Delete">
            ${DELETE_ICON}
          </button>
        </div>
      </div>
    </div>
  `;
}

/**
 * Render a grouped set of items
 * @param {Object} parent - Parent item
 * @param {Array} children - Child items
 * @param {Object} retro - Retrospective object
 * @param {boolean} editMode - Edit mode state
 * @param {Object} handlers - Event handlers
 * @returns {string} - HTML
 */
function renderGroup(parent, children, retro, editMode, handlers) {
  const totalVotes = getTotalVotes(retro, parent.id);
  const childCount = children.length + 1; // +1 for parent

  return `
    <div class="retro-group retro-group--expanded" data-item-id="${parent.id}" draggable="${editMode}">
      <div class="retro-group__header" data-action="toggle-group">
        <div class="retro-group__title">
          <span class="retro-group__title-text">${escapeHtml(parent.text)}</span>
          <span class="retro-group__count">${childCount}</span>
          ${CHEVRON_DOWN}
        </div>
        ${!retro.isAnonymous && parent.author ? `<div class="retro-item__author">${escapeHtml(parent.author)}</div>` : ''}
        <div class="retro-group__footer">
          <div class="retro-group__votes">
            ${VOTE_ICON}
            <span>${totalVotes} votes</span>
          </div>
          <div class="retro-item__actions">
            <button class="retro-action-btn edit-only" data-item-id="${parent.id}" data-action="edit" title="Edit">
              ${EDIT_ICON}
            </button>
            <button class="retro-action-btn retro-action-btn--delete edit-only" data-item-id="${parent.id}" data-action="delete" title="Delete">
              ${DELETE_ICON}
            </button>
          </div>
        </div>
      </div>
      <div class="retro-group__children">
        ${children.map(child => renderItem(child, true, retro, editMode, handlers)).join('')}
      </div>
    </div>
  `;
}

/**
 * Bind event listeners to items in a container
 * @param {HTMLElement} container - Container element
 * @param {Object} retro - Retrospective object
 * @param {boolean} editMode - Edit mode state
 * @param {Object} handlers - Event handlers
 */
function bindItemEvents(container, retro, editMode, handlers) {
  // Vote buttons
  container.querySelectorAll('[data-action="vote"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const itemId = btn.dataset.itemId;
      handlers.onVote(itemId);
    });
  });

  // Edit buttons
  container.querySelectorAll('[data-action="edit"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const itemId = btn.dataset.itemId;
      handlers.onEditItem(itemId);
    });
  });

  // Delete buttons
  container.querySelectorAll('[data-action="delete"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const itemId = btn.dataset.itemId;
      handlers.onDeleteItem(itemId);
    });
  });

  // Group toggle
  container.querySelectorAll('[data-action="toggle-group"]').forEach(header => {
    header.addEventListener('click', (e) => {
      const group = header.closest('.retro-group');
      if (group) {
        group.classList.toggle('retro-group--expanded');
        const children = group.querySelector('.retro-group__children');
        if (children) {
          children.classList.toggle('retro-group__children--collapsed');
        }
      }
    });
  });

  // Item click for selection
  container.querySelectorAll('.retro-item').forEach(item => {
    item.addEventListener('click', () => {
      const itemId = item.dataset.itemId;
      handlers.onItemClick(itemId);
    });

    item.addEventListener('dblclick', () => {
      if (editMode) {
        const itemId = item.dataset.itemId;
        handlers.onEditItem(itemId);
      }
    });
  });

  // Drag and drop for edit mode
  if (editMode) {
    setupDragDrop(container, handlers);
  }
}

/**
 * Setup drag and drop handlers
 * @param {HTMLElement} container - Container element
 * @param {Object} handlers - Event handlers
 */
function setupDragDrop(container, handlers) {
  container.querySelectorAll('[draggable="true"]').forEach(item => {
    item.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', item.dataset.itemId);
      e.dataTransfer.effectAllowed = 'move';
      item.classList.add('retro-item--dragging');
    });

    item.addEventListener('dragend', () => {
      item.classList.remove('retro-item--dragging');
      document.querySelectorAll('.retro-item--drop-target').forEach(el => {
        el.classList.remove('retro-item--drop-target');
      });
      document.querySelectorAll('.retro-column__body--drop-target').forEach(el => {
        el.classList.remove('retro-column__body--drop-target');
      });
    });

    item.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.stopPropagation();
      item.classList.add('retro-item--drop-target');
    });

    item.addEventListener('dragleave', () => {
      item.classList.remove('retro-item--drop-target');
    });

    item.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      item.classList.remove('retro-item--drop-target');
      const sourceId = e.dataTransfer.getData('text/plain');
      const targetId = item.dataset.itemId;
      if (sourceId !== targetId) {
        handlers.onGroup(targetId, sourceId);
      }
    });
  });
}

/**
 * Setup column as drop zone for moving items between columns
 * @param {HTMLElement} container - Column body element
 * @param {string} columnId - Target column ID
 * @param {Object} handlers - Event handlers
 */
function setupColumnDropZone(container, columnId, handlers) {
  // Prevent duplicate listeners by checking if already set up
  if (container.dataset.dropZoneSetup === 'true') {
    return;
  }
  container.dataset.dropZoneSetup = 'true';

  container.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    container.classList.add('retro-column__body--drop-target');
  });

  container.addEventListener('dragleave', (e) => {
    // Only remove if leaving the container entirely
    if (!container.contains(e.relatedTarget)) {
      container.classList.remove('retro-column__body--drop-target');
    }
  });

  container.addEventListener('drop', (e) => {
    e.preventDefault();
    container.classList.remove('retro-column__body--drop-target');

    const sourceId = e.dataTransfer.getData('text/plain');
    if (sourceId && handlers.onMoveToColumn) {
      handlers.onMoveToColumn(sourceId, columnId);
    }
  });
}

/**
 * Escape HTML to prevent XSS
 * @param {string} text - Text to escape
 * @returns {string} - Escaped text
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text || '';
  return div.innerHTML;
}
