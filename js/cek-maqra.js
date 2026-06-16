// ============================================================
//  MTQ 2026 — js/cek-maqra.js
//  Halaman gabungan: Cek Status + Perbaikan Data + Ambil Maqra
//
//  Fixes:
//  ✅ Tidak ada fetch() — semua pakai JSONP (GET & POST tunnel)
//  ✅ NIK disabled di form edit, tidak dikirim ke server
//  ✅ Upload Sertifikat/Piagam di form perbaikan
//  ✅ Setelah verify, langsung tampilkan maqra tanpa input NIK ulang
// ============================================================

// API_URL: satu sumber dari js/config.js (window.MTQ_API_URL) — jangan ubah di sini
const API_URL = window.MTQ_API_URL || '';

let _record       = null;   // data peserta dari server
let _editFiles    = {};     // file untuk form perbaikan
let _maqraList    = [];     // daftar maqra tersedia
let _spinning     = false;
let _maqraResult  = null;
let _captchaCode  = '';     // captcha saat ini

// ── Canvas Image Captcha ──────────────────────────────────────
function generateCaptcha() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  _captchaCode = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');

  const canvas = document.getElementById('captchaCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;

  // ── Background gradient ──────────────────────────────────
  const grad = ctx.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0,   '#064e3b');
  grad.addColorStop(0.5, '#047857');
  grad.addColorStop(1,   '#059669');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // ── Noise dots ───────────────────────────────────────────
  for (let i = 0; i < 160; i++) {
    ctx.beginPath();
    ctx.arc(Math.random()*w, Math.random()*h, Math.random()*1.6+0.3, 0, Math.PI*2);
    ctx.fillStyle = `rgba(255,255,255,${0.06+Math.random()*0.18})`;
    ctx.fill();
  }

  // ── Interference bezier lines ────────────────────────────
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(Math.random()*w, Math.random()*h);
    ctx.bezierCurveTo(
      Math.random()*w, Math.random()*h,
      Math.random()*w, Math.random()*h,
      Math.random()*w, Math.random()*h
    );
    ctx.strokeStyle = `rgba(255,255,255,${0.12+Math.random()*0.18})`;
    ctx.lineWidth = 0.8 + Math.random()*1.2;
    ctx.stroke();
  }

  // ── Draw each character ──────────────────────────────────
  const charW = (w - 20) / 6;
  const lightColors = ['#ffffff','#d1fae5','#a7f3d0','#fef3c7','#fde68a','#bbf7d0'];
  _captchaCode.split('').forEach((char, i) => {
    ctx.save();
    const cx = 12 + i * charW + charW / 2;
    const cy = h / 2 + 5;
    ctx.translate(cx, cy);
    ctx.rotate((Math.random() - 0.5) * 0.52);

    const size = 22 + Math.floor(Math.random() * 7);
    ctx.font = `bold ${size}px 'Courier New','Lucida Console',monospace`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';

    // Subtle shadow for depth
    ctx.shadowColor   = 'rgba(0,0,0,0.45)';
    ctx.shadowBlur    = 4;
    ctx.shadowOffsetX = 1;
    ctx.shadowOffsetY = 1;

    // Thin stroke for crispness
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth   = 2.5;
    ctx.strokeText(char, 0, 0);

    ctx.fillStyle = lightColors[i % lightColors.length];
    ctx.fillText(char, 0, 0);
    ctx.restore();
  });

  // ── Top & bottom decorative stripe ──────────────────────
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.fillRect(0, 0, w, 3);
  ctx.fillRect(0, h-3, w, 3);

  // Clear input
  const inp = document.getElementById('captchaInput');
  if (inp) { inp.value = ''; inp.style.borderColor = 'var(--g200)'; inp.style.boxShadow = 'none'; }
  const err = document.getElementById('captchaErr');
  if (err) err.style.display = 'none';
}

function refreshCaptcha() {
  generateCaptcha();
  document.getElementById('captchaInput')?.focus();
}

// ── DOM Ready ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initDarkMode();
  generateCaptcha();
  const input = document.getElementById('nikInput');
  input.addEventListener('keydown', e => { if (e.key === 'Enter') cekStatus(); });
  input.addEventListener('input',   e => { e.target.value = e.target.value.replace(/\D/g, ''); });
  // Enter di captcha input juga trigger cek
  document.getElementById('captchaInput')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') cekStatus();
  });
});

function initDarkMode() {
  applyTheme(localStorage.getItem('mtq-theme') || 'light');
  document.getElementById('darkToggle')?.addEventListener('click', () => {
    const nxt = (document.documentElement.getAttribute('data-theme') || 'light') === 'dark' ? 'light' : 'dark';
    applyTheme(nxt);
    localStorage.setItem('mtq-theme', nxt);
  });
}
function applyTheme(t) {
  document.documentElement.setAttribute('data-theme', t);
  const ic = document.getElementById('darkToggle');
  if (ic) ic.textContent = t === 'dark' ? '☀️' : '🌙';
}

// ════════════════════════════════════════════════════════════
//  STEP 1 — Cek Status NIK
// ════════════════════════════════════════════════════════════
async function cekStatus() {
  const nik     = document.getElementById('nikInput').value.trim();
  const capInp  = (document.getElementById('captchaInput')?.value || '').trim().toUpperCase();
  const capErr  = document.getElementById('captchaErr');

  if (!nik || nik.length < 16) {
    showToast('Peringatan', 'Masukkan NIK 16 digit yang valid', 'warning');
    document.getElementById('nikInput').focus();
    return;
  }

  // Validasi captcha
  if (capInp !== _captchaCode) {
    if (capErr) { capErr.style.display = 'block'; capErr.textContent = 'Kode verifikasi tidak sesuai'; }
    const ci = document.getElementById('captchaInput');
    if (ci) { ci.style.borderColor = 'var(--red, #dc2626)'; ci.value = ''; ci.focus(); }
    generateCaptcha();   // ganti captcha baru
    showToast('Verifikasi Gagal', 'Kode keamanan salah — kode baru telah dibuat', 'warning');
    return;
  }
  if (capErr) capErr.style.display = 'none';

  showLoading(true, 'Mencari data peserta...');
  document.getElementById('searchBtn').disabled = true;
  clearAreas();

  try {
    const data = await jsonpGet({ action: 'checkNIK', nik });
    if (!data.success || !data.found) {
      renderNotFound(nik);
      return;
    }
    _record = data.record;
    renderStatusCard(_record);

    const status = (_record.status_verifikasi || '').trim();
    if (status === 'Terverifikasi') {
      // Langsung load maqra — NIK sudah ada dari _record
      await loadMaqra(_record);
    }
  } catch (err) {
    showToast('Error', 'Gagal menghubungi server. Coba lagi.', 'error');
    console.error(err);
  } finally {
    showLoading(false);
    document.getElementById('searchBtn').disabled = false;
    generateCaptcha();   // selalu refresh captcha setelah submit
  }
}

