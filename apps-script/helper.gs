// ============================================================
//  MTQ 2026 — helper.gs  (rev 7)
//  Fix: proper logger with sheet+console, token fix
// ============================================================

// ════════════════════════════════════════════════════════════
//  LOGGER — tulis ke console GAS + sheet LOG
// ════════════════════════════════════════════════════════════
var _logBuffer = [];   // buffer agar appendRow tidak dipanggil tiap baris

function logInfo (ctx, msg, data) { _log('INFO',  ctx, msg, data); }
function logWarn (ctx, msg, data) { _log('WARN',  ctx, msg, data); }
function logError(ctx, msg, data) { _log('ERROR', ctx, msg, data); }

function _log(level, ctx, msg, data) {
  var line = '[MTQ2026][' + level + '][' + ctx + '] ' + msg;
  if (data !== undefined) line += ' | ' + JSON.stringify(data);
  Logger.log(line);
  _logBuffer.push([new Date().toISOString(), level, ctx, msg,
                   data !== undefined ? JSON.stringify(data) : '']);
}

function _flushLog(ss) {
  if (!_logBuffer.length) return;
  try {
    var sheet = ss ? ss.getSheetByName(SHEET_LOG) : null;
    if (!sheet) {
      if (!ss) ss = SpreadsheetApp.openById(SPREADSHEET_ID);
      sheet = getOrCreateSheet_(ss, SHEET_LOG, ['timestamp','level','context','message','data']);
    }
    sheet.getRange(sheet.getLastRow()+1, 1, _logBuffer.length, 5).setValues(_logBuffer);
  } catch(e) { Logger.log('[MTQ2026] _flushLog error: ' + e.message); }
  _logBuffer = [];
}

// ════════════════════════════════════════════════════════════
//  AUTH — token berbasis hash + timestamp sesi (1 jam)
// ════════════════════════════════════════════════════════════
var TOKEN_TTL_MS = 3600 * 1000 * 8;   // token valid 8 jam

function genToken_() {
  // Slot waktu 8 jam agar token tidak berubah di tengah sesi
  var slot = Math.floor(Date.now() / TOKEN_TTL_MS);
  var raw  = 'MTQ2026_' + ADMIN_PASSWORD + '_slot' + slot;
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,
                                      raw, Utilities.Charset.UTF_8);
  return bytes.map(function(b){
    return ('0' + (b & 0xFF).toString(16)).slice(-2);
  }).join('');
}

function isTokenValid_(token) {
  if (!token) return false;
  // Cek slot sekarang DAN slot sebelumnya (agar token di ujung slot tidak langsung expire)
  var slot  = Math.floor(Date.now() / TOKEN_TTL_MS);
  var raw1  = 'MTQ2026_' + ADMIN_PASSWORD + '_slot' + slot;
  var raw2  = 'MTQ2026_' + ADMIN_PASSWORD + '_slot' + (slot - 1);
  function toHex(raw) {
    return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,
                                   raw, Utilities.Charset.UTF_8)
      .map(function(b){ return ('0'+(b&0xFF).toString(16)).slice(-2); }).join('');
  }
  return String(token) === toHex(raw1) || String(token) === toHex(raw2);
}

// ════════════════════════════════════════════════════════════
//  REGISTRATION STATUS
// ════════════════════════════════════════════════════════════
function isRegistrationOpen_() {
  if (PENDAFTARAN_CONFIG.OVERRIDE === true)  return { open:true,  status:'buka' };
  if (PENDAFTARAN_CONFIG.OVERRIDE === false) return { open:false, status:'tutup' };
  var now   = new Date();
  var buka  = new Date(PENDAFTARAN_CONFIG.BUKA);
  var tutup = new Date(PENDAFTARAN_CONFIG.TUTUP);
  if (now < buka)  return { open:false, status:'belum_buka' };
  if (now < tutup) return { open:true,  status:'buka' };
  return { open:false, status:'tutup' };
}

// ════════════════════════════════════════════════════════════
//  AGE & GENDER VALIDATION
// ════════════════════════════════════════════════════════════
function calcAgeAtCutoff_(dobString) {
  if (!dobString) return { tahun:0, bulan:0, hari:0, display:'—' };
  var dob = new Date(dobString + 'T00:00:00');
  var ref = new Date(PENDAFTARAN_CONFIG.AGE_CUTOFF_DATE + 'T00:00:00');
  var tahun = ref.getFullYear() - dob.getFullYear();
  var bulan = ref.getMonth()    - dob.getMonth();
  var hari  = ref.getDate()     - dob.getDate();
  if (hari < 0) { bulan--; hari += new Date(ref.getFullYear(), ref.getMonth(), 0).getDate(); }
  if (bulan < 0) { tahun--; bulan += 12; }
  return { tahun:tahun, bulan:bulan, hari:hari,
           display: tahun+' thn '+bulan+' bln '+hari+' hr' };
}

