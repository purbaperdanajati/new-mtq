// ============================================================
//  MTQ 2026 — js/admin-maqra.js  (v2 — fixed)
//  Admin: Manajemen Maqra
//  Fix: config waktu GLOBAL (satu config untuk semua cabang)
//       semua POST → JSONP (tidak ada fetch/XHR → no CORS error)
// ============================================================

const API_URL = (typeof MTQ_CONFIG !== 'undefined' ? MTQ_CONFIG.API_URL :
  'https://script.google.com/macros/s/AKfycbwl5y16V9Fcxub3AIScpE86ZwYiPBnRVuXWgQqonhTDat8dJoMnspEw1ifaCouDDixz/exec');

let _token     = null;
let _allMaqra  = [];
let _allHasil  = [];
let _globalCfg = null;   // single global config object

const CABANG_LIST = [
  "Tartil Al Qur'an Putra", "Tartil Al Qur'an Putri",
  'Tilawah Anak-anak Putra', 'Tilawah Anak-anak Putri',
  'Tilawah Remaja Putra', 'Tilawah Remaja Putri',
  'Tilawah Dewasa Putra', 'Tilawah Dewasa Putri',
  "Qira'at Mujawwad Putra", "Qira'at Mujawwad Putri",
  'Hafalan 1 Juz Putra', 'Hafalan 1 Juz Putri',
  'Hafalan 5 Juz Putra', 'Hafalan 5 Juz Putri',
  'Hafalan 10 Juz Putra', 'Hafalan 10 Juz Putri',
  'Hafalan 20 Juz Putra', 'Hafalan 20 Juz Putri',
  'Hafalan 30 Juz Putra', 'Hafalan 30 Juz Putri',
  'Tafsir Arab Putra', 'Tafsir Arab Putri',
  'Tafsir Indonesia Putra', 'Tafsir Indonesia Putri',
  'Tafsir Inggris Putra', 'Tafsir Inggris Putri',
  'Kaligrafi Naskah Putra', 'Kaligrafi Naskah Putri',
  'Kaligrafi Hiasan Putra', 'Kaligrafi Hiasan Putri',
  'Kaligrafi Dekorasi Putra', 'Kaligrafi Dekorasi Putri',
  'Kaligrafi Kontemporer Putra', 'Kaligrafi Kontemporer Putri',
  'KTIQ Putra', 'KTIQ Putri',
  "Fahm Al Qur'an Putra", "Fahm Al Qur'an Putri",
  "Syarh Al Qur'an Putra", "Syarh Al Qur'an Putri"
];

// ── DOM Ready ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initDarkMode();
  populateCabangSelects();

  const saved = sessionStorage.getItem('mtq_admin_token');
  if (saved) { _token = saved; showAdminArea(); }

  document.getElementById('loginPw')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') doLogin();
  });
});

// ── Dark Mode ─────────────────────────────────────────────────
function initDarkMode() {
  const saved = localStorage.getItem('mtq-theme') || 'light';
  applyTheme(saved);
  document.getElementById('darkToggle')?.addEventListener('click', () => {
    const cur = document.documentElement.getAttribute('data-theme') || 'light';
    const nxt = cur === 'dark' ? 'light' : 'dark';
    applyTheme(nxt);
    localStorage.setItem('mtq-theme', nxt);
  });
}
function applyTheme(t) {
  document.documentElement.setAttribute('data-theme', t);
  const ic = document.getElementById('darkToggle');
  if (ic) ic.textContent = t === 'dark' ? '☀️' : '🌙';
}

// ── Populate cabang selects ───────────────────────────────────
function populateCabangSelects() {
  ['maqraCabang', 'filterCabang'].forEach(id => {
    const sel = document.getElementById(id);
    if (!sel) return;
    CABANG_LIST.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c; opt.textContent = c;
      sel.appendChild(opt);
    });
  });
}

// ── Login ─────────────────────────────────────────────────────
async function doLogin() {
  const pw = (document.getElementById('loginPw')?.value || '').trim();
  if (!pw) { showToast('Peringatan', 'Masukkan password', 'warning'); return; }

  showLoading(true, 'Memverifikasi...');
  try {
    const b64  = btoa(unescape(encodeURIComponent(pw)));
    const data = await jsonpGet({ action: 'adminLogin', pw: b64 });
    if (data.success && data.token) {
      _token = data.token;
      sessionStorage.setItem('mtq_admin_token', _token);
      showAdminArea();
    } else {
      showToast('Gagal', data.message || 'Password salah', 'error');
    }
  } catch (err) {
    showToast('Error', 'Gagal menghubungi server: ' + err.message, 'error');
  } finally {
    showLoading(false);
  }
}

