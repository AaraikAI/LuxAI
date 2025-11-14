-- 011_search_tables.sql
-- Advanced Search Features: Search History and Saved Filters

-- Search history table
CREATE TABLE IF NOT EXISTS search_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  query TEXT NOT NULL,
  filters JSONB DEFAULT '{}'::jsonb,
  entity_type VARCHAR(50), -- 'users', 'itineraries', 'bookings', 'vendors', etc.
  results_count INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_search_history_user_id ON search_history(user_id);
CREATE INDEX idx_search_history_created_at ON search_history(created_at DESC);
CREATE INDEX idx_search_history_entity_type ON search_history(entity_type);

-- Saved search filters table
CREATE TABLE IF NOT EXISTS saved_searches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  query TEXT,
  filters JSONB NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_saved_searches_user_id ON saved_searches(user_id);
CREATE INDEX idx_saved_searches_entity_type ON saved_searches(entity_type);

-- Full text search indices for common entities
CREATE INDEX IF NOT EXISTS idx_users_fulltext ON users USING gin(to_tsvector('english', coalesce(email, '') || ' ' || coalesce(full_name, '')));
CREATE INDEX IF NOT EXISTS idx_itineraries_fulltext ON itineraries USING gin(to_tsvector('english', coalesce(title, '') || ' ' || coalesce(description, '')));

COMMENT ON TABLE search_history IS 'User search history for quick access and analytics';
COMMENT ON TABLE saved_searches IS 'User-saved search filters for repeated queries';
