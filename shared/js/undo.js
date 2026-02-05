/**
 * Undo Module - Undo/Redo manager
 * Creates an undo/redo stack for any data type
 */

const DEFAULT_MAX_STATES = 50;

/**
 * Create an undo manager
 * @param {number} maxStates - Maximum number of undo states to keep
 * @returns {Object} - Undo manager with saveState, undo, redo, canUndo, canRedo methods
 */
export function createUndoManager(maxStates = DEFAULT_MAX_STATES) {
  let undoStack = [];
  let redoStack = [];

  return {
    /**
     * Save current state to undo stack
     * @param {Object} state - Current state to save (will be serialized)
     */
    saveState(state) {
      undoStack.push(JSON.stringify(state));
      if (undoStack.length > maxStates) {
        undoStack.shift();
      }
      // Clear redo stack on new action
      redoStack = [];
    },

    /**
     * Undo to previous state
     * @param {Object} currentState - Current state (will be pushed to redo stack)
     * @returns {Object|null} - Previous state or null if nothing to undo
     */
    undo(currentState) {
      if (undoStack.length === 0) {
        return null;
      }
      redoStack.push(JSON.stringify(currentState));
      return JSON.parse(undoStack.pop());
    },

    /**
     * Redo to next state
     * @param {Object} currentState - Current state (will be pushed to undo stack)
     * @returns {Object|null} - Next state or null if nothing to redo
     */
    redo(currentState) {
      if (redoStack.length === 0) {
        return null;
      }
      undoStack.push(JSON.stringify(currentState));
      return JSON.parse(redoStack.pop());
    },

    /**
     * Check if undo is available
     * @returns {boolean}
     */
    canUndo() {
      return undoStack.length > 0;
    },

    /**
     * Check if redo is available
     * @returns {boolean}
     */
    canRedo() {
      return redoStack.length > 0;
    },

    /**
     * Clear all undo/redo history
     */
    clear() {
      undoStack = [];
      redoStack = [];
    },

    /**
     * Get undo stack size
     * @returns {number}
     */
    getUndoCount() {
      return undoStack.length;
    },

    /**
     * Get redo stack size
     * @returns {number}
     */
    getRedoCount() {
      return redoStack.length;
    }
  };
}
