# Project Planning Tools

A collection of lightweight, browser-based planning tools that work offline and keep your data local.

## Philosophy

- **Offline-first** - Works without internet; data stays in your browser
- **No build tools** - Plain HTML, CSS, and JavaScript with ES modules
- **Local data** - Uses localStorage; your data never leaves your machine
- **Minimal dependencies** - Only external resource is Google Fonts

## Features

- Browser-based project planning tools
- Data persists in localStorage
- Export to JSON, Excel, and PDF
- Undo/redo support
- Print-friendly layouts
- Dark theme by default

## Design System

**Aesthetic Direction:** Assembly Line
**Color Palette:** Warm Steel (gray-purple)

The UI follows a factory/assembly line visual metaphor with:
- Track lines and conveyor-inspired flow elements
- Numbered stations and progress indicators
- Organized, workflow-oriented layouts
- Modular panel-based components

**Color Palette:**
| Token | Value | Usage |
|-------|-------|-------|
| `--bg-primary` | `#101014` | Main background |
| `--bg-secondary` | `#18181f` | Cards, panels |
| `--bg-tertiary` | `#202028` | Elevated elements |
| `--accent` | `#a78bfa` | Primary accent (soft lavender) |
| `--accent-secondary` | `#7c7c8a` | Secondary (steel purple) |
| `--text-primary` | `#e8e8e8` | Main text |
| `--text-secondary` | `#9898a4` | Muted text |

## Getting Started

ES modules require a local server. The simplest way to run:

```bash
cd project-planning-tools
npx serve .
```

