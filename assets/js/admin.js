/* ============================================================
   Heart Warriors - Admin Panel JavaScript
   ============================================================ */

const API = '/api';

/* ---------- Auth ---------- */
function getToken() { return localStorage.getItem('hw_admin_token'); }
function getAdmin() { try { return JSON.parse(localStorage.getItem('hw_admin_user')); } catch { return null; } }

function requireAuth() {
  if (!getToken()) { window.location.href = '/admin/index.html'; return false; }
  const admin = getAdmin();
  if (admin) {
    document.querySelectorAll('.admin-name').forEach(el => el.textContent = admin.name);
    document.querySelectorAll('.admin-role').forEach(el => el.textContent = admin.role);
    document.querySelectorAll('.admin-avatar-initials').forEach(el => {
      el.textContent = admin.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    });
  }
  return true;
}

function logout() {
  localStorage.removeItem('hw_admin_token');
  localStorage.removeItem('hw_admin_user');
  window.location.href = '/admin/index.html';
}

/* ---------- API Helper ---------- */
async function apiFetch(path, options = {}) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (options.body instanceof FormData) delete headers['Content-Type'];

  const res = await fetch(`${API}${path}`, { ...options, headers });
  if (res.status === 413) throw new Error('File too large. Please use a smaller file (max ~4MB for videos on this plan).');
  const json = await res.json().catch(() => ({ error: `Server error (HTTP ${res.status})` }));
  if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
  return json;
}

/* ---------- Toast ---------- */
function toast(msg, type = 'info') {
  let c = document.querySelector('.toast-container');
  if (!c) { c = document.createElement('div'); c.className = 'toast-container'; document.body.appendChild(c); }
  const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.innerHTML = `<span class="toast-icon">${icons[type]}</span><span class="toast-msg">${msg}</span><button class="toast-close" onclick="this.parentElement.remove()">✕</button>`;
  c.appendChild(t);
  setTimeout(() => t.remove(), 4000);
}

/* ---------- Login ---------- */
const loginForm = document.getElementById('loginForm');
if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = loginForm.querySelector('[type="submit"]');
    const errEl = document.getElementById('loginError');
    btn.disabled = true;
    btn.textContent = 'Signing in...';
    if (errEl) errEl.style.display = 'none';

    try {
      const data = await apiFetch('/auth?action=login', {
        method: 'POST',
        body: JSON.stringify({
          email: loginForm.email.value.trim(),
          password: loginForm.password.value
        })
      });
      localStorage.setItem('hw_admin_token', data.token);
      localStorage.setItem('hw_admin_user', JSON.stringify(data.admin));
      window.location.href = '/admin/dashboard.html';
    } catch (err) {
      if (errEl) { errEl.textContent = err.message; errEl.style.display = 'block'; }
      btn.disabled = false;
      btn.textContent = 'Sign In';
    }
  });
}

/* ---------- Dashboard Stats ---------- */
async function loadDashboardStats() {
  try {
    const data = await apiFetch('/stats');
    const map = {
      statPosts: data.posts,
      statGallery: data.gallery,
      statMessages: data.messages,
      statViews: data.views
    };
    Object.entries(map).forEach(([id, val]) => {
      const el = document.getElementById(id);
      if (el) el.textContent = (val || 0).toLocaleString();
    });
  } catch { /* silent */ }
}

/* ---------- Posts Management ---------- */
let postsPage = 1;
let postsFilter = '';

