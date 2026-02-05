/**
 * Backup Module - Auto-backup system
 * Creates and manages automatic backups in localStorage
 */

const DEFAULT_MAX_BACKUPS = 10;

/**
 * Create an auto-backup
 * @param {string} backupKey - Storage key for backups
 * @param {Object} data - Data to backup
 * @param {number} maxBackups - Maximum number of backups to keep
 */
export function createBackup(backupKey, data, maxBackups = DEFAULT_MAX_BACKUPS) {
  try {
    const backups = JSON.parse(localStorage.getItem(backupKey) || '[]');
    const timestamp = new Date().toISOString();
    const backup = {
      timestamp,
      data: JSON.stringify(data)
    };

    backups.push(backup);

    // Keep only last maxBackups
    while (backups.length > maxBackups) {
      backups.shift();
    }

    localStorage.setItem(backupKey, JSON.stringify(backups));
    return timestamp;
  } catch (e) {
    console.error('Failed to create backup:', e);
    return null;
  }
}

/**
 * List all backups
 * @param {string} backupKey - Storage key for backups
 * @returns {Array} - Array of backup objects with timestamp and data
 */
export function listBackups(backupKey) {
  try {
    return JSON.parse(localStorage.getItem(backupKey) || '[]');
  } catch (e) {
    console.error('Failed to list backups:', e);
    return [];
  }
}

/**
 * Restore a backup by timestamp
 * @param {string} backupKey - Storage key for backups
 * @param {string} timestamp - Timestamp of backup to restore
 * @returns {Object|null} - Restored data or null
 */
export function restoreBackup(backupKey, timestamp) {
  try {
    const backups = listBackups(backupKey);
    const backup = backups.find(b => b.timestamp === timestamp);
    if (backup) {
      return JSON.parse(backup.data);
    }
    return null;
  } catch (e) {
    console.error('Failed to restore backup:', e);
    return null;
  }
}

/**
 * Get the latest backup
 * @param {string} backupKey - Storage key for backups
 * @returns {Object|null} - Latest backup data or null
 */
export function getLatestBackup(backupKey) {
  const backups = listBackups(backupKey);
  if (backups.length > 0) {
    const latest = backups[backups.length - 1];
    try {
      return JSON.parse(latest.data);
    } catch (e) {
      return null;
    }
  }
  return null;
}

/**
 * Clear all backups
 * @param {string} backupKey - Storage key for backups
 */
export function clearBackups(backupKey) {
  localStorage.removeItem(backupKey);
}
