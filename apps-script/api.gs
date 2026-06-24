// ============================================================
//  MTQ 2026 — apps-script/api.gs  (rev 6)
//  Fix #3: NIK dup check, #6: bank fields, #7: sertifikat upload
// ============================================================

var CABANG_PREFIX = [
  { key:"Tartil Al Qur'an",         prefix:'TA' },

  { key:'Tilawah Anak-anak',        prefix:'TLA' },
  { key:'Tilawah Remaja',           prefix:'TLR' },
  { key:'Tilawah Dewasa',           prefix:'TLD' },

  { key:"Qira'at Mujawwad",         prefix:'QM' },

  { key:'Hafalan 1 Juz',            prefix:'H1J' },
  { key:'Hafalan 5 Juz',            prefix:'H5J' },
  { key:'Hafalan 10 Juz',           prefix:'H10J' },
  { key:'Hafalan 20 Juz',           prefix:'H20J' },
  { key:'Hafalan 30 Juz',           prefix:'H30J' },

  { key:'Tafsir Arab',              prefix:'TFA' },
  { key:'Tafsir Indonesia',         prefix:'TFI' },
  { key:'Tafsir Inggris',           prefix:'TFE' },

  { key:'Kaligrafi Naskah',         prefix:'KN' },
  { key:'Kaligrafi Hiasan',         prefix:'KH' },
  { key:'Kaligrafi Dekorasi',       prefix:'KD' },
  { key:'Kaligrafi Kontemporer',    prefix:'KK' },

  { key:'KTIQ',                     prefix:'KTIQ' },

  { key:"Fahm Al Qur'an",           prefix:'FAQ' },
  { key:"Syarh Al Qur'an",          prefix:'SAQ' },
];

function getCabangPrefix_(cabangLomba) {
  var name = String(cabangLomba).trim();
  for (var i=0; i<CABANG_PREFIX.length; i++) {
    if (name.indexOf(CABANG_PREFIX[i].key) === 0) return CABANG_PREFIX[i].prefix;
  }
  return 'MTQ';
}

// ── PATCH: All admin actions moved to doGet (JSONP bypass) ────
// Replace the doGet switch in api.gs with this version

