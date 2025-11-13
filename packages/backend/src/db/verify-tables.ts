import { getPool } from './index';
import { logger } from '../utils/logger';

async function verifyTables() {
  const pool = getPool();

  try {
    logger.info('Checking database tables...');

    // Query to get all tables in the public schema
    const result = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);

    const tables = result.rows.map(row => row.table_name);

    console.log('\n=== DATABASE TABLES ===');
    console.log(`Total tables found: ${tables.length}\n`);

    tables.forEach((table, index) => {
      console.log(`${(index + 1).toString().padStart(2)}. ${table}`);
    });

    // Expected tables
    const expectedTables = [
      'accommodations',
      'activities',
      'agencies',
      'aircraft',
      'approvals',
      'audit_logs',
      'clients',
      'deals',
      'designers',
      'destinations',
      'documents',
      'empty_legs',
      'forum_posts',
      'forum_replies',
      'itineraries',
      'line_items',
      'live_update_activities',
      'payment_intents',
      'quotes',
      'ratings',
      'transportation',
      'users',
      'vendors',
      'webhook_events',
    ];

    console.log(`\n=== VERIFICATION ===`);
    console.log(`Expected: ${expectedTables.length} tables`);
    console.log(`Found: ${tables.length} tables`);

    const missing = expectedTables.filter(t => !tables.includes(t));
    const extra = tables.filter(t => !expectedTables.includes(t));

    if (missing.length > 0) {
      console.log(`\n❌ Missing tables: ${missing.join(', ')}`);
    }

    if (extra.length > 0) {
      console.log(`\n✅ Extra tables (not expected): ${extra.join(', ')}`);
    }

    if (missing.length === 0 && extra.length === 0) {
      console.log('\n✅ All tables created successfully!');
    } else if (missing.length === 0) {
      console.log('\n✅ All expected tables are present!');
    }

    // Check row counts for each table
    console.log('\n=== ROW COUNTS ===');
    for (const table of tables) {
      const countResult = await pool.query(`SELECT COUNT(*) FROM "${table}"`);
      const count = parseInt(countResult.rows[0].count);
      console.log(`${table.padEnd(30)} ${count} rows`);
    }

    process.exit(0);
  } catch (error) {
    logger.error('Table verification failed', error);
    console.error('Error:', error);
    process.exit(1);
  }
}

verifyTables();
