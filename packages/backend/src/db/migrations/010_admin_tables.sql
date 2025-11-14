-- 010_admin_tables.sql
-- Admin Features: System Configuration and Feature Flags

-- System configuration table
CREATE TABLE IF NOT EXISTS system_config (
  key VARCHAR(100) PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_system_config_updated_at ON system_config(updated_at DESC);

-- Feature flags table
CREATE TABLE IF NOT EXISTS feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  key VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  is_enabled BOOLEAN DEFAULT false,
  rollout_percentage INT DEFAULT 0 CHECK (rollout_percentage >= 0 AND rollout_percentage <= 100),
  target_users TEXT[], -- Array of user IDs
  target_roles TEXT[], -- Array of roles (client, designer, vendor, admin)
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_feature_flags_key ON feature_flags(key);
CREATE INDEX idx_feature_flags_is_enabled ON feature_flags(is_enabled);

-- Insert default system configuration
INSERT INTO system_config (key, value, description) VALUES
  ('maintenance_mode', 'false', 'Enable/disable maintenance mode'),
  ('registration_enabled', 'true', 'Allow new user registrations'),
  ('max_upload_size_mb', '10', 'Maximum upload file size in MB'),
  ('session_timeout_minutes', '60', 'User session timeout in minutes'),
  ('max_login_attempts', '5', 'Maximum failed login attempts before lockout'),
  ('lockout_duration_minutes', '30', 'Account lockout duration in minutes'),
  ('email_verification_required', 'true', 'Require email verification for new users'),
  ('two_factor_required', 'false', 'Require 2FA for all users'),
  ('password_min_length', '8', 'Minimum password length'),
  ('password_require_special_char', 'true', 'Require special characters in passwords')
ON CONFLICT (key) DO NOTHING;

-- Insert default feature flags
INSERT INTO feature_flags (name, key, description, is_enabled, rollout_percentage) VALUES
  ('AI Itinerary Generation', 'ai_itinerary_generation', 'Enable AI-powered itinerary generation', true, 100),
  ('Advanced Analytics', 'advanced_analytics', 'Enable advanced analytics dashboard', true, 100),
  ('Vendor Portal', 'vendor_portal', 'Enable vendor portal access', true, 100),
  ('Mobile App', 'mobile_app', 'Enable mobile app features', false, 0),
  ('Beta Features', 'beta_features', 'Enable beta features for testing', false, 0),
  ('Premium Features', 'premium_features', 'Enable premium tier features', false, 0),
  ('Multi-language Support', 'multi_language', 'Enable multi-language support', false, 0),
  ('Advanced Search', 'advanced_search', 'Enable advanced search features', false, 0),
  ('Custom Reports', 'custom_reports', 'Enable custom report builder', false, 0),
  ('Calendar Integration', 'calendar_integration', 'Enable calendar sync (Google, Outlook)', false, 0)
ON CONFLICT (key) DO NOTHING;

COMMENT ON TABLE system_config IS 'System-wide configuration settings';
COMMENT ON TABLE feature_flags IS 'Feature flags for gradual rollout and A/B testing';
