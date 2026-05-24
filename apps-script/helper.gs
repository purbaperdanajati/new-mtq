// ============================================================
//  MTQ 2026 — apps-script/helper.gs
//  Fungsi utilitas — semua pakai config dari config.gs
// ============================================================

// ── Logger ───────────────────────────────────────────────────
function log_(level, context, message, data) {
  var parts = ['[MTQ2026]', '[' + level.toUpperCase() + ']', '[' + context + ']', message];
  if (data !== undefined) parts.push(JSON.stringify(data));
  Logger.log(parts.join(' '));
}
function logInfo (ctx, msg, d) { log_('INFO',  ctx, msg, d); }
function logWarn (ctx, msg, d) { log_('WARN',  ctx, msg, d); }
function logError(ctx, msg, d) { log_('ERROR', ctx, msg, d); }

// ── Cek status pendaftaran ────────────────────────────────────
function isRegistrationOpen_() {
  logInfo('helper', 'isRegistrationOpen_ called');
  if (PENDAFTARAN_CONFIG.OVERRIDE === true) {
    logInfo('helper', 'Override: PAKSA BUKA');
    return { open: true, status: 'buka' };
  }
  if (PENDAFTARAN_CONFIG.OVERRIDE === false) {
    logInfo('helper', 'Override: PAKSA TUTUP');
    return { open: false, status: 'tutup' };
  }
  var now   = new Date();
  var buka  = new Date(PENDAFTARAN_CONFIG.BUKA);
  var tutup = new Date(PENDAFTARAN_CONFIG.TUTUP);
  logInfo('helper', 'Waktu', { now: now.toString(), buka: buka.toString(), tutup: tutup.toString() });
  if (now < buka)  return { open: false, status: 'belum_buka' };
  if (now < tutup) return { open: true,  status: 'buka' };
  return { open: false, status: 'tutup' };
}

// ── Hitung umur presisi pada tanggal cutoff ────────────────────
// Returns { tahun, bulan, hari, display }
function calcAgeAtCutoff_(dobString) {
  var cutoff = PENDAFTARAN_CONFIG.AGE_CUTOFF_DATE + 'T00:00:00';
  var dob    = new Date(dobString + 'T00:00:00');
  var ref    = new Date(cutoff);

  var tahun  = ref.getFullYear() - dob.getFullYear();
  var bulan  = ref.getMonth()    - dob.getMonth();
  var hari   = ref.getDate()     - dob.getDate();

  if (hari < 0) {
    bulan--;
    var prevEnd = new Date(ref.getFullYear(), ref.getMonth(), 0);
    hari += prevEnd.getDate();
  }
  if (bulan < 0) { tahun--; bulan += 12; }

  var display = tahun + ' thn ' + bulan + ' bln ' + hari + ' hr';
  logInfo('helper', 'calcAge', { dob: dobString, cutoff: PENDAFTARAN_CONFIG.AGE_CUTOFF_DATE, result: display });
  return { tahun: tahun, bulan: bulan, hari: hari, display: display };
}

// ── Validasi umur terhadap batas CONFIG ───────────────────────
// Returns { ok:boolean, msg:string }
function validateAge_(age, umurMin, maxTahun, maxBulan, maxHari) {
  // Cek minimum (tahun penuh)
  if (age.tahun < umurMin) {
    return { ok: false, msg: 'Usia ' + age.display + ' kurang dari minimum ' + umurMin + ' tahun' };
  }
  // Cek maksimum presisi
  if (age.tahun > maxTahun) {
    return { ok: false, msg: 'Usia ' + age.display + ' melebihi batas maks ' + maxTahun + ' thn ' + maxBulan + ' bln ' + maxHari + ' hr' };
  }
  if (age.tahun === maxTahun) {
    if (age.bulan > maxBulan) {
      return { ok: false, msg: 'Usia ' + age.display + ' melebihi batas maks ' + maxTahun + ' thn ' + maxBulan + ' bln ' + maxHari + ' hr' };
    }
    if (age.bulan === maxBulan && age.hari > maxHari) {
      return { ok: false, msg: 'Usia ' + age.display + ' melebihi batas maks ' + maxTahun + ' thn ' + maxBulan + ' bln ' + maxHari + ' hr' };
    }
  }
  return { ok: true, msg: 'Usia valid: ' + age.display };
}

