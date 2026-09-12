/**
 * LeadEstate chatbot — Google Apps Script Web App (Google Sheet only)
 *
 * One-time setup
 * --------------
 * 1. Create a Google Sheet (or open an existing one). Copy its ID from the URL:
 *    https://docs.google.com/spreadsheets/d/SHEET_ID_HERE/edit
 * 2. Open https://script.google.com → New project → paste this whole file.
 * 3. Set the Sheet ID in ONE of these places (in order of priority):
 *      a) Project settings → Script properties → add property:
 *           name:  SHEET_ID
 *           value: <your sheet id>
 *      b) Or hardcode SHEET_ID_FALLBACK below.
 * 4. Optional: run `setup()` once from the editor (Run ▶) — it triggers the
 *    Google permission prompt and writes a smoke-test row to the "Leads" tab.
 * 5. Deploy → New deployment → Type: Web app
 *      Execute as: Me
 *      Who has access: Anyone
 * 6. Copy the Web App URL and paste it into the chatbot
 *    (DEFAULT_CHAT.scriptUrl in index.html, or pass ?script=… on the iframe).
 *
 * After editing this script: Deploy → Manage deployments → ✎ → New version → Deploy.
 *
 * Troubleshooting
 * ---------------
 * - "SHEET_ID not configured"  → add Script property SHEET_ID, or set
 *   SHEET_ID_FALLBACK below, then redeploy a new version.
 * - "You do not have permission..." → open the Sheet → Share → add the same
 *   Google account you chose under "Execute as: Me" as Editor.
 * - The "Leads" tab is created automatically with headers on first use.
 *   Adding a new field later? Add it to EXPECTED_HEADERS; it will be appended
 *   to existing sheets at the next request, without disturbing old rows.
 */

/* --------- Config --------- */

/** Hardcode the sheet ID here if you do not use Script Properties. */
var SHEET_ID_FALLBACK = "";

/** Sheet tab where leads are appended. */
var LEADS_SHEET_NAME = "Leads";

/** Column order for new sheets. Existing sheets just get missing columns appended. */
var EXPECTED_HEADERS = [
  "Timestamp",
  "MicrositeId",
  "ProjectName",
  "BrokerName",
  "AgentName",
  "Name",
  "Phone",
  "Configuration",
  "SourceAction",
  "Budget",
  "PropertyType"
];

/* --------- Web app entry points --------- */

function doGet() {
  var sheetId = getSheetId_();
  return jsonResponse_(200, {
    ok: true,
    service: "LeadEstate leads → Google Sheet",
    sheetConfigured: Boolean(sheetId)
  });
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
  } catch (lockErr) {
    return jsonResponse_(503, { ok: false, error: "Script busy, retry shortly" });
  }

  try {
    if (!e || !e.postData || !e.postData.contents) {
      return jsonResponse_(400, { ok: false, error: "Missing body" });
    }

    var body;
    try {
      body = JSON.parse(e.postData.contents);
    } catch (parseErr) {
      return jsonResponse_(400, { ok: false, error: "Invalid JSON" });
    }

    var micrositeId = trim_(body.micrositeId);
    var name = trim_(body.name);
    var phone = trim_(body.phone);

    if (!micrositeId) {
      return jsonResponse_(400, { ok: false, error: "micrositeId required" });
    }
    if (!name || !phone) {
      return jsonResponse_(400, { ok: false, error: "name and phone required" });
    }

    var sheetId = getSheetId_();
    if (!sheetId) {
      return jsonResponse_(500, { ok: false, error: "SHEET_ID not configured" });
    }

    var record = buildRecord_(body, { micrositeId: micrositeId, name: name, phone: phone });

    var sheet = getOrCreateSheet_(SpreadsheetApp.openById(sheetId), LEADS_SHEET_NAME);
    ensureHeaders_(sheet);
    appendRecord_(sheet, record);

    return jsonResponse_(200, { ok: true, micrositeId: micrositeId });
  } catch (err) {
    return jsonResponse_(500, { ok: false, error: errorMessage_(err) });
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}

/* --------- Helpers --------- */

/**
 * Run me once from the editor to grant permissions and write a test row.
 * Open the sheet afterwards: row "setup-smoke-test" should be present.
 */