function doGet(e) {
  var params   = (e && e.parameter) ? e.parameter : {};
  var action   = params.action   || '';
  var callback = params.callback || '';
 
  logInfo('api', 'doGet', { action: action, hasPostData: !!params.postData });
  var result;

  // ── Payload untuk endpoint Sistem Penilaian (Hakim/Peserta/Nilai) ──
  // Dikirim sebagai ?action=X&payload=<json> (lihat penilaian.html apiPost).
  // Ini terpisah dari tunnel ?postData= yang dipakai apiRegister_/maqra.
  var penilaianPayload = {};
  if (params.payload) {
    try { penilaianPayload = JSON.parse(params.payload); } catch (ePayload) { penilaianPayload = {}; }
  }
 
  try {
    // ── JSONP-POST tunnel ─────────────────────────────────
    // Frontend mengirim payload JSON sebagai ?postData=...
    // agar tidak ada CORS preflight (fetch/XHR).
    if (params.postData) {
      var body;
      try { body = JSON.parse(decodeURIComponent(params.postData)); }
      catch(e1) { body = JSON.parse(params.postData); }
      result = _dispatchPost(body);
 
    } else {
      // ── Normal GET dispatch ────────────────────────────
      switch (action) {
        // Public
        case 'ping'          : result = { success:true, pong:true, ts:new Date().toISOString() }; break;
        case 'getConfig'     : result = apiGetConfig_();                    break;
        case 'getStats'      : result = apiGetStats_();                     break;
        case 'getQuota'      : result = apiGetQuota_(params);               break;
        case 'checkDuplicate': result = apiCheckDuplicate_(params);         break;
        case 'checkNIK'      : result = apiCheckNIK_v2_(params);            break;
        case 'initSheets'    : result = { success:true, msg: initAllSheets() }; break;
        case 'debugConfig'   : result = apiDebugConfig_();                  break;
 
        // Admin (token validated inside each function)
        case 'adminLogin'    : result = apiAdminLogin_(params);             break;
        case 'getAllPendaftar': result = apiGetAll_(params);                 break;
        case 'updateStatus'  : result = apiUpdateStatusGet_(params);        break;
        case 'editPeserta'   : result = apiEditPesertaGet_(params);         break;
        case 'deactivate'    : result = apiDeactivateGet_(params);          break;
 
        // ── NEW: Maqra (public) ──────────────────────────
        case 'getMaqraStatus': result = apiGetMaqraStatus_(params);         break;
 
        // ── NEW: Maqra (admin, token validated inside) ───
        case 'getMaqraAdmin' : result = apiGetMaqraAdmin_(params);          break;

        // ── Sistem Penilaian (Dewan Hakim / Peserta / Nilai) ──
        // NOTE: fungsi-fungsi ini didefinisikan di penilaian.gs.
        // Action "write" (save*/delete*) membaca dari penilaianPayload
        // (?payload=<json>); action "read" (get*) membaca dari params langsung.
        //
        // Action yang dipanggil dari panel Admin (admin.html) — butuh token:
        case 'saveHakim'        : result = _runPenilaianAdmin_(params, function(){ return saveHakim(penilaianPayload); });                                   break;
        case 'getHakim'         : result = _runPenilaianAdmin_(params, function(){ return getHakim(); });                                                    break;
        case 'deleteHakim'      : result = _runPenilaianAdmin_(params, function(){ return deleteHakim(penilaianPayload.id); });                              break;
        case 'updateHakim'      : result = _runPenilaianAdmin_(params, function(){ return updateHakim(penilaianPayload.id, penilaianPayload); });             break;
        case 'saveParam'        : result = _runPenilaianAdmin_(params, function(){ return saveParam(penilaianPayload.cabang, penilaianPayload.params); });   break;
        case 'savePeserta'      : result = _runPenilaianAdmin_(params, function(){ return savePeserta(penilaianPayload.cabang, penilaianPayload.peserta); }); break;
        case 'deletePeserta'    : result = _runPenilaianAdmin_(params, function(){ return deletePeserta(penilaianPayload.id); });                            break;
        case 'importPesertaFromPendaftaran': result = _runPenilaianAdmin_(params, function(){ return importPesertaFromPendaftaran_(params.cabang, params.status_filter); }); break;
        case 'setHasilPublikStatus': result = _runPenilaianAdmin_(params, function(){ return apiSetHasilPublikStatus_(penilaianPayload.status); });          break;

        // Action publik — dipanggil dari halaman Login Hakim (penilaian.html)
        // atau halaman Hasil Penilaian publik (index.html), TANPA token:
        case 'verifyHakimPin'   : result = _runPenilaian_(function(){ return verifyHakimPin(params.pin); });                                    break;
        // getHakimPublic: segar-kan data hakim (cabang, nama) by ID tanpa PIN.
        // Dipanggil saat restore sesi di penilaian.html agar cabang selalu up-to-date.
        case 'getHakimPublic'   : result = _runPenilaian_(function(){ return getHakimPublic_(params.id); });                                    break;
        case 'getParam'         : result = _runPenilaian_(function(){ return getParam(params.cabang || null); });                               break;
        // adminView='true' → admin panel: tampilkan semua peserta (skip Terverifikasi filter)
        // adminView tidak ada / 'false' → scoring hakim: hanya Terverifikasi
        case 'getPeserta'       : result = _runPenilaian_(function(){ return getPeserta(params.cabang || null, params.adminView === 'true'); });  break;
        case 'saveNilai'        : result = _runPenilaian_(function(){ return saveNilai(penilaianPayload.key, penilaianPayload.data); });        break;
        case 'getNilai'         : result = _runPenilaian_(function(){ return getNilai(params.cabang || null, params.hakimId || null); });       break;
        case 'getPeringkat'     : result = _runPenilaian_(function(){ return getPeringkat(params.cabang); });                                   break;
        case 'getPenilaianStats': result = _runPenilaian_(function(){ return getPenilaianStats_(); });                                          break;
        case 'getHasilPublikStatus': result = _runPenilaian_(function(){ return apiGetHasilPublikStatus_(); });                                 break;
 
        default: result = { success:true, message:'MTQ 2026 API aktif', event:EVENT_INFO };
      }
    }
  } catch (err) {
    logError('api', 'doGet ERROR: ' + err.message + ' | ' + err.stack);
    result = { success:false, message: err.message };
  }
 
  var ss = null;
  try { ss = SpreadsheetApp.openById(SPREADSHEET_ID); } catch(e2) {}
  _flushLog(ss);
 
  if (callback) {
    return ContentService
      .createTextOutput(callback + '(' + JSON.stringify(result) + ')')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return jsonResp_(result);
}

// ── Wrapper khusus action Sistem Penilaian (publik, tanpa token) ──
// penilaian.html / index.html mengecek field `data.error` (bukan
// `data.message`) untuk pesan gagal, jadi error di-handle terpisah dari
// error handler utama di doGet agar kontrak responsnya tetap konsisten.
function _runPenilaian_(fn) {
  try {
    return fn();
  } catch (errP) {
    logError('api', 'Sistem Penilaian ERROR: ' + errP.message);
    return { success:false, error: errP.message };
  }
}

// ── Wrapper khusus action Sistem Penilaian milik ADMIN — wajib token valid ──
// Dipanggil dari panel "Sistem Penilaian" di admin.html (js/admin-penilaian.js).
function _runPenilaianAdmin_(params, fn) {
  if (!isTokenValid_(params.token)) {
    return { success:false, error:'Sesi admin tidak valid. Silakan login ulang.', message:'Sesi admin tidak valid. Silakan login ulang.' };
  }
  return _runPenilaian_(fn);
}

// ── Status buka/tutup "Hasil Penilaian Publik" (ditampilkan di index.html) ──
// Disimpan lewat getConfig/setConfig (sheet 'Config' milik penilaian.gs),
// terpisah dari status buka/tutup PENDAFTARAN (PENDAFTARAN_CONFIG di config.gs)
// dan terpisah dari status buka/tutup MAQRA — masing-masing punya toggle sendiri.
function apiGetHasilPublikStatus_() {
  var status = getConfig('HASIL_PUBLIK_STATUS') || 'tutup';
  return { success:true, status: status, isOpen: status === 'buka' };
}
function apiSetHasilPublikStatus_(status) {
  var v = (status === 'buka') ? 'buka' : 'tutup';
  setConfig('HASIL_PUBLIK_STATUS', v);
  return { success:true, status: v, isOpen: v === 'buka' };
}

// ── Import peserta scoring dari sheet Pendaftar utama ─────────
// Dipakai admin (via admin.html) untuk menarik peserta yang sudah
// mendaftar & diverifikasi ke dalam sheet PESERTA penilaian.
// Peserta dengan status 'Ditolak' atau 'Nonaktif' dilewati.
// Untuk cabang TIM, setiap anggota tim diimport sebagai baris tersendiri.
function importPesertaFromPendaftaran_(cabang, statusFilter) {
  if (!cabang) return { success: false, error: 'Cabang wajib diisi' };

  var ss             = SpreadsheetApp.openById(SPREADSHEET_ID);
  var pendaftarSheet = ss.getSheetByName(SHEET_PENDAFTAR);
  if (!pendaftarSheet) return { success: false, error: 'Sheet pendaftar tidak ditemukan' };

  // getSheet adalah fungsi dari penilaian.gs — otomatis create jika belum ada
  var pesertaSheet = getSheet('Peserta');

  // Ambil existing IDs untuk cegah duplikat
  var existingRows = pesertaSheet.getDataRange().getValues();
  var existingIds  = {};
  existingRows.slice(1).forEach(function(r){ if(r[0]) existingIds[String(r[0])] = true; });

  // Hitung nomor urut awal per cabang (untuk urut setelah yang ada)
  var currentCount = existingRows.slice(1).filter(function(r){ return r[1] === cabang; }).length;

  var pendaftarRows = pendaftarSheet.getDataRange().getValues();
  var newRows = [];
  var skipStatuses = { 'Ditolak':true, 'Nonaktif':true };

  pendaftarRows.slice(1).forEach(function(r) {
    var rowCabang = String(r[COL.CABANG_LOMBA] || '').trim();
    var rowNomor  = String(r[COL.NOMOR_PENDAFTARAN] || '').trim();
    var rowNama   = String(r[COL.NAMA_LENGKAP] || '').trim();
    var rowKec    = String(r[COL.KECAMATAN] || '').trim();
    var rowStatus = String(r[COL.STATUS_VERIFIKASI] || '').trim();
    var rowTipe   = String(r[COL.TIPE_LOMBA] || '').trim();

    if (rowCabang !== cabang) return;
    if (!rowNomor || !rowNama) return;
    if (skipStatuses[rowStatus]) return;
    // Jika statusFilter diberikan, hanya import yang sesuai (mis. 'Diterima')
    if (statusFilter && rowStatus !== statusFilter) return;

    if (rowTipe === 'tim') {
      // Import anggota tim: parse dari ANGGOTA_JSON
      var anggotaJson = String(r[COL.ANGGOTA_JSON] || '[]');
      var anggota = [];
      try { anggota = JSON.parse(anggotaJson); } catch(e) { anggota = []; }
      if (!anggota.length) anggota.push({ nama_lengkap: rowNama, kecamatan: rowKec });

      anggota.forEach(function(a, ai) {
        var uid = rowNomor + '_m' + ai;
        if (existingIds[uid]) return;
        existingIds[uid] = true;
        currentCount++;
        newRows.push([uid, cabang, a.nama_lengkap || rowNama, a.kecamatan || rowKec, currentCount, new Date().toISOString()]);
      });
    } else {
      // Individu
      if (existingIds[rowNomor]) return;
      existingIds[rowNomor] = true;
      currentCount++;
      newRows.push([rowNomor, cabang, rowNama, rowKec, currentCount, new Date().toISOString()]);
    }
  });

  if (newRows.length > 0) {
    pesertaSheet.getRange(pesertaSheet.getLastRow() + 1, 1, newRows.length, 6).setValues(newRows);
  }

  writeLog_(ss, 'IMPORT_PESERTA', 'Cabang: ' + cabang + ', imported: ' + newRows.length, 'ok');
  return { success: true, count: newRows.length, cabang: cabang };
}

function dispatchGet_(params, action) {
  switch (action) {
    // Public
    case 'ping'          : return { success:true, pong:true, ts:new Date().toISOString() };
    case 'getConfig'     : return apiGetConfig_();
    case 'getStats'      : return apiGetStats_();
    case 'getQuota'      : return apiGetQuota_(params);
    case 'checkDuplicate': return apiCheckDuplicate_(params);
    case 'checkNIK'      : return apiCheckNIK_(params);
    case 'initSheets'    : return { success:true, msg: initAllSheets() };
    case 'debugConfig'   : return apiDebugConfig_();
 
    // Maqra (public)
    case 'getMaqraStatus': return apiGetMaqraStatus_(params);
 
    // Admin (GET)
    case 'adminLogin'    : return apiAdminLogin_(params);
    case 'getAllPendaftar': return apiGetAll_(params);
    case 'updateStatus'  : return apiUpdateStatusGet_(params);
    case 'editPeserta'   : return apiEditPesertaGet_(params);
    case 'deactivate'    : return apiDeactivateGet_(params);
    case 'getMaqraAdmin' : return apiGetMaqraAdmin_(params);
 
    default: return { success:true, message:'MTQ 2026 API aktif' };
  }
}

function _dispatchPost(body) {
  var action = String(body.action || '');
  switch (action) {
    case 'register'       : return apiRegister_(body);
    // ── NEW: Maqra ──────────────────────────────────────────
    case 'ambilMaqra'     : return apiAmbilMaqra_(body);
    case 'saveMaqra'      : return apiSaveMaqraAdmin_(body);
    case 'deleteMaqra'    : return apiDeleteMaqraAdmin_(body);
    case 'saveMaqraConfig': return apiSaveMaqraConfig_(body);
    case 'perbaikan'      : return apiPerbaikan_(body);
    default: return { success:false, message:'Unknown action: ' + action };
  }
}

// doPost kept for registration only (large base64 payload)
function doPost(e) {
  var result;
  try {
    var body = JSON.parse(e.postData.contents);
    logInfo('api', 'doPost action: ' + body.action);
    result = _dispatchPost(body);
  } catch (err) {
    logError('api', 'doPost ERROR: ' + err.message);
    result = { success:false, message: err.message };
  }
  var ss = null;
  try { ss = SpreadsheetApp.openById(SPREADSHEET_ID); } catch(e2) {}
  _flushLog(ss);
  return jsonResp_(result);
}

// ── adminLogin via GET ─────────────────────────────────────────
// Password dikirim sebagai base64 untuk menghindari URL-encoding
// char spesial (@, !, #, dll). Decode di server sebelum compare.
function apiAdminLogin_(params) {
  logInfo('api','apiAdminLogin_ GET — param keys: '+Object.keys(params||{}).join(','));
  var incoming = '';
  try {
    var b64 = String(params.pw || '').trim();
    logInfo('api','pw param length: '+b64.length);
    if (!b64) {
      // fallback: plain password
      incoming = String(params.password || '').trim();
      logInfo('api','Fallback plain password, length: '+incoming.length);
    } else {
      // Decode base64
      var decoded = Utilities.base64Decode(b64, Utilities.Charset.UTF_8);
      incoming = Utilities.newBlob(decoded).getDataAsString();
      logInfo('api','b64 decoded, incoming.length: '+incoming.length);
    }
  } catch(e) {
    logError('api','Decode error: '+e.message);
    return {success:false, message:'Gagal mendekode password: '+e.message};
  }

  var expected = String(ADMIN_PASSWORD || '').trim();
  logInfo('api','incoming.length='+incoming.length+' expected.length='+expected.length);

  // Char-by-char debug (hapus setelah konfirmasi bekerja)
  var inChars = incoming.split('').map(function(c){return c.charCodeAt(0);}).join(',');
  var exChars = expected.split('').map(function(c){return c.charCodeAt(0);}).join(',');
  logInfo('api','incoming chars: ['+inChars+']');
  logInfo('api','expected chars: ['+exChars+']');

  if (!incoming) return {success:false, message:'Password tidak boleh kosong'};
  if (incoming !== expected) {
    logWarn('api','Login GAGAL — tidak cocok');
    return {success:false, message:'Password salah. Periksa Apps Script Logger untuk debug detail.'};
  }
  var token = genToken_();
  logInfo('api','Login BERHASIL, token.length='+token.length);
  return {success:true, token:token};
}

// ── Admin GET handlers ─────────────────────────────────────────
function apiUpdateStatusGet_(p) {
  if (!isTokenValid_(p.token)) return {success:false, message:'Sesi tidak valid'};
  return updateRowField_(p.nomor, COL.STATUS_VERIFIKASI, p.status, p.catatan||'');
}

function apiEditPesertaGet_(p) {
  if (!isTokenValid_(p.token)) return {success:false, message:'Sesi tidak valid'};
  var fieldMap = {
    nama_lengkap:'NAMA_LENGKAP', nik:'NIK', tempat_lahir:'TEMPAT_LAHIR',
    tanggal_lahir:'TANGGAL_LAHIR', jenis_kelamin:'JENIS_KELAMIN',
    alamat:'ALAMAT', no_hp:'NO_HP', email:'EMAIL', kecamatan:'KECAMATAN',
    nama_bank:'NAMA_BANK', nomor_rekening:'NOMOR_REKENING',
    nama_rekening:'NAMA_REKENING', catatan:'CATATAN',
  };
  var field = String(p.field||'');
  if (!fieldMap[field]) return {success:false, message:'Field tidak diizinkan: '+field};
  return updateRowField_(p.nomor, COL[fieldMap[field]], p.value||'', null);
}

function apiDeactivateGet_(p) {
  if (!isTokenValid_(p.token)) return {success:false, message:'Sesi tidak valid'};
  return updateRowField_(p.nomor, COL.STATUS_VERIFIKASI, 'Nonaktif',
                         p.catatan||'Dinonaktifkan oleh admin');
}


function jsonResp_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// ── debugConfig ───────────────────────────────────────────────
function apiDebugConfig_() {
  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheetByName(SHEET_CONFIG);
    if (!sheet) return { success:false, message:'Sheet CONFIG tidak ditemukan', sheetNames:ss.getSheets().map(function(s){return s.getName();}) };
    var rows = sheet.getDataRange().getValues();
    return { success:true, sheetName:sheet.getName(), totalRows:rows.length, headers:rows[0], sampleRows:rows.slice(1,6), expectedHeaders:CONFIG_HEADERS };
  } catch(err) { return { success:false, message:err.message }; }
}

