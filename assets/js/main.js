/* ============================================================
   Heart Warriors - Main JavaScript
   ============================================================ */

const API_BASE = '/api';

/* ---------- Navbar ---------- */
const header = document.querySelector('.site-header');
const hamburger = document.querySelector('.hamburger');
const navMenu = document.querySelector('.nav-menu');

window.addEventListener('scroll', () => {
  if (header) header.classList.toggle('scrolled', window.scrollY > 50);
});

if (hamburger) {
  hamburger.addEventListener('click', () => {
    hamburger.classList.toggle('open');
    navMenu.classList.toggle('open');
  });
}

// Close nav on link click (mobile)
document.querySelectorAll('.nav-link').forEach(link => {
  link.addEventListener('click', () => {
    hamburger?.classList.remove('open');
    navMenu?.classList.remove('open');
  });
});

// Set active nav link
const currentPath = window.location.pathname.split('/').pop() || 'index.html';
document.querySelectorAll('.nav-link').forEach(link => {
  const href = link.getAttribute('href');
  if (href === currentPath || (currentPath === '' && href === 'index.html')) {
    link.classList.add('active');
  }
});

/* ---------- Scroll Animations ---------- */
const observerOptions = { threshold: 0.15, rootMargin: '0px 0px -50px 0px' };
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('aos-animate');
      observer.unobserve(entry.target);
    }
  });
}, observerOptions);

document.querySelectorAll('[data-aos]').forEach(el => observer.observe(el));

/* ---------- Counter Animation ---------- */
function animateCounter(el) {
  const target = parseInt(el.dataset.target || el.textContent.replace(/\D/g, ''));
  const suffix = el.dataset.suffix || '';
  const duration = 1800;
  const step = target / (duration / 16);
  let current = 0;
  const timer = setInterval(() => {
    current = Math.min(current + step, target);
    el.textContent = Math.floor(current).toLocaleString() + suffix;
    if (current >= target) clearInterval(timer);
  }, 16);
}

const counterObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      animateCounter(entry.target);
      counterObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.5 });

document.querySelectorAll('[data-counter]').forEach(el => counterObserver.observe(el));

/* ---------- Toast Notifications ---------- */
function showToast(message, type = 'info', duration = 4000) {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${icons[type] || icons.info}</span>
    <span class="toast-msg">${message}</span>
    <button class="toast-close" onclick="this.parentElement.remove()">✕</button>
  `;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), duration);
}

/* ---------- Contact Form ---------- */
const contactForm = document.getElementById('contactForm');
if (contactForm) {
  contactForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = contactForm.querySelector('[type="submit"]');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<span class="spinner" style="width:18px;height:18px;border-width:2px;display:inline-block;"></span> Sending...';
    btn.disabled = true;

    const data = {
      name: contactForm.name.value.trim(),
      email: contactForm.email.value.trim(),
      subject: contactForm.subject.value.trim(),
      message: contactForm.message.value.trim()
    };

    try {
      const res = await fetch(`${API_BASE}/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      const json = await res.json();
      if (res.ok) {
        showToast('Message sent! We\'ll get back to you soon.', 'success');
        contactForm.reset();
      } else {
        showToast(json.error || 'Failed to send message.', 'error');
      }
    } catch {
      showToast('Network error. Please try again.', 'error');
    } finally {
      btn.innerHTML = originalText;
      btn.disabled = false;
    }
  });
}

/* ---------- Load Latest Posts (Home) ---------- */
async function loadLatestPosts() {
  const container = document.getElementById('latestPosts');
  if (!container) return;

  try {
    const res = await fetch(`${API_BASE}/posts?limit=6&status=published`);
    const { data } = await res.json();
    if (!data || data.length === 0) {
      container.innerHTML = '<p class="text-muted text-center" style="padding:40px">No posts yet. Check back soon!</p>';
      return;
    }
    container.innerHTML = data.map((post, i) => `
      <article class="card ${i === 0 ? 'news-featured' : ''}" data-aos>
        <img class="card-img" src="${post.featured_image || 'assets/images/placeholder.jpg'}"
             alt="${post.title}" loading="lazy" onerror="this.src='assets/images/placeholder.jpg'">
        <div class="card-body">
          <span class="card-category">${post.category_name || 'News'}</span>
          <h3 class="card-title"><a href="news-single.html?id=${post.id}">${post.title}</a></h3>
          <p class="card-excerpt">${post.excerpt || ''}</p>
          <div class="card-meta">
            <span>📅 ${formatDate(post.published_at)}</span>
            <span>👁 ${post.views || 0} views</span>
          </div>
        </div>
      </article>
    `).join('');
    // Re-observe new elements
    container.querySelectorAll('[data-aos]').forEach(el => observer.observe(el));
  } catch {
    container.innerHTML = '<p class="text-muted text-center" style="padding:40px">Unable to load posts.</p>';
  }
}

