/**
 * PERT vis-network Module
 * Handles vis-network initialization, rendering, and interactions
 * Uses SVG overlay for orthogonal edge routing
 */

import {
  initELK,
  generateSVGPath
} from './pert-elk.js';

// vis-network instance
let network = null;
let nodesDataSet = null;
let edgesDataSet = null;
let networkContainer = null;
let edgeSvgLayer = null;
let criticalEdges = new Set(); // Track which edges are critical

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
  statusWarning: '#fbbf24'
};

/**
 * Initialize the vis-network
 * @param {HTMLElement} container - The container element
 * @param {Object} handlers - Event handlers
 */
export function initNetwork(container, handlers) {
  callbacks = { ...callbacks, ...handlers };
  networkContainer = container;

  // Initialize ELK for orthogonal edge routing
  initELK();

  // Initialize empty data sets
  nodesDataSet = new vis.DataSet([]);
  edgesDataSet = new vis.DataSet([]);

  const data = {
    nodes: nodesDataSet,
    edges: edgesDataSet
  };

  const options = getNetworkOptions(false);

  network = new vis.Network(container, data, options);

  // Create SVG layer for orthogonal edges AFTER vis.Network (so it's on top)
  createEdgeSvgLayer(container);

  // Expose for debugging
  window._pertNetwork = network;

  // Set up event handlers
  setupEventHandlers();

  // Listen for view changes to update SVG edges
  network.on('afterDrawing', updateSvgEdgePositions);

  return network;
}

/**
 * Create SVG layer for orthogonal edges
 * @param {HTMLElement} container - The container element
 */
function createEdgeSvgLayer(container) {
  // Remove existing SVG layer if present
  if (edgeSvgLayer) {
    edgeSvgLayer.remove();
  }

  // Create SVG element that overlays the canvas
  edgeSvgLayer = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  edgeSvgLayer.setAttribute('class', 'pert-edge-layer');
  edgeSvgLayer.style.cssText = `
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    overflow: visible;
  `;

  // Add arrow marker definition
  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');

  // Normal edge arrow
  const markerNormal = createArrowMarker('arrow-normal', COLORS.textMuted);
  defs.appendChild(markerNormal);

  // Critical edge arrow
  const markerCritical = createArrowMarker('arrow-critical', COLORS.accent);
  defs.appendChild(markerCritical);

  edgeSvgLayer.appendChild(defs);

  // Append SVG to container (on top of canvas, but pointer-events: none lets clicks through)
  container.style.position = 'relative';
  container.appendChild(edgeSvgLayer);
}

/**
 * Create an arrow marker for SVG edges
 * @param {string} id - Marker ID
 * @param {string} color - Arrow color
 * @returns {SVGElement} Marker element
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
 * @param {boolean} editMode - Whether edit mode is enabled
 * @returns {Object} vis-network options
 */