// ── checkDuplicate (kecamatan+cabang) ────────────────────────
function apiCheckDuplicate_(params) {
  var kecamatan = String(params.kecamatan||'').trim();
  var cabang    = String(params.cabang   ||'').trim();
  if (!kecamatan || !cabang) return { success:false, message:'Parameter tidak lengkap' };
  var ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = getOrCreateSheet_(ss, SHEET_PENDAFTAR, PENDAFTAR_HEADERS);
  if (sheet.getLastRow()<=1) return { success:true, isDuplicate:false, count:0 };
  var rows  = sheet.getRange(2,1,sheet.getLastRow()-1,PENDAFTAR_HEADERS.length).getValues();
  var count = 0;
  rows.forEach(function(row) {
    var s = String(row[COL.STATUS_VERIFIKASI]||'').toLowerCase();
    if (s==='nonaktif') return;
    if (String(row[COL.KECAMATAN]||'').trim()===kecamatan && String(row[COL.CABANG_LOMBA]||'').trim()===cabang) count++;
  });
  return { success:true, isDuplicate:count>0, count:count };
}

// ── checkNIK (FIX #3) ─────────────────────────────────────────
function apiCheckNIK_(params) {
  var nik = String(params.nik || '').trim();
  if (!nik) return { success:false, message:'Parameter NIK diperlukan' };
 
  var ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(SHEET_PENDAFTAR);
  if (!sheet) return { success:false, found:false, message:'Sheet tidak ditemukan' };
 
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return { success:true, found:false };
 
  var rows = sheet.getRange(2, 1, lastRow - 1, PENDAFTAR_HEADERS.length).getValues();
 
  for (var i = 0; i < rows.length; i++) {
    var row    = rows[i];
    var rowNIK = String(row[COL.NIK] || '').trim();
 
    // Cek NIK ketua / individu
    if (rowNIK === nik) {
      return buildNIKResponse_(row, nik);
    }
 
    // Cek NIK anggota tim (dari kolom ANGGOTA_JSON)
    var anggotaJson = row[COL.ANGGOTA_JSON] || '';
    if (anggotaJson) {
      try {
        var anggota = JSON.parse(anggotaJson);
        for (var j = 0; j < anggota.length; j++) {
          if (String(anggota[j].nik || '').trim() === nik) {
            return buildNIKResponse_(row, nik, anggota, j);
          }
        }
      } catch (e2) {}
    }
  }
 
  return { success:true, found:false };
}

