// ============================================================
//  MTQ 2026 — apps-script/config.gs  (rev 6)
//  Fix #2: kuota=31 (1 per kecamatan), #9: initSheets lengkap,
//  #10: umur_min=0 (tidak ada batas bawah), #4: password here
// ============================================================

// ── 1. Spreadsheet & Drive ───────────────────────────────────
var SPREADSHEET_ID       = '10CS7gBHmS4nx9XKBvPttJ3qUVegsNy0Xy3J7T63J3Lk';
var DRIVE_ROOT_FOLDER_ID = '1e784li0m9IcBXy9gNsX6Yin5KAtxottg';

// ── 2. Admin Password ─────────────────────────────────────────
// FIX #4: Ganti nilai ini sebelum deploy produksi!
// Contoh yang kuat: 'MTQ2026@Indramayu#Adm!'
var ADMIN_PASSWORD   = 'MTQ2026@Admin!';

// ── Google Drive API Key (untuk DocumentPreviewer di admin) ───
// Buat di console.cloud.google.com → APIs & Services → Credentials
// Batasi: Application restrictions = HTTP referrers (your domain)
// Batasi: API restrictions = Google Drive API only
var DRIVE_API_KEY    = 'GANTI_DRIVE_API_KEY';

// ── 3. Nama Sheet ─────────────────────────────────────────────
var SHEET_CONFIG    = 'CONFIG';
var SHEET_PENDAFTAR = 'PENDAFTAR';
var SHEET_LOG       = 'LOG';

// ── 4. Konfigurasi Pendaftaran ────────────────────────────────
var PENDAFTARAN_CONFIG = {
  BUKA           : '2026-06-01T00:00:00',
  TUTUP          : '2026-07-31T23:59:59',
  AGE_CUTOFF_DATE: '2026-07-01',
  // OVERRIDE: null=auto | true=paksa buka | false=paksa tutup
  OVERRIDE       : null
};

// ── 5. Info Event ─────────────────────────────────────────────
var EVENT_INFO = {
  nama   : 'MTQ Kabupaten Indramayu Tahun 2026',
  tanggal: '15 Agustus 2026',
  lokasi : 'GOR Kabupaten Indramayu',
  tema   : "Dengan Al-Qur'an Membangun Generasi Emas"
};

// ── 6. Kolom PENDAFTAR (0-based) ──────────────────────────────
// FIX #6: tambah nama_bank, nomor_rekening, nama_rekening
var COL = {
  TIMESTAMP        : 0,
  NOMOR_PENDAFTARAN: 1,
  TIPE_LOMBA       : 2,
  NAMA_TIM         : 3,
  KECAMATAN        : 4,
  CABANG_LOMBA     : 5,
  GENDER_CABANG    : 6,
  NAMA_LENGKAP     : 7,
  NIK              : 8,
  TEMPAT_LAHIR     : 9,
  TANGGAL_LAHIR    : 10,
  UMUR_DISPLAY     : 11,
  JENIS_KELAMIN    : 12,
  ALAMAT           : 13,
  NO_HP            : 14,
  EMAIL            : 15,
  NAMA_BANK        : 16,   // FIX #6
  NOMOR_REKENING   : 17,   // FIX #6
  NAMA_REKENING    : 18,   // FIX #6
  LINK_FOLDER      : 19,
  ANGGOTA_JSON     : 20,
  STATUS_VERIFIKASI: 21,
  CATATAN          : 22,
  LINK_REKOM       : 23
};

// ── 7. Header PENDAFTAR ───────────────────────────────────────
var PENDAFTAR_HEADERS = [
  'timestamp','nomor_pendaftaran','tipe_lomba','nama_tim','kecamatan',
  'cabang_lomba','gender_cabang','nama_lengkap','nik','tempat_lahir',
  'tanggal_lahir','umur_display','jenis_kelamin','alamat','no_hp','email',
  'nama_bank','nomor_rekening','nama_rekening',
  'link_folder','anggota_json','status_verifikasi','catatan','link_rekom'
];

// ── 8. Header CONFIG ──────────────────────────────────────────
var CONFIG_HEADERS = [
  'cabang_lomba','tipe','gender',
  'umur_min','umur_max_tahun','umur_max_bulan','umur_max_hari',
  'kuota','status_aktif'
];

