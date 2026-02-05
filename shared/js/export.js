/**
 * Export Module - JSON/file download utilities
 * Generic file export and download functionality
 */

/**
 * Download data as a JSON file
 * @param {Object} data - Data to download
 * @param {string} filename - Filename (without extension)
 */
export function downloadJSON(data, filename) {
  const dataStr = JSON.stringify(data, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });
  downloadBlob(blob, `${filename}.json`);
}

/**
 * Download a blob as a file
 * @param {Blob} blob - Blob to download
 * @param {string} filename - Filename with extension
 */
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Download text content as a file
 * @param {string} content - Text content
 * @param {string} filename - Filename with extension
 * @param {string} mimeType - MIME type (default: text/plain)
 */
export function downloadText(content, filename, mimeType = 'text/plain') {
  const blob = new Blob([content], { type: mimeType });
  downloadBlob(blob, filename);
}

/**
 * Read a JSON file from a File object
 * @param {File} file - File object to read
 * @returns {Promise<Object>} - Parsed JSON data
 */
export function readJSONFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        resolve(data);
      } catch (err) {
        reject(new Error('Invalid JSON file: ' + err.message));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

/**
 * Read a text file from a File object
 * @param {File} file - File object to read
 * @returns {Promise<string>} - File content as string
 */
export function readTextFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

/**
 * Create a safe filename from a string
 * @param {string} name - Original name
 * @returns {string} - Safe filename
 */
export function sanitizeFilename(name) {
  return name.replace(/[^a-zA-Z0-9-_]/g, '-').replace(/-+/g, '-');
}

/**
 * Trigger print dialog for PDF export
 * @param {Function} beforePrint - Optional callback before printing
 */
export function triggerPrint(beforePrint) {
  if (beforePrint) {
    beforePrint();
  }
  setTimeout(() => window.print(), 100);
}
