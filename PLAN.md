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
- [x] Resource Calendar
- [x] Milestone Tracker
- [x] Burndown Chart

### Phase 4: Advanced Tools
- [x] PERT Chart
- [ ] Risk Register (postponed)
- [x] Retrospective Board
- [ ] Decision Log (postponed)

### Phase 5: Integration (In Progress)
- [x] Cross-tool data sharing (unified-data.js, v11 data model)
- [x] Inter-tool navigation (navigation.js - dropdown with centralized tool registry)
- [x] Version-agnostic migration system (migrateToLatest with registry pattern)
- [x] Unified Dashboard
- [ ] Project-level data management

### Phase 6: Collaboration (Planned)
- [ ] Multi-project storage (switch between multiple local projects)
- [ ] Collaboration server (Node.js/Express with WebSocket)
- [ ] Real-time multi-user editing
- [ ] First-connect-uploads (first user sets baseline)
- [ ] Project switcher UI

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

#### Resource Calendar (Complete)

Team availability and capacity planning.

**Implemented Features:**
- [x] Week and month view toggle
- [x] Calendar grid with team member rows
- [x] Mark days as available, partial, unavailable, or holiday
- [x] Set availability for date ranges
- [x] Team member management (add, edit, delete)
- [x] Member color coding
- [x] Weekly hours configuration per member
- [x] Configurable work days
- [x] Capacity calculation and visualization
- [x] Search/filter team members
- [x] Edit mode toggle for modifications
- [x] Keyboard shortcuts (E, F, W, M, T, arrows)
- [x] Cross-tab sync

**Not Implemented:**
- Sprint capacity integration (future enhancement)
- Task allocation tracking

**Shared modules:** storage, undo, unified-data, navigation, status

#### Milestone Tracker (Complete)

High-level view of project milestones with deadline and dependency tracking.

**Implemented Features:**
- [x] Timeline view with horizontal month headers
- [x] Card/list view with two-panel layout
- [x] Status indicators (on track, at risk, delayed, complete, not started)
- [x] Auto-calculated status based on deadline proximity and progress
- [x] Status override option for manual control
- [x] Deadline tracking with days remaining
- [x] Dependencies between milestones and tasks
- [x] Progress percentage (auto-calculated from dependency completion)
- [x] Progress override option for manual control
- [x] Segmented progress bar showing task status breakdown
- [x] Notes field for milestone description
- [x] View toggle between timeline and list views
- [x] Convert existing tasks to milestones
- [x] Search/filter milestones
- [x] Edit mode toggle for modifications
- [x] Keyboard shortcuts (E, F, T, L, N, arrows, Delete)
- [x] Cross-tab sync

**Shared modules:** storage, undo, unified-data, navigation, status

#### Burndown Chart (Complete)

Visual sprint progress over time.

**Implemented Features:**
- [x] Ideal burndown line (linear from total to zero)
- [x] Actual work remaining line calculated dynamically from task.completedAt timestamps
- [x] Story points or task count modes toggle
- [x] Sprint selector with status indicators
- [x] Export chart as PNG image
- [x] Historical sprint comparison in sidebar
- [x] Today marker on chart
- [x] Average velocity calculation
- [x] Cross-tab sync with Sprint Planner
- [x] Keyboard shortcuts (E, S, P, T, R, Ctrl+Z)

**Note:** As of v10, burndown is calculated dynamically from `task.completedAt` timestamps rather than stored snapshots, ensuring data is always current.

**Shared modules:** storage, undo, unified-data, navigation, status

---

### Tier 3: Advanced Tools

Lower priority - for more complex project management needs.

#### PERT Chart (Complete)

Network diagram for task dependencies and critical path analysis using vis-network library with ELK.js for advanced edge routing.

