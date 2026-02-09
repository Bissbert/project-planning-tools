/**
 * Export Dropdown Module - Shared export button dropdown component
 * Consolidates multiple export buttons into a single dropdown menu
 *
 * Usage: Add a container with data-exports attribute:
 *   <div class="export-dropdown" data-exports="json,excel,pdf"></div>
 *
 * The module will automatically populate the dropdown based on the export types.
 */

// Export type definitions - maps type to label and handler function name
const EXPORT_TYPES = {
  json: { label: 'JSON', handler: 'exportToJSON' },
  excel: { label: 'Excel', handler: 'exportToExcel' },
  pdf: { label: 'PDF', handler: 'exportToPDF' },
  png: { label: 'PNG', handler: ['exportToPNG', 'exportChart'] }, // PERT uses exportToPNG, Burndown uses exportChart
  actions: { label: 'Actions', handler: 'exportActionItems' }
};

// SVG icons
const CHEVRON_ICON = `<svg class="export-dropdown__chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
  <polyline points="6 9 12 15 18 9"/>
</svg>`;

/**
 * Initialize export dropdowns
 * Call this in each tool's init() function
 */
export function initExportDropdown() {
  const dropdowns = document.querySelectorAll('.export-dropdown[data-exports]');

  dropdowns.forEach(dropdown => {
    const exportTypes = dropdown.dataset.exports.split(',').map(t => t.trim());

    // Skip if no export types or only one type (use regular button instead)
    if (exportTypes.length < 2) return;

    // Generate dropdown HTML
    dropdown.innerHTML = generateDropdownHTML(exportTypes);

    // Setup event listeners
    setupDropdownEvents(dropdown);
  });
}

/**
 * Generate the dropdown HTML for given export types
 */
function generateDropdownHTML(exportTypes) {
  const items = exportTypes
    .filter(type => EXPORT_TYPES[type])
    .map(type => {
      const config = EXPORT_TYPES[type];
      return `<button class="export-dropdown__item" data-export-type="${type}" role="menuitem">
        ${config.label}
      </button>`;
    })
    .join('\n');

  return `
    <button class="export-dropdown__trigger" aria-haspopup="true" aria-expanded="false">
      Export
      ${CHEVRON_ICON}
    </button>
    <div class="export-dropdown__menu" role="menu">
      ${items}
    </div>
  `;
}

/**
 * Setup event listeners for a dropdown
 */
function setupDropdownEvents(dropdown) {
  const trigger = dropdown.querySelector('.export-dropdown__trigger');
  const menu = dropdown.querySelector('.export-dropdown__menu');

  if (!trigger || !menu) return;

  // Toggle on click
  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = dropdown.classList.contains('export-dropdown--open');

    // Close all other dropdowns first
    document.querySelectorAll('.export-dropdown--open').forEach(d => {
      if (d !== dropdown) closeDropdown(d);
    });

    if (isOpen) {
      closeDropdown(dropdown);
    } else {
      openDropdown(dropdown);
    }
  });

  // Handle menu item clicks
  menu.addEventListener('click', (e) => {
    const item = e.target.closest('.export-dropdown__item');
    if (!item) return;

    const exportType = item.dataset.exportType;
    if (!exportType) return;

    // Close dropdown
    closeDropdown(dropdown);

    // Call the handler
    callExportHandler(exportType);
  });

  // Close on click outside
  document.addEventListener('click', (e) => {
    if (!dropdown.contains(e.target)) {
      closeDropdown(dropdown);
    }
  });

  // Close on Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && dropdown.classList.contains('export-dropdown--open')) {
      closeDropdown(dropdown);
      trigger.focus();
    }
  });

  // Keyboard navigation within menu
  menu.addEventListener('keydown', (e) => {
    const items = menu.querySelectorAll('.export-dropdown__item');
    const current = document.activeElement;
    const index = Array.from(items).indexOf(current);

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = items[index + 1] || items[0];
      next.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prev = items[index - 1] || items[items.length - 1];
      prev.focus();
    } else if (e.key === 'Home') {
      e.preventDefault();
      items[0].focus();
    } else if (e.key === 'End') {
      e.preventDefault();
      items[items.length - 1].focus();
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      current.click();
    }
  });

  // When trigger is focused and arrow down is pressed, open menu and focus first item
  trigger.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openDropdown(dropdown);
      const firstItem = menu.querySelector('.export-dropdown__item');
      if (firstItem) firstItem.focus();
    }
  });
}

/**
 * Open the dropdown
 */
function openDropdown(dropdown) {
  const trigger = dropdown.querySelector('.export-dropdown__trigger');
  dropdown.classList.add('export-dropdown--open');
  if (trigger) trigger.setAttribute('aria-expanded', 'true');
}

/**
 * Close the dropdown
 */
function closeDropdown(dropdown) {
  const trigger = dropdown.querySelector('.export-dropdown__trigger');
  dropdown.classList.remove('export-dropdown--open');
  if (trigger) trigger.setAttribute('aria-expanded', 'false');
}

/**
 * Call the appropriate export handler function
 */
function callExportHandler(exportType) {
  const config = EXPORT_TYPES[exportType];
  if (!config) return;

  const handlers = Array.isArray(config.handler) ? config.handler : [config.handler];

  // Try each handler until one is found
  for (const handlerName of handlers) {
    if (typeof window[handlerName] === 'function') {
      window[handlerName]();
      return;
    }
  }

  console.warn(`Export handler not found for type: ${exportType}`);
}