function clearAreas() {
  ['statusArea','maqraArea','editArea'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = '';
  });
  _maqraList   = [];
  _maqraResult = null;
  _spinning    = false;
}

// ════════════════════════════════════════════════════════════
//  STATUS CARD
// ════════════════════════════════════════════════════════════
function renderStatusCard(rec) {
  const status = (rec.status_verifikasi || 'Menunggu').trim();
  const isTeam = (rec.tipe_lomba || '').toLowerCase() === 'team';
  const anggota = rec.anggota || [];

  const SM = {
    'Menunggu'      : { cls:'badge-menunggu',      hdr:'status-menunggu',      icon:'⏳', label:'Menunggu Verifikasi' },
    'Terverifikasi' : { cls:'badge-terverifikasi', hdr:'status-terverifikasi', icon:'✅', label:'Terverifikasi' },
    'Ditolak'       : { cls:'badge-ditolak',       hdr:'status-ditolak',       icon:'❌', label:'Ditolak' },
    'Nonaktif'      : { cls:'badge-nonaktif',      hdr:'status-nonaktif',      icon:'🚫', label:'Nonaktif' },
  };
  const sm = SM[status] || SM['Menunggu'];

  // Info banner
  let bannerHtml = '';
  if (status === 'Menunggu') {
    bannerHtml = banner('info-gold','⏳','Sedang Diverifikasi','Mohon tunggu konfirmasi dari panitia via WhatsApp.');
  } else if (status === 'Terverifikasi') {
    bannerHtml = banner('info-green','✅','Terverifikasi','Pendaftaran Anda sudah diverifikasi. Gulir ke bawah untuk mengambil maqra.');
  } else if (status === 'Ditolak') {
    bannerHtml = banner('info-red','❌','Pendaftaran Ditolak',esc(rec.catatan || 'Tidak ada keterangan'));
  } else if (status === 'Nonaktif') {
    bannerHtml = banner('info-lock','🚫','Nonaktif','Pendaftaran Anda telah dinonaktifkan. Hubungi panitia.');
  }

  // Members (tim)
  let membersHtml = '';
  if (isTeam && anggota.length) {
    membersHtml = `<div class="info-divider"></div>
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--g400);margin-bottom:10px">👥 Anggota Tim</div>
      <div class="member-list">
        ${anggota.map((m,i) => `
          <div class="member-row">
            <div class="member-badge ${i===0?'ketua':''}">${i===0?'K':i+1}</div>
            <div style="flex:1">
              <div class="member-name">${esc(m.nama_lengkap||'-')}</div>
              <div class="member-nik">NIK: ${esc(m.nik||'-')}</div>
            </div>
            ${i===0?'<span style="font-size:11px;background:#fffbeb;color:#b45309;padding:2px 8px;border-radius:999px;font-weight:700">Ketua</span>':''}
          </div>`).join('')}
      </div>`;
  }

  // Action buttons
  let actionHtml = '';
  if (status === 'Ditolak') {
    actionHtml = `<button class="btn btn-red" onclick="showEditForm()">✏️ Perbaiki Data</button>`;
  }
  actionHtml += `<a href="index.html" class="btn btn-outline">🏠 Beranda</a>`;

  document.getElementById('statusArea').innerHTML = `
    <div class="result-card">
      <div class="result-header ${sm.hdr}">
        <div class="status-icon-big">${sm.icon}</div>
        <div>
          <div style="font-size:11px;color:var(--g500);margin-bottom:3px">Nomor Pendaftaran</div>
          <div class="nomor-highlight">${esc(rec.nomor_pendaftaran||'-')}</div>
          <div style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap">
            <span class="status-badge ${sm.cls}">${sm.label}</span>
            <span class="status-badge" style="background:${isTeam?'#fef3c7':'#eff6ff'};color:${isTeam?'#b45309':'#2563eb'}">
              ${isTeam?'👥 Tim':'👤 Individu'}
            </span>
          </div>
        </div>
      </div>
      <div class="result-body">
        ${bannerHtml}
        <div class="info-grid">
          <div class="info-item"><label>Nama Lengkap</label><div class="val">${esc(rec.nama_lengkap||'-')}</div></div>
          <div class="info-item"><label>NIK</label><div class="val" style="font-family:monospace">${esc(rec.nik||'-')}</div></div>
          <div class="info-item"><label>Kecamatan</label><div class="val">${esc(rec.kecamatan||'-')}</div></div>
          <div class="info-item"><label>Cabang Lomba</label><div class="val">${esc(rec.cabang_lomba||'-')}</div></div>
          <div class="info-item"><label>No. HP</label><div class="val">${esc(rec.no_hp||'-')}</div></div>
          <div class="info-item"><label>Jenis Kelamin</label><div class="val">${esc(rec.jenis_kelamin||'-')}</div></div>
        </div>
        ${membersHtml}
      </div>
      <div class="action-row">${actionHtml}</div>
    </div>`;
}

function banner(cls, icon, title, msg) {
  return `<div class="info-banner ${cls}">
    <div class="info-banner-icon">${icon}</div>
    <div><strong>${title}</strong>${esc(msg)}</div>
  </div>`;
}

