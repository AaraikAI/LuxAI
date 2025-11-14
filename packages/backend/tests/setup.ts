import { getPool } from '../src/db';
import { config } from '../src/config';

// Test database configuration
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || config.database.url;
process.env.NODE_ENV = 'test';

// Global test setup
beforeAll(async () => {
  // Setup test database or mock connections
  console.log('Test suite starting...');
});

// Global test teardown
afterAll(async () => {
  const pool = getPool();
  await pool.end();
  console.log('Test suite completed');
});

// Helper to clean database between tests
export async function cleanDatabase() {
  const pool = getPool();

  // Delete test data in reverse dependency order
  await pool.query('TRUNCATE TABLE email_logs CASCADE');
  await pool.query('TRUNCATE TABLE forum_replies CASCADE');
  await pool.query('TRUNCATE TABLE forum_posts CASCADE');
  await pool.query('TRUNCATE TABLE live_update_activities CASCADE');
  await pool.query('TRUNCATE TABLE documents CASCADE');
  await pool.query('TRUNCATE TABLE payment_intents CASCADE');
  await pool.query('TRUNCATE TABLE webhook_events CASCADE');
  await pool.query('TRUNCATE TABLE approvals CASCADE');
  await pool.query('TRUNCATE TABLE ratings CASCADE');
  await pool.query('TRUNCATE TABLE deals CASCADE');
  await pool.query('TRUNCATE TABLE quotes CASCADE');
  await pool.query('TRUNCATE TABLE empty_legs CASCADE');
  await pool.query('TRUNCATE TABLE aircraft CASCADE');
  await pool.query('TRUNCATE TABLE line_items CASCADE');
  await pool.query('TRUNCATE TABLE activities CASCADE');
  await pool.query('TRUNCATE TABLE transportation CASCADE');
  await pool.query('TRUNCATE TABLE accommodations CASCADE');
  await pool.query('TRUNCATE TABLE destinations CASCADE');
  await pool.query('TRUNCATE TABLE itineraries CASCADE');
  await pool.query('TRUNCATE TABLE vendors CASCADE');
  await pool.query('TRUNCATE TABLE designers CASCADE');
  await pool.query('TRUNCATE TABLE clients CASCADE');
  await pool.query('TRUNCATE TABLE agencies CASCADE');
  await pool.query('TRUNCATE TABLE users CASCADE');
  await pool.query('TRUNCATE TABLE audit_logs CASCADE');
}
