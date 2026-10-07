const SHEET_NAME = 'Leads';
const SCRIPT_PROPERTY_SHEET_ID = 'LEADS_SHEET_ID';

const HEADERS = [
  'Timestamp', 'Nama', 'Email perusahaan', 'Perusahaan', 'Jabatan', 'WhatsApp', 'Persetujuan',
  'Downtime per bulan (jam)', 'Biaya downtime per jam (Rp)', 'Biaya perbaikan reaktif per bulan (Rp)',
  'Target pengurangan breakdown (%)', 'Estimasi kerugian tahunan (Rp)',
  'Potensi penghematan simulasi per tahun (Rp)', 'Source',
  'UTM Source', 'UTM Medium', 'UTM Campaign', 'UTM Content', 'UTM Term', 'Meta Click ID', 'Request ID'
];

function doPost(e) {
  const params = e && e.parameter ? e.parameter : {};
  const requestId = String(params.request_id || '').trim();
  const attemptId = String(params.attempt_id || '').trim();
  const targetOrigin = allowedOrigin(params.source);
  if (!targetOrigin) return HtmlService.createHtmlOutput('Origin tidak diizinkan.');
  if (!requestId || !attemptId || !params.name || !params.email || !params.company || !params.position || !params.phone || params.consent !== 'yes') {
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
    prepareLeadSheet(sheet);

    const lastRow = sheet.getLastRow();
    const headerRow = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const requestIdColumn = headerRow.indexOf('Request ID') + 1;
    if (lastRow > 1 && requestIdColumn > 0 && sheet.getRange(2, requestIdColumn, lastRow - 1, 1).createTextFinder(requestId).matchEntireCell(true).findNext()) {
      return response('success', targetOrigin, requestId, attemptId, params.callback);
    }

    sheet.appendRow([
      new Date(),
      safeCell(params.name),
      safeCell(params.email),
      safeCell(params.company),
      safeCell(params.position),
      normalizePhone(params.phone),
      'Ya',
      finiteNumber(params.downtime),
      finiteNumber(params.downtime_cost_per_hour),
      finiteNumber(params.reactive_repair_cost_monthly),
      finiteNumber(params.breakdown_reduction_target),
      finiteNumber(params.annual_loss),
      finiteNumber(params.annual_saving),
      safeCell(targetOrigin),
      safeCell(params.utm_source),
      safeCell(params.utm_medium),
      safeCell(params.utm_campaign),
      safeCell(params.utm_content),
      safeCell(params.utm_term),
      safeCell(params.fbclid),
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

function normalizePhone(value) {
  let digits = String(value || '').replace(/\D/g, '');
  if (digits.startsWith('0062')) digits = digits.slice(4);
  else if (digits.startsWith('62')) digits = digits.slice(2);
  else if (digits.startsWith('0')) digits = digits.slice(1);
  return digits ? `62${digits}` : '';
}

function prepareLeadSheet(sheet) {
  const lastColumn = sheet.getLastColumn();
  if (lastColumn === 0) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    return;
  }

  const headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
  const positionIndex = headers.indexOf('Jabatan');
  const phoneIndex = headers.indexOf('WhatsApp');
  if (positionIndex < 0 && phoneIndex >= 0) {
    sheet.insertColumnBefore(phoneIndex + 1);
    sheet.getRange(1, phoneIndex + 1).setValues([['Jabatan']]);
  } else if (positionIndex < 0) {
    sheet.getRange(1, lastColumn + 1).setValues([['Jabatan']]);
  }

  const updatedHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const requestIdIndex = updatedHeaders.indexOf('Request ID');
  if (requestIdIndex >= 0) {
    const attributionHeaders = HEADERS.slice(HEADERS.indexOf('UTM Source'), HEADERS.indexOf('Request ID'));
    const missingHeaders = attributionHeaders.filter(header => !updatedHeaders.includes(header));
    if (missingHeaders.length) {
      const insertionColumn = requestIdIndex + 1;
      missingHeaders.forEach((header, index) => {
        const column = insertionColumn + index;
        sheet.insertColumnBefore(column);
        sheet.getRange(1, column).setValues([[header]]);
      });
    }
  }

  const finalHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const updatedPhoneIndex = finalHeaders.indexOf('WhatsApp');
  const lastRow = sheet.getLastRow();
  if (updatedPhoneIndex >= 0 && lastRow > 1) {
    const phoneColumn = updatedPhoneIndex + 1;
    const phones = sheet.getRange(2, phoneColumn, lastRow - 1, 1).getValues();
    sheet.getRange(2, phoneColumn, lastRow - 1, 1).setValues(phones.map(([phone]) => [normalizePhone(phone)]));
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