function renderNotFound(nik) {
  document.getElementById('statusArea').innerHTML = `
    <div class="result-card">
      <div style="text-align:center;padding:40px 24px;color:var(--g400)">
        <div style="font-size:48px;margin-bottom:12px">🔍</div>
        <div style="font-size:16px;font-weight:600;color:var(--g600);margin-bottom:8px">Data Tidak Ditemukan</div>
        <p style="font-size:14px;margin-bottom:16px">NIK <strong>${esc(nik)}</strong> tidak terdaftar di MTQ 2026.</p>
        <a href="daftar.html" class="btn btn-emerald" style="display:inline-flex">📝 Daftar Sekarang</a>
      </div>
    </div>`;
}

// ════════════════════════════════════════════════════════════
//  STEP 2 — Load & Render Maqra Section
// ════════════════════════════════════════════════════════════
async function loadMaqra(rec) {
  showLoading(true, 'Memuat data maqra...');
  try {
    const maqraData = await jsonpGet({
      action : 'getMaqraStatus',
      nomor  : rec.nomor_pendaftaran,
      cabang : rec.cabang_lomba,
    });
    renderMaqraArea(maqraData, rec);
  } catch (err) {
    showToast('Error', 'Gagal memuat status maqra: ' + err.message, 'error');
  } finally {
    showLoading(false);
  }
}

function renderMaqraArea(maqraData, rec) {
  const area = document.getElementById('maqraArea');
  area.innerHTML = '';

  const wrap = document.createElement('div');
  wrap.className = 'maqra-section';

  // Profile box (compact)
  const initial = (rec.nama_lengkap || '?')[0].toUpperCase();
  wrap.innerHTML = `
    <div class="profile-box">
      <div class="profile-avatar">${initial}</div>
      <div class="profile-info">
        <div class="p-name">${esc(rec.nama_lengkap||'-')}</div>
        <div class="p-det">Cabang: ${esc(rec.cabang_lomba||'-')}</div>
        <div class="p-det">Kecamatan: ${esc(rec.kecamatan||'-')}</div>
      </div>
      <div class="profile-badge">✅ Terverifikasi</div>
    </div>`;
  area.appendChild(wrap);

  // Maqra pengambilan belum dibuka
  if (!maqraData.isOpen) {
    const jadwal = maqraData.jadwalBuka
      ? `Dibuka pada: <strong>${maqraData.jadwalBuka}</strong>`
      : 'Jadwal belum ditentukan. Pantau pengumuman dari panitia.';
    wrap.innerHTML += `
      <div class="info-banner info-lock">
        <div class="info-banner-icon">🔒</div>
        <div><strong>Pengambilan Maqra Belum Dibuka</strong>${jadwal}</div>
      </div>`;
    return;
  }

  // Sudah punya maqra
  if (maqraData.sudahAmbil && maqraData.maqra) {
    const m = maqraData.maqra;
    _maqraResult = m;
    wrap.innerHTML += `
      <div class="info-banner info-green" style="margin-bottom:16px">
        <div class="info-banner-icon">✅</div>
        <div><strong>Anda Sudah Mengambil Maqra</strong>Tersimpan permanen — tidak dapat diubah kembali.</div>
      </div>
      <div class="maqra-result-card">
        <div class="particles" id="particles"></div>
        <div class="mrc-label">📖 Maqra Anda</div>
        <div class="mrc-ayat">${esc(m.maqra_teks||m.maqra||'-')}</div>
        <div class="mrc-surah">${esc(m.maqra_detail||m.surah||'')}</div>
        <div class="mrc-nomor">Nomor Undian: ${esc(m.nomor_maqra||'-')}</div>
      </div>
      <div style="display:flex;gap:10px;justify-content:center;margin-bottom:8px">
        <button class="btn btn-emerald btn-sm" onclick="downloadBukti()">⬇️ Unduh Bukti</button>
        <a href="index.html" class="btn btn-outline btn-sm">🏠 Beranda</a>
      </div>`;
    return;
  }

  // Maqra habis
  _maqraList = maqraData.list || [];
  if (!_maqraList.length) {
    wrap.innerHTML += `
      <div class="info-banner info-red">
        <div class="info-banner-icon">😔</div>
        <div><strong>Maqra Habis</strong>Semua maqra untuk cabang ini sudah diambil. Hubungi panitia.</div>
      </div>`;
    return;
  }

  // Siap ambil maqra — tampilkan spin card
  wrap.innerHTML += buildSpinCardHtml();
  area.appendChild(wrap);
  buildStars();
  buildLanternStrip(_maqraList);
}

function buildSpinCardHtml() {
  return `
    <div class="spin-card">
      <div class="spin-card-header">
        <div class="spin-card-icon">✨</div>
        <div>
          <div class="spin-card-title">Pengambilan Maqra</div>
          <div class="spin-card-sub">Maqra dipilih secara acak — adil untuk semua peserta</div>
        </div>
      </div>
      <div class="spin-body">
        <div class="spin-stage" id="spinStage">
          <div class="glow-ring"></div>
          <div class="lantern-container" id="lanternBox">
            <div class="lantern-strip" id="lanternStrip"></div>
            <div class="lantern-window">
              <div class="lantern-window-border"></div>
            </div>
            <div class="star-field" id="starField"></div>
          </div>
          <div class="spin-status" id="spinStatus">Siap mengambil maqra...</div>
          <div class="result-reveal" id="resultReveal" style="margin-top:20px">
            <div class="maqra-result-card" id="resultCard">
              <div class="particles" id="particles"></div>
              <div class="mrc-label">📖 Maqra Anda</div>
              <div class="mrc-ayat" id="resultAyat">—</div>
              <div class="mrc-surah" id="resultSurah">—</div>
              <div class="mrc-nomor" id="resultNomor">—</div>
            </div>
            <div style="display:flex;gap:10px;justify-content:center;margin-top:14px">
              <button class="btn btn-emerald btn-sm" onclick="downloadBukti()">⬇️ Unduh Bukti</button>
              <a href="index.html" class="btn btn-outline btn-sm">🏠 Beranda</a>
            </div>
          </div>
        </div>
      </div>
      <div class="spin-trigger" id="spinTrigger">
        <button class="btn btn-emerald" style="width:100%;justify-content:center;font-size:15px;padding:13px"
                id="spinBtn" onclick="startSpin()">
          🌟 Ambil Maqra Saya
        </button>
        <p style="font-size:12px;color:var(--g400);text-align:center;margin-top:10px">
          ⚠️ Maqra yang sudah diperoleh tidak dapat diubah kembali
        </p>
      </div>
    </div>`;
}

