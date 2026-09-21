[← back to the documentation index](README.md)

# Sprint planner

Sprint Planner separates the product backlog from sprint commitments. It keeps
the task identity shared with Gantt and Kanban while using sprint assignment,
story points, and completion state to calculate capacity and velocity.

```mermaid
flowchart TD
    A["Open Sprint Planner"] --> B["Load and migrate<br/>shared project JSON"]
    B --> C["Split tasks into<br/>backlog and sprint views"]
    C --> D{"Task moved?"}
    D -- "to backlog" --> E["Clear sprint assignment<br/>and set backlog position"]
    D -- "to sprint" --> F["Set sprintId and<br/>sprint position"]
    D -- "within a list" --> G["Reorder the selected list"]
    E --> H["Calculate points and<br/>capacity against velocity"]
    F --> H
    G --> H
    H --> I["Save shared project JSON"]
    I --> C

    style A fill:#1f6feb,stroke:#58a6ff,color:#fff
    style H fill:#8250df,stroke:#bc8cff,color:#fff
    style I fill:#238636,stroke:#3fb950,color:#fff
```

## Data boundary

| Reads | Writes | Produces |
|---|---|---|
| Tasks, sprints, workflow state, and story points | sprintId, backlogPosition, task order, sprint metadata | Backlog, sprint board, point totals, and velocity history |

Velocity is derived from completed sprints and the story points of their Done
tasks. It is a planning signal, not a second copy of task data.

## Reach for it when

Use Sprint Planner to decide what enters an iteration, compare a commitment with
available velocity, and move unfinished work back to the backlog.

Source: [tools/sprint/index.html](../tools/sprint/index.html),
[sprint-app.js](../tools/sprint/js/sprint-app.js), and
[sprint-edit.js](../tools/sprint/js/sprint-edit.js).
