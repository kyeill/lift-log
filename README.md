# Lift Log

A small workout log for 3×10 lifting: what was done each session and at what
weight, and when each exercise is ready to move up. Live at
https://kyeill.github.io/lift-log/ — add it to the phone's home screen to use it
like an app.

| Path | What it is |
|------|------------|
| `docs/index.html` | the whole app (hand-written, no build step), served by Pages from `main` |
| `docs/manifest.webmanifest`, `docs/sw.js` | make it installable and open offline |
| `icons.py` | draws the icons into `docs/` (needs Pillow; bump `CACHE` in `sw.js` after) |
| `apps-script/` | the web app the page reads and writes, bound to the "Lift Log" Google Sheet |
| `data/history-import.*` | the one-time load from "Temp Exercise.xlsx" (Aug 24 – Oct 26 2026) |
| `prototypes.html` | the clickable mockups the design was chosen from (fake data) |

## The app

Three tabs, dark all the time (his call, whatever the phone's setting).

- **Today** — the exercises in the groups picked for today (the picker
  remembers the day's choice; otherwise it suggests the two groups done least
  recently). Each card says when it was last done and at what weight, has
  − / + and one ✓ button. ✓ logs it; tapping again un-logs it.
- **This Week** — exercise × day grid with a Last-week column; ‹ › for earlier
  weeks. ▲ marks a move up.
- **Historical** — 8 weeks per page, ‹ › to page back. Each row is colored
  blue (low) → green → yellow (high) against that exercise's whole history.

The weight tag on each card ("Ready for 130", "New weight", "1 of 3") counts
sessions at the current weight. It takes 2, 3 or 4 depending on how big one
step is for that exercise (≤7.5%, ≤15%, bigger). Eight or more sessions at one
weight shows the same "Ready for" tag in yellow.

## The data: the Google Sheet

"Lift Log" in Kyle's Drive
(https://docs.google.com/spreadsheets/d/1_ndYlnhrI9IvHM2kL8lKwu4FVdHDpNZxWuW4e9W9zmM).
Both tabs are safe to edit by hand; columns are found by header name.

- **Exercises** — `Name | Group | Kind | Step | Id`. Row order is the app's
  order, groups appear in the order they first occur. Kind is `weight`, `time`
  (seconds) or `bodyweight`. Step is how far − / + moves (blank = 10 lb, or 15 s
  for time). **Rename freely, but leave Id alone**: it ties the log to the
  exercise. A new row gets an Id on the next sync.
- **Log** — `Date | Week of | Exercise | Amount | Id | Saved`, one row per
  exercise per day. Rows from the spreadsheet import have a Week of but no Date.

The page keeps a copy in `localStorage`, so it opens instantly and works with
no signal; changes queue and are sent when there is a connection (on load,
coming back to the app, going online, and every 2 minutes). A badge under the
tabs appears only when it is offline or cannot reach the Sheet.

The web app (`apps-script/Code.js`): `GET` returns `{ok, exercises, log}`;
`POST {ops:[{op:"set", id, date, amount}, {op:"del", id, date}]}` applies the
changes and answers the same way. The page POSTs as text/plain to avoid a CORS
preflight. Its address is `API` near the top of `docs/index.html`.

Deploying a change to the script — clasp, from Claude's shell:

```bash
export PATH="/c/Program Files/nodejs:/c/Users/kyleh/AppData/Roaming/npm:$PATH"
clasp -P "C:\Users\kyleh\My Drive\Documents\Claude\lift-log" push -f
clasp -P "C:\Users\kyleh\My Drive\Documents\Claude\lift-log" create-deployment -i AKfycbw07XGcy6bStN_AnhQnrdrngdMappvgGmJ7lSxQxsvEJrMaX59-yOGjmqc3J5jZ4eJIlw -d "what changed"
```

`create-deployment -i` makes a new version and repoints the existing
deployment, so the address in the page never changes. `.clasp.json` (script id
`1RpgtGGj4nNQJea8f2DAqN0QuxSyl2eYCqFDufT2Q1GYQAKt8LBHbbAnb`) is gitignored.

## Traps already paid for

- **`clasp create-script` overwrites `appsscript.json`** with a bare default.
  The manifest must keep `executeAs: USER_DEPLOYING`, `access:
  ANYONE_ANONYMOUS` and the `spreadsheets.currentonly` scope, or the page's
  calls are refused.
- **A new script answers with a Google sign-in page until Kyle runs `setup()`
  once in the editor** and approves the permission. clasp's own login does not
  count. The same is true after a change that adds a scope.
- **The log is readable by anyone with the web app address** (it is in the
  page, and the repo is public). Accepted: it holds exercise names and weights.
- **Changing the Exercises tab from here, without Kyle:** there is no
  Sheets API connector. Push a one-time `migrate_()` (own file, called from
  `doGet`), deploy, make one GET, then delete it and deploy again. Done once on
  2026-10-27 for his Push / Pull / Legs list (renames kept Ids; Around the World
  became Kettlebell; Deadlift, Front Squat and Wall Sits removed from the tab,
  their Log rows left in the Sheet but unread). `Seed.js` still has the original
  names; it is only used on an empty Sheet.
- **The import is weekly**: one weight per exercise per week, no day. Those rows
  sit on the week's Monday in This Week and count as one session each.