Then open [http://localhost:3000](http://localhost:3000)

Alternatively, use any local server:
- Python: `python -m http.server 3000`
- PHP: `php -S localhost:3000`
- VS Code: Live Server extension

## Project Structure

```
project-planning-tools/
├── index.html              # Landing page with tool links
├── shared/                 # Shared modules for all tools
│   ├── css/
│   │   ├── tokens.css      # Design tokens (colors, spacing)
│   │   ├── base.css        # Base styles and reset
│   │   ├── buttons.css     # Button components
│   │   ├── forms.css       # Form inputs and labels
│   │   ├── modals.css      # Modal dialogs
│   │   ├── status.css      # Status indicators
│   │   └── print.css       # Print-specific styles
│   └── js/
│       ├── storage.js      # localStorage utilities
│       ├── backup.js       # Backup/restore functionality
│       ├── undo.js         # Undo/redo manager
│       ├── export.js       # File download utilities
│       ├── status.js       # Status message display
│       └── navigation.js   # Inter-tool navigation dropdown
└── tools/
    ├── gantt/              # Gantt Chart tool
    │   ├── index.html
    │   ├── css/
    │   │   ├── gantt-layout.css
    │   │   ├── gantt-cells.css
    │   │   ├── gantt-edit.css
    │   │   └── gantt-print.css
    │   └── js/
    │       ├── gantt-app.js
    │       ├── gantt-data.js
    │       ├── gantt-render.js
    │       └── gantt-edit.js
    ├── kanban/             # Kanban Board tool
    │   ├── index.html
    │   ├── css/
    │   │   ├── kanban-layout.css
    │   │   ├── kanban-cards.css
    │   │   ├── kanban-edit.css
    │   │   └── kanban-print.css
    │   └── js/
    │       └── kanban-app.js
    ├── sprint/             # Sprint Planner tool
    │   ├── index.html
    │   ├── css/
    │   │   ├── sprint-layout.css
    │   │   ├── sprint-cards.css
    │   │   ├── sprint-edit.css
    │   │   └── sprint-print.css
    │   └── js/
    │       ├── sprint-app.js
    │       ├── sprint-render.js
    │       └── sprint-edit.js
    ├── burndown/           # Burndown Chart tool
    │   ├── index.html
    │   ├── css/
    │   └── js/
    ├── time-tracker/       # Time Tracker tool
    │   ├── index.html
    │   ├── css/
    │   └── js/
    ├── resource-calendar/  # Resource Calendar tool
    │   ├── index.html
    │   ├── css/
    │   └── js/
    ├── milestone-tracker/  # Milestone Tracker tool
    │   ├── index.html
    │   ├── css/
    │   └── js/
    ├── retrospective/      # Retrospective Board tool
    │   ├── index.html
    │   ├── css/
    │   └── js/
    └── pert/               # PERT Chart tool
        ├── index.html
        ├── css/
        │   ├── pert-layout.css
        │   ├── pert-diagram.css
        │   ├── pert-table.css
        │   └── pert-print.css
        └── js/
            ├── pert-app.js
            ├── pert-calc.js
            ├── pert-render.js
            ├── pert-vis.js
            ├── pert-elk.js
            ├── pert-edit.js
            └── pert-layout.js
```

## Available Tools

### Gantt Chart

Visual project timeline with planned vs. reality tracking.

**Features:**
- Week-by-week scheduling grid
- Planned vs. actual progress comparison
- Variance tracking (ahead/behind schedule)
- Drag-and-drop task management
- Category-based organization with collapse/expand
- Task assignment and priority levels
- Milestone markers
- Search and filter tasks
- Team member management
- Import/export JSON project files
- Export to Excel and PDF
- Keyboard shortcuts
- Edit mode for modifications

### Kanban Board

Visual workflow management with customizable columns.

**Features:**
- Configurable columns (Backlog, To Do, In Progress, Done)
- Custom columns (add, delete, rename, recolor, reorder)
- Drag-and-drop cards between columns
- Card details: name, category, assignee, priority, notes
- Card filtering and search
- Column collapse/expand
- Bidirectional sync with Gantt and Sprint Planner
- Edit mode for modifications
- Print/export support

### Sprint Planner

Agile sprint planning with backlog management and velocity tracking.

**Features:**
- Product backlog with story point estimation (Fibonacci scale)
- Sprint creation with name, goal, and week range
- Sprint tabs for navigation
- Drag-and-drop from backlog to sprint
- Move tasks back to backlog
- Velocity tracking from completed sprints
- Capacity bar (committed vs velocity)
- Sprint status management (planning, active, completed)
- Two-panel layout (backlog + sprint board)
- Bidirectional sync with Gantt and Kanban
- Edit mode for modifications

### Burndown Chart

Visual sprint progress tracking with ideal vs. actual burndown lines.

**Features:**
- Ideal burndown line showing linear progress
- Actual burndown calculated dynamically from task completion timestamps
- Story points or task count display modes
- Sprint selector for viewing different sprints
- Today marker showing current position
- Historical sprint comparison in sidebar
- Average velocity calculation
- Export chart as PNG image
- Cross-tab sync with Sprint Planner
- Keyboard shortcuts

### Time Tracker

Track time spent on tasks and projects.

**Features:**
- Timer with start/stop/pause
- Manual time entry (quick add)
- Associate time with projects/tasks
- Daily and weekly views
- Date navigation
- Time reports view
- Billable hours tracking
- Edit mode for modifications

### Resource Calendar

Team availability and capacity planning.

**Features:**
- Week and month view toggle
- Calendar grid with team member rows
- Mark days as available, partial, unavailable, or holiday
- Team member management with color coding
- Weekly hours configuration per member
- Capacity calculation and visualization
- Search/filter team members
- Edit mode for modifications

### Milestone Tracker

High-level view of project milestones with deadline tracking.

**Features:**
- Timeline view with horizontal month headers
- Card/list view with two-panel layout
- Status indicators (on track, at risk, delayed, complete)
- Auto-calculated status based on deadline and progress
- Deadline tracking with days remaining
- Dependencies between milestones and tasks
- Progress percentage from dependency completion
- Convert existing tasks to milestones
- Search/filter milestones

### Retrospective Board

Agile sprint retrospectives with voting and item grouping.

**Features:**
- Three columns: Went Well, Didn't Go Well, Action Items
- Anonymous mode toggle per retrospective
- Unlimited voting on items
- Drag-to-group similar items
- Drag-to-move items between columns
- Export action items as text
- Link to sprint (optional)
- Retrospective selector dropdown
- Edit mode for modifications

### PERT Chart

Network diagram for task dependencies and critical path analysis.

**Features:**
- Interactive network diagram (vis-network library)
- ELK.js orthogonal edge routing (90-degree angles, parallel edges)
- Dynamic node dimension measurement for precise edge alignment
- Critical path highlighting with zero-slack visualization
- PERT calculations: Early Start/Finish, Late Start/Finish, Slack
- Continuous edge drawing in edit mode
- Incremental updates (view preserved when adding edges)
- Cycle prevention when creating dependencies
- Table view with sortable PERT values
- Data scope toggle (milestones only vs all tasks)
- Node details modal and sidebar
- Floating glass-panel controls (zoom, edit notice)
- High-quality PNG export with proper hiDPI scaling
- Export as PNG or JSON
- Search/filter nodes

## Shared Modules

### CSS Modules

| Module | Purpose |
|--------|---------|
| `tokens.css` | Design tokens: colors, spacing, typography, status colors |
| `base.css` | Reset, body styles, scrollbars, typography |
| `buttons.css` | Button variants: default, primary, destructive, edit |
| `forms.css` | Input fields, labels, textareas, selects |
| `modals.css` | Modal overlays and panels |
| `status.css` | Status message styling |
| `navigation.css` | Inter-tool navigation dropdown |
| `print.css` | Print media query styles |

### JavaScript Modules

| Module | Purpose | Key Exports |
|--------|---------|-------------|
| `storage.js` | localStorage wrapper | `saveToStorage()`, `loadFromStorage()`, `removeFromStorage()` |
| `undo.js` | Undo/redo stack | `createUndoManager()` |
| `export.js` | File downloads | `downloadJSON()`, `downloadBlob()`, `readJSONFile()` |
| `status.js` | Status messages | `initStatus()`, `showStatus()`, `createStatusManager()` |
| `backup.js` | Backup utilities | Backup/restore functionality |
| `unified-data.js` | Cross-tool data sync | `migrateToLatest()`, `getProductBacklog()`, `getSprintTasks()`, `calculateVelocity()`, `getSprintWeekNumber()`, `getTaskAssignee()` |
| `navigation.js` | Inter-tool navigation | `initNavigation()` |

## Creating New Tools

1. Create a new directory under `tools/`:
   ```
   tools/
   └── my-tool/
       ├── index.html
       ├── css/
       │   └── my-tool.css
       └── js/
           └── my-tool-app.js
   ```

2. **Register the tool** in `shared/js/navigation.js` by adding to the `TOOLS` array:
   ```javascript
   const TOOLS = [
     { id: 'gantt', number: '01', label: 'Gantt', path: 'gantt' },
     { id: 'kanban', number: '02', label: 'Kanban', path: 'kanban' },
     // ... existing tools ...
     { id: 'my-tool', number: '05', label: 'My Tool', path: 'my-tool' }  // Add here
   ];
   ```
   This single change makes the tool appear in all other tools' navigation dropdowns.

3. In your `index.html`, import shared CSS (order matters):
   ```html
   <link rel="stylesheet" href="../../shared/css/tokens.css">
   <link rel="stylesheet" href="../../shared/css/base.css">
   <link rel="stylesheet" href="../../shared/css/buttons.css">
   <link rel="stylesheet" href="../../shared/css/forms.css">
   <link rel="stylesheet" href="../../shared/css/modals.css">
   <link rel="stylesheet" href="../../shared/css/status.css">
   <link rel="stylesheet" href="../../shared/css/navigation.css">
   <link rel="stylesheet" href="../../shared/css/print.css">
   ```

4. Add the navigation placeholder in your header:
   ```html
   <header class="header">
     <div class="header-left">
       <nav class="nav-dropdown" data-current="my-tool"></nav>
       <!-- rest of header -->
     </div>
   </header>
   ```

5. In your JavaScript, import and initialize navigation:
   ```javascript
   import { saveToStorage, loadFromStorage } from '../../../shared/js/storage.js';
   import { initNavigation } from '../../../shared/js/navigation.js';
   // ... other imports ...

   function init() {
     initNavigation();  // Initialize navigation dropdown
     // ... rest of initialization ...
   }
   ```

6. Add a card to the landing page `index.html`

## Browser Support

Modern browsers with ES modules support:
- Chrome 61+
- Firefox 60+
- Safari 11+
- Edge 16+

## Data Storage

All data is stored in your browser's localStorage:
- Data persists between sessions
- Data is per-browser and per-domain
- Clear browser data to reset
- Export JSON for backups or sharing

## Data Model

The suite uses a unified data model (v12) shared across all tools:
- **Automatic migration**: Data is automatically migrated to the latest version
- **Cross-tool sync**: Changes in one tool sync to others via localStorage events
- **Sprint dates**: Stored as ISO date strings for portability
- **Burndown**: Calculated dynamically from task completion timestamps
- **Assignees**: Linked by ID with name fallback for backwards compatibility
- **Dependencies**: Task dependencies stored for PERT chart analysis
- **Retrospectives**: Sprint retrospective data with voting and grouping

## License

MIT License - feel free to use, modify, and distribute.
