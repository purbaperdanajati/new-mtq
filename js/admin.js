// ============================================
//  MTQ 2026 - Admin Dashboard JS
// ============================================

const ADMIN_API = 'https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec';
// Password diverifikasi di Apps Script (bukan di sini)
const ADMIN_PASS_HASH = 'mtq2026admin'; // Ganti di Apps Script

let allData = [];
let filteredData = [];
let currentPage = 1;
const PER_PAGE = 20;

// ── Init ──────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  checkLogin();
  initNavbar();
  initDarkMode();
  initSidebar();
});

// ── Auth ──────────────────────────────────────
function checkLogin() {
  const token = sessionStorage.getItem('mtq-admin-token');
  if (!token) {
    document.getElementById('loginModal').style.display = 'flex';
    document.getElementById('adminApp').style.display = 'none';
  } else {
    document.getElementById('loginModal').style.display = 'none';
    document.getElementById('adminApp').style.display = 'block';
    loadDashboard();
  }
}

async function doLogin() {
  const passInput = document.getElementById('adminPass');
  const pass = passInput.value.trim();
  if (!pass) { showToast('Error', 'Masukkan password.', 'error'); return; }

  const btn = document.getElementById('loginBtn');
  btn.disabled = true; btn.textContent = 'Memeriksa...';

  try {
    const res = await fetch(`${ADMIN_API}?action=adminLogin&password=${encodeURIComponent(pass)}`);
    const data = await res.json();
    if (data.success) {
      sessionStorage.setItem('mtq-admin-token', data.token);
      document.getElementById('loginModal').style.display = 'none';
      document.getElementById('adminApp').style.display = 'block';
      loadDashboard();
    } else {
      showToast('Akses Ditolak', 'Password salah.', 'error');
      passInput.value = '';
    }
  } catch {
    showToast('Akses Ditolak', 'Password tidak valid.', 'error');
    passInput.value = '';
  } finally {
    btn.disabled = false; btn.textContent = 'Masuk';
  }
}

function doLogout() {
  sessionStorage.removeItem('mtq-admin-token');
  location.reload();
}

// ── Load Dashboard ─────────────────────────────
async function loadDashboard() {
  showLoading();
  try {
    const token = sessionStorage.getItem('mtq-admin-token');
    const res = await fetch(`${ADMIN_API}?action=getAllPendaftar&token=${token}`);
    const data = await res.json();
    if (data.success) {
      allData = data.data || [];
      filteredData = [...allData];
      renderStats();
      renderTable();
    } else {
      throw new Error(data.message);
    }
  } catch (e) {
    showToast('Error', 'Gagal memuat data: ' + e.message, 'error');
  } finally {
    hideLoading();
  }
}

// ── Stats ─────────────────────────────────────
function renderStats() {
  const total    = allData.length;
  const verified = allData.filter(d => d.status_verifikasi === 'Terverifikasi').length;
  const pending  = allData.filter(d => d.status_verifikasi === 'Menunggu').length;
  const rejected = allData.filter(d => d.status_verifikasi === 'Ditolak').length;
  const cabangs  = [...new Set(allData.map(d => d.cabang_lomba))].length;

  document.getElementById('statTotal').textContent    = total;
  document.getElementById('statVerified').textContent = verified;
  document.getElementById('statPending').textContent  = pending;
  document.getElementById('statCabang').textContent   = cabangs;
}

