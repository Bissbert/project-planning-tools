[← back to the documentation index](README.md)

# Time Tracker

Time Tracker records effort either from a running timer or a manual entry.
Entries remain in the shared project document and can be viewed by day, week,
or report grouping.

```mermaid
flowchart TD
    A["Open Time Tracker"] --> B["Load and migrate<br/>shared project JSON"]
    B --> C["Choose today, week,<br/>or reports"]
    C --> D{"Capture method"}
    D -- "timer" --> E["Start, pause, resume,<br/>and stop"]
    D -- "manual" --> F["Enter date, times,<br/>task, and notes"]
    E --> G["Calculate elapsed<br/>duration"]
    F --> H["Validate date and<br/>time fields"]
    G --> I["Append a time entry"]
    H --> I
    I --> J["Save shared project JSON"]
    J --> K["Render entries and<br/>task/category reports"]
    K --> C

    style A fill:#1f6feb,stroke:#58a6ff,color:#fff
    style I fill:#8250df,stroke:#bc8cff,color:#fff
    style J fill:#238636,stroke:#3fb950,color:#fff
```

## Data boundary

| Reads | Writes | Produces |
|---|---|---|
| Tasks, categories, and timeEntries | Time entry date, interval, task link, notes, and billable flag | Daily/week lists and grouped duration reports |

The timer is transient UI state until it is stopped. A timer stopped before one
full minute shows "Entry too short (< 1 minute)" and is discarded. A longer one
becomes a time entry with `HH:MM` start and end times, so the saved duration is
rounded to those clock minutes, not taken from the elapsed milliseconds. A
61-second run is saved as `10:01-10:02`. The one-minute check was added in
[`0b4ad44`](https://github.com/Bissbert/project-planning-tools/commit/0b4ad44).

## Reach for it when

Use Time Tracker when the important record is effort spent, not only task
status. Associate an entry with a task when reports should roll up by task or
category.

Source: [tools/time-tracker/index.html](../tools/time-tracker/index.html),
[time-app.js](../tools/time-tracker/js/time-app.js), and
[time-edit.js](../tools/time-tracker/js/time-edit.js).
