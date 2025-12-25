import { Pool } from 'pg';

const pool = new Pool({
  user: 'posuser',
  password: 'SecurePosPass2025!',
  host: 'localhost',
  database: 'posdb',
  port: 5432,
});

async function initDB() {
  try {
    const client = await pool.connect();
    console.log('✅ Database connected');
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role VARCHAR(20) DEFAULT 'cashier',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Users table created');
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS sales (
        id SERIAL PRIMARY KEY,
        sale_number VARCHAR(50) UNIQUE NOT NULL,
        user_id INTEGER REFERENCES users(id),
        subtotal NUMERIC(10,3) DEFAULT 0,
        total_amount NUMERIC(10,3) DEFAULT 0,
        sale_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Sales table created');
    
    client.release();
    console.log('✅ Migration complete! 🎉');
  } catch (error) {
    console.error('❌ Database migration failed:', error.message);
  } finally {
    await pool.end();
  }
}

initDB();
