# Guided Recovery and next-day continuation — Store 19891

Source: Chris's confirmed specification of November 14, 2026 (guided recovery with staff adjustments, plus next-day continuation). This document describes what is implemented in this branch, how it was checked, and what has **not** been verified.

## What it adds

A **Guided Recovery** view (all roles) for the 5 p.m.-to-close recovery. Nothing here creates, changes or completes Task Board tasks, and nothing is posted automatically.

**Manager**
- Pick a date, prepare a draft from the imported schedule, or prepare from the previous day's unfinished sections.
- Only active employees scheduled across 5 p.m. to close are used. Suggested start is 5 p.m., or the shift start if later. Breaks, register/customer coverage and other reserved duties from that date's Daily Planner stay in view; recovery never overlaps them. If nobody is available the plan says so and leaves sections unassigned with the reason.
- Create, edit, reorder and remove named sections (with department/aisle label and a store-specific instruction; the default instruction is face and straighten, return misplaced merchandise, fill accessible gaps where appropriate, keep aisles clear, flag stocking/safety problems). No company productivity targets are included.
- Carlton's route (Back wall — Water → Back wall — Kitchen → Paper products → Pet aisle) is offered only as an editable starter when Carlton is scheduled and available. It is an example, not a store map or a permanent assignment.
- Assign sections to scheduled, available staff, then explicitly post. Reassigning on a posted plan writes an audit event.
- Progress view: assigned staff, current section, completed sections, actual order of moves, pauses, recorded time, issues, unfinished sections. Employee completion and MOD verification are separate actions.
- Unfinished sections stay on the handoff until completed or deliberately deferred with a manager note.

**Staff**
- At the route start time the app shows the assignment in an in-app banner and, if alerts are on, plays the existing alert and requests a browser notification.
- Current section and Next planned section with Start, Finish section, Change section, Pause/Resume and Flag issue.
- Change section requires a named destination (a section on the plan, or **Other** with a specific aisle/section name; blank and generic names such as "moved elsewhere" are rejected). When leaving an active or paused section the employee must record Completed, Partially recovered or Not started; incomplete work requires a short remaining-work note. The change reason is optional.
- If the destination is already in progress with someone else, the conflict is shown before confirmation; the employee picks another section or explicitly acknowledges collaboration. Nobody's assignment is replaced.
- Pause/break is not a move: it needs no destination, keeps the section current, and paused time is not counted. Finish needs explicit confirmation and then suggests the next unfinished section, which can be accepted or changed through the same destination flow.
- Staff update only their own route. A section completed earlier is never silently restarted; a manager adds a new dated pass instead.

**Next-day continuation**
- Partially recovered sections (including work left running at the end of the day) come first, then not-started sections, each with the last worker, last activity time, remaining-work notes and issues. Completed and deliberately deferred sections are not carried.
- Owners are suggested only from the new date's active scheduled staff (last worker preferred when scheduled that day). Staff who are off are not assigned; a missing schedule leaves an unassigned handoff, never guessed staff or shifts.
- Each follow-up has a stable carry-origin id (`previous plan : section`), with a root-origin link for chains, so rebuilding, reprinting, reopening or syncing never creates a second follow-up for the same unfinished section. The original day's progress and verification stay as history; new-day work always starts as Not started.

**Print**: "Print recovery plan" uses the native print dialog. The same dated recovery section is embedded in the printed Daily Planner for that date, with staff, zone order, instructions, carryover detail, unfinished handoff, progress/initials/MOD boxes and a sign-off line.

## Data and sync

Two new arrays in the existing synced board (no database migration, no new service):
- `recoveryPlans` — one plan per date (planned route, zones, routes, gaps).
- `recoveryEvents` — append-only log of actual activity: employee, plan/date, from-section, to-section, action, disposition, remaining-work note, optional reason, timestamp, actor and whether a manager acted. Events are never edited or deleted.

Events carry a unique operation id, so a retry cannot record the same move or completion twice. The existing three-way merge keys both arrays by `id`, so events from two phones merge without overwriting each other. Two managers editing the same date's plan at the same moment still follow the existing sync conflict behaviour; the view shows "pending sync" (device-local list cleared when the app reports a successful push) and a warning when a pull reports merge conflicts.

## Verification

Automated (`node --test tests/*.test.js`, 63 tests):
- `tests/recovery.test.js` (21): eligibility and reserved duties, starter route, required destination/disposition/note, Other validation, conflicts and collaboration, pause/finish, ownership rules, duplicate-retry safety, flag, MOD verification, deferral, the Saturday→Sunday carryover example, idempotent rebuilds, chained carryover, gaps, schedule-change review.
- `tests/recovery-ui.test.js` (18): the real UI script driven through a simulated DOM — manager draft/post, no auto-posting, banner and alert, the guided flow with every rejection message, pending sync and failed saves, manager progress, next-day preparation, printable output, audit on reassign.
- Existing operations, planner, planner UI and sync suites still pass unchanged.

Also checked in desktop Chrome (headless): the app loads with the new view, renders at desktop and phone width on screen, and prints the recovery plan and the Daily Planner with the embedded recovery section to PDF without clipped rows.

## Not verified — please do before relying on it

- **Background / locked-phone alerts do not exist.** Alerts work only while StoreFlow is open on that device. The in-app banner is the fallback. This must be confirmed on a real phone; do not describe it as push.
- **Native print preview on a real phone has not been inspected.** Only desktop Chrome print-to-PDF was checked.
- A real two-phone sync test on `19891-test` (offline retry, concurrent edits) has not been run; sync behaviour above is from the unit tests and the existing merge code.
- Shifts that run past midnight are not supported (same limit as the Daily Planner).
- Elapsed time is recorded only from explicit Start/Resume to Pause/Finish/Change. It is not proof of presence and nothing tracks location.