function setup() {
  var sheetId = getSheetId_();
  if (!sheetId) {
    throw new Error(
      "SHEET_ID not configured. Add a Script property named SHEET_ID, or set SHEET_ID_FALLBACK."
    );
  }
  var sheet = getOrCreateSheet_(SpreadsheetApp.openById(sheetId), LEADS_SHEET_NAME);
  ensureHeaders_(sheet);
  appendRecord_(sheet, buildRecord_(
    {
      projectName: "setup",
      brokerName: "setup",
      agentName: "setup",
      configuration: "test",
      sourceAction: "setup-smoke-test",
      timestamp: new Date().toISOString()
    },
    { micrositeId: "setup-smoke-test", name: "Setup", phone: "0000000000" }
  ));
  Logger.log("OK: wrote smoke-test row to '" + LEADS_SHEET_NAME + "' in sheet " + sheetId);
}

function buildRecord_(body, required) {
  return {
    Timestamp: formatTimestamp_(body.timestamp),
    MicrositeId: required.micrositeId,
    ProjectName: trim_(body.projectName),
    BrokerName: trim_(body.brokerName),
    AgentName: trim_(body.agentName),
    Name: required.name,
    Phone: required.phone,
    Configuration: trim_(body.configuration),
    SourceAction: trim_(body.sourceAction),
    Budget: trim_(body.budget),
    PropertyType: trim_(body.propertyType)
  };
}

/**
 * Parse the incoming ISO timestamp and format it in the script's timezone
 * (Project settings → Time zone) as `11 May 2026, 03:56 PM`.
 */
function formatTimestamp_(rawValue) {
  var d = rawValue ? new Date(rawValue) : new Date();
  if (isNaN(d.getTime())) d = new Date();
  return Utilities.formatDate(d, Session.getScriptTimeZone(), "dd MMM yyyy, hh:mm a");
}

function getSheetId_() {
  var props = PropertiesService.getScriptProperties();
  // Accept SHEET_ID first (recommended). "Chat_Bot" is kept for backwards
  // compatibility with earlier setups; remove if you never used that name.
  var fromProps = trim_(props.getProperty("SHEET_ID")) || trim_(props.getProperty("Chat_Bot"));
  return fromProps || trim_(SHEET_ID_FALLBACK);
}

function getOrCreateSheet_(ss, name) {
  return ss.getSheetByName(name) || ss.insertSheet(name);
}

function ensureHeaders_(sheet) {
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(EXPECTED_HEADERS);
    styleHeaderRow_(sheet, EXPECTED_HEADERS.length);
    return;
  }
  var lastCol = sheet.getLastColumn();
  var existing = readRow_(sheet, 1, lastCol);
  EXPECTED_HEADERS.forEach(function (h) {
    if (existing.indexOf(h) === -1) {
      lastCol += 1;
      sheet.getRange(1, lastCol).setValue(h);
      existing.push(h);
    }
  });
  styleHeaderRow_(sheet, lastCol);
}

function appendRecord_(sheet, record) {
  var headers = readRow_(sheet, 1, sheet.getLastColumn());
  var row = headers.map(function (h) {
    return Object.prototype.hasOwnProperty.call(record, h) ? record[h] : "";
  });
  sheet.appendRow(row);
}

function styleHeaderRow_(sheet, cols) {
  if (cols < 1) return;
  var range = sheet.getRange(1, 1, 1, cols);
  range.setFontWeight("bold").setBackground("#f3f4f6");
  if (sheet.getFrozenRows() < 1) sheet.setFrozenRows(1);
}

function readRow_(sheet, rowIndex, lastCol) {
  if (lastCol < 1) return [];
  return sheet.getRange(rowIndex, 1, 1, lastCol).getValues()[0].map(function (v) {
    return String(v == null ? "" : v).trim();
  });
}

function jsonResponse_(statusCode, obj) {
  if (statusCode >= 400 && obj && typeof obj === "object") {
    obj.httpStatus = statusCode;
  }
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function trim_(v) {
  return String(v == null ? "" : v).trim();
}

function errorMessage_(err) {
  if (!err) return "Unknown error";
  if (typeof err === "string") return err;
  if (err.message) return String(err.message);
  return String(err);
}
