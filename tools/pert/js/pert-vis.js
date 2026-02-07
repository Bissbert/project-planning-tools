/**
 * PERT vis-network Module
 * Handles vis-network initialization, rendering, and interactions
 */

// vis-network instance
let network = null;
let nodesDataSet = null;
let edgesDataSet = null;

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

  // Initialize empty data sets
  nodesDataSet = new vis.DataSet([]);
  edgesDataSet = new vis.DataSet([]);

  const data = {
    nodes: nodesDataSet,
    edges: edgesDataSet
  };

  const options = getNetworkOptions(false);

  network = new vis.Network(container, data, options);

  // Expose for debugging
  window._pertNetwork = network;

  // Set up event handlers
  setupEventHandlers();

  return network;
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
      smooth: {
        enabled: true,
        type: 'cubicBezier',
        roundness: 0.5
      },
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
    return;
  }

  const { graph } = pertResults;

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

  // Build edges array
  const edges = [];
  graph.adjacency.forEach((successors, fromId) => {
    successors.forEach(toId => {
      const fromNode = graph.nodes.get(fromId);
      const toNode = graph.nodes.get(toId);
      const isCritical = criticalPathSet.has(fromId) && criticalPathSet.has(toId);

      edges.push({
        id: `${fromId}->${toId}`,
        from: fromId,
        to: toId,
        color: {
          color: isCritical ? COLORS.accent : COLORS.textMuted,
          highlight: COLORS.accentBright,
          hover: COLORS.textSecondary
        },
        width: isCritical ? 2.5 : 1.5
      });
    });
  });

  // Update datasets
  nodesDataSet.clear();
  nodesDataSet.add(nodes);

  edgesDataSet.clear();
  edgesDataSet.add(edges);

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
    }, 100);
  }
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
}

/**
 * Export the network as PNG
 * Captures the full network at high resolution with padding
 * @param {number} scale - Resolution scale factor (default 2 for retina/zoom quality)
 * @param {number} padding - Padding around the network in pixels (default 80)
 * @returns {Promise<string>} Data URL of the PNG
 */
export function exportToPNG(scale = 2, padding = 80) {
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

    // Save current view state
    const currentScale = network.getScale();
    const currentPosition = network.getViewPosition();

    // Get the container
    const container = network.body.container;

    // Fit all nodes in view with some margin
    network.fit({
      nodes: nodeIds,
      animation: false,
      minZoomLevel: 0.1,
      maxZoomLevel: 2
    });

    // Capture after fit completes
    const captureAfterFit = () => {
      try {
        // Find the canvas element
        let sourceCanvas = null;

        // Try the internal path
        if (network.canvas && network.canvas.frame && network.canvas.frame.canvas) {
          sourceCanvas = network.canvas.frame.canvas;
        }

        // Fallback: find canvas in container
        if (!sourceCanvas) {
          sourceCanvas = container.querySelector('canvas');
        }

        if (!sourceCanvas) {
          throw new Error('Canvas not found');
        }

        // Get canvas dimensions
        const srcWidth = sourceCanvas.width;
        const srcHeight = sourceCanvas.height;

        // Calculate export dimensions
        // Add padding scaled appropriately
        const paddingScaled = padding * scale;
        const exportWidth = srcWidth * scale + paddingScaled * 2;
        const exportHeight = srcHeight * scale + paddingScaled * 2;

        // Create the export canvas at high resolution
        const exportCanvas = document.createElement('canvas');
        const ctx = exportCanvas.getContext('2d');
        exportCanvas.width = exportWidth;
        exportCanvas.height = exportHeight;

        // Fill background
        ctx.fillStyle = COLORS.bgPrimary;
        ctx.fillRect(0, 0, exportWidth, exportHeight);

        // Draw the source canvas centered with padding
        // Scale up for high resolution
        ctx.drawImage(
          sourceCanvas,
          0, 0, srcWidth, srcHeight,
          paddingScaled, paddingScaled, srcWidth * scale, srcHeight * scale
        );

        // Restore original view
        network.moveTo({
          position: currentPosition,
          scale: currentScale,
          animation: false
        });

        resolve(exportCanvas.toDataURL('image/png'));
      } catch (err) {
        // Restore view on error
        network.moveTo({
          position: currentPosition,
          scale: currentScale,
          animation: false
        });
        reject(err);
      }
    };

    // Wait for fit and redraw to complete
    // Use multiple frames to ensure rendering is done
    setTimeout(() => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          captureAfterFit();
        });
      });
    }, 50);
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