// ── 9. Data CONFIG default ────────────────────────────────────
// FIX #2: kuota=31 (1 per kecamatan Indramayu = 31 kecamatan)
// FIX #10: umur_min=0 (tidak ada batas bawah usia)
var DEFAULT_CONFIG_DATA = [
  // Tartil
  ["Tartil Al Qur'an Putra", 'individu','L', 0, 12,11,29, 31,'Aktif'],
  ["Tartil Al Qur'an Putri", 'individu','P', 0, 12,11,29, 31,'Aktif'],

  // Tilawah
  ['Tilawah Anak-anak Putra', 'individu','L', 0, 14,11,29, 31,'Aktif'],
  ['Tilawah Anak-anak Putri', 'individu','P', 0, 14,11,29, 31,'Aktif'],

  ['Tilawah Remaja Putra', 'individu','L', 0, 24,11,29, 31,'Aktif'],
  ['Tilawah Remaja Putri', 'individu','P', 0, 24,11,29, 31,'Aktif'],

  ['Tilawah Dewasa Putra', 'individu','L', 0, 40,11,29, 31,'Aktif'],
  ['Tilawah Dewasa Putri', 'individu','P', 0, 40,11,29, 31,'Aktif'],

  // Qiraat
  ["Qira'at Mujawwad Putra", 'individu','L', 0, 40,11,29, 31,'Aktif'],
  ["Qira'at Mujawwad Putri", 'individu','P', 0, 40,11,29, 31,'Aktif'],

  // Hafalan
  ['Hafalan 1 Juz Putra', 'individu','L', 0, 15,11,29, 31,'Aktif'],
  ['Hafalan 1 Juz Putri', 'individu','P', 0, 15,11,29, 31,'Aktif'],

  ['Hafalan 5 Juz Putra', 'individu','L', 0, 20,11,29, 31,'Aktif'],
  ['Hafalan 5 Juz Putri', 'individu','P', 0, 20,11,29, 31,'Aktif'],

  ['Hafalan 10 Juz Putra', 'individu','L', 0, 20,11,29, 31,'Aktif'],
  ['Hafalan 10 Juz Putri', 'individu','P', 0, 20,11,29, 31,'Aktif'],

  ['Hafalan 20 Juz Putra', 'individu','L', 0, 22,11,29, 31,'Aktif'],
  ['Hafalan 20 Juz Putri', 'individu','P', 0, 22,11,29, 31,'Aktif'],

  ['Hafalan 30 Juz Putra', 'individu','L', 0, 22,11,29, 31,'Aktif'],
  ['Hafalan 30 Juz Putri', 'individu','P', 0, 22,11,29, 31,'Aktif'],

  // Tafsir
  ['Tafsir Arab Putra', 'individu','L', 0, 22,11,29, 31,'Aktif'],
  ['Tafsir Arab Putri', 'individu','P', 0, 22,11,29, 31,'Aktif'],

  ['Tafsir Indonesia Putra', 'individu','L', 0, 34,11,29, 31,'Aktif'],
  ['Tafsir Indonesia Putri', 'individu','P', 0, 34,11,29, 31,'Aktif'],

  ['Tafsir Inggris Putra', 'individu','L', 0, 34,11,29, 31,'Aktif'],
  ['Tafsir Inggris Putri', 'individu','P', 0, 34,11,29, 31,'Aktif'],

  // Kaligrafi
  ['Kaligrafi Naskah Putra', 'individu','L', 0, 34,11,29, 31,'Aktif'],
  ['Kaligrafi Naskah Putri', 'individu','P', 0, 34,11,29, 31,'Aktif'],

  ['Kaligrafi Hiasan Putra', 'individu','L', 0, 34,11,29, 31,'Aktif'],
  ['Kaligrafi Hiasan Putri', 'individu','P', 0, 34,11,29, 31,'Aktif'],

  ['Kaligrafi Dekorasi Putra', 'individu','L', 0, 34,11,29, 31,'Aktif'],
  ['Kaligrafi Dekorasi Putri', 'individu','P', 0, 34,11,29, 31,'Aktif'],

  ['Kaligrafi Kontemporer Putra', 'individu','L', 0, 34,11,29, 31,'Aktif'],
  ['Kaligrafi Kontemporer Putri', 'individu','P', 0, 34,11,29, 31,'Aktif'],

  // KTIQ
  ['KTIQ Putra', 'individu','L', 0, 24,11,29, 31,'Aktif'],
  ['KTIQ Putri', 'individu','P', 0, 24,11,29, 31,'Aktif'],

  // Fahm Al Qur'an (Tim)
  ["Fahm Al Qur'an Putra", 'team','L', 0, 18,11,29, 31,'Aktif'],
  ["Fahm Al Qur'an Putri", 'team','P', 0, 18,11,29, 31,'Aktif'],

  // Syarh Al Qur'an (Tim)
  ["Syarh Al Qur'an Putra", 'team','L', 0, 18,11,29, 31,'Aktif'],
  ["Syarh Al Qur'an Putri", 'team','P', 0, 18,11,29, 31,'Aktif']
];