// ── Table ─────────────────────────────────────
function renderTable() {
  const tbody  = document.getElementById('tableBody');
  const start  = (currentPage - 1) * PER_PAGE;
  const slice  = filteredData.slice(start, start + PER_PAGE);

  if (filteredData.length === 0) {
    tbody.innerHTML = `
      <tr><td colspan="9" style="text-align:center;padding:40px;color:var(--gray-400)">
        📭 Tidak ada data ditemukan
      </td></tr>`;
    updatePagination(0);
    return;
  }

  tbody.innerHTML = slice.map((d, i) => `
    <tr>
      <td>${start + i + 1}</td>
      <td><strong>${d.nomor_pendaftaran || '-'}</strong></td>
      <td>${d.nama_lengkap || '-'}</td>
      <td>${d.cabang_lomba || '-'}</td>
      <td>${d.golongan || '-'}</td>
      <td>${d.kecamatan || '-'}</td>
      <td>
        <span class="status-badge ${statusClass(d.status_verifikasi)}">
          ${statusIcon(d.status_verifikasi)} ${d.status_verifikasi || 'Menunggu'}
        </span>
      </td>
      <td>${formatDate(d.timestamp)}</td>
      <td>
        <div style="display:flex;gap:4px;flex-wrap:wrap">
          <button class="action-btn view" onclick="viewDetail('${d.nomor_pendaftaran}')">👁️</button>
          ${d.status_verifikasi !== 'Terverifikasi' ? `<button class="action-btn verify" onclick="updateStatus('${d.nomor_pendaftaran}','Terverifikasi')">✅</button>` : ''}
          ${d.status_verifikasi !== 'Ditolak' ? `<button class="action-btn reject" onclick="updateStatus('${d.nomor_pendaftaran}','Ditolak')">❌</button>` : ''}
          <button class="action-btn view" onclick="printCard('${d.nomor_pendaftaran}')">🖨️</button>
        </div>
      </td>
    </tr>
  `).join('');

  updatePagination(filteredData.length);
  document.getElementById('dataCount').textContent = `${filteredData.length} peserta`;
}

function statusClass(s) {
  if (s === 'Terverifikasi') return 'verified';
  if (s === 'Ditolak') return 'rejected';
  return 'pending';
}
function statusIcon(s) {
  if (s === 'Terverifikasi') return '✅';
  if (s === 'Ditolak') return '❌';
  return '⏳';
}
function formatDate(ts) {
  if (!ts) return '-';
  return new Date(ts).toLocaleDateString('id-ID', { day:'numeric', month:'short', year:'numeric' });
}

// ── Pagination ────────────────────────────────
function updatePagination(total) {
  const totalPages = Math.ceil(total / PER_PAGE);
  const el = document.getElementById('pagination');
  if (!el) return;

  el.innerHTML = '';

  const makeBtn = (label, page, disabled = false, active = false) => {
    const btn = document.createElement('button');
    btn.textContent = label;
    btn.className = `action-btn view ${active ? 'active-page' : ''}`;
    if (active) btn.style.background = 'var(--emerald)'; btn.style.color = '#fff';
    btn.disabled = disabled;
    btn.onclick = () => { currentPage = page; renderTable(); };
    return btn;
  };

  el.appendChild(makeBtn('‹', currentPage - 1, currentPage === 1));
  for (let i = 1; i <= totalPages; i++) {
    if (totalPages <= 7 || Math.abs(i - currentPage) <= 2 || i === 1 || i === totalPages) {
      el.appendChild(makeBtn(i, i, false, i === currentPage));
    }
  }
  el.appendChild(makeBtn('›', currentPage + 1, currentPage === totalPages));
}

// ── Search & Filter ───────────────────────────
function applyFilters() {
  const q       = (document.getElementById('searchInput')?.value || '').toLowerCase();
  const cabang  = document.getElementById('filterCabang')?.value  || '';
  const kec     = document.getElementById('filterKec')?.value     || '';
  const status  = document.getElementById('filterStatus')?.value  || '';

  filteredData = allData.filter(d => {
    const matchQ      = !q      || Object.values(d).join(' ').toLowerCase().includes(q);
    const matchCabang = !cabang || d.cabang_lomba === cabang;
    const matchKec    = !kec    || d.kecamatan === kec;
    const matchStatus = !status || d.status_verifikasi === status;
    return matchQ && matchCabang && matchKec && matchStatus;
  });

  currentPage = 1;
  renderTable();
}

