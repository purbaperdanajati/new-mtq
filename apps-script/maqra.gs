// ============================================================
//  MTQ 2026 — apps-script/maqra.gs
//  Fitur Pengambilan Maqra (Peserta & Admin)
//  Tambahkan file ini ke project Apps Script Anda
// ============================================================

// ── Sheet & Column constants ──────────────────────────────────
var SHEET_MAQRA        = 'MAQRA';          // Daftar maqra per cabang
var SHEET_MAQRA_CONFIG = 'MAQRA_CONFIG';   // Konfigurasi buka/tutup per cabang
var SHEET_MAQRA_RESULT = 'MAQRA_RESULT';   // Hasil pengambilan maqra peserta

// Headers
var MAQRA_HEADERS = [
  'id_maqra', 'cabang_lomba', 'maqra_teks', 'maqra_detail',
  'nomor_urut', 'sudah_diambil', 'diambil_oleh', 'timestamp_ambil'
];
var MAQRA_CONFIG_HEADERS = [
  'cabang_lomba', 'buka', 'tutup', 'override', 'keterangan'
];
var MAQRA_RESULT_HEADERS = [
  'timestamp', 'nomor_pendaftaran', 'nik', 'nama_lengkap',
  'kecamatan', 'cabang_lomba', 'id_maqra', 'maqra_teks',
  'maqra_detail', 'nomor_maqra'
];

// MAQRA column indices (0-based)
var MCOL = {
  ID_MAQRA      : 0,
  CABANG_LOMBA  : 1,
  MAQRA_TEKS    : 2,
  MAQRA_DETAIL  : 3,
  NOMOR_URUT    : 4,
  SUDAH_DIAMBIL : 5,
  DIAMBIL_OLEH  : 6,
  TIMESTAMP     : 7,
};

// ── Route additions (tambahkan ke switch di doGet) ───────────
// case 'getMaqraStatus'  : result = apiGetMaqraStatus_(e.parameter);  break;
// case 'getMaqraAdmin'   : result = apiGetMaqraAdmin_(e.parameter);   break;
//
// Tambahkan ke doPost:
// if (body.action === 'ambilMaqra')   return apiAmbilMaqra_(body);
// if (body.action === 'saveMaqra')    return apiSaveMaqraAdmin_(body);
// if (body.action === 'deleteMaqra')  return apiDeleteMaqraAdmin_(body);
// if (body.action === 'saveMaqraConfig') return apiSaveMaqraConfig_(body);

// ────────────────────────────────────────────────────────────
//  PUBLIC: getMaqraStatus  (peserta)
//  Cek apakah buka, sudah diambil, dan list maqra tersedia
// ────────────────────────────────────────────────────────────
function apiGetMaqraStatus_(params) {
  var nomor  = String(params.nomor  || '').trim();
  var cabang = String(params.cabang || '').trim();

  if (!nomor || !cabang) {
    return { success:false, message:'Parameter nomor dan cabang wajib diisi' };
  }

  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  initMaqraSheets_(ss);

  // 1. Cek konfigurasi buka/tutup
  var cfgStatus = getMaqraConfigStatus_(ss, cabang);
  if (!cfgStatus.isOpen) {
    var jadwalBuka = cfgStatus.buka
      ? new Date(cfgStatus.buka).toLocaleString('id-ID', {
          day:'numeric', month:'long', year:'numeric',
          hour:'2-digit', minute:'2-digit'
        })
      : null;
    return {
      success   : true,
      isOpen    : false,
      jadwalBuka: jadwalBuka,
      message   : 'Pengambilan maqra belum dibuka'
    };
  }

  // 2. Cek apakah nomor sudah punya maqra
  var existing = findMaqraResult_(ss, nomor);
  if (existing) {
    return {
      success    : true,
      isOpen     : true,
      sudahAmbil : true,
      maqra      : existing
    };
  }

  // 3. Ambil daftar maqra tersedia untuk cabang
  var list = getAvailableMaqraList_(ss, cabang);
  return {
    success    : true,
    isOpen     : true,
    sudahAmbil : false,
    list       : list,
    totalSisa  : list.length
  };
}

