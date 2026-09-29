const SHEET_NAME = 'Leads';
const SCRIPT_PROPERTY_SHEET_ID = 'LEADS_SHEET_ID';

const HEADERS = [
  'Timestamp', 'Nama', 'Email perusahaan', 'Perusahaan', 'WhatsApp', 'Persetujuan',
  'Downtime per bulan (jam)', 'Biaya downtime per jam (Rp)', 'Biaya perbaikan reaktif per bulan (Rp)',
  'Target pengurangan breakdown (%)', 'Estimasi kerugian tahunan (Rp)',
  'Potensi penghematan simulasi per tahun (Rp)', 'Source', 'Request ID'
];

function doPost(e) {
  const params = e && e.parameter ? e.parameter : {};
  const requestId = String(params.request_id || '').trim();
  const attemptId = String(params.attempt_id || '').trim();
  const targetOrigin = allowedOrigin(params.source);
  if (!targetOrigin) return HtmlService.createHtmlOutput('Origin tidak diizinkan.');
  if (!requestId || !attemptId || !params.name || !params.email || !params.company || !params.phone || params.consent !== 'yes') {
    return response('error', targetOrigin, requestId, attemptId, params.callback);
  }
  if (params.website) return response('success', targetOrigin, requestId, attemptId, params.callback);

  const sheetId = PropertiesService.getScriptProperties().getProperty(SCRIPT_PROPERTY_SHEET_ID);
  if (!sheetId) return response('error', targetOrigin, requestId, attemptId, params.callback);

  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const spreadsheet = SpreadsheetApp.openById(sheetId);
    const sheet = spreadsheet.getSheetByName(SHEET_NAME) || spreadsheet.insertSheet(SHEET_NAME);
    if (sheet.getLastRow() === 0) sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);

    const lastRow = sheet.getLastRow();
    if (lastRow > 1 && sheet.getRange(2, HEADERS.length, lastRow - 1, 1).createTextFinder(requestId).matchEntireCell(true).findNext()) {
      return response('success', targetOrigin, requestId, attemptId, params.callback);
    }

    sheet.appendRow([
      new Date(),
      safeCell(params.name),
      safeCell(params.email),
      safeCell(params.company),
      safeCell(params.phone),
      'Ya',
      finiteNumber(params.downtime),
      finiteNumber(params.downtime_cost_per_hour),
      finiteNumber(params.reactive_repair_cost_monthly),
      finiteNumber(params.breakdown_reduction_target),
      finiteNumber(params.annual_loss),
      finiteNumber(params.annual_saving),
      safeCell(targetOrigin),
      requestId
    ]);
    return response('success', targetOrigin, requestId, attemptId, params.callback);
  } catch (error) {
    console.error('Gagal menyimpan lead Aseta:', error);
    return response('error', targetOrigin, requestId, attemptId, params.callback);
  } finally {
    if (lock.hasLock()) lock.releaseLock();
  }
}

function response(status, targetOrigin, requestId, attemptId, callbackName) {
  const template = HtmlService.createTemplateFromFile('Response');
  template.targetOrigin = targetOrigin;
  template.payload = safeJson({ type: 'aseta-lead-result', status, requestId, attemptId });
  return template.evaluate().setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function allowedOrigin(source) {
  const match = String(source || '').match(/^(https?:\/\/[^/]+)/);
  const origin = match ? match[1] : '';
  return ['https://pippoauliaa-dev.github.io', 'http://127.0.0.1:8000', 'http://localhost:8000'].includes(origin) ? origin : '';
}

function safeJson(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

function safeCell(value) {
  const text = String(value || '').trim();
  return /^[=+@\-]/.test(text) ? `'${text}` : text;
}

function finiteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}