function initFilters() {
  document.getElementById('searchInput')?.addEventListener('input', applyFilters);
  document.getElementById('filterCabang')?.addEventListener('change', applyFilters);
  document.getElementById('filterKec')?.addEventListener('change', applyFilters);
  document.getElementById('filterStatus')?.addEventListener('change', applyFilters);

  // Populate filter dropdowns
  const cabangs  = [...new Set(allData.map(d => d.cabang_lomba).filter(Boolean))];
  const kecs     = [...new Set(allData.map(d => d.kecamatan).filter(Boolean))];

  const cabSelect = document.getElementById('filterCabang');
  cabangs.forEach(c => {
    const o = document.createElement('option'); o.value = c; o.textContent = c;
    cabSelect?.appendChild(o);
  });
  const kecSelect = document.getElementById('filterKec');
  kecs.forEach(k => {
    const o = document.createElement('option'); o.value = k; o.textContent = k;
    kecSelect?.appendChild(o);
  });
}

// ── Update Status ─────────────────────────────
async function updateStatus(nomorPendaftaran, newStatus) {
  const confirm = window.confirm(`Yakin ${newStatus === 'Terverifikasi' ? 'verifikasi' : 'tolak'} peserta ini?`);
  if (!confirm) return;

  const token = sessionStorage.getItem('mtq-admin-token');
  showLoading();

  try {
    const res = await fetch(ADMIN_API, {
      method: 'POST',
      body: JSON.stringify({
        action: 'updateStatus',
        token,
        nomor_pendaftaran: nomorPendaftaran,
        status: newStatus,
      }),
    });
    const data = await res.json();
    if (data.success) {
      const idx = allData.findIndex(d => d.nomor_pendaftaran === nomorPendaftaran);
      if (idx !== -1) allData[idx].status_verifikasi = newStatus;
      applyFilters();
      renderStats();
      showToast('Berhasil', `Status diubah ke "${newStatus}"`, 'success');
    } else {
      throw new Error(data.message);
    }
  } catch (e) {
    showToast('Error', 'Gagal mengubah status: ' + e.message, 'error');
  } finally {
    hideLoading();
  }
}

// ── View Detail ───────────────────────────────
function viewDetail(nomorPendaftaran) {
  const d = allData.find(x => x.nomor_pendaftaran === nomorPendaftaran);
  if (!d) return;

  const content = document.getElementById('modalContent');
  content.innerHTML = `
    <div class="participant-detail">
      ${[
        ['Nomor Pendaftaran', d.nomor_pendaftaran],
        ['Nama Lengkap', d.nama_lengkap],
        ['NIK', d.nik],
        ['Tempat Lahir', d.tempat_lahir],
        ['Tanggal Lahir', d.tanggal_lahir],
        ['Umur', d.umur + ' tahun'],
        ['Jenis Kelamin', d.jenis_kelamin],
        ['Alamat', d.alamat],
        ['No. HP', d.no_hp],
        ['Email', d.email],
        ['Kecamatan', d.kecamatan],
        ['Cabang Lomba', d.cabang_lomba],
        ['Golongan', d.golongan],
        ['Status', d.status_verifikasi || 'Menunggu'],
        ['Tanggal Daftar', formatDate(d.timestamp)],
      ].map(([k,v]) => `
        <div class="row">
          <span class="key">${k}</span>
          <span class="val">${v || '-'}</span>
        </div>
      `).join('')}
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:16px">
      ${d.link_pas_foto ? `<a href="${d.link_pas_foto}" target="_blank" class="btn btn-sm btn-outline">📷 Pas Foto</a>` : ''}
      ${d.link_ktp_kk   ? `<a href="${d.link_ktp_kk}"   target="_blank" class="btn btn-sm btn-outline">🪪 KTP/KK</a>` : ''}
      ${d.link_rekomendasi ? `<a href="${d.link_rekomendasi}" target="_blank" class="btn btn-sm btn-outline">📄 Rekomendasi</a>` : ''}
    </div>
  `;

  document.getElementById('detailModal').classList.add('show');
}

function closeModal() {
  document.getElementById('detailModal').classList.remove('show');
}