function getNetworkOptions(editMode) {
  return {
    layout: {
      hierarchical: {
        enabled: true,
        direction: 'LR', // Left to right for PERT flow
        sortMethod: 'directed', // Follow edge direction for level assignment
        levelSeparation: 250,
        nodeSpacing: 120,
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
        to: {
          enabled: true,
          scaleFactor: 0.8,
          type: 'arrow'
        }
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
      keyboard: {
        enabled: true,
        bindToWindow: false
      },
      zoomView: true,
      dragView: true
    },
    physics: {
      enabled: false // Disable physics for hierarchical layout
    },
    manipulation: editMode ? getManipulationOptions() : false
  };
}

/**
 * Get manipulation options for edit mode
 * @returns {Object} Manipulation options
 */
function getManipulationOptions() {
  return {
    enabled: true,
    initiallyActive: true, // Show manipulation toolbar when edit mode is active
    addNode: false, // Don't allow adding nodes (tasks come from project data)
    deleteNode: false, // Don't allow deleting nodes
    addEdge: function(edgeData, callback) {
      // Validate edge before adding
      if (edgeData.from === edgeData.to) {
        // Can't connect node to itself
        callback(null);
        return;
      }

      // Check if edge already exists
      const existingEdges = edgesDataSet.get({
        filter: e => e.from === edgeData.from && e.to === edgeData.to
      });
      if (existingEdges.length > 0) {
        callback(null);
        return;
      }

      // Check for reverse edge (would create simple cycle)
      const reverseEdges = edgesDataSet.get({
        filter: e => e.from === edgeData.to && e.to === edgeData.from
      });
      if (reverseEdges.length > 0) {
        callback(null);
        return;
      }

      // Check if adding this edge would create a cycle
      if (wouldCreateCycle(edgeData.from, edgeData.to)) {
        callback(null);
        return;
      }

      // Call the callback to notify app
      if (callbacks.onEdgeAdd) {
        callbacks.onEdgeAdd(edgeData.from, edgeData.to);
      }

      // Don't add to vis-network directly - let the app handle it
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
      // Don't delete from vis-network directly - let the app handle it
      callback(null);
    },
    controlNodeStyle: {
      shape: 'dot',
      size: 6,
      color: {
        background: COLORS.accent,
        border: COLORS.accentBright
      },
      borderWidth: 2
    }
  };
}

/**
 * Check if adding an edge would create a cycle
 * @param {string} fromId - Source node ID
 * @param {string} toId - Target node ID
 * @returns {boolean} True if adding this edge would create a cycle
 */
function wouldCreateCycle(fromId, toId) {
  // Check if toId can reach fromId (which would mean adding fromId -> toId creates a cycle)
  const visited = new Set();
  const stack = [toId];

  while (stack.length > 0) {
    const current = stack.pop();
    if (current === fromId) return true;

    if (!visited.has(current)) {
      visited.add(current);

      // Get all edges from current node
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
 * Set up event handlers for the network
 */
function setupEventHandlers() {
  // Node selection
  network.on('selectNode', function(params) {
    if (params.nodes.length > 0 && callbacks.onNodeSelect) {
      callbacks.onNodeSelect(params.nodes[0]);
    }
  });

  // Node deselection
  network.on('deselectNode', function(params) {
    if (callbacks.onNodeSelect) {
      callbacks.onNodeSelect(null);
    }
  });

  // Double click on node
  network.on('doubleClick', function(params) {
    if (params.nodes.length > 0 && callbacks.onNodeDoubleClick) {
      callbacks.onNodeDoubleClick(params.nodes[0]);
    }
  });

  // Click on edge (for reversal in edit mode)
  network.on('selectEdge', function(params) {
    // Edge selection is handled separately if needed
  });
}

/**
 * Update the network with new PERT data
 * Uses vis-network for layout, SVG for orthogonal edge rendering
 * @param {Object} pertResults - PERT analysis results
 * @param {Set} criticalPathSet - Set of node IDs on critical path
 * @param {Object} options - Options { fitView: boolean }
 */
export function updateNetwork(pertResults, criticalPathSet, options = {}) {
  const { fitView = true } = options;
  if (!network || !pertResults || !pertResults.graph) {
    // Clear the network
    nodesDataSet.clear();
    edgesDataSet.clear();
    clearSvgEdges();
    return;
  }

  const { graph } = pertResults;

  // Track critical edges for rendering
  criticalEdges.clear();

  // Build nodes array
  const nodes = [];
  graph.nodes.forEach((node, id) => {
    const isCritical = criticalPathSet.has(id);
    const isComplete = node.isComplete;

    // Build multi-line label with PERT values
    const label = buildNodeLabel(node);

    nodes.push({
      id: id,
      label: label,
      title: buildNodeTooltip(node), // Tooltip on hover
      color: getNodeColor(isCritical, isComplete),
      font: {
        multi: 'html'
      },
      // Store original data for reference
      nodeData: node
    });
  });

  // Build edges array (hidden - we use SVG for orthogonal edges)
  const edges = [];
  graph.adjacency.forEach((successors, fromId) => {
    successors.forEach(toId => {
      const edgeId = `${fromId}->${toId}`;
      const isCritical = criticalPathSet.has(fromId) && criticalPathSet.has(toId);

      if (isCritical) {
        criticalEdges.add(edgeId);
      }

      edges.push({
        id: edgeId,
        from: fromId,
        to: toId,
        hidden: true, // Hide vis-network edges - we use SVG
        color: { color: 'transparent' },
        width: 0
      });
    });
  });

  // Update datasets
  nodesDataSet.clear();
  nodesDataSet.add(nodes);

  edgesDataSet.clear();
  edgesDataSet.add(edges);

  // Render SVG edges after vis-network positions nodes
  setTimeout(() => {
    renderSvgEdges();
  }, 100);

  // Fit the view after update (only on initial load or when requested)
  if (fitView) {
    setTimeout(() => {
      if (network) {
        network.fit({
          animation: {
            duration: 300,
            easingFunction: 'easeInOutQuad'
          }
        });
      }
    }, 200);
  }
}

/**
 * Clear all SVG edges
 */
function clearSvgEdges() {
  if (!edgeSvgLayer) return;

  // Remove all path elements (keep defs)
  const paths = edgeSvgLayer.querySelectorAll('path.edge-path');
  paths.forEach(p => p.remove());
}

/**
 * Render orthogonal edges using SVG
 * Uses actual vis-network node positions to compute routes
 */
function renderSvgEdges() {
  if (!edgeSvgLayer || !network || !edgesDataSet) return;

  // Clear existing edges
  clearSvgEdges();

  // Get all edges
  const edges = edgesDataSet.get();
  if (!edges || edges.length === 0) return;

  // Node dimensions
  const nodeWidth = 180;
  const nodeHeight = 100;

  edges.forEach(edge => {
    const fromPos = network.getPosition(edge.from);
    const toPos = network.getPosition(edge.to);

    if (!fromPos || !toPos) return;

    const isCritical = criticalEdges.has(edge.id);

    // Convert to DOM coordinates
    const fromDOM = network.canvasToDOM(fromPos);
    const toDOM = network.canvasToDOM(toPos);

    // Calculate node boundaries in DOM space
    const scale = network.getScale();
    const halfWidth = (nodeWidth / 2) * scale;
    const halfHeight = (nodeHeight / 2) * scale;

    // Calculate orthogonal route points
    // Start from right edge of source node
    const startX = fromDOM.x + halfWidth;
    const startY = fromDOM.y;

    // End at left edge of target node
    const endX = toDOM.x - halfWidth;
    const endY = toDOM.y;

    // Calculate midpoint for the bend
    const midX = (startX + endX) / 2;

    // Create orthogonal path (horizontal -> vertical -> horizontal)
    const points = [
      { x: startX, y: startY },
      { x: midX, y: startY },
      { x: midX, y: endY },
      { x: endX, y: endY }
    ];

    // If nodes are on same row, simplify to straight line
    if (Math.abs(startY - endY) < 5) {
      points.length = 0;
      points.push({ x: startX, y: startY });
      points.push({ x: endX, y: endY });
    }

    // Generate SVG path
    const pathD = generateSVGPath(points);

    // Create path element
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('class', 'edge-path');
    path.setAttribute('d', pathD);
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', isCritical ? COLORS.accent : COLORS.textMuted);
    path.setAttribute('stroke-width', isCritical ? '2.5' : '1.5');
    path.setAttribute('marker-end', `url(#${isCritical ? 'arrow-critical' : 'arrow-normal'})`);
    path.setAttribute('data-edge-id', edge.id);

    edgeSvgLayer.appendChild(path);
  });
}

/**
 * Update SVG edge positions when view changes (zoom/pan)
 */
function updateSvgEdgePositions() {
  if (!edgeSvgLayer || !network || !edgesDataSet) return;

  // Re-render edges with new view transformation
  renderSvgEdges();
}

/**
 * Add a single edge to the network (incremental update)
 * @param {string} fromId - Source node ID
 * @param {string} toId - Target node ID
 * @param {boolean} isCritical - Whether this edge is on the critical path
 */
export function addEdgeToNetwork(fromId, toId, isCritical = false) {
  if (!edgesDataSet) return;

  const edgeId = `${fromId}->${toId}`;

  // Check if edge already exists
  if (edgesDataSet.get(edgeId)) return;

  edgesDataSet.add({
    id: edgeId,
    from: fromId,
    to: toId,
    color: {
      color: isCritical ? COLORS.accent : COLORS.textMuted,
      highlight: COLORS.accentBright,
      hover: COLORS.textSecondary
    },
    width: isCritical ? 2.5 : 1.5
  });
}

/**
 * Remove a single edge from the network (incremental update)
 * @param {string} fromId - Source node ID
 * @param {string} toId - Target node ID
 */
export function removeEdgeFromNetwork(fromId, toId) {
  if (!edgesDataSet) return;

  const edgeId = `${fromId}->${toId}`;
  edgesDataSet.remove(edgeId);
}

/**
 * Update all nodes' labels and colors after PERT recalculation
 * This preserves the network structure and manipulation state
 * @param {Object} pertResults - PERT analysis results
 * @param {Set} criticalPathSet - Set of node IDs on critical path
 */
export function updateNodesAppearance(pertResults, criticalPathSet) {
  if (!nodesDataSet || !pertResults || !pertResults.graph) return;

  const updates = [];

  pertResults.graph.nodes.forEach((node, id) => {
    const isCritical = criticalPathSet.has(id);
    const isComplete = node.isComplete;

    updates.push({
      id: id,
      label: buildNodeLabel(node),
      title: buildNodeTooltip(node),
      color: getNodeColor(isCritical, isComplete),
      nodeData: node
    });
  });

  // Batch update all nodes
  nodesDataSet.update(updates);
}

/**
 * Update all edges' colors after PERT recalculation (critical path may change)
 * @param {Object} pertResults - PERT analysis results
 * @param {Set} criticalPathSet - Set of node IDs on critical path
 */
export function updateEdgesAppearance(pertResults, criticalPathSet) {
  if (!edgesDataSet || !pertResults || !pertResults.graph) return;

  const updates = [];

  pertResults.graph.adjacency.forEach((successors, fromId) => {
    successors.forEach(toId => {
      const edgeId = `${fromId}->${toId}`;
      const isCritical = criticalPathSet.has(fromId) && criticalPathSet.has(toId);

      updates.push({
        id: edgeId,
        color: {
          color: isCritical ? COLORS.accent : COLORS.textMuted,
          highlight: COLORS.accentBright,
          hover: COLORS.textSecondary
        },
        width: isCritical ? 2.5 : 1.5
      });
    });
  });

  // Batch update all edges
  edgesDataSet.update(updates);
}

/**
 * Check if the network has any nodes
 * @returns {boolean}
 */
export function hasNodes() {
  return nodesDataSet && nodesDataSet.length > 0;
}

/**
 * Build the node label with PERT values
 * @param {Object} node - Node data
 * @returns {string} Formatted label
 */
function buildNodeLabel(node) {
  const name = truncateText(node.name, 20);
  return `<b>${name}</b>\n` +
         `ES: ${node.es}  EF: ${node.ef}\n` +
         `LS: ${node.ls}  LF: ${node.lf}\n` +
         `${node.duration}w | Slack: ${node.slack}`;
}

/**
 * Build tooltip content for a node
 * @param {Object} node - Node data
 * @returns {string} Tooltip HTML
 */
function buildNodeTooltip(node) {
  return `<div style="font-family: JetBrains Mono, monospace; font-size: 12px; padding: 8px;">
    <strong>${node.name}</strong><br>
    Duration: ${node.duration} week(s)<br>
    Early Start: ${node.es} | Early Finish: ${node.ef}<br>
    Late Start: ${node.ls} | Late Finish: ${node.lf}<br>
    Slack: ${node.slack}${node.slack === 0 ? ' (Critical Path)' : ''}
  </div>`;
}

/**
 * Get node color based on state
 * @param {boolean} isCritical - Whether node is on critical path
 * @param {boolean} isComplete - Whether node is complete
 * @returns {Object} Color configuration
 */
function getNodeColor(isCritical, isComplete) {
  if (isComplete) {
    return {
      background: '#1a2e1a',
      border: COLORS.statusSuccess,
      highlight: {
        background: '#1a3a1a',
        border: COLORS.statusSuccess
      },
      hover: {
        background: '#1a3a1a',
        border: COLORS.statusSuccess
      }
    };
  }

  if (isCritical) {
    return {
      background: '#1f1a2e',
      border: COLORS.accent,
      highlight: {
        background: '#2a1f3a',
        border: COLORS.accentBright
      },
      hover: {
        background: '#2a1f3a',
        border: COLORS.accent
      }
    };
  }

  return {
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
  };
}

/**
 * Enable or disable edit mode
 * @param {boolean} enabled - Whether edit mode is enabled
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
  // Must enable edit mode first, then enter add edge mode
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
 * Check if network is in edge drawing mode
 * @returns {boolean}
 */
export function isDrawingEdge() {
  // vis-network doesn't expose this directly, so we track it in the app
  return false;
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
 * @param {string|null} nodeId - Node ID to select, or null to deselect
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
 * @returns {Object} vis.Network instance
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

  // Clean up SVG layer
  if (edgeSvgLayer) {
    edgeSvgLayer.remove();
    edgeSvgLayer = null;
  }

  criticalEdges.clear();
  networkContainer = null;
}

/**
 * Export the network as PNG
 * Renders at full resolution by temporarily resizing the container
 * Captures both canvas nodes and SVG edges
 * @param {number} padding - Padding around the network in pixels (default 100)
 * @returns {Promise<string>} Data URL of the PNG
 */
export function exportToPNG(padding = 100) {
  return new Promise((resolve, reject) => {
    if (!network) {
      reject(new Error('Network not initialized'));
      return;
    }

    // Get all node positions to calculate bounding box
    const positions = network.getPositions();
    const nodeIds = Object.keys(positions);

    if (nodeIds.length === 0) {
      reject(new Error('No nodes to export'));
      return;
    }

    // Calculate bounding box of all nodes in network coordinates
    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;

    // Node size (matches the node options in getNetworkOptions)
    const nodeWidth = 180;
    const nodeHeight = 100;

    nodeIds.forEach(id => {
      const pos = positions[id];
      minX = Math.min(minX, pos.x - nodeWidth / 2);
      maxX = Math.max(maxX, pos.x + nodeWidth / 2);
      minY = Math.min(minY, pos.y - nodeHeight / 2);
      maxY = Math.max(maxY, pos.y + nodeHeight / 2);
    });

    // Calculate content dimensions in network coordinates
    const contentWidth = maxX - minX;
    const contentHeight = maxY - minY;
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    // Save current view state
    const currentScale = network.getScale();
    const currentPosition = network.getViewPosition();

    // Get the container
    const container = network.body.container;
    const originalWidth = container.style.width;
    const originalHeight = container.style.height;
    const originalOverflow = container.style.overflow;
    const originalPosition = container.style.position;

    // Calculate export size at 1:1 scale (network coords = pixels) plus padding
    // Use 2x for high DPI quality
    const hiDpiScale = 2;
    const exportWidth = (contentWidth + padding * 2) * hiDpiScale;
    const exportHeight = (contentHeight + padding * 2) * hiDpiScale;

    // Temporarily resize container to fit content at 1:1 scale
    // This makes vis-network render text at full size
    container.style.position = 'absolute';
    container.style.width = `${exportWidth / hiDpiScale}px`;
    container.style.height = `${exportHeight / hiDpiScale}px`;
    container.style.overflow = 'hidden';

    // Force network to resize to new container
    network.setSize(`${exportWidth / hiDpiScale}px`, `${exportHeight / hiDpiScale}px`);

    // Set view to show all content at 1:1 scale centered
    network.moveTo({
      position: { x: centerX, y: centerY },
      scale: 1.0,
      animation: false
    });

    // Capture after resize and render completes
    const captureHighRes = async () => {
      try {
        // Find the canvas element
        let sourceCanvas = null;

        if (network.canvas && network.canvas.frame && network.canvas.frame.canvas) {
          sourceCanvas = network.canvas.frame.canvas;
        }

        if (!sourceCanvas) {
          sourceCanvas = container.querySelector('canvas');
        }

        if (!sourceCanvas) {
          throw new Error('Canvas not found');
        }

        // Get the source canvas (may have devicePixelRatio scaling)
        const srcWidth = sourceCanvas.width;
        const srcHeight = sourceCanvas.height;

        // Create export canvas
        const exportCanvas = document.createElement('canvas');
        const ctx = exportCanvas.getContext('2d');
        exportCanvas.width = srcWidth;
        exportCanvas.height = srcHeight;

        // Fill background
        ctx.fillStyle = COLORS.bgPrimary;
        ctx.fillRect(0, 0, srcWidth, srcHeight);

        // Draw the source canvas (nodes only, at high resolution)
        ctx.drawImage(sourceCanvas, 0, 0);

        // Now draw SVG edges on top
        if (edgeSvgLayer && Object.keys(edgeRoutes).length > 0) {
          await drawSvgEdgesToCanvas(ctx, srcWidth, srcHeight);
        }

        // Restore container size
        container.style.width = originalWidth;
        container.style.height = originalHeight;
        container.style.overflow = originalOverflow;
        container.style.position = originalPosition;

        // Force network to resize back
        network.setSize(originalWidth, originalHeight);

        // Restore original view
        network.moveTo({
          position: currentPosition,
          scale: currentScale,
          animation: false
        });

        // Redraw at original size
        network.redraw();

        // Re-render SVG edges for current view
        renderSvgEdges();

        resolve(exportCanvas.toDataURL('image/png'));
      } catch (err) {
        // Restore container on error
        container.style.width = originalWidth;
        container.style.height = originalHeight;
        container.style.overflow = originalOverflow;
        container.style.position = originalPosition;
        network.setSize(originalWidth, originalHeight);
        network.moveTo({
          position: currentPosition,
          scale: currentScale,
          animation: false
        });
        reject(err);
      }
    };

    // Wait for resize and redraw to complete
    setTimeout(() => {
      network.redraw();
      // Re-render SVG edges for the export view
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
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {number} width - Canvas width
 * @param {number} height - Canvas height
 */
async function drawSvgEdgesToCanvas(ctx, width, height) {
  if (!edgeSvgLayer) return;

  // Clone the SVG for modification
  const svgClone = edgeSvgLayer.cloneNode(true);
  svgClone.setAttribute('width', width);
  svgClone.setAttribute('height', height);

  // Serialize SVG to string
  const serializer = new XMLSerializer();
  let svgString = serializer.serializeToString(svgClone);

  // Create a blob and image
  const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);
      resolve();
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      // Don't reject - just skip SVG edges
      console.warn('Could not render SVG edges to PNG');
      resolve();
    };
    img.src = url;
  });
}

/**
 * Truncate text with ellipsis
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum length
 * @returns {string} Truncated text
 */
function truncateText(text, maxLength) {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 1) + '...';
}
