/**
 * Dependencies vis-network Module
 * Handles vis-network initialization, rendering, and interactions
 * Uses ELK.js for orthogonal edge routing
 * Simplified from pert-vis.js: status-based coloring, no PERT values
 */

import {
  initELK,
  convertToELKGraph,
  runELKLayout,
  extractNodePositions,
  extractEdgeRoutes,
  generateSVGPath,
  isELKAvailable
} from '../../pert/js/pert-elk.js';

// vis-network instance
let network = null;
let nodesDataSet = null;
let edgesDataSet = null;
let networkContainer = null;
let edgeSvgLayer = null;
let elkEdgeRoutes = {};
let isUpdatingNetwork = false;

// Callbacks
let callbacks = {
  onNodeSelect: null,
  onNodeDoubleClick: null,
  onEdgeAdd: null,
  onEdgeDelete: null
};

// Color palette matching design system
const COLORS = {
  bgPrimary: '#101014',
  bgSecondary: '#18181f',
  bgTertiary: '#202028',
  border: '#2a2a35',
  textPrimary: '#e4e4e7',
  textSecondary: '#a1a1aa',
  textMuted: '#71717a',
  accent: '#a78bfa',
  accentBright: '#c4b5fd',
  statusSuccess: '#4ade80',
  statusWarning: '#fbbf24',
  statusInfo: '#60a5fa'
};

// Status-based node colors
const STATUS_COLORS = {
  done: {
    background: '#1a2e1a',
    border: COLORS.statusSuccess,
    highlight: { background: '#1a3a1a', border: COLORS.statusSuccess },
    hover: { background: '#1a3a1a', border: COLORS.statusSuccess }
  },
  'in-progress': {
    background: '#2e2a1a',
    border: COLORS.statusWarning,
    highlight: { background: '#3a2e1a', border: COLORS.statusWarning },
    hover: { background: '#3a2e1a', border: COLORS.statusWarning }
  },
  todo: {
    background: '#1f1a2e',
    border: COLORS.accent,
    highlight: { background: '#2a1f3a', border: COLORS.accentBright },
    hover: { background: '#2a1f3a', border: COLORS.accent }
  },
  backlog: {
    background: COLORS.bgTertiary,
    border: COLORS.border,
    highlight: { background: COLORS.bgSecondary, border: COLORS.accent },
    hover: { background: COLORS.bgSecondary, border: COLORS.textMuted }
  }
};

/**
 * Initialize the vis-network
 */
export function initNetwork(container, handlers) {
  callbacks = { ...callbacks, ...handlers };
  networkContainer = container;

  initELK();

  nodesDataSet = new vis.DataSet([]);
  edgesDataSet = new vis.DataSet([]);

  const data = { nodes: nodesDataSet, edges: edgesDataSet };
  const options = getNetworkOptions(false);

  network = new vis.Network(container, data, options);

  createEdgeSvgLayer(container);

  setupEventHandlers();

  network.on('afterDrawing', updateSvgEdgePositions);

  return network;
}

/**
 * Create SVG layer for orthogonal edges
 */
function createEdgeSvgLayer(container) {
  if (edgeSvgLayer) {
    edgeSvgLayer.remove();
  }

  edgeSvgLayer = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  edgeSvgLayer.setAttribute('class', 'deps-edge-layer');
  edgeSvgLayer.style.cssText = `
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    overflow: visible;
  `;

  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
  const marker = createArrowMarker('arrow-deps', COLORS.textMuted);
  defs.appendChild(marker);
  edgeSvgLayer.appendChild(defs);

  container.style.position = 'relative';
  container.appendChild(edgeSvgLayer);
}

/**
 * Create an arrow marker for SVG edges
 */
function createArrowMarker(id, color) {
  const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
  marker.setAttribute('id', id);
  marker.setAttribute('viewBox', '0 0 10 10');
  marker.setAttribute('refX', '9');
  marker.setAttribute('refY', '5');
  marker.setAttribute('markerWidth', '8');
  marker.setAttribute('markerHeight', '8');
  marker.setAttribute('orient', 'auto-start-reverse');

  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', 'M 0 0 L 10 5 L 0 10 z');
  path.setAttribute('fill', color);

  marker.appendChild(path);
  return marker;
}

/**
 * Get network configuration options
 */
