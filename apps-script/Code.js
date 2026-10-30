/**
 * Lift Log data -- the workout log behind https://kyeill.github.io/lift-log/.
 *
 * Bound to the "Lift Log" Google Sheet. Two tabs, both safe to edit by hand;
 * columns are found by their header, so they can be moved:
 *
 *   Exercises  Name | Group | Kind | Step | Id | Short
 *              Row order is the order in the app. Kind is weight or reps
 *              (blank = weight). Step is how far − / + moves (blank = 10 lb or
 *              1 rep). Id ties the log to the exercise, so renaming keeps the
 *              history; a new row gets an Id on the next sync. Short (optional)
 *              is the name the Historical grid shows.
 *   Log        Date | Week of | Exercise | Amount | Id | Saved
 *              One row per exercise per day. Amount is total lb or reps; a row
 *              without a number is skipped. Rows from the spreadsheet import
 *              have a Week of but no Date (the day was not recorded).
 *
 *   GET                                   -> {ok, exercises, log}
 *   POST {ops:[{op:"set", id, date, amount}, {op:"del", id, date}]}
 *                                         -> applies them, answers like GET
 *
 * The page POSTs as text/plain so the browser sends it without a CORS
 * preflight, which Apps Script cannot answer.
 *
 * Deployed with clasp (see the README); runs as Kyle, callable by anyone.
 */

var EX_HEAD = ["Name", "Group", "Kind", "Step", "Id", "Short"];
var LOG_HEAD = ["Date", "Week of", "Exercise", "Amount", "Id", "Saved"];
var DATE = /^\d{4}-\d{2}-\d{2}$/;

// Run from the editor: asks for permission and builds any missing tab.
function setup() {
  var ss = SpreadsheetApp.getActive();
  tab_(ss, "Exercises", EX_HEAD);
  tab_(ss, "Log", LOG_HEAD).getRange("A:B").setNumberFormat("@");
}

function doGet(e) {
  return json_(read_());
}

function doPost(e) {
  var body;
  try {
    body = JSON.parse((e.postData && e.postData.contents) || "{}");
  } catch (err) {
    return json_({ ok: false, error: "body is not JSON" });
  }
  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    apply_(body.ops || []);
    return json_(read_());
  } finally {
    lock.releaseLock();
  }
}

/* ---------- reading ---------- */

function read_() {
  var ss = SpreadsheetApp.getActive();
  var exercises = readExercises_(ss.getSheetByName("Exercises"));
  var known = {};
  exercises.forEach(function (x) { known[x.id] = true; });
  var t = table_(ss.getSheetByName("Log"), LOG_HEAD), log = [];
  t.rows.forEach(function (r) {
    var id = String(r[t.col.Id] || "").trim();
    if (!known[id]) return;
    var date = day_(r[t.col.Date]), week = day_(r[t.col["Week of"]]) || (date && monday_(date));
    var a = r[t.col.Amount];
    if (!week || a === "" || isNaN(a)) return;
    log.push({ id: id, date: date || null, week: week, amount: Number(a) });
  });
  return { ok: true, exercises: exercises, log: log };
}

function readExercises_(sh) {
  var t = table_(sh, EX_HEAD), out = [], used = {};
  t.rows.forEach(function (r, i) {
    var name = String(r[t.col.Name] || "").trim();
    if (!name) return;
    var id = String(r[t.col.Id] || "").trim();
    if (!id || used[id]) {
      id = slug_(name, used);
      sh.getRange(i + 2, t.col.Id + 1).setValue(id);
    }
    used[id] = true;
    var kind = String(r[t.col.Kind]).trim().toLowerCase() === "reps" ? "reps" : "weight";
    var step = Number(r[t.col.Step]) || (kind === "reps" ? 1 : 10);
    var x = { id: id, name: name, group: String(r[t.col.Group] || "Other").trim(), kind: kind, step: step };
    var short = String(r[t.col.Short] || "").trim();
    if (short) x.short = short;
    out.push(x);
  });
  return out;
}

/* ---------- writing ---------- */

function apply_(ops) {
  if (!ops.length) return;
  var ss = SpreadsheetApp.getActive();
  var names = {};
  readExercises_(ss.getSheetByName("Exercises")).forEach(function (x) { names[x.id] = x.name; });
  var sh = ss.getSheetByName("Log"), t = table_(sh, LOG_HEAD);
  var at = {};   // "id|date" -> sheet row
  t.rows.forEach(function (r, i) {
    var d = day_(r[t.col.Date]);
    if (d) at[String(r[t.col.Id]).trim() + "|" + d] = i + 2;
  });
  var now = new Date(), doomed = [], appends = [];
  ops.forEach(function (o) {
    var id = String(o.id || ""), date = String(o.date || "");
    if (!names[id] || !DATE.test(date)) return;
    var key = id + "|" + date, row = at[key];
    if (o.op === "del") {
      if (row) { doomed.push(row); delete at[key]; }
      return;
    }
    if (o.op !== "set" || typeof o.amount !== "number") return;
    if (row) {
      sh.getRange(row, t.col.Amount + 1).setValue(o.amount);
      sh.getRange(row, t.col.Saved + 1).setValue(now);
    } else {
      var line = new Array(t.width).fill("");
      line[t.col.Date] = date;
      line[t.col["Week of"]] = monday_(date);
      line[t.col.Exercise] = names[id];
      line[t.col.Amount] = o.amount;
      line[t.col.Id] = id;
      line[t.col.Saved] = now;
      appends.push(line);
    }
  });
  // The page sends at most one op per exercise and day, so an append is never
  // also deleted in the same batch. Date and Week of are text columns (setup).
  if (appends.length) {
    var start = sh.getLastRow() + 1;
    sh.getRange(start, 1, appends.length, t.width).setValues(appends);
    sh.getRange(start, t.col.Saved + 1, appends.length, 1).setNumberFormat("yyyy-mm-dd hh:mm");
  }
  doomed.sort(function (a, b) { return b - a; }).forEach(function (r) { sh.deleteRow(r); });
}

/* ---------- helpers ---------- */

function tab_(ss, name, head) {
  var sh = ss.getSheetByName(name) || ss.insertSheet(name);
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, head.length).setValues([head]).setFontWeight("bold");
    sh.setFrozenRows(1);
  }
  return sh;
}

// Rows under the header, plus each header's column index. Missing headers are
// added at the right so a hand-edited tab still works.
function table_(sh, head) {
  var width = Math.max(sh.getLastColumn(), 1);
  var first = sh.getRange(1, 1, 1, width).getValues()[0].map(function (h) { return String(h).trim(); });
  var col = {};
  head.forEach(function (h) {
    var i = first.indexOf(h);
    if (i < 0) {
      i = first.length;
      first.push(h);
      sh.getRange(1, i + 1).setValue(h).setFontWeight("bold");
    }
    col[h] = i;
  });
  width = first.length;
  var n = sh.getLastRow() - 1;
  var rows = n > 0 ? sh.getRange(2, 1, n, width).getValues() : [];
  return { col: col, rows: rows, width: width };
}

function day_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone(), "yyyy-MM-dd");
  var s = String(v || "").trim();
  return DATE.test(s) ? s : "";
}

function monday_(date) {
  var p = date.split("-"), d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]), 12);
  d.setDate(d.getDate() - (d.getDay() + 6) % 7);
  return Utilities.formatDate(d, Session.getScriptTimeZone(), "yyyy-MM-dd");
}

function slug_(name, used) {
  var base = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "exercise", id = base, n = 2;
  while (used[id]) id = base + "-" + n++;
  return id;
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