/* ---------- Load Posts (News Page) ---------- */
async function loadNewsPosts(category = '', page = 1) {
  const container = document.getElementById('newsPosts');
  if (!container) return;

  container.innerHTML = '<div class="spinner" style="margin:60px auto"></div>';

  try {
    const params = new URLSearchParams({ status: 'published', page, limit: 9 });
    if (category) params.set('category', category);
    const res = await fetch(`${API_BASE}/posts?${params}`);
    const { data, total, pages } = await res.json();

    if (!data || data.length === 0) {
      container.innerHTML = '<p class="text-muted text-center" style="padding:60px">No posts in this category yet.</p>';
      return;
    }

    container.innerHTML = data.map(post => `
      <article class="card" data-aos>
        <img class="card-img" src="${post.featured_image || 'assets/images/placeholder.jpg'}"
             alt="${post.title}" loading="lazy" onerror="this.src='assets/images/placeholder.jpg'">
        <div class="card-body">
          <span class="card-category">${post.category_name || 'News'}</span>
          <h3 class="card-title"><a href="news-single.html?id=${post.id}">${post.title}</a></h3>
          <p class="card-excerpt">${post.excerpt || ''}</p>
          <div class="card-meta">
            <span>📅 ${formatDate(post.published_at)}</span>
            <span>👁 ${post.views || 0}</span>
          </div>
        </div>
      </article>
    `).join('');

    renderPagination(page, pages, (p) => loadNewsPosts(category, p));
    container.querySelectorAll('[data-aos]').forEach(el => observer.observe(el));
  } catch {
    container.innerHTML = '<p class="text-muted text-center" style="padding:60px">Unable to load posts.</p>';
  }
}

function renderPagination(current, total, callback) {
  const el = document.getElementById('pagination');
  if (!el || total <= 1) { if (el) el.innerHTML = ''; return; }
  let html = '';
  for (let i = 1; i <= total; i++) {
    html += `<button class="page-btn ${i === current ? 'active' : ''}" onclick="(${callback.toString()})(${i})">${i}</button>`;
  }
  el.innerHTML = html;
}

/* ---------- Gallery ---------- */
async function loadGallery(album = '') {
  const container = document.getElementById('galleryGrid');
  if (!container) return;

  container.innerHTML = '<div class="spinner" style="margin:60px auto;grid-column:1/-1"></div>';

  try {
    const params = new URLSearchParams({ limit: 20 });
    if (album) params.set('album', album);
    const res = await fetch(`${API_BASE}/gallery?${params}`);
    const { data } = await res.json();

    if (!data || data.length === 0) {
      container.innerHTML = '<p class="text-muted text-center" style="padding:60px;grid-column:1/-1">No media yet.</p>';
      return;
    }

    container.innerHTML = data.map((item, i) => `
      <div class="gallery-item ${i === 0 ? 'wide tall' : i === 3 ? 'wide' : ''}"
           onclick="openLightbox(${i})" data-index="${i}">
        <img src="${item.file_url}" alt="${item.title || ''}" loading="lazy">
        <div class="gallery-overlay">
          <span>${item.file_type === 'video' ? '▶ Video' : '🔍 ' + (item.title || 'View')}</span>
        </div>
      </div>
    `).join('');

    window._galleryItems = data;
  } catch {
    container.innerHTML = '<p class="text-muted text-center" style="padding:60px;grid-column:1/-1">Unable to load gallery.</p>';
  }
}

/* ---------- Lightbox ---------- */
let _lightboxIndex = 0;

function openLightbox(index) {
  const items = window._galleryItems || [];
  if (!items.length) return;
  _lightboxIndex = index;
  const lb = document.getElementById('lightbox');
  if (!lb) return;
  updateLightbox();
  lb.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function updateLightbox() {
  const items = window._galleryItems || [];
  const item = items[_lightboxIndex];
  if (!item) return;
  const img = document.getElementById('lightboxImg');
  const cap = document.getElementById('lightboxCaption');
  if (img) img.src = item.file_url;
  if (cap) cap.textContent = item.title || '';
}

function closeLightbox() {
  const lb = document.getElementById('lightbox');
  if (lb) lb.classList.remove('open');
  document.body.style.overflow = '';
}

function lightboxNav(dir) {
  const items = window._galleryItems || [];
  _lightboxIndex = (_lightboxIndex + dir + items.length) % items.length;
  updateLightbox();
}

document.addEventListener('keydown', (e) => {
  const lb = document.getElementById('lightbox');
  if (!lb?.classList.contains('open')) return;
  if (e.key === 'Escape') closeLightbox();
  if (e.key === 'ArrowLeft') lightboxNav(-1);
  if (e.key === 'ArrowRight') lightboxNav(1);
});

/* ---------- Helpers ---------- */
function formatDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
}

function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

/* ---------- Init ---------- */
document.addEventListener('DOMContentLoaded', () => {
  loadLatestPosts();
  loadNewsPosts();
  loadGallery();
});