function getNetworkOptions(editMode) {
  return {
    layout: {
      hierarchical: {
        enabled: true,
        direction: 'LR',
        sortMethod: 'directed',
        levelSeparation: 250,
        nodeSpacing: 100,
        treeSpacing: 200,
        blockShifting: true,
        edgeMinimization: true,
        parentCentralization: true
      }
    },
    nodes: {
      shape: 'box',
      margin: { top: 10, right: 10, bottom: 10, left: 10 },
      font: {
        face: 'JetBrains Mono, monospace',
        size: 12,
        color: COLORS.textPrimary,
        multi: 'html',
        bold: {
          color: COLORS.textPrimary,
          size: 13,
          face: 'JetBrains Mono, monospace',
          mod: 'bold'
        }
      },
      color: {
        background: COLORS.bgTertiary,
        border: COLORS.border,
        highlight: {
          background: COLORS.bgSecondary,
          border: COLORS.accent
        },
        hover: {
          background: COLORS.bgSecondary,
          border: COLORS.textMuted
        }
      },
      borderWidth: 1,
      borderWidthSelected: 2,
      shadow: false
    },
    edges: {
      arrows: {
        to: { enabled: true, scaleFactor: 0.8, type: 'arrow' }
      },
      color: {
        color: COLORS.textMuted,
        highlight: COLORS.accent,
        hover: COLORS.textSecondary
      },
      width: 1.5,
      smooth: false,
      font: {
        face: 'JetBrains Mono, monospace',
        size: 10,
        color: COLORS.textMuted,
        strokeWidth: 0
      }
    },
    interaction: {
      hover: true,
      tooltipDelay: 200,
      multiselect: false,
      navigationButtons: false,
      keyboard: { enabled: true, bindToWindow: false },
      zoomView: true,
      dragView: true
    },
    physics: { enabled: false },
    manipulation: editMode ? getManipulationOptions() : false
  };
}

/**
 * Get manipulation options for edit mode
 */
function getManipulationOptions() {
  return {
    enabled: true,
    initiallyActive: true,
    addNode: false,
    deleteNode: false,
    addEdge: function(edgeData, callback) {
      if (edgeData.from === edgeData.to) {
        callback(null);
        return;
      }

      const existingEdges = edgesDataSet.get({
        filter: e => e.from === edgeData.from && e.to === edgeData.to
      });
      if (existingEdges.length > 0) {
        callback(null);
        return;
      }

      const reverseEdges = edgesDataSet.get({
        filter: e => e.from === edgeData.to && e.to === edgeData.from
      });
      if (reverseEdges.length > 0) {
        callback(null);
        return;
      }

      if (wouldCreateCycle(edgeData.from, edgeData.to)) {
        callback(null);
        return;
      }

      if (callbacks.onEdgeAdd) {
        callbacks.onEdgeAdd(edgeData.from, edgeData.to);
      }

      callback(null);
    },
    editEdge: false,
    deleteEdge: function(edgeData, callback) {
      if (edgeData.edges && edgeData.edges.length > 0) {
        const edgeId = edgeData.edges[0];
        const edge = edgesDataSet.get(edgeId);
        if (edge && callbacks.onEdgeDelete) {
          callbacks.onEdgeDelete(edge.from, edge.to);
        }
      }
      callback(null);
    },
    controlNodeStyle: {
      shape: 'dot',
      size: 6,
      color: { background: COLORS.accent, border: COLORS.accentBright },
      borderWidth: 2
    }
  };
}

/**
 * Check if adding an edge would create a cycle
 */
function wouldCreateCycle(fromId, toId) {
  const visited = new Set();
  const stack = [toId];

  while (stack.length > 0) {
    const current = stack.pop();
    if (current === fromId) return true;

    if (!visited.has(current)) {
      visited.add(current);
      const outgoingEdges = edgesDataSet.get({
        filter: e => e.from === current
      });
      outgoingEdges.forEach(edge => {
        if (!visited.has(edge.to)) {
          stack.push(edge.to);
        }
      });
    }
  }

  return false;
}

/**
 * Set up event handlers
 */
function setupEventHandlers() {
  network.on('selectNode', function(params) {
    if (params.nodes.length > 0 && callbacks.onNodeSelect) {
      callbacks.onNodeSelect(params.nodes[0]);
    }
  });

  network.on('deselectNode', function() {
    if (callbacks.onNodeSelect) {
      callbacks.onNodeSelect(null);
    }
  });

  network.on('doubleClick', function(params) {
    if (params.nodes.length > 0 && callbacks.onNodeDoubleClick) {
      callbacks.onNodeDoubleClick(params.nodes[0]);
    }
  });
}

