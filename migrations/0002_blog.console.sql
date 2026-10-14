CREATE TABLE IF NOT EXISTS posts (id TEXT PRIMARY KEY, slug TEXT UNIQUE NOT NULL, title TEXT NOT NULL, excerpt TEXT, cover_image TEXT, content_html TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'draft', author_email TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, published_at INTEGER);
CREATE INDEX IF NOT EXISTS idx_posts_status_published ON posts(status, published_at);
CREATE INDEX IF NOT EXISTS idx_posts_updated ON posts(updated_at DESC);