function showAdminArea() {
  document.getElementById('loginGate').style.display  = 'none';
  document.getElementById('adminArea').style.display  = '';
  loadMaqraData();
}

// ── Load all data ─────────────────────────────────────────────
async function loadMaqraData() {
  if (!_token) return;
  showLoading(true, 'Memuat data maqra...');
  try {
    const data = await jsonpGet({ action: 'getMaqraAdmin', token: _token });
    if (!data.success) {
      if (data.message === 'Sesi tidak valid') { handleSessionExpired(); return; }
      showToast('Error', data.message, 'error');
      return;
    }
    _allMaqra  = data.maqraList || [];
    _allHasil  = data.results   || [];
    // Global config = first (and only) entry, key = 'GLOBAL'
    _globalCfg = (data.config || []).find(c => c.cabang_lomba === 'GLOBAL') || null;

    updateStats(data.stats || {});
    renderMaqraTable(_allMaqra);
    renderGlobalConfigSection();
    renderHasilTable(_allHasil);
    updateFilterCabang(_allMaqra);

  } catch (err) {
    showToast('Error', 'Gagal memuat data: ' + err.message, 'error');
  } finally {
    showLoading(false);
  }
}

// ── Stats ─────────────────────────────────────────────────────
function updateStats(stats) {
  setEl('statTotal',    stats.total        ?? 0);
  setEl('statTersedia', stats.tersedia     ?? 0);
  setEl('statDiambil',  stats.sudahDiambil ?? 0);
}

function updateFilterCabang(list) {
  const cabangs = [...new Set(list.map(m => m.cabang_lomba).filter(Boolean))].sort();
  const sel = document.getElementById('filterCabang');
  if (!sel) return;
  while (sel.options.length > 1) sel.remove(1);
  cabangs.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c; opt.textContent = c;
    sel.appendChild(opt);
  });
}

// ── Maqra Table ───────────────────────────────────────────────
function renderMaqraTable(list) {
  const tbody = document.getElementById('maqraTableBody');
  if (!tbody) return;
  if (!list.length) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:24px;color:var(--g400)">Belum ada maqra. Tambahkan maqra terlebih dahulu.</td></tr>';
    return;
  }
  tbody.innerHTML = list.map((m, i) => `
    <tr>
      <td style="color:var(--g400);font-size:12px">${m.nomor_urut || i + 1}</td>
      <td style="font-size:12px">${esc(m.cabang_lomba)}</td>
      <td>
        <div style="font-weight:600">${esc(m.maqra_teks)}</div>
        ${m.maqra_detail ? `<div style="font-size:11px;color:var(--g400)">${esc(m.maqra_detail)}</div>` : ''}
      </td>
      <td>
        <span class="taken-badge ${m.sudah_diambil ? 'taken-yes' : 'taken-no'}">
          ${m.sudah_diambil ? '✅ Sudah Diambil' : '⏳ Tersedia'}
        </span>
        ${m.sudah_diambil && m.diambil_oleh
          ? `<div style="font-size:11px;color:var(--g400);margin-top:3px">Oleh: ${esc(m.diambil_oleh)}</div>` : ''}
      </td>
      <td>
        ${!m.sudah_diambil
          ? `<button class="btn btn-xs btn-red" onclick="deleteMaqra('${esc(m.id_maqra)}')">🗑️</button>`
          : '—'}
      </td>
    </tr>`).join('');
}

function filterMaqraTable() {
  const cabang   = document.getElementById('filterCabang')?.value || '';
  const filtered = cabang ? _allMaqra.filter(m => m.cabang_lomba === cabang) : _allMaqra;
  renderMaqraTable(filtered);
}