// ────────────────────────────────────────────────────────────
//  PUBLIC (POST): ambilMaqra
//  Locking atomic — ambil maqra secara acak
// ────────────────────────────────────────────────────────────
function apiAmbilMaqra_(body) {
  var nomor  = String(body.nomor_pendaftaran || '').trim();
  var cabang = String(body.cabang_lomba      || '').trim();
  var nik    = String(body.nik               || '').trim();

  if (!nomor || !cabang || !nik) {
    return { success:false, message:'Data tidak lengkap' };
  }

  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  // Lock menggunakan LockService untuk cegah race condition
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
  } catch(e) {
    return { success:false, message:'Server sedang sibuk. Coba lagi dalam beberapa detik.' };
  }

  try {
    initMaqraSheets_(ss);

    // 1. Cek buka/tutup
    var cfgStatus = getMaqraConfigStatus_(ss, cabang);
    if (!cfgStatus.isOpen) {
      return { success:false, message:'Pengambilan maqra belum/sudah ditutup.' };
    }

    // 2. Cek duplikat — nomor sudah dapat maqra?
    var existing = findMaqraResult_(ss, nomor);
    if (existing) {
      return { success:true, sudahAmbil:true, maqra:existing,
               message:'Anda sudah mengambil maqra sebelumnya.' };
    }

    // 3. Ambil list tersedia
    var available = getAvailableMaqraList_(ss, cabang);
    if (!available.length) {
      return { success:false, message:'Semua maqra untuk cabang ini sudah diambil. Hubungi panitia.' };
    }

    // 4. Pilih acak
    var chosenIdx  = Math.floor(Math.random() * available.length);
    var chosen     = available[chosenIdx];

    // 5. Mark maqra sebagai sudah diambil di sheet MAQRA
    markMaqraAmbil_(ss, chosen.id_maqra, nomor);

    // 6. Simpan hasil ke sheet MAQRA_RESULT
    var namaLengkap = '', kecamatan = '';
    try {
      var pendSheet = ss.getSheetByName(SHEET_PENDAFTAR);
      if (pendSheet) {
        var rows = pendSheet.getDataRange().getValues();
        for (var i=1; i<rows.length; i++) {
          if (String(rows[i][COL.NOMOR_PENDAFTARAN]).trim() === nomor) {
            namaLengkap = rows[i][COL.NAMA_LENGKAP] || '';
            kecamatan   = rows[i][COL.KECAMATAN]    || '';
            break;
          }
        }
      }
    } catch(e2) {}

    var resultSheet = getOrCreateSheet_(ss, SHEET_MAQRA_RESULT, MAQRA_RESULT_HEADERS);
    var ts = new Date().toLocaleString('id-ID');
    resultSheet.appendRow([
      ts, nomor, nik, namaLengkap, kecamatan, cabang,
      chosen.id_maqra, chosen.maqra_teks, chosen.maqra_detail || '',
      chosen.nomor_urut || chosen.id_maqra
    ]);

    writeLog_(ss, 'MAQRA', nomor+' → '+chosen.maqra_teks, 'ok');

    return {
      success : true,
      maqra   : {
        id_maqra    : chosen.id_maqra,
        maqra_teks  : chosen.maqra_teks,
        maqra_detail: chosen.maqra_detail || '',
        nomor_maqra : String(chosen.nomor_urut || chosen.id_maqra),
        surah       : chosen.maqra_detail || ''
      }
    };

  } finally {
    lock.releaseLock();
  }
}

