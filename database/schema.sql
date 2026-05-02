-- ============================================================
-- Heart Warriors LGU Website - Database Schema (Supabase/PostgreSQL)
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- ADMINS TABLE
-- ============================================================
CREATE TABLE admins (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role VARCHAR(20) DEFAULT 'admin' CHECK (role IN ('superadmin', 'admin', 'editor')),
  avatar_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- CATEGORIES TABLE
-- ============================================================
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  color VARCHAR(7) DEFAULT '#c0392b',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default categories
INSERT INTO categories (name, slug, description, color) VALUES
  ('Announcements', 'announcements', 'Official program announcements', '#c0392b'),
  ('Events', 'events', 'Upcoming and past events', '#e74c3c'),
  ('Stories', 'stories', 'Beneficiary stories and testimonials', '#e67e22'),
  ('Health Tips', 'health-tips', 'Heart health tips and information', '#27ae60'),
  ('News', 'news', 'General program news', '#2980b9');

-- ============================================================
-- POSTS TABLE
-- ============================================================
CREATE TABLE posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title VARCHAR(255) NOT NULL,
  slug VARCHAR(255) UNIQUE NOT NULL,
  excerpt TEXT,
  content TEXT NOT NULL,
  featured_image TEXT,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  author_id UUID REFERENCES admins(id) ON DELETE SET NULL,
  status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  is_featured BOOLEAN DEFAULT false,
  views INTEGER DEFAULT 0,
  tags TEXT[],
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- GALLERY TABLE
-- ============================================================
CREATE TABLE gallery (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title VARCHAR(255),
  description TEXT,
  file_url TEXT NOT NULL,
  file_type VARCHAR(20) DEFAULT 'image' CHECK (file_type IN ('image', 'video')),
  thumbnail_url TEXT,
  album VARCHAR(100),
  uploaded_by UUID REFERENCES admins(id) ON DELETE SET NULL,
  is_featured BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- EVENTS TABLE
-- ============================================================
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  location VARCHAR(255),
  event_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ,
  image_url TEXT,
  status VARCHAR(20) DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'ongoing', 'completed', 'cancelled')),
  created_by UUID REFERENCES admins(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- CONTACTS / MESSAGES TABLE
-- ============================================================
CREATE TABLE contact_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL,
  subject VARCHAR(255),
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  replied_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- USERS TABLE (Future - Help Request System)
-- ============================================================
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  full_name VARCHAR(150) NOT NULL,
  email VARCHAR(150) UNIQUE NOT NULL,
  phone VARCHAR(20),
  address TEXT,
  barangay VARCHAR(100),
  password_hash TEXT NOT NULL,
  role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('user', 'beneficiary', 'volunteer')),
  is_verified BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  profile_photo TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- HELP REQUESTS TABLE (Future)
-- ============================================================
CREATE TABLE help_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  ticket_number VARCHAR(20) UNIQUE NOT NULL,
  category VARCHAR(100),
  subject VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  status VARCHAR(30) DEFAULT 'pending' CHECK (status IN ('pending', 'under_review', 'approved', 'in_progress', 'completed', 'rejected')),
  priority VARCHAR(20) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  assigned_to UUID REFERENCES admins(id) ON DELETE SET NULL,
  notes TEXT,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SITE SETTINGS TABLE
-- ============================================================
CREATE TABLE site_settings (
  key VARCHAR(100) PRIMARY KEY,
  value TEXT,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO site_settings (key, value, description) VALUES
  ('site_name', 'Heart Warriors', 'Website name'),
  ('site_tagline', 'Caring for Every Heart in Bago City', 'Website tagline'),
  ('facebook_page_url', '', 'Facebook page URL'),
  ('contact_email', 'heartwarriors@bago.gov.ph', 'Contact email'),
  ('contact_phone', '', 'Contact phone number'),
  ('contact_address', 'Bago City, Negros Occidental', 'Office address'),
  ('maintenance_mode', 'false', 'Enable maintenance mode');

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX idx_posts_status ON posts(status);
CREATE INDEX idx_posts_category ON posts(category_id);
CREATE INDEX idx_posts_published_at ON posts(published_at DESC);
CREATE INDEX idx_gallery_album ON gallery(album);
CREATE INDEX idx_help_requests_status ON help_requests(status);
CREATE INDEX idx_help_requests_user ON help_requests(user_id);

-- ============================================================
-- ROW LEVEL SECURITY (Supabase)
-- ============================================================
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE gallery ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_messages ENABLE ROW LEVEL SECURITY;

-- Public can read published posts
CREATE POLICY "Public read published posts" ON posts
  FOR SELECT USING (status = 'published');

-- Public can read gallery
CREATE POLICY "Public read gallery" ON gallery
  FOR SELECT USING (true);

-- Anyone can submit contact messages
CREATE POLICY "Anyone can submit contact" ON contact_messages
  FOR INSERT WITH CHECK (true);
