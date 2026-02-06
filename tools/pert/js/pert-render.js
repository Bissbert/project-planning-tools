/**
 * PERT Render Module
 * SVG diagram and table rendering
 */

import { getAllEdges, getPredecessors, getSuccessors } from './pert-calc.js';
import {
  positionNodes,
  calculateEdgePath,
  calculateAutoFit,
  calculateBounds,
  NODE_WIDTH,
  NODE_HEIGHT
} from './pert-layout.js';

/**
 * Render the complete PERT diagram
 * @param {Object} params - Render parameters
 */
export function renderDiagram(params) {
  const {
    container,
    svg,
    graph,
    criticalPath,
    selectedNodeId,
    editMode,
    drawModeState,
    handlers,
    searchQuery
  } = params;

  if (!graph || graph.nodes.size === 0) {
    showEmptyState(container);
    return;
  }

  hideEmptyState(container);

  // Get container dimensions
  const rect = container.getBoundingClientRect();
  const width = rect.width || 800;
  const height = rect.height || 600;

  // Calculate positions
  const positions = positionNodes(graph, width, height);

  // Store positions for external use
  svg._positions = positions;

  // Calculate auto-fit transform
  const fit = calculateAutoFit(positions, width, height);

  // Get SVG layers
  const edgesLayer = svg.querySelector('#edgesLayer');
  const nodesLayer = svg.querySelector('#nodesLayer');

  // Clear existing content
  edgesLayer.innerHTML = '';
  nodesLayer.innerHTML = '';

  // Create transform group if needed
  let transformGroup = svg.querySelector('.pert-transform-group');
  if (!transformGroup) {
    transformGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    transformGroup.classList.add('pert-transform-group');
    svg.appendChild(transformGroup);

    // Move layers into transform group
    transformGroup.appendChild(edgesLayer);
    transformGroup.appendChild(nodesLayer);
  }

  // Apply transform
  transformGroup.setAttribute('transform', `translate(${fit.translateX}, ${fit.translateY}) scale(${fit.scale})`);

  // Render edges first (behind nodes)
  const edges = getAllEdges(graph);
  edges.forEach(edge => {
    renderEdge({
      edgesLayer,
      edge,
      positions,
      criticalPath,
      editMode,
      handlers
    });
  });

  // Render nodes
  const criticalSet = new Set(criticalPath);
  graph.nodes.forEach((node, id) => {
    const matchesSearch = !searchQuery || node.name.toLowerCase().includes(searchQuery);
    const opacity = searchQuery && !matchesSearch ? 0.3 : 1;

    renderNode({
      nodesLayer,
      node,
      position: positions.get(id),
      isCritical: criticalSet.has(id),
      isSelected: id === selectedNodeId,
      editMode,
      drawModeState,
      handlers,
      opacity,
      graph
    });
  });
}

/**
 * Render a single node
 */
