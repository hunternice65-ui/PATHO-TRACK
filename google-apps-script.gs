
function doPost(e) {
  var result = { status: 'error', message: 'Unknown error' };
  try {
    var data = JSON.parse(e.postData.contents);
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
      
      // Strict Deduplication Check:
      // Compare Type, Case ID, Part, and Date (ignore Additional Info for duplication logic)
      var targetCaseId = data.item.caseId.toString().trim().toLowerCase();
      var targetPart = data.item.part.toString().trim().toLowerCase();
      var targetDate = data.item.date.toString().trim();
      var targetType = data.item.type;

      for (var i = 1; i < rows.length; i++) {
        var rowType = rows[i][1];
        var rowCaseId = rows[i][2].toString().trim().toLowerCase();
        var rowDate = rows[i][3].toString().trim();
        var rowPart = rows[i][4].toString().trim().toLowerCase();

        if (rowType == targetType && 
            rowCaseId == targetCaseId && 
            rowPart == targetPart && 
            rowDate == targetDate) {
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
        result = { status: 'duplicate', message: 'Already exists in spreadsheet' };
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