async function loadPosts(page = 1, status = '') {
  const tbody = document.getElementById('postsTableBody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:30px"><div class="spinner" style="margin:0 auto"></div></td></tr>';

  try {
    const params = new URLSearchParams({ page, limit: 10 });
    if (status) params.set('status', status);
    const { data, total } = await apiFetch(`/posts?${params}`);

    if (!data?.length) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:30px;color:#6b7280">No posts found.</td></tr>';
      return;
    }

    tbody.innerHTML = data.map(p => `
      <tr>
        <td>
          <img class="table-img" src="${p.featured_image || '../assets/images/placeholder.jpg'}"
               alt="" onerror="this.src='../assets/images/placeholder.jpg'">
        </td>
        <td>
          <div class="table-title">${escHtml(p.title)}</div>
          <div class="table-sub">${p.category_name || '—'}</div>
        </td>
        <td><span class="badge badge-${p.status}">${p.status}</span></td>
        <td>${formatDate(p.published_at || p.created_at)}</td>
        <td>${(p.views || 0).toLocaleString()}</td>
        <td>
          <div style="display:flex;gap:6px">
            <button class="btn-admin btn-admin-secondary btn-icon" title="Edit" onclick="editPost('${p.id}')">✏️</button>
            <button class="btn-admin btn-admin-danger btn-icon" title="Delete" onclick="deletePost('${p.id}','${escHtml(p.title)}')">🗑️</button>
          </div>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:30px;color:#991b1b">${err.message}</td></tr>`;
  }
}

async function deletePost(id, title) {
  if (!confirm(`Delete "${title}"? This cannot be undone.`)) return;
  try {
    await apiFetch(`/posts?id=${id}`, { method: 'DELETE' });
    toast('Post deleted.', 'success');
    loadPosts(postsPage, postsFilter);
  } catch (err) {
    toast(err.message, 'error');
  }
}

async function savePost(e) {
  e.preventDefault();
  const form = e.target;
  const id = form.dataset.postId;
  const btn = form.querySelector('[type="submit"]');
  btn.disabled = true;
  btn.textContent = 'Saving...';

  const body = {
    title: form.title.value.trim(),
    excerpt: form.excerpt.value.trim(),
    content: form.content.value.trim(),
    featured_image: form.featured_image?.value.trim() || null,
    category_id: form.category_id.value || null,
    status: form.status.value,
    is_featured: form.is_featured?.checked || false,
    tags: form.tags?.value.split(',').map(t => t.trim()).filter(Boolean) || []
  };

  try {
    if (id) {
      await apiFetch(`/posts?id=${id}`, { method: 'PUT', body: JSON.stringify(body) });
      toast('Post updated!', 'success');
    } else {
      await apiFetch('/posts', { method: 'POST', body: JSON.stringify(body) });
      toast('Post created!', 'success');
    }
    closeModal('postModal');
    loadPosts(postsPage, postsFilter);
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Save Post';
  }
}

async function editPost(id) {
  try {
    const { data } = await apiFetch(`/posts?id=${id}`);
    if (!data) return;
    const form = document.getElementById('postForm');
    if (!form) return;
    form.dataset.postId = id;
    form.title.value = data.title || '';
    form.excerpt.value = data.excerpt || '';
    form.content.value = data.content || '';
    form.category_id.value = data.category_id || '';
    form.status.value = data.status || 'draft';
    if (form.featured_image) form.featured_image.value = data.featured_image || '';
    if (form.tags) form.tags.value = (data.tags || []).join(', ');
    if (form.is_featured) form.is_featured.checked = data.is_featured || false;
    document.getElementById('postModalTitle').textContent = 'Edit Post';
    openModal('postModal');
  } catch (err) {
    toast('Failed to load post: ' + err.message, 'error');
  }
}

/* ---------- Gallery Management ---------- */
async function loadGalleryAdmin(page = 1) {
  const grid = document.getElementById('galleryAdminGrid');
  if (!grid) return;
  grid.innerHTML = '<div class="spinner" style="margin:40px auto;grid-column:1/-1"></div>';

  try {
    // Use plain fetch for GET (no auth needed for gallery list)
    const res = await fetch(`/api/gallery?page=${page}&limit=20`);
    const json = await res.json();
    const data = json.data;
    if (!data?.length) {
      grid.innerHTML = '<p style="text-align:center;padding:40px;color:#6b7280;grid-column:1/-1">No media uploaded yet.</p>';
      return;
    }
    grid.innerHTML = data.map(item => `
      <div class="gallery-admin-item" style="position:relative;border-radius:8px;overflow:hidden;aspect-ratio:1;background:#f3f4f6">
        ${item.file_type === 'video'
          ? `<video src="${item.file_url}" style="width:100%;height:100%;object-fit:cover" muted playsinline preload="metadata" onmouseenter="this.play()" onmouseleave="this.pause();this.currentTime=0"></video>
             <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-size:2rem;pointer-events:none;transition:.2s" class="vid-play-icon">▶️</div>`
          : `<img src="${item.file_url}" alt="${escHtml(item.title || '')}"
               style="width:100%;height:100%;object-fit:cover" loading="eager"
               onerror="this.style.opacity='.3'">`
        }
        <div style="position:absolute;inset:0;background:linear-gradient(to top,rgba(0,0,0,.7),transparent);opacity:0;transition:.2s;display:flex;align-items:flex-end;padding:10px"
             onmouseenter="this.style.opacity=1" onmouseleave="this.style.opacity=0">
          <div style="flex:1">
            <div style="color:#fff;font-size:.78rem;font-weight:600;margin-bottom:6px">${escHtml(item.title || 'Untitled')}</div>
            <button class="btn-admin btn-admin-danger" style="font-size:.72rem;padding:4px 10px"
                    onclick="deleteGalleryItem('${item.id}')">Delete</button>
          </div>
        </div>
        <span class="badge badge-${item.file_type}" style="position:absolute;top:8px;right:8px">${item.file_type}</span>
      </div>
    `).join('');
  } catch (err) {
    grid.innerHTML = `<p style="text-align:center;padding:40px;color:#991b1b;grid-column:1/-1">Error: ${err.message}</p>`;
  }
}

async function deleteGalleryItem(id) {
  if (!confirm('Delete this media item?')) return;

  // Find the card and show deleting state immediately
  const btn = event.target;
  const card = btn.closest('.gallery-admin-item');
  if (card) {
    card.style.opacity = '0.4';
    card.style.pointerEvents = 'none';
    btn.textContent = '⏳ Deleting...';
  }

  try {
    await apiFetch(`/gallery?id=${id}`, { method: 'DELETE' });
    toast('✅ Deleted successfully.', 'success');
    // Remove card instantly from DOM
    if (card) {
      card.style.transition = 'all .3s ease';
      card.style.transform = 'scale(0)';
      card.style.opacity = '0';
      setTimeout(() => { card.remove(); }, 300);
    } else {
      loadGalleryAdmin();
    }
  } catch (err) {
    toast('❌ ' + err.message, 'error');
    // Restore card if delete failed
    if (card) {
      card.style.opacity = '1';
      card.style.pointerEvents = '';
      btn.textContent = 'Delete';
    }
  }
}

/* ---------- Upload ---------- */
function setupUploadZone(zoneId, inputId, previewId) {
  const zone = document.getElementById(zoneId);
  const input = document.getElementById(inputId);
  const preview = document.getElementById(previewId);
  if (!zone || !input) return;

  zone.addEventListener('click', () => input.click());
  zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('dragover'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
  zone.addEventListener('drop', e => {
    e.preventDefault();
    zone.classList.remove('dragover');
    handleFiles(e.dataTransfer.files, preview);
  });
  input.addEventListener('change', () => handleFiles(input.files, preview));
}

function handleFiles(files, previewEl) {
  if (!previewEl) return;
  Array.from(files).forEach(file => {
    if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const div = document.createElement('div');
      div.className = 'preview-item';
      div.innerHTML = `<img src="${e.target.result}" alt=""><button class="preview-remove" onclick="this.parentElement.remove()">✕</button>`;
      previewEl.appendChild(div);
    };
    reader.readAsDataURL(file);
  });
}

/* ---------- Modal ---------- */
function openModal(id) {
  const m = document.getElementById(id);
  if (m) { m.classList.add('open'); document.body.style.overflow = 'hidden'; }
}
function closeModal(id) {
  const m = document.getElementById(id);
  if (m) { m.classList.remove('open'); document.body.style.overflow = ''; }
}
document.querySelectorAll('.modal-overlay').forEach(m => {
  m.addEventListener('click', e => { if (e.target === m) closeModal(m.id); });
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') document.querySelectorAll('.modal-overlay.open').forEach(m => closeModal(m.id));
});

/* ---------- Helpers ---------- */
function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
}
function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ---------- Init ---------- */
document.addEventListener('DOMContentLoaded', () => {
  const page = window.location.pathname.split('/').pop();
  if (page !== 'index.html' && page !== '') requireAuth();

  if (page === 'dashboard.html') loadDashboardStats();
  if (page === 'posts.html') loadPosts();
  if (page === 'gallery.html') loadGalleryAdmin();
  if (page === 'messages.html') {} // handled inline

  // Sidebar active link
  document.querySelectorAll('.sidebar-link').forEach(link => {
    if (link.getAttribute('href') === page) link.classList.add('active');
  });

  // Logout buttons
  document.querySelectorAll('[data-logout]').forEach(btn => btn.addEventListener('click', logout));

  // Upload zone setup is handled per-page in inline scripts
  // setupUploadZone('uploadZone', 'fileInput', 'uploadPreview');
});
