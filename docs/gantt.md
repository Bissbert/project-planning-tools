[← back to the documentation index](README.md)

# Gantt

The Gantt tool is the schedule editor. It renders each task against planned and
reality weeks, groups tasks by category, and uses the shared synchronization
rules so progress is visible in Kanban and Burndown.

```mermaid
flowchart TD
    A["Open Gantt"] --> B["Load saved project or<br/>clone the default project"]
    B --> C["Migrate old data and<br/>ensure task fields"]
    C --> D["Render categories,<br/>weeks, and task rows"]
    D --> E{"Edit mode?"}
    E -- "no" --> F["Inspect schedule,<br/>search, or collapse groups"]
    E -- "yes" --> G["Edit task, category,<br/>planned week, or reality week"]
    G --> H["Derive board column and<br/>task status from progress"]
    H --> I["Save shared project JSON"]
    I --> D
    F --> D

    style A fill:#1f6feb,stroke:#58a6ff,color:#fff
    style H fill:#8250df,stroke:#bc8cff,color:#fff
    style I fill:#238636,stroke:#3fb950,color:#fff
```

## Data boundary

| Reads | Writes | Produces |
|---|---|---|
| Project dates, categories, workflow, and task planning fields | Task arrays, category order, board state, and completion timestamp | Schedule grid, variance indicators, and task editor |

Planned weeks describe intended work. Reality weeks describe what happened.
When a reality change moves a task into or out of Done, shared synchronization
also sets or clears completedAt for downstream Burndown calculations.

## Reach for it when

Use Gantt when the question is “when should this happen, and how does that
compare with what happened?” Use Kanban for flow state and Sprint for
commitment and backlog ordering.

Source: [tools/gantt/index.html](../tools/gantt/index.html),
[gantt-app.js](../tools/gantt/js/gantt-app.js), and
[gantt-data.js](../tools/gantt/js/gantt-data.js).
