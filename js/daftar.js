// ============================================
//  MTQ 2026 - Daftar.html JS
// ============================================

const API_URL = 'https://script.google.com/macros/s/AKfycbxKQ4WvXIXPMxwctlQOljmIB7xsQkSR4F1oStT2g5Xb1s_prnXSCZLwlUGEY3Doc9Be/exec';

// ── State ─────────────────────────────────────
let state = {
  step: 1,
  totalSteps: 3,
  config: [],           // CONFIG data from spreadsheet
  formData: {},
  files: { photo: null, ktp: null, rekomendasi: null },
  isSubmitting: false,
  regNumber: null,
};

// ── Init ──────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  initNavbar();
  initDarkMode();
  initUploads();
  loadConfig();
  bindForm();
  renderStep(1);
});

// ── Load Config from Apps Script ──────────────
async function loadConfig() {
  const cabangSelect = document.getElementById('cabang_lomba');
  if (!cabangSelect) return;

  cabangSelect.innerHTML = '<option value="">Memuat data...</option>';
  cabangSelect.disabled = true;

  try {
    const res = await fetch(`${API_URL}?action=getConfig`);
    const data = await res.json();
    if (data.success && data.config) {
      state.config = data.config;
      populateCabang();
    }
  } catch (e) {
    // Fallback config
    state.config = [
      { cabang_lomba:'Tilawah', golongan:'Anak',   umur_min:7,  umur_max:12, kuota:30, status_aktif:'Aktif' },
      { cabang_lomba:'Tilawah', golongan:'Remaja',  umur_min:13, umur_max:17, kuota:30, status_aktif:'Aktif' },
      { cabang_lomba:'Tilawah', golongan:'Dewasa',  umur_min:18, umur_max:40, kuota:20, status_aktif:'Aktif' },
      { cabang_lomba:'Tahfidz', golongan:'1 Juz',   umur_min:7,  umur_max:15, kuota:25, status_aktif:'Aktif' },
      { cabang_lomba:'Tahfidz', golongan:'5 Juz',   umur_min:10, umur_max:22, kuota:20, status_aktif:'Aktif' },
      { cabang_lomba:'Tahfidz', golongan:'10 Juz',  umur_min:13, umur_max:30, kuota:15, status_aktif:'Aktif' },
      { cabang_lomba:'Khat',    golongan:'Naskhi',  umur_min:10, umur_max:25, kuota:20, status_aktif:'Aktif' },
      { cabang_lomba:'Fahmil',  golongan:'Remaja',  umur_min:13, umur_max:18, kuota:15, status_aktif:'Aktif' },
      { cabang_lomba:'Syarhil', golongan:'Remaja',  umur_min:13, umur_max:22, kuota:15, status_aktif:'Aktif' },
    ];
    populateCabang();
    showToast('Peringatan', 'Gagal memuat data dari server, menggunakan data default.', 'warning');
  }
}

function populateCabang() {
  const cabangSelect = document.getElementById('cabang_lomba');
  const aktifConfig = state.config.filter(c => c.status_aktif === 'Aktif');
  const cabangs = [...new Set(aktifConfig.map(c => c.cabang_lomba))];

  cabangSelect.innerHTML = '<option value="">-- Pilih Cabang Lomba --</option>';
  cabangs.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c;
    opt.textContent = c;
    cabangSelect.appendChild(opt);
  });
  cabangSelect.disabled = false;
}

function updateGolongan() {
  const cabang = document.getElementById('cabang_lomba').value;
  const golSelect = document.getElementById('golongan');
  const quotaBadge = document.getElementById('quotaBadge');

  golSelect.innerHTML = '<option value="">-- Pilih Golongan --</option>';
  quotaBadge.className = 'quota-badge';
  quotaBadge.textContent = '';

  if (!cabang) return;

  const filtered = state.config.filter(c => c.cabang_lomba === cabang && c.status_aktif === 'Aktif');
  filtered.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.golongan;
    opt.textContent = `${c.golongan} (Usia ${c.umur_min}–${c.umur_max} tahun)`;
    opt.dataset.umurMin = c.umur_min;
    opt.dataset.umurMax = c.umur_max;
    opt.dataset.kuota = c.kuota;
    golSelect.appendChild(opt);
  });

  validateAge();
}

function onGolonganChange() {
  validateAge();
  updateQuota();
}

