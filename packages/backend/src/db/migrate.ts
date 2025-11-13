import { readFileSync } from 'fs';
import { join } from 'path';
import { getPool } from './index';
import { logger } from '../utils/logger';

async function migrate() {
  const pool = getPool();

  try {
    logger.info('Starting database migration...');

    // Read the schema SQL file
    const schemaPath = join(__dirname, 'schema.sql');
    const schema = readFileSync(schemaPath, 'utf-8');

    // Execute the schema
    await pool.query(schema);

    logger.info('Database migration completed successfully');
    process.exit(0);
  } catch (error) {
    logger.error('Database migration failed', error);
    console.error('Detailed error:', error);
    process.exit(1);
  }
}

migrate();
