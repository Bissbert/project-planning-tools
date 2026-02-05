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
│       └── status.js       # Status message display
└── tools/
    └── gantt/              # Gantt Chart tool
        ├── index.html
        ├── css/
        │   ├── gantt-layout.css
        │   ├── gantt-cells.css
        │   ├── gantt-edit.css
        │   └── gantt-print.css
        └── js/
            ├── gantt-app.js
            ├── gantt-data.js
            ├── gantt-render.js
            └── gantt-edit.js
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
| `print.css` | Print media query styles |

### JavaScript Modules

| Module | Purpose | Key Exports |
|--------|---------|-------------|
| `storage.js` | localStorage wrapper | `saveToStorage()`, `loadFromStorage()`, `removeFromStorage()` |
| `undo.js` | Undo/redo stack | `createUndoManager()` |
| `export.js` | File downloads | `downloadJSON()`, `downloadBlob()`, `readJSONFile()` |
| `status.js` | Status messages | `initStatus()`, `showStatus()`, `createStatusManager()` |
| `backup.js` | Backup utilities | Backup/restore functionality |

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

2. In your `index.html`, import shared CSS:
   ```html
   <link rel="stylesheet" href="../../shared/css/tokens.css">
   <link rel="stylesheet" href="../../shared/css/base.css">
   <link rel="stylesheet" href="../../shared/css/buttons.css">
   <!-- Add other shared CSS as needed -->
   ```

3. In your JavaScript, import shared modules:
   ```javascript
   import { saveToStorage, loadFromStorage } from '../../shared/js/storage.js';
   import { createUndoManager } from '../../shared/js/undo.js';
   import { downloadJSON, readJSONFile } from '../../shared/js/export.js';
   import { initStatus } from '../../shared/js/status.js';
   ```

4. Add a card to the landing page `index.html`

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

## License

MIT License - feel free to use, modify, and distribute.
