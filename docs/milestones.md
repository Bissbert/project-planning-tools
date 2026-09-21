[← back to the documentation index](README.md)

# Milestone Tracker

Milestone Tracker is a deadline-focused projection of tasks. A milestone is a
task marked with milestone metadata; its status and progress can reflect
deadline pressure and the completion of its dependencies.

```mermaid
flowchart TD
    A["Open Milestone Tracker"] --> B["Load and migrate<br/>shared project JSON"]
    B --> C["Filter tasks marked<br/>as milestones"]
    C --> D["Calculate deadline status<br/>and dependency progress"]
    D --> E["Render timeline or<br/>list with selected detail"]
    E --> F{"Edit milestone?"}
    F -- "no" --> G["Search, filter, or<br/>inspect dependencies"]
    F -- "yes" --> H["Create, convert, edit,<br/>or remove milestone metadata"]
    H --> I["Save shared project JSON"]
    I --> C
    G --> E

    style A fill:#1f6feb,stroke:#58a6ff,color:#fff
    style D fill:#8250df,stroke:#bc8cff,color:#fff
    style I fill:#238636,stroke:#3fb950,color:#fff
```

## Data boundary

| Reads | Writes | Produces |
|---|---|---|
| Task milestone flags, deadlines, dependencies, and board state | Milestone fields on task records | Timeline markers, status labels, and dependency progress |

Milestones do not form a separate top-level collection. Converting a task keeps
the task and changes its milestone fields, so other tools continue to see the
same task identity.

## Reach for it when

Use Milestone Tracker for a high-level delivery conversation: which checkpoints
are near, delayed, complete, or dependent on unfinished work.

Source: [tools/milestone-tracker/index.html](../tools/milestone-tracker/index.html),
[milestone-app.js](../tools/milestone-tracker/js/milestone-app.js), and
[unified-data.js](../shared/js/unified-data.js).
