/**
 * Dependencies Edit Module
 * Add/remove dependencies with cycle detection
 */

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

  if (!task.dependencies) {
    task.dependencies = [];
  }

  if (task.dependencies.includes(fromId)) {
    return false;
  }

  // Check for cycle
  if (wouldCreateCycleInData(projectData, fromId, toId)) {
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
 * Check if adding a dependency would create a cycle
 */
function wouldCreateCycleInData(projectData, fromId, toId) {
  if (fromId === toId) return true;

  const visited = new Set();
  const stack = [toId];

  while (stack.length > 0) {
    const current = stack.pop();
    if (current === fromId) return true;

    if (!visited.has(current)) {
      visited.add(current);
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
 */
export function getPotentialPredecessors(projectData, taskId) {
  const task = projectData.tasks.find(t => t.id === taskId);
  if (!task) return [];

  const currentDeps = task.dependencies || [];

  return projectData.tasks.filter(t => {
    if (t.id === taskId) return false;
    if (currentDeps.includes(t.id)) return false;
    if (wouldCreateCycleInData(projectData, t.id, taskId)) return false;
    return true;
  });
}

/**
 * Validate all dependencies in project data
 */
export function validateDependencies(projectData) {
  let removedCount = 0;
  const taskIds = new Set(projectData.tasks.map(t => t.id));

  projectData.tasks.forEach(task => {
    if (!task.dependencies) return;

    const validDeps = task.dependencies.filter(depId => {
      if (!taskIds.has(depId)) {
        removedCount++;
        return false;
      }
      return true;
    });

    task.dependencies = validDeps;
  });

  return removedCount;
}
