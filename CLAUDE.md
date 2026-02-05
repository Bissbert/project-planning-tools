# Project Planning Tools

Offline-first, browser-based planning tools suite. No build step, no server required for production.

## Tech Stack

- Vanilla HTML, CSS, JavaScript
- ES modules (no bundler)
- localStorage for persistence
- No external dependencies except Google Fonts

## Project Structure

```
project-planning-tools/
├── index.html             # Landing page
├── README.md              # User documentation
├── PLAN.md                # Roadmap and future tools
├── CLAUDE.md              # Claude Code context
├── shared/                # Reusable modules
│   ├── css/               # Design tokens, components
│   └── js/                # Storage, undo, export, status
├── tools/                 # Individual tools
│   └── gantt/             # Gantt chart tool
└── .archived/             # Legacy files (do not modify)
```

## Commands

```bash
# Run locally (ES modules require a server)
npx serve .

# Alternative servers
python -m http.server 3000
php -S localhost:3000
```

## Code Conventions

- ES modules with explicit imports/exports
- No default exports; use named exports
- Shared modules in `shared/js/` and `shared/css/`
- Tool-specific code in `tools/<tool-name>/`
- CSS: Use design tokens from `tokens.css`
- JS: Use `storage.js` for localStorage, `undo.js` for undo/redo

## File Naming

- CSS: `<tool>-<purpose>.css` (e.g., `gantt-layout.css`)
- JS: `<tool>-<purpose>.js` (e.g., `gantt-render.js`)
- Main app entry: `<tool>-app.js`

## Adding New Tools

1. Create `tools/<tool-name>/` with `index.html`, `css/`, `js/`
2. Import shared CSS modules in order: tokens → base → buttons → forms → modals → status
3. Import shared JS modules as needed
4. Add tool card to main `index.html`

## Agent Usage

IMPORTANT: Always use specialized agents when available:
- **git-github-expert**: All git operations, commits, PRs, GitHub interactions
- **frontend-design**: UI/UX improvements, new components
- **code-reviewer**: Code quality reviews
- **documentation-architect**: Documentation updates

## Key Files

- `README.md` - User documentation
- `PLAN.md` - Roadmap and future tools
- `shared/css/tokens.css` - Design system tokens
- `shared/js/storage.js` - localStorage API
