# ❤️ Heart Warriors — LGU Bago City Website

Official website for the Heart Warriors cardiovascular health program of the Local Government Unit of Bago City, Negros Occidental.

---

## 🚀 Quick Setup (Vercel + Supabase)

### Step 1 — Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a free account
2. Create a new project (name it `heart-warriors`)
3. Go to **SQL Editor** and paste the contents of `database/schema.sql` — click **Run**
4. Go to **Storage** → Create a new bucket named `heart-warriors-media` → set it to **Public**
5. Go to **Settings → API** and copy:
   - `Project URL` → this is your `SUPABASE_URL`
   - `anon public` key → this is your `SUPABASE_ANON_KEY`
   - `service_role` key → this is your `SUPABASE_SERVICE_KEY`

### Step 2 — Create the First Admin Account

In Supabase SQL Editor, run:

```sql
INSERT INTO admins (name, email, password_hash, role)
VALUES (
  'Admin',
  'admin@bago.gov.ph',
  '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/HS.iK8e',  -- password: Admin@1234
  'superadmin'
);
```

> **Change the password immediately** after first login via Settings → Change Password.

### Step 3 — Deploy to Vercel

1. Install Vercel CLI: `npm install -g vercel`
2. In the `heart-warriors` folder, run: `vercel`
3. Follow the prompts (link to your Vercel account, create new project)
4. Add environment variables in Vercel Dashboard → Settings → Environment Variables:

```
SUPABASE_URL          = your_supabase_project_url
SUPABASE_ANON_KEY     = your_supabase_anon_key
SUPABASE_SERVICE_KEY  = your_supabase_service_role_key
JWT_SECRET            = any_long_random_string_here
```

5. Redeploy: `vercel --prod`

### Step 4 — Access the Site

- **Public site**: `https://your-project.vercel.app`
- **Admin panel**: `https://your-project.vercel.app/admin/`
- **Login**: `admin@bago.gov.ph` / `Admin@1234` (change immediately!)

---

## 📁 Project Structure

```
heart-warriors/
├── index.html              # Home page
├── about.html              # About page
├── news.html               # News & Updates
├── gallery.html            # Photo/Video Gallery
├── contact.html            # Contact page
├── admin/
│   ├── index.html          # Admin login
│   ├── dashboard.html      # Admin dashboard
│   ├── posts.html          # Manage posts
│   ├── gallery.html        # Manage gallery
│   └── settings.html       # Site settings
├── assets/
│   ├── css/
│   │   ├── main.css        # Public site styles
│   │   └── admin.css       # Admin panel styles
│   ├── js/
│   │   ├── main.js         # Public site JS
│   │   └── admin.js        # Admin panel JS
│   └── images/             # Static images
├── api/
│   ├── _lib/
│   │   ├── supabase.js     # Supabase client
│   │   └── auth.js         # JWT auth helper
│   ├── auth.js             # Login / change password
│   ├── posts.js            # Posts CRUD
│   ├── gallery.js          # Gallery CRUD
│   ├── upload.js           # File upload
│   ├── contact.js          # Contact form
│   ├── categories.js       # Categories list
│   └── stats.js            # Dashboard stats
├── database/
│   └── schema.sql          # Full PostgreSQL schema
├── vercel.json             # Vercel configuration
├── package.json            # Node.js dependencies
└── .env.example            # Environment variables template
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | HTML5, CSS3, Vanilla JavaScript |
| Backend | Node.js Serverless Functions (Vercel) |
| Database | PostgreSQL via Supabase |
| File Storage | Supabase Storage |
| Auth | JWT (jsonwebtoken + bcryptjs) |
| Hosting | Vercel (free tier) |

---

## 📋 Features

### Public Site
- ✅ Responsive, mobile-first design
- ✅ Hero section with animated stats counter
- ✅ Dynamic news/posts with category filtering
- ✅ Photo gallery with lightbox viewer
- ✅ Contact form with validation
- ✅ Facebook page integration placeholder
- ✅ SEO-friendly structure
- ✅ Scroll animations

### Admin Panel
- ✅ Secure JWT login
- ✅ Dashboard with live stats
- ✅ Create, edit, delete posts
- ✅ Image/video upload to Supabase Storage
- ✅ Gallery management
- ✅ Site settings management
- ✅ Change password

### Future-Ready (Database Ready)
- 🔜 User registration & login
- 🔜 Help request / ticketing system
- 🔜 Beneficiary tracking
- 🔜 Role-based access control

---

## 🔒 Security Notes

- All admin routes require a valid JWT token
- Passwords are hashed with bcrypt (12 rounds)
- File uploads are validated for type and size
- Row Level Security (RLS) enabled on Supabase tables
- Input sanitization on all API endpoints

---

## 📞 Support

For technical support, contact the program's IT coordinator or open an issue in the project repository.

**Heart Warriors Program**
Bago City Hall, Bago City, Negros Occidental
heartwarriors@bago.gov.ph
