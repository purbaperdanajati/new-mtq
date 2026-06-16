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

// ── UI Helpers: Mode toggle ───────────────────────────────────
let _maqraMode = 'tambah'; // 'tambah' | 'ganti'

function maqraSetMode(mode) {
  _maqraMode = mode;
  const isTambah = mode === 'tambah';

  const btnT = document.getElementById('maqraModeTambah');
  const btnG = document.getElementById('maqraModeGanti');
  const warn = document.getElementById('maqraReplaceWarn');
  const inp  = document.getElementById('maqraReplace');

  if (btnT) {
    btnT.style.border     = isTambah ? '2px solid var(--emerald)' : '2px solid var(--gray-200)';
    btnT.style.background = isTambah ? 'var(--emerald-xs)' : 'var(--white)';
    btnT.style.color      = isTambah ? 'var(--emerald)' : 'var(--gray-600)';
  }
  if (btnG) {
    btnG.style.border     = !isTambah ? '2px solid #dc2626' : '2px solid var(--gray-200)';
    btnG.style.background = !isTambah ? '#fef2f2' : 'var(--white)';
    btnG.style.color      = !isTambah ? '#dc2626' : 'var(--gray-600)';
  }
  if (warn) warn.style.display = isTambah ? 'none' : 'block';
  if (inp)  inp.value = isTambah ? 'false' : 'true';
}

// ── Hitung baris textarea ─────────────────────────────────────
function maqraCountLines() {
  const bulk = document.getElementById('maqraBulk')?.value || '';
  const count = bulk.split('\n').map(l => l.trim()).filter(Boolean).length;
  const el = document.getElementById('maqraBulkCount');
  if (el) el.textContent = count + (count === 1 ? ' baris' : ' baris');
}

// ── Info maqra yang sudah ada saat pilih cabang ───────────────
function maqraOnCabangChange() {
  const cabang  = document.getElementById('maqraCabang')?.value || '';
  const infoBox = document.getElementById('maqraCabangInfo');
  if (!infoBox) return;
  if (!cabang) { infoBox.style.display = 'none'; return; }

  const existing = _allMaqra.filter(m => m.cabang_lomba === cabang);
  const tersedia = existing.filter(m => !m.sudah_diambil).length;
  const diambil  = existing.filter(m => m.sudah_diambil).length;

  if (!existing.length) {
    infoBox.style.cssText = 'display:block;margin-top:8px;padding:10px 12px;border-radius:8px;font-size:12px;line-height:1.6;background:var(--emerald-xs);border:1px solid var(--emerald-light);color:#065f46';
    infoBox.innerHTML = '✅ Belum ada maqra untuk cabang ini. Silakan tambahkan.';
  } else {
    infoBox.style.cssText = 'display:block;margin-top:8px;padding:10px 12px;border-radius:8px;font-size:12px;line-height:1.6;background:#fef3c7;border:1px solid #fde68a;color:#b45309';
    infoBox.innerHTML = `⚠️ Sudah ada <strong>${existing.length} maqra</strong> — Tersedia: <strong>${tersedia}</strong> · Diambil: <strong>${diambil}</strong><br>
      Mode <strong>Tambah</strong>: maqra baru ditambahkan di bawah yang ada.<br>
      Mode <strong>Ganti Semua</strong>: maqra belum diambil (${tersedia}) akan <span style="color:#dc2626;font-weight:700">dihapus</span>.`;
  }
}

