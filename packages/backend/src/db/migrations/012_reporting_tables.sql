-- 012_reporting_tables.sql
-- Advanced Reporting: Custom Reports, Templates, and Scheduling

-- Report templates table
CREATE TABLE IF NOT EXISTS report_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  category VARCHAR(50) NOT NULL, -- 'financial', 'analytics', 'operations', 'compliance'
  config JSONB NOT NULL, -- Report configuration (columns, filters, aggregations)
  is_system BOOLEAN DEFAULT false, -- System templates cannot be deleted
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_report_templates_category ON report_templates(category);
CREATE INDEX idx_report_templates_is_system ON report_templates(is_system);

-- Custom reports table
CREATE TABLE IF NOT EXISTS custom_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  template_id UUID REFERENCES report_templates(id) ON DELETE SET NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  config JSONB NOT NULL,
  is_scheduled BOOLEAN DEFAULT false,
  schedule_cron VARCHAR(100), -- Cron expression for scheduled reports
  last_run_at TIMESTAMP,
  next_run_at TIMESTAMP,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_custom_reports_user_id ON custom_reports(user_id);
CREATE INDEX idx_custom_reports_template_id ON custom_reports(template_id);
CREATE INDEX idx_custom_reports_is_scheduled ON custom_reports(is_scheduled);
CREATE INDEX idx_custom_reports_next_run_at ON custom_reports(next_run_at);

-- Report executions/history table
CREATE TABLE IF NOT EXISTS report_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES custom_reports(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending', 'running', 'completed', 'failed'
  result_data JSONB,
  error_message TEXT,
  execution_time_ms INT,
  row_count INT DEFAULT 0,
  file_url VARCHAR(500), -- URL to generated file (CSV, PDF, etc.)
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_report_executions_report_id ON report_executions(report_id);
CREATE INDEX idx_report_executions_user_id ON report_executions(user_id);
CREATE INDEX idx_report_executions_status ON report_executions(status);
CREATE INDEX idx_report_executions_created_at ON report_executions(created_at DESC);

-- Insert default system report templates
INSERT INTO report_templates (name, description, category, config, is_system, created_by) VALUES
(
  'User Activity Report',
  'Overview of user registrations, logins, and activity',
  'analytics',
  '{
    "entity": "users",
    "columns": ["email", "full_name", "role", "created_at", "last_login_at"],
    "aggregations": [
      {"field": "id", "function": "count", "alias": "total_users"},
      {"field": "last_login_at", "function": "max", "alias": "last_activity"}
    ],
    "groupBy": ["role"],
    "orderBy": [{"field": "created_at", "direction": "DESC"}]
  }'::jsonb,
  true,
  NULL
),
(
  'Revenue Report',
  'Financial overview of bookings and payments',
  'financial',
  '{
    "entity": "bookings",
    "columns": ["booking_reference", "status", "total_amount", "created_at"],
    "aggregations": [
      {"field": "total_amount", "function": "sum", "alias": "total_revenue"},
      {"field": "id", "function": "count", "alias": "booking_count"}
    ],
    "filters": [
      {"field": "status", "operator": "in", "value": ["confirmed", "completed"]}
    ],
    "orderBy": [{"field": "created_at", "direction": "DESC"}]
  }'::jsonb,
  true,
  NULL
),
(
  'Itinerary Performance',
  'Analytics on itinerary creation and conversion',
  'analytics',
  '{
    "entity": "itineraries",
    "columns": ["title", "destination", "status", "created_at"],
    "aggregations": [
      {"field": "id", "function": "count", "alias": "total_itineraries"}
    ],
    "groupBy": ["status", "destination"],
    "orderBy": [{"field": "created_at", "direction": "DESC"}]
  }'::jsonb,
  true,
  NULL
),
(
  'Vendor Performance',
  'Vendor ratings and booking statistics',
  'operations',
  '{
    "entity": "vendors",
    "columns": ["company_name", "category", "location"],
    "aggregations": [
      {"field": "id", "function": "count", "alias": "total_vendors"}
    ],
    "groupBy": ["category"],
    "orderBy": [{"field": "company_name", "direction": "ASC"}]
  }'::jsonb,
  true,
  NULL
),
(
  'GDPR Compliance Report',
  'Data requests and privacy policy compliance',
  'compliance',
  '{
    "entity": "data_requests",
    "columns": ["request_type", "status", "created_at", "processed_at"],
    "aggregations": [
      {"field": "id", "function": "count", "alias": "total_requests"}
    ],
    "groupBy": ["request_type", "status"],
    "orderBy": [{"field": "created_at", "direction": "DESC"}]
  }'::jsonb,
  true,
  NULL
)
ON CONFLICT DO NOTHING;

COMMENT ON TABLE report_templates IS 'Reusable report templates for common reporting needs';
COMMENT ON TABLE custom_reports IS 'User-created custom reports with scheduling support';
COMMENT ON TABLE report_executions IS 'History of report executions with results';
