-- SAML/SSO Tables

-- SAML Identity Providers configuration
CREATE TABLE IF NOT EXISTS saml_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  entity_id VARCHAR(500) NOT NULL UNIQUE,
  sso_url VARCHAR(500) NOT NULL,
  sso_logout_url VARCHAR(500),
  certificate TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  auto_provision BOOLEAN DEFAULT false,
  default_role VARCHAR(50) DEFAULT 'client',
  attribute_mapping JSONB DEFAULT '{"email": "email", "firstName": "firstName", "lastName": "lastName"}'::jsonb,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User to SAML provider mapping
CREATE TABLE IF NOT EXISTS saml_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider_id UUID NOT NULL REFERENCES saml_providers(id) ON DELETE CASCADE,
  name_id VARCHAR(500) NOT NULL,
  attributes JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, provider_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_saml_providers_entity_id ON saml_providers(entity_id);
CREATE INDEX IF NOT EXISTS idx_saml_providers_is_active ON saml_providers(is_active);
CREATE INDEX IF NOT EXISTS idx_saml_mappings_user_id ON saml_mappings(user_id);
CREATE INDEX IF NOT EXISTS idx_saml_mappings_provider_id ON saml_mappings(provider_id);
CREATE INDEX IF NOT EXISTS idx_saml_mappings_name_id ON saml_mappings(name_id);

-- Add created_via column to users table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_name='users' AND column_name='created_via') THEN
        ALTER TABLE users ADD COLUMN created_via VARCHAR(50) DEFAULT 'manual';
    END IF;
END $$;

-- Comments
COMMENT ON TABLE saml_providers IS 'SAML/SSO identity provider configurations';
COMMENT ON TABLE saml_mappings IS 'Mapping between users and their SAML identities';
COMMENT ON COLUMN saml_providers.entity_id IS 'Unique identifier for the SAML entity/issuer';
COMMENT ON COLUMN saml_providers.certificate IS 'X.509 certificate for verifying SAML assertions';
COMMENT ON COLUMN saml_providers.auto_provision IS 'Whether to automatically create new users from SAML logins';
COMMENT ON COLUMN saml_providers.attribute_mapping IS 'Mapping of SAML attributes to user fields';
COMMENT ON COLUMN saml_mappings.name_id IS 'SAML NameID that uniquely identifies the user at the IdP';
