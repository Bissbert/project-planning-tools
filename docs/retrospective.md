[← back to the documentation index](README.md)

# Retrospective Board

Retrospective Board stores feedback items in three workflow columns. Items can
be voted on, grouped, moved, edited, and exported as action-item text without
changing the task board.

```mermaid
flowchart TD
    A["Open Retrospective"] --> B["Load and migrate<br/>shared project JSON"]
    B --> C["Select a retrospective<br/>and render its columns"]
    C --> D{"Board action"}
    D -- "new or edit" --> E["Validate and update<br/>an item"]
    D -- "vote" --> F["Increment the item vote"]
    D -- "group" --> G["Attach related items<br/>to a group"]
    D -- "move" --> H["Change item column<br/>and position"]
    D -- "export" --> I["Write action items<br/>as text"]
    E --> J["Save shared project JSON"]
    F --> J
    G --> J
    H --> J
    J --> C
    I --> C

    style A fill:#1f6feb,stroke:#58a6ff,color:#fff
    style G fill:#8250df,stroke:#bc8cff,color:#fff
    style I fill:#238636,stroke:#3fb950,color:#fff
```

## Data boundary

| Reads | Writes | Produces |
|---|---|---|
| Retrospectives, sprint links, and item arrays | Retro metadata, item column, position, grouping, and votes | Feedback board and exported action items |

The current item shape is a flat array with a column field. Migration also
accepts the older column-object shape and normalizes it before rendering.

## Reach for it when

Use this tool after an iteration to collect observations and turn the action
column into a portable follow-up list. Link a retrospective to a sprint when
the review should be discoverable from iteration context.

Source: [tools/retrospective/index.html](../tools/retrospective/index.html),
[retro-app.js](../tools/retrospective/js/retro-app.js), and
[retro-edit.js](../tools/retrospective/js/retro-edit.js).
