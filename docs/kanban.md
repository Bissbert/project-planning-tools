[← back to the documentation index](README.md)

# Kanban

Kanban is the workflow view over the same task records used by Gantt and
Sprint. Columns come from the workflow configuration; moving a card updates
the task board position and synchronizes progress-related fields.

```mermaid
flowchart TD
    A["Open Kanban"] --> B["Load and migrate<br/>shared project JSON"]
    B --> C["Render workflow columns<br/>and ordered task cards"]
    C --> D{"Card moved?"}
    D -- "no" --> E["Filter, search, or<br/>collapse a column"]
    D -- "yes" --> F["Validate edit mode and<br/>target column"]
    F --> G["Sync board movement to<br/>Gantt reality and completion"]
    G --> H["Reposition cards in<br/>the target column"]
    H --> I["Save shared project JSON"]
    I --> C
    E --> C

    style A fill:#1f6feb,stroke:#58a6ff,color:#fff
    style G fill:#8250df,stroke:#bc8cff,color:#fff
    style I fill:#238636,stroke:#3fb950,color:#fff
```

## Data boundary

| Reads | Writes | Produces |
|---|---|---|
| Workflow columns and task board fields | columnId, position, reality, and completedAt | Ordered cards grouped by workflow state |

Moving to In Progress may seed the current week when the task has no reality
weeks. Moving to Done records completion time; moving back out clears it.
These changes are intentionally visible to the timeline and progress views.

## Reach for it when

Use Kanban when the team needs a current flow state and a direct drag gesture.
The board is not a separate task database; it is another projection of the
shared task collection.

Source: [tools/kanban/index.html](../tools/kanban/index.html) and
[kanban-app.js](../tools/kanban/js/kanban-app.js).
