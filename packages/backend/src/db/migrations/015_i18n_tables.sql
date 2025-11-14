-- 015_i18n_tables.sql
-- Multi-language Support: Translations and Locale Management

-- Supported languages table
CREATE TABLE IF NOT EXISTS languages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(10) UNIQUE NOT NULL, -- 'en', 'es', 'fr', 'de', 'ja', etc.
  name VARCHAR(100) NOT NULL,
  native_name VARCHAR(100) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false,
  direction VARCHAR(3) DEFAULT 'ltr', -- 'ltr' or 'rtl'
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_languages_code ON languages(code);
CREATE INDEX idx_languages_is_active ON languages(is_active);

-- Translation keys table
CREATE TABLE IF NOT EXISTS translation_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key_name VARCHAR(255) UNIQUE NOT NULL, -- 'common.welcome', 'auth.login', etc.
  namespace VARCHAR(100) NOT NULL, -- 'common', 'auth', 'dashboard', etc.
  description TEXT,
  context TEXT, -- Additional context for translators
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_translation_keys_namespace ON translation_keys(namespace);
CREATE INDEX idx_translation_keys_key_name ON translation_keys(key_name);

-- Translations table
CREATE TABLE IF NOT EXISTS translations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key_id UUID NOT NULL REFERENCES translation_keys(id) ON DELETE CASCADE,
  language_id UUID NOT NULL REFERENCES languages(id) ON DELETE CASCADE,
  value TEXT NOT NULL,
  is_verified BOOLEAN DEFAULT false,
  translated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  verified_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(key_id, language_id)
);

CREATE INDEX idx_translations_key_id ON translations(key_id);
CREATE INDEX idx_translations_language_id ON translations(language_id);
CREATE INDEX idx_translations_is_verified ON translations(is_verified);

-- User language preferences
CREATE TABLE IF NOT EXISTS user_language_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  language_id UUID NOT NULL REFERENCES languages(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_user_language_preferences_user_id ON user_language_preferences(user_id);
CREATE INDEX idx_user_language_preferences_language_id ON user_language_preferences(language_id);

-- Localized content table (for CMS, blog posts, etc.)
CREATE TABLE IF NOT EXISTS localized_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type VARCHAR(50) NOT NULL, -- 'page', 'post', 'faq', etc.
  entity_id UUID NOT NULL,
  language_id UUID NOT NULL REFERENCES languages(id) ON DELETE CASCADE,
  field_name VARCHAR(100) NOT NULL, -- 'title', 'content', 'description', etc.
  field_value TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(entity_type, entity_id, language_id, field_name)
);

CREATE INDEX idx_localized_content_entity ON localized_content(entity_type, entity_id);
CREATE INDEX idx_localized_content_language_id ON localized_content(language_id);

-- Insert default supported languages
INSERT INTO languages (code, name, native_name, is_active, is_default, direction) VALUES
  ('en', 'English', 'English', true, true, 'ltr'),
  ('es', 'Spanish', 'Español', true, false, 'ltr'),
  ('fr', 'French', 'Français', true, false, 'ltr'),
  ('de', 'German', 'Deutsch', true, false, 'ltr'),
  ('it', 'Italian', 'Italiano', true, false, 'ltr'),
  ('pt', 'Portuguese', 'Português', true, false, 'ltr'),
  ('ja', 'Japanese', '日本語', true, false, 'ltr'),
  ('zh', 'Chinese (Simplified)', '简体中文', true, false, 'ltr'),
  ('ar', 'Arabic', 'العربية', true, false, 'rtl'),
  ('ru', 'Russian', 'Русский', true, false, 'ltr')
ON CONFLICT (code) DO NOTHING;

-- Insert common translation keys
INSERT INTO translation_keys (key_name, namespace, description) VALUES
  ('common.welcome', 'common', 'Welcome message'),
  ('common.hello', 'common', 'Hello greeting'),
  ('common.goodbye', 'common', 'Goodbye message'),
  ('common.yes', 'common', 'Yes button/label'),
  ('common.no', 'common', 'No button/label'),
  ('common.save', 'common', 'Save button'),
  ('common.cancel', 'common', 'Cancel button'),
  ('common.delete', 'common', 'Delete button'),
  ('common.edit', 'common', 'Edit button'),
  ('common.search', 'common', 'Search placeholder'),
  ('auth.login', 'auth', 'Login button'),
  ('auth.logout', 'auth', 'Logout button'),
  ('auth.register', 'auth', 'Register button'),
  ('auth.email', 'auth', 'Email field label'),
  ('auth.password', 'auth', 'Password field label'),
  ('dashboard.title', 'dashboard', 'Dashboard page title'),
  ('dashboard.welcome_back', 'dashboard', 'Welcome back message'),
  ('itinerary.create', 'itinerary', 'Create itinerary button'),
  ('itinerary.view', 'itinerary', 'View itinerary button'),
  ('itinerary.title', 'itinerary', 'Itinerary title field')
ON CONFLICT (key_name) DO NOTHING;

COMMENT ON TABLE languages IS 'Supported languages for multi-language support';
COMMENT ON TABLE translation_keys IS 'Translation key definitions';
COMMENT ON TABLE translations IS 'Actual translations for each key and language';
COMMENT ON TABLE user_language_preferences IS 'User language preferences';
COMMENT ON TABLE localized_content IS 'Localized content for CMS and dynamic entities';
