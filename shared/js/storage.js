/**
 * Storage Module - localStorage save/load utilities
 * Generic storage operations for any tool
 */

/**
 * Save data to localStorage
 * @param {string} key - Storage key
 * @param {Object} data - Data to save
 */
export function saveToStorage(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
    return true;
  } catch (e) {
    console.error('Failed to save to localStorage:', e);
    return false;
  }
}

/**
 * Load data from localStorage
 * @param {string} key - Storage key
 * @returns {Object|null} - Parsed data or null
 */
export function loadFromStorage(key) {
  try {
    const saved = localStorage.getItem(key);
    if (saved) {
      return JSON.parse(saved);
    }
    return null;
  } catch (e) {
    console.error('Failed to load from localStorage:', e);
    return null;
  }
}

/**
 * Remove data from localStorage
 * @param {string} key - Storage key
 */
export function removeFromStorage(key) {
  try {
    localStorage.removeItem(key);
    return true;
  } catch (e) {
    console.error('Failed to remove from localStorage:', e);
    return false;
  }
}

/**
 * Check if key exists in localStorage
 * @param {string} key - Storage key
 * @returns {boolean}
 */
export function hasStorageKey(key) {
  return localStorage.getItem(key) !== null;
}
