var SHEET = "board";
var MAX_USERS = 300;

function getSheet_() {
  var ss = SpreadsheetApp.getActive();
  var s = ss.getSheetByName(SHEET);
  if (!s) {
    s = ss.insertSheet(SHEET);
  }
  if (s.getLastRow() === 0) {
    s.appendRow(["id", "name", "juz", "week", "wk", "all", "t"]);
  }
  return s;
}

function out_(o) {
  var t = ContentService.createTextOutput(JSON.stringify(o));
  t.setMimeType(ContentService.MimeType.JSON);
  return t;
}

function cleanName_(s) {
  var t = String(s || "");
  t = t.replace(/[<>&=+@]/g, "");
  t = t.replace(/\s+/g, " ");
  return t.trim().slice(0, 20);
}

function num_(v, max) {
  var n = Math.floor(Number(v) || 0);
  return Math.max(0, Math.min(max, n));
}

function doGet(e) {
  var p = e.parameter || {};
  if (p.a !== "top") {
    return out_({ ok: true });
  }
  var rows = getSheet_().getDataRange().getValues().slice(1);
  var week = String(p.week || "");
  var me = String(p.id || "");
  var list = [];
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    list.push({
      name: r[1],
      juz: r[2],
      all: r[5],
      wk: String(r[3]) === week ? r[4] : 0,
      me: String(r[0]) === me
    });
  }
  list.sort(function (a, b) {
    return b.all - a.all;
  });
  return out_({ list: list });
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var d = JSON.parse(e.postData.contents);
    var s = getSheet_();
    var id = String(d.id || "");
    if (id.length < 8 || id.length > 40) {
      return out_({ error: "bad id" });
    }
    var col = s.getRange(1, 1, s.getLastRow(), 1).getValues();
    var row = 0;
    for (var i = 0; i < col.length; i++) {
      if (String(col[i][0]) === id) {
        row = i + 1;
      }
    }
    if (d.a === "leave") {
      if (row > 1) {
        s.deleteRow(row);
      }
      return out_({ ok: true });
    }
    var name = cleanName_(d.name);
    if (d.a !== "score" || name.length < 2) {
      return out_({ error: "bad data" });
    }
    var vals = [
      id,
      name,
      num_(d.juz, 30),
      String(d.week || "").slice(0, 12),
      num_(d.wk, 100000),
      num_(d.all, 1000000),
      new Date()
    ];
    if (row > 1) {
      s.getRange(row, 1, 1, 7).setValues([vals]);
    } else {
      s.appendRow(vals);
    }
    var n = s.getLastRow() - 1;
    if (n > MAX_USERS) {
      var all = s.getRange(2, 1, n, 7).getValues();
      all.sort(function (a, b) {
        return b[5] - a[5];
      });
      all = all.slice(0, MAX_USERS);
      s.getRange(2, 1, n, 7).clearContent();
      s.getRange(2, 1, all.length, 7).setValues(all);
    }
    return out_({ ok: true });
  } finally {
    lock.releaseLock();
  }
}
