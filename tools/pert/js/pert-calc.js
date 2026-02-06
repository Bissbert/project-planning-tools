/**
 * PERT Calculation Module
 * Implements PERT algorithm: forward pass, backward pass, critical path
 */

/**
 * Build an adjacency list graph from tasks with dependencies
 * @param {Array} tasks - Tasks with dependencies arrays
 * @returns {Object} - Graph structure with nodes and adjacency lists
 */
export function buildGraph(tasks) {
  const graph = {
    nodes: new Map(),      // taskId -> node data
    adjacency: new Map(),  // taskId -> Set of successor taskIds
    reverse: new Map()     // taskId -> Set of predecessor taskIds
  };

  // Create nodes for all tasks
  tasks.forEach(task => {
    const duration = calculateDuration(task);
    graph.nodes.set(task.id, {
      id: task.id,
      name: task.name,
      duration,
      task,
      es: 0,  // Early Start
      ef: 0,  // Early Finish
      ls: 0,  // Late Start
      lf: 0,  // Late Finish
      slack: 0,
      isCritical: false,
      isComplete: task.board?.columnId === 'done'
    });
    graph.adjacency.set(task.id, new Set());
    graph.reverse.set(task.id, new Set());
  });

  // Build adjacency lists from dependencies
  tasks.forEach(task => {
    const deps = task.dependencies || [];
    // Also include milestoneDependencies for milestones
    const milestoneDeps = task.milestoneDependencies || [];
    const allDeps = [...new Set([...deps, ...milestoneDeps])];

    allDeps.forEach(predId => {
      if (graph.nodes.has(predId)) {
        // predId -> task.id (predecessor points to successor)
        graph.adjacency.get(predId).add(task.id);
        graph.reverse.get(task.id).add(predId);
      }
    });
  });

  return graph;
}

/**
 * Calculate task duration in weeks
 * @param {Object} task - Task object
 * @returns {number} - Duration in weeks
 */
export function calculateDuration(task) {
  // Use planned array length as duration
  if (task.planned && task.planned.length > 0) {
    return task.planned.length;
  }
  // Default to 1 week if no planned data
  return 1;
}

/**
 * Get nodes with no predecessors (start nodes)
 * @param {Object} graph - Graph structure
 * @returns {Array} - Array of node IDs with no predecessors
 */
export function getStartNodes(graph) {
  const startNodes = [];
  graph.nodes.forEach((node, id) => {
    if (graph.reverse.get(id).size === 0) {
      startNodes.push(id);
    }
  });
  return startNodes;
}

/**
 * Get nodes with no successors (end nodes)
 * @param {Object} graph - Graph structure
 * @returns {Array} - Array of node IDs with no successors
 */
export function getEndNodes(graph) {
  const endNodes = [];
  graph.nodes.forEach((node, id) => {
    if (graph.adjacency.get(id).size === 0) {
      endNodes.push(id);
    }
  });
  return endNodes;
}

/**
 * Perform topological sort using Kahn's algorithm
 * @param {Object} graph - Graph structure
 * @returns {Array} - Topologically sorted node IDs
 */
export function topologicalSort(graph) {
  const inDegree = new Map();
  const sorted = [];
  const queue = [];

  // Calculate in-degree for each node
  graph.nodes.forEach((node, id) => {
    inDegree.set(id, graph.reverse.get(id).size);
    if (inDegree.get(id) === 0) {
      queue.push(id);
    }
  });

  while (queue.length > 0) {
    const nodeId = queue.shift();
    sorted.push(nodeId);

    graph.adjacency.get(nodeId).forEach(successorId => {
      inDegree.set(successorId, inDegree.get(successorId) - 1);
      if (inDegree.get(successorId) === 0) {
        queue.push(successorId);
      }
    });
  }

  // Check for cycles
  if (sorted.length !== graph.nodes.size) {
    console.warn('Graph contains a cycle - topological sort incomplete');
  }

  return sorted;
}

/**
 * Forward pass: Calculate Early Start (ES) and Early Finish (EF)
 * ES = max(EF of all predecessors), or 0 if no predecessors
 * EF = ES + Duration
 * @param {Object} graph - Graph structure
 */
export function forwardPass(graph) {
  const sorted = topologicalSort(graph);

  sorted.forEach(nodeId => {
    const node = graph.nodes.get(nodeId);
    const predecessors = graph.reverse.get(nodeId);

    if (predecessors.size === 0) {
      // Start node
      node.es = 0;
    } else {
      // ES = max(EF of all predecessors)
      let maxEF = 0;
      predecessors.forEach(predId => {
        const pred = graph.nodes.get(predId);
        if (pred.ef > maxEF) {
          maxEF = pred.ef;
        }
      });
      node.es = maxEF;
    }

    node.ef = node.es + node.duration;
  });
}

/**
 * Backward pass: Calculate Late Start (LS) and Late Finish (LF)
 * LF = min(LS of all successors), or project end if no successors
 * LS = LF - Duration
 * @param {Object} graph - Graph structure
 */
