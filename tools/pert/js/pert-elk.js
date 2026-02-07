/**
 * PERT ELK Layout Module
 * Uses ELK.js for orthogonal edge routing
 */

// ELK instance (loaded globally from CDN)
let elk = null;

/**
 * Initialize ELK
 */
export function initELK() {
  if (typeof ELK !== 'undefined') {
    elk = new ELK();
    console.log('ELK.js initialized');
    return true;
  }
  console.error('ELK.js not loaded');
  return false;
}

/**
 * Convert PERT graph data to ELK format
 * @param {Array} nodes - Array of node objects with id, label, width, height
 * @param {Array} edges - Array of edge objects with id, source, target
 * @returns {Object} ELK graph format
 */
export function convertToELKGraph(nodes, edges) {
  return {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'RIGHT',
      'elk.edgeRouting': 'ORTHOGONAL',
      // Node spacing
      'elk.layered.spacing.nodeNodeBetweenLayers': '150',
      'elk.spacing.nodeNode': '80',
      // Edge spacing - ensure edges don't overlap and stay parallel
      'elk.spacing.edgeNode': '40',
      'elk.spacing.edgeEdge': '25',
      'elk.layered.spacing.edgeNodeBetweenLayers': '40',
      'elk.layered.spacing.edgeEdgeBetweenLayers': '25',
      // Layout strategies
      'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
      'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
      'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
      // Keep edges separate, don't merge
      'elk.layered.mergeEdges': 'false',
      // Remove unnecessary bendpoints for cleaner paths
      'elk.layered.unnecessaryBendpoints': 'false',
      // Ensure proper edge routing
      'elk.layered.edgeRouting.selfLoopDistribution': 'EQUALLY',
      'elk.layered.edgeRouting.splines.mode': 'CONSERVATIVE'
    },
    children: nodes.map(node => ({
      id: node.id,
      width: node.width || 180,
      height: node.height || 100,
      labels: [{ text: node.label || '' }]
    })),
    edges: edges.map(edge => ({
      id: edge.id,
      sources: [edge.source],
      targets: [edge.target]
    }))
  };
}

/**
 * Run ELK layout on the graph
 * @param {Object} elkGraph - Graph in ELK format
 * @returns {Promise<Object>} Laid out graph with positions and edge routes
 */
export async function runELKLayout(elkGraph) {
  if (!elk) {
    throw new Error('ELK not initialized');
  }

  try {
    const layoutedGraph = await elk.layout(elkGraph);
    return layoutedGraph;
  } catch (err) {
    console.error('ELK layout failed:', err);
    throw err;
  }
}

/**
 * Extract node positions from ELK result
 * @param {Object} elkResult - ELK layout result
 * @returns {Object} Map of nodeId -> {x, y}
 */
export function extractNodePositions(elkResult) {
  const positions = {};

  if (elkResult.children) {
    elkResult.children.forEach(child => {
      // ELK gives top-left corner, convert to center for vis-network
      positions[child.id] = {
        x: child.x + (child.width / 2),
        y: child.y + (child.height / 2)
      };
    });
  }

  return positions;
}

/**
 * Extract edge routes (bend points) from ELK result
 * @param {Object} elkResult - ELK layout result
 * @param {Object} nodePositions - Node positions for reference
 * @returns {Object} Map of edgeId -> array of {x, y} points
 */
export function extractEdgeRoutes(elkResult, nodePositions) {
  const routes = {};

  if (elkResult.edges) {
    elkResult.edges.forEach(edge => {
      const points = [];

      // ELK provides sections with start, bend points, and end
      if (edge.sections && edge.sections.length > 0) {
        edge.sections.forEach(section => {
          // Start point (from node edge)
          if (section.startPoint) {
            points.push({ x: section.startPoint.x, y: section.startPoint.y });
          }

          // Bend points (the orthogonal routing)
          if (section.bendPoints) {
            section.bendPoints.forEach(bp => {
              points.push({ x: bp.x, y: bp.y });
            });
          }

          // End point (to node edge)
          if (section.endPoint) {
            points.push({ x: section.endPoint.x, y: section.endPoint.y });
          }
        });
      } else {
        // Fallback: compute from node positions if no sections
        const sourceId = edge.sources[0];
        const targetId = edge.targets[0];
        const sourceNode = elkResult.children?.find(c => c.id === sourceId);
        const targetNode = elkResult.children?.find(c => c.id === targetId);

        if (sourceNode && targetNode) {
          points.push({
            x: sourceNode.x + sourceNode.width,
            y: sourceNode.y + sourceNode.height / 2
          });
          points.push({
            x: targetNode.x,
            y: targetNode.y + targetNode.height / 2
          });
        }
      }

      if (points.length >= 2) {
        routes[edge.id] = points;
      }
    });
  }

  return routes;
}

/**
 * Generate SVG path string from edge route points
 * @param {Array} points - Array of {x, y} points
 * @returns {string} SVG path d attribute
 */
export function generateSVGPath(points) {
  if (!points || points.length < 2) return '';

  let path = `M ${points[0].x} ${points[0].y}`;

  for (let i = 1; i < points.length; i++) {
    path += ` L ${points[i].x} ${points[i].y}`;
  }

  return path;
}

/**
 * Check if ELK is available
 * @returns {boolean}
 */
export function isELKAvailable() {
  return elk !== null;
}