// ════════════════════════════════════════════════════════════
//  MAQRA SPIN LOGIC
// ════════════════════════════════════════════════════════════
function buildStars() {
  const sf = document.getElementById('starField');
  if (!sf) return;
  sf.innerHTML = '';
  for (let i = 0; i < 18; i++) {
    const s = document.createElement('div');
    s.className = 'star';
    const sz = Math.random() * 3 + 1;
    s.style.cssText = `width:${sz}px;height:${sz}px;left:${Math.random()*100}%;top:${Math.random()*100}%;--s-dur:${(Math.random()*2+1.5).toFixed(1)}s;--s-delay:${(Math.random()*3).toFixed(1)}s`;
    sf.appendChild(s);
  }
}

function buildLanternStrip(list) {
  const strip = document.getElementById('lanternStrip');
  if (!strip) return;
  strip.innerHTML = '';
  // 6x repeat agar zona aman cukup panjang
  [...list,...list,...list,...list,...list,...list].forEach(item => {
    const div = document.createElement('div');
    div.className   = 'lantern-item';
    div.textContent = item.maqra_teks || item.maqra || '—';
    strip.appendChild(div);
  });
}

async function startSpin() {
  if (_spinning || !_record || !_maqraList.length) return;
  _spinning = true;

  const btn      = document.getElementById('spinBtn');
  const trigger  = document.getElementById('spinTrigger');
  const status   = document.getElementById('spinStatus');
  const strip    = document.getElementById('lanternStrip');
  const reveal   = document.getElementById('resultReveal');

  if (btn) btn.disabled = true;
  if (reveal) reveal.classList.remove('show');
  if (status) status.textContent = '🌟 Mengambil maqra...';

  const itemH      = 50;
  const totalItems = strip.childElementCount;
  const safeMax    = Math.floor(totalItems * 0.55) * itemH;

  // Mulai dari 1/6 posisi agar tidak lompat dari nol
  let offset = Math.floor(totalItems / 6) * itemH;
  strip.style.transition = 'none';
  strip.style.transform  = `translateY(-${offset}px)`;
  void strip.offsetHeight; // force reflow

  // Phase 1: teaser spin — akselerasi bertahap
  const phases = [
    { dur:320, count:5  },
    { dur:220, count:8  },
    { dur:175, count:10 },
    { dur:150, count:10 },
  ];
  for (const ph of phases) {
    for (let i = 0; i < ph.count; i++) {
      offset += itemH;
      if (offset >= safeMax) offset = Math.floor(totalItems / 6) * itemH;
      strip.style.transition = `transform ${ph.dur}ms ease-in-out`;
      strip.style.transform  = `translateY(-${offset}px)`;
      await sleep(ph.dur + 8);
    }
  }

  // Phase 2: call API via JSONP POST (no fetch, no CORS)
  if (status) status.textContent = '🔐 Mengunci pilihan...';
  let chosen = null;
  try {
    const data = await jsonpPost({
      action            : 'ambilMaqra',
      nomor_pendaftaran : _record.nomor_pendaftaran,
      cabang_lomba      : _record.cabang_lomba,
      nik               : _record.nik,
    });

    if (!data.success) {
      showToast('Gagal', data.message || 'Terjadi kesalahan. Coba lagi.', 'error', 6000);
      if (status) status.textContent = 'Gagal. Silakan coba lagi.';
      if (btn) btn.disabled = false;
      _spinning = false;
      return;
    }
    chosen       = data.maqra;
    _maqraResult = data.maqra;
  } catch (err) {
    showToast('Error', 'Gagal menghubungi server: ' + err.message, 'error');
    if (status) status.textContent = 'Error. Silakan coba lagi.';
    if (btn) btn.disabled = false;
    _spinning = false;
    return;
  }

  // Phase 3: decelerate to chosen item
  if (status) status.textContent = '✨ Maqra ditemukan!';
  const items      = Array.from(strip.children);
  const midStart   = Math.floor(items.length / 3);
  const refTxt     = (chosen.maqra_teks || chosen.maqra || '').trim();
  let   targetIdx  = midStart;
  for (let i = midStart; i < items.length - 5; i++) {
    if ((items[i].textContent || '').trim() === refTxt) { targetIdx = i; break; }
  }
  // Hitung windowCenterY dinamis dari DOM
  const lanternBox  = document.getElementById('lanternBox');
  const windowH     = lanternBox ? lanternBox.clientHeight : 200;
  const windowCenterY = windowH / 2;
  const targetY     = targetIdx * itemH - windowCenterY + itemH / 2;

  strip.style.transition = 'transform 2s cubic-bezier(0.16,1,0.3,1)';
  strip.style.transform  = `translateY(-${targetY}px)`;
  await sleep(2100);

  items.forEach(it => it.classList.remove('highlight'));
  if (items[targetIdx]) {
    items[targetIdx].classList.add('highlight');

    // Micro-correction: koreksi sisa selisih agar teks persis di tengah garis emas
    if (lanternBox) {
      const containerRect = lanternBox.getBoundingClientRect();
      const itemRect      = items[targetIdx].getBoundingClientRect();
      const diff = (itemRect.top + itemRect.height / 2) - (containerRect.top + containerRect.height / 2);
      if (Math.abs(diff) > 1) {
        const cur = parseFloat(strip.style.transform.replace('translateY(','').replace('px)','')) || 0;
        strip.style.transition = 'transform 0.3s ease-out';
        strip.style.transform  = `translateY(-${Math.abs(cur) + diff}px)`;
        await sleep(320);
      }
    }
  }

  // Phase 4: reveal
  await sleep(120);
  const ayat  = document.getElementById('resultAyat');
  const surah = document.getElementById('resultSurah');
  const nomor = document.getElementById('resultNomor');
  if (ayat)  ayat.textContent  = chosen.maqra_teks || chosen.maqra || '—';
  if (surah) surah.textContent = chosen.maqra_detail || chosen.surah || '—';
  if (nomor) nomor.textContent = `Nomor Undian: ${chosen.nomor_maqra || '—'}`;
  if (reveal) { reveal.style.display = 'block'; reveal.classList.add('show'); }
  spawnParticles();
  launchConfetti();
  if (trigger) trigger.style.display = 'none';
  if (status)  status.textContent = '🎉 Maqra berhasil diperoleh!';
  _spinning = false;
}

