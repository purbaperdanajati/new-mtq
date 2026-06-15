// ============================================================
//  MTQ 2026 — js/config.js
//  SATU SUMBER KONFIGURASI FRONTEND
//  Hanya edit file ini untuk mengubah URL API & semua setting
// ============================================================

const MTQ_CONFIG = {

  // ── Google Apps Script Web App URL ──────────────────────────
  // Setelah deploy di Apps Script, paste URL-nya di sini
  API_URL: 'https://script.google.com/macros/s/AKfycbw7hEv8PuIEn5YEvQd7U6bK88_WSfIcgRs4Cpo03fpeAeSiRNVo3dXwrlB6qGtsP3QW/exec',

  // ── Fallback (akan ditimpa nilai dari API saat getConfig) ───
  PENDAFTARAN_BUKA : '2026-06-01T00:00:00',
  PENDAFTARAN_TUTUP: '2026-07-31T23:59:59',
  AGE_CUTOFF_DATE  : '2026-07-01',       // Hitung umur per tanggal ini

  // ── Info Event ───────────────────────────────────────────────
  EVENT_DATE    : '2026-08-15T08:00:00',
  EVENT_LOCATION: 'GOR Kabupaten Indramayu',
  EVENT_THEME   : "Dengan Al-Qur'an Membangun Generasi Emas",
  EVENT_TITLE   : 'MTQ Kabupaten Indramayu Tahun 2026',

  // ── Developer Mode ───────────────────────────────────────────
  // true  = tampilkan tombol Random Fill (untuk testing)
  // false = sembunyikan (untuk produksi)
  DEV_MODE: true,
};

// ── Logger terpusat ──────────────────────────────────────────
const log = {
  info : (...a) => console.log('%c[MTQ] INFO', 'color:#065f46;font-weight:bold', ...a),
  warn : (...a) => console.warn('%c[MTQ] WARN', 'color:#b45309;font-weight:bold', ...a),
  error: (...a) => console.error('%c[MTQ] ERROR', 'color:#dc2626;font-weight:bold', ...a),
  debug: (...a) => console.debug('%c[MTQ] DEBUG', 'color:#6b7280;font-weight:bold', ...a),
  step : (n, msg) => console.group(
    `%c[MTQ] STEP ${n}: ${msg}`,
    'color:#0369a1;font-weight:bold'
  ),

  group: (title) => console.group(
    `%c[MTQ] ${title}`,
    'color:#047857;font-weight:bold'
  ),

  end  : () => console.groupEnd(),

  time : (label) => console.time(`[MTQ] ${label}`),
  timeEnd: (label) => console.timeEnd(`[MTQ] ${label}`),

  table: (data) => console.table(data),
};

// ── Utilitas Tanggal ─────────────────────────────────────────
/**
 * Hitung umur presisi (tahun-bulan-hari) pada tanggal cutoff
 * @param {string} dobStr    - 'YYYY-MM-DD'
 * @param {string} cutoffStr - 'YYYY-MM-DD'  (default: MTQ_CONFIG.AGE_CUTOFF_DATE)
 * @returns {{ tahun:number, bulan:number, hari:number }}
 */
function calcAgeAt(dobStr, cutoffStr) {
  const cutoffDate = cutoffStr || MTQ_CONFIG.AGE_CUTOFF_DATE;
  const dob    = new Date(dobStr    + 'T00:00:00');
  const cutoff = new Date(cutoffDate + 'T00:00:00');

  let tahun = cutoff.getFullYear() - dob.getFullYear();
  let bulan = cutoff.getMonth()    - dob.getMonth();
  let hari  = cutoff.getDate()     - dob.getDate();

  if (hari < 0) {
    bulan--;
    const prevMonthEnd = new Date(cutoff.getFullYear(), cutoff.getMonth(), 0);
    hari += prevMonthEnd.getDate();
  }
  if (bulan < 0) { tahun--; bulan += 12; }

  return { tahun, bulan, hari };
}

/**
 * Cek apakah umur (obj) dalam rentang [minTahun, {maxTahun,maxBulan,maxHari}]
 * @returns {{ ok:boolean, msg:string }}
 */
function checkAgeRange(age, minTahun, maxTahun, maxBulan, maxHari) {
  if (age.tahun < minTahun) {
    return { ok: false, msg: `Usia kurang dari minimum ${minTahun} tahun` };
  }
  // Bandingkan dengan batas maksimum presisi
  if (age.tahun > maxTahun) {
    return { ok: false, msg: `Usia melebihi batas maksimum ${maxTahun} tahun ${maxBulan} bulan ${maxHari} hari` };
  }
  if (age.tahun === maxTahun) {
    if (age.bulan > maxBulan) {
      return { ok: false, msg: `Usia melebihi batas maksimum ${maxTahun} tahun ${maxBulan} bulan ${maxHari} hari` };
    }
    if (age.bulan === maxBulan && age.hari > maxHari) {
      return { ok: false, msg: `Usia melebihi batas maksimum ${maxTahun} tahun ${maxBulan} bulan ${maxHari} hari` };
    }
  }
  return { ok: true, msg: `Usia valid: ${age.tahun} thn ${age.bulan} bln ${age.hari} hr` };
}

/**
 * Format objek umur menjadi string
 */
function fmtAge(age) {
  return `${age.tahun} thn ${age.bulan} bln ${age.hari} hr`;
}

/**
 * Cek status pendaftaran berdasarkan waktu sekarang
 * @returns {'belum_buka'|'buka'|'tutup'}
 */
function getRegStatus() {
  const now   = new Date();
  const buka  = new Date(MTQ_CONFIG.PENDAFTARAN_BUKA);
  const tutup = new Date(MTQ_CONFIG.PENDAFTARAN_TUTUP);
  if (now < buka)  return 'belum_buka';
  if (now < tutup) return 'buka';
  return 'tutup';
}

// ── Satu-satunya sumber API_URL untuk semua file ──────────────
// main.js, daftar.js, admin.html semuanya baca dari sini
window.MTQ_API_URL = MTQ_CONFIG.API_URL;