// ────────────────────────────────────────────────────────────
//  ADMIN: getMaqraAdmin
//  Ambil semua data maqra + config + results
// ────────────────────────────────────────────────────────────
function apiGetMaqraAdmin_(params) {
  if (!isTokenValid_(params.token)) {
    return { success:false, message:'Sesi tidak valid' };
  }
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  initMaqraSheets_(ss);

  var maqraSheet  = ss.getSheetByName(SHEET_MAQRA);
  var cfgSheet    = ss.getSheetByName(SHEET_MAQRA_CONFIG);
  var resultSheet = ss.getSheetByName(SHEET_MAQRA_RESULT);

  // Parse maqra list
  var maqraData = [];
  if (maqraSheet && maqraSheet.getLastRow() > 1) {
    var rows = maqraSheet.getRange(2,1,maqraSheet.getLastRow()-1,MAQRA_HEADERS.length).getValues();
    rows.forEach(function(r) {
      maqraData.push({
        id_maqra    : r[MCOL.ID_MAQRA]     || '',
        cabang_lomba: r[MCOL.CABANG_LOMBA] || '',
        maqra_teks  : r[MCOL.MAQRA_TEKS]  || '',
        maqra_detail: r[MCOL.MAQRA_DETAIL] || '',
        nomor_urut  : r[MCOL.NOMOR_URUT]   || '',
        sudah_diambil: String(r[MCOL.SUDAH_DIAMBIL]).toLowerCase() === 'true' ||
                       String(r[MCOL.SUDAH_DIAMBIL]).toLowerCase() === 'ya',
        diambil_oleh: r[MCOL.DIAMBIL_OLEH] || '',
        timestamp   : r[MCOL.TIMESTAMP]    || '',
      });
    });
  }

  // Parse config
  var configData = [];
  if (cfgSheet && cfgSheet.getLastRow() > 1) {
    var cfgRows = cfgSheet.getRange(2,1,cfgSheet.getLastRow()-1,MAQRA_CONFIG_HEADERS.length).getValues();
    cfgRows.forEach(function(r) {
      configData.push({
        cabang_lomba: r[0] || '',
        buka        : r[1] ? String(r[1]) : '',
        tutup       : r[2] ? String(r[2]) : '',
        override    : r[3] || '',
        keterangan  : r[4] || '',
      });
    });
  }

  // Parse results
  var results = [];
  if (resultSheet && resultSheet.getLastRow() > 1) {
    var resRows = resultSheet.getRange(2,1,resultSheet.getLastRow()-1,MAQRA_RESULT_HEADERS.length).getValues();
    resRows.forEach(function(r) {
      results.push({
        timestamp          : r[0] || '',
        nomor_pendaftaran  : r[1] || '',
        nik                : r[2] || '',
        nama_lengkap       : r[3] || '',
        kecamatan          : r[4] || '',
        cabang_lomba       : r[5] || '',
        id_maqra           : r[6] || '',
        maqra_teks         : r[7] || '',
        maqra_detail       : r[8] || '',
        nomor_maqra        : r[9] || '',
      });
    });
  }

  return {
    success    : true,
    maqraList  : maqraData,
    config     : configData,
    results    : results,
    stats: {
      total        : maqraData.length,
      sudahDiambil : maqraData.filter(function(m){return m.sudah_diambil;}).length,
      tersedia     : maqraData.filter(function(m){return !m.sudah_diambil;}).length,
    }
  };
}

