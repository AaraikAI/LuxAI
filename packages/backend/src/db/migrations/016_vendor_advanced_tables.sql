-- 016_vendor_advanced_tables.sql
-- Advanced Vendor Features: Inventory, Availability, Pricing, Promotions

-- Vendor inventory items
CREATE TABLE IF NOT EXISTS vendor_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100),
  sku VARCHAR(100),
  quantity INT DEFAULT 0,
  min_quantity INT DEFAULT 0,
  unit VARCHAR(50), -- 'item', 'hour', 'day', 'person', etc.
  base_price DECIMAL(10, 2),
  is_active BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_vendor_inventory_vendor_id ON vendor_inventory(vendor_id);
CREATE INDEX idx_vendor_inventory_category ON vendor_inventory(category);
CREATE INDEX idx_vendor_inventory_is_active ON vendor_inventory(is_active);

-- Vendor availability calendar
CREATE TABLE IF NOT EXISTS vendor_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  inventory_id UUID REFERENCES vendor_inventory(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  start_time TIME,
  end_time TIME,
  available_quantity INT,
  is_available BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(vendor_id, inventory_id, date, start_time)
);

CREATE INDEX idx_vendor_availability_vendor_id ON vendor_availability(vendor_id);
CREATE INDEX idx_vendor_availability_inventory_id ON vendor_availability(inventory_id);
CREATE INDEX idx_vendor_availability_date ON vendor_availability(date);

-- Dynamic pricing rules
CREATE TABLE IF NOT EXISTS pricing_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  inventory_id UUID REFERENCES vendor_inventory(id) ON DELETE CASCADE,
  rule_type VARCHAR(50) NOT NULL, -- 'seasonal', 'demand', 'duration', 'volume', 'early_bird'
  rule_name VARCHAR(255) NOT NULL,
  conditions JSONB NOT NULL,
  adjustment_type VARCHAR(20) NOT NULL, -- 'percentage', 'fixed'
  adjustment_value DECIMAL(10, 2) NOT NULL,
  priority INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  start_date DATE,
  end_date DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_pricing_rules_vendor_id ON pricing_rules(vendor_id);
CREATE INDEX idx_pricing_rules_inventory_id ON pricing_rules(inventory_id);
CREATE INDEX idx_pricing_rules_is_active ON pricing_rules(is_active);
CREATE INDEX idx_pricing_rules_dates ON pricing_rules(start_date, end_date);

-- Promotional campaigns
CREATE TABLE IF NOT EXISTS promotional_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  campaign_type VARCHAR(50) NOT NULL, -- 'discount', 'bundle', 'flash_sale', 'loyalty'
  discount_type VARCHAR(20), -- 'percentage', 'fixed', 'buy_x_get_y'
  discount_value DECIMAL(10, 2),
  min_purchase_amount DECIMAL(10, 2),
  max_discount_amount DECIMAL(10, 2),
  usage_limit INT,
  usage_count INT DEFAULT 0,
  promo_code VARCHAR(50) UNIQUE,
  applicable_items JSONB, -- Array of inventory IDs
  start_date TIMESTAMP NOT NULL,
  end_date TIMESTAMP NOT NULL,
  is_active BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_promotional_campaigns_vendor_id ON promotional_campaigns(vendor_id);
CREATE INDEX idx_promotional_campaigns_promo_code ON promotional_campaigns(promo_code);
CREATE INDEX idx_promotional_campaigns_dates ON promotional_campaigns(start_date, end_date);
CREATE INDEX idx_promotional_campaigns_is_active ON promotional_campaigns(is_active);

-- Campaign usage tracking
CREATE TABLE IF NOT EXISTS campaign_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES promotional_campaigns(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  booking_id UUID,
  discount_amount DECIMAL(10, 2),
  used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_campaign_usage_campaign_id ON campaign_usage(campaign_id);
CREATE INDEX idx_campaign_usage_user_id ON campaign_usage(user_id);

COMMENT ON TABLE vendor_inventory IS 'Vendor inventory management';
COMMENT ON TABLE vendor_availability IS 'Vendor availability calendar';
COMMENT ON TABLE pricing_rules IS 'Dynamic pricing rules for vendors';
COMMENT ON TABLE promotional_campaigns IS 'Vendor promotional campaigns and discounts';
COMMENT ON TABLE campaign_usage IS 'Campaign usage tracking';
