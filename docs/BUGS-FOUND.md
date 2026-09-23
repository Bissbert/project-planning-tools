[← back to the documentation index](README.md)

# Bugs found during the documentation pass

This file records an existing behavior issue found while checking the
documentation against the source. No application source file was changed
during the documentation pass itself.

> **Since this pass:** an independent adjudication confirmed this entry, and a
> subsequent fix pass applied it to the default branch in commit `0b4ad44`.
> `stopTimer` now rejects raw elapsed durations below 60,000 milliseconds
> before it formats clock strings or creates the entry. How a saved duration is
> derived from the truncated clock string was deliberately left unchanged; that
> is a separate behavior decision, not part of this fix. Read the reproduction
> and the diagram below as the state at the time of the pass, not as the
> current state of the default branch.

```mermaid
flowchart TD
    A["Elapsed milliseconds"] --> B["Round to whole minutes"]
    B --> C{"Rounded minutes less than one?"}
    C -- "yes" --> D["Show too-short status<br/>and discard timer"]
    C -- "no" --> E["Create and save a<br/>time entry"]

    style C fill:#9e6a03,stroke:#d29922,color:#fff
    style D fill:#da3633,stroke:#f85149,color:#fff
    style E fill:#238636,stroke:#3fb950,color:#fff
```

## Timer accepts sub-minute entries

**File and line:** tools/time-tracker/js/time-app.js:225-231

**What happens:** stopTimer rounds elapsed milliseconds to the nearest whole
minute before checking whether the result is less than one. A timer stopped
after the rounding threshold but before a full minute is therefore accepted and
saved as a one-minute entry, even though the status message describes entries
shorter than one minute as too short.

**How to reproduce:** In the timer path, stop a running timer before a full
minute has elapsed. The same calculation used by the source can be reproduced
without a browser:

```bash
node -e 'for (const ms of [30000, 59000, 60000]) console.log(ms, Math.round(ms / 60000));'
```

The command produced:

```text
30000 1
59000 1
60000 1
```

The documentation therefore describes the current rounding behavior rather than
claiming that every sub-minute entry is rejected.

**Fix I would have made:**

```diff
diff --git a/tools/time-tracker/js/time-app.js b/tools/time-tracker/js/time-app.js
--- a/tools/time-tracker/js/time-app.js
+++ b/tools/time-tracker/js/time-app.js
@@
-  const totalMinutes = Math.round(totalMs / 60000);
+  const totalMinutes = Math.floor(totalMs / 60000);
@@
   if (totalMinutes < 1) {
     statusManager.show('Entry too short (< 1 minute)');
     resetTimer();
     return;
   }
@@
   // Create entry
@@
   const entry = addTimeEntry(projectData, {
@@
   });
```

The fix applied to the default branch takes a different route to the same
result: `stopTimer` rejects a raw elapsed duration below 60,000 milliseconds
before any clock string is formatted, rather than switching the rounding to
`Math.floor`.
