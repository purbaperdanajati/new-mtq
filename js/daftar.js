// ============================================================
//  MTQ 2026 — js/daftar.js
//  Handles daftar.html: step nav, member forms, uploads, submit
// ============================================================

const API_URL = 'https://script.google.com/macros/s/AKfycbxKQ4WvXIXPMxwctlQOljmIB7xsQkSR4F1oStT2g5Xb1s_prnXSCZLwlUGEY3Doc9Be/exec';

// ── State ─────────────────────────────────────────────────────
let state = {
  step: 1,
  config: [],           // from GAS getConfig
  currentCfg: null,     // selected cabang config object
  isTeam: false,
  minMembers: 1,
  maxMembers: 1,
  members: [{}],        // array of member slot objects
  files: {},            // key: 'photo_0', 'ktp_0', 'photo_1', 'rekom' etc.
  isSubmitting: false,
  regNumber: null,
  formData: {},
};

// ── Fallback config matching GAS DEFAULT_CONFIG_DATA structure
const FALLBACK_CONFIG = [
  { cabang_lomba:'Tilawah Anak Putra',      tipe:'individu', gender:'L', umur_min:7,  umur_max_tahun:9,  umur_max_bulan:11, umur_max_hari:29, kuota:30, status_aktif:'Aktif' },
  { cabang_lomba:'Tilawah Anak Putri',      tipe:'individu', gender:'P', umur_min:7,  umur_max_tahun:9,  umur_max_bulan:11, umur_max_hari:29, kuota:30, status_aktif:'Aktif' },
  { cabang_lomba:'Tilawah Remaja Putra',    tipe:'individu', gender:'L', umur_min:10, umur_max_tahun:13, umur_max_bulan:11, umur_max_hari:29, kuota:25, status_aktif:'Aktif' },
  { cabang_lomba:'Tilawah Remaja Putri',    tipe:'individu', gender:'P', umur_min:10, umur_max_tahun:13, umur_max_bulan:11, umur_max_hari:29, kuota:25, status_aktif:'Aktif' },
  { cabang_lomba:'Tilawah Dewasa Putra',    tipe:'individu', gender:'L', umur_min:14, umur_max_tahun:40, umur_max_bulan:0,  umur_max_hari:0,  kuota:20, status_aktif:'Aktif' },
  { cabang_lomba:'Tilawah Dewasa Putri',    tipe:'individu', gender:'P', umur_min:14, umur_max_tahun:40, umur_max_bulan:0,  umur_max_hari:0,  kuota:20, status_aktif:'Aktif' },
  { cabang_lomba:'Tilawah Cacat Putra',     tipe:'individu', gender:'L', umur_min:7,  umur_max_tahun:99, umur_max_bulan:0,  umur_max_hari:0,  kuota:10, status_aktif:'Aktif' },
  { cabang_lomba:'Tilawah Cacat Putri',     tipe:'individu', gender:'P', umur_min:7,  umur_max_tahun:99, umur_max_bulan:0,  umur_max_hari:0,  kuota:10, status_aktif:'Aktif' },
  { cabang_lomba:'Tahfidz 1 Juz Putra',    tipe:'individu', gender:'L', umur_min:7,  umur_max_tahun:12, umur_max_bulan:11, umur_max_hari:29, kuota:25, status_aktif:'Aktif' },
  { cabang_lomba:'Tahfidz 1 Juz Putri',    tipe:'individu', gender:'P', umur_min:7,  umur_max_tahun:12, umur_max_bulan:11, umur_max_hari:29, kuota:25, status_aktif:'Aktif' },
  { cabang_lomba:'Tahfidz 5 Juz Putra',    tipe:'individu', gender:'L', umur_min:10, umur_max_tahun:18, umur_max_bulan:11, umur_max_hari:29, kuota:20, status_aktif:'Aktif' },
  { cabang_lomba:'Tahfidz 5 Juz Putri',    tipe:'individu', gender:'P', umur_min:10, umur_max_tahun:18, umur_max_bulan:11, umur_max_hari:29, kuota:20, status_aktif:'Aktif' },
  { cabang_lomba:'Tahfidz 10 Juz Putra',   tipe:'individu', gender:'L', umur_min:13, umur_max_tahun:30, umur_max_bulan:0,  umur_max_hari:0,  kuota:15, status_aktif:'Aktif' },
  { cabang_lomba:'Tahfidz 10 Juz Putri',   tipe:'individu', gender:'P', umur_min:13, umur_max_tahun:30, umur_max_bulan:0,  umur_max_hari:0,  kuota:15, status_aktif:'Aktif' },
  { cabang_lomba:'Tahfidz 20 Juz Putra',   tipe:'individu', gender:'L', umur_min:15, umur_max_tahun:40, umur_max_bulan:0,  umur_max_hari:0,  kuota:10, status_aktif:'Aktif' },
  { cabang_lomba:'Tahfidz 20 Juz Putri',   tipe:'individu', gender:'P', umur_min:15, umur_max_tahun:40, umur_max_bulan:0,  umur_max_hari:0,  kuota:10, status_aktif:'Aktif' },
  { cabang_lomba:'Tahfidz 30 Juz Putra',   tipe:'individu', gender:'L', umur_min:17, umur_max_tahun:50, umur_max_bulan:0,  umur_max_hari:0,  kuota:10, status_aktif:'Aktif' },
  { cabang_lomba:'Tahfidz 30 Juz Putri',   tipe:'individu', gender:'P', umur_min:17, umur_max_tahun:50, umur_max_bulan:0,  umur_max_hari:0,  kuota:10, status_aktif:'Aktif' },
  { cabang_lomba:'Khat Naskhi Putra',      tipe:'individu', gender:'L', umur_min:10, umur_max_tahun:25, umur_max_bulan:0,  umur_max_hari:0,  kuota:20, status_aktif:'Aktif' },
  { cabang_lomba:'Khat Naskhi Putri',      tipe:'individu', gender:'P', umur_min:10, umur_max_tahun:25, umur_max_bulan:0,  umur_max_hari:0,  kuota:20, status_aktif:'Aktif' },
  { cabang_lomba:'Khat Hiasan Mushaf Putra',tipe:'individu',gender:'L', umur_min:13, umur_max_tahun:35, umur_max_bulan:0,  umur_max_hari:0,  kuota:15, status_aktif:'Aktif' },
  { cabang_lomba:'Khat Hiasan Mushaf Putri',tipe:'individu',gender:'P', umur_min:13, umur_max_tahun:35, umur_max_bulan:0,  umur_max_hari:0,  kuota:15, status_aktif:'Aktif' },
  { cabang_lomba:"Fahmil Qur'an Putra",    tipe:'team',     gender:'L', umur_min:13, umur_max_tahun:18, umur_max_bulan:11, umur_max_hari:29, kuota:10, status_aktif:'Aktif' },
  { cabang_lomba:"Fahmil Qur'an Putri",    tipe:'team',     gender:'P', umur_min:13, umur_max_tahun:18, umur_max_bulan:11, umur_max_hari:29, kuota:10, status_aktif:'Aktif' },
  { cabang_lomba:"Syarhil Qur'an Putra",   tipe:'team',     gender:'L', umur_min:13, umur_max_tahun:22, umur_max_bulan:11, umur_max_hari:29, kuota:10, status_aktif:'Aktif' },
  { cabang_lomba:"Syarhil Qur'an Putri",   tipe:'team',     gender:'P', umur_min:13, umur_max_tahun:22, umur_max_bulan:11, umur_max_hari:29, kuota:10, status_aktif:'Aktif' },
  { cabang_lomba:'MFQ Putra',              tipe:'team',     gender:'L', umur_min:13, umur_max_tahun:18, umur_max_bulan:11, umur_max_hari:29, kuota:8,  status_aktif:'Aktif' },
  { cabang_lomba:'MFQ Putri',              tipe:'team',     gender:'P', umur_min:13, umur_max_tahun:18, umur_max_bulan:11, umur_max_hari:29, kuota:8,  status_aktif:'Aktif' },
  { cabang_lomba:'Tartil Putra',           tipe:'individu', gender:'L', umur_min:5,  umur_max_tahun:8,  umur_max_bulan:11, umur_max_hari:29, kuota:20, status_aktif:'Aktif' },
  { cabang_lomba:'Tartil Putri',           tipe:'individu', gender:'P', umur_min:5,  umur_max_tahun:8,  umur_max_bulan:11, umur_max_hari:29, kuota:20, status_aktif:'Aktif' },
];

