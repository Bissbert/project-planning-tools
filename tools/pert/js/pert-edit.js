/**
 * PERT Edit Module
 * Edge drawing, reversing, deletion
 */

import { wouldCreateCycle, edgeExists } from './pert-calc.js';
import { calculateGhostEdge } from './pert-layout.js';

/**
 * Create draw mode state manager
 * @returns {Object} - Draw mode state and methods
 */
export function createDrawModeManager() {
  const state = {
    active: false,
    sourceId: null,
    ghostLine: null,
    svgElement: null,
    positions: null,
    onComplete: null,
    onCancel: null
  };

  return {
    getState: () => ({ ...state }),

    /**
     * Start edge drawing mode
     * @param {SVGElement} svg - The SVG element
     * @param {Map} positions - Node positions
     * @param {Function} onComplete - Callback when edge is drawn (sourceId, targetId)
     * @param {Function} onCancel - Callback when drawing is cancelled
     */
    start(svg, positions, onComplete, onCancel) {
      state.active = true;
      state.svgElement = svg;
      state.positions = positions;
      state.onComplete = onComplete;
      state.onCancel = onCancel;

      // Get or create ghost line
      state.ghostLine = svg.querySelector('#ghostEdge');
      if (state.ghostLine) {
        state.ghostLine.style.display = 'none';
      }

      // Add draw mode class to canvas
      const canvas = svg.closest('.diagram-canvas');
      if (canvas) {
        canvas.classList.add('draw-mode');
      }
    },

    /**
     * Stop edge drawing mode
     */
    stop() {
      // Hide ghost line
      if (state.ghostLine) {
        state.ghostLine.style.display = 'none';
      }

      // Remove draw mode class
      if (state.svgElement) {
        const canvas = state.svgElement.closest('.diagram-canvas');
        if (canvas) {
          canvas.classList.remove('draw-mode');
        }
      }

      state.active = false;
      state.sourceId = null;
      state.svgElement = null;
      state.positions = null;
    },

    /**
     * Select source node for edge drawing
     * @param {string} nodeId - Source node ID
     */
    selectSource(nodeId) {
      state.sourceId = nodeId;

      // Show ghost line starting from source
      if (state.ghostLine && state.positions) {
        const sourcePos = state.positions.get(nodeId);
        if (sourcePos) {
          const coords = calculateGhostEdge(sourcePos, sourcePos.x + sourcePos.width + 20, sourcePos.y + sourcePos.height / 2);
          state.ghostLine.setAttribute('x1', coords.x1);
          state.ghostLine.setAttribute('y1', coords.y1);
          state.ghostLine.setAttribute('x2', coords.x2);
          state.ghostLine.setAttribute('y2', coords.y2);
          state.ghostLine.style.display = '';
        }
      }
    },

    /**
     * Update ghost line to follow cursor
     * @param {number} x - Cursor X in SVG coordinates
     * @param {number} y - Cursor Y in SVG coordinates
     */
    updateGhostLine(x, y) {
      if (!state.active || !state.sourceId || !state.ghostLine || !state.positions) return;

      const sourcePos = state.positions.get(state.sourceId);
      if (sourcePos) {
        const coords = calculateGhostEdge(sourcePos, x, y);
        state.ghostLine.setAttribute('x2', coords.x2);
        state.ghostLine.setAttribute('y2', coords.y2);
      }
    },

    /**
     * Complete edge drawing with target node
     * @param {string} targetId - Target node ID
     * @param {Object} graph - Graph for validation
     * @returns {boolean} - True if edge was created
     */
    complete(targetId, graph) {
      if (!state.active || !state.sourceId) return false;

      // Validate
      if (state.sourceId === targetId) {
        this.cancel();
        return false;
      }

      if (edgeExists(graph, state.sourceId, targetId)) {
        this.cancel();
        return false;
      }

      if (wouldCreateCycle(graph, state.sourceId, targetId)) {
        this.cancel();
        return false;
      }

      // Call completion callback
      if (state.onComplete) {
        state.onComplete(state.sourceId, targetId);
      }

      // Reset source but stay in draw mode
      state.sourceId = null;
      if (state.ghostLine) {
        state.ghostLine.style.display = 'none';
      }

      return true;
    },

    /**
     * Cancel current drawing (but stay in draw mode)
     */
    cancelCurrent() {
      state.sourceId = null;
      if (state.ghostLine) {
        state.ghostLine.style.display = 'none';
      }
      if (state.onCancel) {
        state.onCancel();
      }
    },

    /**
     * Exit draw mode completely
     */
    cancel() {
      this.cancelCurrent();
      this.stop();
    }
  };
}