// ────────────────────────────────────────────────────────────
//  ADMIN (POST): saveMaqra
//  Tambah / update maqra
// ────────────────────────────────────────────────────────────
function apiSaveMaqraAdmin_(body) {
  if (!isTokenValid_(body.token)) return { success:false, message:'Sesi tidak valid' };

  var ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  initMaqraSheets_(ss);
  var sheet = ss.getSheetByName(SHEET_MAQRA);

  var items = body.items || [];  // Array of maqra objects to save
  if (!items.length) return { success:false, message:'Data maqra kosong' };

  // If replace=true, clear all maqra for the given cabang
  if (body.replace && body.cabang_lomba) {
    var cabangTarget = String(body.cabang_lomba).trim();
    if (sheet.getLastRow() > 1) {
      var allRows = sheet.getRange(2,1,sheet.getLastRow()-1,MAQRA_HEADERS.length).getValues();
      // Delete rows for this cabang (bottom-up to keep indices stable)
      for (var i = allRows.length - 1; i >= 0; i--) {
        if (String(allRows[i][MCOL.CABANG_LOMBA]).trim() === cabangTarget) {
          // Only delete if not yet taken (preserve audit trail)
          var taken = String(allRows[i][MCOL.SUDAH_DIAMBIL]).toLowerCase();
          if (taken !== 'true' && taken !== 'ya') {
            sheet.deleteRow(i + 2);
          }
        }
      }
    }
  }

  // Append new items
  var added = 0;
  items.forEach(function(item) {
    var idMaqra = item.id_maqra || (String(item.cabang_lomba||'').replace(/\s+/g,'_').toUpperCase() + '_' + String(item.nomor_urut||'').padStart(3,'0'));
    sheet.appendRow([
      idMaqra,
      item.cabang_lomba || '',
      item.maqra_teks   || '',
      item.maqra_detail || '',
      item.nomor_urut   || '',
      'false', '', ''
    ]);
    added++;
  });

  writeLog_(ss, 'MAQRA_SAVE', 'Tambah '+added+' maqra untuk '+body.cabang_lomba, 'ok');
  return { success:true, added:added };
}

// ────────────────────────────────────────────────────────────
//  ADMIN (POST): deleteMaqra
//  Hapus satu maqra berdasarkan id_maqra
// ────────────────────────────────────────────────────────────
function apiDeleteMaqraAdmin_(body) {
  if (!isTokenValid_(body.token)) return { success:false, message:'Sesi tidak valid' };

  var ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(SHEET_MAQRA);
  if (!sheet) return { success:false, message:'Sheet MAQRA tidak ditemukan' };

  var target = String(body.id_maqra || '').trim();
  if (!target) return { success:false, message:'id_maqra wajib diisi' };

  if (sheet.getLastRow() <= 1) return { success:false, message:'Sheet kosong' };

  var rows = sheet.getRange(2,1,sheet.getLastRow()-1,1).getValues();
  for (var i = rows.length - 1; i >= 0; i--) {
    if (String(rows[i][0]).trim() === target) {
      sheet.deleteRow(i + 2);
      return { success:true, id_maqra:target };
    }
  }
  return { success:false, message:'Maqra tidak ditemukan: '+target };
}

// ────────────────────────────────────────────────────────────
//  ADMIN (POST): saveMaqraConfig
//  Simpan konfigurasi buka/tutup pengambilan maqra
// ────────────────────────────────────────────────────────────
function apiSaveMaqraConfig_(body) {
  if (!isTokenValid_(body.token)) return { success:false, message:'Sesi tidak valid' };

  var ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  initMaqraSheets_(ss);
  var sheet = ss.getSheetByName(SHEET_MAQRA_CONFIG);

  var cabang   = String(body.cabang_lomba || '').trim();
  var buka     = String(body.buka   || '').trim();
  var tutup    = String(body.tutup  || '').trim();
  var override = String(body.override || '').trim();   // 'buka' | 'tutup' | ''
  var keterangan = String(body.keterangan || '').trim();

  if (!cabang) return { success:false, message:'cabang_lomba wajib diisi' };

  // Find existing row for this cabang
  var found = false;
  if (sheet.getLastRow() > 1) {
    var rows = sheet.getRange(2,1,sheet.getLastRow()-1,MAQRA_CONFIG_HEADERS.length).getValues();
    for (var i = 0; i < rows.length; i++) {
      if (String(rows[i][0]).trim() === cabang) {
        // Update existing
        sheet.getRange(i+2, 1, 1, MAQRA_CONFIG_HEADERS.length).setValues([[
          cabang, buka, tutup, override, keterangan
        ]]);
        found = true;
        break;
      }
    }
  }

  if (!found) {
    sheet.appendRow([cabang, buka, tutup, override, keterangan]);
  }

  writeLog_(ss, 'MAQRA_CONFIG', 'Config cabang '+cabang+' buka='+buka+' tutup='+tutup+' override='+override, 'ok');
  return { success:true, cabang_lomba:cabang };
}

