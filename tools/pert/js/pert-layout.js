/**
 * PERT Layout Module
 * Node positioning algorithm for network diagram
 */

import { topologicalSort, getStartNodes, getEndNodes } from './pert-calc.js';

// Node dimensions
export const NODE_WIDTH = 160;
export const NODE_HEIGHT = 100;
export const NODE_PADDING = 40;
export const LEVEL_SPACING = 200;
export const ROW_SPACING = 140;

/**
 * Calculate level for each node based on dependency depth
 * Uses longest path from start nodes
 * @param {Object} graph - Graph structure
 * @returns {Map} - nodeId -> level mapping
 */
export function calculateLevels(graph) {
  const levels = new Map();
  const sorted = topologicalSort(graph);

  // Initialize all nodes at level 0
  graph.nodes.forEach((node, id) => {
    levels.set(id, 0);
  });

  // Calculate levels based on predecessors
  sorted.forEach(nodeId => {
    const predecessors = graph.reverse.get(nodeId);
    if (predecessors && predecessors.size > 0) {
      let maxPredLevel = -1;
      predecessors.forEach(predId => {
        const predLevel = levels.get(predId) || 0;
        if (predLevel > maxPredLevel) {
          maxPredLevel = predLevel;
        }
      });
      levels.set(nodeId, maxPredLevel + 1);
    }
  });

  return levels;
}

/**
 * Group nodes by their level
 * @param {Object} graph - Graph structure
 * @param {Map} levels - nodeId -> level mapping
 * @returns {Array} - Array of arrays, each containing node IDs at that level
 */
export function groupByLevel(graph, levels) {
  const maxLevel = Math.max(...levels.values());
  const groups = [];

  for (let i = 0; i <= maxLevel; i++) {
    groups.push([]);
  }

  levels.forEach((level, nodeId) => {
    groups[level].push(nodeId);
  });

  return groups;
}

/**
 * Calculate x,y positions for all nodes
 * @param {Object} graph - Graph structure
 * @param {number} width - Available width
 * @param {number} height - Available height
 * @returns {Map} - nodeId -> {x, y, width, height} mapping
 */
export function positionNodes(graph, width, height) {
  const positions = new Map();
  const levels = calculateLevels(graph);
  const groups = groupByLevel(graph, levels);

  // Calculate total levels
  const numLevels = groups.length;

  // Calculate spacing
  const effectiveWidth = Math.max(width - NODE_PADDING * 2, NODE_WIDTH * numLevels);
  const levelWidth = numLevels > 1 ? effectiveWidth / (numLevels - 1) : effectiveWidth;

  groups.forEach((nodeIds, level) => {
    const numNodes = nodeIds.length;
    const effectiveHeight = Math.max(height - NODE_PADDING * 2, NODE_HEIGHT * numNodes);
    const rowHeight = numNodes > 1 ? effectiveHeight / (numNodes - 1) : effectiveHeight / 2;

    // Sort nodes within level to minimize edge crossings
    const sortedIds = sortNodesInLevel(graph, nodeIds, positions, level);

    sortedIds.forEach((nodeId, index) => {
      // X position based on level
      const x = NODE_PADDING + level * levelWidth;

      // Y position to center nodes in their level
      let y;
      if (numNodes === 1) {
        y = height / 2;
      } else {
        y = NODE_PADDING + index * rowHeight;
      }

      positions.set(nodeId, {
        x,
        y,
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
        level,
        row: index
      });
    });
  });

  return positions;
}

/**
 * Sort nodes within a level to minimize edge crossings
 * Simple heuristic: order by average y position of predecessors
 * @param {Object} graph - Graph structure
 * @param {Array} nodeIds - Node IDs in this level
 * @param {Map} positions - Already calculated positions
 * @param {number} level - Current level
 * @returns {Array} - Sorted node IDs
 */
function sortNodesInLevel(graph, nodeIds, positions, level) {
  if (level === 0 || positions.size === 0) {
    // First level - sort by number of successors (more successors = higher up)
    return nodeIds.sort((a, b) => {
      const aSucc = graph.adjacency.get(a).size;
      const bSucc = graph.adjacency.get(b).size;
      return bSucc - aSucc;
    });
  }

  // Calculate average y position of predecessors for each node
  const avgPredY = new Map();

  nodeIds.forEach(nodeId => {
    const predecessors = graph.reverse.get(nodeId);
    let totalY = 0;
    let count = 0;

    predecessors.forEach(predId => {
      const predPos = positions.get(predId);
      if (predPos) {
        totalY += predPos.y;
        count++;
      }
    });

    avgPredY.set(nodeId, count > 0 ? totalY / count : 0);
  });

  // Sort by average predecessor Y position
  return nodeIds.sort((a, b) => avgPredY.get(a) - avgPredY.get(b));
}