// ── Validasi gender ───────────────────────────────────────────
function validateGender_(jenisKelamin, genderCabang) {
  if (genderCabang === 'Semua') return { ok: true };
  var map = { 'L': 'Laki-laki', 'P': 'Perempuan' };
  var required = map[genderCabang] || '';
  if (jenisKelamin !== required) {
    return { ok: false, msg: 'Cabang ini hanya untuk ' + required + '. Peserta (' + jenisKelamin + ') tidak sesuai.' };
  }
  return { ok: true };
}

// ── Generate nomor pendaftaran ────────────────────────────────
function generateRegNumber_(sheet, tipe) {
  var prefix = tipe === 'team' ? 'MTQ2026-T-' : 'MTQ2026-I-';
  if (sheet.getLastRow() <= 1) return prefix + '0001';

  var nums = sheet.getRange(2, COL.NOMOR_PENDAFTARAN + 1, sheet.getLastRow() - 1, 1).getValues();
  var max  = 0;
  nums.forEach(function(r) {
    var m = String(r[0]).match(/-(\d+)$/);
    if (m) max = Math.max(max, parseInt(m[1]));
  });
  return prefix + String(max + 1).padStart(4, '0');
}

// ── Hitung jumlah pendaftar per cabang ────────────────────────
function countByCabang_(sheet, cabang) {
  if (sheet.getLastRow() <= 1) return 0;
  var data = sheet.getRange(2, COL.CABANG_LOMBA + 1, sheet.getLastRow() - 1, 1).getValues();
  return data.filter(function(r) { return r[0] === cabang; }).length;
}

// ── Ambil / buat sheet ────────────────────────────────────────
function getOrCreateSheet_(ss, name, headers, defaultData) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    logInfo('helper', 'Buat sheet baru: ' + name);
    sheet = ss.insertSheet(name);
    if (headers && headers.length) {
      sheet.appendRow(headers);
      var hRange = sheet.getRange(1, 1, 1, headers.length);
      hRange.setBackground('#065f46').setFontColor('#ffffff').setFontWeight('bold');
    }
    if (defaultData && defaultData.length) {
      sheet.getRange(2, 1, defaultData.length, defaultData[0].length).setValues(defaultData);
      logInfo('helper', 'Data default diisi: ' + defaultData.length + ' baris');
    }
  }
  return sheet;
}

// ── Parse baris PENDAFTAR ke object ──────────────────────────
function rowToObj_(row) {
  var obj = {};
  PENDAFTAR_HEADERS.forEach(function(h, i) {
    obj[h] = (row[i] !== undefined && row[i] !== null) ? row[i] : '';
  });
  if (obj.anggota_json) {
    try { obj.anggota = JSON.parse(obj.anggota_json); } catch(e) { obj.anggota = []; }
  }
  return obj;
}

// ── Generate token admin ──────────────────────────────────────
function genToken_() {
  var raw = ADMIN_PASSWORD + '_' + new Date().toDateString();
  return Utilities.base64Encode(
    Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, raw, Utilities.Charset.UTF_8)
  );
}

function isTokenValid_(token) {
  if (!token) return false;
  return String(token) === genToken_();
}

// ── Tulis ke sheet LOG ────────────────────────────────────────
function writeLog_(ss, action, detail, status) {
  try {
    var logSheet = ss.getSheetByName(SHEET_LOG);
    if (!logSheet) {
      logSheet = ss.insertSheet(SHEET_LOG);
      logSheet.appendRow(['timestamp','action','detail','status']);
    }
    logSheet.appendRow([new Date().toLocaleString('id-ID'), action, detail, status || 'ok']);
  } catch(e) { logWarn('helper', 'writeLog_ gagal: ' + e.message); }
}