/* ============================================================
   Heart Warriors - Main JavaScript
   ============================================================ */

const API_BASE = '/api';

/* ---------- Mobile Menu Enhancement ---------- */
const header = document.querySelector('.site-header');
const hamburger = document.querySelector('.hamburger');
const navMenu = document.querySelector('.nav-menu');

// Create overlay for mobile menu
const navOverlay = document.createElement('div');
navOverlay.className = 'nav-overlay';
document.body.appendChild(navOverlay);

window.addEventListener('scroll', () => {
  if (header) header.classList.toggle('scrolled', window.scrollY > 50);
});

if (hamburger) {
  hamburger.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = hamburger.classList.toggle('active');
    navMenu.classList.toggle('open');
    navOverlay.classList.toggle('active');
    document.body.style.overflow = isOpen ? 'hidden' : '';
  });
}

// Close menu when clicking overlay
navOverlay.addEventListener('click', () => {
  hamburger?.classList.remove('active');
  navMenu?.classList.remove('open');
  navOverlay.classList.remove('active');
  document.body.style.overflow = '';
});

// Close nav on link click (mobile)
document.querySelectorAll('.nav-link').forEach(link => {
  link.addEventListener('click', () => {
    hamburger?.classList.remove('active');
    navMenu?.classList.remove('open');
    navOverlay.classList.remove('active');
    document.body.style.overflow = '';
  });
});

