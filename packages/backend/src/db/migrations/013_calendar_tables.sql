-- 013_calendar_tables.sql
-- Calendar Integration: Calendar connections and synced events

-- Calendar connections table
CREATE TABLE IF NOT EXISTS calendar_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider VARCHAR(50) NOT NULL, -- 'google', 'outlook', 'apple'
  provider_account_id VARCHAR(255) NOT NULL,
  provider_account_email VARCHAR(255) NOT NULL,
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMP,
  calendar_id VARCHAR(255), -- Provider's calendar ID
  calendar_name VARCHAR(255),
  is_primary BOOLEAN DEFAULT false,
  sync_enabled BOOLEAN DEFAULT true,
  last_sync_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, provider, provider_account_id)
);

CREATE INDEX idx_calendar_connections_user_id ON calendar_connections(user_id);
CREATE INDEX idx_calendar_connections_provider ON calendar_connections(provider);
CREATE INDEX idx_calendar_connections_sync_enabled ON calendar_connections(sync_enabled);

-- Synced calendar events table
CREATE TABLE IF NOT EXISTS synced_calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES calendar_connections(id) ON DELETE CASCADE,
  itinerary_id UUID REFERENCES itineraries(id) ON DELETE CASCADE,
  provider_event_id VARCHAR(255) NOT NULL,
  event_type VARCHAR(50) NOT NULL, -- 'flight', 'accommodation', 'activity', 'meeting'
  title VARCHAR(255) NOT NULL,
  description TEXT,
  location VARCHAR(500),
  start_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP NOT NULL,
  all_day BOOLEAN DEFAULT false,
  recurrence_rule VARCHAR(500), -- RFC 5545 RRULE
  metadata JSONB DEFAULT '{}'::jsonb,
  last_synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(connection_id, provider_event_id)
);

CREATE INDEX idx_synced_events_connection_id ON synced_calendar_events(connection_id);
CREATE INDEX idx_synced_events_itinerary_id ON synced_calendar_events(itinerary_id);
CREATE INDEX idx_synced_events_start_time ON synced_calendar_events(start_time);
CREATE INDEX idx_synced_events_event_type ON synced_calendar_events(event_type);

-- Calendar sync log table
CREATE TABLE IF NOT EXISTS calendar_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID NOT NULL REFERENCES calendar_connections(id) ON DELETE CASCADE,
  sync_type VARCHAR(50) NOT NULL, -- 'full', 'incremental', 'manual'
  status VARCHAR(20) NOT NULL, -- 'success', 'failed', 'partial'
  events_synced INT DEFAULT 0,
  events_created INT DEFAULT 0,
  events_updated INT DEFAULT 0,
  events_deleted INT DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMP NOT NULL,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_calendar_sync_log_connection_id ON calendar_sync_log(connection_id);
CREATE INDEX idx_calendar_sync_log_status ON calendar_sync_log(status);
CREATE INDEX idx_calendar_sync_log_created_at ON calendar_sync_log(created_at DESC);

COMMENT ON TABLE calendar_connections IS 'User calendar provider connections (Google, Outlook, Apple)';
COMMENT ON TABLE synced_calendar_events IS 'Events synced from itineraries to external calendars';
COMMENT ON TABLE calendar_sync_log IS 'Audit log of calendar synchronization operations';
