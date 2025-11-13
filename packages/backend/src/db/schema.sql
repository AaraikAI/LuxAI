-- LuxAI Designer Database Schema
-- PostgreSQL 15+

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable pgcrypto for encryption
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==========================================
-- USERS & AUTHENTICATION
-- ==========================================

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL CHECK (role IN ('client', 'assistant', 'designer', 'agency_manager', 'vendor', 'admin')),
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  phone VARCHAR(50),
  kyc_status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (kyc_status IN ('pending', 'in_progress', 'verified', 'rejected', 'expired')),
  kyc_verified_at TIMESTAMP WITH TIME ZONE,
  two_factor_enabled BOOLEAN DEFAULT false,
  two_factor_secret VARCHAR(255),
  backup_codes TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_kyc_status ON users(kyc_status);

-- ==========================================
-- CLIENTS
-- ==========================================

CREATE TABLE clients (
  id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  net_worth BIGINT,
  net_worth_verified_at TIMESTAMP WITH TIME ZONE,
  preferences JSONB DEFAULT '{}',
  live_updates_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_clients_net_worth ON clients(net_worth);

-- ==========================================
-- AGENCIES & DESIGNERS
-- ==========================================

CREATE TABLE agencies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  legal_name VARCHAR(255) NOT NULL,
  registration_number VARCHAR(100),
  address JSONB NOT NULL,
  phone VARCHAR(50) NOT NULL,
  email VARCHAR(255) NOT NULL,
  website VARCHAR(255),
  tier VARCHAR(50) NOT NULL DEFAULT 'freemium' CHECK (tier IN ('freemium', 'premium', 'enterprise')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE designers (
  id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  agency_id UUID REFERENCES agencies(id) ON DELETE SET NULL,
  specializations TEXT[] DEFAULT '{}',
  certifications TEXT[] DEFAULT '{}',
  experience_years INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_designers_agency ON designers(agency_id);

-- ==========================================
-- VENDORS
-- ==========================================

CREATE TABLE vendors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  business_name VARCHAR(255) NOT NULL,
  legal_name VARCHAR(255) NOT NULL,
  registration_number VARCHAR(100),
  category VARCHAR(50) NOT NULL CHECK (category IN ('travel', 'aviation', 'accommodation', 'experiences', 'dining', 'staffing', 'events', 'estate', 'lifestyle')),
  capabilities TEXT[] DEFAULT '{}',
  safety_badges TEXT[] DEFAULT '{}',
  insurance_coverage BIGINT NOT NULL,
  insurance_expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  kyb_status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (kyb_status IN ('pending', 'verified', 'rejected')),
  rating DECIMAL(3,2) DEFAULT 0,
  review_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_vendors_user ON vendors(user_id);
CREATE INDEX idx_vendors_category ON vendors(category);
CREATE INDEX idx_vendors_kyb_status ON vendors(kyb_status);
CREATE INDEX idx_vendors_rating ON vendors(rating);

-- ==========================================
-- DEALS (OFF-MARKET VAULT)
-- ==========================================

CREATE TABLE deals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vendor_id UUID REFERENCES vendors(id) ON DELETE CASCADE,
  title VARCHAR(500) NOT NULL,
  description TEXT NOT NULL,
  category VARCHAR(50) NOT NULL,
  subcategory VARCHAR(100),
  location JSONB NOT NULL,
  price_range JSONB NOT NULL,
  is_exclusive BOOLEAN DEFAULT false,
  is_off_market BOOLEAN DEFAULT true,
  availability JSONB DEFAULT '{}',
  images TEXT[] DEFAULT '{}',
  tags TEXT[] DEFAULT '{}',
  sustainability_score INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_deals_vendor ON deals(vendor_id);
CREATE INDEX idx_deals_category ON deals(category);
CREATE INDEX idx_deals_exclusive ON deals(is_exclusive);
CREATE INDEX idx_deals_expires ON deals(expires_at);
CREATE INDEX idx_deals_tags ON deals USING GIN(tags);

-- ==========================================
-- ITINERARIES
-- ==========================================

CREATE TABLE itineraries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  designer_id UUID REFERENCES designers(id) ON DELETE SET NULL,
  title VARCHAR(500) NOT NULL,
  description TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending_approval', 'approved', 'active', 'completed', 'cancelled')),
  approval_status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved_by_assistant', 'approved_by_family_office', 'approved_by_principal', 'rejected')),
  ai_generated BOOLEAN DEFAULT false,
  sustainability_metrics JSONB,
  total_budget BIGINT,
  actual_cost BIGINT,
  currency VARCHAR(3) DEFAULT 'USD',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_itineraries_client ON itineraries(client_id);
CREATE INDEX idx_itineraries_designer ON itineraries(designer_id);
CREATE INDEX idx_itineraries_status ON itineraries(status);
CREATE INDEX idx_itineraries_dates ON itineraries(start_date, end_date);

-- ==========================================
-- DESTINATIONS
-- ==========================================

CREATE TABLE destinations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  itinerary_id UUID REFERENCES itineraries(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  country VARCHAR(100) NOT NULL,
  coordinates JSONB NOT NULL,
  arrival_date TIMESTAMP WITH TIME ZONE NOT NULL,
  departure_date TIMESTAMP WITH TIME ZONE NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_destinations_itinerary ON destinations(itinerary_id);

-- ==========================================
-- ACTIVITIES
-- ==========================================

CREATE TABLE activities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  itinerary_id UUID REFERENCES itineraries(id) ON DELETE CASCADE,
  destination_id UUID REFERENCES destinations(id) ON DELETE CASCADE,
  name VARCHAR(500) NOT NULL,
  description TEXT,
  category VARCHAR(100),
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  location JSONB NOT NULL,
  vendor_id UUID REFERENCES vendors(id) ON DELETE SET NULL,
  cost BIGINT,
  booking_status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (booking_status IN ('pending', 'requested', 'confirmed', 'cancelled')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_activities_itinerary ON activities(itinerary_id);
CREATE INDEX idx_activities_destination ON activities(destination_id);
CREATE INDEX idx_activities_vendor ON activities(vendor_id);

-- ==========================================
-- ACCOMMODATIONS
-- ==========================================

CREATE TABLE accommodations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  itinerary_id UUID REFERENCES itineraries(id) ON DELETE CASCADE,
  destination_id UUID REFERENCES destinations(id) ON DELETE CASCADE,
  name VARCHAR(500) NOT NULL,
  type VARCHAR(100) NOT NULL,
  address JSONB NOT NULL,
  check_in TIMESTAMP WITH TIME ZONE NOT NULL,
  check_out TIMESTAMP WITH TIME ZONE NOT NULL,
  rooms INTEGER DEFAULT 1,
  guests INTEGER NOT NULL,
  vendor_id UUID REFERENCES vendors(id) ON DELETE SET NULL,
  cost BIGINT,
  booking_status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (booking_status IN ('pending', 'requested', 'confirmed', 'cancelled')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_accommodations_itinerary ON accommodations(itinerary_id);
CREATE INDEX idx_accommodations_destination ON accommodations(destination_id);
CREATE INDEX idx_accommodations_vendor ON accommodations(vendor_id);

-- ==========================================
-- TRANSPORTATION
-- ==========================================

CREATE TABLE transportation (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  itinerary_id UUID REFERENCES itineraries(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL CHECK (type IN ('private_jet', 'commercial_flight', 'helicopter', 'yacht', 'luxury_car', 'train', 'other')),
  from_destination_id UUID REFERENCES destinations(id),
  to_destination_id UUID REFERENCES destinations(id),
  departure_time TIMESTAMP WITH TIME ZONE NOT NULL,
  arrival_time TIMESTAMP WITH TIME ZONE NOT NULL,
  provider VARCHAR(255),
  flight_number VARCHAR(50),
  vendor_id UUID REFERENCES vendors(id) ON DELETE SET NULL,
  cost BIGINT,
  booking_status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (booking_status IN ('pending', 'requested', 'confirmed', 'cancelled')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_transportation_itinerary ON transportation(itinerary_id);
CREATE INDEX idx_transportation_vendor ON transportation(vendor_id);

-- ==========================================
-- QUOTES
-- ==========================================

CREATE TABLE quotes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  itinerary_id UUID REFERENCES itineraries(id) ON DELETE CASCADE,
  deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
  vendor_id UUID REFERENCES vendors(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  designer_id UUID REFERENCES designers(id) ON DELETE SET NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'viewed', 'accepted', 'rejected', 'expired', 'cancelled')),
  subtotal BIGINT NOT NULL,
  taxes BIGINT DEFAULT 0,
  fees BIGINT DEFAULT 0,
  total BIGINT NOT NULL,
  currency VARCHAR(3) DEFAULT 'USD',
  valid_until TIMESTAMP WITH TIME ZONE NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_quotes_itinerary ON quotes(itinerary_id);
CREATE INDEX idx_quotes_client ON quotes(client_id);
CREATE INDEX idx_quotes_vendor ON quotes(vendor_id);
CREATE INDEX idx_quotes_status ON quotes(status);

-- ==========================================
-- LINE ITEMS
-- ==========================================

CREATE TABLE line_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quote_id UUID REFERENCES quotes(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity INTEGER DEFAULT 1,
  unit_price BIGINT NOT NULL,
  total BIGINT NOT NULL,
  category VARCHAR(50) NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_line_items_quote ON line_items(quote_id);

-- ==========================================
-- APPROVALS
-- ==========================================

CREATE TABLE approvals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  itinerary_id UUID REFERENCES itineraries(id) ON DELETE CASCADE,
  line_item_id UUID REFERENCES line_items(id) ON DELETE SET NULL,
  approver_id UUID REFERENCES users(id) ON DELETE CASCADE,
  approver_role VARCHAR(50) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved_by_assistant', 'approved_by_family_office', 'approved_by_principal', 'rejected')),
  notes TEXT,
  budget_cap BIGINT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  resolved_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_approvals_itinerary ON approvals(itinerary_id);
CREATE INDEX idx_approvals_approver ON approvals(approver_id);
CREATE INDEX idx_approvals_status ON approvals(status);

-- ==========================================
-- PAYMENTS
-- ==========================================

CREATE TABLE payment_intents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quote_id UUID REFERENCES quotes(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  amount BIGINT NOT NULL,
  currency VARCHAR(3) DEFAULT 'USD',
  status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'succeeded', 'failed', 'cancelled', 'refunded', 'escrowed')),
  payment_method VARCHAR(50) NOT NULL CHECK (payment_method IN ('card', 'wire_transfer', 'ach', 'crypto_usdc', 'crypto_usdt')),
  stripe_payment_intent_id VARCHAR(255),
  escrow_required BOOLEAN DEFAULT false,
  escrow_release_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_payment_intents_quote ON payment_intents(quote_id);
CREATE INDEX idx_payment_intents_client ON payment_intents(client_id);
CREATE INDEX idx_payment_intents_status ON payment_intents(status);

-- ==========================================
-- LIVE UPDATES
-- ==========================================

CREATE TABLE live_update_activities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  itinerary_id UUID REFERENCES itineraries(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL CHECK (type IN ('flight_status', 'delay_alert', 'rebook_suggestion', 'arrival_countdown', 'service_reminder', 'disruption', 'milestone', 'sustainability')),
  title VARCHAR(500) NOT NULL,
  message TEXT NOT NULL,
  priority VARCHAR(50) NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE,
  metadata JSONB DEFAULT '{}',
  status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_live_updates_itinerary ON live_update_activities(itinerary_id);
CREATE INDEX idx_live_updates_client ON live_update_activities(client_id);
CREATE INDEX idx_live_updates_status ON live_update_activities(status);
CREATE INDEX idx_live_updates_priority ON live_update_activities(priority);

-- ==========================================
-- DOCUMENTS
-- ==========================================

CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  related_entity_id UUID,
  related_entity_type VARCHAR(50),
  type VARCHAR(50) NOT NULL CHECK (type IN ('passport', 'id', 'proof_of_address', 'net_worth_affidavit', 'contract', 'nda', 'invoice', 'receipt', 'insurance', 'other')),
  name VARCHAR(500) NOT NULL,
  url VARCHAR(1000) NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  size BIGINT NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'uploaded' CHECK (status IN ('uploaded', 'pending_review', 'approved', 'rejected', 'expired')),
  signature_required BOOLEAN DEFAULT false,
  signed_at TIMESTAMP WITH TIME ZONE,
  signed_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_documents_user ON documents(user_id);
CREATE INDEX idx_documents_related ON documents(related_entity_id, related_entity_type);
CREATE INDEX idx_documents_type ON documents(type);

-- ==========================================
-- FORUM & NETWORKING
-- ==========================================

CREATE TABLE forum_posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  author_id UUID REFERENCES users(id) ON DELETE CASCADE,
  pseudonym VARCHAR(100),
  title VARCHAR(500) NOT NULL,
  content TEXT NOT NULL,
  category VARCHAR(100) NOT NULL,
  tags TEXT[] DEFAULT '{}',
  is_anonymous BOOLEAN DEFAULT false,
  reply_count INTEGER DEFAULT 0,
  view_count INTEGER DEFAULT 0,
  upvotes INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_forum_posts_author ON forum_posts(author_id);
CREATE INDEX idx_forum_posts_category ON forum_posts(category);
CREATE INDEX idx_forum_posts_tags ON forum_posts USING GIN(tags);

CREATE TABLE forum_replies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID REFERENCES forum_posts(id) ON DELETE CASCADE,
  author_id UUID REFERENCES users(id) ON DELETE CASCADE,
  pseudonym VARCHAR(100),
  content TEXT NOT NULL,
  is_anonymous BOOLEAN DEFAULT false,
  upvotes INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_forum_replies_post ON forum_replies(post_id);
CREATE INDEX idx_forum_replies_author ON forum_replies(author_id);

-- ==========================================
-- RATINGS & REVIEWS
-- ==========================================

CREATE TABLE ratings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vendor_id UUID REFERENCES vendors(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  booking_id UUID, -- could reference different booking types
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review TEXT,
  categories JSONB DEFAULT '[]',
  status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'published', 'disputed', 'removed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  responded_at TIMESTAMP WITH TIME ZONE,
  response TEXT
);

CREATE INDEX idx_ratings_vendor ON ratings(vendor_id);
CREATE INDEX idx_ratings_client ON ratings(client_id);
CREATE INDEX idx_ratings_status ON ratings(status);

-- ==========================================
-- AUDIT LOGS
-- ==========================================

CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  entity_type VARCHAR(100) NOT NULL,
  entity_id UUID NOT NULL,
  action VARCHAR(100) NOT NULL,
  changes JSONB,
  ip_address INET,
  user_agent TEXT,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp);

-- ==========================================
-- WEBHOOKS
-- ==========================================

CREATE TABLE webhook_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type VARCHAR(100) NOT NULL,
  data JSONB NOT NULL,
  processed BOOLEAN DEFAULT false,
  processed_at TIMESTAMP WITH TIME ZONE,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_webhook_events_type ON webhook_events(type);
CREATE INDEX idx_webhook_events_processed ON webhook_events(processed);

-- ==========================================
-- AVIATION-SPECIFIC TABLES
-- ==========================================

CREATE TABLE aircraft (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vendor_id UUID REFERENCES vendors(id) ON DELETE CASCADE,
  type VARCHAR(100) NOT NULL,
  manufacturer VARCHAR(255) NOT NULL,
  model VARCHAR(255) NOT NULL,
  capacity INTEGER NOT NULL,
  range INTEGER NOT NULL, -- nautical miles
  speed INTEGER NOT NULL, -- knots
  safety_badges TEXT[] DEFAULT '{}',
  images TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_aircraft_vendor ON aircraft(vendor_id);

CREATE TABLE empty_legs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vendor_id UUID REFERENCES vendors(id) ON DELETE CASCADE,
  aircraft_id UUID REFERENCES aircraft(id) ON DELETE CASCADE,
  origin_code VARCHAR(10) NOT NULL,
  destination_code VARCHAR(10) NOT NULL,
  departure_date DATE NOT NULL,
  price BIGINT NOT NULL,
  currency VARCHAR(3) DEFAULT 'USD',
  flexibility_days INTEGER DEFAULT 0,
  radius_miles INTEGER DEFAULT 0,
  available_until TIMESTAMP WITH TIME ZONE NOT NULL,
  booked BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_empty_legs_vendor ON empty_legs(vendor_id);
CREATE INDEX idx_empty_legs_origin ON empty_legs(origin_code);
CREATE INDEX idx_empty_legs_destination ON empty_legs(destination_code);
CREATE INDEX idx_empty_legs_date ON empty_legs(departure_date);
CREATE INDEX idx_empty_legs_available ON empty_legs(available_until);

-- ==========================================
-- USER SESSIONS & SECURITY
-- ==========================================

CREATE TABLE user_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL,
  device_info JSONB,
  ip_address VARCHAR(45),
  user_agent TEXT,
  is_trusted BOOLEAN DEFAULT false,
  last_activity TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_user_sessions_user ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_token ON user_sessions(token_hash);
CREATE INDEX idx_user_sessions_expires ON user_sessions(expires_at);

CREATE TABLE trusted_devices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  device_fingerprint VARCHAR(255) NOT NULL,
  device_name VARCHAR(255),
  device_info JSONB,
  last_used TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_trusted_devices_user ON trusted_devices(user_id);
CREATE INDEX idx_trusted_devices_fingerprint ON trusted_devices(device_fingerprint);

-- ==========================================
-- GDPR & COMPLIANCE
-- ==========================================

CREATE TABLE data_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL CHECK (type IN ('export', 'deletion', 'correction')),
  status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  requested_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE, -- for download links
  download_url VARCHAR(1000),
  notes TEXT,
  processed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_data_requests_user ON data_requests(user_id);
CREATE INDEX idx_data_requests_status ON data_requests(status);
CREATE INDEX idx_data_requests_type ON data_requests(type);

CREATE TABLE consent_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  consent_type VARCHAR(100) NOT NULL, -- 'necessary', 'analytics', 'marketing', 'functional'
  granted BOOLEAN NOT NULL,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_consent_logs_user ON consent_logs(user_id);
CREATE INDEX idx_consent_logs_type ON consent_logs(consent_type);
CREATE INDEX idx_consent_logs_created ON consent_logs(created_at);

CREATE TABLE privacy_policies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  version VARCHAR(50) NOT NULL UNIQUE,
  content TEXT NOT NULL,
  effective_date TIMESTAMP WITH TIME ZONE NOT NULL,
  is_active BOOLEAN DEFAULT false,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_privacy_policies_active ON privacy_policies(is_active);
CREATE INDEX idx_privacy_policies_effective ON privacy_policies(effective_date);

CREATE TABLE user_privacy_acceptances (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  policy_id UUID REFERENCES privacy_policies(id) ON DELETE CASCADE,
  accepted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  ip_address INET,
  user_agent TEXT
);

CREATE INDEX idx_user_privacy_user ON user_privacy_acceptances(user_id);
CREATE INDEX idx_user_privacy_policy ON user_privacy_acceptances(policy_id);

-- ==========================================
-- EMAIL SYSTEM
-- ==========================================

CREATE TABLE email_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  to_email VARCHAR(255) NOT NULL,
  from_email VARCHAR(255) NOT NULL,
  subject VARCHAR(500) NOT NULL,
  template_name VARCHAR(100),
  template_data JSONB,
  status VARCHAR(50) NOT NULL DEFAULT 'pending', -- pending, sent, failed, bounced
  error_message TEXT,
  sent_at TIMESTAMP WITH TIME ZONE,
  opened_at TIMESTAMP WITH TIME ZONE,
  clicked_at TIMESTAMP WITH TIME ZONE,
  retry_count INTEGER DEFAULT 0,
  message_id VARCHAR(255),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_email_logs_user ON email_logs(user_id);
CREATE INDEX idx_email_logs_status ON email_logs(status);
CREATE INDEX idx_email_logs_template ON email_logs(template_name);
CREATE INDEX idx_email_logs_created ON email_logs(created_at);

-- ==========================================
-- FUNCTIONS & TRIGGERS
-- ==========================================

-- Update updated_at timestamp automatically
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply to all tables with updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON clients FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_agencies_updated_at BEFORE UPDATE ON agencies FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_designers_updated_at BEFORE UPDATE ON designers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_vendors_updated_at BEFORE UPDATE ON vendors FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_deals_updated_at BEFORE UPDATE ON deals FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_itineraries_updated_at BEFORE UPDATE ON itineraries FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_activities_updated_at BEFORE UPDATE ON activities FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_accommodations_updated_at BEFORE UPDATE ON accommodations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_transportation_updated_at BEFORE UPDATE ON transportation FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_quotes_updated_at BEFORE UPDATE ON quotes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_payment_intents_updated_at BEFORE UPDATE ON payment_intents FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_live_update_activities_updated_at BEFORE UPDATE ON live_update_activities FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_documents_updated_at BEFORE UPDATE ON documents FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_forum_posts_updated_at BEFORE UPDATE ON forum_posts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_aircraft_updated_at BEFORE UPDATE ON aircraft FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_empty_legs_updated_at BEFORE UPDATE ON empty_legs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_email_logs_updated_at BEFORE UPDATE ON email_logs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_data_requests_updated_at BEFORE UPDATE ON data_requests FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
