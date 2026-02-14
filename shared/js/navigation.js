/**
 * Navigation Module - Tool switcher dropdown
 * Provides inter-tool navigation with keyboard support
 *
 * Usage: Add a nav element with data-current attribute:
 *   <nav class="nav-dropdown" data-current="gantt"></nav>
 *
 * The module will automatically populate the dropdown.
 */

// Tool definitions - add new tools here
const TOOLS = [
  { id: 'gantt', number: '01', label: 'Gantt', path: 'gantt' },
  { id: 'kanban', number: '02', label: 'Kanban', path: 'kanban' },
  { id: 'sprint', number: '03', label: 'Sprint', path: 'sprint' },
  { id: 'time-tracker', number: '04', label: 'Time Tracker', path: 'time-tracker' },
  { id: 'burndown', number: '05', label: 'Burndown', path: 'burndown' },
  { id: 'resource-calendar', number: '06', label: 'Resources', path: 'resource-calendar' },
  { id: 'milestone-tracker', number: '07', label: 'Milestones', path: 'milestone-tracker' },
  { id: 'retrospective', number: '08', label: 'Retro Board', path: 'retrospective' },
  { id: 'pert', number: '09', label: 'PERT Chart', path: 'pert' },
  { id: 'dashboard', number: '10', label: 'Dashboard', path: 'dashboard' },
  { id: 'dependencies', number: '11', label: 'Dependencies', path: 'dependencies' }
];

// SVG icons
const CHEVRON_ICON = `<svg class="nav-dropdown__chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
  <polyline points="6 9 12 15 18 9"/>
</svg>`;

const HOME_ICON = `<svg class="nav-dropdown__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
  <polyline points="9 22 9 12 15 12 15 22"/>
</svg>`;

/**
 * Initialize the navigation dropdown
 * Call this in each tool's init() function
 */
export function initNavigation() {
  const dropdown = document.querySelector('.nav-dropdown');
  if (!dropdown) return;

  const currentToolId = dropdown.dataset.current;
  const currentTool = TOOLS.find(t => t.id === currentToolId) || TOOLS[0];

  // Generate dropdown HTML
  dropdown.innerHTML = generateDropdownHTML(currentTool);

  // Setup event listeners
  const trigger = dropdown.querySelector('.nav-dropdown__trigger');
  const menu = dropdown.querySelector('.nav-dropdown__menu');

  if (!trigger || !menu) return;

  // Toggle on click
  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = dropdown.classList.contains('nav-dropdown--open');
    dropdown.classList.toggle('nav-dropdown--open');
    trigger.setAttribute('aria-expanded', !isOpen);
  });

  // Close on click outside
  document.addEventListener('click', (e) => {
    if (!dropdown.contains(e.target)) {
      closeDropdown(dropdown, trigger);
    }
  });

  // Close on Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && dropdown.classList.contains('nav-dropdown--open')) {
      closeDropdown(dropdown, trigger);
      trigger.focus();
    }
  });

  // Keyboard navigation within menu
  menu.addEventListener('keydown', (e) => {
    const items = menu.querySelectorAll('.nav-dropdown__item');
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
    }
  });

  // When trigger is focused and arrow down is pressed, open menu and focus first item
  trigger.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      dropdown.classList.add('nav-dropdown--open');
      trigger.setAttribute('aria-expanded', 'true');
      const firstItem = menu.querySelector('.nav-dropdown__item');
      if (firstItem) firstItem.focus();
    }
  });
}

/**
 * Generate the dropdown HTML for a given current tool
 */
function generateDropdownHTML(currentTool) {
  const toolItems = TOOLS.map(tool => {
    const isActive = tool.id === currentTool.id;
    const activeClass = isActive ? ' nav-dropdown__item--active' : '';
    const ariaCurrent = isActive ? ' aria-current="page"' : '';

    return `<a href="../${tool.path}/index.html" class="nav-dropdown__item${activeClass}" role="menuitem"${ariaCurrent}>
      <span class="nav-dropdown__number">${tool.number}</span>
      ${tool.label}
    </a>`;
  }).join('\n          ');

  return `
    <button class="nav-dropdown__trigger" aria-haspopup="true" aria-expanded="false">
      <span class="station-badge__number">${currentTool.number}</span>
      <span class="station-badge__label">${currentTool.label}</span>
      ${CHEVRON_ICON}
    </button>
    <div class="nav-dropdown__menu" role="menu">
      <a href="../../index.html" class="nav-dropdown__item" role="menuitem">
        ${HOME_ICON}
        Home
      </a>
      <div class="nav-dropdown__divider"></div>
      ${toolItems}
    </div>
  `;
}

/**
 * Close the dropdown
 */
function closeDropdown(dropdown, trigger) {
  dropdown.classList.remove('nav-dropdown--open');
  trigger.setAttribute('aria-expanded', 'false');
}
