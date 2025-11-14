-- Phase 3: Notifications System Tables

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL, -- 'info', 'success', 'warning', 'error', 'booking', 'approval', 'payment', 'message', etc.
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  action_url VARCHAR(500),
  action_text VARCHAR(100),
  metadata JSONB DEFAULT '{}'::jsonb,
  is_read BOOLEAN DEFAULT false,
  is_archived BOOLEAN DEFAULT false,
  priority VARCHAR(20) DEFAULT 'normal', -- 'low', 'normal', 'high', 'urgent'
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  read_at TIMESTAMP,
  archived_at TIMESTAMP
);

-- Notification preferences table
CREATE TABLE IF NOT EXISTS notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  email_enabled BOOLEAN DEFAULT true,
  push_enabled BOOLEAN DEFAULT true,
  in_app_enabled BOOLEAN DEFAULT true,

  -- Channel-specific preferences
  email_bookings BOOLEAN DEFAULT true,
  email_approvals BOOLEAN DEFAULT true,
  email_payments BOOLEAN DEFAULT true,
  email_messages BOOLEAN DEFAULT true,
  email_marketing BOOLEAN DEFAULT false,
  email_system BOOLEAN DEFAULT true,

  push_bookings BOOLEAN DEFAULT true,
  push_approvals BOOLEAN DEFAULT true,
  push_payments BOOLEAN DEFAULT true,
  push_messages BOOLEAN DEFAULT true,
  push_system BOOLEAN DEFAULT true,

  -- Frequency settings
  email_digest BOOLEAN DEFAULT false,
  email_digest_frequency VARCHAR(20) DEFAULT 'daily', -- 'realtime', 'daily', 'weekly'
  quiet_hours_enabled BOOLEAN DEFAULT false,
  quiet_hours_start TIME,
  quiet_hours_end TIME,
  timezone VARCHAR(50) DEFAULT 'UTC',

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Push notification subscriptions (Web Push API)
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subscription_data JSONB NOT NULL,
  user_agent TEXT,
  device_name VARCHAR(255),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Notification history/logs
CREATE TABLE IF NOT EXISTS notification_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID REFERENCES notifications(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  channel VARCHAR(20) NOT NULL, -- 'email', 'push', 'in_app'
  status VARCHAR(20) NOT NULL, -- 'sent', 'delivered', 'failed', 'bounced'
  error_message TEXT,
  sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  delivered_at TIMESTAMP,
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_is_active ON push_subscriptions(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_notification_logs_user_id ON notification_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_logs_sent_at ON notification_logs(sent_at DESC);

-- Comments
COMMENT ON TABLE notifications IS 'In-app notifications for users';
COMMENT ON TABLE notification_preferences IS 'User notification preferences and settings';
COMMENT ON TABLE push_subscriptions IS 'Web Push API subscription endpoints';
COMMENT ON TABLE notification_logs IS 'Audit log of all sent notifications';
COMMENT ON COLUMN notifications.priority IS 'Priority level affecting delivery and display';
COMMENT ON COLUMN notification_preferences.email_digest IS 'Whether to batch notifications into digest emails';
COMMENT ON COLUMN push_subscriptions.subscription_data IS 'Web Push API subscription object (endpoint, keys)';
