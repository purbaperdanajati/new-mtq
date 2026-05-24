// ============================================================
//  MTQ 2026 — apps-script/config.gs
//  SATU SUMBER KONFIGURASI BACKEND
//  Hanya edit file ini. Jangan taruh ID/config di file lain.
// ============================================================

// ── 1. Spreadsheet & Drive (edit di sini saja) ──────────────
var SPREADSHEET_ID       = 'GANTI_SPREADSHEET_ID';
var DRIVE_ROOT_FOLDER_ID = 'GANTI_ROOT_FOLDER_ID';

// ── 2. Admin ─────────────────────────────────────────────────
var ADMIN_PASSWORD = 'MTQ2026@Admin!';   // Ganti sebelum produksi!

// ── 3. Nama Sheet ────────────────────────────────────────────
var SHEET_CONFIG    = 'CONFIG';
var SHEET_PENDAFTAR = 'PENDAFTAR';
var SHEET_LOG       = 'LOG';

// ── 4. Konfigurasi Pendaftaran ───────────────────────────────
var PENDAFTARAN_CONFIG = {
  BUKA           : '2026-06-01T00:00:00',   // Tanggal buka (ISO string WIB)
  TUTUP          : '2026-07-31T23:59:59',   // Tanggal tutup
  AGE_CUTOFF_DATE: '2026-07-01',            // Tanggal acuan hitung umur (YYYY-MM-DD)
  // null = auto-detect dari BUKA/TUTUP
  // true = paksa buka (override tanggal)
  // false = paksa tutup (override tanggal)
  OVERRIDE       : null
};

// ── 5. Info Event ────────────────────────────────────────────
var EVENT_INFO = {
  nama   : 'MTQ Kabupaten Indramayu Tahun 2026',
  tanggal: '15 Agustus 2026',
  lokasi : 'GOR Kabupaten Indramayu',
  tema   : "Dengan Al-Qur'an Membangun Generasi Emas"
};

// ── 6. Kolom Sheet PENDAFTAR (0-based index) ─────────────────
var COL = {
  TIMESTAMP        : 0,
  NOMOR_PENDAFTARAN: 1,
  TIPE_LOMBA       : 2,   // 'individu' | 'team'
  NAMA_TIM         : 3,
  KECAMATAN        : 4,
  CABANG_LOMBA     : 5,
  GENDER_CABANG    : 6,   // 'L' | 'P'
  NAMA_LENGKAP     : 7,   // Ketua / peserta individu
  NIK              : 8,
  TEMPAT_LAHIR     : 9,
  TANGGAL_LAHIR    : 10,
  UMUR_DISPLAY     : 11,  // "9 thn 11 bln 29 hr"
  JENIS_KELAMIN    : 12,
  ALAMAT           : 13,
  NO_HP            : 14,
  EMAIL            : 15,
  LINK_FOLDER      : 16,  // URL folder Drive peserta
  ANGGOTA_JSON     : 17,  // JSON array anggota (kosong jika individu)
  STATUS_VERIFIKASI: 18,
  CATATAN          : 19
};

// ── 7. Header PENDAFTAR ──────────────────────────────────────
var PENDAFTAR_HEADERS = [
  'timestamp','nomor_pendaftaran','tipe_lomba','nama_tim','kecamatan',
  'cabang_lomba','gender_cabang','nama_lengkap','nik','tempat_lahir',
  'tanggal_lahir','umur_display','jenis_kelamin','alamat','no_hp','email',
  'link_folder','anggota_json','status_verifikasi','catatan'
];

// ── 8. Header CONFIG ─────────────────────────────────────────
// cabang_lomba  : nama lengkap misal "Tilawah Anak Putra"
// tipe          : individu | team
// gender        : L | P | Semua
// umur_min      : batas bawah (tahun penuh, integer)
// umur_max_tahun: batas atas tahun
// umur_max_bulan: batas atas bulan (0-11)
// umur_max_hari : batas atas hari  (0-30)
// kuota         : integer
// status_aktif  : Aktif | Nonaktif
var CONFIG_HEADERS = [
  'cabang_lomba','tipe','gender',
  'umur_min','umur_max_tahun','umur_max_bulan','umur_max_hari',
  'kuota','status_aktif'
];

