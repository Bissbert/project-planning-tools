[← back to the documentation index](README.md)

# Shared project data model

The tools exchange one JSON document. The conceptual model below follows the
fields read and written by the shared data module and the tool edit helpers.
categories and workflow.columns are embedded collections rather than top-level
entities, so they are shown as attributes on PROJECT and WORKFLOW.

```mermaid
erDiagram
    PROJECT ||--o{ TASK : contains
    PROJECT ||--o{ SPRINT : plans
    PROJECT ||--o{ TEAM_MEMBER : includes
    PROJECT ||--o{ TIME_ENTRY : records
    PROJECT ||--o{ RETROSPECTIVE : reviews
    PROJECT ||--|| WORKFLOW : configures
    PROJECT ||--|| CALENDAR_SETTINGS : configures
    TASK }o--o| SPRINT : assigned_to
    TASK }o--o| TEAM_MEMBER : assignee
    TASK ||--o{ TIME_ENTRY : tracks
    RETROSPECTIVE ||--o{ RETRO_ITEM : contains
    TASK }o--o{ TASK : depends_on

    PROJECT {
        string version
        object project_metadata
        object categories
        object workflow
        array sprints
        array tasks
        array timeEntries
        array team
        array retrospectives
        object calendarSettings
    }
    TASK {
        string id PK
        string name
        string category
        array planned
        array reality
        object board
        number storyPoints
        string sprintId FK
        string assigneeId FK
        string completedAt
        array dependencies
        boolean isMilestone
        string milestoneDeadline
    }
    SPRINT {
        string id PK
        string name
        string goal
        string startDate
        string endDate
        string status
    }
    TEAM_MEMBER {
        string id PK
        string name
        string role
        string color
        number hoursPerWeek
        array availability
    }
    TIME_ENTRY {
        string id PK
        string taskId FK
        string date
        string startTime
        string endTime
        number durationMinutes
        boolean billable
    }
    RETROSPECTIVE {
        string id PK
        string name
        string sprintId FK
        boolean isAnonymous
        array items
    }
    RETRO_ITEM {
        string id PK
        string column
        string text
        number votes
        string groupId FK
    }
    WORKFLOW {
        array columns
        boolean enableWipLimits
    }
    CALENDAR_SETTINGS {
        array workDays
        number hoursPerDay
    }
```

## Task is the shared pivot

The same task can be scheduled in Gantt, moved through Kanban, assigned to a
Sprint, counted by Burndown, linked in PERT and Dependencies, promoted to a
Milestone, and associated with Time Tracker entries. That is why task fields
carry both planning data (planned and reality) and execution data (board,
completedAt, and sprintId).

## Derived values

Some views calculate rather than store their display values:

- Kanban column and task status can be derived from planned and reality weeks.
- Burndown actuals are derived from completedAt; sprint burndown snapshots are
  not the source of truth.
- PERT duration is based on the number of planned weeks, with a fallback for a
  task without planned weeks. Forward and backward passes then derive slack.
- Resource capacity is calculated from member availability and calendar
  settings.
- Milestone status and progress can be calculated from deadline and dependency
  state, with explicit milestone overrides where the tool supports them.

## Import and migration boundary

JSON import enters through the same migration path as localStorage. The app
sets the document to the current data version after migration and then saves
it. Export writes the whole document, so an export is the portable boundary
between browser origins and backups.