function renderNode(params) {
  const {
    nodesLayer,
    node,
    position,
    isCritical,
    isSelected,
    editMode,
    drawModeState,
    handlers,
    opacity,
    graph
  } = params;

  if (!position) return;

  const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  g.classList.add('pert-node');
  g.setAttribute('data-node-id', node.id);
  g.style.opacity = opacity;

  // Add state classes
  if (isCritical) g.classList.add('pert-node--critical');
  if (isSelected) g.classList.add('pert-node--selected');
  if (node.isComplete) g.classList.add('pert-node--complete');

  // Check draw mode states
  if (drawModeState?.active) {
    if (drawModeState.sourceId === node.id) {
      g.classList.add('pert-node--drawing-source');
    } else if (drawModeState.sourceId) {
      // Check if valid target
      const isValid = isValidDrawTarget(graph, drawModeState.sourceId, node.id);
      if (isValid) {
        g.classList.add('pert-node--valid-target');
      } else {
        g.classList.add('pert-node--invalid-target');
      }
    }
  }

  const { x, y, width, height } = position;

  // Background rectangle
  const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  bg.classList.add('pert-node__bg');
  bg.setAttribute('x', x);
  bg.setAttribute('y', y);
  bg.setAttribute('width', width);
  bg.setAttribute('height', height);
  g.appendChild(bg);

  // Header rectangle
  const header = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  header.classList.add('pert-node__header');
  header.setAttribute('x', x);
  header.setAttribute('y', y);
  header.setAttribute('width', width);
  header.setAttribute('height', 28);
  g.appendChild(header);

  // Title text
  const title = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  title.classList.add('pert-node__title');
  title.setAttribute('x', x + width / 2);
  title.setAttribute('y', y + 18);
  title.textContent = truncateText(node.name, 18);
  g.appendChild(title);

  // PERT values grid (ES, EF, LS, LF)
  const valuesY = y + 38;

  // ES
  addValueCell(g, 'ES', node.es, x + 4, valuesY);
  // EF
  addValueCell(g, 'EF', node.ef, x + width / 2 + 4, valuesY);

  // Divider
  const divider1 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  divider1.classList.add('pert-node__divider');
  divider1.setAttribute('x1', x);
  divider1.setAttribute('y1', y + 54);
  divider1.setAttribute('x2', x + width);
  divider1.setAttribute('y2', y + 54);
  g.appendChild(divider1);

  // LS
  addValueCell(g, 'LS', node.ls, x + 4, y + 64);
  // LF
  addValueCell(g, 'LF', node.lf, x + width / 2 + 4, y + 64);

  // Divider
  const divider2 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  divider2.classList.add('pert-node__divider');
  divider2.setAttribute('x1', x);
  divider2.setAttribute('y1', y + 78);
  divider2.setAttribute('x2', x + width);
  divider2.setAttribute('y2', y + 78);
  g.appendChild(divider2);

  // Duration and Slack row
  const duration = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  duration.classList.add('pert-node__duration');
  duration.setAttribute('x', x + width / 4);
  duration.setAttribute('y', y + 92);
  duration.textContent = `${node.duration}w`;
  g.appendChild(duration);

  const slack = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  slack.classList.add('pert-node__slack');
  slack.setAttribute('x', x + width * 3 / 4);
  slack.setAttribute('y', y + 92);
  slack.textContent = `Slack: ${node.slack}`;
  g.appendChild(slack);

  // Completion indicator
  if (node.isComplete) {
    const check = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    check.classList.add('pert-node__status');
    check.setAttribute('cx', x + width - 10);
    check.setAttribute('cy', y + 14);
    g.appendChild(check);
  }

  // Event handlers
  g.addEventListener('click', (e) => {
    e.stopPropagation();
    if (handlers.onNodeClick) {
      handlers.onNodeClick(node.id, e);
    }
  });

  g.addEventListener('dblclick', (e) => {
    e.stopPropagation();
    if (handlers.onNodeDblClick) {
      handlers.onNodeDblClick(node.id, e);
    }
  });

  nodesLayer.appendChild(g);
}

/**
 * Add a PERT value cell to a node
 */
function addValueCell(g, label, value, x, y) {
  const labelText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  labelText.classList.add('pert-node__value-label');
  labelText.setAttribute('x', x);
  labelText.setAttribute('y', y);
  labelText.textContent = label;
  g.appendChild(labelText);

  const valueText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  valueText.classList.add('pert-node__value-text');
  valueText.setAttribute('x', x + 24);
  valueText.setAttribute('y', y);
  valueText.textContent = value;
  g.appendChild(valueText);
}

/**
 * Render a single edge
 */
function renderEdge(params) {
  const {
    edgesLayer,
    edge,
    positions,
    criticalPath,
    editMode,
    handlers
  } = params;

  const fromPos = positions.get(edge.from);
  const toPos = positions.get(edge.to);

  if (!fromPos || !toPos) return;

  const pathData = calculateEdgePath(fromPos, toPos);

  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.classList.add('pert-edge');
  path.setAttribute('d', pathData.path);
  path.setAttribute('data-from', edge.from);
  path.setAttribute('data-to', edge.to);

  if (edge.isCritical) {
    path.classList.add('pert-edge--critical');
  }

  // Edge click handler for reversal/deletion
  if (editMode) {
    path.addEventListener('click', (e) => {
      e.stopPropagation();
      if (handlers.onEdgeClick) {
        handlers.onEdgeClick(edge.from, edge.to, e);
      }
    });

    path.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (handlers.onEdgeRightClick) {
        handlers.onEdgeRightClick(edge.from, edge.to, e);
      }
    });
  }

  edgesLayer.appendChild(path);
}

/**
 * Check if a node is a valid draw target
 */
