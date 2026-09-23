# Documentation index

[← back to the overview](../README.md)

The suite is a set of views over one browser-local project document. Read the
shared pieces first when you need to understand why an edit in one tool appears
in another, then use the tool write-ups for the individual workflows.

| Area | Write-up | Diagram focus |
|---|---|---|
| Shared lifecycle | [Architecture](architecture.md) | Load, migrate, render, save, and cross-tab sync |
| Shared document | [Data model](data-model.md) | Project JSON entities and ID relationships |
| Timeline | [Gantt](gantt.md) | Planned/reality week editing and status derivation |
| Workflow | [Kanban](kanban.md) | Column movement and Gantt synchronization |
| Iteration | [Sprint](sprint.md) | Backlog-to-sprint flow and velocity |
| Progress | [Burndown](burndown.md) | Ideal line versus completion-derived actual line |
| Effort | [Time Tracker](time-tracker.md) | Timer/manual entry to reports |
| Capacity | [Resource Calendar](resource-calendar.md) | Availability to capacity totals |
| Delivery | [Milestones](milestones.md) | Dependency completion to milestone status |
| Feedback | [Retrospective](retrospective.md) | Item movement, grouping, voting, and export |
| Scheduling | [PERT](pert.md) | Dependency graph to slack and critical path |
| Dependency view | [Dependencies](dependencies.md) | Cycle-safe edge editing and network rendering |
| Summary | [Dashboard](dashboard.md) | Shared data to project health cards |
| Evidence | [Measurement](measurement.md) | How repository facts were produced |
| Findings | [Bugs found](BUGS-FOUND.md) | Existing behavior issues recorded without source edits |

The source remains the authority for behavior. These pages explain the current
implementation and call out limitations where the browser environment matters.

The measurement script lives in `devtools/measure_docs.py` because `tools/`
already contains the application source.
