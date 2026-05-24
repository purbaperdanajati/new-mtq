// ============================================================
//  MTQ 2026 — apps-script/api.gs
//  Endpoint utama: doGet() + doPost()
//  Semua ID & config dari config.gs saja
// ============================================================

function doGet(e) {
  var action = (e && e.parameter) ? (e.parameter.action || '') : '';
  logInfo('api', 'doGet', { action: action });
  var result;
  try {
    switch (action) {
      case 'getConfig'       : result = apiGetConfig_();              break;
      case 'getStats'        : result = apiGetStats_();               break;
      case 'getQuota'        : result = apiGetQuota_(e.parameter);    break;
      case 'adminLogin'      : result = apiAdminLogin_(e.parameter);  break;
      case 'getAllPendaftar'  : result = apiGetAll_(e.parameter);      break;
      case 'initSheets'      : result = apiInitSheets_();             break;
      default: result = { success: true, message: 'MTQ 2026 API aktif', event: EVENT_INFO };
    }
  } catch (err) {
    logError('api', 'doGet error: ' + err.message);
    result = { success: false, message: err.message };
  }
  return jsonResp_(result);
}

function doPost(e) {
  logInfo('api', 'doPost called');
  var result;
  try {
    var body = JSON.parse(e.postData.contents);
    logInfo('api', 'doPost action: ' + body.action);
    switch (body.action) {
      case 'register'     : result = apiRegister_(body);       break;
      case 'updateStatus' : result = apiUpdateStatus_(body);   break;
      default: result = { success: false, message: 'Action tidak dikenal: ' + body.action };
    }
  } catch (err) {
    logError('api', 'doPost error: ' + err.message);
    result = { success: false, message: err.message };
  }
  return jsonResp_(result);
}

// ── jsonResp_ ─────────────────────────────────────────────────
function jsonResp_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── GET: getConfig ────────────────────────────────────────────
function apiGetConfig_() {
  logInfo('api', 'apiGetConfig_');
  var ss     = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet  = getOrCreateSheet_(ss, SHEET_CONFIG, CONFIG_HEADERS, DEFAULT_CONFIG_DATA);
  var rows   = sheet.getDataRange().getValues();
  var hdrs   = rows[0].map(function(h) { return String(h).trim().toLowerCase(); });
  var config = [];

  for (var i = 1; i < rows.length; i++) {
    var r   = rows[i];
    var obj = {};
    hdrs.forEach(function(h, j) { obj[h] = r[j]; });
    if (String(obj.status_aktif).toLowerCase() === 'aktif') {
      config.push({
        cabang_lomba   : obj.cabang_lomba,
        tipe           : obj.tipe           || 'individu',
        gender         : obj.gender         || 'Semua',
        umur_min       : parseInt(obj.umur_min)        || 0,
        umur_max_tahun : parseInt(obj.umur_max_tahun)  || 99,
        umur_max_bulan : parseInt(obj.umur_max_bulan)  || 0,
        umur_max_hari  : parseInt(obj.umur_max_hari)   || 0,
        kuota          : parseInt(obj.kuota)            || 0,
        status_aktif   : obj.status_aktif,
      });
    }
  }

  var regStatus = isRegistrationOpen_();

  logInfo('api', 'getConfig selesai', { jumlah_cabang: config.length, regStatus: regStatus });
  return {
    success: true,
    config : config,
    registrationConfig: {
      buka           : PENDAFTARAN_CONFIG.BUKA,
      tutup          : PENDAFTARAN_CONFIG.TUTUP,
      ageCutoffDate  : PENDAFTARAN_CONFIG.AGE_CUTOFF_DATE,
      isOpen         : regStatus.open,
      status         : regStatus.status,
    },
    event: EVENT_INFO,
  };
}