async function updateQuota() {
  const cabang   = document.getElementById('cabang_lomba').value;
  const golongan = document.getElementById('golongan').value;
  const badge    = document.getElementById('quotaBadge');
  if (!cabang || !golongan) { badge.textContent = ''; return; }

  const cfg = state.config.find(c => c.cabang_lomba === cabang && c.golongan === golongan);
  if (!cfg) return;

  badge.textContent = '⏳ Cek kuota...';
  badge.className = 'quota-badge';

  try {
    const res = await fetch(`${API_URL}?action=getQuota&cabang=${encodeURIComponent(cabang)}&golongan=${encodeURIComponent(golongan)}`);
    const data = await res.json();
    if (data.success) {
      const sisa = cfg.kuota - (data.count || 0);
      if (sisa <= 0) {
        badge.textContent = '🚫 Kuota Penuh';
        badge.className = 'quota-badge full';
      } else if (sisa <= 5) {
        badge.textContent = `⚠️ Sisa ${sisa} kursi`;
        badge.className = 'quota-badge warn';
      } else {
        badge.textContent = `✅ Sisa ${sisa} kursi`;
        badge.className = 'quota-badge ok';
      }
    }
  } catch {
    badge.textContent = '';
  }
}

// ── Age Validation ────────────────────────────
function validateAge() {
  const tglLahir = document.getElementById('tanggal_lahir').value;
  const golSelect = document.getElementById('golongan');
  const ageChip = document.getElementById('ageChip');
  const ageError = document.getElementById('ageError');

  if (!tglLahir) { ageChip.className = 'age-chip'; ageChip.textContent = ''; return; }

  const today = new Date();
  const dob = new Date(tglLahir);
  const age = Math.floor((today - dob) / (365.25 * 24 * 3600 * 1000));

  if (isNaN(age) || age < 0) return;

  ageChip.textContent = `📅 Usia: ${age} tahun`;
  ageChip.className = 'age-chip';

  // Isi field umur hidden
  const umurField = document.getElementById('umur');
  if (umurField) umurField.value = age;

  // Cek kesesuaian golongan yang dipilih
  const selectedOpt = golSelect.options[golSelect.selectedIndex];
  if (selectedOpt && selectedOpt.dataset.umurMin) {
    const min = parseInt(selectedOpt.dataset.umurMin);
    const max = parseInt(selectedOpt.dataset.umurMax);
    if (age < min || age > max) {
      ageChip.className = 'age-chip err';
      ageError.classList.add('show');
      ageError.textContent = `❌ Usia ${age} tahun tidak sesuai untuk golongan ini (${min}–${max} tahun)`;
    } else {
      ageError.classList.remove('show');
      ageChip.className = 'age-chip';
    }
  }
}

// ── File Uploads ──────────────────────────────
function initUploads() {
  setupUpload('photoZone', 'photo', 'photoPreview', ['image/jpeg','image/png'], 2);
  setupUpload('ktpZone', 'ktp', 'ktpPreview', ['image/jpeg','image/png','application/pdf'], 2);
  setupUpload('rekomZone', 'rekom', 'rekomPreview', ['image/jpeg','image/png','application/pdf'], 2);
}

function setupUpload(zoneId, fileKey, previewId, allowedTypes, maxMB) {
  const zone = document.getElementById(zoneId);
  const preview = document.getElementById(previewId);
  if (!zone) return;

  // Drag & Drop
  zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('drag-over'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file, fileKey, zone, preview, allowedTypes, maxMB);
  });

  // Click to pick
  const input = zone.querySelector('input[type="file"]');
  input?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) handleFile(file, fileKey, zone, preview, allowedTypes, maxMB);
  });

  // Remove file
  preview?.querySelector('.remove-file')?.addEventListener('click', (e) => {
    e.stopPropagation();
    state.files[fileKey] = null;
    zone.classList.remove('has-file');
    preview.classList.remove('show');
    if (input) input.value = '';
  });
}

function handleFile(file, key, zone, preview, allowedTypes, maxMB) {
  if (!allowedTypes.includes(file.type)) {
    showToast('Format Salah', `File harus berformat: ${allowedTypes.map(t => t.split('/')[1].toUpperCase()).join(', ')}`, 'error');
    return;
  }
  if (file.size > maxMB * 1024 * 1024) {
    showToast('File Terlalu Besar', `Maksimal ukuran file ${maxMB} MB`, 'error');
    return;
  }

  state.files[key] = file;
  zone.classList.add('has-file');

  // Preview
  const nameEl = preview?.querySelector('.file-name');
  const sizeEl = preview?.querySelector('.file-size');
  const iconEl = preview?.querySelector('.file-icon');
  if (nameEl) nameEl.textContent = file.name;
  if (sizeEl) sizeEl.textContent = formatFileSize(file.size);
  if (iconEl) iconEl.textContent = file.type === 'application/pdf' ? '📄' : '🖼️';
  preview?.classList.add('show');
}

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

