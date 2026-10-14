-- 博客文章表：管理员后台发布，前台公开阅读
-- 应用方式（二选一）：
--   1) CLI:  wrangler d1 migrations apply yushu-ai --remote
--   2) 控制台: 把 0002_blog.console.sql 的内容粘贴到 Cloudflare D1 的 SQL 编辑器执行
CREATE TABLE IF NOT EXISTS posts (
  id            TEXT    PRIMARY KEY,
  slug          TEXT    UNIQUE NOT NULL,
  title         TEXT    NOT NULL,
  excerpt       TEXT,
  cover_image   TEXT,
  content_html  TEXT    NOT NULL,
  status        TEXT    NOT NULL DEFAULT 'draft',
  author_email  TEXT,
  created_at    INTEGER NOT NULL,
  updated_at    INTEGER NOT NULL,
  published_at  INTEGER
);

CREATE INDEX IF NOT EXISTS idx_posts_status_published ON posts(status, published_at);
CREATE INDEX IF NOT EXISTS idx_posts_updated ON posts(updated_at DESC);