// ── Print Card ────────────────────────────────
function printCard(nomorPendaftaran) {
  const d = allData.find(x => x.nomor_pendaftaran === nomorPendaftaran);
  if (!d) return;

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit:'mm', format:[86,54], orientation:'landscape' });

  // Card Background
  doc.setFillColor(6, 95, 70);
  doc.rect(0, 0, 86, 54, 'F');
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(3, 3, 80, 48, 3, 3, 'F');

  // Header strip
  doc.setFillColor(6, 95, 70);
  doc.rect(3, 3, 80, 14, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.text('MTQ 2026 - KARTU PESERTA', 43, 10, { align: 'center' });
  doc.setFontSize(5);
  doc.setFont('helvetica', 'normal');
  doc.text('Musabaqah Tilawatil Qur\'an', 43, 14, { align: 'center' });

  // Nomor
  doc.setTextColor(6, 95, 70);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text(d.nomor_pendaftaran, 43, 22, { align: 'center' });

  // Data
  doc.setFontSize(6);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(55, 65, 81);
  const lines = [
    ['Nama', d.nama_lengkap],
    ['Cabang', d.cabang_lomba],
    ['Golongan', d.golongan],
    ['Kecamatan', d.kecamatan],
  ];
  lines.forEach(([k, v], i) => {
    doc.setFont('helvetica', 'bold');
    doc.text(k + ':', 6, 28 + i*5);
    doc.setFont('helvetica', 'normal');
    doc.text(v || '-', 30, 28 + i*5);
  });

  // Gold bottom accent
  doc.setFillColor(245, 158, 11);
  doc.rect(3, 49, 80, 2, 'F');

  doc.save(`Kartu_${d.nomor_pendaftaran}.pdf`);
}

// ── Export Excel ──────────────────────────────
function exportExcel() {
  if (!window.XLSX) { showToast('Error', 'Library XLSX tidak tersedia.', 'error'); return; }
  
  const exportData = filteredData.map(d => ({
    'Nomor Pendaftaran': d.nomor_pendaftaran,
    'Nama Lengkap': d.nama_lengkap,
    'NIK': d.nik,
    'Tempat Lahir': d.tempat_lahir,
    'Tanggal Lahir': d.tanggal_lahir,
    'Umur': d.umur,
    'Jenis Kelamin': d.jenis_kelamin,
    'Alamat': d.alamat,
    'No HP': d.no_hp,
    'Email': d.email,
    'Kecamatan': d.kecamatan,
    'Cabang Lomba': d.cabang_lomba,
    'Golongan': d.golongan,
    'Status': d.status_verifikasi,
    'Tanggal Daftar': d.timestamp,
  }));

  const ws   = XLSX.utils.json_to_sheet(exportData);
  const wb   = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Pendaftar MTQ 2026');
  XLSX.writeFile(wb, `Data_Pendaftar_MTQ2026_${new Date().toISOString().slice(0,10)}.xlsx`);
  showToast('Berhasil', `${filteredData.length} data berhasil diexport.`, 'success');
}

// ── Sidebar ───────────────────────────────────
function initSidebar() {
  document.querySelectorAll('.sidebar-item').forEach(item => {
    item.addEventListener('click', () => {
      document.querySelectorAll('.sidebar-item').forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      const section = item.dataset.section;
      document.querySelectorAll('.admin-section').forEach(s => s.classList.add('hidden'));
      document.getElementById('section-' + section)?.classList.remove('hidden');
    });
  });

  // Mobile sidebar toggle
  document.getElementById('sidebarToggle')?.addEventListener('click', () => {
    document.querySelector('.admin-sidebar')?.classList.toggle('open');
  });
}

// ── Loading ───────────────────────────────────
function showLoading() { document.getElementById('loadingOverlay')?.classList.add('show'); }
function hideLoading()  { document.getElementById('loadingOverlay')?.classList.remove('show'); }

// ── Toast ─────────────────────────────────────
function showToast(title, msg, type = 'info', duration = 4000) {
  const icons = { success:'✅', error:'❌', warning:'⚠️', info:'ℹ️' };
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

function initNavbar() {
  const navbar = document.getElementById('navbar');
  window.addEventListener('scroll', () => navbar?.classList.toggle('scrolled', window.scrollY > 40));
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