// ── Multi-step Form ───────────────────────────
function renderStep(step) {
  document.querySelectorAll('.form-step').forEach(s => s.classList.remove('active'));
  document.getElementById(`step${step}`)?.classList.add('active');

  document.querySelectorAll('.step').forEach((el, i) => {
    el.classList.remove('active', 'done');
    if (i + 1 < step)  el.classList.add('done');
    if (i + 1 === step) el.classList.add('active');
  });

  window.scrollTo({ top: document.querySelector('.steps-bar')?.offsetTop - 68 || 0, behavior: 'smooth' });
  state.step = step;
}

function nextStep() {
  if (!validateCurrentStep()) return;
  if (state.step < state.totalSteps) renderStep(state.step + 1);
}

function prevStep() {
  if (state.step > 1) renderStep(state.step - 1);
}

// ── Validation ────────────────────────────────
function validateCurrentStep() {
  const stepEl = document.getElementById(`step${state.step}`);
  let valid = true;

  stepEl?.querySelectorAll('[required]').forEach(field => {
    clearError(field);
    if (!field.value.trim()) {
      showError(field, 'Kolom ini wajib diisi');
      valid = false;
    }
  });

  // Step-specific
  if (state.step === 1) {
    const nik = document.getElementById('nik');
    if (nik && nik.value && nik.value.length !== 16) {
      showError(nik, 'NIK harus 16 digit');
      valid = false;
    }
    const email = document.getElementById('email');
    if (email && email.value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value)) {
      showError(email, 'Format email tidak valid');
      valid = false;
    }
    const hp = document.getElementById('no_hp');
    if (hp && hp.value && !/^(\+62|08)\d{8,12}$/.test(hp.value.replace(/\s/g,''))) {
      showError(hp, 'Nomor HP tidak valid (awali dengan 08 atau +62)');
      valid = false;
    }
    // Age error check
    const ageError = document.getElementById('ageError');
    if (ageError?.classList.contains('show')) valid = false;
  }

  if (state.step === 2) {
    const ageError = document.getElementById('ageError');
    if (ageError?.classList.contains('show')) {
      showToast('Usia Tidak Sesuai', 'Usia peserta tidak memenuhi syarat untuk golongan yang dipilih.', 'error');
      valid = false;
    }
    const quotaBadge = document.getElementById('quotaBadge');
    if (quotaBadge?.classList.contains('full')) {
      showToast('Kuota Penuh', 'Kuota untuk cabang dan golongan ini sudah habis.', 'error');
      valid = false;
    }
  }

  if (state.step === 3) {
    if (!state.files.photo) { showToast('Upload Diperlukan', 'Pas foto wajib diupload.', 'error'); valid = false; }
    if (!state.files.ktp)   { showToast('Upload Diperlukan', 'KTP/KK wajib diupload.', 'error'); valid = false; }
  }

  if (!valid) showToast('Data Tidak Lengkap', 'Mohon lengkapi semua kolom yang diperlukan.', 'warning');
  return valid;
}

function showError(field, msg) {
  field.classList.add('error');
  const errEl = field.parentElement?.querySelector('.field-error');
  if (errEl) { errEl.textContent = msg; errEl.classList.add('show'); }
}

function clearError(field) {
  field.classList.remove('error');
  const errEl = field.parentElement?.querySelector('.field-error');
  if (errEl) errEl.classList.remove('show');
}

// ── Form Bindings ─────────────────────────────
function bindForm() {
  // Real-time validation clear
  document.querySelectorAll('.field-input, .field-select, .field-textarea').forEach(f => {
    f.addEventListener('input', () => clearError(f));
    f.addEventListener('change', () => clearError(f));
  });

  document.getElementById('cabang_lomba')?.addEventListener('change', updateGolongan);
  document.getElementById('golongan')?.addEventListener('change', onGolonganChange);
  document.getElementById('tanggal_lahir')?.addEventListener('change', validateAge);
  document.getElementById('tanggal_lahir')?.addEventListener('change', validateAge);
}