export function backwardPass(graph) {
  const sorted = topologicalSort(graph);
  const reversed = [...sorted].reverse();

  // Find project end time (max EF)
  let projectEnd = 0;
  graph.nodes.forEach(node => {
    if (node.ef > projectEnd) {
      projectEnd = node.ef;
    }
  });

  reversed.forEach(nodeId => {
    const node = graph.nodes.get(nodeId);
    const successors = graph.adjacency.get(nodeId);

    if (successors.size === 0) {
      // End node
      node.lf = projectEnd;
    } else {
      // LF = min(LS of all successors)
      let minLS = Infinity;
      successors.forEach(succId => {
        const succ = graph.nodes.get(succId);
        if (succ.ls < minLS) {
          minLS = succ.ls;
        }
      });
      node.lf = minLS;
    }

    node.ls = node.lf - node.duration;
  });
}

/**
 * Calculate slack and identify critical path
 * Slack = LS - ES (or LF - EF)
 * Critical Path = All tasks where Slack = 0
 * @param {Object} graph - Graph structure
 */
export function calculateSlackAndCriticalPath(graph) {
  graph.nodes.forEach(node => {
    node.slack = node.ls - node.es;
    node.isCritical = node.slack === 0;
  });
}

/**
 * Find all nodes on the critical path
 * @param {Object} graph - Graph structure
 * @returns {Array} - Array of critical node IDs in order
 */
export function findCriticalPath(graph) {
  const criticalNodes = [];

  // Get nodes with zero slack, sorted by ES
  graph.nodes.forEach((node, id) => {
    if (node.isCritical) {
      criticalNodes.push({ id, es: node.es });
    }
  });

  criticalNodes.sort((a, b) => a.es - b.es);
  return criticalNodes.map(n => n.id);
}

/**
 * Calculate total project duration
 * @param {Object} graph - Graph structure
 * @returns {number} - Project duration in weeks
 */
export function calculateProjectDuration(graph) {
  let maxEF = 0;
  graph.nodes.forEach(node => {
    if (node.ef > maxEF) {
      maxEF = node.ef;
    }
  });
  return maxEF;
}

/**
 * Run full PERT analysis on graph
 * @param {Object} graph - Graph structure
 * @returns {Object} - Analysis results
 */
export function runPertAnalysis(graph) {
  // Run forward and backward passes
  forwardPass(graph);
  backwardPass(graph);
  calculateSlackAndCriticalPath(graph);

  // Calculate results
  const criticalPath = findCriticalPath(graph);
  const projectDuration = calculateProjectDuration(graph);
  const criticalCount = criticalPath.length;

  return {
    graph,
    criticalPath,
    projectDuration,
    criticalCount,
    nodeCount: graph.nodes.size
  };
}

/**
 * Check if adding an edge would create a cycle
 * Uses DFS to detect if target is reachable from source
 * @param {Object} graph - Graph structure
 * @param {string} fromId - Source node ID
 * @param {string} toId - Target node ID
 * @returns {boolean} - True if adding edge would create a cycle
 */
export function wouldCreateCycle(graph, fromId, toId) {
  if (fromId === toId) return true;

  // Check if toId can reach fromId (which would mean adding fromId -> toId creates a cycle)
  const visited = new Set();
  const stack = [toId];

  while (stack.length > 0) {
    const current = stack.pop();
    if (current === fromId) return true;

    if (!visited.has(current)) {
      visited.add(current);
      const successors = graph.adjacency.get(current);
      if (successors) {
        successors.forEach(succ => {
          if (!visited.has(succ)) {
            stack.push(succ);
          }
        });
      }
    }
  }

  return false;
}

/**
 * Check if an edge already exists
 * @param {Object} graph - Graph structure
 * @param {string} fromId - Source node ID
 * @param {string} toId - Target node ID
 * @returns {boolean} - True if edge exists
 */
export function edgeExists(graph, fromId, toId) {
  const successors = graph.adjacency.get(fromId);
  return successors && successors.has(toId);
}

/**
 * Get predecessors of a node
 * @param {Object} graph - Graph structure
 * @param {string} nodeId - Node ID
 * @returns {Array} - Array of predecessor node data
 */
export function getPredecessors(graph, nodeId) {
  const predIds = graph.reverse.get(nodeId);
  if (!predIds) return [];

  const predecessors = [];
  predIds.forEach(predId => {
    const node = graph.nodes.get(predId);
    if (node) predecessors.push(node);
  });
  return predecessors;
}

/**
 * Get successors of a node
 * @param {Object} graph - Graph structure
 * @param {string} nodeId - Node ID
 * @returns {Array} - Array of successor node data
 */
export function getSuccessors(graph, nodeId) {
  const succIds = graph.adjacency.get(nodeId);
  if (!succIds) return [];

  const successors = [];
  succIds.forEach(succId => {
    const node = graph.nodes.get(succId);
    if (node) successors.push(node);
  });
  return successors;
}

/**
 * Get all edges in the graph
 * @param {Object} graph - Graph structure
 * @returns {Array} - Array of {from, to, isCritical} objects
 */
export function getAllEdges(graph) {
  const edges = [];

  graph.adjacency.forEach((successors, fromId) => {
    const fromNode = graph.nodes.get(fromId);
    successors.forEach(toId => {
      const toNode = graph.nodes.get(toId);
      edges.push({
        from: fromId,
        to: toId,
        isCritical: fromNode.isCritical && toNode.isCritical && toNode.es === fromNode.ef
      });
    });
  });

  return edges;
}