function apiCheckNIK_v2_(params) {
  var nik = String(params.nik || '').trim();
  if (!nik) return { success:false, message:'NIK tidak boleh kosong' };
 
  var ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = getOrCreateSheet_(ss, SHEET_PENDAFTAR, PENDAFTAR_HEADERS);
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return { success:true, found:false };
 
  var rows = sheet.getRange(2, 1, lastRow - 1, PENDAFTAR_HEADERS.length).getValues();
 
  for (var i = 0; i < rows.length; i++) {
    var row    = rows[i];
    var rowNIK = String(row[COL.NIK] || '').trim();
 
    // Ketua / individu
    if (rowNIK === nik) {
      return _buildNIKRecord(row, nik);
    }
 
    // Cek anggota tim di ANGGOTA_JSON
    var anggotaRaw = row[COL.ANGGOTA_JSON];
    if (anggotaRaw) {
      try {
        var anggota = JSON.parse(anggotaRaw);
        for (var j = 0; j < anggota.length; j++) {
          if (String(anggota[j].nik || '').trim() === nik) {
            return _buildNIKRecord(row, nik, anggota, j);
          }
        }
      } catch (pe) {}
    }
  }
 
  return { success:true, found:false };
}

function _buildNIKRecord(row, nik, anggotaArr, anggotaIdx) {
  var anggota = [];
  try {
    if (row[COL.ANGGOTA_JSON]) anggota = JSON.parse(row[COL.ANGGOTA_JSON]);
  } catch(e) {}
 
  return {
    success: true,
    found  : true,
    record : {
      nomor_pendaftaran : String(row[COL.NOMOR_PENDAFTARAN] || ''),
      tipe_lomba        : String(row[COL.TIPE_LOMBA]        || 'individu'),
      nama_tim          : String(row[COL.NAMA_TIM]          || ''),
      kecamatan         : String(row[COL.KECAMATAN]         || ''),
      cabang_lomba      : String(row[COL.CABANG_LOMBA]      || ''),
      nama_lengkap      : String(row[COL.NAMA_LENGKAP]      || ''),
      nik               : String(row[COL.NIK]               || ''),
      tempat_lahir      : String(row[COL.TEMPAT_LAHIR]      || ''),
      tanggal_lahir     : String(row[COL.TANGGAL_LAHIR]     || ''),
      jenis_kelamin     : String(row[COL.JENIS_KELAMIN]     || ''),
      alamat            : String(row[COL.ALAMAT]            || ''),
      no_hp             : String(row[COL.NO_HP]             || ''),
      email             : String(row[COL.EMAIL]             || ''),
      status_verifikasi : String(row[COL.STATUS_VERIFIKASI] || 'Menunggu'),
      catatan           : String(row[COL.CATATAN]           || ''),
      anggota           : anggota,
      nik_pencari       : nik,
      is_ketua          : anggotaIdx === undefined || anggotaIdx === 0,
    }
  };
}

