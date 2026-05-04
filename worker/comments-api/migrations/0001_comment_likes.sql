ALTER TABLE comments ADD COLUMN like_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE comments ADD COLUMN blogger_liked INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS comment_likes (
  id TEXT PRIMARY KEY,
  comment_id TEXT NOT NULL,
  visitor_hash TEXT NOT NULL,
  ip_hash TEXT,
  user_agent_hash TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE,
  UNIQUE(comment_id, visitor_hash)
);

CREATE INDEX IF NOT EXISTS idx_comment_likes_comment_id ON comment_likes(comment_id);
CREATE INDEX IF NOT EXISTS idx_comment_likes_visitor_hash ON comment_likes(visitor_hash);
