/**
 * Database Migration File
 * Run this to create all POS system tables
 * 
 * Usage:
 * node scripts/init-db.js
 */

import { query } from '../lib/db.js';

async function initDatabase() {
  try {
    console.log('🔄 Starting database migration...\n');

    // ==================== USERS TABLE ====================
    console.log('📝 Creating users table...');
    await query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        name VARCHAR(100) NOT NULL,
        role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'cashier')),
        active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
      CREATE INDEX IF NOT EXISTS idx_users_active ON users(active);
    `);
    console.log('✅ Users table ready\n');

    // ==================== ITEMS TABLE ====================
    console.log('📝 Creating items table...');
    await query(`
      CREATE TABLE IF NOT EXISTS items (
        id SERIAL PRIMARY KEY,
        name_en VARCHAR(100) NOT NULL,
        name_ar VARCHAR(100) NOT NULL,
        unit VARCHAR(20) NOT NULL DEFAULT 'cbm',
        price_per_unit NUMERIC(10, 3) NOT NULL CHECK (price_per_unit > 0),
        active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX IF NOT EXISTS idx_items_active ON items(active);
      CREATE INDEX IF NOT EXISTS idx_items_name_en ON items(name_en);
    `);
    console.log('✅ Items table ready\n');

    // ==================== SALES TABLE ====================
    console.log('📝 Creating sales table...');
    await query(`
      CREATE TABLE IF NOT EXISTS sales (
        id SERIAL PRIMARY KEY,
        sale_number VARCHAR(50) UNIQUE NOT NULL,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        contractor_id INTEGER REFERENCES contractors(id) ON DELETE SET NULL,
        subtotal NUMERIC(10, 3) NOT NULL CHECK (subtotal >= 0),
        discount_amount NUMERIC(10, 3) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
        discount_percentage NUMERIC(5, 2) NOT NULL DEFAULT 0 CHECK (discount_percentage >= 0 AND discount_percentage <= 100),
        total_amount NUMERIC(10, 3) NOT NULL CHECK (total_amount >= 0),
        payment_method VARCHAR(20) NOT NULL CHECK (payment_method IN ('cash', 'knet', 'cheque', 'credit')),
        knet_reference VARCHAR(50),
        cheque_number VARCHAR(50),
        notes TEXT,
        status VARCHAR(20) NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'refunded', 'cancelled')),
        sale_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX IF NOT EXISTS idx_sales_user_id ON sales(user_id);
      CREATE INDEX IF NOT EXISTS idx_sales_contractor_id ON sales(contractor_id);
      CREATE INDEX IF NOT EXISTS idx_sales_sale_number ON sales(sale_number);
      CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(sale_date);
      CREATE INDEX IF NOT EXISTS idx_sales_status ON sales(status);
      CREATE INDEX IF NOT EXISTS idx_sales_payment_method ON sales(payment_method);
    `);
    console.log('✅ Sales table ready\n');

    // ==================== SALE ITEMS TABLE ====================
    console.log('📝 Creating sale_items table...');
    await query(`
      CREATE TABLE IF NOT EXISTS sale_items (
        id SERIAL PRIMARY KEY,
        sale_id INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
        item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE RESTRICT,
        item_name_en VARCHAR(100) NOT NULL,
        item_name_ar VARCHAR(100) NOT NULL,
        quantity NUMERIC(10, 2) NOT NULL CHECK (quantity > 0),
        unit_price NUMERIC(10, 3) NOT NULL CHECK (unit_price > 0),
        line_total NUMERIC(10, 3) NOT NULL CHECK (line_total > 0),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON sale_items(sale_id);
      CREATE INDEX IF NOT EXISTS idx_sale_items_item_id ON sale_items(item_id);
    `);
    console.log('✅ Sale Items table ready\n');

    // ==================== REFUNDS TABLE ====================
    console.log('📝 Creating refunds table...');
    await query(`
      CREATE TABLE IF NOT EXISTS refunds (
        id SERIAL PRIMARY KEY,
        refund_number VARCHAR(50) UNIQUE NOT NULL,
        sale_id INTEGER NOT NULL REFERENCES sales(id) ON DELETE RESTRICT,
        amount NUMERIC(10, 3) NOT NULL CHECK (amount > 0),
        reason TEXT NOT NULL,
        created_by_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX IF NOT EXISTS idx_refunds_sale_id ON refunds(sale_id);
      CREATE INDEX IF NOT EXISTS idx_refunds_refund_number ON refunds(refund_number);
      CREATE INDEX IF NOT EXISTS idx_refunds_created_at ON refunds(created_at);
      CREATE INDEX IF NOT EXISTS idx_refunds_created_by ON refunds(created_by_user_id);
    `);
    console.log('✅ Refunds table ready\n');

    // ==================== AUDIT LOGS TABLE ====================
    console.log('📝 Creating audit_logs table...');
    await query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        action VARCHAR(100) NOT NULL,
        details TEXT,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);
    `);
    console.log('✅ Audit Logs table ready\n');

    // ==================== SEED DATA ====================
    console.log('📝 Seeding initial data...');

    // Check if users already exist
    const usersCheck = await query('SELECT COUNT(*) as count FROM users');
    if (usersCheck.rows[0].count === 0) {
      // Import bcrypt for password hashing (install: npm install bcryptjs)
      const bcrypt = require('bcryptjs');
      
      const adminPasswordHash = await bcrypt.hash('admin123', 10);
      const cashierPasswordHash = await bcrypt.hash('cashier123', 10);

      await query(`
        INSERT INTO users (username, password_hash, name, role) VALUES
        ($1, $2, $3, $4),
        ($5, $6, $7, $8)
      `, ['admin', adminPasswordHash, 'Administrator', 'admin', 'cashier1', cashierPasswordHash, 'Cashier 1', 'cashier']);
      
      console.log('✅ Users seeded (admin, cashier1)');
    }

    // Check if items already exist
    const itemsCheck = await query('SELECT COUNT(*) as count FROM items');
    if (itemsCheck.rows[0].count === 0) {
      await query(`
        INSERT INTO items (name_en, name_ar, unit, price_per_unit) VALUES
        ($1, $2, $3, $4),
        ($5, $6, $7, $8),
        ($9, $10, $11, $12)
      `, [
        'Washed Sand', 'الرمل المغسول', 'cbm', 15.500,
        'Sand', 'رمل', 'cbm', 12.000,
        'Gatch', 'جتش', 'cbm', 18.750
      ]);
      
      console.log('✅ Items seeded (Washed Sand, Sand, Gatch)');
    }

    console.log('\n✅ Database migration completed successfully!\n');
    console.log('📊 Tables created:');
    console.log('   - users');
    console.log('   - items');
    console.log('   - sales');
    console.log('   - sale_items');
    console.log('   - refunds');
    console.log('   - audit_logs\n');
    console.log('👤 Demo accounts:');
    console.log('   - admin / admin123');
    console.log('   - cashier1 / cashier123\n');

  } catch (err) {
    console.error('❌ Database migration failed:', err.message);
    process.exit(1);
  }
}

// Run migration
initDatabase();