function buildNIKResponse_(row, nik, anggota, anggotaIdx) {
  var anggotaArr = [];
  try {
    if (row[COL.ANGGOTA_JSON]) {
      anggotaArr = JSON.parse(row[COL.ANGGOTA_JSON]);
    }
  } catch(e) {}
 
  return {
    success: true,
    found  : true,
    record : {
      nomor_pendaftaran : String(row[COL.NOMOR_PENDAFTARAN] || ''),
      tipe_lomba        : String(row[COL.TIPE_LOMBA]        || 'individu'),
      nama_tim          : String(row[COL.NAMA_TIM]          || ''),
      kecamatan         : String(row[COL.KECAMATAN]         || ''),
      cabang_lomba      : String(row[COL.CABANG_LOMBA]      || ''),
      nama_lengkap      : String(row[COL.NAMA_LENGKAP]      || ''),
      nik               : String(row[COL.NIK]               || ''),
      tempat_lahir      : String(row[COL.TEMPAT_LAHIR]      || ''),
      tanggal_lahir     : String(row[COL.TANGGAL_LAHIR]     || ''),
      jenis_kelamin     : String(row[COL.JENIS_KELAMIN]     || ''),
      alamat            : String(row[COL.ALAMAT]            || ''),
      no_hp             : String(row[COL.NO_HP]             || ''),
      email             : String(row[COL.EMAIL]             || ''),
      status_verifikasi : String(row[COL.STATUS_VERIFIKASI] || 'Menunggu'),
      catatan           : String(row[COL.CATATAN]           || ''),
      anggota           : anggotaArr,
      nik_pencari       : nik,
      is_ketua          : anggotaIdx === undefined || anggotaIdx === 0,
    }
  };
}

// ── getConfig ─────────────────────────────────────────────────
function apiGetConfig_() {
  var ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = getOrCreateSheet_(ss, SHEET_CONFIG, CONFIG_HEADERS, DEFAULT_CONFIG_DATA);
  var rows  = sheet.getDataRange().getValues();
  var hdrs  = rows[0].map(function(h){return String(h).trim().toLowerCase().replace(/\s+/g,'_');});
  var config = [];
  for (var i=1; i<rows.length; i++) {
    var r=rows[i], obj={};
    hdrs.forEach(function(h,j){obj[h]=r[j]!==undefined?r[j]:'';});
    var nm = String(obj.cabang_lomba||'').trim();
    if (!nm) continue;
    if (String(obj.status_aktif||'').trim().toLowerCase()!=='aktif') continue;
    config.push({
      cabang_lomba:nm, tipe:String(obj.tipe||'individu').trim(), gender:String(obj.gender||'Semua').trim(),
      umur_min:parseInt(obj.umur_min)||0, umur_max_tahun:parseInt(obj.umur_max_tahun)||99,
      umur_max_bulan:parseInt(obj.umur_max_bulan)||0, umur_max_hari:parseInt(obj.umur_max_hari)||0,
      kuota:parseInt(obj.kuota)||31, status_aktif:'Aktif',
    });
  }
  if (config.length===0) {
    logWarn('api','CONFIG kosong — pakai DEFAULT');
    config = DEFAULT_CONFIG_DATA.map(function(row){
      return { cabang_lomba:String(row[0]).trim(), tipe:String(row[1]).trim(), gender:String(row[2]).trim(),
               umur_min:parseInt(row[3])||0, umur_max_tahun:parseInt(row[4])||99,
               umur_max_bulan:parseInt(row[5])||0, umur_max_hari:parseInt(row[6])||0,
               kuota:parseInt(row[7])||31, status_aktif:'Aktif' };
    });
  }
  var regStatus = isRegistrationOpen_();
  return { success:true, config:config,
    registrationConfig:{ buka:PENDAFTARAN_CONFIG.BUKA, tutup:PENDAFTARAN_CONFIG.TUTUP,
      ageCutoffDate:PENDAFTARAN_CONFIG.AGE_CUTOFF_DATE, isOpen:regStatus.open, status:regStatus.status },
    event:EVENT_INFO };
}

// ── getStats ──────────────────────────────────────────────────
function apiGetStats_() {
  var ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = getOrCreateSheet_(ss, SHEET_PENDAFTAR, PENDAFTAR_HEADERS);
  if (sheet.getLastRow()<=1) return { success:true, total:0, verified:0, pending:0, rejected:0, nonaktif:0, cabangs:0, kecamatans:0 };
  var data = sheet.getRange(2,1,sheet.getLastRow()-1,PENDAFTAR_HEADERS.length).getValues();
  var verified=0,pending=0,rejected=0,nonaktif=0,cabangs={},kecs={};
  data.forEach(function(row) {
    var s=String(row[COL.STATUS_VERIFIKASI]||'').toLowerCase();
    if(s==='terverifikasi')verified++;else if(s==='ditolak')rejected++;else if(s==='nonaktif')nonaktif++;else pending++;
    var cb=row[COL.CABANG_LOMBA];if(cb)cabangs[cb]=1;
    var kc=row[COL.KECAMATAN];if(kc)kecs[kc]=1;
  });
  var regStatus = isRegistrationOpen_();
  return { success:true, total:data.length, verified:verified, pending:pending, rejected:rejected, nonaktif:nonaktif,
           cabangs:Object.keys(cabangs).length, kecamatans:Object.keys(kecs).length,
           isOpen:regStatus.open, status:regStatus.status,
           buka:PENDAFTARAN_CONFIG.BUKA, tutup:PENDAFTARAN_CONFIG.TUTUP };
}

// ── getQuota ──────────────────────────────────────────────────
function apiGetQuota_(params) {
  var cabang = String(params.cabang||'').trim();
  var ss     = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet  = getOrCreateSheet_(ss, SHEET_PENDAFTAR, PENDAFTAR_HEADERS);
  return { success:true, count:countByCabangActive_(sheet,cabang), cabang:cabang };
}



// ── getAllPendaftar (GET via JSONP) ────────────────────────────
function apiGetAll_(params) {
  var token = String(params.token || '').trim();
  logInfo('api','apiGetAll_ token length: '+token.length);
  if (!isTokenValid_(token)) {
    logWarn('api','apiGetAll_ — token tidak valid');
    return { success:false, message:'Sesi tidak valid. Silakan login ulang.' };
  }
  var ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = getOrCreateSheet_(ss, SHEET_PENDAFTAR, PENDAFTAR_HEADERS);
  if (sheet.getLastRow()<=1) return { success:true, data:[] };
  var rows = sheet.getRange(2,1,sheet.getLastRow()-1,PENDAFTAR_HEADERS.length).getValues();
  logInfo('api','apiGetAll_ — rows: '+rows.length);
  return {
    success    : true,
    data       : rows.map(function(r){ return rowToObj_(r); }),
    driveApiKey: DRIVE_API_KEY || ''   // returned only to authenticated admin
  };
}