// ── Init ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initNavbar();
  initDarkMode();
  loadConfig();
  setupRekomUpload();
  renderStep(1);
});

// ── Load Config ───────────────────────────────────────────────
async function loadConfig() {
  const sel = document.getElementById('cabang_lomba');
  if (!sel) return;
  sel.innerHTML = '<option value="">Memuat data...</option>';
  sel.disabled = true;

  try {
    const res = await fetch(`${API_URL}?action=getConfig`, { redirect: 'follow' });
    const data = await res.json();
    if (data.success && Array.isArray(data.config) && data.config.length) {
      state.config = data.config;
    } else {
      throw new Error('Config kosong dari server');
    }
  } catch {
    state.config = FALLBACK_CONFIG;
    showToast('Info', 'Menggunakan data cabang lomba default.', 'warning');
  }

  populateCabang(sel);
  sel.disabled = false;
}

// ── Populate Cabang Lomba (optgroup by prefix) ────────────────
function populateCabang(sel) {
  sel = sel || document.getElementById('cabang_lomba');
  const aktif = state.config.filter(c => String(c.status_aktif).toLowerCase() === 'aktif');

  // Group by first word of cabang_lomba (Tilawah, Tahfidz, Khat, etc.)
  const groups = {};
  aktif.forEach(c => {
    const prefix = c.cabang_lomba.split(' ')[0];
    if (!groups[prefix]) groups[prefix] = [];
    groups[prefix].push(c);
  });

  sel.innerHTML = '<option value="">-- Pilih Cabang Lomba --</option>';
  Object.entries(groups).forEach(([prefix, items]) => {
    const grp = document.createElement('optgroup');
    grp.label = prefix;
    items.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.cabang_lomba;
      const maxAge = c.umur_max_tahun < 99 ? `–${c.umur_max_tahun} thn` : '';
      opt.textContent = `${c.cabang_lomba}  (${c.umur_min}${maxAge})`;
      // Store config as data attributes
      opt.dataset.tipe        = c.tipe || 'individu';
      opt.dataset.gender      = c.gender || 'Semua';
      opt.dataset.umurMin     = c.umur_min;
      opt.dataset.umurMaxThn  = c.umur_max_tahun;
      opt.dataset.umurMaxBln  = c.umur_max_bulan || 0;
      opt.dataset.umurMaxHari = c.umur_max_hari  || 0;
      opt.dataset.kuota       = c.kuota;
      grp.appendChild(opt);
    });
    sel.appendChild(grp);
  });

  sel.addEventListener('change', onCabangChange);
}