// ── Global Config Section ─────────────────────────────────────
// Satu konfigurasi berlaku untuk SEMUA cabang sekaligus
function renderGlobalConfigSection() {
  const cfg = _globalCfg;
  const now = new Date();

  // Determine current status
  let isOpen = false, statusLabel = 'Tutup', statusColor = 'var(--red)';
  if (cfg) {
    const ov = (cfg.override || '').toLowerCase();
    if (ov === 'buka') {
      isOpen = true; statusLabel = '⚡ Override: DIBUKA PAKSA'; statusColor = 'var(--em)';
    } else if (ov === 'tutup') {
      isOpen = false; statusLabel = '⛔ Override: DITUTUP PAKSA';
    } else if (cfg.buka && cfg.tutup) {
      const b = new Date(cfg.buka), t = new Date(cfg.tutup);
      isOpen = now >= b && now < t;
      if (now < b)       { statusLabel = '⏳ Belum Dibuka'; statusColor = 'var(--gold)'; }
      else if (isOpen)   { statusLabel = '✅ Sedang Buka';  statusColor = 'var(--em)'; }
      else               { statusLabel = '🔒 Sudah Tutup'; }
    }
  }

  const fmt = d => d ? new Date(d).toLocaleString('id-ID', {
    day:'2-digit', month:'long', year:'numeric', hour:'2-digit', minute:'2-digit'
  }) : '—';

  const statusBox = document.getElementById('globalStatusBox');
  if (statusBox) {
    statusBox.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
        <div class="cfg-dot" style="background:${isOpen?'#22c55e':'var(--red)'}"></div>
        <span style="font-size:15px;font-weight:700;color:${statusColor}">${statusLabel}</span>
        ${cfg ? `
          <span style="font-size:12px;color:var(--g400);margin-left:auto">
            📅 ${fmt(cfg.buka)} — 🔒 ${fmt(cfg.tutup)}
          </span>` : '<span style="font-size:12px;color:var(--g400)">Belum dikonfigurasi</span>'}
      </div>`;
  }

  // Fill form fields from current config
  if (cfg) {
    try {
      if (cfg.buka)  document.getElementById('cfgBuka').value  = toDatetimeLocal(new Date(cfg.buka));
      if (cfg.tutup) document.getElementById('cfgTutup').value = toDatetimeLocal(new Date(cfg.tutup));
    } catch(e) {}
    const ovSel = document.getElementById('cfgOverride');
    if (ovSel) ovSel.value = cfg.override || '';
    const ketEl = document.getElementById('cfgKeterangan');
    if (ketEl) ketEl.value = cfg.keterangan || '';
  }
}

function toDatetimeLocal(d) {
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ── Hasil Table ───────────────────────────────────────────────
function renderHasilTable(list) {
  const tbody = document.getElementById('hasilTableBody');
  if (!tbody) return;
  if (!list.length) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--g400)">Belum ada peserta yang mengambil maqra.</td></tr>';
    return;
  }
  tbody.innerHTML = list.map((r, i) => `
    <tr>
      <td style="color:var(--g400)">${i + 1}</td>
      <td style="font-family:monospace;font-size:12px">${esc(r.nomor_pendaftaran)}</td>
      <td style="font-weight:600">${esc(r.nama_lengkap || '—')}</td>
      <td style="font-size:12px">${esc(r.kecamatan || '—')}</td>
      <td style="font-size:12px">${esc(r.cabang_lomba || '—')}</td>
      <td>
        <div style="font-weight:600;color:var(--em)">${esc(r.maqra_teks || '—')}</div>
        ${r.maqra_detail ? `<div style="font-size:11px;color:var(--g400)">${esc(r.maqra_detail)}</div>` : ''}
        <div style="font-size:11px;color:var(--g400)">No. ${esc(r.nomor_maqra || '—')}</div>
      </td>
      <td style="font-size:12px;color:var(--g400)">${esc(r.timestamp || '—')}</td>
    </tr>`).join('');
}

function filterHasil() {
  const q = (document.getElementById('searchHasil')?.value || '').toLowerCase().trim();
  if (!q) { renderHasilTable(_allHasil); return; }
  renderHasilTable(_allHasil.filter(r =>
    (r.nama_lengkap||'').toLowerCase().includes(q) ||
    (r.nomor_pendaftaran||'').toLowerCase().includes(q) ||
    (r.maqra_teks||'').toLowerCase().includes(q) ||
    (r.kecamatan||'').toLowerCase().includes(q)
  ));
}

// ── Save Maqra (JSONP POST) ────────────────────────────────────
async function saveMaqra() {
  const cabang  = document.getElementById('maqraCabang')?.value.trim();
  const bulk    = document.getElementById('maqraBulk')?.value.trim();
  const detail  = document.getElementById('maqraDetailPrefix')?.value.trim() || '';
  const replace = document.getElementById('maqraReplace')?.checked || false;

  if (!cabang) { showToast('Peringatan', 'Pilih cabang lomba terlebih dahulu', 'warning'); return; }
  if (!bulk)   { showToast('Peringatan', 'Isi daftar maqra terlebih dahulu', 'warning'); return; }

  const lines = bulk.split('\n').map(l => l.trim()).filter(Boolean);
  if (!lines.length) { showToast('Peringatan', 'Tidak ada maqra yang dapat dibaca', 'warning'); return; }

  const safeId = cabang.replace(/[^A-Za-z0-9]/g,'_').toUpperCase();
  const items  = lines.map((line, idx) => ({
    id_maqra    : `${safeId}_${String(idx+1).padStart(3,'0')}`,
    cabang_lomba: cabang,
    maqra_teks  : line,
    maqra_detail: detail,
    nomor_urut  : idx + 1,
  }));

  const msg = `Simpan ${items.length} maqra untuk "${cabang}"?` +
    (replace ? '\n\n⚠️ Maqra yang belum diambil akan DIHAPUS dan diganti.' : '');
  if (!confirm(msg)) return;

  showLoading(true, 'Menyimpan maqra...');
  try {
    const data = await jsonpPost({
      action       : 'saveMaqra',
      token        : _token,
      cabang_lomba : cabang,
      items,
      replace,
    });
    if (data.success) {
      showToast('Berhasil', `${data.added} maqra berhasil disimpan untuk ${cabang}`, 'success', 5000);
      document.getElementById('maqraBulk').value       = '';
      document.getElementById('maqraReplace').checked  = false;
      loadMaqraData();
    } else {
      if (data.message === 'Sesi tidak valid') { handleSessionExpired(); return; }
      showToast('Gagal', data.message || 'Terjadi kesalahan', 'error');
    }
  } catch (err) {
    showToast('Error', err.message, 'error');
  } finally {
    showLoading(false);
  }
}

// ── Delete Maqra (JSONP POST) ──────────────────────────────────
async function deleteMaqra(idMaqra) {
  if (!confirm(`Hapus maqra "${idMaqra}"?`)) return;
  showLoading(true, 'Menghapus...');
  try {
    const data = await jsonpPost({ action:'deleteMaqra', token:_token, id_maqra:idMaqra });
    if (data.success) {
      showToast('Berhasil', 'Maqra dihapus', 'success');
      loadMaqraData();
    } else {
      if (data.message === 'Sesi tidak valid') { handleSessionExpired(); return; }
      showToast('Gagal', data.message, 'error');
    }
  } catch (err) {
    showToast('Error', err.message, 'error');
  } finally {
    showLoading(false);
  }
}

// ── Save Global Config (JSONP POST) ────────────────────────────
async function saveConfig() {
  const buka     = document.getElementById('cfgBuka')?.value;
  const tutup    = document.getElementById('cfgTutup')?.value;
  const override = document.getElementById('cfgOverride')?.value || '';
  const ket      = document.getElementById('cfgKeterangan')?.value.trim() || '';

  // Validate: if no override, both buka + tutup required
  if (!override && (!buka || !tutup)) {
    showToast('Peringatan', 'Isi waktu buka dan tutup, atau pilih override manual', 'warning');
    return;
  }
  if (buka && tutup && new Date(buka) >= new Date(tutup)) {
    showToast('Peringatan', 'Waktu tutup harus setelah waktu buka', 'warning');
    return;
  }

  showLoading(true, 'Menyimpan konfigurasi...');
  try {
    const data = await jsonpPost({
      action       : 'saveMaqraConfig',
      token        : _token,
      cabang_lomba : 'GLOBAL',   // ← selalu GLOBAL, berlaku semua cabang
      buka         : buka  ? new Date(buka).toISOString()  : '',
      tutup        : tutup ? new Date(tutup).toISOString() : '',
      override,
      keterangan   : ket,
    });
    if (data.success) {
      showToast('Berhasil', 'Konfigurasi waktu global berhasil disimpan ✅', 'success', 5000);
      loadMaqraData();
    } else {
      if (data.message === 'Sesi tidak valid') { handleSessionExpired(); return; }
      showToast('Gagal', data.message, 'error');
    }
  } catch (err) {
    showToast('Error', err.message, 'error');
  } finally {
    showLoading(false);
  }
}

// ── Export Hasil CSV ──────────────────────────────────────────
function exportHasil() {
  if (!_allHasil.length) { showToast('Info', 'Belum ada data untuk diekspor', 'info'); return; }
  const header = ['No','Nomor Pendaftaran','Nama','Kecamatan','Cabang Lomba','Maqra','Detail Maqra','Nomor Undian','Waktu'];
  const rows   = _allHasil.map((r, i) => [
    i+1, r.nomor_pendaftaran||'', r.nama_lengkap||'', r.kecamatan||'',
    r.cabang_lomba||'', r.maqra_teks||'', r.maqra_detail||'', r.nomor_maqra||'', r.timestamp||''
  ]);
  const csv  = [header,...rows].map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob(['\uFEFF'+csv], { type:'text/csv;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement('a'), { href:url, download:`HasilMaqra_MTQ2026_${new Date().toISOString().slice(0,10)}.csv` });
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('Berhasil', 'File CSV berhasil diunduh', 'success');
}

// ── Tab switching ─────────────────────────────────────────────
function switchTab(id) {
  document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b  => b.classList.remove('active'));
  document.getElementById(id)?.classList.add('active');
  const tabIds = ['tabMaqra','tabConfig','tabHasil'];
  const idx    = tabIds.indexOf(id);
  if (idx >= 0) document.querySelectorAll('.tab-btn')[idx]?.classList.add('active');
}

// ── Session expired ───────────────────────────────────────────
function handleSessionExpired() {
  _token = null;
  sessionStorage.removeItem('mtq_admin_token');
  document.getElementById('adminArea').style.display  = 'none';
  document.getElementById('loginGate').style.display  = '';
  showToast('Sesi Habis', 'Silakan login kembali', 'warning', 5000);
}

// ════════════════════════════════════════════════════════════
//  TRANSPORT — JSONP GET + JSONP POST (no CORS issues)
//
//  Google Apps Script Web App tidak mendukung CORS preflight.
//  Solusi: encode JSON payload ke query param "postData" → GAS
//  membaca e.parameter.postData di doGet dan menjalankan handler
//  yang sama seperti doPost.  Pastikan api-updated.gs sudah
//  menangani parameter ini (lihat PANDUAN.md).
// ════════════════════════════════════════════════════════════

function jsonpGet(params, timeout = 15000) {
  return new Promise((resolve, reject) => {
    const cb  = 'mtqAdmG_' + Date.now() + '_' + Math.floor(Math.random()*9999);
    const qs  = Object.entries(params)
      .map(([k,v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
    const s   = document.createElement('script');
    let timer;
    window[cb] = d => { clearTimeout(timer); delete window[cb]; s.remove(); resolve(d); };
    s.src    = `${API_URL}?${qs}&callback=${cb}`;
    s.onerror = () => { clearTimeout(timer); delete window[cb]; s.remove(); reject(new Error('Network error')); };
    timer    = setTimeout(() => { delete window[cb]; s.remove(); reject(new Error('Timeout')); }, timeout);
    document.head.appendChild(s);
  });
}

function jsonpPost(payload, timeout = 30000) {
  return new Promise((resolve, reject) => {
    const cb  = 'mtqAdmP_' + Date.now() + '_' + Math.floor(Math.random()*9999);
    const enc = encodeURIComponent(JSON.stringify(payload));
    const s   = document.createElement('script');
    let timer;
    window[cb] = d => { clearTimeout(timer); delete window[cb]; s.remove(); resolve(d); };
    s.src    = `${API_URL}?postData=${enc}&callback=${cb}`;
    s.onerror = () => { clearTimeout(timer); delete window[cb]; s.remove(); reject(new Error('Network error')); };
    timer    = setTimeout(() => { delete window[cb]; s.remove(); reject(new Error('Timeout')); }, timeout);
    document.head.appendChild(s);
  });
}

// ── Utilities ─────────────────────────────────────────────────
function setEl(id, val) { const el = document.getElementById(id); if (el) el.textContent = val; }
function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function showLoading(show, msg='Memuat...') {
  document.getElementById('loadingOverlay')?.classList.toggle('show', show);
  const lm = document.getElementById('loadingMsg'); if (lm) lm.textContent = msg;
}
function showToast(title, msg, type='info', duration=4000) {
  const icons = { success:'✅', error:'❌', warning:'⚠️', info:'ℹ️' };
  const c = document.getElementById('toastContainer'); if (!c) return;
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.innerHTML = `
    <span class="toast-icon">${icons[type]||'ℹ️'}</span>
    <div class="toast-content"><div class="toast-title">${title}</div><div class="toast-msg">${msg}</div></div>
    <button class="toast-close" onclick="this.parentElement.remove()">✕</button>`;
  c.appendChild(t);
  setTimeout(() => { t.classList.add('removing'); setTimeout(() => t.remove(), 250); }, duration);
}