/**
 * Calculate bounding box for all nodes
 * @param {Map} positions - Node positions
 * @returns {Object} - {minX, minY, maxX, maxY, width, height}
 */
export function calculateBounds(positions) {
  let minX = Infinity, minY = Infinity;
  let maxX = -Infinity, maxY = -Infinity;

  positions.forEach(pos => {
    minX = Math.min(minX, pos.x);
    minY = Math.min(minY, pos.y);
    maxX = Math.max(maxX, pos.x + pos.width);
    maxY = Math.max(maxY, pos.y + pos.height);
  });

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY
  };
}

/**
 * Calculate edge path between two nodes
 * Returns SVG path data for a curved edge with arrow
 * @param {Object} fromPos - Source node position
 * @param {Object} toPos - Target node position
 * @returns {Object} - {path, midX, midY} for edge and label position
 */
export function calculateEdgePath(fromPos, toPos) {
  // Start from right edge of source node
  const startX = fromPos.x + fromPos.width;
  const startY = fromPos.y + fromPos.height / 2;

  // End at left edge of target node
  const endX = toPos.x;
  const endY = toPos.y + toPos.height / 2;

  // Control points for bezier curve
  const dx = endX - startX;
  const dy = endY - startY;

  // Use cubic bezier for smooth curves
  const controlOffset = Math.min(Math.abs(dx) * 0.4, 60);
  const cp1x = startX + controlOffset;
  const cp1y = startY;
  const cp2x = endX - controlOffset;
  const cp2y = endY;

  const path = `M ${startX} ${startY} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${endX} ${endY}`;

  // Calculate midpoint for labels
  const midX = (startX + endX) / 2;
  const midY = (startY + endY) / 2;

  return { path, midX, midY, startX, startY, endX, endY };
}

/**
 * Calculate straight line path for ghost edge while drawing
 * @param {Object} fromPos - Source node position
 * @param {number} toX - Target X coordinate
 * @param {number} toY - Target Y coordinate
 * @returns {Object} - {x1, y1, x2, y2}
 */
export function calculateGhostEdge(fromPos, toX, toY) {
  return {
    x1: fromPos.x + fromPos.width,
    y1: fromPos.y + fromPos.height / 2,
    x2: toX,
    y2: toY
  };
}

/**
 * Auto-fit layout to container
 * Returns transform values for SVG viewBox
 * @param {Map} positions - Node positions
 * @param {number} containerWidth - Container width
 * @param {number} containerHeight - Container height
 * @param {number} padding - Padding around diagram
 * @returns {Object} - {scale, translateX, translateY}
 */
export function calculateAutoFit(positions, containerWidth, containerHeight, padding = 40) {
  if (positions.size === 0) {
    return { scale: 1, translateX: 0, translateY: 0 };
  }

  const bounds = calculateBounds(positions);
  const contentWidth = bounds.width + padding * 2;
  const contentHeight = bounds.height + padding * 2;

  // Calculate scale to fit content in container
  const scaleX = containerWidth / contentWidth;
  const scaleY = containerHeight / contentHeight;
  const scale = Math.min(scaleX, scaleY, 1.5); // Max scale of 1.5

  // Calculate translation to center content
  const scaledWidth = contentWidth * scale;
  const scaledHeight = contentHeight * scale;
  const translateX = (containerWidth - scaledWidth) / 2 - bounds.minX * scale + padding * scale;
  const translateY = (containerHeight - scaledHeight) / 2 - bounds.minY * scale + padding * scale;

  return { scale, translateX, translateY };
}

/**
 * Calculate layout for empty diagram with placeholder message
 * @param {number} width - Container width
 * @param {number} height - Container height
 * @returns {Object} - Position data for placeholder
 */
export function calculateEmptyLayout(width, height) {
  return {
    centerX: width / 2,
    centerY: height / 2
  };
}
