[← back to the documentation index](README.md)

# Resource Calendar

Resource Calendar turns team members, working days, and date-specific
availability into week and month capacity views. A missing date-specific entry
falls back to the calendar defaults.

```mermaid
flowchart TD
    A["Open Resource Calendar"] --> B["Load and migrate<br/>shared project JSON"]
    B --> C["Choose week or month<br/>and a view date"]
    C --> D["Render member rows<br/>and availability cells"]
    D --> E{"Availability changed?"}
    E -- "no" --> F["Inspect capacity,<br/>search, or navigate"]
    E -- "yes" --> G["Set a day or range<br/>for a member"]
    G --> H["Resolve availability from<br/>override or calendar default"]
    H --> I["Recalculate member and<br/>team capacity"]
    I --> J["Save shared project JSON"]
    J --> D
    F --> C

    style A fill:#1f6feb,stroke:#58a6ff,color:#fff
    style I fill:#8250df,stroke:#bc8cff,color:#fff
    style J fill:#238636,stroke:#3fb950,color:#fff
```

## Data boundary

| Reads | Writes | Produces |
|---|---|---|
| Team members, availability entries, and calendar settings | Member records and date-specific availability | Calendar cells, per-member totals, and team capacity |

Availability types include the default available state, partial availability,
unavailability, holidays, and weekends. Capacity is derived from hours, work
days, and the selected date range.

## Reach for it when

Use Resource Calendar to understand whether a team can absorb planned work.
Use Time Tracker for historical effort rather than planned capacity.

Source: [tools/resource-calendar/index.html](../tools/resource-calendar/index.html),
[calendar-app.js](../tools/resource-calendar/js/calendar-app.js), and
[unified-data.js](../shared/js/unified-data.js).
