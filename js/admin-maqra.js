// ============================================================
//  MTQ 2026 — js/admin-maqra.js  (v3 — embedded in admin.html)
//  Semua fungsi di-prefix "maqra" agar tidak konflik dengan admin.js
//  API_URL: satu sumber dari js/config.js (window.MTQ_API_URL)
// ============================================================

// API_URL: satu sumber dari js/config.js (window.MTQ_API_URL) — jangan ubah di sini
const MAQRA_API_URL = () => window.MTQ_API_URL || '';

let _maqraToken    = null;   // diambil dari sesi admin yang sudah login
let _allMaqra      = [];
let _allHasil      = [];
let _globalCfg     = null;

const MAQRA_CABANG_LIST = [
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

// ── Init: dipanggil saat tab Maqra dibuka ─────────────────────
function maqraInit() {
  // Ambil token dari sesi admin.js yang sudah login
  _maqraToken = sessionStorage.getItem('mtq_admin_token') || null;
  maqraPopulateCabangSelects();
  maqraLoadData();
}

// ── Populate select cabang ────────────────────────────────────
function maqraPopulateCabangSelects() {
  ['maqraCabang', 'maqraFilterCabang'].forEach(id => {
    const sel = document.getElementById(id);
    if (!sel) return;
    // Hindari duplikat saat init ulang
    while (sel.options.length > 1) sel.remove(1);
    MAQRA_CABANG_LIST.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c; opt.textContent = c;
      sel.appendChild(opt);
    });
  });
}

// ── Load all maqra data ───────────────────────────────────────
async function maqraLoadData() {
  if (!_maqraToken) {
    // Coba ambil token lagi (mungkin baru login)
    _maqraToken = sessionStorage.getItem('mtq_admin_token') || null;
    if (!_maqraToken) {
      maqraSetEl('maqraStatTotal', '—');
      maqraSetEl('maqraStatTersedia', '—');
      maqraSetEl('maqraStatDiambil', '—');
      return;
    }
  }
  maqraShowLoading(true, 'Memuat data maqra...');
  try {
    const data = await maqraJsonpGet({ action: 'getMaqraAdmin', token: _maqraToken });
    if (!data.success) {
      if (data.message === 'Sesi tidak valid') { maqraHandleSessionExpired(); return; }
      maqraShowToast('Error', data.message, 'error');
      return;
    }
    _allMaqra  = data.maqraList || [];
    _allHasil  = data.results   || [];
    _globalCfg = (data.config || []).find(c => c.cabang_lomba === 'GLOBAL') || null;

    maqraUpdateStats(data.stats || {});
    maqraRenderMaqraTable(_allMaqra);
    maqraRenderGlobalConfigSection();
    maqraRenderHasilTable(_allHasil);
    maqraUpdateFilterCabang(_allMaqra);
  } catch (err) {
    maqraShowToast('Error', 'Gagal memuat data: ' + err.message, 'error');
  } finally {
    maqraShowLoading(false);
  }
}

// ── Stats ─────────────────────────────────────────────────────
function maqraUpdateStats(stats) {
  maqraSetEl('maqraStatTotal',    stats.total        ?? 0);
  maqraSetEl('maqraStatTersedia', stats.tersedia     ?? 0);
  maqraSetEl('maqraStatDiambil',  stats.sudahDiambil ?? 0);
}

function maqraUpdateFilterCabang(list) {
  const cabangs = [...new Set(list.map(m => m.cabang_lomba).filter(Boolean))].sort();
  const sel = document.getElementById('maqraFilterCabang');
  if (!sel) return;
  while (sel.options.length > 1) sel.remove(1);
  cabangs.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c; opt.textContent = c;
    sel.appendChild(opt);
  });
}