/**
 * Add a dependency between tasks
 * @param {Object} projectData - Project data
 * @param {string} fromId - Predecessor task ID
 * @param {string} toId - Successor task ID
 * @returns {boolean} - True if dependency was added
 */
export function addDependency(projectData, fromId, toId) {
  const task = projectData.tasks.find(t => t.id === toId);
  if (!task) return false;

  // Initialize dependencies array if needed
  if (!task.dependencies) {
    task.dependencies = [];
  }

  // Check if already exists
  if (task.dependencies.includes(fromId)) {
    return false;
  }

  task.dependencies.push(fromId);
  return true;
}

/**
 * Remove a dependency between tasks
 * @param {Object} projectData - Project data
 * @param {string} fromId - Predecessor task ID
 * @param {string} toId - Successor task ID
 * @returns {boolean} - True if dependency was removed
 */
export function removeDependency(projectData, fromId, toId) {
  const task = projectData.tasks.find(t => t.id === toId);
  if (!task || !task.dependencies) return false;

  const index = task.dependencies.indexOf(fromId);
  if (index === -1) return false;

  task.dependencies.splice(index, 1);
  return true;
}

/**
 * Reverse a dependency direction
 * @param {Object} projectData - Project data
 * @param {string} fromId - Current predecessor task ID
 * @param {string} toId - Current successor task ID
 * @returns {boolean} - True if dependency was reversed
 */
export function reverseDependency(projectData, fromId, toId) {
  // First remove the existing dependency
  if (!removeDependency(projectData, fromId, toId)) {
    return false;
  }

  // Then add the reverse dependency
  return addDependency(projectData, toId, fromId);
}

/**
 * Check if adding a dependency would create a cycle
 * @param {Object} projectData - Project data
 * @param {string} fromId - Proposed predecessor task ID
 * @param {string} toId - Proposed successor task ID
 * @returns {boolean} - True if it would create a cycle
 */
export function wouldCreateCycleInData(projectData, fromId, toId) {
  if (fromId === toId) return true;

  // Build a temporary graph to check
  const visited = new Set();
  const stack = [toId];

  while (stack.length > 0) {
    const current = stack.pop();
    if (current === fromId) return true;

    if (!visited.has(current)) {
      visited.add(current);

      // Find successors of current
      projectData.tasks.forEach(task => {
        const deps = task.dependencies || [];
        if (deps.includes(current)) {
          stack.push(task.id);
        }
      });
    }
  }

  return false;
}

/**
 * Get all potential predecessors for a task
 * @param {Object} projectData - Project data
 * @param {string} taskId - Task to find predecessors for
 * @param {Object} graph - Optional pre-built graph
 * @returns {Array} - Array of potential predecessor tasks
 */
export function getPotentialPredecessors(projectData, taskId, graph = null) {
  const task = projectData.tasks.find(t => t.id === taskId);
  if (!task) return [];

  const currentDeps = task.dependencies || [];

  return projectData.tasks.filter(t => {
    // Can't be a predecessor of itself
    if (t.id === taskId) return false;

    // Can't be already a predecessor
    if (currentDeps.includes(t.id)) return false;

    // Can't create a cycle
    if (wouldCreateCycleInData(projectData, t.id, taskId)) return false;

    return true;
  });
}

/**
 * Validate all dependencies in project data
 * Removes any invalid dependencies (missing tasks, cycles)
 * @param {Object} projectData - Project data
 * @returns {number} - Number of invalid dependencies removed
 */
export function validateDependencies(projectData) {
  let removedCount = 0;
  const taskIds = new Set(projectData.tasks.map(t => t.id));

  projectData.tasks.forEach(task => {
    if (!task.dependencies) return;

    // Remove dependencies to non-existent tasks
    const validDeps = task.dependencies.filter(depId => {
      if (!taskIds.has(depId)) {
        removedCount++;
        return false;
      }
      return true;
    });

    task.dependencies = validDeps;
  });

  // TODO: Could also detect and break cycles here

  return removedCount;
}

/**
 * Get tasks that would be affected by removing a dependency
 * @param {Object} graph - Graph structure
 * @param {string} fromId - Predecessor task ID
 * @param {string} toId - Successor task ID
 * @returns {Array} - Array of affected task IDs
 */
export function getAffectedTasks(graph, fromId, toId) {
  // All successors of toId would be affected
  const affected = new Set([toId]);
  const stack = [toId];

  while (stack.length > 0) {
    const current = stack.pop();
    const successors = graph.adjacency.get(current);
    if (successors) {
      successors.forEach(succId => {
        if (!affected.has(succId)) {
          affected.add(succId);
          stack.push(succId);
        }
      });
    }
  }

  return Array.from(affected);
}