function onCabangChange() {
  const sel = document.getElementById('cabang_lomba');
  const opt = sel.options[sel.selectedIndex];
  const badge    = document.getElementById('quotaBadge');
  const tipeBox  = document.getElementById('tipeInfoBox');
  const ageBox   = document.getElementById('ageRuleBox');

  if (!opt || !opt.value) {
    badge.textContent = '';
    tipeBox.style.display = 'none';
    ageBox.style.display  = 'none';
    state.currentCfg = null;
    return;
  }

  // Find config entry
  const cfg = state.config.find(c => c.cabang_lomba === opt.value);
  state.currentCfg = cfg || {
    tipe: opt.dataset.tipe, gender: opt.dataset.gender,
    umur_min: +opt.dataset.umurMin,
    umur_max_tahun: +opt.dataset.umurMaxThn,
    umur_max_bulan: +opt.dataset.umurMaxBln,
    umur_max_hari:  +opt.dataset.umurMaxHari,
    kuota: +opt.dataset.kuota,
  };

  state.isTeam     = state.currentCfg.tipe === 'team';
  state.minMembers = state.isTeam ? 2 : 1;
  state.maxMembers = state.isTeam ? 3 : 1;

  // Tipe badge
  const tipeBadge = document.getElementById('tipeBadge');
  const tipeDesc  = document.getElementById('tipeDesc');
  tipeBox.style.display = 'block';
  if (state.isTeam) {
    tipeBadge.className = 'tipe-badge team';
    tipeBadge.textContent = '👥 Tim (2–3 anggota)';
    tipeDesc.textContent  = 'Pendaftaran dilakukan per tim';
  } else {
    tipeBadge.className = 'tipe-badge individu';
    tipeBadge.textContent = '👤 Individu';
    tipeDesc.textContent  = 'Satu formulir untuk satu peserta';
  }

  // Age rule
  const c = state.currentCfg;
  const maxStr = c.umur_max_tahun < 99
    ? `${c.umur_max_tahun} tahun${c.umur_max_bulan ? ' ' + c.umur_max_bulan + ' bulan' : ''}${c.umur_max_hari ? ' ' + c.umur_max_hari + ' hari' : ''}`
    : 'tidak dibatasi';
  document.getElementById('ageRuleText').textContent =
    `Syarat usia: ${c.umur_min} – ${maxStr} (dihitung per 1 Juli 2026)`;
  ageBox.style.display = 'block';

  // Quota check
  checkQuota(opt.value, badge);
}

async function checkQuota(cabang, badge) {
  badge.textContent = '⏳ Cek kuota...';
  badge.className   = 'quota-badge';
  try {
    const res  = await fetch(`${API_URL}?action=getQuota&cabang=${encodeURIComponent(cabang)}`, { redirect: 'follow' });
    const data = await res.json();
    if (data.success) {
      const cfg  = state.config.find(c => c.cabang_lomba === cabang);
      const sisa = (cfg?.kuota || 0) - (data.count || 0);
      if (sisa <= 0) {
        badge.textContent = '🚫 Kuota Penuh';
        badge.className   = 'quota-badge full';
      } else if (sisa <= 5) {
        badge.textContent = `⚠️ Sisa ${sisa} kursi`;
        badge.className   = 'quota-badge warn';
      } else {
        badge.textContent = `✅ Sisa ${sisa} kursi`;
        badge.className   = 'quota-badge ok';
      }
    } else { badge.textContent = ''; }
  } catch { badge.textContent = ''; }
}

// ══ STEP NAVIGATION ══════════════════════════════════════════

function renderStep(n) {
  document.querySelectorAll('.form-step').forEach(s => s.classList.remove('active'));
  document.getElementById(`step${n}`)?.classList.add('active');

  document.querySelectorAll('.step').forEach((el, i) => {
    el.classList.remove('active', 'done');
    if (i + 1 < n)  el.classList.add('done');
    if (i + 1 === n) el.classList.add('active');
  });

  const bar = document.querySelector('.steps-bar');
  window.scrollTo({ top: bar ? bar.offsetTop - 68 : 0, behavior: 'smooth' });
  state.step = n;
}

