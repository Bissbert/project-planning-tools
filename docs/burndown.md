[← back to the documentation index](README.md)

# Burndown

Burndown turns sprint scope and completion timestamps into a chart. The ideal
line is calculated from the sprint interval; the actual line is calculated
from which sprint tasks were completed by each date.

```mermaid
flowchart TD
    A["Open Burndown"] --> B["Load and migrate<br/>shared project JSON"]
    B --> C["Select a sprint and<br/>display mode"]
    C --> D["Collect tasks assigned<br/>to the sprint"]
    D --> E["Calculate ideal line<br/>from dates and scope"]
    D --> F["Calculate actual line<br/>from completedAt"]
    E --> G["Render SVG chart,<br/>today marker, and legend"]
    F --> G
    G --> H{"Export chart?"}
    H -- "yes" --> I["Rasterize chart for<br/>PNG download"]
    H -- "no" --> J["Continue inspecting<br/>or switch sprint"]
    I --> J
    J --> C

    style A fill:#1f6feb,stroke:#58a6ff,color:#fff
    style F fill:#8250df,stroke:#bc8cff,color:#fff
    style I fill:#238636,stroke:#3fb950,color:#fff
```

## Data boundary

| Reads | Writes | Produces |
|---|---|---|
| Sprints, assigned tasks, story points, and completion timestamps | No project data during chart inspection | Ideal and actual remaining-work series |

The actual series stops at the earlier of the sprint end and the current date.
The current remaining summary is based on board completion state, while the
historical line uses completion timestamps.

## Reach for it when

Use Burndown to ask whether remaining sprint work is falling at the intended
rate. Use Dashboard for a wider project summary.

Source: [tools/burndown/index.html](../tools/burndown/index.html),
[burndown-app.js](../tools/burndown/js/burndown-app.js), and
[unified-data.js](../shared/js/unified-data.js).
