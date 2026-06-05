// ============================================
//  MTQ 2026 - Main JS (index.html)
// ============================================

// ── Config ──────────────────────────────────
const CONFIG = {
  // GANTI dengan URL Web App Google Apps Script kamu
  API_URL: 'https://script.google.com/macros/s/AKfycby6hfQkbiGEEYvSxZQ2-za0eg8CwmQ_N_X60cIe_Ilx1_7ApIk2EZPlDZMaOxPK6UW8/exec',
  EVENT_DATE: '2026-08-15T08:00:00',  // Tanggal pelaksanaan MTQ
  EVENT_LOCATION: 'GOR Singalodra Kabupaten Indramayu',
  EVENT_THEME: 'Dengan Al-Qur\'an Membangun Generasi Emas',
};

// ── On DOM Ready ─────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initNavbar();
  initDarkMode();
  initCountdown();
  initFAQ();
  initAnimations();
  loadStats();
  loadRegStatus();   // FIX #12 — status pendaftaran di beranda
  setEventInfo();
});

// ── Navbar ───────────────────────────────────
function initNavbar() {
  const navbar = document.getElementById('navbar');
  const hamburger = document.getElementById('hamburger');
  const mobileNav = document.getElementById('mobileNav');

  window.addEventListener('scroll', () => {
    navbar.classList.toggle('scrolled', window.scrollY > 40);
  });

  hamburger?.addEventListener('click', () => {
    mobileNav.classList.toggle('open');
  });

  // Close mobile nav on link click
  mobileNav?.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', () => mobileNav.classList.remove('open'));
  });

  // Active link highlight
  const sections = document.querySelectorAll('section[id]');
  const navLinks = document.querySelectorAll('.nav-links a, .mobile-nav a');
  window.addEventListener('scroll', () => {
    let current = '';
    sections.forEach(s => {
      if (window.scrollY >= s.offsetTop - 100) current = s.id;
    });
    navLinks.forEach(a => {
      a.classList.remove('active');
      if (a.getAttribute('href') === `#${current}`) a.classList.add('active');
    });
  });
}

// ── Dark Mode ────────────────────────────────
function initDarkMode() {
  const toggle = document.getElementById('darkToggle');
  const saved = localStorage.getItem('mtq-theme') || 'light';
  applyTheme(saved);

  toggle?.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    const next = current === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    localStorage.setItem('mtq-theme', next);
  });
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  const icon = document.querySelector('#darkToggle');
  if (icon) icon.textContent = theme === 'dark' ? '☀️' : '🌙';
}