// Step 1 → Step 2
function goToStep2() {
  const kec = document.getElementById('kecamatan');
  const cab = document.getElementById('cabang_lomba');
  let valid = true;

  clearError(kec);
  clearError(cab);
  if (!kec?.value) { showError(kec, 'Pilih kecamatan terlebih dahulu'); valid = false; }
  if (!cab?.value) { showError(cab, 'Pilih cabang lomba terlebih dahulu'); valid = false; }
  if (!valid) { showToast('Lengkapi Data', 'Pilih kecamatan dan cabang lomba.', 'warning'); return; }

  // Check quota full
  const badge = document.getElementById('quotaBadge');
  if (badge?.classList.contains('full')) {
    showToast('Kuota Penuh', 'Maaf, kuota untuk cabang ini sudah habis.', 'error');
    return;
  }

  // Init member slots
  state.members = Array.from({ length: state.minMembers }, () => ({}));

  // Update step 2 UI
  const cabangName = cab.value;
  document.getElementById('step2Title').textContent = state.isTeam ? 'Data Anggota Tim' : 'Data Peserta';
  document.getElementById('step2Subtitle').textContent = state.isTeam
    ? `${cabangName} — Isi data semua anggota tim (min. ${state.minMembers}, maks. ${state.maxMembers} orang)`
    : `${cabangName} — Isi data diri dengan lengkap dan benar`;

  const summaryBar = document.getElementById('teamSummaryBar');
  const addBtn     = document.getElementById('addMemberBtn');
  if (state.isTeam) {
    summaryBar.classList.remove('hidden');
    document.getElementById('teamSummaryText').textContent =
      `${cabangName} — Tim terdiri dari ${state.minMembers}–${state.maxMembers} anggota`;
    addBtn.classList.remove('hidden');
  } else {
    summaryBar.classList.add('hidden');
    addBtn.classList.add('hidden');
  }

  renderMemberForms();
  renderStep(2);
}

// Step 2 → Step 3
function goToStep3() {
  if (!validateStep2()) return;
  renderUploadSections();
  renderStep(3);
}

// ══ MEMBER FORMS (Step 2) ═════════════════════════════════════

function renderMemberForms() {
  const container = document.getElementById('memberFormsContainer');
  if (!container) return;
  container.innerHTML = '';
  state.members.forEach((_, i) => container.appendChild(createMemberCard(i)));
  updateAddMemberBtn();
}

function createMemberCard(idx) {
  const isKetua = idx === 0;
  const badge   = isKetua && state.isTeam ? 'ketua' : '';
  const role    = !state.isTeam ? 'Peserta' : isKetua ? 'Ketua Tim' : `Anggota ${idx + 1}`;

  const card = document.createElement('div');
  card.className = 'member-card';
  card.id = `member-card-${idx}`;

  card.innerHTML = `
    <div class="member-card-header">
      <div class="member-num">
        <div class="member-num-badge ${badge}">${idx + 1}</div>
        <span class="member-name-preview" id="preview-name-${idx}">${role}</span>
        <span class="member-age-tag" id="age-tag-${idx}" style="display:none"></span>
      </div>
      ${!isKetua ? `<button type="button" class="btn-remove-member" onclick="removeMember(${idx})">✕ Hapus</button>` : ''}
    </div>
    <div class="member-card-body">
      <div class="form-grid">

        <div class="field-group full">
          <label class="field-label">Nama Lengkap <span class="req">*</span></label>
          <input type="text" class="field-input" id="m${idx}_nama"
            placeholder="Nama sesuai identitas resmi (KTP/KK/Akta)"
            oninput="updatePreviewName(${idx},this.value)">
          <div class="field-error"></div>
        </div>

        <div class="field-group">
          <label class="field-label">NIK <span class="req">*</span></label>
          <input type="text" class="field-input" id="m${idx}_nik"
            placeholder="16 digit NIK" maxlength="16" inputmode="numeric">
          <div class="field-error"></div>
        </div>

        <div class="field-group">
          <label class="field-label">Tempat Lahir <span class="req">*</span></label>
          <input type="text" class="field-input" id="m${idx}_tempat_lahir"
            placeholder="Kota/Kabupaten kelahiran">
          <div class="field-error"></div>
        </div>

        <div class="field-group">
          <label class="field-label">
            Tanggal Lahir <span class="req">*</span>
            <span class="age-chip" id="m${idx}_age_chip"></span>
          </label>
          <input type="date" class="field-input" id="m${idx}_tanggal_lahir"
            onchange="validateMemberAge(${idx})">
          <div class="field-error" id="m${idx}_age_error"></div>
        </div>

        <div class="field-group">
          <label class="field-label">Jenis Kelamin <span class="req">*</span></label>
          <select class="field-select" id="m${idx}_jenis_kelamin">
            <option value="">-- Pilih --</option>
            <option value="Laki-laki">Laki-laki</option>
            <option value="Perempuan">Perempuan</option>
          </select>
          <div class="field-error"></div>
        </div>

        <div class="field-group">
          <label class="field-label">No. WhatsApp <span class="req">*</span></label>
          <input type="tel" class="field-input" id="m${idx}_no_hp"
            placeholder="08xxxxxxxxxx">
          <div class="field-error"></div>
        </div>

        <div class="field-group full">
          <label class="field-label">Alamat Lengkap <span class="req">*</span></label>
          <textarea class="field-textarea" id="m${idx}_alamat" rows="2"
            placeholder="Jalan, RT/RW, Desa/Kel, Kecamatan"></textarea>
          <div class="field-error"></div>
        </div>

      </div>
    </div>`;

  return card;
}

function updatePreviewName(idx, val) {
  const el = document.getElementById(`preview-name-${idx}`);
  if (el) el.textContent = val.trim() || (!state.isTeam ? 'Peserta' : idx === 0 ? 'Ketua Tim' : `Anggota ${idx + 1}`);
}

function addMember() {
  if (state.members.length >= state.maxMembers) return;
  state.members.push({});
  renderMemberForms();
}