function spawnParticles() {
  const c = document.getElementById('particles');
  if (!c) return;
  c.innerHTML = '';
  const cols = ['#fbbf24','#a7f3d0','#fff','#fde68a','#6ee7b7'];
  for (let i = 0; i < 24; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    const sz = Math.random()*8+4, ang = Math.random()*360*(Math.PI/180), d = Math.random()*80+30;
    p.style.cssText = `width:${sz}px;height:${sz}px;background:${cols[Math.floor(Math.random()*cols.length)]};left:${40+Math.random()*20}%;top:${40+Math.random()*20}%;--px:${(Math.cos(ang)*d).toFixed(0)}px;--py:${(Math.sin(ang)*d).toFixed(0)}px;--p-dur:${(Math.random()*.6+.6).toFixed(2)}s;--p-delay:${(Math.random()*.2).toFixed(2)}s;border-radius:${Math.random()>.5?'50%':'4px'}`;
    c.appendChild(p);
  }
}

function launchConfetti() {
  const cc = document.getElementById('confettiContainer');
  if (!cc) return;
  cc.innerHTML = '';
  const cols = ['#059669','#fbbf24','#3b82f6','#ec4899','#a855f7','#f97316','#10b981'];
  for (let i = 0; i < 90; i++) {
    const p = document.createElement('div');
    p.className = 'conf-piece';
    p.style.cssText = `left:${Math.random()*100}%;background:${cols[Math.floor(Math.random()*cols.length)]};width:${Math.random()*8+5}px;height:${Math.random()*8+5}px;border-radius:${Math.random()>.5?'50%':'2px'};--c-dx:${(Math.random()*200-100).toFixed(0)}px;--c-dur:${(Math.random()*2+2).toFixed(1)}s;--c-delay:${(Math.random()*.5).toFixed(2)}s`;
    cc.appendChild(p);
  }
  setTimeout(() => { cc.innerHTML = ''; }, 5500);
}

function downloadBukti() {
  if (!_maqraResult || !_record) return;
  const m = _maqraResult, rec = _record;
  const html = `<!DOCTYPE html><html lang="id"><head><meta charset="UTF-8">
<title>Bukti Maqra MTQ 2026</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Georgia',serif;background:#f9fafb;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:20px}.card{background:#fff;border-radius:16px;box-shadow:0 8px 40px rgba(0,0,0,.15);width:100%;max-width:480px;overflow:hidden}.header{background:linear-gradient(135deg,#064e3b,#059669);padding:28px 32px;color:#fff;text-align:center}.header h1{font-size:22px;margin-bottom:4px}.header p{font-size:13px;opacity:.8}.body{padding:28px 32px}.ornament{text-align:center;color:#9ca3af;margin:12px 0;letter-spacing:4px}.field{margin-bottom:14px}.field label{font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:#9ca3af;display:block;margin-bottom:3px}.field .val{font-size:15px;font-weight:600;color:#1f2937}.mbox{background:linear-gradient(135deg,#065f46,#047857);color:#fff;border-radius:12px;padding:24px;text-align:center;margin:20px 0}.mbox .ml{font-size:11px;text-transform:uppercase;letter-spacing:.6px;opacity:.75;margin-bottom:8px}.mbox .ma{font-size:22px;font-weight:700;margin-bottom:4px}.mbox .ms{font-size:14px;opacity:.85}.mbox .mn{background:rgba(255,255,255,.15);border-radius:999px;padding:5px 16px;font-size:12px;font-weight:600;display:inline-block;margin-top:10px}.warn{background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:12px 16px;font-size:12px;color:#b45309;margin-top:16px}.footer{border-top:1px solid #e5e7eb;padding:16px 32px;font-size:12px;color:#9ca3af;text-align:center}@media print{body{background:#fff}.card{box-shadow:none}}</style></head>
<body><div class="card">
<div class="header"><h1>📖 Bukti Maqra MTQ 2026</h1><p>Kabupaten Indramayu — ${new Date().toLocaleString('id-ID')}</p></div>
<div class="body"><div class="ornament">✦ ✦ ✦</div>
<div class="field"><label>Nama Peserta</label><div class="val">${esc(rec.nama_lengkap||'-')}</div></div>
<div class="field"><label>Nomor Pendaftaran</label><div class="val" style="font-family:monospace;letter-spacing:1px">${esc(rec.nomor_pendaftaran||'-')}</div></div>
<div class="field"><label>Cabang Lomba</label><div class="val">${esc(rec.cabang_lomba||'-')}</div></div>
<div class="field"><label>Kecamatan</label><div class="val">${esc(rec.kecamatan||'-')}</div></div>
<div class="mbox"><div class="ml">📖 Maqra</div><div class="ma">${esc(m.maqra_teks||m.maqra||'-')}</div><div class="ms">${esc(m.maqra_detail||m.surah||'')}</div><div class="mn">Nomor Undian: ${esc(m.nomor_maqra||'-')}</div></div>
<div class="warn">⚠️ Simpan dokumen ini. Maqra tidak dapat diubah. Tunjukkan kepada panitia MTQ 2026.</div></div>
<div class="footer">MTQ Kabupaten Indramayu 2026 — Dokumen sah tanpa tanda tangan</div>
</div><script>window.print();<\/script></body></html>`;
  const a = Object.assign(document.createElement('a'), {
    href    : URL.createObjectURL(new Blob([html], { type:'text/html;charset=utf-8' })),
    download: `Bukti_Maqra_${(rec.nomor_pendaftaran||'MTQ').replace(/[^A-Za-z0-9]/g,'_')}.html`
  });
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
}

