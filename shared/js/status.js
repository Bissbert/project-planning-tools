/**
 * Status Module - Status message display
 * Shows temporary status messages to the user
 */

let statusElement = null;
let statusTimeout = null;
const DEFAULT_DURATION = 2000;
const DEFAULT_READY_TEXT = 'Ready';

/**
 * Initialize the status display
 * @param {string} elementId - ID of the status element
 * @param {Object} options - Configuration options
 * @param {string} options.readyText - Text to show when ready (default: 'Ready')
 */
export function initStatus(elementId, options = {}) {
  statusElement = document.getElementById(elementId);
  if (!statusElement) {
    console.warn(`Status element with ID "${elementId}" not found`);
  }
  return {
    show: (message, success) => showStatus(message, success, options),
    clear: () => clearStatus(options)
  };
}

/**
 * Show a status message
 * @param {string} message - Message to display
 * @param {boolean} success - Whether this is a success message
 * @param {Object} options - Configuration options
 * @param {number} options.duration - How long to show the message (default: 2000ms)
 * @param {string} options.readyText - Text to show when ready (default: 'Ready')
 */
export function showStatus(message, success = false, options = {}) {
  if (!statusElement) return;

  const duration = options.duration || DEFAULT_DURATION;
  const readyText = options.readyText || DEFAULT_READY_TEXT;

  // Clear any existing timeout
  if (statusTimeout) {
    clearTimeout(statusTimeout);
  }

  // Update status element
  statusElement.textContent = message;
  statusElement.className = success ? 'status status--saved' : 'status';

  // Reset after duration
  statusTimeout = setTimeout(() => {
    statusElement.textContent = readyText;
    statusElement.className = 'status';
  }, duration);
}

/**
 * Clear the status message immediately
 * @param {Object} options - Configuration options
 * @param {string} options.readyText - Text to show when ready (default: 'Ready')
 */
export function clearStatus(options = {}) {
  if (!statusElement) return;

  const readyText = options.readyText || DEFAULT_READY_TEXT;

  if (statusTimeout) {
    clearTimeout(statusTimeout);
  }

  statusElement.textContent = readyText;
  statusElement.className = 'status';
}

/**
 * Create a standalone status manager
 * @param {string} elementId - ID of the status element
 * @param {Object} options - Configuration options
 * @returns {Object} - Status manager with show and clear methods
 */
export function createStatusManager(elementId, options = {}) {
  const element = document.getElementById(elementId);
  if (!element) {
    console.warn(`Status element with ID "${elementId}" not found`);
    return {
      show: () => {},
      clear: () => {}
    };
  }

  let timeout = null;
  const duration = options.duration || DEFAULT_DURATION;
  const readyText = options.readyText || DEFAULT_READY_TEXT;

  return {
    show(message, success = false) {
      if (timeout) clearTimeout(timeout);
      element.textContent = message;
      element.className = success ? 'status status--saved' : 'status';
      timeout = setTimeout(() => {
        element.textContent = readyText;
        element.className = 'status';
      }, duration);
    },
    clear() {
      if (timeout) clearTimeout(timeout);
      element.textContent = readyText;
      element.className = 'status';
    }
  };
}