// ── Maqra Table ───────────────────────────────────────────────
function maqraRenderMaqraTable(list) {
  const tbody = document.getElementById('maqraTableBody');
  if (!tbody) return;
  if (!list.length) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:24px;color:var(--gray-400)">Belum ada maqra. Tambahkan maqra terlebih dahulu.</td></tr>';
    return;
  }
  tbody.innerHTML = list.map((m, i) => `
    <tr>
      <td style="color:var(--gray-400);font-size:12px">${m.nomor_urut || i + 1}</td>
      <td style="font-size:12px">${maqraEsc(m.cabang_lomba)}</td>
      <td>
        <div style="font-weight:600">${maqraEsc(m.maqra_teks)}</div>
        ${m.maqra_detail ? `<div style="font-size:11px;color:var(--gray-400)">${maqraEsc(m.maqra_detail)}</div>` : ''}
      </td>
      <td>
        <span style="display:inline-flex;align-items:center;gap:4px;padding:3px 10px;border-radius:999px;font-size:12px;font-weight:600;${m.sudah_diambil ? 'background:#fef3c7;color:#b45309' : 'background:#d1fae5;color:#065f46'}">
          ${m.sudah_diambil ? '✅ Sudah Diambil' : '⏳ Tersedia'}
        </span>
        ${m.sudah_diambil && m.diambil_oleh
          ? `<div style="font-size:11px;color:var(--gray-400);margin-top:3px">Oleh: ${maqraEsc(m.diambil_oleh)}</div>` : ''}
      </td>
      <td>
        ${!m.sudah_diambil
          ? `<button style="background:#fef2f2;color:#dc2626;border:none;border-radius:6px;padding:5px 10px;font-size:12px;font-weight:600;cursor:pointer" onclick="maqraDelete('${maqraEsc(m.id_maqra)}')">🗑️ Hapus</button>`
          : '—'}
      </td>
    </tr>`).join('');
}

function maqraFilterTable() {
  const cabang   = document.getElementById('maqraFilterCabang')?.value || '';
  const filtered = cabang ? _allMaqra.filter(m => m.cabang_lomba === cabang) : _allMaqra;
  maqraRenderMaqraTable(filtered);
}