// ════════════════════════════════════════════════════════════
//  PERBAIKAN DATA (status = Ditolak)
// ════════════════════════════════════════════════════════════
function showEditForm() {
  if (!_record) return;
  const rec     = _record;
  const isTeam  = (rec.tipe_lomba || '').toLowerCase() === 'team';
  const anggota = (isTeam && rec.anggota && rec.anggota.length)
    ? rec.anggota
    : [{ nama_lengkap:rec.nama_lengkap, nik:rec.nik, tempat_lahir:rec.tempat_lahir,
         tanggal_lahir:rec.tanggal_lahir, jenis_kelamin:rec.jenis_kelamin,
         alamat:rec.alamat, no_hp:rec.no_hp }];
  _editFiles = {};
  // Simpan ageRule dari _record untuk dipakai saat validasi DOB
  // Field ini dikirim dari server bersama data peserta (umur_min, umur_max_*)
  const _ageRule = {
    min   : rec.umur_min         ?? 0,
    maxThn: rec.umur_max_tahun   ?? 99,
    maxBln: rec.umur_max_bulan   ?? 11,
    maxHri: rec.umur_max_hari    ?? 30,
    cutoff: (typeof MTQ_CONFIG !== 'undefined' ? MTQ_CONFIG.AGE_CUTOFF_DATE : null)
            || rec.age_cutoff || new Date().toISOString().slice(0,10),
  };

  let membersHtml = anggota.map((m, idx) => {
    const isKetua = idx === 0;
    const lbl = isTeam ? (isKetua ? '👑 Ketua Tim' : `👤 Anggota ${idx+1}`) : '👤 Data Peserta';
    return `
      <div class="edit-section">
        <div class="edit-section-title">${lbl}</div>
        <div class="two-col">
          <div class="field-group">
            <label class="field-label">Nama Lengkap <span class="req">*</span></label>
            <input class="field-input" id="em_nama_${idx}" value="${esc(m.nama_lengkap||'')}">
          </div>
          <div class="field-group">
            <label class="field-label">NIK</label>
            <div style="position:relative">
              <input class="field-input" value="${esc(m.nik||'')}" disabled
                     style="padding-right:34px;font-family:monospace">
              <span style="position:absolute;right:10px;top:50%;transform:translateY(-50%);font-size:13px" title="NIK tidak bisa diubah">🔒</span>
            </div>
            <div style="font-size:11px;color:var(--g400);margin-top:3px">NIK tidak dapat diubah</div>
          </div>
          <div class="field-group">
            <label class="field-label">Tempat Lahir</label>
            <input class="field-input" id="em_tl_${idx}" value="${esc(m.tempat_lahir||'')}">
          </div>
          <div class="field-group">
            <label class="field-label">Tanggal Lahir</label>
            <input class="field-input" type="date" id="em_dob_${idx}"
                   value="${esc(m.tanggal_lahir||'')}"
                   onchange="validateDOB(this, ${JSON.stringify(_ageRule)}, '${esc(idx.toString())}')">
            <div id="age_msg_${idx}" style="margin-top:5px;font-size:12px;font-weight:600;display:none"></div>
          </div>
          <div class="field-group">
            <label class="field-label">Alamat</label>
            <input class="field-input" id="em_alamat_${idx}" value="${esc(m.alamat||'')}">
          </div>
          <div class="field-group">
            <label class="field-label">No. HP</label>
            <input class="field-input" id="em_hp_${idx}" value="${esc(m.no_hp||'')}">
          </div>
        </div>
        <div class="two-col" style="margin-top:10px">
          <div class="field-group">
            <label class="field-label">📸 Foto Terbaru</label>
            ${uzMini('foto_'+idx,'Foto peserta')}
          </div>
          <div class="field-group">
            <label class="field-label">🪪 KTP / Akte</label>
            ${uzMini('ktp_'+idx,'KTP/Akte')}
          </div>
        </div>
        <div class="field-group" style="margin-top:10px">
          <label class="field-label">🏅 Sertifikat / Piagam (opsional)</label>
          ${uzMini('sert_'+idx+'_1','Sertifikat / Piagam')}
          <div style="font-size:11px;color:var(--g400);margin-top:4px">JPG/PNG/PDF — maks. 2 MB</div>
        </div>
      </div>`;
  }).join('');

  document.getElementById('editArea').innerHTML = `
    <div class="edit-card">
      <div class="edit-header">
        <h3>✏️ Perbaikan Data Pendaftaran</h3>
        <p>Nomor: <strong>${esc(rec.nomor_pendaftaran||'')}</strong></p>
      </div>
      <div class="edit-body">
        <div style="background:#fef2f2;border:1px solid #fca5a5;border-radius:8px;padding:12px 14px;margin-bottom:16px;font-size:13px;color:#dc2626">
          <strong>📋 Alasan Penolakan:</strong> ${esc(rec.catatan||'Tidak ada keterangan')}
        </div>
        ${membersHtml}
        <div class="edit-section">
          <div class="edit-section-title">📋 Surat Rekomendasi <span class="req">*</span></div>
          ${uzMini('rekom','Surat Rekomendasi')}
          <div style="font-size:11px;color:var(--g400);margin-top:4px">Wajib diunggah ulang setiap pengajuan perbaikan</div>
        </div>
        <label style="display:flex;align-items:flex-start;gap:10px;cursor:pointer;padding:12px;border:1.5px solid var(--g200);border-radius:8px;margin-bottom:16px">
          <input type="checkbox" id="editAgree" style="margin-top:2px;width:16px;height:16px;accent-color:var(--em);flex-shrink:0">
          <span style="font-size:13px;color:var(--g600)">Saya menyatakan data yang diisikan sudah benar dan lengkap.</span>
        </label>
        <div style="display:flex;gap:10px;flex-wrap:wrap">
          <button class="btn btn-red" id="submitPerbBtn"
            onclick="submitPerbaikan('${esc(rec.nomor_pendaftaran||'')}', ${anggota.length})">
            ✨ Kirim Perbaikan
          </button>
          <button class="btn btn-outline" onclick="document.getElementById('editArea').innerHTML=''">✕ Batal</button>
        </div>
      </div>
    </div>`;

  // Bind upload zones
  for (let i = 0; i < anggota.length; i++) {
    bindUZ('foto_'+i); bindUZ('ktp_'+i);
    bindUZ('sert_'+i+'_1');
  }
  bindUZ('rekom');
  setTimeout(() => document.getElementById('editArea').scrollIntoView({ behavior:'smooth', block:'start' }), 100);
}