// ════════════════════════════════════════════════════════════
//  INTERNAL HELPERS
// ════════════════════════════════════════════════════════════

function initMaqraSheets_(ss) {
  getOrCreateSheet_(ss, SHEET_MAQRA,        MAQRA_HEADERS);
  getOrCreateSheet_(ss, SHEET_MAQRA_CONFIG, MAQRA_CONFIG_HEADERS);
  getOrCreateSheet_(ss, SHEET_MAQRA_RESULT, MAQRA_RESULT_HEADERS);
}

/**
 * Cek status buka/tutup pengambilan maqra.
 * Prioritas: cari konfigurasi 'GLOBAL' dahulu (satu config untuk semua cabang),
 * jika tidak ada baru cari per-cabang spesifik.
 */
function getMaqraConfigStatus_(ss, cabang) {
  var sheet = ss.getSheetByName(SHEET_MAQRA_CONFIG);
  if (!sheet || sheet.getLastRow() <= 1) {
    return { isOpen:false, message:'Konfigurasi maqra belum diisi oleh admin.' };
  }

  var rows = sheet.getRange(2, 1, sheet.getLastRow()-1, MAQRA_CONFIG_HEADERS.length).getValues();
  var cabangTarget = String(cabang).trim();

  // Coba urutan: GLOBAL dulu, lalu spesifik cabang
  var searchOrder = ['GLOBAL', cabangTarget];

  for (var s = 0; s < searchOrder.length; s++) {
    var key = searchOrder[s];
    for (var i = 0; i < rows.length; i++) {
      if (String(rows[i][0]).trim() !== key) continue;

      var buka     = rows[i][1] ? String(rows[i][1]) : null;
      var tutup    = rows[i][2] ? String(rows[i][2]) : null;
      var override = String(rows[i][3] || '').toLowerCase().trim();
      var sumber   = key === 'GLOBAL' ? 'global' : 'per-cabang';

      if (override === 'buka')  return { isOpen:true,  buka:buka, tutup:tutup, sumber:sumber };
      if (override === 'tutup') return { isOpen:false, buka:buka, tutup:tutup, sumber:sumber };

      if (buka && tutup) {
        var now    = new Date();
        var bukaD  = new Date(buka);
        var tutupD = new Date(tutup);
        return {
          isOpen : now >= bukaD && now < tutupD,
          buka   : buka,
          tutup  : tutup,
          sumber : sumber,
          status : now < bukaD ? 'belum_buka' : (now < tutupD ? 'buka' : 'tutup')
        };
      }
      return { isOpen:false, buka:buka, tutup:tutup, sumber:sumber, message:'Waktu belum dikonfigurasi' };
    }
  }

  return { isOpen:false, message:'Konfigurasi maqra belum ada. Hubungi admin.' };
}

/**
 * Cari hasil maqra untuk nomor pendaftaran
 */
