/**
 * PERT vis-network Module
 * Handles vis-network initialization, rendering, and interactions
 * Uses ELK.js for orthogonal edge routing
 */

import {
  initELK,
  convertToELKGraph,
  runELKLayout,
  extractNodePositions,
  extractEdgeRoutes,
  generateSVGPath,
  isELKAvailable
} from './pert-elk.js';

// vis-network instance
let network = null;
let nodesDataSet = null;
let edgesDataSet = null;
let networkContainer = null;
let edgeSvgLayer = null;
let elkEdgeRoutes = {}; // Store ELK edge routes for rendering
let criticalEdges = new Set(); // Track which edges are critical
let isUpdatingNetwork = false; // Guard against edge rendering during updates

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
 * Uses ELK.js for node positioning and orthogonal edge routing
 * Two-phase approach: render nodes first to measure, then run ELK with actual dimensions
 * @param {Object} pertResults - PERT analysis results
 * @param {Set} criticalPathSet - Set of node IDs on critical path
 * @param {Object} options - Options { fitView: boolean }
 */
export async function updateNetwork(pertResults, criticalPathSet, options = {}) {
  const { fitView = true } = options;

  // Set guard to prevent edge rendering during update
  isUpdatingNetwork = true;

  if (!network || !pertResults || !pertResults.graph) {
    // Clear the network
    nodesDataSet.clear();
    edgesDataSet.clear();
    clearSvgEdges();
    elkEdgeRoutes = {};
    isUpdatingNetwork = false;
    return;
  }

  const { graph } = pertResults;

  // Track critical edges for rendering
  criticalEdges.clear();
  elkEdgeRoutes = {};

  // Build nodes array for vis-network
  const nodes = [];
  const nodeIds = [];

  graph.nodes.forEach((node, id) => {
    const isCritical = criticalPathSet.has(id);
    const isComplete = node.isComplete;

    // Build multi-line label with PERT values
    const label = buildNodeLabel(node);

    nodes.push({
      id: id,
      label: label,
      title: buildNodeTooltip(node),
      color: getNodeColor(isCritical, isComplete),
      font: { multi: 'html' },
      nodeData: node
    });

    nodeIds.push(id);
  });

  // Build edges array
  const edges = [];
  const elkEdges = [];

  graph.adjacency.forEach((successors, fromId) => {
    successors.forEach(toId => {
      const edgeId = `${fromId}->${toId}`;
      const isCritical = criticalPathSet.has(fromId) && criticalPathSet.has(toId);

      if (isCritical) {
        criticalEdges.add(edgeId);
      }

      // Hidden vis-network edge (we use SVG for rendering)
      edges.push({
        id: edgeId,
        from: fromId,
        to: toId,
        hidden: true,
        color: { color: 'transparent' },
        width: 0
      });

      // ELK edge (dimensions added after measuring)
      elkEdges.push({
        id: edgeId,
        source: fromId,
        target: toId
      });
    });
  });

  // Phase 1: Add nodes to vis-network so we can measure their actual dimensions
  nodesDataSet.clear();
  nodesDataSet.add(nodes);

  edgesDataSet.clear();
  edgesDataSet.add(edges);

  // Force a redraw so nodes are rendered
  network.redraw();

  // Phase 2: Wait for render, then measure and run ELK with actual dimensions
  await new Promise(resolve => setTimeout(resolve, 50));

  // Measure actual node dimensions from vis-network
  const elkNodes = [];
  const nodeDimensions = {};

  nodeIds.forEach(id => {
    try {
      const bbox = network.getBoundingBox(id);
      if (bbox) {
        const width = Math.ceil(bbox.right - bbox.left);
        const height = Math.ceil(bbox.bottom - bbox.top);
        nodeDimensions[id] = { width, height };
        elkNodes.push({
          id: id,
          label: id,
          width: width,
          height: height
        });
      } else {
        // Fallback if bounding box not available
        nodeDimensions[id] = { width: 180, height: 100 };
        elkNodes.push({
          id: id,
          label: id,
          width: 180,
          height: 100
        });
      }
    } catch (e) {
      // Fallback on error
      nodeDimensions[id] = { width: 180, height: 100 };
      elkNodes.push({
        id: id,
        label: id,
        width: 180,
        height: 100
      });
    }
  });

  // Store dimensions for edge rendering
  window._pertNodeDimensions = nodeDimensions;

  // Phase 3: Run ELK layout with actual node dimensions
  let elkPositions = null;
  if (isELKAvailable() && elkNodes.length > 0 && elkEdges.length > 0) {
    try {
      const elkGraph = convertToELKGraph(elkNodes, elkEdges);
      const elkResult = await runELKLayout(elkGraph);

      // Extract node positions from ELK
      elkPositions = extractNodePositions(elkResult);

      // Extract edge routes from ELK (orthogonal paths that avoid nodes)
      elkEdgeRoutes = extractEdgeRoutes(elkResult, elkPositions);

    } catch (err) {
      console.warn('ELK layout failed, using default layout:', err);
      elkPositions = null;
      elkEdgeRoutes = {};
    }
  }

  // Phase 4: Apply ELK positions and render edges
  if (elkPositions) {
    // Move nodes to ELK positions
    const positionUpdates = Object.entries(elkPositions).map(([nodeId, pos]) => ({
      id: nodeId,
      x: pos.x,
      y: pos.y
    }));
    nodesDataSet.update(positionUpdates);

    // Wait for position update to complete
    await new Promise(resolve => setTimeout(resolve, 50));

    // Clear guard before rendering edges
    isUpdatingNetwork = false;

    // Render SVG edges with ELK routes
    renderSvgEdges();

    // Fit view after positioning
    if (fitView && network) {
      network.fit({
        animation: { duration: 300, easingFunction: 'easeInOutQuad' }
      });
    }
  } else {
    // No ELK - use fallback rendering
    await new Promise(resolve => setTimeout(resolve, 100));

    // Clear guard before rendering edges
    isUpdatingNetwork = false;

    renderSvgEdges();
    if (fitView && network) {
      network.fit({
        animation: { duration: 300, easingFunction: 'easeInOutQuad' }
      });
    }
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
 * Uses ELK edge routes when available, otherwise computes simple orthogonal routes
 */
function renderSvgEdges() {
  if (!edgeSvgLayer || !network || !edgesDataSet || !nodesDataSet) return;

  // Clear existing edges
  clearSvgEdges();

  // Get all edges
  const edges = edgesDataSet.get();
  if (!edges || edges.length === 0) return;

  const hasElkRoutes = Object.keys(elkEdgeRoutes).length > 0;

  edges.forEach(edge => {
    const isCritical = criticalEdges.has(edge.id);
    let points = [];

    if (hasElkRoutes && elkEdgeRoutes[edge.id]) {
      // Use ELK-computed orthogonal routes (transforms network coords to DOM)
      const elkPoints = elkEdgeRoutes[edge.id];
      points = elkPoints.map(p => network.canvasToDOM({ x: p.x, y: p.y }));
    } else {
      // Fallback: compute simple orthogonal route
      // First verify both nodes exist
      const fromNode = nodesDataSet.get(edge.from);
      const toNode = nodesDataSet.get(edge.to);
      if (!fromNode || !toNode) return;

      let fromPos, toPos;
      try {
        fromPos = network.getPosition(edge.from);
        toPos = network.getPosition(edge.to);
      } catch (e) {
        // Node position not available yet
        return;
      }

      if (!fromPos || !toPos) return;

      const fromDOM = network.canvasToDOM(fromPos);
      const toDOM = network.canvasToDOM(toPos);

      const scale = network.getScale();
      const halfWidth = (180 / 2) * scale;

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
  // Skip if we're in the middle of updating the network
  if (isUpdatingNetwork) return;
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

  elkEdgeRoutes = {};
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

    const positions = network.getPositions();
    const nodeIds = Object.keys(positions);

    if (nodeIds.length === 0) {
      reject(new Error('No nodes to export'));
      return;
    }

    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;

    const nodeWidth = 180;
    const nodeHeight = 100;

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
    // Capture actual computed size for restore (inline styles may be empty)
    const computedWidth = container.offsetWidth;
    const computedHeight = container.offsetHeight;

    // Calculate export size, respecting browser canvas limits.
    // Browsers cap canvas at ~16384px per dimension and ~268M total pixels.
    // On HiDPI displays, the backing store is CSS size * devicePixelRatio.
    const dpr = window.devicePixelRatio || 1;
    const MAX_CANVAS_DIM = 16384;
    const MAX_CANVAS_AREA = 268435456;

    const desiredCssWidth = contentWidth + padding * 2;
    const desiredCssHeight = contentHeight + padding * 2;
    const backingWidth = desiredCssWidth * dpr;
    const backingHeight = desiredCssHeight * dpr;

    let exportScale = 1.0;

    if (backingWidth > MAX_CANVAS_DIM || backingHeight > MAX_CANVAS_DIM) {
      exportScale = Math.min(
        exportScale,
        MAX_CANVAS_DIM / backingWidth,
        MAX_CANVAS_DIM / backingHeight
      );
    }

    const scaledArea = (backingWidth * exportScale) * (backingHeight * exportScale);
    if (scaledArea > MAX_CANVAS_AREA) {
      exportScale = Math.min(
        exportScale,
        Math.sqrt(MAX_CANVAS_AREA / (backingWidth * backingHeight))
      );
    }

    // Leave a small safety margin
    exportScale *= 0.95;

    const exportCssWidth = Math.floor(desiredCssWidth * exportScale);
    const exportCssHeight = Math.floor(desiredCssHeight * exportScale);

    container.style.position = 'absolute';
    container.style.width = `${exportCssWidth}px`;
    container.style.height = `${exportCssHeight}px`;
    container.style.overflow = 'hidden';

    network.setSize(`${exportCssWidth}px`, `${exportCssHeight}px`);

    network.moveTo({
      position: { x: centerX, y: centerY },
      scale: exportScale,
      animation: false
    });

    const restoreView = () => {
      container.style.width = originalWidth;
      container.style.height = originalHeight;
      container.style.overflow = originalOverflow;
      container.style.position = originalPosition;
      // Use computed dimensions for setSize since inline styles may be empty
      const restoreW = originalWidth || `${computedWidth}px`;
      const restoreH = originalHeight || `${computedHeight}px`;
      network.setSize(restoreW, restoreH);
      network.moveTo({ position: currentPosition, scale: currentScale, animation: false });
      network.redraw();
      renderSvgEdges();
    };

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

        if (srcWidth === 0 || srcHeight === 0) {
          throw new Error('Canvas has zero dimensions — graph too large to export');
        }

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

        restoreView();

        const dataUrl = exportCanvas.toDataURL('image/png');
        if (!dataUrl || dataUrl.length < 100) {
          throw new Error('PNG export produced empty output — graph too large');
        }

        resolve(dataUrl);
      } catch (err) {
        restoreView();
        reject(err);
      }
    };

    // Use longer delays for large graphs to ensure redraw completes
    const isLargeGraph = nodeIds.length > 100;
    const resizeDelay = isLargeGraph ? 200 : 50;
    const captureDelay = isLargeGraph ? 300 : 100;

    setTimeout(() => {
      network.redraw();
      renderSvgEdges();
      setTimeout(() => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            captureHighRes();
          });
        });
      }, captureDelay);
    }, resizeDelay);
  });
}

/**
 * Draw SVG edges directly to canvas for PNG export
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {number} width - Canvas width (hiDPI scaled)
 * @param {number} height - Canvas height (hiDPI scaled)
 */
async function drawSvgEdgesToCanvas(ctx, width, height) {
  if (!edgeSvgLayer) return;

  // Get the original SVG dimensions (DOM container size, before hiDPI scaling)
  const svgRect = edgeSvgLayer.getBoundingClientRect();
  const originalWidth = svgRect.width;
  const originalHeight = svgRect.height;

  // Clone the SVG for modification
  const svgClone = edgeSvgLayer.cloneNode(true);

  // Ensure proper SVG namespace for serialization
  svgClone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  svgClone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');

  // Add viewBox to map original coordinates to export canvas size
  // This scales the SVG content from DOM coordinates to hiDPI canvas coordinates
  svgClone.setAttribute('viewBox', `0 0 ${originalWidth} ${originalHeight}`);
  svgClone.setAttribute('width', width);
  svgClone.setAttribute('height', height);

  // Reset positioning styles so SVG renders from origin
  svgClone.style.cssText = `width: ${width}px; height: ${height}px;`;

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
