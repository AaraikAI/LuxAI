-- GDPR Export Files Storage
-- Store temporary export data for download

CREATE TABLE IF NOT EXISTS gdpr_export_files (
  request_id UUID PRIMARY KEY REFERENCES data_requests(id) ON DELETE CASCADE,
  data TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  downloaded_at TIMESTAMP
);

-- Index for cleanup of expired files
CREATE INDEX IF NOT EXISTS idx_gdpr_export_files_expires_at ON gdpr_export_files(expires_at);

-- Comment
COMMENT ON TABLE gdpr_export_files IS 'Temporary storage for GDPR data exports (auto-cleanup after 7 days)';
COMMENT ON COLUMN gdpr_export_files.data IS 'JSON export data (in production, use S3 or similar)';
COMMENT ON COLUMN gdpr_export_files.expires_at IS 'Expiration time (7 days from creation)';