// ── Countdown ────────────────────────────────
function initCountdown() {
  const target = new Date(CONFIG.EVENT_DATE).getTime();
  const els = {
    days: document.getElementById('cdDays'),
    hours: document.getElementById('cdHours'),
    mins: document.getElementById('cdMins'),
    secs: document.getElementById('cdSecs'),
  };

  function update() {
    const now = Date.now();
    const diff = target - now;
    if (diff <= 0) {
      document.getElementById('countdown-section')?.remove();
      return;
    }
    const d = Math.floor(diff / 86400000);
    const h = Math.floor((diff % 86400000) / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    if (els.days)  els.days.textContent  = String(d).padStart(2, '0');
    if (els.hours) els.hours.textContent = String(h).padStart(2, '0');
    if (els.mins)  els.mins.textContent  = String(m).padStart(2, '0');
    if (els.secs)  els.secs.textContent  = String(s).padStart(2, '0');
  }
  update();
  setInterval(update, 1000);
}

// ── Load Stats ───────────────────────────────
// Menggunakan JSONP agar tidak ada CORS error di console.
function loadStats() {
  const statEls = document.querySelectorAll('[data-stat]');
  if (!statEls.length) return;

  statEls.forEach(el => { el.textContent = '–'; });

  jsonp(`${CONFIG.API_URL}?action=getStats`, 'mtqStats', (data) => {
    if (data && data.success) {
      statEls.forEach(el => {
        const key = el.dataset.stat;
        if (data[key] !== undefined) animateCounter(el, Number(data[key]) || 0);
        else el.textContent = '0';
      });
    } else {
      statEls.forEach(el => { el.textContent = '0'; });
    }
  });
}

// ── FIX #12: Load Registration Status ────────
// Mengisi semua elemen [data-reg-status] di index.html
function loadRegStatus() {
  const statusEls  = document.querySelectorAll('[data-reg-status]');
  const btnDaftar  = document.querySelectorAll('.btn-daftar, [data-daftar-btn]');
  const statusText = document.getElementById('regStatusText');
  const statusBox  = document.getElementById('regStatusBox');

  // Fallback: baca dari MTQ_CONFIG jika ada
  const localBuka  = (typeof MTQ_CONFIG !== 'undefined' && MTQ_CONFIG.PENDAFTARAN_BUKA)  ? MTQ_CONFIG.PENDAFTARAN_BUKA  : null;
  const localTutup = (typeof MTQ_CONFIG !== 'undefined' && MTQ_CONFIG.PENDAFTARAN_TUTUP) ? MTQ_CONFIG.PENDAFTARAN_TUTUP : null;

  function applyStatus(isOpen, status, buka, tutup) {
    const bukaDate  = buka  ? new Date(buka).toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'})  : '—';
    const tutupDate = tutup ? new Date(tutup).toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'}) : '—';

    let badge = '', boxClass = '', msg = '';
    if (status === 'belum_buka') {
      badge    = `⏳ Pendaftaran Dibuka ${bukaDate}`;
      boxClass = 'status-belum-buka';
      msg      = `Pendaftaran akan dibuka pada <strong>${bukaDate}</strong>. Silakan pantau halaman ini.`;
    } else if (isOpen) {
      badge    = `✅ Pendaftaran Sedang Buka`;
      boxClass = 'status-buka';
      msg      = `Pendaftaran dibuka hingga <strong>${tutupDate}</strong>. Segera daftarkan peserta Anda!`;
    } else {
      badge    = `🔒 Pendaftaran Ditutup`;
      boxClass = 'status-tutup';
      msg      = `Pendaftaran telah ditutup pada ${tutupDate}. Hubungi panitia untuk informasi lebih lanjut.`;
    }

    // Update semua elemen [data-reg-status]
    statusEls.forEach(el => {
      el.innerHTML = badge;
      el.className = el.className.replace(/status-\S+/g, '') + ' ' + boxClass;
    });

    // Tombol daftar
    btnDaftar.forEach(btn => {
      if (!isOpen) { btn.classList.add('disabled'); btn.setAttribute('aria-disabled','true'); }
      else { btn.classList.remove('disabled'); btn.removeAttribute('aria-disabled'); }
    });

    // Box status (elemen dengan id regStatusBox)
    if (statusBox) {
      statusBox.innerHTML = msg;
      statusBox.className = `reg-status-box ${boxClass}`;
      statusBox.style.display = 'block';
    }

    // Text span (elemen dengan id regStatusText)
    if (statusText) statusText.innerHTML = badge;
  }

  // Set placeholder sementara
  statusEls.forEach(el => { el.textContent = ''; });
  if (statusBox) statusBox.style.display = 'none';

  // Coba ambil dari API via JSONP
  jsonp(`${CONFIG.API_URL}?action=getStats`, 'mtqRegStatus', (data) => {
    if (data && data.success) {
      applyStatus(data.isOpen, data.status, data.buka, data.tutup);
    } else {
      // Fallback ke perhitungan lokal dari config.js
      if (localBuka && localTutup) {
        const now   = new Date();
        const buka  = new Date(localBuka);
        const tutup = new Date(localTutup);
        const isOpen = now >= buka && now < tutup;
        const status = now < buka ? 'belum_buka' : isOpen ? 'buka' : 'tutup';
        applyStatus(isOpen, status, localBuka, localTutup);
      } else {
        statusEls.forEach(el => { el.textContent = 'ℹ️ Status tidak tersedia'; });
      }
    }
  });
}

/**
 * JSONP helper — bypass CORS tanpa console error
 * @param {string} url       - URL endpoint
 * @param {string} cbPrefix  - prefix nama callback global
 * @param {Function} fn      - callback(data)
 * @param {number} timeout   - ms sebelum dianggap gagal (default 8000)
 */
function jsonp(url, cbPrefix, fn, timeout = 8000) {
  const cbName = cbPrefix + '_' + Date.now();
  const script = document.createElement('script');
  let timer;

  window[cbName] = (data) => {
    clearTimeout(timer);
    try { fn(data); } catch(e) {}
    delete window[cbName];
    script.remove();
  };

  script.src = `${url}&callback=${cbName}`;
  script.onerror = () => {
    clearTimeout(timer);
    delete window[cbName];
    script.remove();
    // Gagal silently — tampilkan 0
    document.querySelectorAll('[data-stat]').forEach(el => { el.textContent = '0'; });
  };

  timer = setTimeout(() => {
    delete window[cbName];
    script.remove();
    document.querySelectorAll('[data-stat]').forEach(el => { el.textContent = '0'; });
  }, timeout);

  document.head.appendChild(script);
}

function animateCounter(el, target) {
  const duration = 1500;
  const start = performance.now();
  const startVal = 0;
  function step(now) {
    const elapsed = now - start;
    const progress = Math.min(elapsed / duration, 1);
    const ease = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.round(startVal + (target - startVal) * ease);
    if (progress < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

// ── Set Event Info ───────────────────────────
function setEventInfo() {
  const locEls = document.querySelectorAll('[data-info="location"]');
  const themeEls = document.querySelectorAll('[data-info="theme"]');
  const dateEls = document.querySelectorAll('[data-info="date"]');

  const dateStr = new Date(CONFIG.EVENT_DATE).toLocaleDateString('id-ID', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });

  locEls.forEach(el => { el.textContent = CONFIG.EVENT_LOCATION; });
  themeEls.forEach(el => { el.textContent = CONFIG.EVENT_THEME; });
  dateEls.forEach(el => { el.textContent = dateStr; });
}

// ── FAQ ──────────────────────────────────────
function initFAQ() {
  document.querySelectorAll('.faq-item').forEach(item => {
    item.querySelector('.faq-question').addEventListener('click', () => {
      const isOpen = item.classList.contains('open');
      document.querySelectorAll('.faq-item').forEach(i => i.classList.remove('open'));
      if (!isOpen) item.classList.add('open');
    });
  });
}

// ── Scroll Animations ────────────────────────
function initAnimations() {
  const obs = new IntersectionObserver((entries) => {
    entries.forEach((e, i) => {
      if (e.isIntersecting) {
        e.target.style.transitionDelay = `${i * 0.08}s`;
        e.target.classList.add('visible');
        obs.unobserve(e.target);
      }
    });
  }, { threshold: 0.12 });

  document.querySelectorAll('.animate-in').forEach(el => obs.observe(el));
}

// ── Toast ─────────────────────────────────────
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
    <button class="toast-close" onclick="removeToast(this.parentElement)">✕</button>
  `;
  container.appendChild(toast);

  setTimeout(() => removeToast(toast), duration);
}

function removeToast(toast) {
  if (!toast || !toast.parentElement) return;
  toast.classList.add('removing');
  setTimeout(() => toast.remove(), 250);
}