// ── Render tabel sebagai grouped-by-cabang cards ──────────────
function maqraRenderMaqraTable(list) {
  // Legacy ID masih digunakan oleh beberapa tempat, buat dummy
  const legacyTbody = document.getElementById('maqraTableBody');
  if (legacyTbody) legacyTbody.innerHTML = '';

  const container = document.getElementById('maqraCabangGroups');
  if (!container) return;

  if (!list.length) {
    container.innerHTML = `<div style="text-align:center;padding:48px 24px;color:var(--gray-400)">
      <div style="font-size:40px;margin-bottom:12px">📭</div>
      <div style="font-size:15px;font-weight:600">Belum ada maqra</div>
      <div style="font-size:13px;margin-top:6px">Tambahkan maqra menggunakan form di sebelah kiri</div>
    </div>`;
    return;
  }

  // Group by cabang
  const groups = {};
  list.forEach(m => {
    if (!groups[m.cabang_lomba]) groups[m.cabang_lomba] = [];
    groups[m.cabang_lomba].push(m);
  });

  const sortedCabangs = Object.keys(groups).sort();
  container.innerHTML = sortedCabangs.map(cabang => {
    const items    = groups[cabang];
    const tersedia = items.filter(m => !m.sudah_diambil).length;
    const diambil  = items.filter(m =>  m.sudah_diambil).length;
    const pct      = items.length ? Math.round(diambil / items.length * 100) : 0;

    const rows = items.map((m, i) => `
      <tr style="${m.sudah_diambil ? 'opacity:.55' : ''}">
        <td style="color:var(--gray-400);font-size:11px;white-space:nowrap">${m.nomor_urut || i+1}</td>
        <td>
          <span style="font-weight:600;color:var(--gray-800)">${maqraEsc(m.maqra_teks)}</span>
          ${m.maqra_detail ? `<span style="font-size:11px;color:var(--gray-400);margin-left:6px">${maqraEsc(m.maqra_detail)}</span>` : ''}
        </td>
        <td>
          ${m.sudah_diambil
            ? `<span style="background:#fef3c7;color:#b45309;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:700;white-space:nowrap">✅ Diambil</span>
               ${m.diambil_oleh ? `<div style="font-size:10px;color:var(--gray-400);margin-top:2px">→ ${maqraEsc(m.diambil_oleh)}</div>` : ''}`
            : `<span style="background:#d1fae5;color:#065f46;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:700">⏳ Tersedia</span>`}
        </td>
        <td>
          ${!m.sudah_diambil
            ? `<button onclick="maqraDelete('${maqraEsc(m.id_maqra)}')"
                style="background:#fef2f2;color:#dc2626;border:none;border-radius:6px;padding:4px 9px;font-size:11px;font-weight:700;cursor:pointer;transition:all .2s"
                onmouseover="this.style.background='#dc2626';this.style.color='#fff'"
                onmouseout="this.style.background='#fef2f2';this.style.color='#dc2626'">🗑️</button>`
            : '<span style="color:var(--gray-300);font-size:12px">—</span>'}
        </td>
      </tr>`).join('');

    return `
      <div class="admin-card" style="margin-bottom:14px">
        <div class="admin-card-header" style="cursor:pointer;user-select:none"
          onclick="maqraToggleCabangGroup('grp_${cabang.replace(/[^a-zA-Z0-9]/g,'_')}')"
          title="Klik untuk buka/tutup">
          <div style="display:flex;align-items:center;gap:10px;flex:1;min-width:0">
            <span style="font-size:16px">📖</span>
            <span style="font-weight:700;font-size:14px;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${maqraEsc(cabang)}</span>
            <div style="display:flex;gap:6px;flex-shrink:0">
              <span style="background:#d1fae5;color:#065f46;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:700">${tersedia} tersedia</span>
              ${diambil > 0 ? `<span style="background:#fef3c7;color:#b45309;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:700">${diambil} diambil</span>` : ''}
            </div>
          </div>
          <!-- Progress bar -->
          <div style="display:flex;align-items:center;gap:8px;flex-shrink:0;margin-left:10px">
            <div style="width:80px;height:6px;background:var(--gray-200);border-radius:999px;overflow:hidden">
              <div style="height:100%;width:${pct}%;background:${pct===100?'#22c55e':'var(--gold)'};border-radius:999px;transition:width .4s"></div>
            </div>
            <span style="font-size:11px;color:var(--gray-400);font-weight:600;min-width:28px">${pct}%</span>
            <span style="font-size:14px;color:var(--gray-400)">▾</span>
          </div>
        </div>
        <div id="grp_${cabang.replace(/[^a-zA-Z0-9]/g,'_')}" style="overflow:hidden;transition:max-height .3s ease;max-height:9999px">
          <div class="table-wrap">
            <table class="data-table" style="font-size:12px">
              <thead><tr><th style="width:40px">#</th><th>Maqra</th><th style="width:120px">Status</th><th style="width:44px">Aksi</th></tr></thead>
              <tbody>${rows}</tbody>
            </table>
          </div>
          <div style="padding:10px 16px;border-top:1px solid var(--gray-100);display:flex;align-items:center;gap:8px">
            <button onclick="maqraPresetTambah('${maqraEsc(cabang)}')"
              style="font-size:12px;padding:5px 10px;background:var(--emerald-xs);color:var(--emerald);border:1px solid var(--emerald-light);border-radius:6px;cursor:pointer;font-weight:600">
              ➕ Tambah Maqra
            </button>
            ${tersedia > 0
              ? `<button onclick="maqraPresetGanti('${maqraEsc(cabang)}')"
                  style="font-size:12px;padding:5px 10px;background:#fef2f2;color:#dc2626;border:1px solid #fca5a5;border-radius:6px;cursor:pointer;font-weight:600">
                  🔄 Ganti Semua
                </button>`
              : ''}
          </div>
        </div>
      </div>`;
  }).join('');
}