// ── Submit Form ───────────────────────────────
async function submitForm() {
  if (state.isSubmitting) return;
  if (!validateCurrentStep()) return;

  state.isSubmitting = true;
  showLoading('Mengirim data pendaftaran...', 'Mohon tunggu, proses ini mungkin memerlukan beberapa menit.');

  try {
    // Collect form data
    const fd = new FormData(document.getElementById('registrationForm'));
    const data = Object.fromEntries(fd.entries());

    // Convert files to base64
    const photoB64 = state.files.photo ? await fileToBase64(state.files.photo) : null;
    const ktpB64   = state.files.ktp   ? await fileToBase64(state.files.ktp)   : null;
    const rekomB64 = state.files.rekom  ? await fileToBase64(state.files.rekom)  : null;

    const payload = {
      action: 'register',
      ...data,
      photo: photoB64 ? { name: state.files.photo.name, type: state.files.photo.type, data: photoB64 } : null,
      ktp:   ktpB64   ? { name: state.files.ktp.name,   type: state.files.ktp.type,   data: ktpB64   } : null,
      rekom: rekomB64  ? { name: state.files.rekom.name,  type: state.files.rekom.type,  data: rekomB64  } : null,
    };

    const res = await fetch(API_URL, {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    const result = await res.json();

    if (result.success) {
      state.regNumber = result.nomor_pendaftaran;
      state.formData  = { ...data, nomor_pendaftaran: result.nomor_pendaftaran };
      hideLoading();
      showSuccessPage(result);
    } else {
      throw new Error(result.message || 'Pendaftaran gagal');
    }
  } catch (err) {
    hideLoading();
    showToast('Gagal', err.message || 'Terjadi kesalahan. Silakan coba lagi.', 'error');
    state.isSubmitting = false;
  }
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ── Success Page ──────────────────────────────
function showSuccessPage(result) {
  document.getElementById('formContainer').classList.add('hidden');
  const successEl = document.getElementById('successContainer');
  successEl.classList.remove('hidden');

  // Fill details
  document.getElementById('successRegNum').textContent = result.nomor_pendaftaran;
  document.getElementById('successNama').textContent   = state.formData.nama_lengkap;
  document.getElementById('successCabang').textContent = `${state.formData.cabang_lomba} – ${state.formData.golongan}`;
  document.getElementById('successHp').textContent     = state.formData.no_hp;
  document.getElementById('successEmail').textContent  = state.formData.email;

  // Generate QR Code
  generateQRCode(result.nomor_pendaftaran);

  window.scrollTo({ top: 0, behavior: 'smooth' });
  showToast('Berhasil! 🎉', 'Pendaftaran Anda berhasil diterima.', 'success', 6000);
}

// ── QR Code (using QRCode.js CDN) ─────────────
function generateQRCode(text) {
  const container = document.getElementById('qrcode');
  if (!container) return;
  container.innerHTML = '';

  // Menggunakan library QRCode.js
  if (typeof QRCode !== 'undefined') {
    new QRCode(container, {
      text: `MTQ2026|${text}|${state.formData.nama_lengkap}|${state.formData.cabang_lomba}`,
      width: 180,
      height: 180,
      colorDark: '#065f46',
      colorLight: '#ffffff',
      correctLevel: QRCode.CorrectLevel.H,
    });
  }
}

// ── PDF Download ──────────────────────────────
function downloadPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const fd = state.formData;
  const reg = state.regNumber;

  // Background header
  doc.setFillColor(6, 95, 70);
  doc.rect(0, 0, 210, 50, 'F');

  // Gold accent line
  doc.setFillColor(245, 158, 11);
  doc.rect(0, 50, 210, 2, 'F');

  // Title
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('BUKTI PENDAFTARAN MTQ 2026', 105, 22, { align: 'center' });
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text('Musabaqah Tilawatil Qur\'an Tingkat Kecamatan', 105, 32, { align: 'center' });

  // Registration Number
  doc.setFillColor(240, 253, 245);
  doc.roundedRect(20, 58, 170, 22, 4, 4, 'F');
  doc.setTextColor(6, 95, 70);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Nomor Pendaftaran', 105, 67, { align: 'center' });
  doc.setFontSize(18);
  doc.text(reg, 105, 76, { align: 'center' });

  // Data table
  const rows = [
    ['Nama Lengkap', fd.nama_lengkap || ''],
    ['NIK', fd.nik || ''],
    ['Tempat, Tgl Lahir', `${fd.tempat_lahir || ''}, ${fd.tanggal_lahir || ''}`],
    ['Jenis Kelamin', fd.jenis_kelamin || ''],
    ['Alamat', fd.alamat || ''],
    ['No. WhatsApp', fd.no_hp || ''],
    ['Email', fd.email || ''],
    ['Kecamatan/Kafilah', fd.kecamatan || ''],
    ['Cabang Lomba', fd.cabang_lomba || ''],
    ['Golongan', fd.golongan || ''],
  ];

  let y = 90;
  doc.setFontSize(10);
  rows.forEach(([key, val], i) => {
    doc.setFillColor(i % 2 === 0 ? 249 : 255, i % 2 === 0 ? 250 : 255, i % 2 === 0 ? 247 : 255);
    doc.rect(20, y, 170, 9, 'F');
    doc.setTextColor(100, 116, 139);
    doc.setFont('helvetica', 'normal');
    doc.text(key, 24, y + 6);
    doc.setTextColor(30, 41, 59);
    doc.setFont('helvetica', 'bold');
    doc.text(String(val), 90, y + 6);
    doc.setDrawColor(229, 231, 235);
    doc.line(20, y + 9, 190, y + 9);
    y += 9;
  });

  // QR Code from canvas
  const qrCanvas = document.querySelector('#qrcode canvas');
  if (qrCanvas) {
    const qrImg = qrCanvas.toDataURL('image/png');
    doc.addImage(qrImg, 'PNG', 75, y + 10, 60, 60);
    doc.setFontSize(9);
    doc.setTextColor(107, 114, 128);
    doc.text('Scan QR Code untuk verifikasi pendaftaran', 105, y + 74, { align: 'center' });
    y += 80;
  }

  // Status
  doc.setFillColor(254, 243, 199);
  doc.roundedRect(20, y + 4, 170, 14, 3, 3, 'F');
  doc.setTextColor(180, 83, 9);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Status: MENUNGGU VERIFIKASI PANITIA', 105, y + 13, { align: 'center' });

  // Footer
  doc.setFillColor(6, 95, 70);
  doc.rect(0, 280, 210, 17, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Dicetak: ${new Date().toLocaleString('id-ID')}  |  Panitia MTQ 2026`, 105, 290, { align: 'center' });

  doc.save(`Bukti_Pendaftaran_MTQ2026_${reg}.pdf`);
}

// ── Loading ───────────────────────────────────
function showLoading(msg = 'Memproses...', sub = '') {
  const overlay = document.getElementById('loadingOverlay');
  if (!overlay) return;
  overlay.querySelector('.loading-msg').textContent  = msg;
  overlay.querySelector('.loading-sub').textContent  = sub;
  overlay.classList.add('show');
}

function hideLoading() {
  document.getElementById('loadingOverlay')?.classList.remove('show');
}

// ── Toast (same as main.js) ────────────────────
function showToast(title, msg, type = 'info', duration = 4000) {
  const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${icons[type]}</span>
    <div class="toast-content">
      <div class="toast-title">${title}</div>
      <div class="toast-msg">${msg}</div>
    </div>
    <button class="toast-close" onclick="this.parentElement.remove()">✕</button>
  `;
  container.appendChild(toast);
  setTimeout(() => { toast.classList.add('removing'); setTimeout(() => toast.remove(), 250); }, duration);
}

// Reuse from main.js
function initNavbar() {
  const navbar = document.getElementById('navbar');
  const hamburger = document.getElementById('hamburger');
  const mobileNav = document.getElementById('mobileNav');
  window.addEventListener('scroll', () => navbar?.classList.toggle('scrolled', window.scrollY > 40));
  hamburger?.addEventListener('click', () => mobileNav?.classList.toggle('open'));
}

function initDarkMode() {
  const toggle = document.getElementById('darkToggle');
  const saved = localStorage.getItem('mtq-theme') || 'light';
  document.documentElement.setAttribute('data-theme', saved);
  if (toggle) toggle.textContent = saved === 'dark' ? '☀️' : '🌙';
  toggle?.addEventListener('click', () => {
    const cur = document.documentElement.getAttribute('data-theme') || 'light';
    const next = cur === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('mtq-theme', next);
    toggle.textContent = next === 'dark' ? '☀️' : '🌙';
  });
}