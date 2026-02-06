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

## Design System

**Aesthetic:** Assembly Line (factory/industrial workflow)
**Palette:** Warm Steel (gray-purple)

Key visual elements:
- Track lines and conveyor-inspired flow
- Numbered stations / step indicators
- Progress bars and status lights
- Modular panel-based cards
- Subtle purple accent on dark steel backgrounds

Primary colors:
- Backgrounds: `#101014` → `#18181f` → `#202028`
- Accent: `#a78bfa` (soft lavender)
- Steel accent: `#7c7c8a` (purple-tinted gray)

When creating new UI components, maintain the assembly line metaphor with organized, workflow-oriented layouts.

### Animation Guidelines

**Philosophy:** Animations should serve usability, not showcase the theme.

**DO use animations for:**
- Hover feedback on interactive elements (cards, buttons)
- State changes (selected, active, disabled)
- Brief transitions between views

**DON'T use:**
- Continuous/looping animations (blinking lights, moving indicators)
- Staggered page load delays that slow content visibility
- Decorative motion that doesn't aid comprehension

**Rationale:** A productivity tool should show content immediately. The industrial aesthetic is conveyed through static design (colors, shapes, typography, track lines) rather than motion.

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

2. **Register in navigation** - Add tool to `TOOLS` array in `shared/js/navigation.js`:
   ```javascript
   const TOOLS = [
     { id: 'gantt', number: '01', label: 'Gantt', path: 'gantt' },
     // ... existing tools ...
     { id: 'new-tool', number: '05', label: 'New Tool', path: 'new-tool' }
   ];
   ```
   This automatically adds the tool to all navigation dropdowns across the suite.

3. Import shared CSS modules in order: tokens → base → buttons → forms → modals → status → **navigation** → print

4. Add navigation placeholder in header:
   ```html
   <nav class="nav-dropdown" data-current="new-tool"></nav>
   ```

5. Import and call `initNavigation()` in your app.js:
   ```javascript
   import { initNavigation } from '../../../shared/js/navigation.js';
   // In init():
   initNavigation();
   ```

6. Add tool card to main `index.html`

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
- `shared/js/navigation.js` - Inter-tool navigation (tool registry)