// Toggle expand/collapse group card
function maqraToggleCabangGroup(id) {
  const el = document.getElementById(id);
  if (!el) return;
  const isOpen = el.style.maxHeight && el.style.maxHeight !== '0px';
  el.style.maxHeight = isOpen ? '0px' : (el.scrollHeight + 200) + 'px';
}

// Quick-fill form dari tombol cabang card
function maqraPresetTambah(cabang) {
  const sel = document.getElementById('maqraCabang');
  if (sel) { sel.value = cabang; maqraOnCabangChange(); }
  maqraSetMode('tambah');
  document.getElementById('maqraBulk')?.focus();
  document.getElementById('maqraBulk')?.scrollIntoView({ behavior:'smooth', block:'center' });
}
function maqraPresetGanti(cabang) {
  const sel = document.getElementById('maqraCabang');
  if (sel) { sel.value = cabang; maqraOnCabangChange(); }
  maqraSetMode('ganti');
  document.getElementById('maqraBulk')?.focus();
  document.getElementById('maqraBulk')?.scrollIntoView({ behavior:'smooth', block:'center' });
}

// ── Updated filter: search + cabang + status ──────────────────
function maqraFilterTable() {
  const cabang = document.getElementById('maqraFilterCabang')?.value || '';
  const status = document.getElementById('maqraFilterStatus')?.value || '';
  const query  = (document.getElementById('maqraSearchInput')?.value || '').toLowerCase().trim();

  let filtered = _allMaqra;
  if (cabang) filtered = filtered.filter(m => m.cabang_lomba === cabang);
  if (status === 'tersedia') filtered = filtered.filter(m => !m.sudah_diambil);
  if (status === 'diambil')  filtered = filtered.filter(m =>  m.sudah_diambil);
  if (query)  filtered = filtered.filter(m =>
    maqraEsc(m.maqra_teks).toLowerCase().includes(query) ||
    maqraEsc(m.cabang_lomba).toLowerCase().includes(query) ||
    (m.maqra_detail||'').toLowerCase().includes(query)
  );
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
// ── Save Maqra ────────────────────────────────────────────────
// Frontend parse bulk_text → items[] sebelum dikirim ke backend
// karena backend mengharapkan body.items bukan body.bulk_text
async function maqraSaveMaqra() {
  const cabang  = document.getElementById('maqraCabang')?.value.trim();
  const bulk    = document.getElementById('maqraBulk')?.value.trim();
  const detail  = document.getElementById('maqraDetailPrefix')?.value.trim() || '';
  // Baca dari hidden input (value 'true'/'false') atau dari _maqraMode
  const replaceEl = document.getElementById('maqraReplace');
  const replace = replaceEl ? (replaceEl.value === 'true' || replaceEl.checked === true) : (_maqraMode === 'ganti');

  if (!cabang) { maqraShowToast('Peringatan', 'Pilih cabang lomba terlebih dahulu', 'warning'); return; }
  if (!bulk)   { maqraShowToast('Peringatan', 'Isi daftar maqra terlebih dahulu', 'warning'); return; }

  const lines = bulk.split('\n').map(l => l.trim()).filter(Boolean);
  if (!lines.length) { maqraShowToast('Peringatan', 'Tidak ada maqra yang dapat dibaca', 'warning'); return; }

  // ── Hitung nomor urut mulai dari maqra terakhir cabang ini ──
  // Agar penambahan baru tidak bentrok dengan yang sudah ada
  const existingForCabang = _allMaqra.filter(m => m.cabang_lomba === cabang);
  const startUrut = replace ? 1 : existingForCabang.length + 1;

  // ── Build items array — ini yang diharapkan backend ─────────
  const items = lines.map((line, idx) => {
    const nomorUrut = startUrut + idx;
    const idSuffix  = String(nomorUrut).padStart(3, '0');
    const cabangKey = cabang.replace(/[^A-Za-z0-9]/g, '_').toUpperCase().substring(0, 20);
    return {
      id_maqra    : `${cabangKey}_${idSuffix}`,
      cabang_lomba: cabang,
      maqra_teks  : line,
      maqra_detail: detail,
      nomor_urut  : nomorUrut,
    };
  });

  const modeLabel = replace ? 'GANTI SEMUA' : 'TAMBAH';
  const msg = `${modeLabel} ${items.length} maqra untuk "${cabang}"?`
    + (replace ? '\n\n⚠️ Maqra lama yang BELUM diambil akan dihapus.' : '');
  if (!confirm(msg)) return;

  maqraShowLoading(true, `Menyimpan ${items.length} maqra...`);
  try {
    const data = await maqraJsonpPost({
      action      : 'saveMaqra',
      token       : _maqraToken,
      cabang_lomba: cabang,
      items,                   // ← array yang benar, bukan bulk_text
      replace,
    });
    if (data.success) {
      maqraShowToast('Berhasil', `${data.added} maqra berhasil disimpan untuk ${cabang}`, 'success', 5000);
      document.getElementById('maqraBulk').value = '';
      document.getElementById('maqraDetailPrefix').value = '';
      if (replaceEl) replaceEl.value = 'false';
      maqraSetMode('tambah');
      maqraCountLines();
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
  // showLoading(msg,sub) dan hideLoading() dari admin.js — signature berbeda,
  // JANGAN panggil showLoading(show,msg) karena itu selalu menampilkan overlay.
  if (show) {
    if (typeof showLoading  === 'function') { showLoading(msg, 'Mohon tunggu'); return; }
  } else {
    if (typeof hideLoading  === 'function') { hideLoading(); return; }
  }
  // Fallback jika admin.js belum tersedia
  const el = document.getElementById('loadingOverlay');
  if (el) el.style.display = show ? 'flex' : 'none';
  const lm = document.getElementById('loadingMsg'); if (lm && show) lm.textContent = msg;
}
function maqraShowToast(title, msg, type = 'info', duration = 4000) {
  // Gunakan showToast dari admin.js jika tersedia
  if (typeof showToast === 'function') { showToast(title, msg, type, duration); return; }
  console.warn(`[Maqra Toast] ${type}: ${title} — ${msg}`);
}