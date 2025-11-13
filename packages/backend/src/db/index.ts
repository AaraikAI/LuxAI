import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import { config } from '../config';
import { logger } from '../utils/logger';

let pool: Pool | null = null;

export const getPool = (): Pool => {
  if (!pool) {
    pool = new Pool({
      connectionString: config.database.url,
      max: config.database.maxConnections,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
      ssl: config.database.url.includes('supabase.co')
        ? {
            rejectUnauthorized: false, // Supabase uses self-signed certs in some regions
          }
        : false,
    });

    pool.on('error', (err) => {
      logger.error('Unexpected error on idle client', err);
      process.exit(-1);
    });

    logger.info('Database pool initialized');
  }

  return pool;
};

export const query = async <T extends QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<QueryResult<T>> => {
  const start = Date.now();
  const pool = getPool();

  try {
    const result = await pool.query<T>(text, params);
    const duration = Date.now() - start;

    logger.debug('Query executed', {
      text,
      duration,
      rows: result.rowCount,
    });

    return result;
  } catch (error) {
    logger.error('Query error', { text, error });
    throw error;
  }
};

export const getClient = async (): Promise<PoolClient> => {
  const pool = getPool();
  return pool.connect();
};

export const closePool = async (): Promise<void> => {
  if (pool) {
    await pool.end();
    pool = null;
    logger.info('Database pool closed');
  }
};

// Transaction helper
export const withTransaction = async <T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> => {
  const client = await getClient();

  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};
