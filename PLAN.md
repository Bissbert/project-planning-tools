# Project Planning Tools - Roadmap

Future development plans and proposed tools for the suite.

## Vision

Build a comprehensive, offline-first suite of project planning tools that:
- Run entirely in the browser with no server required
- Keep all data local (localStorage)
- Require no build tools or compilation
- Share a consistent design language and UX
- Allow tools to integrate and share data where useful

## Design Principles

1. **Simplicity over features** - Each tool does one thing well
2. **Offline by default** - Works without internet
3. **User owns their data** - localStorage, easy export, no accounts
4. **Zero build step** - Plain HTML/CSS/JS with ES modules
5. **Consistent experience** - Shared design tokens and components

---

## Roadmap

### Phase 1: Foundation (Complete)
- [x] Shared CSS modules (tokens, base, buttons, forms, modals, status)
- [x] Shared JS modules (storage, undo, export, status)
- [x] Gantt Chart tool
- [x] Landing page
- [x] GitHub Pages deployment with custom domain (project.bissbert.ch)

### Phase 2: Core Planning Tools (Complete)
- [x] Kanban Board (with Gantt bidirectional sync)
- [x] Sprint Planner (with velocity tracking and Gantt/Kanban sync)
- [x] Time Tracker (with timer, quick add, and task linking)

### Phase 3: Supporting Tools
- [ ] Resource Calendar
- [ ] Milestone Tracker
- [ ] Burndown Chart

### Phase 4: Advanced Tools
- [ ] PERT Chart
- [ ] Risk Register
- [ ] Retrospective Board
- [ ] Decision Log

### Phase 5: Integration (In Progress)
- [x] Cross-tool data sharing (unified-data.js, v6 data model with sprint support)
- [x] Inter-tool navigation (navigation.js - dropdown with centralized tool registry)
- [ ] Unified dashboard
- [ ] Project-level data management

---

## Proposed Tools

### Tier 1: Core Planning Tools

High priority - complement Gantt directly and share similar data patterns.

#### Kanban Board (Complete)

Visual workflow management with customizable columns and bidirectional Gantt sync.

**Implemented Features:**
- [x] Configurable columns (Backlog, To Do, In Progress, Done by default)
- [x] Custom columns (add, delete, rename, recolor, reorder)
- [x] Drag-and-drop cards between columns
- [x] Card details: name, category, assignee, priority, notes
- [x] Card filtering and search
- [x] Column collapse/expand
- [x] Bidirectional sync with Gantt (unified data model v5)
- [x] Edit mode toggle for modifications
- [x] Print/export support

**Not Implemented:**
- Swimlanes for categories or assignees
- WIP limits (removed by design choice)

**Shared modules:** storage, undo, unified-data, status

#### Sprint Planner (Complete)

Agile sprint planning with backlog management and velocity tracking.

**Implemented Features:**
- [x] Product backlog with story point estimation (Fibonacci: 1, 2, 3, 5, 8, 13, 21)
- [x] Sprint creation with name, goal, and week range
- [x] Sprint tabs for navigation between sprints
- [x] Drag-and-drop from backlog to sprint
- [x] Drag-and-drop reordering within backlog/sprint
- [x] Move tasks back to backlog from sprint
- [x] Velocity tracking from completed sprints
- [x] Capacity bar comparing committed vs velocity
- [x] Sprint status (planning, active, completed)
- [x] Bidirectional sync with Gantt and Kanban (unified data model v6)
- [x] Edit mode toggle for modifications
- [x] Two-panel layout (backlog + sprint board)

**Not Implemented:**
- Sprint burndown chart (planned as separate tool)
- Sprint retrospective link

**Shared modules:** storage, undo, unified-data, status

#### Time Tracker (Complete)

Track time spent on tasks and projects.

**Implemented Features:**
- [x] Timer with start/stop/pause
- [x] Manual time entry (quick add)
- [x] Associate time with projects/tasks
- [x] Daily and weekly views
- [x] Date navigation (prev/next day/week)
- [x] Time reports view
- [x] Billable hours tracking
- [x] Edit mode toggle for modifications

**Not Implemented:**
- Export time logs to CSV
- Time reports by date range filter

**Shared modules:** storage, undo, unified-data, navigation, status

---

### Tier 2: Supporting Tools

Medium priority - enhance project visibility and team coordination.

#### Resource Calendar

Team availability and capacity planning.

**Features:**
- Calendar view of team members
- Mark holidays, time off, and availability
- Capacity visualization
- Integration with sprint planning
- Week/month view toggle

**Shared modules:** storage, export, status

#### Milestone Tracker

High-level view of project milestones.

**Features:**
- Timeline view of milestones
- Status indicators (on track, at risk, delayed, complete)
- Deadline tracking
- Dependencies between milestones
- Progress percentage
- Notes and attachments

**Shared modules:** storage, export, status

#### Burndown Chart

Visual sprint progress over time.

**Features:**
- Ideal burndown line
- Actual work remaining line
- Story points or task count modes
- Sprint selector
- Export chart as image
- Historical sprint comparison

**Shared modules:** storage, export

---

### Tier 3: Advanced Tools

Lower priority - for more complex project management needs.

#### PERT Chart

Network diagram for task dependencies.

**Features:**
- Visual task network
- Critical path highlighting
- Task duration estimates (optimistic, likely, pessimistic)
- Dependency arrows
- Slack time calculation
- Zoom and pan navigation