// ── register ──────────────────────────────────────────────────
function apiRegister_(body) {
  logInfo('api','apiRegister_ START',{cabang:body.cabang_lomba,kecamatan:body.kecamatan});

  // 1. Status pendaftaran
  var regStatus = isRegistrationOpen_();
  if (!regStatus.open) {
    var msg = regStatus.status==='belum_buka'
      ? 'Pendaftaran belum dibuka (buka per '+PENDAFTARAN_CONFIG.BUKA+').'
      : 'Pendaftaran telah ditutup.';
    return { success:false, message:msg };
  }

  // 2. Cari config cabang
  var ss         = SpreadsheetApp.openById(SPREADSHEET_ID);
  var cfgSheet   = getOrCreateSheet_(ss, SHEET_CONFIG, CONFIG_HEADERS, DEFAULT_CONFIG_DATA);
  var cfgData    = cfgSheet.getDataRange().getValues();
  var cfgHdr     = cfgData[0].map(function(h){return String(h).trim().toLowerCase().replace(/\s+/g,'_');});
  var cabangIdx  = cfgHdr.indexOf('cabang_lomba');
  var targetCabang = String(body.cabang_lomba||'').trim();
  var cabangCfg  = null;

  for (var ci=1; ci<cfgData.length; ci++) {
    if (String(cfgData[ci][cabangIdx]||'').trim()===targetCabang) {
      var crow = cfgData[ci];
      cabangCfg = {
        tipe:String(crow[cfgHdr.indexOf('tipe')]||'individu').trim(),
        gender:String(crow[cfgHdr.indexOf('gender')]||'Semua').trim(),
        umur_min:parseInt(crow[cfgHdr.indexOf('umur_min')])||0,
        umur_max_tahun:parseInt(crow[cfgHdr.indexOf('umur_max_tahun')])||99,
        umur_max_bulan:parseInt(crow[cfgHdr.indexOf('umur_max_bulan')])||0,
        umur_max_hari:parseInt(crow[cfgHdr.indexOf('umur_max_hari')])||0,
        kuota:parseInt(crow[cfgHdr.indexOf('kuota')])||31,
        status:String(crow[cfgHdr.indexOf('status_aktif')]||'').trim(),
      };
      break;
    }
  }
  // Fallback ke DEFAULT
  if (!cabangCfg) {
    for (var di=0; di<DEFAULT_CONFIG_DATA.length; di++) {
      if (String(DEFAULT_CONFIG_DATA[di][0]).trim()===targetCabang) {
        var dr=DEFAULT_CONFIG_DATA[di];
        cabangCfg={tipe:String(dr[1]).trim(),gender:String(dr[2]).trim(),
          umur_min:parseInt(dr[3])||0,umur_max_tahun:parseInt(dr[4])||99,
          umur_max_bulan:parseInt(dr[5])||0,umur_max_hari:parseInt(dr[6])||0,
          kuota:parseInt(dr[7])||31,status:'Aktif'};
        break;
      }
    }
  }
  if (!cabangCfg) return { success:false, message:'Cabang tidak ditemukan: '+targetCabang };
  if (String(cabangCfg.status).toLowerCase()!=='aktif') return { success:false, message:'Cabang tidak aktif.' };

  // 3. Validasi anggota
  var members = body.members||[];
  if (!members.length) return { success:false, message:'Data peserta tidak boleh kosong' };
  if (cabangCfg.tipe==='team' && members.length<2) return { success:false, message:'Tim minimal 2 anggota' };
  if (cabangCfg.tipe==='team' && members.length>3) return { success:false, message:'Tim maksimal 3 anggota' };

  for (var mi=0; mi<members.length; mi++) {
    var m=members[mi], label='Anggota '+(mi+1)+' ('+(m.nama_lengkap||'-')+')';
    var gChk=validateGender_(m.jenis_kelamin, cabangCfg.gender);
    if (!gChk.ok) return { success:false, message:label+': '+gChk.msg };
    var age=calcAgeAtCutoff_(m.tanggal_lahir);
    var aChk=validateAge_(age, cabangCfg.umur_min, cabangCfg.umur_max_tahun, cabangCfg.umur_max_bulan, cabangCfg.umur_max_hari);
    if (!aChk.ok) return { success:false, message:label+': '+aChk.msg };
    m._age = age;
  }

  // 4. Cek duplikat kecamatan+cabang
  var pendSheet = getOrCreateSheet_(ss, SHEET_PENDAFTAR, PENDAFTAR_HEADERS);
  var dupCheck  = checkDuplicateKecCabang_(pendSheet, body.kecamatan, targetCabang);
  if (dupCheck.isDuplicate) return { success:false, message:'Kecamatan '+body.kecamatan+' sudah mendaftarkan peserta pada cabang '+targetCabang+'.' };

  // 5. FIX #3: Cek duplikat NIK di semua anggota
  var allNIKs = members.map(function(m){return m.nik||'';}).filter(Boolean);
  var nikCheck = checkNIKDuplicate_(pendSheet, allNIKs);
  if (nikCheck.isDuplicate) return { success:false, message:nikCheck.msg };

  // 6. Kuota
  var curCount = countByCabangActive_(pendSheet, targetCabang);
  if (curCount>=cabangCfg.kuota) return { success:false, message:'Kuota '+targetCabang+' sudah penuh ('+cabangCfg.kuota+')' };

  // 7. Nomor pendaftaran
  var gender = cabangCfg.gender;
  var nomor  = generateRegNumberOddEven_(pendSheet, targetCabang, gender);
  logInfo('api','Nomor: '+nomor);

  // 8. Upload files
  var pesertaFolder = getPesertaFolder_(targetCabang, body.kecamatan, nomor);
  var folderUrl     = 'https://drive.google.com/drive/folders/'+pesertaFolder.getId();
  var processedMembers = [];
  for (var mi2=0; mi2<members.length; mi2++) {
    var m2=members[mi2], prefix2=(m2.nama_lengkap||'A'+(mi2+1)).replace(/\s+/g,'_').substring(0,30);
    var links = uploadMemberFiles_(m2, pesertaFolder, prefix2);
    // FIX #7: upload sertifikat
    var linkSert = uploadFile_(m2.sertifikat, pesertaFolder, 'SERTIFIKAT_'+prefix2);
    processedMembers.push({
      nama_lengkap:m2.nama_lengkap||'', nik:m2.nik||'',
      tempat_lahir:m2.tempat_lahir||'', tanggal_lahir:m2.tanggal_lahir||'',
      umur_display:m2._age?m2._age.display:'', jenis_kelamin:m2.jenis_kelamin||'',
      alamat:m2.alamat||'', no_hp:m2.no_hp||'', email:m2.email||'',
      link_foto:links.foto, link_ktp:links.ktp, link_sertifikat:linkSert,
    });
  }
  // FIX #11: Rekomendasi mandatory — upload & simpan URL
  var rekomUrl = uploadFile_(body.rekom, pesertaFolder, 'REKOMENDASI');
  logInfo('api','rekom URL: ' + rekomUrl);

  // 9. Simpan ke sheet
  var lead=processedMembers[0];
  var row=new Array(PENDAFTAR_HEADERS.length).fill('');
  row[COL.TIMESTAMP]         = new Date().toLocaleString('id-ID');
  row[COL.NOMOR_PENDAFTARAN] = nomor;
  row[COL.TIPE_LOMBA]        = cabangCfg.tipe;
  row[COL.NAMA_TIM]          = body.nama_tim||'';
  row[COL.KECAMATAN]         = body.kecamatan||'';
  row[COL.CABANG_LOMBA]      = targetCabang;
  row[COL.GENDER_CABANG]     = cabangCfg.gender;
  row[COL.NAMA_LENGKAP]      = lead.nama_lengkap;
  row[COL.NIK]               = lead.nik;
  row[COL.TEMPAT_LAHIR]      = lead.tempat_lahir;
  row[COL.TANGGAL_LAHIR]     = lead.tanggal_lahir;
  row[COL.UMUR_DISPLAY]      = lead.umur_display;
  row[COL.JENIS_KELAMIN]     = lead.jenis_kelamin;
  row[COL.ALAMAT]            = lead.alamat;
  row[COL.NO_HP]             = lead.no_hp;
  row[COL.EMAIL]             = lead.email;
  row[COL.NAMA_BANK]         = body.nama_bank||'';
  row[COL.NOMOR_REKENING]    = body.nomor_rekening||'';
  row[COL.NAMA_REKENING]     = body.nama_rekening||'';
  row[COL.LINK_FOLDER]       = folderUrl;
  row[COL.ANGGOTA_JSON]      = JSON.stringify(processedMembers); // always store
  row[COL.STATUS_VERIFIKASI] = 'Menunggu';
  row[COL.LINK_REKOM]        = rekomUrl || '';
  pendSheet.appendRow(row);
  writeLog_(ss,'REGISTER',nomor+' | '+targetCabang+' | '+(body.kecamatan||''),'ok');

  return { success:true, nomor_pendaftaran:nomor, tipe_lomba:cabangCfg.tipe,
           cabang_lomba:targetCabang, kecamatan:body.kecamatan,
           jumlah_anggota:processedMembers.length, link_folder:folderUrl, message:'Pendaftaran berhasil!' };
}

