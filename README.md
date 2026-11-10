# t-factory
Store app

### Schedule, timers, and alerts

- In **Schedule**, choose Week 1 or Week 2, select a PDF or CSV, and tap **Read file**. Set the first date shown on the published schedule. Review the rows, then tap **Apply reviewed week**. For a two-week file, apply each week separately. Rows are `YYYY-MM-DD, Name, Start, End`; optional fifth column is direction. Dated PDF text can be read on device. If a grid or scanned PDF cannot be read reliably, use a CSV or paste verified rows. Imports never guess missing shifts.
- The **Open** task board scrolls sideways. **Start** begins timing, **Pause/Resume** excludes breaks, and **Complete** logs time and moves the task to **Completed**. Manager time adjustments require a reason.
- **Enable alerts** turns on due times, timer alarms, event reminders, and incoming team activity on this device. While StoreFlow is open, supported devices can play a sound or show a system notification with permission. There is no background push service.
- The recovery plan uses the store's zone rules and the device clock. It does not call an AI model.

Run `node --test tests/operations.test.js` and `node tests/sync-core.test.js`.
