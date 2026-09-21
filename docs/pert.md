[← back to the documentation index](README.md)

# PERT Chart

PERT builds a directed graph from task dependencies, then computes early and
late dates, slack, and the critical path. It can analyze all tasks or the
milestone subset and presents the result as a network and table.

```mermaid
flowchart TD
    A["Open PERT"] --> B["Load and migrate<br/>shared project JSON"]
    B --> C["Choose all tasks or<br/>milestones as the scope"]
    C --> D["Build adjacency and<br/>reverse dependency maps"]
    D --> E["Forward pass: early<br/>start and finish"]
    E --> F["Backward pass: late<br/>start and finish"]
    F --> G["Calculate slack and<br/>zero-slack critical path"]
    G --> H["Render diagram, table,<br/>and summary stats"]
    H --> I{"Edit dependency?"}
    I -- "no" --> J["Inspect, zoom, or export"]
    I -- "yes" --> K{"Would edge create cycle?"}
    K -- "yes" --> L["Reject edge"]
    K -- "no" --> M["Write dependency and<br/>save shared project JSON"]
    L --> H
    M --> C
    J --> H

    style A fill:#1f6feb,stroke:#58a6ff,color:#fff
    style G fill:#8250df,stroke:#bc8cff,color:#fff
    style M fill:#238636,stroke:#3fb950,color:#fff
```

## Data boundary

| Reads | Writes | Produces |
|---|---|---|
| Tasks, planned weeks, dependencies, and milestone flags | Dependency arrays on tasks | Network nodes, PERT values, slack, and critical path |

Task duration is derived from planned-week data. A dependency edge is accepted
only when it is not a duplicate, self-edge, or cycle-producing edge.

## Reach for it when

Use PERT when dependency order changes schedule risk and you need to know which
tasks have no slack. Use Dependencies when the graph relationship itself is the
main question and PERT calculations would be distracting.

Source: [tools/pert/index.html](../tools/pert/index.html),
[pert-app.js](../tools/pert/js/pert-app.js), and
[pert-calc.js](../tools/pert/js/pert-calc.js).
