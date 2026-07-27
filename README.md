# Time Sync

A friendly little time tracker that lives in your [Obsidian](https://obsidian.md) sidebar. Pick a project, hit **Start**, do the work, hit **Stop**, jot down what you did — and when it's time to bill, mark an invoice point. Everything is stored as plain markdown notes in your vault, so your time data is yours: readable, linkable, searchable, and synced however you already sync your notes.

## What it does

- **Track time per project.** Type a new project name or pick a past one from the dropdown, then start and stop a timer. A live clock ticks in the sidebar and in the status bar (`▶ ProjectX 1:23:45`), so you always know the meter is running.
- **Remember what you did.** When you stop the timer, a small dialog asks *"What did you do?"* — the note lands next to the session in your project file and daily log. (Cancel keeps the timer running, so a stray click never loses time.)
- **Round up for billing — your way.** Sessions can be billed exactly as tracked, or rounded **up** to 6, 15, 30, or 60 minute increments. There's a *separate* rounding setting for invoice totals, so you can log sessions with zero rounding and still round the invoice up.
- **Know what's uninvoiced.** The sidebar shows each project's billable hours since its last invoice point.
- **Mark invoice points.** One click (plus a confirmation) records the invoicable hours in the project's file and resets its clock to zero. If invoice rounding bumped the total, the raw hours are recorded alongside for transparency.
- **Survive restarts.** If Obsidian quits while a timer is running, the timer is still running when you come back — elapsed from the original start time.

## Installing

Time Sync isn't in the community plugin directory (yet), so install it manually:

1. Build the plugin (or grab a release if one is available):
   ```bash
   npm install
   npm run build
   ```
   This produces `main.js` in the repo root.
2. In your vault, create the folder `.obsidian/plugins/time-sync/`.
3. Copy `main.js`, `manifest.json`, and `styles.css` into that folder.
4. In Obsidian, open **Settings → Community plugins**, make sure community plugins are enabled, and toggle on **Time Sync**.
5. Click the clock icon in the ribbon (or run the command **Time Sync: Open panel**) to open the tracker in the right sidebar.

## Using it

| To do this… | …do this |
|---|---|
| Start tracking | Type or pick a project in the sidebar, press **Start** (or run **Time Sync: Start timer**) |
| Stop tracking | Press **Stop** (or run **Time Sync: Stop timer**), optionally describe what you did, press **Save & stop** |
| See uninvoiced hours | Look at the **Uninvoiced** list in the sidebar |
| Bill a project | Press **Invoice** next to the project, confirm the amount |
| Change where data lives, rounding, or daily logs | **Settings → Time Sync** |

## How your data is stored

Everything lives under one folder in your vault — `Time Tracking` by default, changeable in settings. There's no database and no hidden state: the markdown files *are* the data.

```
Time Tracking/
└── Projects/
    └── ProjectX/
        ├── ProjectX.md          ← the project's main note
        └── Daily/
            └── 2026-07-27.md    ← one log note per day
```

Each project is a self-contained folder: its main note and its daily logs travel together, so you can move, link, or archive a whole project as one unit.

### The project file

Each project gets a note like this:

```markdown
---
uninvoiced_minutes: 90
created: 2026-07-01
last_invoice: 2026-07-15
---

# ProjectX

## Sessions

| Date | Start | End | Raw | Billed | Note |
| ---- | ----- | --- | --- | ------ | ---- |
| 2026-07-27 | 09:00 | 10:15 | 1h 15m | 1h 30m | Wrote the docs |

## Invoices

- 2026-07-15: 12.5h
```

- The **frontmatter** is the plugin's source of truth: `uninvoiced_minutes` is the running billable total since the last invoice point, and it's what the sidebar displays. Because it's ordinary frontmatter, you can query it with Dataview or anything else that reads properties.
- The **Sessions table** records every session: exact raw duration and the billed (rounded) duration, plus your note.
- The **Invoices list** grows one line per invoice point. If invoice rounding changed the total, you'll see both: `- 2026-07-27: 3h (raw 2.6h)`.

### The daily logs

If daily logs are enabled (they are by default), each session also appends a line to that project's log note for the day:

```markdown
- 09:00–10:15 (raw 1h 15m, billed 1.5h) — Wrote the docs
```

These are handy for embedding in daily notes or skimming a week's work.

### Make the notes your own

These are ordinary markdown notes, and you're encouraged to edit them by hand — add context, links, headings, whatever makes the record useful to you:

- **Daily logs are fully free-form.** The plugin only ever *appends* a line to the end of the day's file. Reorganize it, add prose around the bullets, embed it in your daily note — new sessions simply land at the bottom.
- **Project files welcome your edits too.** The plugin makes append-only changes (a new row in the Sessions table, a new line in the Invoices list) and updates frontmatter one line at a time. Your own frontmatter properties (tags, aliases, Dataview fields — list values included), prose between sections, and edits to existing session rows and notes are all preserved.

Two small rules of the road:

1. **Keep the `## Sessions` and `## Invoices` headings.** If one goes missing, the plugin recreates it at the bottom of the file rather than losing data — functional, but probably not where you wanted it.
2. **Don't add columns to the Sessions table.** The plugin always appends rows with its six columns, so extra columns would fall out of sync. Put extra detail in the Note column or in prose below the table instead.

### How data is read back

The plugin reads, never guesses: the project dropdown is simply the list of project folders in `Time Tracking/Projects/`, and the uninvoiced totals come straight from each project note's frontmatter. That means the files are safely editable by hand — fix a typo in a note, add tags, link the project file from anywhere. (If you hand-edit `uninvoiced_minutes`, the plugin will believe you — that's a feature.) The active timer itself (project + start time) is stored in the plugin's own settings file, not in your notes, so a half-finished session never litters your vault.

## Settings

| Setting | Default | What it does |
|---|---|---|
| Base folder | `Time Tracking` | Vault folder where all project files and logs live |
| Round billed time up to | No rounding | Per-session rounding: none, 6, 15, 30, or 60 minutes |
| Round invoice totals up to | No rounding | Applied to the uninvoiced total when you mark an invoice point |
| Daily logs | On | Also append each session to `Projects/<name>/Daily/YYYY-MM-DD.md` |

Raw times are always recorded exactly — rounding only ever affects the *billed* numbers.

## Development

```bash
npm install     # install dependencies
npm test        # run the unit tests (vitest)
npm run dev     # rebuild on change
npm run build   # typecheck + production build
```

The core logic (rounding, duration math, markdown serialization) is pure TypeScript with no Obsidian dependency, tested in `tests/`; the Obsidian bindings live in `src/`.