// ── GET: getStats ─────────────────────────────────────────────
function apiGetStats_() {
  logInfo('api', 'apiGetStats_');
  var ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = getOrCreateSheet_(ss, SHEET_PENDAFTAR, PENDAFTAR_HEADERS);
  if (sheet.getLastRow() <= 1) {
    return { success:true, total:0, verified:0, pending:0, cabangs:0, kecamatans:0 };
  }
  var data      = sheet.getRange(2,1,sheet.getLastRow()-1, PENDAFTAR_HEADERS.length).getValues();
  var verified  = 0, pending = 0;
  var cabangs   = {}, kecs = {};

  data.forEach(function(row) {
    var status = row[COL.STATUS_VERIFIKASI];
    if (status === 'Terverifikasi') verified++;
    else pending++;
    var cb = row[COL.CABANG_LOMBA]; if (cb) cabangs[cb] = 1;
    var kc = row[COL.KECAMATAN];    if (kc) kecs[kc]    = 1;
  });

  return {
    success    : true,
    total      : data.length,
    verified   : verified,
    pending    : pending,
    cabangs    : Object.keys(cabangs).length,
    kecamatans : Object.keys(kecs).length,
  };
}

// ── GET: getQuota ─────────────────────────────────────────────
function apiGetQuota_(params) {
  var cabang = params.cabang || '';
  logInfo('api', 'apiGetQuota_', { cabang: cabang });
  var ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = getOrCreateSheet_(ss, SHEET_PENDAFTAR, PENDAFTAR_HEADERS);
  var count = countByCabang_(sheet, cabang);
  return { success: true, count: count, cabang: cabang };
}

// ── GET: adminLogin ───────────────────────────────────────────
function apiAdminLogin_(params) {
  logInfo('api', 'apiAdminLogin_');
  if ((params.password || '') !== ADMIN_PASSWORD) {
    logWarn('api', 'Login gagal: password salah');
    return { success: false, message: 'Password salah' };
  }
  logInfo('api', 'Login admin berhasil');
  return { success: true, token: genToken_() };
}

// ── GET: getAllPendaftar ───────────────────────────────────────
function apiGetAll_(params) {
  logInfo('api', 'apiGetAll_');
  if (!isTokenValid_(params.token)) {
    return { success: false, message: 'Sesi tidak valid. Silakan login ulang.' };
  }
  var ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = getOrCreateSheet_(ss, SHEET_PENDAFTAR, PENDAFTAR_HEADERS);
  if (sheet.getLastRow() <= 1) return { success: true, data: [] };

  var rows = sheet.getRange(2,1,sheet.getLastRow()-1, PENDAFTAR_HEADERS.length).getValues();
  var data = rows.map(function(r) { return rowToObj_(r); });
  logInfo('api', 'Data diambil: ' + data.length + ' baris');
  return { success: true, data: data };
}

// ── POST: updateStatus ────────────────────────────────────────
function apiUpdateStatus_(body) {
  logInfo('api', 'apiUpdateStatus_', { nomor: body.nomor_pendaftaran, status: body.status });
  if (!isTokenValid_(body.token)) {
    return { success: false, message: 'Sesi tidak valid.' };
  }
  var ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(SHEET_PENDAFTAR);
  if (!sheet) return { success: false, message: 'Sheet tidak ditemukan' };

  var nums = sheet.getRange(2, COL.NOMOR_PENDAFTARAN+1, sheet.getLastRow()-1, 1).getValues();
  for (var i = 0; i < nums.length; i++) {
    if (nums[i][0] === body.nomor_pendaftaran) {
      sheet.getRange(i+2, COL.STATUS_VERIFIKASI+1).setValue(body.status);
      if (body.catatan) sheet.getRange(i+2, COL.CATATAN+1).setValue(body.catatan);
      writeLog_(ss, 'UPDATE_STATUS', body.nomor_pendaftaran + ' → ' + body.status, 'ok');
      logInfo('api', 'Status diupdate: ' + body.nomor_pendaftaran);
      return { success: true };
    }
  }
  return { success: false, message: 'Nomor pendaftaran tidak ditemukan' };
}