// ── Global Config Section ─────────────────────────────────────
function maqraRenderGlobalConfigSection() {
  const cfg = _globalCfg;
  const now = new Date();

  let isOpen = false, statusLabel = '🔒 Tutup', statusColor = '#dc2626';
  if (cfg) {
    const ov = (cfg.override || '').toLowerCase();
    if (ov === 'buka') {
      isOpen = true; statusLabel = '⚡ Override: DIBUKA PAKSA'; statusColor = 'var(--emerald)';
    } else if (ov === 'tutup') {
      isOpen = false; statusLabel = '⛔ Override: DITUTUP PAKSA';
    } else if (cfg.buka && cfg.tutup) {
      const b = new Date(cfg.buka), t = new Date(cfg.tutup);
      isOpen = now >= b && now < t;
      if (now < b)       { statusLabel = '⏳ Belum Dibuka'; statusColor = '#b45309'; }
      else if (isOpen)   { statusLabel = '✅ Sedang Buka';  statusColor = 'var(--emerald)'; }
      else               { statusLabel = '🔒 Sudah Tutup'; }
    }
  }

  const fmt = d => d ? new Date(d).toLocaleString('id-ID', {
    day:'2-digit', month:'long', year:'numeric', hour:'2-digit', minute:'2-digit'
  }) : '—';

  const statusBox = document.getElementById('maqraGlobalStatusBox');
  if (statusBox) {
    statusBox.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
        <div style="width:12px;height:12px;border-radius:50%;background:${isOpen?'#22c55e':'#dc2626'};flex-shrink:0"></div>
        <span style="font-size:15px;font-weight:700;color:${statusColor}">${statusLabel}</span>
        ${cfg ? `
          <span style="font-size:12px;color:var(--gray-400);margin-left:auto">
            📅 ${fmt(cfg.buka)} — 🔒 ${fmt(cfg.tutup)}
          </span>` : '<span style="font-size:12px;color:var(--gray-400)">Belum dikonfigurasi</span>'}
      </div>`;
    statusBox.style.background = isOpen ? '#f0fdf4' : '#fef2f2';
    statusBox.style.borderColor = isOpen ? '#86efac' : '#fca5a5';
  }

  // Isi form fields
  if (cfg) {
    try {
      if (cfg.buka)  document.getElementById('maqraCfgBuka').value  = maqraToDatetimeLocal(new Date(cfg.buka));
      if (cfg.tutup) document.getElementById('maqraCfgTutup').value = maqraToDatetimeLocal(new Date(cfg.tutup));
    } catch(e) {}
    const ov = cfg.override || '';
    document.getElementById('maqraCfgOverride').value = ov;
    maqraSetOverride(ov);
    const ketEl = document.getElementById('maqraCfgKeterangan');
    if (ketEl) ketEl.value = cfg.keterangan || '';
  }
}

function maqraToDatetimeLocal(d) {
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ── Hasil Table ───────────────────────────────────────────────
function maqraRenderHasilTable(list) {
  const tbody = document.getElementById('maqraHasilTableBody');
  if (!tbody) return;
  if (!list.length) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--gray-400)">Belum ada peserta yang mengambil maqra.</td></tr>';
    return;
  }
  tbody.innerHTML = list.map((r, i) => `
    <tr>
      <td style="color:var(--gray-400)">${i + 1}</td>
      <td style="font-family:monospace;font-size:12px">${maqraEsc(r.nomor_pendaftaran)}</td>
      <td style="font-weight:600">${maqraEsc(r.nama_lengkap || '—')}</td>
      <td style="font-size:12px">${maqraEsc(r.kecamatan || '—')}</td>
      <td style="font-size:12px">${maqraEsc(r.cabang_lomba || '—')}</td>
      <td>
        <div style="font-weight:600;color:var(--emerald)">${maqraEsc(r.maqra_teks || '—')}</div>
        ${r.maqra_detail ? `<div style="font-size:11px;color:var(--gray-400)">${maqraEsc(r.maqra_detail)}</div>` : ''}
        <div style="font-size:11px;color:var(--gray-400)">No. ${maqraEsc(r.nomor_maqra || '—')}</div>
      </td>
      <td style="font-size:12px;color:var(--gray-400)">${maqraEsc(r.timestamp || '—')}</td>
    </tr>`).join('');
}

function maqraFilterHasil() {
  const q = (document.getElementById('maqraSearchHasil')?.value || '').toLowerCase().trim();
  if (!q) { maqraRenderHasilTable(_allHasil); return; }
  maqraRenderHasilTable(_allHasil.filter(r =>
    (r.nama_lengkap||'').toLowerCase().includes(q) ||
    (r.nomor_pendaftaran||'').toLowerCase().includes(q) ||
    (r.maqra_teks||'').toLowerCase().includes(q) ||
    (r.kecamatan||'').toLowerCase().includes(q)
  ));
}

// ── Save Maqra ────────────────────────────────────────────────
// Kirim sebagai bulk_text (plain text newline-separated) bukan JSON array
// agar URL tidak melebihi batas GAS ~8KB
async function maqraSaveMaqra() {
  const cabang  = document.getElementById('maqraCabang')?.value.trim();
  const bulk    = document.getElementById('maqraBulk')?.value.trim();
  const detail  = document.getElementById('maqraDetailPrefix')?.value.trim() || '';
  const replace = document.getElementById('maqraReplace')?.checked || false;

  if (!cabang) { maqraShowToast('Peringatan', 'Pilih cabang lomba terlebih dahulu', 'warning'); return; }
  if (!bulk)   { maqraShowToast('Peringatan', 'Isi daftar maqra terlebih dahulu', 'warning'); return; }

  const lines = bulk.split('\n').map(l => l.trim()).filter(Boolean);
  if (!lines.length) { maqraShowToast('Peringatan', 'Tidak ada maqra yang dapat dibaca', 'warning'); return; }

  const msg = `Simpan ${lines.length} maqra untuk "${cabang}"?` +
    (replace ? '\n\n⚠️ Maqra yang belum diambil akan DIHAPUS dan diganti.' : '');
  if (!confirm(msg)) return;

  maqraShowLoading(true, `Menyimpan ${lines.length} maqra...`);
  try {
    // Kirim bulk_text bukan array items — URL jauh lebih pendek
    const data = await maqraJsonpPost({
      action      : 'saveMaqra',
      token       : _maqraToken,
      cabang_lomba: cabang,
      bulk_text   : lines.join('\n'),   // plain text, GAS parse sendiri
      detail      : detail,
      replace     : replace,
    });
    if (data.success) {
      maqraShowToast('Berhasil', `${data.added} maqra berhasil disimpan untuk ${cabang}`, 'success', 5000);
      document.getElementById('maqraBulk').value = '';
      document.getElementById('maqraDetailPrefix').value = '';
      document.getElementById('maqraReplace').checked = false;
      maqraLoadData();
    } else {
      if (data.message === 'Sesi tidak valid') { maqraHandleSessionExpired(); return; }
      maqraShowToast('Gagal', data.message || 'Terjadi kesalahan', 'error');
    }
  } catch (err) {
    maqraShowToast('Error', 'Gagal mengirim data: ' + err.message, 'error');
  } finally {
    maqraShowLoading(false);
  }
}

// ── Delete Maqra ──────────────────────────────────────────────
async function maqraDelete(idMaqra) {
  if (!confirm(`Hapus maqra "${idMaqra}"?`)) return;
  maqraShowLoading(true, 'Menghapus...');
  try {
    const data = await maqraJsonpPost({ action:'deleteMaqra', token:_maqraToken, id_maqra:idMaqra });
    if (data.success) {
      maqraShowToast('Berhasil', 'Maqra dihapus', 'success');
      maqraLoadData();
    } else {
      if (data.message === 'Sesi tidak valid') { maqraHandleSessionExpired(); return; }
      maqraShowToast('Gagal', data.message, 'error');
    }
  } catch (err) {
    maqraShowToast('Error', err.message, 'error');
  } finally {
    maqraShowLoading(false);
  }
}

// ── Save Global Config ────────────────────────────────────────
async function maqraSaveConfig() {
  const buka     = document.getElementById('maqraCfgBuka')?.value;
  const tutup    = document.getElementById('maqraCfgTutup')?.value;
  const override = document.getElementById('maqraCfgOverride')?.value || '';
  const ket      = document.getElementById('maqraCfgKeterangan')?.value.trim() || '';

  if (!override && (!buka || !tutup)) {
    maqraShowToast('Peringatan', 'Isi waktu buka dan tutup, atau pilih override manual', 'warning');
    return;
  }
  if (buka && tutup && new Date(buka) >= new Date(tutup)) {
    maqraShowToast('Peringatan', 'Waktu tutup harus setelah waktu buka', 'warning');
    return;
  }

  maqraShowLoading(true, 'Menyimpan konfigurasi...');
  try {
    const data = await maqraJsonpPost({
      action       : 'saveMaqraConfig',
      token        : _maqraToken,
      cabang_lomba : 'GLOBAL',
      buka         : buka  ? new Date(buka).toISOString()  : '',
      tutup        : tutup ? new Date(tutup).toISOString() : '',
      override,
      keterangan   : ket,
    });
    if (data.success) {
      maqraShowToast('Berhasil', 'Konfigurasi waktu global berhasil disimpan ✅', 'success', 5000);
      maqraLoadData();
    } else {
      if (data.message === 'Sesi tidak valid') { maqraHandleSessionExpired(); return; }
      maqraShowToast('Gagal', data.message, 'error');
    }
  } catch (err) {
    maqraShowToast('Error', err.message, 'error');
  } finally {
    maqraShowLoading(false);
  }
}

// ── Export Hasil CSV ──────────────────────────────────────────
function maqraExportHasil() {
  if (!_allHasil.length) { maqraShowToast('Info', 'Belum ada data untuk diekspor', 'info'); return; }
  const header = ['No','Nomor Pendaftaran','Nama','Kecamatan','Cabang Lomba','Maqra','Detail Maqra','Nomor Undian','Waktu'];
  const rows   = _allHasil.map((r, i) => [
    i+1, r.nomor_pendaftaran||'', r.nama_lengkap||'', r.kecamatan||'',
    r.cabang_lomba||'', r.maqra_teks||'', r.maqra_detail||'', r.nomor_maqra||'', r.timestamp||''
  ]);
  const csv  = [header,...rows].map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob(['\uFEFF'+csv], { type:'text/csv;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement('a'), {
    href: url,
    download: `HasilMaqra_MTQ2026_${new Date().toISOString().slice(0,10)}.csv`
  });
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
  maqraShowToast('Berhasil', 'File CSV berhasil diunduh', 'success');
}

// ── Session expired ───────────────────────────────────────────
function maqraHandleSessionExpired() {
  _maqraToken = null;
  sessionStorage.removeItem('mtq_admin_token');
  // Kembalikan ke halaman login admin.js
  if (typeof showLoginGate === 'function') showLoginGate();
  maqraShowToast('Sesi Habis', 'Silakan login kembali', 'warning', 5000);
}

// ── JSONP Transport ───────────────────────────────────────────
function maqraJsonpGet(params, timeout = 15000) {
  return new Promise((resolve, reject) => {
    const cb  = 'mtqMqG_' + Date.now() + '_' + Math.floor(Math.random()*9999);
    const qs  = Object.entries(params)
      .map(([k,v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
    const s   = document.createElement('script');
    let timer;
    window[cb] = d => { clearTimeout(timer); delete window[cb]; s.remove(); resolve(d); };
    s.src    = `${MAQRA_API_URL()}?${qs}&callback=${cb}`;
    s.onerror = () => { clearTimeout(timer); delete window[cb]; s.remove(); reject(new Error('Network error')); };
    timer    = setTimeout(() => { delete window[cb]; s.remove(); reject(new Error('Timeout')); }, timeout);
    document.head.appendChild(s);
  });
}

function maqraJsonpPost(payload, timeout = 30000) {
  return new Promise((resolve, reject) => {
    const cb  = 'mtqMqP_' + Date.now() + '_' + Math.floor(Math.random()*9999);
    const enc = encodeURIComponent(JSON.stringify(payload));
    const s   = document.createElement('script');
    let timer;
    window[cb] = d => { clearTimeout(timer); delete window[cb]; s.remove(); resolve(d); };
    s.src    = `${MAQRA_API_URL()}?postData=${enc}&callback=${cb}`;
    s.onerror = () => { clearTimeout(timer); delete window[cb]; s.remove(); reject(new Error('Network error')); };
    timer    = setTimeout(() => { delete window[cb]; s.remove(); reject(new Error('Timeout')); }, timeout);
    document.head.appendChild(s);
  });
}

// ── Utilities (private, prefix maqra agar tidak konflik) ──────
function maqraSetEl(id, val) { const el = document.getElementById(id); if (el) el.textContent = val; }
function maqraEsc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function maqraShowLoading(show, msg = 'Memuat...') {
  // Gunakan showLoading dari admin.js jika tersedia, fallback ke overlay sendiri
  if (typeof showLoading === 'function') { showLoading(show, msg); return; }
  document.getElementById('loadingOverlay')?.classList.toggle('show', show);
  const lm = document.getElementById('loadingMsg'); if (lm) lm.textContent = msg;
}
function maqraShowToast(title, msg, type = 'info', duration = 4000) {
  // Gunakan showToast dari admin.js jika tersedia
  if (typeof showToast === 'function') { showToast(title, msg, type, duration); return; }
  console.warn(`[Maqra Toast] ${type}: ${title} — ${msg}`);
}