// FIX #10: umur_min=0 → skip lower bound
function validateAge_(age, umurMin, maxTahun, maxBulan, maxHari) {
  if (umurMin > 0 && age.tahun < umurMin)
    return { ok:false, msg:'Usia '+age.display+' kurang dari minimum '+umurMin+' tahun' };
  if (maxTahun < 99) {
    if (age.tahun > maxTahun) return _tooOld(age, maxTahun, maxBulan, maxHari);
    if (age.tahun === maxTahun) {
      if (age.bulan > maxBulan) return _tooOld(age, maxTahun, maxBulan, maxHari);
      if (age.bulan === maxBulan && age.hari > maxHari) return _tooOld(age, maxTahun, maxBulan, maxHari);
    }
  }
  return { ok:true, msg:'Usia valid: '+age.display };
}
function _tooOld(age, thn, bln, hr) {
  return { ok:false, msg:'Usia '+age.display+' melebihi batas maks. '+thn+' thn'+
           (bln?' '+bln+' bln':'')+((hr&&bln===0)||hr?' '+hr+' hr':'') };
}

function validateGender_(jenisKelamin, genderCabang) {
  if (!genderCabang || genderCabang === 'Semua') return { ok:true };
  var required = genderCabang === 'L' ? 'Laki-laki' : 'Perempuan';
  if (jenisKelamin !== required)
    return { ok:false, msg:'Cabang ini hanya untuk '+required+'. Peserta ('+jenisKelamin+') tidak sesuai.' };
  return { ok:true };
}

// ════════════════════════════════════════════════════════════
//  NIK DUPLICATE CHECK
// ════════════════════════════════════════════════════════════
function checkNIKDuplicate_(sheet, nikList) {
  if (!nikList || !nikList.length) return { isDuplicate:false };
  if (sheet.getLastRow() <= 1) return { isDuplicate:false };
  var rows = sheet.getRange(2,1,sheet.getLastRow()-1,PENDAFTAR_HEADERS.length).getValues();
  var existing = [];
  rows.forEach(function(row) {
    var s = String(row[COL.STATUS_VERIFIKASI]||'').toLowerCase();
    if (s === 'nonaktif') return;
    existing.push(String(row[COL.NIK]||'').trim());
    var aj = row[COL.ANGGOTA_JSON];
    if (aj) { try { JSON.parse(aj).forEach(function(a){if(a.nik)existing.push(String(a.nik).trim());}); } catch(e){} }
  });
  for (var i=0; i<nikList.length; i++) {
    var nik = String(nikList[i]).trim();
    if (!nik) continue;
    if (existing.indexOf(nik) !== -1) return { isDuplicate:true, nik:nik,
      msg:'NIK '+nik+' sudah terdaftar. Satu NIK hanya boleh mendaftar satu kali.' };
  }
  return { isDuplicate:false };
}

// ════════════════════════════════════════════════════════════
//  SHEET HELPERS
// ════════════════════════════════════════════════════════════
function getOrCreateSheet_(ss, name, headers, defaultData) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    logInfo('helper','Buat sheet: '+name);
    sheet = ss.insertSheet(name);
    if (headers && headers.length) {
      sheet.appendRow(headers);
      sheet.getRange(1,1,1,headers.length)
           .setBackground('#065f46').setFontColor('#ffffff').setFontWeight('bold');
      sheet.setFrozenRows(1);
    }
    if (defaultData && defaultData.length) {
      sheet.getRange(2,1,defaultData.length,defaultData[0].length).setValues(defaultData);
    }
    sheet.autoResizeColumns(1, headers ? headers.length : 1);
  }
  return sheet;
}

function initAllSheets() {
  logInfo('helper','initAllSheets START');
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  getOrCreateSheet_(ss, SHEET_CONFIG,    CONFIG_HEADERS,    DEFAULT_CONFIG_DATA);
  getOrCreateSheet_(ss, SHEET_PENDAFTAR, PENDAFTAR_HEADERS);
  getOrCreateSheet_(ss, SHEET_LOG,       ['timestamp','level','context','message','data']);

  var pendSheet = ss.getSheetByName(SHEET_PENDAFTAR);
  if (pendSheet) {
    try {
      pendSheet.getRange(2,COL.STATUS_VERIFIKASI+1,1000,1).setDataValidation(
        SpreadsheetApp.newDataValidation()
          .requireValueInList(['Menunggu','Terverifikasi','Ditolak','Nonaktif'],true).build());
      pendSheet.setFrozenColumns(2);
    } catch(e) { logWarn('helper','initAllSheets setDataValidation error: '+e.message); }
  }
  _flushLog(ss);
  return 'initAllSheets selesai. Sheet: '+ss.getSheets().map(function(s){return s.getName();}).join(', ');
}

function rowToObj_(row) {
  var obj = {};
  PENDAFTAR_HEADERS.forEach(function(h,i){ obj[h] = row[i]!==undefined ? row[i] : ''; });
  if (obj.anggota_json) { try { obj.anggota = JSON.parse(obj.anggota_json); } catch(e){ obj.anggota=[]; } }
  return obj;
}

function countByCabang_(sheet, cabang) {
  if (sheet.getLastRow()<=1) return 0;
  var data = sheet.getRange(2,COL.CABANG_LOMBA+1,sheet.getLastRow()-1,1).getValues();
  return data.filter(function(r){ return String(r[0]).trim()===String(cabang).trim(); }).length;
}

function writeLog_(ss, action, detail, status) {
  _log(status==='ok'?'INFO':'WARN', 'AUDIT', action, {detail:detail,status:status});
  _flushLog(ss);
}