// ── POST: register ────────────────────────────────────────────
function apiRegister_(body) {
  logInfo('api', 'apiRegister_ START', { cabang: body.cabang_lomba, tipe: body.tipe_lomba });

  // 1) Cek pendaftaran buka/tutup
  var regStatus = isRegistrationOpen_();
  if (!regStatus.open) {
    var statusMsg = regStatus.status === 'belum_buka' ? 'Pendaftaran belum dibuka.' : 'Pendaftaran telah ditutup.';
    logWarn('api', 'Pendaftaran tidak bisa dilakukan: ' + statusMsg);
    return { success: false, message: statusMsg };
  }

  // 2) Ambil config cabang
  var ss        = SpreadsheetApp.openById(SPREADSHEET_ID);
  var cfgSheet  = getOrCreateSheet_(ss, SHEET_CONFIG, CONFIG_HEADERS, DEFAULT_CONFIG_DATA);
  var cfgData   = cfgSheet.getDataRange().getValues();
  var cfgHdr    = cfgData[0].map(function(h){ return String(h).trim().toLowerCase(); });
  var cabangCfg = null;

  for (var ci = 1; ci < cfgData.length; ci++) {
    var crow = cfgData[ci];
    if (crow[cfgHdr.indexOf('cabang_lomba')] === body.cabang_lomba) {
      cabangCfg = {
        tipe          : crow[cfgHdr.indexOf('tipe')]           || 'individu',
        gender        : crow[cfgHdr.indexOf('gender')]         || 'Semua',
        umur_min      : parseInt(crow[cfgHdr.indexOf('umur_min')])        || 0,
        umur_max_tahun: parseInt(crow[cfgHdr.indexOf('umur_max_tahun')])  || 99,
        umur_max_bulan: parseInt(crow[cfgHdr.indexOf('umur_max_bulan')])  || 0,
        umur_max_hari : parseInt(crow[cfgHdr.indexOf('umur_max_hari')])   || 0,
        kuota         : parseInt(crow[cfgHdr.indexOf('kuota')])           || 0,
        status        : crow[cfgHdr.indexOf('status_aktif')],
      };
      break;
    }
  }

  if (!cabangCfg) return { success: false, message: 'Cabang lomba tidak ditemukan: ' + body.cabang_lomba };
  if (String(cabangCfg.status).toLowerCase() !== 'aktif') return { success: false, message: 'Cabang lomba tidak aktif.' };

  var members = body.members || [];
  if (!members.length) return { success: false, message: 'Data peserta tidak boleh kosong' };
  if (cabangCfg.tipe === 'team' && members.length < 2) return { success: false, message: 'Tim minimal 2 anggota' };
  if (cabangCfg.tipe === 'team' && members.length > 3) return { success: false, message: 'Tim maksimal 3 anggota' };

  // 3) Validasi setiap anggota (umur & gender)
  for (var mi = 0; mi < members.length; mi++) {
    var m = members[mi];
    var memberLabel = 'Anggota ' + (mi+1) + ' (' + (m.nama_lengkap || '-') + ')';
    logInfo('api', 'Validasi ' + memberLabel);

    // Gender
    var gCheck = validateGender_(m.jenis_kelamin, cabangCfg.gender);
    if (!gCheck.ok) return { success: false, message: memberLabel + ': ' + gCheck.msg };

    // Umur di cutoff
    var age    = calcAgeAtCutoff_(m.tanggal_lahir);
    var aCheck = validateAge_(age, cabangCfg.umur_min,
                              cabangCfg.umur_max_tahun,
                              cabangCfg.umur_max_bulan,
                              cabangCfg.umur_max_hari);
    if (!aCheck.ok) return { success: false, message: memberLabel + ': ' + aCheck.msg };
    m._age = age; // simpan sementara
  }

  // 4) Cek kuota
  var pendSheet = getOrCreateSheet_(ss, SHEET_PENDAFTAR, PENDAFTAR_HEADERS);
  var curCount  = countByCabang_(pendSheet, body.cabang_lomba);
  if (curCount >= cabangCfg.kuota) {
    return { success: false, message: 'Kuota cabang ' + body.cabang_lomba + ' sudah penuh (' + cabangCfg.kuota + ')' };
  }

  // 5) Generate nomor
  var nomor = generateRegNumber_(pendSheet, cabangCfg.tipe);
  logInfo('api', 'Nomor pendaftaran: ' + nomor);

  // 6) Buat folder Drive & upload files
  var pesertaFolder = getPesertaFolder_(body.cabang_lomba, body.kecamatan, nomor);
  var folderUrl     = 'https://drive.google.com/drive/folders/' + pesertaFolder.getId();

  var processedMembers = [];
  for (var mi2 = 0; mi2 < members.length; mi2++) {
    var m2     = members[mi2];
    var prefix = (m2.nama_lengkap || 'Anggota' + (mi2+1)).replace(/\s+/g,'_').substring(0,30);
    var links  = uploadMemberFiles_(m2, pesertaFolder, prefix);
    processedMembers.push({
      nama_lengkap  : m2.nama_lengkap   || '',
      nik           : m2.nik            || '',
      tempat_lahir  : m2.tempat_lahir   || '',
      tanggal_lahir : m2.tanggal_lahir  || '',
      umur_display  : m2._age ? m2._age.display : '',
      jenis_kelamin : m2.jenis_kelamin  || '',
      alamat        : m2.alamat         || '',
      no_hp         : m2.no_hp          || '',
      email         : m2.email          || '',
      link_foto     : links.foto,
      link_ktp      : links.ktp,
    });
  }

  // Upload rekomendasi (satu per tim/individu)
  uploadFile_(body.rekom, pesertaFolder, 'REKOMENDASI');

  // 7) Simpan ke spreadsheet
  var lead = processedMembers[0];
  var row  = new Array(PENDAFTAR_HEADERS.length).fill('');
  row[COL.TIMESTAMP]         = new Date().toLocaleString('id-ID');
  row[COL.NOMOR_PENDAFTARAN] = nomor;
  row[COL.TIPE_LOMBA]        = cabangCfg.tipe;
  row[COL.NAMA_TIM]          = body.nama_tim    || '';
  row[COL.KECAMATAN]         = body.kecamatan   || '';
  row[COL.CABANG_LOMBA]      = body.cabang_lomba;
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
  row[COL.LINK_FOLDER]       = folderUrl;
  row[COL.ANGGOTA_JSON]      = cabangCfg.tipe === 'team' ? JSON.stringify(processedMembers) : '';
  row[COL.STATUS_VERIFIKASI] = 'Menunggu';
  pendSheet.appendRow(row);

  writeLog_(ss, 'REGISTER', nomor + ' | ' + body.cabang_lomba + ' | ' + body.kecamatan, 'ok');
  logInfo('api', 'Pendaftaran berhasil: ' + nomor);

  return {
    success           : true,
    nomor_pendaftaran : nomor,
    tipe_lomba        : cabangCfg.tipe,
    nama_tim          : body.nama_tim || '',
    cabang_lomba      : body.cabang_lomba,
    gender_cabang     : cabangCfg.gender,
    kecamatan         : body.kecamatan,
    jumlah_anggota    : processedMembers.length,
    link_folder       : folderUrl,
    message           : 'Pendaftaran berhasil!',
  };
}

// ── initSheets (jalankan sekali dari Script Editor) ───────────
function apiInitSheets_() {
  logInfo('api', 'apiInitSheets_');
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  getOrCreateSheet_(ss, SHEET_CONFIG,    CONFIG_HEADERS,    DEFAULT_CONFIG_DATA);
  getOrCreateSheet_(ss, SHEET_PENDAFTAR, PENDAFTAR_HEADERS);
  getOrCreateSheet_(ss, SHEET_LOG,       ['timestamp','action','detail','status']);
  return { success: true, message: 'Semua sheet siap.' };
}