// ── Validasi Tanggal Lahir pada Edit Form ────────────────────
function validateDOB(input, ageRule, idx) {
  const dob     = input.value;
  const msgEl   = document.getElementById('age_msg_' + idx);
  if (!msgEl) return;

  if (!dob) { msgEl.style.display = 'none'; return; }

  // Gunakan calcAgeAt dari config.js jika tersedia
  let age;
  if (typeof calcAgeAt === 'function') {
    age = calcAgeAt(dob, ageRule.cutoff);
  } else {
    // Fallback manual
    const cutoff = new Date(ageRule.cutoff + 'T00:00:00');
    const dobD   = new Date(dob + 'T00:00:00');
    let yr = cutoff.getFullYear() - dobD.getFullYear();
    let mo = cutoff.getMonth()    - dobD.getMonth();
    let dy = cutoff.getDate()     - dobD.getDate();
    if (dy < 0) { mo--; dy += new Date(cutoff.getFullYear(), cutoff.getMonth(), 0).getDate(); }
    if (mo < 0) { yr--; mo += 12; }
    age = { tahun: yr, bulan: mo, hari: dy };
  }

  let ok = true, msg = '';
  const { min, maxThn, maxBln, maxHri } = ageRule;

  // Cek minimum
  if (age.tahun < min) {
    ok = false;
    msg = `⚠️ Usia terlalu muda — minimum ${min} tahun (usia Anda: ${age.tahun} thn ${age.bulan} bln ${age.hari} hr)`;
  }
  // Cek maximum (presisi hari)
  else if (maxThn < 99) {
    const melebihiThn = age.tahun > maxThn;
    const melebihiBln = age.tahun === maxThn && age.bulan > maxBln;
    const melebihiHri = age.tahun === maxThn && age.bulan === maxBln && age.hari > maxHri;
    if (melebihiThn || melebihiBln || melebihiHri) {
      ok = false;
      msg = `⚠️ Usia melebihi batas — maksimal ${maxThn} thn ${maxBln} bln ${maxHri} hr ` +
            `(usia Anda: ${age.tahun} thn ${age.bulan} bln ${age.hari} hr)`;
    }
  }

  if (ok) {
    msg = `✅ Usia valid: ${age.tahun} thn ${age.bulan} bln ${age.hari} hr`;
    msgEl.style.color       = 'var(--em, #059669)';
    input.style.borderColor = 'var(--em, #059669)';
    input.style.boxShadow   = '0 0 0 3px rgba(5,150,105,.1)';
  } else {
    msgEl.style.color       = 'var(--red, #dc2626)';
    input.style.borderColor = 'var(--red, #dc2626)';
    input.style.boxShadow   = '0 0 0 3px rgba(220,38,38,.1)';
  }

  msgEl.textContent    = msg;
  msgEl.style.display  = 'block';
}

// Validasi semua DOB sebelum submit
function allDOBValid(anggotaCount, ageRule) {
  for (let i = 0; i < anggotaCount; i++) {
    const inp = document.getElementById('em_dob_' + i);
    if (!inp || !inp.value) continue;
    // Trigger ulang validasi untuk memperbarui visual
    validateDOB(inp, ageRule, i.toString());
    const msgEl = document.getElementById('age_msg_' + i);
    if (msgEl && msgEl.textContent.startsWith('⚠️')) return false;
  }
  return true;
}

function uzMini(key, label) {
  return `
    <div class="upload-zone-sm" id="uz_${key}">
      <input type="file" accept="image/jpeg,image/png,application/pdf" id="uinput_${key}">
      <div class="uz-icon">📎</div>
      <div class="uz-label">Upload ${label}</div>
      <div class="uz-hint">JPG/PNG/PDF — 2 MB</div>
    </div>
    <div class="upload-preview-sm" id="uprev_${key}">
      <span>✅</span>
      <span class="file-name" id="uname_${key}"></span>
      <button class="remove-btn" onclick="removeFile('${key}')">✕</button>
    </div>`;
}

function bindUZ(key) {
  document.getElementById('uinput_'+key)?.addEventListener('change', e => handleFile(key, e.target.files[0]));
}

async function handleFile(key, file) {
  if (!file) return;
  if (file.size > 2 * 1024 * 1024) { showToast('Peringatan','File terlalu besar (maks 2 MB)','warning'); return; }
  const b64 = await toBase64(file);
  _editFiles[key] = { name:file.name, type:file.type, data:b64 };
  document.getElementById('uprev_'+key)?.classList.add('show');
  const nm = document.getElementById('uname_'+key);
  if (nm) nm.textContent = file.name;
  const uz = document.getElementById('uz_'+key);
  if (uz) uz.style.display = 'none';
}

function removeFile(key) {
  delete _editFiles[key];
  document.getElementById('uprev_'+key)?.classList.remove('show');
  const uz = document.getElementById('uz_'+key);
  if (uz) uz.style.display = '';
  const inp = document.getElementById('uinput_'+key);
  if (inp) inp.value = '';
}