function isValidDrawTarget(graph, sourceId, targetId) {
  if (sourceId === targetId) return false;

  // Check if edge already exists
  const successors = graph.adjacency.get(sourceId);
  if (successors && successors.has(targetId)) return false;

  // Check if reverse edge exists
  const reverseSuccessors = graph.adjacency.get(targetId);
  if (reverseSuccessors && reverseSuccessors.has(sourceId)) return false;

  // Check for cycle
  // If adding sourceId -> targetId would create a cycle
  // This happens if targetId can reach sourceId
  const visited = new Set();
  const stack = [targetId];

  while (stack.length > 0) {
    const current = stack.pop();
    if (current === sourceId) return false;

    if (!visited.has(current)) {
      visited.add(current);
      const succs = graph.adjacency.get(current);
      if (succs) {
        succs.forEach(succ => {
          if (!visited.has(succ)) {
            stack.push(succ);
          }
        });
      }
    }
  }

  return true;
}

/**
 * Render the PERT table view
 */
export function renderTable(params) {
  const {
    tableBody,
    graph,
    criticalPath,
    selectedNodeId,
    sortColumn,
    sortDirection,
    handlers,
    searchQuery
  } = params;

  if (!graph || graph.nodes.size === 0) {
    tableBody.innerHTML = '<tr><td colspan="8" class="pert-table__empty">No tasks to display</td></tr>';
    return;
  }

  // Convert nodes to array for sorting
  const nodes = [];
  graph.nodes.forEach((node, id) => {
    nodes.push({ ...node, id });
  });

  // Filter by search query
  const filteredNodes = searchQuery
    ? nodes.filter(n => n.name.toLowerCase().includes(searchQuery))
    : nodes;

  // Sort nodes
  const criticalSet = new Set(criticalPath);
  const sortedNodes = sortNodes(filteredNodes, sortColumn, sortDirection, criticalSet);

  // Render rows
  tableBody.innerHTML = sortedNodes.map(node => {
    const isCritical = criticalSet.has(node.id);
    const isSelected = node.id === selectedNodeId;
    const isMilestone = node.task?.isMilestone;

    return `
      <tr class="${isCritical ? 'critical' : ''} ${isSelected ? 'selected' : ''}"
          data-node-id="${node.id}">
        <td class="pert-table__task-name ${isMilestone ? 'pert-table__task-name--milestone' : ''}"
            title="${escapeHtml(node.name)}">
          ${escapeHtml(truncateText(node.name, 25))}
        </td>
        <td class="pert-table__duration">${node.duration}w</td>
        <td class="pert-table__value">${node.es}</td>
        <td class="pert-table__value">${node.ef}</td>
        <td class="pert-table__value">${node.ls}</td>
        <td class="pert-table__value">${node.lf}</td>
        <td class="pert-table__slack ${node.slack === 0 ? 'pert-table__slack--zero' : 'pert-table__slack--positive'}">
          ${node.slack}
        </td>
        <td class="pert-table__critical">
          <span class="pert-table__critical-badge ${isCritical ? 'pert-table__critical-badge--yes' : 'pert-table__critical-badge--no'}">
          </span>
        </td>
      </tr>
    `;
  }).join('');

  // Add row click handlers
  tableBody.querySelectorAll('tr').forEach(row => {
    const nodeId = row.dataset.nodeId;
    row.addEventListener('click', () => {
      if (handlers.onNodeClick) {
        handlers.onNodeClick(nodeId);
      }
    });
    row.addEventListener('dblclick', () => {
      if (handlers.onNodeDblClick) {
        handlers.onNodeDblClick(nodeId);
      }
    });
  });
}

/**
 * Sort nodes array
 */
function sortNodes(nodes, column, direction, criticalSet) {
  const multiplier = direction === 'asc' ? 1 : -1;

  return [...nodes].sort((a, b) => {
    let aVal, bVal;

    switch (column) {
      case 'name':
        aVal = a.name.toLowerCase();
        bVal = b.name.toLowerCase();
        return multiplier * aVal.localeCompare(bVal);
      case 'duration':
        return multiplier * (a.duration - b.duration);
      case 'es':
        return multiplier * (a.es - b.es);
      case 'ef':
        return multiplier * (a.ef - b.ef);
      case 'ls':
        return multiplier * (a.ls - b.ls);
      case 'lf':
        return multiplier * (a.lf - b.lf);
      case 'slack':
      default:
        // Default: sort by slack (critical first)
        return multiplier * (a.slack - b.slack);
    }
  });
}

/**
 * Render sidebar content for selected node
 */
