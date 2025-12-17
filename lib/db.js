import pg from 'pg';

const { Pool } = pg;

// Create connection pool
const pool = new Pool({
  // Use DATABASE_URL if available (Supabase/Vercel), otherwise fall back to individual env vars
  connectionString: process.env.DATABASE_URL || 
    `postgresql://${process.env.DB_USER || 'postgres'}:${process.env.DB_PASSWORD || 'mudu'}@${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || '5432'}/${process.env.DB_NAME || 'pos'}`,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// Handle pool errors
pool.on('error', (err) => {
  console.error('❌ Unexpected error on idle client', err);
  process.exit(-1);
});

pool.on('connect', () => {
  if (process.env.DEBUG) {
    console.log('✓ Database pool connected');
  }
});

/**
 * Execute a SQL query with error handling
 * @param {string} text - SQL query string with $1, $2, etc. placeholders
 * @param {array} params - Query parameters (to prevent SQL injection)
 * @returns {Promise} Result object with .rows and .rowCount
 */
export async function query(text, params = []) {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    
    if (process.env.DEBUG) {
      console.log('✓ Query executed', { 
        rows: result.rowCount, 
        duration: `${duration}ms`
      });
    }
    
    return result;
  } catch (error) {
    console.error('❌ Database query failed:', error.message);
    if (process.env.DEBUG) {
      console.error('Query:', text);
      console.error('Params:', params);
    }
    throw error;
  }
}

/**
 * Get a client from the pool for transactions
 * @returns {Promise<Client>} Client object
 */
export async function getClient() {
  try {
    const client = await pool.connect();
    if (process.env.DEBUG) {
      console.log('✓ Client acquired from pool');
    }
    return client;
  } catch (err) {
    console.error('❌ Failed to get client:', err.message);
    throw err;
  }
}

/**
 * Close the pool connection
 */
export async function closePool() {
  try {
    await pool.end();
    console.log('✓ Database pool closed');
  } catch (err) {
    console.error('❌ Error closing pool:', err.message);
    throw err;
  }
}

/**
 * Health check - test database connection
 */
export async function healthCheck() {
  try {
    const result = await query('SELECT 1');
    return { status: 'healthy', connected: true };
  } catch (err) {
    return { status: 'unhealthy', connected: false, error: err.message };
  }
}