/**
 * Build a simplified node label (task name + category)
 */
function buildNodeLabel(task) {
  const name = escapeHtml(task.name);
  const category = escapeHtml(task.category || '');
  if (category) {
    return `<b>${name}</b>\n${category}`;
  }
  return `<b>${name}</b>`;
}

/**
 * Build a label for milestone diamond nodes.
 * Uses widthConstraint to wrap text across lines instead of inflating the diamond.
 */
function buildMilestoneLabel(task) {
  return `<b>${escapeHtml(task.name)}</b>`;
}

/**
 * Build tooltip for a node (plain text for vis-network)
 */
function buildNodeTooltip(task, columnName) {
  const assignee = task.assignee || 'Unassigned';
  return `${task.name}\nCategory: ${task.category || 'None'}\nStatus: ${columnName}\nAssignee: ${assignee}`;
}

/**
 * Get node color based on board status
 */
function getNodeColor(columnId) {
  return STATUS_COLORS[columnId] || STATUS_COLORS.backlog;
}

/**
 * Get the column name for a column ID from workflow
 */
function getColumnName(columnId, workflow) {
  if (!workflow || !workflow.columns) return columnId || 'Unknown';
  const col = workflow.columns.find(c => c.id === columnId);
  return col ? col.name : columnId || 'Unknown';
}

/**
 * Update the network with task data
 */