export function renderSidebar(params) {
  const {
    container,
    graph,
    nodeId,
    editMode,
    handlers
  } = params;

  const node = graph.nodes.get(nodeId);
  if (!node) {
    container.innerHTML = '<p class="sidebar-dep-empty">Select a task to view details</p>';
    return;
  }

  const predecessors = getPredecessors(graph, nodeId);
  const successors = getSuccessors(graph, nodeId);

  container.innerHTML = `
    <div class="sidebar-section">
      <div class="sidebar-task-name">${escapeHtml(node.name)}</div>
      <span class="sidebar-task-status ${node.isCritical ? 'sidebar-task-status--critical' : ''} ${node.isComplete ? 'sidebar-task-status--complete' : ''}">
        ${node.isCritical ? 'Critical Path' : node.isComplete ? 'Complete' : `Slack: ${node.slack}`}
      </span>
    </div>

    <div class="sidebar-section">
      <h3 class="sidebar-section__title">PERT Values</h3>
      <div class="sidebar-pert-grid">
        <div class="sidebar-pert-item">
          <span class="sidebar-pert-item__label">Early Start</span>
          <span class="sidebar-pert-item__value">${node.es}</span>
        </div>
        <div class="sidebar-pert-item">
          <span class="sidebar-pert-item__label">Early Finish</span>
          <span class="sidebar-pert-item__value">${node.ef}</span>
        </div>
        <div class="sidebar-pert-item">
          <span class="sidebar-pert-item__label">Late Start</span>
          <span class="sidebar-pert-item__value">${node.ls}</span>
        </div>
        <div class="sidebar-pert-item">
          <span class="sidebar-pert-item__label">Late Finish</span>
          <span class="sidebar-pert-item__value">${node.lf}</span>
        </div>
        <div class="sidebar-pert-item">
          <span class="sidebar-pert-item__label">Duration</span>
          <span class="sidebar-pert-item__value">${node.duration}w</span>
        </div>
        <div class="sidebar-pert-item">
          <span class="sidebar-pert-item__label">Slack</span>
          <span class="sidebar-pert-item__value">${node.slack}</span>
        </div>
      </div>
    </div>

    <div class="sidebar-section">
      <h3 class="sidebar-section__title">Predecessors (${predecessors.length})</h3>
      <div class="sidebar-dep-list">
        ${predecessors.length > 0
          ? predecessors.map(pred => `
            <div class="sidebar-dep-item" data-dep-id="${pred.id}">
              <span class="sidebar-dep-item__name">${escapeHtml(pred.name)}</span>
              ${editMode ? `<button class="sidebar-dep-item__remove" onclick="removeDependency('${pred.id}', '${nodeId}')">&times;</button>` : ''}
            </div>
          `).join('')
          : '<p class="sidebar-dep-empty">No predecessors</p>'
        }
      </div>
    </div>

    <div class="sidebar-section">
      <h3 class="sidebar-section__title">Successors (${successors.length})</h3>
      <div class="sidebar-dep-list">
        ${successors.length > 0
          ? successors.map(succ => `
            <div class="sidebar-dep-item" data-dep-id="${succ.id}">
              <span class="sidebar-dep-item__name">${escapeHtml(succ.name)}</span>
              ${editMode ? `<button class="sidebar-dep-item__remove" onclick="removeDependency('${nodeId}', '${succ.id}')">&times;</button>` : ''}
            </div>
          `).join('')
          : '<p class="sidebar-dep-empty">No successors</p>'
        }
      </div>
    </div>
  `;
}

/**
 * Update header statistics
 */
export function renderStats(params) {
  const { graph, criticalPath, projectDuration } = params;

  const nodeCountEl = document.getElementById('nodeCount');
  const projectDurationEl = document.getElementById('projectDuration');
  const criticalCountEl = document.getElementById('criticalCount');

  if (nodeCountEl) nodeCountEl.textContent = graph.nodes.size;
  if (projectDurationEl) projectDurationEl.textContent = `${projectDuration}w`;
  if (criticalCountEl) criticalCountEl.textContent = criticalPath.length;
}

/**
 * Show empty state
 */
function showEmptyState(container) {
  const emptyEl = container.querySelector('.diagram-empty');
  if (emptyEl) emptyEl.style.display = 'flex';
}

/**
 * Hide empty state
 */
function hideEmptyState(container) {
  const emptyEl = container.querySelector('.diagram-empty');
  if (emptyEl) emptyEl.style.display = 'none';
}

/**
 * Truncate text with ellipsis
 */
function truncateText(text, maxLength) {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 1) + '...';
}

/**
 * Escape HTML entities
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text || '';
  return div.innerHTML;
}