function findMaqraResult_(ss, nomor) {
  var sheet = ss.getSheetByName(SHEET_MAQRA_RESULT);
  if (!sheet || sheet.getLastRow() <= 1) return null;

  var rows = sheet.getRange(2,1,sheet.getLastRow()-1,MAQRA_RESULT_HEADERS.length).getValues();
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i][1]).trim() === String(nomor).trim()) {
      return {
        nomor_pendaftaran : rows[i][1] || '',
        nik               : rows[i][2] || '',
        nama_lengkap      : rows[i][3] || '',
        cabang_lomba      : rows[i][5] || '',
        id_maqra          : rows[i][6] || '',
        maqra_teks        : rows[i][7] || '',
        maqra             : rows[i][7] || '',
        maqra_detail      : rows[i][8] || '',
        surah             : rows[i][8] || '',
        nomor_maqra       : String(rows[i][9] || ''),
        timestamp         : rows[i][0] || '',
      };
    }
  }
  return null;
}

/**
 * Ambil daftar maqra yang belum diambil untuk satu cabang
 */
function getAvailableMaqraList_(ss, cabang) {
  var sheet = ss.getSheetByName(SHEET_MAQRA);
  if (!sheet || sheet.getLastRow() <= 1) return [];

  var rows = sheet.getRange(2,1,sheet.getLastRow()-1,MAQRA_HEADERS.length).getValues();
  var list = [];
  var cabangTarget = String(cabang).trim();

  rows.forEach(function(r) {
    if (String(r[MCOL.CABANG_LOMBA]).trim() !== cabangTarget) return;
    var taken = String(r[MCOL.SUDAH_DIAMBIL]).toLowerCase();
    if (taken === 'true' || taken === 'ya') return;
    list.push({
      id_maqra    : String(r[MCOL.ID_MAQRA])   || '',
      cabang_lomba: String(r[MCOL.CABANG_LOMBA])|| '',
      maqra_teks  : String(r[MCOL.MAQRA_TEKS]) || '',
      maqra_detail: String(r[MCOL.MAQRA_DETAIL])|| '',
      nomor_urut  : String(r[MCOL.NOMOR_URUT])  || '',
    });
  });

  return list;
}

/**
 * Tandai maqra sebagai sudah diambil
 */
function markMaqraAmbil_(ss, idMaqra, nomorPendaftaran) {
  var sheet = ss.getSheetByName(SHEET_MAQRA);
  if (!sheet || sheet.getLastRow() <= 1) return;

  var rows = sheet.getRange(2,1,sheet.getLastRow()-1,MAQRA_HEADERS.length).getValues();
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i][MCOL.ID_MAQRA]).trim() === String(idMaqra).trim()) {
      var rowNum = i + 2;
      sheet.getRange(rowNum, MCOL.SUDAH_DIAMBIL + 1).setValue('true');
      sheet.getRange(rowNum, MCOL.DIAMBIL_OLEH  + 1).setValue(nomorPendaftaran);
      sheet.getRange(rowNum, MCOL.TIMESTAMP     + 1).setValue(new Date().toLocaleString('id-ID'));
      break;
    }
  }
}