// ── initSheets (callable via GET) ────────────────────────────
function apiInitSheets_() {
  return { success:true, msg: initAllSheets() };
}

// ── Helpers ───────────────────────────────────────────────────
function checkDuplicateKecCabang_(sheet, kecamatan, cabang) {
  if (sheet.getLastRow()<=1) return { isDuplicate:false };
  var kecT=String(kecamatan||'').trim(), cabT=String(cabang||'').trim();
  var rows=sheet.getRange(2,1,sheet.getLastRow()-1,PENDAFTAR_HEADERS.length).getValues();
  for (var i=0; i<rows.length; i++) {
    var s=String(rows[i][COL.STATUS_VERIFIKASI]||'').toLowerCase();
    if (s==='nonaktif') continue;
    if (String(rows[i][COL.KECAMATAN]||'').trim()===kecT && String(rows[i][COL.CABANG_LOMBA]||'').trim()===cabT) return {isDuplicate:true};
  }
  return {isDuplicate:false};
}

function countByCabangActive_(sheet, cabang) {
  if (sheet.getLastRow()<=1) return 0;
  var data=sheet.getRange(2,COL.CABANG_LOMBA+1,sheet.getLastRow()-1,1).getValues();
  var stat=sheet.getRange(2,COL.STATUS_VERIFIKASI+1,sheet.getLastRow()-1,1).getValues();
  var count=0;
  for (var i=0;i<data.length;i++) {
    if (String(data[i][0]).trim()===String(cabang).trim() && String(stat[i][0]).toLowerCase()!=='nonaktif') count++;
  }
  return count;
}

function generateRegNumberOddEven_(sheet, cabangLomba, gender) {
  var prefix = getCabangPrefix_(cabangLomba);
  var isOdd  = (gender==='P');
  var isEven = (gender==='L');
  var used   = {};
  if (sheet.getLastRow()>1) {
    var nums = sheet.getRange(2,COL.NOMOR_PENDAFTARAN+1,sheet.getLastRow()-1,1).getValues();
    var stats= sheet.getRange(2,COL.STATUS_VERIFIKASI+1,sheet.getLastRow()-1,1).getValues();
    nums.forEach(function(r,i){
      var m=String(r[0]).match(new RegExp('^'+prefix+'-(\\d+)$'));
      if (m) used[parseInt(m[1])]=true;
    });
  }
  for (var n=1; n<=62; n++) {
    if (isOdd  && n%2===0) continue;
    if (isEven && n%2===1) continue;
    if (!used[n]) return prefix+'-'+String(n).padStart(3,'0');
  }
  var max=Object.keys(used).length ? Math.max.apply(null,Object.keys(used).map(Number)) : 0;
  return prefix+'-'+String(max+1).padStart(3,'0');
}

// ── FIX: updateRowField_ was missing — required by all admin GET handlers ──
function updateRowField_(nomor, colIndex, value, catatan) {
  logInfo('api','updateRowField_', {nomor:nomor, col:colIndex, value:String(value).substring(0,40)});
  var ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(SHEET_PENDAFTAR);
  if (!sheet) return {success:false, message:'Sheet PENDAFTAR tidak ditemukan'};

  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return {success:false, message:'Sheet kosong'};

  var nums = sheet.getRange(2, COL.NOMOR_PENDAFTARAN+1, lastRow-1, 1).getValues();
  for (var i=0; i<nums.length; i++) {
    if (String(nums[i][0]).trim() === String(nomor).trim()) {
      sheet.getRange(i+2, colIndex+1).setValue(value);
      if (catatan) sheet.getRange(i+2, COL.CATATAN+1).setValue(catatan);
      writeLog_(ss, 'UPDATE', nomor+' col='+colIndex+' → '+String(value).substring(0,50), 'ok');
      return {success:true, nomor_pendaftaran:nomor};
    }
  }
  return {success:false, message:'Nomor pendaftaran tidak ditemukan: '+nomor};
}