**Implemented Features:**
- [x] Interactive network diagram with vis-network library
- [x] ELK.js orthogonal edge routing (90-degree angles, edges avoid nodes)
- [x] Dynamic node dimension measurement for precise edge alignment
- [x] Parallel edge separation (multiple edges don't overlap)
- [x] Critical path highlighting (zero-slack tasks and edges in accent color)
- [x] Forward pass (ES/EF) and backward pass (LS/LF) calculations
- [x] Slack time calculation per task
- [x] Continuous edge drawing in edit mode (draw multiple edges without re-entering mode)
- [x] Incremental network updates (no view reset when adding/removing edges)
- [x] Cycle prevention when drawing edges
- [x] Table view with sortable PERT values
- [x] Data scope toggle (milestones only vs all tasks)
- [x] Node details modal with PERT values
- [x] Task details sidebar
- [x] Floating glass-panel zoom controls (bottom-left)
- [x] Floating edit mode notice (top-right)
- [x] Zoom and pan navigation
- [x] High-quality PNG export with proper hiDPI scaling and SVG edge rendering
- [x] Export as PNG or JSON
- [x] Search/filter nodes
- [x] Edit mode toggle
- [x] Keyboard shortcuts (E, G, T, F, S, +/-, 0)
- [x] Cross-tab sync

**Shared modules:** storage, undo, unified-data, navigation, status

#### Risk Register (Postponed)

Track and manage project risks.

**Features:**
- Risk entry with description
- Probability and impact scoring
- Risk matrix visualization
- Mitigation plans
- Risk owner assignment
- Status tracking (open, mitigating, closed)

**Shared modules:** storage, export, status

#### Retrospective Board (Complete)

Agile sprint retrospectives with real-time voting and item grouping.

**Implemented Features:**
- [x] Three columns: Went Well, Didn't Go Well, Action Items
- [x] Anonymous mode toggle per retrospective
- [x] Unlimited voting on items
- [x] Drag-to-group similar items
- [x] Drag-to-move items between columns
- [x] Export action items as text
- [x] Link to sprint (optional)
- [x] Retrospective selector dropdown
- [x] Edit mode toggle for modifications
- [x] Cross-tab sync via localStorage events

**Shared modules:** storage, undo, unified-data, navigation, status

#### Decision Log (Postponed)

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
- [x] `unified-data.js` - Cross-tool data synchronization, model, and migrations (v10)
- [x] `navigation.js` - Inter-tool navigation with centralized tool registry

### Data Model (v12)

The unified data model uses a version-agnostic migration system:

**Migration Registry Pattern:**
- `migrateToLatest()` - Automatically chains through all necessary migrations
- New versions only require adding a migration function to the registry
- Tools never need updating when data version changes

**Key v12 Changes:**
- Added `task.dependencies` array for PERT Chart dependencies
- Tasks can now have explicit predecessor relationships

**Key v11 Changes:**
- Added `retrospectives` array for Retrospective Board
- Retrospective items with columns, voting, grouping support

**Key v10 Changes:**
- Sprint dates use ISO format (`startDate`/`endDate`) instead of week numbers
- Burndown calculated dynamically from `task.completedAt` timestamps
- Tasks have `assigneeId` linking to team member IDs (with name fallback)

**Helper Functions:**
- `getSprintWeekNumber(sprint, project)` - Calculate week number from dates
- `getTaskAssignee(task, team)` - Get assignee object with ID or name fallback
- `generateRetroId()` - Generate unique retrospective ID
- `generateItemId()` - Generate unique retrospective item ID

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
| Burndown Chart | https://project.bissbert.ch/tools/burndown/ | Active |
| Resource Calendar | https://project.bissbert.ch/tools/resource-calendar/ | Active |
| Milestone Tracker | https://project.bissbert.ch/tools/milestone-tracker/ | Active |
| Retrospective Board | https://project.bissbert.ch/tools/retrospective/ | Active |
| PERT Chart | https://project.bissbert.ch/tools/pert/ | Active |
| Dashboard | https://project.bissbert.ch/tools/dashboard/ | Active |

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

## Proposed Feature: Collaborative Server Storage

Enable real-time collaboration through an optional server component while maintaining offline-first philosophy.

### Overview

- **Multi-project storage** - Support multiple projects locally and on server
- **Offline mode** (default): localStorage with project switching
- **Collaborative mode**: Connect to server, first user uploads project as baseline
- **Project profiles**: Create, switch, and manage multiple projects

### Architecture

```
Browser Client                           Collaboration Server
┌────────────────────────┐              ┌────────────────────────┐
│  Project Switcher UI   │              │  Node.js / Express     │
│         ↓              │              │  REST API + WebSocket  │
│  storage-adapter.js    │◄────────────►│  File-based JSON       │
│    ↓           ↓       │   HTTP/WS    │  Room-based isolation  │
│  local.js   server.js  │              └────────────────────────┘
└────────────────────────┘
```

### Multi-Project Storage

**Current:** Single `ganttProject` key in localStorage

**Proposed:** Project index with multiple projects
```javascript
localStorage.setItem('projectIndex', JSON.stringify({
  activeProjectId: 'proj_abc123',
  projects: [
    { id: 'proj_abc123', name: 'Game Production', serverRoom: null },
    { id: 'proj_def456', name: 'Marketing Site', serverRoom: 'room-xyz' }
  ]
}));
localStorage.setItem('project_proj_abc123', JSON.stringify(projectData));
```

### Server Component

**Technology:** Node.js, Express, ws (WebSocket), file-based JSON storage

**REST API:**
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/rooms` | List rooms with user counts |
| GET | `/api/rooms/:id` | Get project data |
| PUT | `/api/rooms/:id` | Save project data |
| POST | `/api/rooms/:id/init` | First-connect upload |

**WebSocket:** Real-time sync of updates between connected users

### First-Connect-Uploads Flow

1. User A connects to empty room → uploads local project as baseline
2. User B connects to same room → receives existing project data
3. Both users now collaborate on same project with real-time sync

### Implementation Phases

1. **Multi-project storage** - Project index, switching, migration
2. **Project switcher UI** - Dropdown, management modal
3. **Server MVP** - Express + WebSocket + file storage
4. **Server backend client** - REST + WebSocket integration
5. **Connection integration** - UI for connect/disconnect
6. **Polish** - Loading states, error handling, reconnection

### New Files Required

**Server:**
```
server/
├── package.json
├── index.js
├── routes/api.js
├── storage/file-store.js
└── sync/websocket.js
```

**Client:**
```
shared/js/storage-adapter.js
shared/js/project-manager.js
shared/js/project-ui.js
shared/js/backends/local.js
shared/js/backends/server.js
shared/css/project.css
```

### Conflict Resolution

MVP: Last-write-wins with notification. Future: User choice dialog.

### Future Enhancements

- Room passwords for authentication
- User presence indicators
- Conflict resolution UI
- Docker deployment option

### Licensing Considerations

Commercial deployment of the collaboration server requires a license. See [Licensing](#licensing) section for pricing tiers. Operating the server as a hosted service for third parties requires separate agreement.

---

## Licensing

The project uses a custom dual license that balances open access with fair compensation for commercial use.

### License Summary

| Use Case | Requirements |
|----------|--------------|
| Personal use (any deployment) | Free, no registration |
| Commercial use of project.bissbert.ch | Registration required (honor system) |
| Commercial self-hosting | Paid per-user license |

### Personal Use (Free)

Individuals may freely use, modify, and deploy the Software for personal, non-commercial purposes including:
- Learning and experimentation
- Hobby projects
- Personal productivity
- Sharing modifications with others for personal use

### Commercial Use

Commercial use includes any use in connection with a business, company, government agency, or organization—regardless of whether revenue is generated directly.

**Official Instance (project.bissbert.ch):**
- Requires registration of your organization
- Currently free during initial period
- Pricing may be introduced with reasonable notice

**Self-Hosting Pricing Tiers:**

| Tier | Users | Price |
|------|-------|-------|
| Startup | 1-10 | CHF 3/user/year (min CHF 15) |
| Business | 11-100 | CHF 2.50/user/year |
| Enterprise | 100+ | Contact for custom pricing |

### Special Cases

Non-profit organizations, educational institutions, and open-source projects may request alternative licensing. Contact dev@bissbert.ch to discuss.

### Server Component Licensing

When deploying the collaboration server (Phase 6):
- **Personal use:** Free for self-hosted personal projects
- **Commercial use:** Same per-user pricing applies to server deployments
- **Hosted service:** Operating the server as a service for third parties requires separate written agreement

See [LICENSE](LICENSE) for full terms.

---

## Contributing

Ideas for new tools or improvements to existing ones are welcome. When proposing a new tool, consider:

1. Does it fit the offline-first, no-build philosophy?
2. Can it reuse existing shared modules?
3. Does it complement existing tools?
4. Is the scope focused (one tool, one job)?
