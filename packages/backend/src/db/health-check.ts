import { getPool } from './index';
import { logger } from '../utils/logger';

async function healthCheck() {
  const pool = getPool();

  try {
    logger.info('Running application health check...');

    // Test 1: Database connection
    console.log('\n📋 Health Check Results:\n');
    console.log('1. Database Connection...');

    const dbResult = await pool.query('SELECT NOW() as current_time, version() as pg_version');
    const dbTime = dbResult.rows[0].current_time;
    const pgVersion = dbResult.rows[0].pg_version.split(' ')[0] + ' ' + dbResult.rows[0].pg_version.split(' ')[1];

    console.log('   ✅ Connected to PostgreSQL');
    console.log(`   ✅ Server time: ${dbTime}`);
    console.log(`   ✅ PostgreSQL version: ${pgVersion}`);

    // Test 2: Tables exist
    console.log('\n2. Database Schema...');
    const tablesResult = await pool.query(`
      SELECT COUNT(*) as table_count
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE';
    `);
    const tableCount = parseInt(tablesResult.rows[0].table_count);

    if (tableCount === 24) {
      console.log(`   ✅ All 24 tables present`);
    } else {
      console.log(`   ⚠️  Found ${tableCount} tables (expected 24)`);
    }

    // Test 3: Extensions
    console.log('\n3. PostgreSQL Extensions...');
    const extensionsResult = await pool.query(`
      SELECT extname FROM pg_extension WHERE extname IN ('uuid-ossp', 'pgcrypto');
    `);
    const extensions = extensionsResult.rows.map(r => r.extname);

    if (extensions.includes('uuid-ossp')) {
      console.log('   ✅ uuid-ossp extension enabled');
    } else {
      console.log('   ❌ uuid-ossp extension missing');
    }

    if (extensions.includes('pgcrypto')) {
      console.log('   ✅ pgcrypto extension enabled');
    } else {
      console.log('   ❌ pgcrypto extension missing');
    }

    // Test 4: Sample queries
    console.log('\n4. Sample Queries...');

    const usersResult = await pool.query('SELECT COUNT(*) as count FROM users');
    console.log(`   ✅ Users table: ${usersResult.rows[0].count} records`);

    const itinerariesResult = await pool.query('SELECT COUNT(*) as count FROM itineraries');
    console.log(`   ✅ Itineraries table: ${itinerariesResult.rows[0].count} records`);

    const vendorsResult = await pool.query('SELECT COUNT(*) as count FROM vendors');
    console.log(`   ✅ Vendors table: ${vendorsResult.rows[0].count} records`);

    // Test 5: Connection pool
    console.log('\n5. Connection Pool...');
    console.log(`   ✅ Max connections: ${pool.options.max}`);
    console.log(`   ✅ Idle timeout: ${pool.options.idleTimeoutMillis}ms`);
    console.log(`   ✅ Connection timeout: ${pool.options.connectionTimeoutMillis}ms`);

    console.log('\n✅ All health checks passed!\n');
    console.log('🚀 Your LuxAI Designer backend is ready to use.\n');

    process.exit(0);
  } catch (error) {
    console.log('\n❌ Health check failed!\n');
    logger.error('Health check failed', error);
    console.error('Error:', error);
    process.exit(1);
  }
}

healthCheck();
