[← back to the documentation index](README.md)

# Dependencies

Dependencies is the focused network view. It uses the same task dependency
arrays as PERT, but emphasizes task status and safe edge editing rather than
slack calculations.

```mermaid
flowchart TD
    A["Open Dependencies"] --> B["Load and migrate<br/>shared project JSON"]
    B --> C["Collect task nodes and<br/>dependency edges"]
    C --> D["Apply status colors and<br/>orthogonal graph layout"]
    D --> E["Render the dependency network"]
    E --> F{"Edit mode edge action?"}
    F -- "no" --> G["Select, inspect, zoom,<br/>or export the graph"]
    F -- "yes" --> H{"Self-edge, duplicate,<br/>or cycle?"}
    H -- "yes" --> I["Reject the edge"]
    H -- "no" --> J["Write dependency,<br/>save, and relayout"]
    I --> E
    J --> C
    G --> E

    style A fill:#1f6feb,stroke:#58a6ff,color:#fff
    style H fill:#8250df,stroke:#bc8cff,color:#fff
    style J fill:#238636,stroke:#3fb950,color:#fff
```

## Data boundary

| Reads | Writes | Produces |
|---|---|---|
| Task names, board status, categories, and dependency arrays | Dependency arrays on task records | Status-colored dependency network and node details |

The graph is a view over task IDs. Removing an edge changes the task record and
therefore changes the PERT graph as well.

## Reach for it when

Use Dependencies for a readable map of what blocks what. It is useful during
editing because invalid edge shapes are rejected before they are persisted.

Source: [tools/dependencies/index.html](../tools/dependencies/index.html),
[deps-app.js](../tools/dependencies/js/deps-app.js), and
[deps-vis.js](../tools/dependencies/js/deps-vis.js).