// Close menu on escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && navMenu?.classList.contains('open')) {
    hamburger?.classList.remove('active');
    navMenu?.classList.remove('open');
    navOverlay.classList.remove('active');
    document.body.style.overflow = '';
  }
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
        <img class="card-img" src="${escHtml(post.featured_image || 'assets/images/placeholder.jpg')}"
             alt="${escHtml(post.title)}" loading="lazy" onerror="this.src='assets/images/placeholder.jpg'">
        <div class="card-body">
          <span class="card-category">${escHtml(post.category_name || 'News')}</span>
          <h3 class="card-title"><a href="news-single.html?id=${escHtml(post.id)}">${escHtml(post.title)}</a></h3>
          <p class="card-excerpt">${escHtml(post.excerpt || '')}</p>
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
        <img class="card-img" src="${escHtml(post.featured_image || 'assets/images/placeholder.jpg')}"
             alt="${escHtml(post.title)}" loading="lazy" onerror="this.src='assets/images/placeholder.jpg'">
        <div class="card-body">
          <span class="card-category">${escHtml(post.category_name || 'News')}</span>
          <h3 class="card-title"><a href="news-single.html?id=${escHtml(post.id)}">${escHtml(post.title)}</a></h3>
          <p class="card-excerpt">${escHtml(post.excerpt || '')}</p>
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
async function loadHomeGallery() {
  const container = document.getElementById('galleryGrid');
  const section = document.getElementById('homeGallerySection');
  if (!container || !section) return;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(`${API_BASE}/gallery?limit=5`, { signal: controller.signal });
    clearTimeout(timeout);
    const { data } = await res.json();
    if (!data || data.length === 0) { section.style.display = 'none'; return; }
    container.innerHTML = data.map((item, i) => `
      <div class="gallery-item" onclick="openLightbox(${i})" data-index="${i}">
        ${item.file_type === 'video'
          ? `<video src="${item.file_url}" muted playsinline preload="auto" loop
               style="width:100%;height:100%;object-fit:cover;display:block"
               data-video></video>
             <div class="vid-play-badge" style="position:absolute;top:8px;left:8px;background:rgba(0,0,0,.6);color:#fff;font-size:.7rem;padding:3px 8px;border-radius:4px;pointer-events:none">&#9654; Video</div>`
          : `<img src="${item.file_url}" alt="${item.title || ''}" loading="eager" decoding="async" crossorigin="anonymous" onerror="this.style.opacity='0.3'">`
        }
        <div class="gallery-overlay">
          <span>${item.file_type === 'video' ? '&#9654; Play' : '&#128269; ' + (item.title || 'View')}</span>
        </div>
      </div>
    `).join('');
    window._galleryItems = data;

    // Hover-to-play — attach after DOM is ready
    requestAnimationFrame(() => {
      container.querySelectorAll('[data-video]').forEach(vid => {
        const item = vid.closest('.gallery-item');
        const badge = item.querySelector('.vid-play-badge');
        // Load the video
        vid.load();
        item.addEventListener('mouseenter', () => {
          const playPromise = vid.play();
          if (playPromise !== undefined) {
            playPromise.catch(() => {
              // Autoplay blocked — show play icon instead
            });
          }
          if (badge) badge.style.display = 'none';
        });
        item.addEventListener('mouseleave', () => {
          vid.pause();
          vid.currentTime = 0;
          if (badge) badge.style.display = 'block';
        });
      });
    });

    // Also start hero slideshow with these photos
    startHeroSlideshow(data.map(d => d.file_url));  } catch {
    section.style.display = 'none';
  }
}

function startHeroSlideshow(urls) {
  // no-op
}

async function startHeroSlideshowFromAPI() {
  // no-op
}

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
        ${item.file_type === 'video'
          ? `<video src="${item.file_url}" muted playsinline preload="auto" loop
               style="width:100%;height:100%;object-fit:cover;display:block"
               data-video></video>
             <div class="vid-play-badge" style="position:absolute;top:8px;left:8px;background:rgba(0,0,0,.6);color:#fff;font-size:.7rem;padding:3px 8px;border-radius:4px;pointer-events:none">&#9654; Video</div>`
          : `<img src="${item.file_url}" alt="${item.title || ''}" loading="eager" decoding="async" crossorigin="anonymous" onerror="this.style.opacity='0.3'">`
        }
        <div class="gallery-overlay">
          <span>${item.file_type === 'video' ? '&#9654; Play' : '&#128269; ' + (item.title || 'View')}</span>
        </div>
      </div>
    `).join('');

    window._galleryItems = data;

    // Hover-to-play — attach after DOM is ready
    requestAnimationFrame(() => {
      container.querySelectorAll('[data-video]').forEach(vid => {
        const item = vid.closest('.gallery-item');
        const badge = item.querySelector('.vid-play-badge');
        vid.load();
        item.addEventListener('mouseenter', () => {
          const playPromise = vid.play();
          if (playPromise !== undefined) playPromise.catch(() => {});
          if (badge) badge.style.display = 'none';
        });
        item.addEventListener('mouseleave', () => {
          vid.pause();
          vid.currentTime = 0;
          if (badge) badge.style.display = 'block';
        });
      });
    });
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
  const cap = document.getElementById('lightboxCaption');
  const inner = document.querySelector('.lightbox-inner');
  if (!inner) return;

  const oldImg = document.getElementById('lightboxImg');
  const oldVid = document.getElementById('lightboxVid');
  if (oldImg) oldImg.remove();
  if (oldVid) oldVid.remove();

  if (item.file_type === 'video') {
    const vid = document.createElement('video');
    vid.id = 'lightboxVid';
    vid.src = item.file_url;
    vid.controls = true;
    vid.autoplay = true;
    vid.style.cssText = 'max-width:90vw;max-height:80vh;border-radius:8px;';
    inner.insertBefore(vid, cap);
  } else {
    const img = document.createElement('img');
    img.id = 'lightboxImg';
    img.src = item.file_url;
    img.alt = item.title || 'Gallery image';
    inner.insertBefore(img, cap);
  }

  if (cap) cap.textContent = item.title || '';
}

function closeLightbox() {
  const lb = document.getElementById('lightbox');
  if (lb) lb.classList.remove('open');
  const vid = document.getElementById('lightboxVid');
  if (vid) { vid.pause(); vid.src = ''; }
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

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* ---------- Init ---------- */
document.addEventListener('DOMContentLoaded', () => {
  const page = window.location.pathname.split('/').pop() || 'index.html';
  if (page === 'index.html' || page === '') { loadLatestPosts(); loadHomeGallery(); }
  if (page === 'news.html') loadNewsPosts();
  if (page === 'gallery.html') loadGallery();

  // Hero card slideshow
  if (document.getElementById('slide-0')) {
    let _heroSlide = 0;
    const _heroTotal = 4;
    function goToSlide(n) {
      document.getElementById('slide-' + _heroSlide)?.classList.remove('active');
      document.querySelectorAll('.hero-dot')[_heroSlide]?.classList.remove('active');
      _heroSlide = n;
      document.getElementById('slide-' + _heroSlide)?.classList.add('active');
      document.querySelectorAll('.hero-dot')[_heroSlide]?.classList.add('active');
    }
    window.goToSlide = goToSlide; // expose for onclick
    setInterval(() => goToSlide((_heroSlide + 1) % _heroTotal), 4000);
  }
});

/* ============================================================
   Enhanced Animations
   ============================================================ */

// Scroll progress bar
const progressBar = document.createElement('div');
progressBar.className = 'scroll-progress';
document.body.prepend(progressBar);
window.addEventListener('scroll', () => {
  const pct = (window.scrollY / (document.body.scrollHeight - window.innerHeight)) * 100;
  progressBar.style.width = Math.min(pct, 100) + '%';
}, { passive: true });

// Cover banner reveal on scroll
const coverBanner = document.querySelector('.cover-banner-wrap');
if (coverBanner) {
  const bannerObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('revealed');
        bannerObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });
  bannerObserver.observe(coverBanner);
}

// Stagger children observer
document.querySelectorAll('.stagger-children').forEach(el => {
  const staggerObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('revealed');
        staggerObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });
  staggerObserver.observe(el);
});

// Lazy image fade-in
document.querySelectorAll('img[loading="lazy"]').forEach(img => {
  if (img.complete) {
    img.classList.add('loaded');
  } else {
    img.addEventListener('load', () => img.classList.add('loaded'));
  }
});

// Page load class (triggers header slide-down)
window.addEventListener('load', () => {
  document.body.classList.add('page-loaded');
});

// Stat number pulse on count-up finish
document.querySelectorAll('[data-counter]').forEach(el => {
  const orig = animateCounter;
  // Pulse the number when it finishes
  const pulsePatch = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        setTimeout(() => {
          entry.target.classList.add('pulse');
          setTimeout(() => entry.target.classList.remove('pulse'), 200);
        }, 1800);
        pulsePatch.unobserve(entry.target);
      }
    });
  }, { threshold: 0.5 });
  pulsePatch.observe(el);
});

/* ============================================================
   Back to Top Button
   ============================================================ */
const backToTopBtn = document.createElement('button');
backToTopBtn.className = 'back-to-top';
backToTopBtn.innerHTML = '↑';
backToTopBtn.setAttribute('aria-label', 'Back to top');
backToTopBtn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
document.body.appendChild(backToTopBtn);

window.addEventListener('scroll', () => {
  backToTopBtn.classList.toggle('visible', window.scrollY > 400);
}, { passive: true });

/* Floating Action Buttons removed */

/* ============================================================
   Cookie / Privacy Banner
   ============================================================ */
if (!localStorage.getItem('hw_cookie_consent')) {
  const banner = document.createElement('div');
  banner.className = 'cookie-banner';
  banner.innerHTML = `
    <p>
      This website uses cookies to improve your experience and comply with the
      <strong>Data Privacy Act of 2012</strong>.
      <a href="#" onclick="return false">Learn more</a>
    </p>
    <div class="cookie-btns">
      <button class="cookie-decline" onclick="dismissCookie()">Decline</button>
      <button class="cookie-accept" onclick="acceptCookie()">Accept</button>
    </div>
  `;
  document.body.appendChild(banner);
  setTimeout(() => banner.classList.add('show'), 1500);
}

function acceptCookie() {
  localStorage.setItem('hw_cookie_consent', 'accepted');
  document.querySelector('.cookie-banner')?.remove();
}
function dismissCookie() {
  localStorage.setItem('hw_cookie_consent', 'declined');
  document.querySelector('.cookie-banner')?.remove();
}

/* ============================================================
   Daily Bible Verse (injected into footer)
   ============================================================ */
const BIBLE_VERSES = [
  { text: "For I know the plans I have for you, declares the Lord, plans to prosper you and not to harm you, plans to give you hope and a future.", ref: "Jeremiah 29:11" },
  { text: "He heals the brokenhearted and binds up their wounds.", ref: "Psalm 147:3" },
  { text: "The Lord is my shepherd; I shall not want.", ref: "Psalm 23:1" },
  { text: "I can do all things through Christ who strengthens me.", ref: "Philippians 4:13" },
  { text: "Cast all your anxiety on him because he cares for you.", ref: "1 Peter 5:7" },
  { text: "Be strong and courageous. Do not be afraid; do not be discouraged, for the Lord your God will be with you wherever you go.", ref: "Joshua 1:9" },
  { text: "The Lord is close to the brokenhearted and saves those who are crushed in spirit.", ref: "Psalm 34:18" },
  { text: "Come to me, all you who are weary and burdened, and I will give you rest.", ref: "Matthew 11:28" },
  { text: "Trust in the Lord with all your heart and lean not on your own understanding.", ref: "Proverbs 3:5" },
  { text: "And we know that in all things God works for the good of those who love him.", ref: "Romans 8:28" },
  { text: "The Lord will fight for you; you need only to be still.", ref: "Exodus 14:14" },
  { text: "Do not be anxious about anything, but in every situation, by prayer and petition, with thanksgiving, present your requests to God.", ref: "Philippians 4:6" },
  { text: "Even though I walk through the darkest valley, I will fear no evil, for you are with me.", ref: "Psalm 23:4" },
  { text: "But those who hope in the Lord will renew their strength. They will soar on wings like eagles.", ref: "Isaiah 40:31" },
  { text: "For God so loved the world that he gave his one and only Son, that whoever believes in him shall not perish but have eternal life.", ref: "John 3:16" },
  { text: "The name of the Lord is a fortified tower; the righteous run to it and are safe.", ref: "Proverbs 18:10" },
  { text: "Give thanks to the Lord, for he is good; his love endures forever.", ref: "Psalm 107:1" },
  { text: "Blessed are the merciful, for they will be shown mercy.", ref: "Matthew 5:7" },
  { text: "Love your neighbor as yourself.", ref: "Mark 12:31" },
  { text: "The Lord bless you and keep you; the Lord make his face shine on you and be gracious to you.", ref: "Numbers 6:24-25" },
  { text: "Rejoice always, pray continually, give thanks in all circumstances.", ref: "1 Thessalonians 5:16-18" },
  { text: "A cheerful heart is good medicine, but a crushed spirit dries up the bones.", ref: "Proverbs 17:22" },
  { text: "He gives strength to the weary and increases the power of the weak.", ref: "Isaiah 40:29" },
  { text: "The Lord is my light and my salvation — whom shall I fear?", ref: "Psalm 27:1" },
  { text: "For it is by grace you have been saved, through faith — and this is not from yourselves, it is the gift of God.", ref: "Ephesians 2:8" },
  { text: "Let your light shine before others, that they may see your good deeds and glorify your Father in heaven.", ref: "Matthew 5:16" },
  { text: "Whoever is kind to the poor lends to the Lord, and he will reward them for what they have done.", ref: "Proverbs 19:17" },
  { text: "The Lord is my strength and my shield; my heart trusts in him, and he helps me.", ref: "Psalm 28:7" },
  { text: "Peace I leave with you; my peace I give you. Do not let your hearts be troubled.", ref: "John 14:27" },
  { text: "And now these three remain: faith, hope and love. But the greatest of these is love.", ref: "1 Corinthians 13:13" },
  { text: "Delight yourself in the Lord, and he will give you the desires of your heart.", ref: "Psalm 37:4" }
];

function getDailyVerse() {
  const dayOfYear = Math.floor((new Date() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
  return BIBLE_VERSES[dayOfYear % BIBLE_VERSES.length];
}

const footer = document.querySelector('.site-footer');
if (footer) {
  const verse = getDailyVerse();
  const verseStrip = document.createElement('div');
  verseStrip.className = 'bible-verse-strip';
  verseStrip.innerHTML = `
    <p class="verse-text">"${verse.text}"</p>
    <p class="verse-ref">— ${verse.ref}</p>
  `;
  footer.insertBefore(verseStrip, footer.firstChild);
}

/* ============================================================
   News Search
   ============================================================ */
const newsSearchInput = document.getElementById('newsSearchInput');
if (newsSearchInput) {
  let searchTimer;
  newsSearchInput.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      const q = newsSearchInput.value.trim().toLowerCase();
      const cards = document.querySelectorAll('#newsPosts .card');
      cards.forEach(card => {
        const text = card.textContent.toLowerCase();
        card.style.display = text.includes(q) ? '' : 'none';
      });
    }, 300);
  });
}

/* ============================================================
   PWA Service Worker Registration
   ============================================================ */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

/* ============================================================
   PWA Install Prompt (Add to Home Screen)
   ============================================================ */
let _pwaInstallPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  _pwaInstallPrompt = e;

  // Only show if not already installed and not dismissed recently
  const dismissed = localStorage.getItem('pwa_dismissed');
  if (dismissed && Date.now() - parseInt(dismissed) < 7 * 24 * 60 * 60 * 1000) return;

  // Show banner after 3 seconds
  setTimeout(() => {
    if (!_pwaInstallPrompt) return;
    const banner = document.createElement('div');
    banner.id = 'pwa-banner';
    banner.style.cssText = `
      position:fixed;bottom:80px;left:50%;transform:translateX(-50%);
      background:#fff;border-radius:16px;padding:16px 20px;
      box-shadow:0 8px 32px rgba(0,0,0,.18);z-index:9999;
      display:flex;align-items:center;gap:14px;max-width:340px;width:90%;
      border:2px solid var(--red-pale,#fdecea);
      animation:slideUp .4s ease;
    `;
    banner.innerHTML = `
      <style>@keyframes slideUp{from{opacity:0;transform:translateX(-50%) translateY(20px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}</style>
      <img src="/assets/images/logo.png" style="width:48px;height:48px;border-radius:50%;object-fit:cover;flex-shrink:0" alt="App icon">
      <div style="flex:1;min-width:0">
        <div style="font-weight:700;font-size:.9rem;color:#1a1a1a">Install App</div>
        <div style="font-size:.78rem;color:#666;margin-top:2px">Add to your home screen for quick access</div>
      </div>
      <div style="display:flex;flex-direction:column;gap:6px;flex-shrink:0">
        <button id="pwa-install-btn" style="background:var(--red-main,#c0392b);color:#fff;border:none;border-radius:8px;padding:6px 14px;font-size:.8rem;font-weight:700;cursor:pointer">Install</button>
        <button id="pwa-dismiss-btn" style="background:none;border:none;color:#999;font-size:.75rem;cursor:pointer;padding:2px">Not now</button>
      </div>
    `;
    document.body.appendChild(banner);

    document.getElementById('pwa-install-btn').addEventListener('click', async () => {
      banner.remove();
      if (_pwaInstallPrompt) {
        _pwaInstallPrompt.prompt();
        const { outcome } = await _pwaInstallPrompt.userChoice;
        _pwaInstallPrompt = null;
        if (outcome === 'accepted') localStorage.setItem('pwa_dismissed', Date.now());
      }
    });

    document.getElementById('pwa-dismiss-btn').addEventListener('click', () => {
      banner.remove();
      localStorage.setItem('pwa_dismissed', Date.now());
    });

    // Auto-hide after 10 seconds
    setTimeout(() => banner?.remove(), 10000);
  }, 3000);
});

// Hide banner if app is already installed
window.addEventListener('appinstalled', () => {
  document.getElementById('pwa-banner')?.remove();
  _pwaInstallPrompt = null;
});

/* ============================================================
   Digital Clock
   ============================================================ */
function updateClock() {
  const now = new Date();
  const timeEl = document.getElementById('clockTime');
  const dateEl = document.getElementById('clockDate');
  if (!timeEl) return;

  // Time: 12-hour format with AM/PM
  let h = now.getHours();
  const m = String(now.getMinutes()).padStart(2, '0');
  const s = String(now.getSeconds()).padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  timeEl.textContent = `${String(h).padStart(2,'0')}:${m}:${s} ${ampm}`;

  // Date: Mon, Jan 01, 2026
  const days   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  dateEl.textContent = `${days[now.getDay()]}, ${months[now.getMonth()]} ${String(now.getDate()).padStart(2,'0')}, ${now.getFullYear()}`;
}

document.addEventListener('DOMContentLoaded', () => {
  updateClock();
  setInterval(updateClock, 1000);
});

/* ============================================================
   Dark Mode Toggle
   ============================================================ */
const DARK_KEY = 'hw_dark_mode';

function applyDarkMode(dark) {
  document.body.classList.toggle('dark-mode', dark);
  const btn = document.getElementById('darkModeToggle');
  if (btn) btn.textContent = dark ? '☀️' : '🌙';
  if (btn) btn.title = dark ? 'Switch to light mode' : 'Switch to dark mode';
}

// Apply saved preference immediately (before paint to avoid flash)
const savedDark = localStorage.getItem(DARK_KEY) === 'true';
applyDarkMode(savedDark);

document.addEventListener('DOMContentLoaded', () => {
  const toggle = document.getElementById('darkModeToggle');
  if (toggle) {
    toggle.addEventListener('click', () => {
      const isDark = document.body.classList.toggle('dark-mode');
      localStorage.setItem(DARK_KEY, isDark);
      toggle.textContent = isDark ? '☀️' : '🌙';
      toggle.title = isDark ? 'Switch to light mode' : 'Switch to dark mode';
    });
  }
});


/* ============================================================
   Mobile Enhancements
   ============================================================ */

// Prevent accidental card clicks while scrolling on mobile
let _touchStartY = 0;
let _touchStartX = 0;
let _didScroll = false;

document.addEventListener('touchstart', (e) => {
  _touchStartY = e.touches[0].clientY;
  _touchStartX = e.touches[0].clientX;
  _didScroll = false;
}, { passive: true });

document.addEventListener('touchmove', (e) => {
  const dy = Math.abs(e.touches[0].clientY - _touchStartY);
  const dx = Math.abs(e.touches[0].clientX - _touchStartX);
  if (dy > 8 || dx > 8) _didScroll = true;
}, { passive: true });

document.addEventListener('click', (e) => {
  if (_didScroll) {
    const link = e.target.closest('a');
    if (link && link.href && !link.href.startsWith('#') && !link.href.includes('mailto')) {
      e.preventDefault();
      e.stopPropagation();
    }
  }
}, true);
document.addEventListener('touchend', (e) => {
  if (e.target.matches('button, .btn, .filter-btn, .nav-link')) {
    e.preventDefault();
    e.target.click();
  }
}, { passive: false });

// Smooth scroll for anchor links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function (e) {
    const href = this.getAttribute('href');
    if (href === '#') return;
    e.preventDefault();
    const target = document.querySelector(href);
    if (target) {
      const offset = 80; // Account for sticky header
      const targetPosition = target.offsetTop - offset;
      window.scrollTo({ top: targetPosition, behavior: 'smooth' });
    }
  });
});

// Add touch feedback class
document.addEventListener('touchstart', (e) => {
  if (e.target.matches('.btn, .card, .filter-btn')) {
    e.target.classList.add('touching');
  }
}, { passive: true });

document.addEventListener('touchend', (e) => {
  if (e.target.matches('.btn, .card, .filter-btn')) {
    setTimeout(() => e.target.classList.remove('touching'), 150);
  }
}, { passive: true });

// Optimize images for mobile
if ('IntersectionObserver' in window) {
  const imageObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const img = entry.target;
        if (img.dataset.src) {
          img.src = img.dataset.src;
          img.removeAttribute('data-src');
        }
        imageObserver.unobserve(img);
      }
    });
  }, { rootMargin: '50px' });

  document.querySelectorAll('img[data-src]').forEach(img => imageObserver.observe(img));
}

// Handle orientation change
window.addEventListener('orientationchange', () => {
  // Close mobile menu on orientation change
  hamburger?.classList.remove('active');
  navMenu?.classList.remove('open');
  navOverlay.classList.remove('active');
  document.body.style.overflow = '';
});

// Improve form input experience on mobile
document.querySelectorAll('input, textarea').forEach(input => {
  // Prevent zoom on focus for iOS
  input.addEventListener('focus', () => {
    if (window.innerWidth < 768) {
      const viewport = document.querySelector('meta[name=viewport]');
      if (viewport) {
        viewport.setAttribute('content', 'width=device-width, initial-scale=1, maximum-scale=1');
      }
    }
  });
  
  input.addEventListener('blur', () => {
    if (window.innerWidth < 768) {
      const viewport = document.querySelector('meta[name=viewport]');
      if (viewport) {
        viewport.setAttribute('content', 'width=device-width, initial-scale=1');
      }
    }
  });
});

// Add pull-to-refresh indicator (visual feedback only)
let touchStartY = 0;
let touchEndY = 0;

document.addEventListener('touchstart', (e) => {
  touchStartY = e.touches[0].clientY;
}, { passive: true });

document.addEventListener('touchmove', (e) => {
  touchEndY = e.touches[0].clientY;
  const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
  
  // If at top of page and pulling down
  if (scrollTop === 0 && touchEndY > touchStartY + 50) {
    // Visual feedback could be added here
  }
}, { passive: true });

// Optimize scroll performance
let ticking = false;
let lastScrollY = window.scrollY;

window.addEventListener('scroll', () => {
  lastScrollY = window.scrollY;
  if (!ticking) {
    window.requestAnimationFrame(() => {
      // Scroll-based animations or effects
      ticking = false;
    });
    ticking = true;
  }
}, { passive: true });

// Add swipe gesture support for gallery/lightbox
let touchstartX = 0;
let touchendX = 0;

function handleSwipe(element, leftCallback, rightCallback) {
  element.addEventListener('touchstart', (e) => {
    touchstartX = e.changedTouches[0].screenX;
  }, { passive: true });

  element.addEventListener('touchend', (e) => {
    touchendX = e.changedTouches[0].screenX;
    const diff = touchstartX - touchendX;
    
    if (Math.abs(diff) > 50) { // Minimum swipe distance
      if (diff > 0 && rightCallback) {
        rightCallback(); // Swiped left
      } else if (diff < 0 && leftCallback) {
        leftCallback(); // Swiped right
      }
    }
  }, { passive: true });
}

// Apply swipe to lightbox if it exists
const lightbox = document.getElementById('lightbox');
if (lightbox) {
  handleSwipe(
    lightbox,
    () => window.lightboxNav && lightboxNav(-1), // Swipe right = previous
    () => window.lightboxNav && lightboxNav(1)   // Swipe left = next
  );
}

// Detect if user is on mobile device
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
if (isMobile) {
  document.body.classList.add('is-mobile');
}

// Detect if user is on iOS
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
if (isIOS) {
  document.body.classList.add('is-ios');
}

// Add safe area insets for notched devices
if (isIOS && window.CSS && CSS.supports('padding-top: env(safe-area-inset-top)')) {
  document.documentElement.style.setProperty('--safe-area-top', 'env(safe-area-inset-top)');
  document.documentElement.style.setProperty('--safe-area-bottom', 'env(safe-area-inset-bottom)');
}

console.log('✅ Mobile enhancements loaded');
