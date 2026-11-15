# Daily Planner and cleaning — Store 19891

Source: six forms photographed and provided by Chris on November 12, 2026. The new 7-day workflow photograph takes precedence over the old Friday truck setup. Chris also confirmed that Driveline work belongs to the vendor and is excluded from store-staff assignment.

## Verified existing material

Read-only inspection of the `store-19891` cloud board found nine saved photos: IMG_6503.png, IMG_6505.png, IMG_6504.png, IMG_6506.png, IMG_6507.png, IMG_6508.png, IMG_6509.png and two image.jpg files. Visual review of the eight Compass images found promotional/seasonal material and a screen photograph. None was one of these six newly supplied forms. `19891-test` is a separate board, not the production inventory.

The app already contained general stocking standards, recurring activities and a seven-day workflow. They were guidance rather than the new cleaning checklist or a dated printable assignment planner.

| Supplied form | Implementation |
| --- | --- |
| Totes Processing Guide | Reference including by-1-p.m.-T+1 tote deadline and six processing steps |
| Stocking Productivity Tracker — Dry Truck Planning | Quantity fields, START totals and preparation/kickoff reference |
| Daily Cleaning Checklist instructions | Eleven cleaning areas with instructions |
| Daily Cleaning Checklist weekly grid | Dated cleaning assignments, employee/MOD initials and weekly printable grid |
| 7-Day Workflow Daily Activities | Corrected weekday workflow used by both Compass and Daily Planner |
| Daily Planner | Front end, low traffic, sales floor, compliance, Compass/ZDWF and SM controls; roster, notes, dated printing |

## Current workflow

| Day | Dry workflow | Fresh / closing |
| --- | --- | --- |
| Saturday | T+2; finish truck core; hang ad signs | P+4 overstock and PIA/OHA; hang ad signs |
| Sunday | T+3; Seasonal G sections and MAG endcaps | P+5 rotation first, milk/eggs and other coolers; damages under camera |
| Monday | T+4; DG Connect and POG sky shelves | Recovery |
| Tuesday | T+5; backstock; Compliance Tuesday | Fresh P-Day; recovery |
| Wednesday | T+6; receiving room, Nones & Tons/outs, dry damages | Recovery |
| Thursday | T-Day; plan stocking, receive truck, toppers and totes | Recovery |
| Friday | T+1; stock truck core | Second fresh P-Day; recovery |

## Automatic drafts, weekly cleaning and change review (November 14, 2026)

- **Opening a date prepares a DRAFT.** For a manager, opening Daily Planner on a date with imported shifts builds a baseline plan from only that date's scheduled, active employees and leadership roles. Nothing is posted to the Task Board by opening, saving or printing; posting is an explicit manager action.
- **Compass review pending.** Advance drafts carry no invented duties and are labelled "Compass review pending". Status is DRAFT until the manager checks both the Compass and coverage reviews, then Reviewed, then Posted.
- **MODs.** Opening and closing MOD are suggested from the earliest and latest scheduled leadership shifts, including days Chris is off. A chosen MOD who is later removed from the schedule is replaced by a suggestion with a visible note. Handoff notes stay editable and print with the dated plan.
- **Weekly cleaning.** "Prepare week's cleaning drafts" (also run before "Print weekly cleaning checklist") saves baseline drafts for every missing date of the Saturday–Friday week using the same allocator, daily workload, role rules, reserved coverage and shift minutes as daily planning. Cleaning is never allocated separately. Existing plans are left alone. Dates with no valid shifts are shown as gaps and are never guessed.
- **Preservation.** Manual edits, signed or completed rows, and posted assignments survive reload, refresh, weekly preparation and printing. Opening or printing never regenerates a plan.
- **Schedule changes.** If the imported schedule for a planned date changes, or a row's owner is off shift or former staff, the plan shows a review panel and per-row "REVIEW: owner off shift" flags. "Refresh suggestions" is deliberate and confirms the conflict list first; signed, completed and manual rows are kept as they are, and the manager re-posts afterwards.
- **Former staff.** Louis C., Alicia and Jeff never enter the planner roster, MOD suggestions or assignments. Their historical shifts and records stay stored.
- **Printing.** The page-clipping caused by the horizontal-board layout (`html, body { overflow: hidden }`) is overridden in print. The weekly sheet prints landscape with a status per day and a MOD sign-off row. Daily and weekly output was rendered with desktop Chrome print-to-PDF; phone print preview has not been inspected.

## Daily and advance preparation

1. Import the published schedule covering the desired date.
2. Open Daily Planner. Pick a date or Prepare tomorrow, including a day Chris is off or closing.
3. Confirm opening/closing MOD, preparer and handoff notes. Enter that date's Compass duties one per line and confirm review. Historical Compass notes have no dates and are not silently treated as today's instructions.
4. Reserve breaks and register/customer coverage as `Name, HH:MM, HH:MM, reason`. Confirm coverage review. Estimates are planning allowances, not company productivity standards.
5. Build suggested assignments. Edit owners, time blocks, estimates or true N/A items. Leadership work stays with leadership. No valid shift or insufficient capacity leaves work unassigned rather than assigning off-shift staff. Ordinary daytime shifts are supported; overnight shifts require manual planning outside the allocator.
6. Post reviewed assignments. Only assigned, valid rows are posted. Unassigned duties remain visibly open for follow-up and on the printed plan. Reposting updates the same task IDs. Removed/N/A generated duties are excluded from the staff task view without deleting unrelated work or marking it completed.
7. Print the dated daily planner, or print the week’s cleaning checklist. Employee initials and MOD validation are separate from task completion. Blank signatures remain blank on paper. Print/Save as PDF uses the device’s native print dialog.

Driveline duties from typed Compass lines or existing due tasks are shown separately as vendor work. They are never allocated by the planner or shown as staff duties in the ordinary task view. Nothing is submitted back to Compass, Driveline or START automatically.

Plans persist in the existing synced board under `dailyPlans`, one ID per date; tasks retain the existing task/time/alert workflow. Two managers editing the same day's nested plan simultaneously use the existing sync conflict behavior, so coordinate ownership of a day's plan. This does not change authentication or database policy.

## Validation

`node --test tests/*.test.js` covers operations, planner allocation, planner UI handlers with a simulated DOM, and the existing 20-case sync suite. New cases cover the photographed cadence, only-on-shift allocation, breaks/coverage, leadership, insufficient capacity, Driveline exclusions, signed-row preservation, tomorrow's plan, idempotent posting and print action generation.

JavaScript syntax checks pass. Real browser/print visual validation remains pending: local Chromium could not create its required Unix socket in this environment, and the cloud browser rejected file-protocol access. No visual print-quality claim is made from simulated-DOM tests. Review on phone/desktop and inspect the native print preview before merging.