// ── Helper: perbaikan endpoint (tambahkan ke doPost) ──────────
function apiPerbaikan_(body) {
  var nomor   = String(body.nomor_pendaftaran || '').trim();
  if (!nomor) return { success:false, message:'Nomor pendaftaran tidak ada' };

  var ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(SHEET_PENDAFTAR);
  if (!sheet) return { success:false, message:'Sheet tidak ditemukan' };

  // Find row
  var lastRow = sheet.getLastRow();
  if (lastRow <= 1) return { success:false, message:'Data kosong' };

  var nums = sheet.getRange(2, COL.NOMOR_PENDAFTARAN+1, lastRow-1, 1).getValues();
  var rowNum = -1;
  for (var i=0; i<nums.length; i++) {
    if (String(nums[i][0]).trim() === nomor) { rowNum = i+2; break; }
  }
  if (rowNum < 0) return { success:false, message:'Nomor tidak ditemukan: '+nomor };

  // Verify it's currently "Ditolak"
  var currentStatus = sheet.getRange(rowNum, COL.STATUS_VERIFIKASI+1).getValue();
  if (String(currentStatus).trim() !== 'Ditolak') {
    return { success:false, message:'Perbaikan hanya bisa dilakukan untuk pendaftaran berstatus Ditolak' };
  }

  // Update data
  var members = body.members || [];
  if (members.length > 0) {
    var lead = members[0];
    if (lead.nama_lengkap)  sheet.getRange(rowNum, COL.NAMA_LENGKAP+1 ).setValue(lead.nama_lengkap);
    if (lead.nik)           sheet.getRange(rowNum, COL.NIK+1           ).setValue(lead.nik);
    if (lead.tempat_lahir)  sheet.getRange(rowNum, COL.TEMPAT_LAHIR+1  ).setValue(lead.tempat_lahir);
    if (lead.tanggal_lahir) sheet.getRange(rowNum, COL.TANGGAL_LAHIR+1 ).setValue(lead.tanggal_lahir);
    if (lead.alamat)        sheet.getRange(rowNum, COL.ALAMAT+1         ).setValue(lead.alamat);
    if (lead.no_hp)         sheet.getRange(rowNum, COL.NO_HP+1          ).setValue(lead.no_hp);

    // Upload new files if provided
    try {
      var pesertaFolder = getPesertaFolder_(sheet.getRange(rowNum, COL.CABANG_LOMBA+1).getValue(),
                                            sheet.getRange(rowNum, COL.KECAMATAN+1).getValue(), nomor);
      for (var mi=0; mi<members.length; mi++) {
        var m = members[mi];
        var prefix = (m.nama_lengkap||'M'+(mi+1)).replace(/\s+/g,'_').substring(0,30)+'_REVISI';
        if (m.foto) { var fl = uploadFile_(m.foto, pesertaFolder, 'FOTO_'+prefix); if (fl) sheet.getRange(rowNum, COL.NAMA_LENGKAP+1); }
        if (m.ktp)  { uploadFile_(m.ktp,  pesertaFolder, 'KTP_'+prefix); }
      }
      if (body.rekom) {
        var rekomUrl = uploadFile_(body.rekom, pesertaFolder, 'REKOMENDASI_REVISI');
        if (rekomUrl) sheet.getRange(rowNum, COL.LINK_REKOM+1).setValue(rekomUrl);
      }
    } catch(e) { logWarn('perbaikan','Upload revisi error: '+e.message); }

    // Update anggota_json for team
    if (members.length > 1) {
      try {
        var existingJson = sheet.getRange(rowNum, COL.ANGGOTA_JSON+1).getValue();
        var existing = existingJson ? JSON.parse(existingJson) : [];
        members.forEach(function(m, idx) {
          if (existing[idx]) {
            if (m.nama_lengkap)  existing[idx].nama_lengkap  = m.nama_lengkap;
            if (m.nik)           existing[idx].nik            = m.nik;
            if (m.tempat_lahir)  existing[idx].tempat_lahir   = m.tempat_lahir;
            if (m.tanggal_lahir) existing[idx].tanggal_lahir  = m.tanggal_lahir;
            if (m.alamat)        existing[idx].alamat         = m.alamat;
            if (m.no_hp)         existing[idx].no_hp          = m.no_hp;
          }
        });
        sheet.getRange(rowNum, COL.ANGGOTA_JSON+1).setValue(JSON.stringify(existing));
      } catch(e2) { logWarn('perbaikan','Anggota JSON update error: '+e2.message); }
    }
  }

  // Reset status ke Menunggu
  sheet.getRange(rowNum, COL.STATUS_VERIFIKASI+1).setValue('Menunggu');
  sheet.getRange(rowNum, COL.CATATAN+1).setValue('Direvisi oleh peserta pada '+new Date().toLocaleString('id-ID'));

  writeLog_(ss, 'PERBAIKAN', nomor+' status reset ke Menunggu', 'ok');
  return { success:true, nomor_pendaftaran:nomor, message:'Perbaikan berhasil dikirim. Status direset ke Menunggu.' };
}