// ── 9. Data CONFIG default (jika sheet belum ada isinya) ─────
var DEFAULT_CONFIG_DATA = [
  // Tilawah
  ['Tilawah Anak Putra',    'individu','L',  7,  9,11,29, 30,'Aktif'],
  ['Tilawah Anak Putri',    'individu','P',  7,  9,11,29, 30,'Aktif'],
  ['Tilawah Remaja Putra',  'individu','L', 10, 13,11,29, 25,'Aktif'],
  ['Tilawah Remaja Putri',  'individu','P', 10, 13,11,29, 25,'Aktif'],
  ['Tilawah Dewasa Putra',  'individu','L', 14, 40, 0, 0, 20,'Aktif'],
  ['Tilawah Dewasa Putri',  'individu','P', 14, 40, 0, 0, 20,'Aktif'],
  ['Tilawah Cacat Putra',   'individu','L',  7, 99, 0, 0, 10,'Aktif'],
  ['Tilawah Cacat Putri',   'individu','P',  7, 99, 0, 0, 10,'Aktif'],
  // Tahfidz
  ['Tahfidz 1 Juz Putra',   'individu','L',  7, 12,11,29, 25,'Aktif'],
  ['Tahfidz 1 Juz Putri',   'individu','P',  7, 12,11,29, 25,'Aktif'],
  ['Tahfidz 5 Juz Putra',   'individu','L', 10, 18,11,29, 20,'Aktif'],
  ['Tahfidz 5 Juz Putri',   'individu','P', 10, 18,11,29, 20,'Aktif'],
  ['Tahfidz 10 Juz Putra',  'individu','L', 13, 30, 0, 0, 15,'Aktif'],
  ['Tahfidz 10 Juz Putri',  'individu','P', 13, 30, 0, 0, 15,'Aktif'],
  ['Tahfidz 20 Juz Putra',  'individu','L', 15, 40, 0, 0, 10,'Aktif'],
  ['Tahfidz 20 Juz Putri',  'individu','P', 15, 40, 0, 0, 10,'Aktif'],
  ['Tahfidz 30 Juz Putra',  'individu','L', 17, 50, 0, 0, 10,'Aktif'],
  ['Tahfidz 30 Juz Putri',  'individu','P', 17, 50, 0, 0, 10,'Aktif'],
  // Khat
  ['Khat Naskhi Putra',     'individu','L', 10, 25, 0, 0, 20,'Aktif'],
  ['Khat Naskhi Putri',     'individu','P', 10, 25, 0, 0, 20,'Aktif'],
  ['Khat Hiasan Mushaf Putra','individu','L', 13, 35, 0, 0, 15,'Aktif'],
  ['Khat Hiasan Mushaf Putri','individu','P', 13, 35, 0, 0, 15,'Aktif'],
  // Fahmil (tim)
  ['Fahmil Qur\'an Putra',  'team',    'L', 13, 18,11,29, 10,'Aktif'],
  ['Fahmil Qur\'an Putri',  'team',    'P', 13, 18,11,29, 10,'Aktif'],
  // Syarhil (tim)
  ['Syarhil Qur\'an Putra', 'team',    'L', 13, 22,11,29, 10,'Aktif'],
  ['Syarhil Qur\'an Putri', 'team',    'P', 13, 22,11,29, 10,'Aktif'],
  // MFQ (tim)
  ['MFQ Putra',             'team',    'L', 13, 18,11,29,  8,'Aktif'],
  ['MFQ Putri',             'team',    'P', 13, 18,11,29,  8,'Aktif'],
  // Tilawah Tartil
  ['Tartil Putra',          'individu','L',  5,  8,11,29, 20,'Aktif'],
  ['Tartil Putri',          'individu','P',  5,  8,11,29, 20,'Aktif'],
];