export async function updateNetwork(tasks, workflow, options = {}) {
  const { fitView = true, searchQuery = '', categoryFilter = null, statusFilter = null } = options;

  isUpdatingNetwork = true;

  if (!network || !tasks || tasks.length === 0) {
    nodesDataSet.clear();
    edgesDataSet.clear();
    clearSvgEdges();
    elkEdgeRoutes = {};
    isUpdatingNetwork = false;
    return;
  }

  // Filter tasks
  let filteredTasks = tasks;
  if (categoryFilter) {
    filteredTasks = filteredTasks.filter(t => t.category === categoryFilter);
  }
  if (statusFilter) {
    filteredTasks = filteredTasks.filter(t => (t.board?.columnId || 'backlog') === statusFilter);
  }

  const taskIds = new Set(filteredTasks.map(t => t.id));

  // Build nodes
  const nodes = [];
  const nodeIds = [];

  filteredTasks.forEach(task => {
    const columnId = task.board?.columnId || 'backlog';
    const columnName = getColumnName(columnId, workflow);
    const isSearchMatch = !searchQuery || task.name.toLowerCase().includes(searchQuery.toLowerCase());

    const nodeColor = getNodeColor(columnId);
    const dimmed = searchQuery && !isSearchMatch;

    const isMilestone = task.isMilestone;
    const nodeConfig = {
      id: task.id,
      label: isMilestone ? buildMilestoneLabel(task) : buildNodeLabel(task),
      title: buildNodeTooltip(task, columnName),
      color: dimmed ? {
        background: COLORS.bgPrimary,
        border: COLORS.border,
        highlight: { background: COLORS.bgSecondary, border: COLORS.accent },
        hover: { background: COLORS.bgSecondary, border: COLORS.textMuted }
      } : nodeColor,
      font: {
        multi: 'html',
        color: dimmed ? COLORS.textMuted : COLORS.textPrimary,
        bold: {
          color: dimmed ? COLORS.textMuted : COLORS.textPrimary,
          size: isMilestone ? 11 : 13,
          face: 'JetBrains Mono, monospace',
          mod: 'bold'
        }
      },
      opacity: dimmed ? 0.4 : 1.0,
      shape: isMilestone ? 'diamond' : 'box',
      nodeData: task
    };

    // Constrain width so labels wrap to ~2 lines instead of stretching wide
    if (isMilestone) {
      nodeConfig.widthConstraint = { maximum: 100 };
    } else {
      nodeConfig.widthConstraint = { maximum: 180 };
    }

    nodes.push(nodeConfig);

    nodeIds.push(task.id);
  });

  // Build edges from task.dependencies
  const edges = [];
  const elkEdges = [];

  filteredTasks.forEach(task => {
    const deps = task.dependencies || [];
    const milestoneDeps = task.milestoneDependencies || [];
    const allDeps = [...new Set([...deps, ...milestoneDeps])];

    allDeps.forEach(predId => {
      if (taskIds.has(predId)) {
        const edgeId = `${predId}->${task.id}`;
        edges.push({
          id: edgeId,
          from: predId,
          to: task.id,
          hidden: true,
          color: { color: 'transparent' },
          width: 0
        });
        elkEdges.push({
          id: edgeId,
          source: predId,
          target: task.id
        });
      }
    });
  });

  // Phase 1: Add nodes to measure
  nodesDataSet.clear();
  nodesDataSet.add(nodes);
  edgesDataSet.clear();
  edgesDataSet.add(edges);

  network.redraw();

  await new Promise(resolve => setTimeout(resolve, 50));

  // Phase 2: Measure and run ELK
  const elkNodes = [];

  const milestoneIds = new Set(filteredTasks.filter(t => t.isMilestone).map(t => t.id));

  nodeIds.forEach(id => {
    // Milestones use a fixed small size for ELK to prevent gaps
    if (milestoneIds.has(id)) {
      elkNodes.push({ id, label: id, width: 50, height: 50 });
      return;
    }

    try {
      const bbox = network.getBoundingBox(id);
      if (bbox) {
        const width = Math.ceil(bbox.right - bbox.left);
        const height = Math.ceil(bbox.bottom - bbox.top);
        elkNodes.push({ id, label: id, width, height });
      } else {
        elkNodes.push({ id, label: id, width: 160, height: 60 });
      }
    } catch (e) {
      elkNodes.push({ id, label: id, width: 160, height: 60 });
    }
  });

  // Phase 3: ELK layout
  let elkPositions = null;
  elkEdgeRoutes = {};

  if (isELKAvailable() && elkNodes.length > 0 && elkEdges.length > 0) {
    try {
      const elkGraph = convertToELKGraph(elkNodes, elkEdges);
      const elkResult = await runELKLayout(elkGraph);
      elkPositions = extractNodePositions(elkResult);
      elkEdgeRoutes = extractEdgeRoutes(elkResult, elkPositions);
    } catch (err) {
      console.warn('ELK layout failed, using default layout:', err);
      elkPositions = null;
      elkEdgeRoutes = {};
    }
  }

  // Phase 4: Apply positions and render edges
  if (elkPositions) {
    const positionUpdates = Object.entries(elkPositions).map(([nodeId, pos]) => ({
      id: nodeId,
      x: pos.x,
      y: pos.y
    }));
    nodesDataSet.update(positionUpdates);

    await new Promise(resolve => setTimeout(resolve, 50));
  } else {
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  isUpdatingNetwork = false;
  renderSvgEdges();

  if (fitView && network) {
    network.fit({
      animation: { duration: 300, easingFunction: 'easeInOutQuad' }
    });
  }
}

/**
 * Clear all SVG edges
 */
function clearSvgEdges() {
  if (!edgeSvgLayer) return;
  const paths = edgeSvgLayer.querySelectorAll('path.edge-path');
  paths.forEach(p => p.remove());
}

/**
 * Render orthogonal edges using SVG
 */
function renderSvgEdges() {
  if (!edgeSvgLayer || !network || !edgesDataSet || !nodesDataSet) return;

  clearSvgEdges();

  const edges = edgesDataSet.get();
  if (!edges || edges.length === 0) return;

  const hasElkRoutes = Object.keys(elkEdgeRoutes).length > 0;

  edges.forEach(edge => {
    let points = [];

    if (hasElkRoutes && elkEdgeRoutes[edge.id]) {
      const elkPoints = elkEdgeRoutes[edge.id];
      points = elkPoints.map(p => network.canvasToDOM({ x: p.x, y: p.y }));
    } else {
      const fromNode = nodesDataSet.get(edge.from);
      const toNode = nodesDataSet.get(edge.to);
      if (!fromNode || !toNode) return;

      let fromPos, toPos;
      try {
        fromPos = network.getPosition(edge.from);
        toPos = network.getPosition(edge.to);
      } catch (e) {
        return;
      }

      if (!fromPos || !toPos) return;

      const fromDOM = network.canvasToDOM(fromPos);
      const toDOM = network.canvasToDOM(toPos);

      const scale = network.getScale();
      const halfWidth = (160 / 2) * scale;

      const startX = fromDOM.x + halfWidth;
      const startY = fromDOM.y;
      const endX = toDOM.x - halfWidth;
      const endY = toDOM.y;
      const midX = (startX + endX) / 2;

      if (Math.abs(startY - endY) < 5) {
        points = [{ x: startX, y: startY }, { x: endX, y: endY }];
      } else {
        points = [
          { x: startX, y: startY },
          { x: midX, y: startY },
          { x: midX, y: endY },
          { x: endX, y: endY }
        ];
      }
    }

    if (points.length < 2) return;

    const pathD = generateSVGPath(points);

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('class', 'edge-path');
    path.setAttribute('d', pathD);
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', COLORS.textMuted);
    path.setAttribute('stroke-width', '1.5');
    path.setAttribute('marker-end', 'url(#arrow-deps)');
    path.setAttribute('data-edge-id', edge.id);

    edgeSvgLayer.appendChild(path);
  });
}

/**
 * Update SVG edge positions when view changes (zoom/pan)
 */
function updateSvgEdgePositions() {
  if (isUpdatingNetwork) return;
  if (!edgeSvgLayer || !network || !edgesDataSet) return;
  renderSvgEdges();
}

/**
 * Add a single edge to the network (incremental)
 */
export function addEdgeToNetwork(fromId, toId) {
  if (!edgesDataSet) return;
  const edgeId = `${fromId}->${toId}`;
  if (edgesDataSet.get(edgeId)) return;

  edgesDataSet.add({
    id: edgeId,
    from: fromId,
    to: toId,
    hidden: true,
    color: { color: 'transparent' },
    width: 0
  });
}

/**
 * Remove a single edge from the network (incremental)
 */
export function removeEdgeFromNetwork(fromId, toId) {
  if (!edgesDataSet) return;
  const edgeId = `${fromId}->${toId}`;
  edgesDataSet.remove(edgeId);
}

/**
 * Check if the network has any nodes
 */
export function hasNodes() {
  return nodesDataSet && nodesDataSet.length > 0;
}

/**
 * Enable or disable edit mode
 */
export function setEditMode(enabled) {
  if (!network) return;
  network.setOptions({
    manipulation: enabled ? getManipulationOptions() : false
  });
}

/**
 * Start edge drawing mode
 */
export function startEdgeDrawing() {
  if (!network) return;
  network.enableEditMode();
  network.addEdgeMode();
}

/**
 * Stop edge drawing mode
 */
export function stopEdgeDrawing() {
  if (!network) return;
  network.disableEditMode();
}

/**
 * Zoom in
 */
export function zoomIn() {
  if (!network) return;
  const scale = network.getScale();
  network.moveTo({
    scale: Math.min(scale * 1.3, 3),
    animation: { duration: 200, easingFunction: 'easeInOutQuad' }
  });
}

/**
 * Zoom out
 */
export function zoomOut() {
  if (!network) return;
  const scale = network.getScale();
  network.moveTo({
    scale: Math.max(scale / 1.3, 0.3),
    animation: { duration: 200, easingFunction: 'easeInOutQuad' }
  });
}

/**
 * Reset view to fit all nodes
 */
export function resetView() {
  if (!network) return;
  network.fit({
    animation: { duration: 300, easingFunction: 'easeInOutQuad' }
  });
}

/**
 * Select a node programmatically
 */
export function selectNode(nodeId) {
  if (!network) return;
  if (nodeId) {
    network.selectNodes([nodeId]);
    network.focus(nodeId, {
      scale: 1,
      animation: { duration: 300, easingFunction: 'easeInOutQuad' }
    });
  } else {
    network.unselectAll();
  }
}

/**
 * Get the network instance
 */
export function getNetwork() {
  return network;
}

/**
 * Destroy the network
 */
export function destroyNetwork() {
  if (network) {
    network.destroy();
    network = null;
    nodesDataSet = null;
    edgesDataSet = null;
  }
  if (edgeSvgLayer) {
    edgeSvgLayer.remove();
    edgeSvgLayer = null;
  }
  elkEdgeRoutes = {};
  networkContainer = null;
}

/**
 * Export the network as PNG
 */
export function exportToPNG(padding = 100) {
  return new Promise((resolve, reject) => {
    if (!network) {
      reject(new Error('Network not initialized'));
      return;
    }

    const positions = network.getPositions();
    const nodeIds = Object.keys(positions);

    if (nodeIds.length === 0) {
      reject(new Error('No nodes to export'));
      return;
    }

    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;

    const nodeWidth = 160;
    const nodeHeight = 60;

    nodeIds.forEach(id => {
      const pos = positions[id];
      minX = Math.min(minX, pos.x - nodeWidth / 2);
      maxX = Math.max(maxX, pos.x + nodeWidth / 2);
      minY = Math.min(minY, pos.y - nodeHeight / 2);
      maxY = Math.max(maxY, pos.y + nodeHeight / 2);
    });

    const contentWidth = maxX - minX;
    const contentHeight = maxY - minY;
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    const currentScale = network.getScale();
    const currentPosition = network.getViewPosition();

    const container = network.body.container;
    const originalWidth = container.style.width;
    const originalHeight = container.style.height;
    const originalOverflow = container.style.overflow;
    const originalPosition = container.style.position;

    const hiDpiScale = 2;
    const exportWidth = (contentWidth + padding * 2) * hiDpiScale;
    const exportHeight = (contentHeight + padding * 2) * hiDpiScale;

    container.style.position = 'absolute';
    container.style.width = `${exportWidth / hiDpiScale}px`;
    container.style.height = `${exportHeight / hiDpiScale}px`;
    container.style.overflow = 'hidden';

    network.setSize(`${exportWidth / hiDpiScale}px`, `${exportHeight / hiDpiScale}px`);

    network.moveTo({
      position: { x: centerX, y: centerY },
      scale: 1.0,
      animation: false
    });

    const captureHighRes = async () => {
      try {
        let sourceCanvas = null;
        if (network.canvas && network.canvas.frame && network.canvas.frame.canvas) {
          sourceCanvas = network.canvas.frame.canvas;
        }
        if (!sourceCanvas) {
          sourceCanvas = container.querySelector('canvas');
        }
        if (!sourceCanvas) throw new Error('Canvas not found');

        const srcWidth = sourceCanvas.width;
        const srcHeight = sourceCanvas.height;

        const exportCanvas = document.createElement('canvas');
        const ctx = exportCanvas.getContext('2d');
        exportCanvas.width = srcWidth;
        exportCanvas.height = srcHeight;

        ctx.fillStyle = COLORS.bgPrimary;
        ctx.fillRect(0, 0, srcWidth, srcHeight);
        ctx.drawImage(sourceCanvas, 0, 0);

        if (edgeSvgLayer) {
          const edgePaths = edgeSvgLayer.querySelectorAll('path.edge-path');
          if (edgePaths.length > 0) {
            await drawSvgEdgesToCanvas(ctx, srcWidth, srcHeight);
          }
        }

        container.style.width = originalWidth;
        container.style.height = originalHeight;
        container.style.overflow = originalOverflow;
        container.style.position = originalPosition;
        network.setSize(originalWidth, originalHeight);
        network.moveTo({ position: currentPosition, scale: currentScale, animation: false });
        network.redraw();
        renderSvgEdges();

        resolve(exportCanvas.toDataURL('image/png'));
      } catch (err) {
        container.style.width = originalWidth;
        container.style.height = originalHeight;
        container.style.overflow = originalOverflow;
        container.style.position = originalPosition;
        network.setSize(originalWidth, originalHeight);
        network.moveTo({ position: currentPosition, scale: currentScale, animation: false });
        reject(err);
      }
    };

    setTimeout(() => {
      network.redraw();
      renderSvgEdges();
      setTimeout(() => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            captureHighRes();
          });
        });
      }, 100);
    }, 50);
  });
}

/**
 * Draw SVG edges directly to canvas for PNG export
 */
async function drawSvgEdgesToCanvas(ctx, width, height) {
  if (!edgeSvgLayer) return;

  const svgRect = edgeSvgLayer.getBoundingClientRect();
  const originalWidth = svgRect.width;
  const originalHeight = svgRect.height;

  const svgClone = edgeSvgLayer.cloneNode(true);
  svgClone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  svgClone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
  svgClone.setAttribute('viewBox', `0 0 ${originalWidth} ${originalHeight}`);
  svgClone.setAttribute('width', width);
  svgClone.setAttribute('height', height);
  svgClone.style.cssText = `width: ${width}px; height: ${height}px;`;

  const serializer = new XMLSerializer();
  const svgString = serializer.serializeToString(svgClone);

  const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);
      resolve();
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      console.warn('Could not render SVG edges to PNG');
      resolve();
    };
    img.src = url;
  });
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
 * Escape HTML tags for vis-network multi:html labels.
 * Only escape < and > to prevent tag injection.
 * Do NOT escape & — vis-network doesn't decode HTML entities,
 * so &amp; would render literally.
 */
function escapeHtml(text) {
  if (!text) return '';
  return text.replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
