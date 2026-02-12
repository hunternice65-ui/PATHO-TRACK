
/**
 * Handle GET requests to fetch all data
 */
function doGet(e) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = getOrCreateSheet(ss, 'Inventory', [
    'ID', 'Type', 'Case ID', 'Date', 'Part', 'Additional Info', 'Status', 'CreatedAt', 'RecordedBy'
  ]);
  var data = [];
  
  var rows = sheet.getDataRange().getValues();
  if (rows.length > 1) {
    for (var i = 1; i < rows.length; i++) {
      data.push({
        id: rows[i][0],
        type: rows[i][1],
        caseId: rows[i][2],
        date: rows[i][3],
        part: rows[i][4],
        additionalInfo: rows[i][5],
        status: rows[i][6],
        createdAt: rows[i][7],
        recordedBy: rows[i][8]
      });
    }
  }

  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Handle POST requests for saving and updating
 */
function doPost(e) {
  var result = { status: 'error', message: 'Unknown error' };
  try {
    var contents = e.postData.contents;
    if (!contents) throw new Error('No content provided');
    
    var data = JSON.parse(contents);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var action = data.action;

    if (action === 'LOG_LOGIN') {
      var sheet = getOrCreateSheet(ss, 'LoginLogs', ['Username', 'Timestamp', 'IP']);
      sheet.appendRow([data.username, data.timestamp, data.ip]);
      result = { status: 'success', message: 'Login logged' };
    }

    else if (action === 'SAVE_ITEM') {
      var sheet = getOrCreateSheet(ss, 'Inventory', [
        'ID', 'Type', 'Case ID', 'Date', 'Part', 'Additional Info', 'Status', 'CreatedAt', 'RecordedBy'
      ]);
      
      var rows = sheet.getDataRange().getValues();
      var isDuplicate = false;
      var normalizeStr = function(val) {
        if (!val) return "";
        return val.toString().replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
      };

      var targetCaseId = normalizeStr(data.item.caseId);
      var targetPart = normalizeStr(data.item.part);
      var targetType = data.item.type;

      for (var i = 1; i < rows.length; i++) {
        if (rows[i][1] == targetType && normalizeStr(rows[i][2]) == targetCaseId && normalizeStr(rows[i][4]) == targetPart) {
          isDuplicate = true;
          break;
        }
      }

      if (!isDuplicate) {
        sheet.appendRow([
          data.item.id, data.item.type, data.item.caseId, data.item.date,
          data.item.part, data.item.additionalInfo, data.item.status,
          data.item.createdAt, data.item.recordedBy
        ]);
        result = { status: 'success' };
      } else {
        result = { status: 'duplicate' };
      }
    }

    else if (action === 'UPDATE_STATUS') {
      var sheet = ss.getSheetByName('Inventory');
      if (!sheet) throw new Error('Inventory sheet not found');
      var rows = sheet.getDataRange().getValues();
      var found = false;
      for (var i = 1; i < rows.length; i++) {
        if (rows[i][0] == data.id) {
          sheet.getRange(i + 1, 7).setValue(data.updates.status);
          sheet.getRange(i + 1, 9).setValue(data.handledBy);
          
          var logSheet = getOrCreateSheet(ss, 'TrackingHistory', ['ItemID', 'CaseID', 'Action', 'User', 'Qty', 'Reason', 'Timestamp', 'HandledBy']);
          logSheet.appendRow([data.id, rows[i][2], data.updates.status, data.updates.borrower || 'System', data.updates.borrowQuantity || 0, data.updates.borrowReason || 'N/A', new Date().toISOString(), data.handledBy]);
          found = true;
          break;
        }
      }
      result = found ? { status: 'success' } : { status: 'not_found' };
    }
  } catch (err) {
    result = { status: 'error', message: err.toString() };
  }

  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

function getOrCreateSheet(ss, name, headers) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#f3f3f3');
  }
  return sheet;
}
