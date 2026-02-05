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

### Phase 2: Core Planning Tools
- [ ] Kanban Board
- [ ] Sprint Planner
- [ ] Time Tracker

### Phase 3: Supporting Tools
- [ ] Resource Calendar
- [ ] Milestone Tracker
- [ ] Burndown Chart

### Phase 4: Advanced Tools
- [ ] PERT Chart
- [ ] Risk Register
- [ ] Retrospective Board
- [ ] Decision Log

### Phase 5: Integration
- [ ] Cross-tool data sharing
- [ ] Unified dashboard
- [ ] Project-level data management

---

## Proposed Tools

### Tier 1: Core Planning Tools

High priority - complement Gantt directly and share similar data patterns.

#### Kanban Board

Visual workflow management with customizable columns.

**Features:**
- Configurable columns (e.g., To Do, In Progress, Review, Done)
- Drag-and-drop cards between columns
- Card details: title, description, assignee, priority, due date
- WIP (Work In Progress) limits per column
- Swimlanes for categories or assignees
- Card filtering and search
- Column collapse/expand

**Shared modules:** storage, undo, export, status

#### Sprint Planner

Agile sprint planning with backlog management.

**Features:**
- Product backlog with story points
- Sprint creation and management
- Drag items from backlog to sprint
- Velocity tracking across sprints
- Sprint capacity planning
- Sprint burndown integration
- Sprint retrospective link

**Shared modules:** storage, undo, export, status

#### Time Tracker

Track time spent on tasks and projects.

**Features:**
- Timer with start/stop/pause
- Manual time entry
- Associate time with projects/tasks
- Daily and weekly summaries
- Time reports by project, task, or date range
- Export time logs

**Shared modules:** storage, export, status

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
- [ ] `cards.css` - Card components for Kanban/boards
- [ ] `calendar.css` - Calendar grid layouts
- [ ] `charts.css` - Chart styling (burndown, etc.)
- [ ] `drag-drop.css` - Drag-and-drop visual feedback
- [ ] `tables.css` - Data table styling

### JavaScript Modules
- [ ] `drag-drop.js` - Shared drag-and-drop utilities
- [ ] `keyboard.js` - Keyboard shortcut manager
- [ ] `dates.js` - Date formatting and calculations
- [ ] `charts.js` - Simple chart rendering
- [ ] `sync.js` - Cross-tool data synchronization

---

## Integration Ideas

Tools could share data for a unified experience:

### Gantt ↔ Kanban
- Tasks created in Gantt appear as cards in Kanban
- Moving a card to "Done" updates Gantt progress
- Bidirectional sync of task status

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

## Deployment: GitHub Pages

The suite requires no build tools, making it ideal for GitHub Pages.

### Setup

1. Push the `project-planning-tools` directory to a GitHub repository

2. Enable GitHub Pages:
   - Go to repository Settings → Pages
   - Source: Deploy from a branch
   - Branch: main (or master)
   - Folder: / (root) or /docs if you move files there

3. Access your tools at:
   ```
   https://<username>.github.io/<repo-name>/
   ```

### Benefits

- **Free hosting** with HTTPS included
- **Automatic deployment** on every push
- **Custom domain** support available
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
