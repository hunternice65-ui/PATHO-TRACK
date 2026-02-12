
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
      
      // Normalization function for Server-side deduplication
      var normalizeStr = function(val) {
        if (!val) return "";
        return val.toString().replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
      };

      var targetCaseId = normalizeStr(data.item.caseId);
      var targetPart = normalizeStr(data.item.part);
      var targetType = data.item.type;

      // Scan existing rows (Starts from index 1 to skip headers)
      for (var i = 1; i < rows.length; i++) {
        var rowType = rows[i][1];
        var rowCaseId = normalizeStr(rows[i][2]);
        var rowPart = normalizeStr(rows[i][4]);

        if (rowType == targetType && rowCaseId == targetCaseId && rowPart == targetPart) {
          isDuplicate = true;
          break;
        }
      }

      if (!isDuplicate) {
        sheet.appendRow([
          data.item.id,
          data.item.type,
          data.item.caseId,
          data.item.date,
          data.item.part,
          data.item.additionalInfo,
          data.item.status,
          data.item.createdAt,
          data.item.recordedBy
        ]);
        result = { status: 'success', message: 'Item saved' };
      } else {
        result = { status: 'duplicate', message: 'Blocked: Duplicate entry detected' };
      }
    }

    else if (action === 'UPDATE_STATUS') {
      var sheet = ss.getSheetByName('Inventory');
      if (!sheet) throw new Error('Inventory sheet not found');
      
      var rows = sheet.getDataRange().getValues();
      var found = false;
      
      for (var i = 1; i < rows.length; i++) {
        // Find by Unique UUID
        if (rows[i][0] == data.id) {
          sheet.getRange(i + 1, 7).setValue(data.updates.status);
          sheet.getRange(i + 1, 9).setValue(data.handledBy);
          
          var logSheet = getOrCreateSheet(ss, 'TrackingHistory', ['ItemID', 'CaseID', 'Action', 'User', 'Qty', 'Reason', 'Timestamp', 'HandledBy']);
          logSheet.appendRow([
            data.id, 
            rows[i][2], 
            data.updates.status, 
            data.updates.borrower || 'System',
            data.updates.borrowQuantity || 0,
            data.updates.borrowReason || 'N/A',
            new Date().toISOString(),
            data.handledBy
          ]);
          found = true;
          break;
        }
      }
      result = found ? { status: 'success' } : { status: 'not_found' };
    }

  } catch (err) {
    result = { status: 'error', message: err.toString() };
  }

  // ContentService output is required for GAS but may be opaque to Vercel
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