function removeMember(idx) {
  if (state.members.length <= state.minMembers) {
    showToast('Tidak Bisa Dihapus', `Minimal ${state.minMembers} anggota diperlukan.`, 'warning');
    return;
  }
  state.members.splice(idx, 1);
  renderMemberForms();
}

function updateAddMemberBtn() {
  const btn = document.getElementById('addMemberBtn');
  if (!btn || !state.isTeam) return;
  const atMax = state.members.length >= state.maxMembers;
  btn.disabled     = atMax;
  btn.textContent  = atMax
    ? `✅ Maksimum ${state.maxMembers} anggota tercapai`
    : `➕ Tambah Anggota (maks. ${state.maxMembers} orang)`;
}

// ── Age validation per member ─────────────────────────────────
function validateMemberAge(idx) {
  const tglEl  = document.getElementById(`m${idx}_tanggal_lahir`);
  const chip   = document.getElementById(`m${idx}_age_chip`);
  const errEl  = document.getElementById(`m${idx}_age_error`);
  const ageTag = document.getElementById(`age-tag-${idx}`);
  const cfg    = state.currentCfg;
  if (!tglEl?.value || !cfg) return;

  const age    = calcAgeYears(tglEl.value);
  chip.textContent = `📅 ${age} thn`;

  const minOk  = age >= cfg.umur_min;
  const maxOk  = cfg.umur_max_tahun >= 99 || age <= cfg.umur_max_tahun;

  if (!minOk || !maxOk) {
    chip.className     = 'age-chip err';
    const maxStr       = cfg.umur_max_tahun < 99 ? cfg.umur_max_tahun : '∞';
    errEl.textContent  = `❌ Usia ${age} thn tidak sesuai (${cfg.umur_min}–${maxStr} thn)`;
    errEl.classList.add('show');
    ageTag.textContent  = `${age} thn ❌`;
    ageTag.className    = 'member-age-tag err';
    ageTag.style.display = 'inline-block';
  } else {
    chip.className = 'age-chip';
    errEl.classList.remove('show');
    ageTag.textContent  = `${age} thn ✓`;
    ageTag.className    = 'member-age-tag ok';
    ageTag.style.display = 'inline-block';
  }
}

