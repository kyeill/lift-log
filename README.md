# Lift Log

A small workout log for 3×10 lifting: what was done each session, at what
weight, and when each exercise is ready to move up. Live at
https://kyeill.github.io/lift-log/ — add it to the phone's home screen to use it
like an app.

| Path | What it is |
|------|------------|
| `docs/index.html` | the whole app, hand-written with no build step; Pages serves `docs/` from `main` |
| `docs/manifest.webmanifest`, `docs/sw.js` | make it installable and open offline |
| `apps-script/` | the web app the page reads and writes, bound to the Google Sheet |
| `icons.py` | redraws the icons (needs Pillow; bump `CACHE` in `sw.js` after) |

## The app

Tabs **Push · Pull · Legs · Historical**: one per group in the Sheet, then
Historical. A quick sideways swipe changes tab (no animation). It opens on the
group last used today, else the first. Always dark.

- **Group tab:** one card per exercise. Top: name and tag. Below: when it was
  last done over what it was, − / + for the amount, ✓ to log. Tapping ✓ again
  un-logs it; − / + on a logged card change the logged amount.
- **Date** (group tabs only): the day being logged. ‹ › step a day; tapping the
  label opens the date picker. Yellow on any day but today, never in the future.
  "Last done" is the last entry before that day. Starting the app fresh goes
  back to today.
- **Historical:** 8 weeks per page, ‹ › to page back. Weight rows run blue (low)
  → green → yellow (high) against that exercise's whole history; reps rows have
  no color. Tap a cell for its details.

**Last done** reads Today, Yesterday, the weekday for 2–6 days ago, then "9 days
ago". Import rows have no day: this week's count as Monday, older ones say "Last
week" or "3 weeks ago".

**Tags** look at sessions in a row at the current amount:

| Tag | When |
|-----|------|
| New weight (More reps for reps) | moved up, with at most 2 sessions at the new amount, and not yet Ready |
| Ready for # | 2, 3 or 4 sessions, by how big one step is for that exercise (≤7.5%, ≤15%, bigger) |
| Ready for #, yellow | 8 or more sessions |
| none | anything else |

## The data: the Google Sheet

["Lift Log"](https://docs.google.com/spreadsheets/d/1_ndYlnhrI9IvHM2kL8lKwu4FVdHDpNZxWuW4e9W9zmM)
in Kyle's Drive. Both tabs are safe to edit by hand; columns are found by header
name.

- **Exercises:** `Name | Group | Kind | Step | Id | Short`. This tab is the
  app's config. Row order is the app's order; groups appear in the order they
  first occur. Kind is `weight` or `reps` (blank = weight). Step is how far − / +
  moves (blank = 10 lb or 1 rep). Short is an optional name for Historical. A new
  row gets an Id on the next sync. **Rename freely, but never change an Id**: it
  ties the log to the exercise.
- **Log:** `Date | Week of | Exercise | Amount | Id | Saved`, one row per
  exercise per day. Amount is total lb or reps. Rows without a number are skipped.
  The history imported from "Temp Exercise.xlsx" (Aug 24 – Oct 26 2026) has a
  Week of but no Date, one row per exercise per week, each counted as one session.

Rows for an exercise no longer on the Exercises tab stay in the Log but are not
read (Deadlift, Front Squat).

## Sync

The page keeps a copy in `localStorage`, so it opens with no signal. Changes
apply at once and queue, then send after 0.7 s, and on load, on returning to the
app, on going online, and every 2 minutes. A badge under the tabs appears only
when offline or unable to reach the Sheet.

The web app is `API` at the top of the script in `docs/index.html`:

- `GET` returns `{ok, exercises, log}`.
- `POST {ops:[{op:"set", id, date, amount}, {op:"del", id, date}]}` applies the
  changes and answers the same way. The page sends it as text/plain to avoid a
  CORS preflight, which Apps Script cannot answer.

## Deploying

The page: push to `main`; Pages rebuilds in about a minute. The service worker
fetches the page fresh when online.

The script, from Claude's shell, with clasp:

```bash
export PATH="/c/Program Files/nodejs:/c/Users/kyleh/AppData/Roaming/npm:$PATH"
clasp -P "C:\Users\kyleh\My Drive\Documents\Claude\lift-log" push -f
clasp -P "C:\Users\kyleh\My Drive\Documents\Claude\lift-log" create-deployment -i AKfycbw07XGcy6bStN_AnhQnrdrngdMappvgGmJ7lSxQxsvEJrMaX59-yOGjmqc3J5jZ4eJIlw -d "what changed"
```

`create-deployment -i` repoints the existing deployment, so the page's address
never changes. `.clasp.json` (script id
`1RpgtGGj4nNQJea8f2DAqN0QuxSyl2eYCqFDufT2Q1GYQAKt8LBHbbAnb`) is gitignored.

Local preview: the `lift-log` entry in the parent folder's `.claude/launch.json`
(port 8765), then open `/docs/`. It talks to the real Sheet unless `fetch` is
mocked.

## Traps

- **`clasp create-script` overwrites `appsscript.json`.** The manifest must keep
  `executeAs: USER_DEPLOYING`, `access: ANYONE_ANONYMOUS` and the
  `spreadsheets.currentonly` scope, or the page's calls are refused.
- **A new script, or a change that adds a scope, answers with a Google sign-in
  page until Kyle runs `setup()` once in the editor** and approves it. clasp's
  login does not count.
- **Anyone with the web app address can read and change the log.** The address
  is in this public repo. Accepted: it holds only exercise names and weights.
- **There is no Sheets connector, so editing the Sheet from here takes a
  one-time script.** Add `apps-script/Migrate.js` with a `migrate_()`, call it at
  the top of `doGet`, deploy, make one GET, then remove both and deploy again.
- **Rebuilding from nothing:** the import was removed from the repo once the Sheet
  held it. `setup()` builds empty tabs; the original rows are in git at `4f37b3b`
  (`data/history-import.csv`, `apps-script/Seed.js`).