function toBase64(file) {
  return new Promise((res,rej) => {
    const r = new FileReader();
    r.onload  = () => res(r.result.split(',')[1]);
    r.onerror = () => rej(new Error('Read failed'));
    r.readAsDataURL(file);
  });
}

async function submitPerbaikan(nomor, memberCount) {
  if (!document.getElementById('editAgree').checked) {
    showToast('Peringatan','Centang persetujuan terlebih dahulu','warning'); return;
  }
  if (!_editFiles['rekom']) {
    showToast('Peringatan','Surat rekomendasi wajib diupload ulang','warning'); return;
  }

  // Validasi usia semua anggota sebelum submit
  const _ageRule = {
    min   : _record?.umur_min       ?? 0,
    maxThn: _record?.umur_max_tahun ?? 99,
    maxBln: _record?.umur_max_bulan ?? 11,
    maxHri: _record?.umur_max_hari  ?? 30,
    cutoff: (typeof MTQ_CONFIG !== 'undefined' ? MTQ_CONFIG.AGE_CUTOFF_DATE : null)
            || _record?.age_cutoff || new Date().toISOString().slice(0,10),
  };
  if (!allDOBValid(memberCount, _ageRule)) {
    showToast('Data Tidak Valid', 'Tanggal lahir tidak memenuhi syarat usia cabang lomba ini', 'error');
    const firstErr = document.querySelector('[id^="age_msg_"]');
    if (firstErr) firstErr.scrollIntoView({ behavior:'smooth', block:'center' });
    return;
  }
  showLoading(true,'Mengirim perbaikan...');
  const btn = document.getElementById('submitPerbBtn');
  if (btn) btn.disabled = true;

  try {
    const srcAnggota = _record?.anggota || [{ nik: _record?.nik }];
    const members = Array.from({ length: memberCount }, (_, i) => {
      const serts = [_editFiles['sert_'+i+'_1']].filter(Boolean);
      return {
        nama_lengkap  : (document.getElementById('em_nama_'+i)?.value||'').trim(),
        nik           : (srcAnggota[i]?.nik||'').trim(),  // ← NIK dari data asli, bukan form
        tempat_lahir  : (document.getElementById('em_tl_'+i)?.value||'').trim(),
        tanggal_lahir : (document.getElementById('em_dob_'+i)?.value||'').trim(),
        alamat        : (document.getElementById('em_alamat_'+i)?.value||'').trim(),
        no_hp         : (document.getElementById('em_hp_'+i)?.value||'').trim(),
        foto          : _editFiles['foto_'+i] || null,
        ktp           : _editFiles['ktp_'+i]  || null,
        sertifikat    : serts.length ? serts : null,
      };
    });

    const data = await jsonpPost({
      action            : 'perbaikan',
      nomor_pendaftaran : nomor,
      members,
      rekom             : _editFiles['rekom'] || null,
    });

    if (data.success) {
      showToast('Berhasil','Perbaikan berhasil dikirim. Silakan tunggu verifikasi ulang.','success',6000);
      document.getElementById('editArea').innerHTML = '';
      cekStatus();
    } else {
      showToast('Gagal', data.message || 'Terjadi kesalahan', 'error', 5000);
    }
  } catch (err) {
    showToast('Error', 'Gagal menghubungi server: ' + err.message, 'error');
  } finally {
    showLoading(false);
    if (btn) btn.disabled = false;
  }
}

// ════════════════════════════════════════════════════════════
//  TRANSPORT — JSONP only (no fetch, no CORS)
// ════════════════════════════════════════════════════════════
function jsonpGet(params, timeout = 15000) {
  return new Promise((resolve, reject) => {
    const cb = 'mtqCM_' + Date.now() + '_' + Math.floor(Math.random()*9999);
    const qs = Object.entries(params).map(([k,v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
    const s  = document.createElement('script');
    let timer;
    window[cb] = d => { clearTimeout(timer); delete window[cb]; s.remove(); resolve(d); };
    s.src = `${API_URL}?${qs}&callback=${cb}`;
    s.onerror = () => { clearTimeout(timer); delete window[cb]; s.remove(); reject(new Error('Network error')); };
    timer = setTimeout(() => { delete window[cb]; s.remove(); reject(new Error('Timeout')); }, timeout);
    document.head.appendChild(s);
  });
}

function jsonpPost(payload, timeout = 30000) {
  return new Promise((resolve, reject) => {
    const cb  = 'mtqCMP_' + Date.now() + '_' + Math.floor(Math.random()*9999);
    const enc = encodeURIComponent(JSON.stringify(payload));
    const s   = document.createElement('script');
    let timer;
    window[cb] = d => { clearTimeout(timer); delete window[cb]; s.remove(); resolve(d); };
    s.src = `${API_URL}?postData=${enc}&callback=${cb}`;
    s.onerror = () => { clearTimeout(timer); delete window[cb]; s.remove(); reject(new Error('Network error')); };
    timer = setTimeout(() => { delete window[cb]; s.remove(); reject(new Error('Timeout')); }, timeout);
    document.head.appendChild(s);
  });
}

// ── Utils ─────────────────────────────────────────────────────
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function showLoading(show, msg = 'Memuat...') {
  document.getElementById('loadingOverlay')?.classList.toggle('show', show);
  const el = document.getElementById('loadingMsg'); if (el) el.textContent = msg;
}
function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function showToast(title, msg, type='info', dur=4000) {
  const icons = { success:'✅',error:'❌',warning:'⚠️',info:'ℹ️' };
  const c = document.getElementById('toastContainer'); if (!c) return;
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.innerHTML = `<span class="toast-icon">${icons[type]||'ℹ️'}</span>
    <div class="toast-content"><div class="toast-title">${title}</div><div class="toast-msg">${msg}</div></div>
    <button class="toast-close" onclick="this.parentElement.remove()">✕</button>`;
  c.appendChild(t);
  setTimeout(() => { t.classList.add('removing'); setTimeout(() => t.remove(), 250); }, dur);
}