// ── Catatan: apiGetMaqraStatus_ di maqra.gs perlu mendukung ──
// cabang_lomba=GLOBAL — update getMaqraConfigStatus_ agar:
// 1. Cari row dengan cabang_lomba = 'GLOBAL' dahulu
// 2. Jika tidak ada, cari row dengan cabang_lomba = cabang peserta
// Tambahkan ini di maqra.gs fungsi getMaqraConfigStatus_:
//
// function getMaqraConfigStatus_(ss, cabang) {
//   var sheet = ss.getSheetByName(SHEET_MAQRA_CONFIG);
//   if (!sheet || sheet.getLastRow() <= 1) return { isOpen:false };
//   var rows = sheet.getRange(2,1,sheet.getLastRow()-1,5).getValues();
//   // Try GLOBAL first, then specific cabang
//   var targets = ['GLOBAL', cabang];
//   for (var t=0; t<targets.length; t++) {
//     for (var i=0; i<rows.length; i++) {
//       if (String(rows[i][0]).trim() === targets[t]) {
//         // ... same logic as before ...
//       }
//     }
//   }
//   return { isOpen:false };
// }
 
// ── Dummy logError_ (jika tidak ada di scope) ─────────────────
function logError_(ctx, msg) {
  // Ganti dengan fungsi log Anda yang sudah ada
  console.error('['+ctx+'] '+msg);
}

function apiPerbaikan_(body) {
  var nomor = String(body.nomor_pendaftaran || '').trim();
  if (!nomor) return { success:false, message:'Nomor pendaftaran tidak ada' };
 
  var ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = getOrCreateSheet_(ss, SHEET_PENDAFTAR, PENDAFTAR_HEADERS);
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return { success:false, message:'Data kosong' };
 
  // Cari baris berdasarkan nomor pendaftaran
  var nums   = sheet.getRange(2, COL.NOMOR_PENDAFTARAN + 1, lastRow - 1, 1).getValues();
  var rowNum = -1;
  for (var i = 0; i < nums.length; i++) {
    if (String(nums[i][0]).trim() === nomor) { rowNum = i + 2; break; }
  }
  if (rowNum < 0) return { success:false, message:'Nomor tidak ditemukan: ' + nomor };
 
  // Hanya boleh jika status saat ini = Ditolak
  var currentStatus = String(sheet.getRange(rowNum, COL.STATUS_VERIFIKASI + 1).getValue()).trim();
  if (currentStatus !== 'Ditolak') {
    return { success:false, message:'Perbaikan hanya berlaku untuk status Ditolak (saat ini: ' + currentStatus + ')' };
  }
 
  var members = body.members || [];
  if (members.length > 0) {
    var lead = members[0];
    // Update kolom utama dari anggota pertama (ketua / individu)
    if (lead.nama_lengkap)  sheet.getRange(rowNum, COL.NAMA_LENGKAP  + 1).setValue(lead.nama_lengkap);
    if (lead.tempat_lahir)  sheet.getRange(rowNum, COL.TEMPAT_LAHIR  + 1).setValue(lead.tempat_lahir);
    if (lead.tanggal_lahir) sheet.getRange(rowNum, COL.TANGGAL_LAHIR + 1).setValue(lead.tanggal_lahir);
    if (lead.alamat)        sheet.getRange(rowNum, COL.ALAMAT         + 1).setValue(lead.alamat);
    if (lead.no_hp)         sheet.getRange(rowNum, COL.NO_HP          + 1).setValue(lead.no_hp);
    // CATATAN: NIK tidak pernah diupdate dari body — hanya data yang boleh diubah
 
    // Upload berkas revisi ke Drive
    try {
      var cab  = String(sheet.getRange(rowNum, COL.CABANG_LOMBA + 1).getValue());
      var kec  = String(sheet.getRange(rowNum, COL.KECAMATAN + 1).getValue());
      var fold = getPesertaFolder_(cab, kec, nomor);
      var ts   = new Date().getTime();
 
      members.forEach(function(m, mi) {
        var prefix = 'REVISI_' + ts + '_M' + (mi + 1) + '_';
        if (m.foto) { try { uploadFile_(m.foto, fold, prefix + 'FOTO'); } catch(ue) {} }
        if (m.ktp)  { try { uploadFile_(m.ktp,  fold, prefix + 'KTP');  } catch(ue) {} }
        if (m.sertifikat && m.sertifikat.length) {
          m.sertifikat.forEach(function(s, si) {
            try { uploadFile_(s, fold, prefix + 'SERT' + (si + 1)); } catch(ue) {}
          });
        }
      });
 
      if (body.rekom) {
        var rekomUrl = uploadFile_(body.rekom, fold, 'REVISI_' + ts + '_REKOMENDASI');
        if (rekomUrl) sheet.getRange(rowNum, COL.LINK_REKOM + 1).setValue(rekomUrl);
      }
    } catch (uploadErr) {
      logWarn('api', 'perbaikan upload error: ' + uploadErr.message);
    }
 
    // Update ANGGOTA_JSON untuk tim
    if (members.length > 1) {
      try {
        var existingJson = sheet.getRange(rowNum, COL.ANGGOTA_JSON + 1).getValue();
        var existing     = existingJson ? JSON.parse(existingJson) : [];
        members.forEach(function(m, idx) {
          if (!existing[idx]) return;
          if (m.nama_lengkap)  existing[idx].nama_lengkap  = m.nama_lengkap;
          if (m.tempat_lahir)  existing[idx].tempat_lahir  = m.tempat_lahir;
          if (m.tanggal_lahir) existing[idx].tanggal_lahir = m.tanggal_lahir;
          if (m.alamat)        existing[idx].alamat        = m.alamat;
          if (m.no_hp)         existing[idx].no_hp         = m.no_hp;
          // NIK tidak diupdate
        });
        sheet.getRange(rowNum, COL.ANGGOTA_JSON + 1).setValue(JSON.stringify(existing));
      } catch (je) { logWarn('api', 'anggota JSON update error: ' + je.message); }
    }
  }
 
  // Reset status ke Menunggu
  sheet.getRange(rowNum, COL.STATUS_VERIFIKASI + 1).setValue('Menunggu');
  sheet.getRange(rowNum, COL.CATATAN + 1).setValue(
    'Direvisi oleh peserta pada ' + new Date().toLocaleString('id-ID')
  );
 
  writeLog_(ss, 'PERBAIKAN', nomor + ' direset ke Menunggu', 'ok');
  return { success:true, nomor_pendaftaran:nomor, message:'Perbaikan berhasil dikirim.' };
}