function calcAgeYears(dob) {
  const today = new Date(), birth = new Date(dob + 'T00:00:00');
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

// ── Validate Step 2 ───────────────────────────────────────────
function validateStep2() {
  let valid = true;
  const FIELDS = ['nama','nik','tempat_lahir','tanggal_lahir','jenis_kelamin','no_hp','alamat'];

  for (let i = 0; i < state.members.length; i++) {
    FIELDS.forEach(f => {
      const el = document.getElementById(`m${i}_${f}`);
      if (!el) return;
      clearError(el);
      if (!el.value.trim()) { showError(el, 'Wajib diisi'); valid = false; }
    });

    // NIK 16 digits
    const nik = document.getElementById(`m${i}_nik`);
    if (nik?.value && nik.value.length !== 16) {
      showError(nik, 'NIK harus tepat 16 digit'); valid = false;
    }

    // Phone format
    const hp = document.getElementById(`m${i}_no_hp`);
    if (hp?.value && !/^(\+62|08)\d{7,12}$/.test(hp.value.replace(/\s/g,''))) {
      showError(hp, 'Nomor HP tidak valid (awali dengan 08 atau +62)'); valid = false;
    }

    // Age error
    const ageErr = document.getElementById(`m${i}_age_error`);
    if (ageErr?.classList.contains('show')) valid = false;
  }

  if (!valid) showToast('Data Tidak Lengkap', 'Mohon periksa kembali data peserta.', 'warning');
  return valid;
}

// ══ UPLOAD SECTIONS (Step 3) ══════════════════════════════════

function renderUploadSections() {
  const container = document.getElementById('memberUploadsContainer');
  if (!container) return;
  container.innerHTML = '';

  state.members.forEach((_, i) => {
    const nama    = document.getElementById(`m${i}_nama`)?.value?.trim();
    const label   = nama || (!state.isTeam ? 'Peserta' : i === 0 ? 'Ketua Tim' : `Anggota ${i + 1}`);
    const roleStr = !state.isTeam ? '' : i === 0 ? 'Ketua Tim' : `Anggota ${i + 1}`;
    const icon    = state.isTeam && i === 0 ? '👑' : '👤';

    const sec = document.createElement('div');
    sec.className = 'upload-member-section';
    sec.innerHTML = `
      <div class="upload-member-title">
        <span style="font-size:20px">${icon}</span>
        <div>
          <div>${label}</div>
          ${roleStr ? `<div style="font-size:12px;font-weight:400;color:var(--gray-400)">${roleStr}</div>` : ''}
        </div>
      </div>
      <div class="form-grid" style="grid-template-columns:1fr 1fr">

        <div>
          <div class="upload-zone" id="photoZone_${i}">
            <input type="file" accept="image/jpeg,image/png" id="photoInput_${i}">
            <div class="upload-icon">📸</div>
            <h4>Pas Foto</h4>
            <p>JPG/PNG — Maks. 2 MB <span class="req">*</span></p>
          </div>
          <div class="upload-preview" id="photoPreview_${i}">
            <span class="file-icon">🖼️</span>
            <span class="file-name"></span>
            <span class="file-size"></span>
            <button type="button" class="remove-file" onclick="removeFile('photo_${i}')">✕</button>
          </div>
        </div>

        <div>
          <div class="upload-zone" id="ktpZone_${i}">
            <input type="file" accept="image/jpeg,image/png,application/pdf" id="ktpInput_${i}">
            <div class="upload-icon">🪪</div>
            <h4>KTP / Kartu Keluarga</h4>
            <p>JPG/PNG/PDF — Maks. 2 MB <span class="req">*</span></p>
          </div>
          <div class="upload-preview" id="ktpPreview_${i}">
            <span class="file-icon">📄</span>
            <span class="file-name"></span>
            <span class="file-size"></span>
            <button type="button" class="remove-file" onclick="removeFile('ktp_${i}')">✕</button>
          </div>
        </div>

      </div>`;

    container.appendChild(sec);
    setupUpload(`photoZone_${i}`, `photo_${i}`, `photoPreview_${i}`, ['image/jpeg','image/png'], 2);
    setupUpload(`ktpZone_${i}`,   `ktp_${i}`,   `ktpPreview_${i}`,   ['image/jpeg','image/png','application/pdf'], 2);
  });
}

function setupRekomUpload() {
  setupUpload('rekomZone', 'rekom', 'rekomPreview', ['image/jpeg','image/png','application/pdf'], 2);
}

// ── Upload helpers ────────────────────────────────────────────
function setupUpload(zoneId, fileKey, previewId, allowedTypes, maxMB) {
  const zone    = document.getElementById(zoneId);
  const preview = document.getElementById(previewId);
  if (!zone) return;

  zone.addEventListener('dragover',  e => { e.preventDefault(); zone.classList.add('drag-over'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
  zone.addEventListener('drop', e => {
    e.preventDefault(); zone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file, fileKey, zone, preview, allowedTypes, maxMB);
  });

  const input = zone.querySelector('input[type="file"]');
  if (input) {
    input.addEventListener('change', e => {
      const file = e.target.files[0];
      if (file) handleFile(file, fileKey, zone, preview, allowedTypes, maxMB);
    });
  }
}

function handleFile(file, key, zone, preview, allowedTypes, maxMB) {
  if (!allowedTypes.includes(file.type)) {
    showToast('Format Salah', `Gunakan: ${allowedTypes.map(t => t.split('/')[1].toUpperCase()).join(', ')}`, 'error');
    return;
  }
  if (file.size > maxMB * 1024 * 1024) {
    showToast('File Terlalu Besar', `Maksimal ${maxMB} MB per file.`, 'error');
    return;
  }
  state.files[key] = file;
  zone.classList.add('has-file');
  const nameEl = preview?.querySelector('.file-name');
  const sizeEl = preview?.querySelector('.file-size');
  const iconEl = preview?.querySelector('.file-icon');
  if (nameEl) nameEl.textContent = file.name;
  if (sizeEl) sizeEl.textContent = fmtSize(file.size);
  if (iconEl) iconEl.textContent = file.type === 'application/pdf' ? '📄' : '🖼️';
  preview?.classList.add('show');
}

function removeFile(key) {
  state.files[key] = null;
  let zoneId, previewId, inputId;
  if (key === 'rekom') {
    zoneId = 'rekomZone'; previewId = 'rekomPreview'; inputId = 'rekomInput';
  } else {
    const parts = key.split('_');
    const idx   = parts[parts.length - 1];
    const type  = parts.slice(0, -1).join('_');
    zoneId    = `${type}Zone_${idx}`;
    previewId = `${type}Preview_${idx}`;
    inputId   = `${type}Input_${idx}`;
  }
  document.getElementById(zoneId)?.classList.remove('has-file');
  document.getElementById(previewId)?.classList.remove('show');
  const inp = document.getElementById(inputId);
  if (inp) inp.value = '';
}

function fmtSize(b) {
  if (b < 1024) return b + ' B';
  if (b < 1048576) return (b / 1024).toFixed(1) + ' KB';
  return (b / 1048576).toFixed(1) + ' MB';
}

// ── Validate Step 3 ───────────────────────────────────────────
function validateStep3() {
  let valid = true;
  for (let i = 0; i < state.members.length; i++) {
    if (!state.files[`photo_${i}`]) {
      showToast('Upload Diperlukan', `Pas foto untuk peserta ke-${i+1} wajib diupload.`, 'error');
      valid = false;
    }
    if (!state.files[`ktp_${i}`]) {
      showToast('Upload Diperlukan', `KTP/KK untuk peserta ke-${i+1} wajib diupload.`, 'error');
      valid = false;
    }
  }
  if (!document.getElementById('agreement')?.checked) {
    showToast('Persetujuan Diperlukan', 'Centang persetujuan sebelum mengirim.', 'error');
    valid = false;
  }
  return valid;
}

// ══ SUBMIT ════════════════════════════════════════════════════

async function submitForm() {
  if (state.isSubmitting) return;
  if (!validateStep3()) return;

  state.isSubmitting = true;
  showLoading('Mengirim pendaftaran...', 'Mohon tunggu, jangan tutup halaman ini.');

  try {
    const kec    = document.getElementById('kecamatan').value;
    const cabang = document.getElementById('cabang_lomba').value;

    // Build member data
    const membersData = await Promise.all(state.members.map(async (_, i) => {
      const photoB64 = state.files[`photo_${i}`] ? await toBase64(state.files[`photo_${i}`]) : null;
      const ktpB64   = state.files[`ktp_${i}`]   ? await toBase64(state.files[`ktp_${i}`])   : null;
      return {
        nama_lengkap  : document.getElementById(`m${i}_nama`)?.value?.trim()          || '',
        nik           : document.getElementById(`m${i}_nik`)?.value?.trim()            || '',
        tempat_lahir  : document.getElementById(`m${i}_tempat_lahir`)?.value?.trim()  || '',
        tanggal_lahir : document.getElementById(`m${i}_tanggal_lahir`)?.value          || '',
        jenis_kelamin : document.getElementById(`m${i}_jenis_kelamin`)?.value          || '',
        no_hp         : document.getElementById(`m${i}_no_hp`)?.value?.trim()          || '',
        alamat        : document.getElementById(`m${i}_alamat`)?.value?.trim()         || '',
        photo: photoB64 ? { name: state.files[`photo_${i}`].name, type: state.files[`photo_${i}`].type, data: photoB64 } : null,
        ktp:   ktpB64   ? { name: state.files[`ktp_${i}`].name,   type: state.files[`ktp_${i}`].type,   data: ktpB64   } : null,
      };
    }));

    const rekomB64 = state.files.rekom ? await toBase64(state.files.rekom) : null;

    const payload = {
      action       : 'register',
      tipe_lomba   : state.isTeam ? 'team' : 'individu',
      kecamatan    : kec,
      cabang_lomba : cabang,
      members      : membersData,
      rekom        : rekomB64 ? { name: state.files.rekom.name, type: state.files.rekom.type, data: rekomB64 } : null,
    };

    const res    = await fetch(API_URL, { method: 'POST', body: JSON.stringify(payload), redirect: 'follow' });
    const result = await res.json();

    if (result.success) {
      state.regNumber = result.nomor_pendaftaran;
      state.formData  = { kecamatan: kec, cabang_lomba: cabang, members: membersData };
      hideLoading();
      showSuccessPage(result);
    } else {
      throw new Error(result.message || 'Pendaftaran gagal');
    }
  } catch (err) {
    hideLoading();
    showToast('Gagal Mendaftar', err.message || 'Terjadi kesalahan. Silakan coba lagi.', 'error');
    state.isSubmitting = false;
  }
}

function toBase64(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload  = () => res(r.result.split(',')[1]);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

// ══ SUCCESS PAGE ══════════════════════════════════════════════

function showSuccessPage(result) {
  document.getElementById('formContainer')?.classList.add('hidden');
  const succ = document.getElementById('successContainer');
  succ?.classList.remove('hidden');

  document.getElementById('successRegNum').textContent = result.nomor_pendaftaran;

  const det = document.getElementById('successDetail');
  const fd  = state.formData;
  const ketua = fd.members?.[0];

  if (det && ketua) {
    det.innerHTML = `
      <table style="width:100%;font-size:14px;border-collapse:collapse">
        <tr><td style="color:var(--gray-400);padding:6px 0;width:40%">Nama Peserta</td><td style="font-weight:700">${ketua.nama_lengkap}</td></tr>
        <tr><td style="color:var(--gray-400);padding:6px 0">Kecamatan</td><td>${fd.kecamatan}</td></tr>
        <tr><td style="color:var(--gray-400);padding:6px 0">Cabang Lomba</td><td>${fd.cabang_lomba}</td></tr>
        <tr><td style="color:var(--gray-400);padding:6px 0">Tipe</td><td>${state.isTeam ? 'Tim (' + fd.members.length + ' anggota)' : 'Individu'}</td></tr>
        <tr><td style="color:var(--gray-400);padding:6px 0">No. HP</td><td>${ketua.no_hp}</td></tr>
      </table>`;
  }

  generateQRCode(result.nomor_pendaftaran);
  window.scrollTo({ top: 0, behavior: 'smooth' });
  showToast('Berhasil! 🎉', 'Pendaftaran Anda berhasil diterima.', 'success', 7000);
}

// ── QR Code ───────────────────────────────────────────────────
function generateQRCode(text) {
  const el = document.getElementById('qrcode');
  if (!el) return;
  el.innerHTML = '';
  if (typeof QRCode !== 'undefined') {
    new QRCode(el, {
      text: `MTQ2026|${text}|${state.formData.cabang_lomba}`,
      width: 180, height: 180,
      colorDark: '#065f46', colorLight: '#ffffff',
      correctLevel: QRCode.CorrectLevel.H,
    });
  }
}

// ── PDF Download ──────────────────────────────────────────────
function downloadPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const fd  = state.formData;
  const reg = state.regNumber;
  const ketua = fd.members?.[0] || {};

  doc.setFillColor(6,95,70); doc.rect(0,0,210,50,'F');
  doc.setFillColor(245,158,11); doc.rect(0,50,210,2,'F');
  doc.setTextColor(255,255,255);
  doc.setFontSize(20); doc.setFont('helvetica','bold');
  doc.text('BUKTI PENDAFTARAN MTQ 2026', 105, 22, {align:'center'});
  doc.setFontSize(11); doc.setFont('helvetica','normal');
  doc.text('Musabaqah Tilawatil Qur\'an — Kab. Indramayu', 105, 32, {align:'center'});

  doc.setFillColor(240,253,245);
  doc.roundedRect(20,58,170,22,4,4,'F');
  doc.setTextColor(6,95,70);
  doc.setFontSize(14); doc.setFont('helvetica','bold');
  doc.text('Nomor Pendaftaran', 105, 67, {align:'center'});
  doc.setFontSize(18); doc.text(reg, 105, 76, {align:'center'});

  const rows = [
    ['Nama Peserta/Ketua', ketua.nama_lengkap || ''],
    ['NIK', ketua.nik || ''],
    ['Tempat, Tgl Lahir', `${ketua.tempat_lahir||''}, ${ketua.tanggal_lahir||''}`],
    ['Jenis Kelamin', ketua.jenis_kelamin || ''],
    ['No. WhatsApp', ketua.no_hp || ''],
    ['Kecamatan/Kafilah', fd.kecamatan || ''],
    ['Cabang Lomba', fd.cabang_lomba || ''],
    ['Tipe Lomba', state.isTeam ? `Tim (${fd.members?.length||1} anggota)` : 'Individu'],
  ];

  let y = 90;
  doc.setFontSize(10);
  rows.forEach(([k, v], i) => {
    doc.setFillColor(i%2===0?249:255, i%2===0?250:255, i%2===0?247:255);
    doc.rect(20,y,170,9,'F');
    doc.setTextColor(100,116,139); doc.setFont('helvetica','normal'); doc.text(k,24,y+6);
    doc.setTextColor(30,41,59);   doc.setFont('helvetica','bold');   doc.text(String(v),90,y+6);
    doc.setDrawColor(229,231,235); doc.line(20,y+9,190,y+9);
    y += 9;
  });

  const qrCanvas = document.querySelector('#qrcode canvas');
  if (qrCanvas) {
    doc.addImage(qrCanvas.toDataURL('image/png'), 'PNG', 75, y+10, 60, 60);
    doc.setFontSize(9); doc.setTextColor(107,114,128);
    doc.text('Scan QR untuk verifikasi pendaftaran', 105, y+74, {align:'center'});
    y += 80;
  }

  doc.setFillColor(6,95,70); doc.rect(0,280,210,17,'F');
  doc.setTextColor(255,255,255); doc.setFontSize(9); doc.setFont('helvetica','normal');
  doc.text(`Dicetak: ${new Date().toLocaleString('id-ID')}  |  Panitia MTQ 2026`, 105, 290, {align:'center'});
  doc.save(`Bukti_Pendaftaran_MTQ2026_${reg}.pdf`);
}

// ══ UI UTILITIES ══════════════════════════════════════════════

function showLoading(msg = 'Memproses...', sub = '') {
  const ov = document.getElementById('loadingOverlay');
  if (!ov) return;
  ov.querySelector('.loading-msg').textContent = msg;
  ov.querySelector('.loading-sub').textContent = sub;
  ov.classList.add('show');
}
function hideLoading() { document.getElementById('loadingOverlay')?.classList.remove('show'); }

function showToast(title, msg, type = 'info', dur = 4000) {
  const icons = { success:'✅', error:'❌', warning:'⚠️', info:'ℹ️' };
  const c = document.getElementById('toastContainer');
  if (!c) return;
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.innerHTML = `
    <span class="toast-icon">${icons[type]||'ℹ️'}</span>
    <div class="toast-content">
      <div class="toast-title">${title}</div>
      <div class="toast-msg">${msg}</div>
    </div>
    <button class="toast-close" onclick="this.parentElement.remove()">✕</button>`;
  c.appendChild(t);
  setTimeout(() => { t.classList.add('removing'); setTimeout(() => t.remove(), 250); }, dur);
}

function showError(field, msg) {
  if (!field) return;
  field.classList.add('error');
  const e = field.parentElement?.querySelector('.field-error');
  if (e) { e.textContent = msg; e.classList.add('show'); }
}
function clearError(field) {
  if (!field) return;
  field.classList.remove('error');
  const e = field.parentElement?.querySelector('.field-error');
  if (e) e.classList.remove('show');
}

// ── Navbar & Dark Mode (reused from main.js) ──────────────────
function initNavbar() {
  const navbar    = document.getElementById('navbar');
  const hamburger = document.getElementById('hamburger');
  const mobileNav = document.getElementById('mobileNav');
  window.addEventListener('scroll', () => navbar?.classList.toggle('scrolled', window.scrollY > 40));
  hamburger?.addEventListener('click', () => mobileNav?.classList.toggle('open'));
  mobileNav?.querySelectorAll('a').forEach(a => a.addEventListener('click', () => mobileNav.classList.remove('open')));
}

function initDarkMode() {
  const toggle = document.getElementById('darkToggle');
  const saved  = localStorage.getItem('mtq-theme') || 'light';
  document.documentElement.setAttribute('data-theme', saved);
  if (toggle) toggle.textContent = saved === 'dark' ? '☀️' : '🌙';
  toggle?.addEventListener('click', () => {
    const cur  = document.documentElement.getAttribute('data-theme') || 'light';
    const next = cur === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('mtq-theme', next);
    if (toggle) toggle.textContent = next === 'dark' ? '☀️' : '🌙';
  });
}