**Shared modules:** storage, undo, export

#### Risk Register

Track and manage project risks.

**Features:**
- Risk entry with description
- Probability and impact scoring
- Risk matrix visualization
- Mitigation plans
- Risk owner assignment
- Status tracking (open, mitigating, closed)

**Shared modules:** storage, export, status

#### Retrospective Board

Agile sprint retrospectives.

**Features:**
- Three columns: Went Well, Didn't Go Well, Action Items
- Anonymous card submission mode
- Voting on items
- Group similar items
- Export action items
- Link to sprint

**Shared modules:** storage, export

#### Decision Log

Record and track project decisions.

**Features:**
- Decision entry with context and rationale
- Stakeholder tracking
- Date and status
- Categories/tags
- Search and filter
- Link to related decisions

**Shared modules:** storage, export

---

## Shared Infrastructure Improvements

Enhancements to shared modules for future tools:

### CSS Modules
- [x] `kanban-cards.css` - Card components for Kanban/boards
- [ ] `calendar.css` - Calendar grid layouts
- [ ] `charts.css` - Chart styling (burndown, etc.)
- [x] `kanban-edit.css` - Drag-and-drop visual feedback (tool-specific)
- [ ] `tables.css` - Data table styling

### JavaScript Modules
- [ ] `drag-drop.js` - Shared drag-and-drop utilities (currently tool-specific)
- [ ] `keyboard.js` - Keyboard shortcut manager
- [ ] `dates.js` - Date formatting and calculations
- [ ] `charts.js` - Simple chart rendering
- [x] `unified-data.js` - Cross-tool data synchronization and model
- [x] `navigation.js` - Inter-tool navigation with centralized tool registry

---

## Integration Ideas

Tools could share data for a unified experience:

### Gantt ↔ Kanban (Complete)
- [x] Tasks created in Gantt appear as cards in Kanban
- [x] Moving a card to "Done" updates Gantt progress (fills reality weeks)
- [x] Bidirectional sync of task status via unified data model (v6)
- [x] Cross-tab sync via localStorage events

### Gantt ↔ Sprint Planner (Complete)
- [x] Tasks in product backlog can be assigned to sprints
- [x] Sprint weeks automatically set task planned weeks
- [x] Story points tracked per task
- [x] Sprint velocity calculated from completed tasks
- [x] Cross-tab sync via localStorage events

### Sprint Planner ↔ Kanban (Complete)
- [x] Sprint tasks show Kanban status (To Do, In Progress, Done)
- [x] Moving card to "Done" in Kanban contributes to sprint velocity
- [x] Shared task data via unified data model (v6)

### Sprint Planner ↔ Burndown
- Sprint data automatically feeds burndown chart
- Real-time updates as sprint progresses

### Time Tracker ↔ Gantt
- Compare actual time spent vs. planned duration
- Visual variance in Gantt view

### Milestones Across Tools
- Milestones visible in Gantt timeline
- Sprint Planner shows milestone deadlines
- Calendar displays upcoming milestones

### Unified Project Data
- Single project definition shared across tools
- Project-level settings and team members
- Cross-tool dashboard showing overall status

---

## Deployment: GitHub Pages (Live)

The suite is deployed and accessible at **https://project.bissbert.ch/**

### Current Setup

- **Repository:** [Bissbert/project-planning-tools](https://github.com/Bissbert/project-planning-tools)
- **Source Branch:** main (development)
- **Deploy Branch:** gh-pages (GitHub Actions workflow)
- **Custom Domain:** project.bissbert.ch
- **DNS:** Cloudflare CNAME → bissbert.github.io (DNS only, no proxy)
- **HTTPS:** Enabled via GitHub Pages SSL

### Deployment Workflow

Automatic deployment via GitHub Actions (`.github/workflows/deploy.yml`):
1. Push to `main` triggers the workflow
2. Workflow deploys files to `gh-pages` branch
3. CNAME file is added automatically (only exists on `gh-pages`)
4. GitHub Pages serves from `gh-pages` branch

### Available Tools

| Tool | URL | Status |
|------|-----|--------|
| Landing Page | https://project.bissbert.ch/ | Active |
| Gantt Chart | https://project.bissbert.ch/tools/gantt/ | Active |
| Kanban Board | https://project.bissbert.ch/tools/kanban/ | Active |
| Sprint Planner | https://project.bissbert.ch/tools/sprint/ | Active |
| Time Tracker | https://project.bissbert.ch/tools/time-tracker/ | Active |

### Benefits

- **Free hosting** with HTTPS included
- **Automatic deployment** on every push
- **Custom domain** configured
- **No build step** - files served as-is
- **ES modules work** - proper MIME types over HTTPS

### Important Notes

- **Data remains local**: Each user's data stays in their browser's localStorage
- **Per-domain storage**: Data is specific to the GitHub Pages domain
- **No sync between users**: Each user has independent data
- **Fork-friendly**: Users can fork and customize freely

### Self-Hosting Alternative

For private or enterprise use:
- Any static file server works (nginx, Apache, Caddy)
- Docker: `docker run -p 3000:80 -v $(pwd):/usr/share/nginx/html nginx`
- Node.js: `npx serve .`

---

## Contributing

Ideas for new tools or improvements to existing ones are welcome. When proposing a new tool, consider:

1. Does it fit the offline-first, no-build philosophy?
2. Can it reuse existing shared modules?
3. Does it complement existing tools?
4. Is the scope focused (one tool, one job)?
