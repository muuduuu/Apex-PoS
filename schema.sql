-- Users
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'cashier')),
  name VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Items
CREATE TABLE items (
  id SERIAL PRIMARY KEY,
  name_en VARCHAR(255) NOT NULL,
  name_ar VARCHAR(255),
  price_per_unit NUMERIC(10,3) NOT NULL,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Sales
CREATE TABLE sales (
  id SERIAL PRIMARY KEY,
  sale_number VARCHAR(20) UNIQUE NOT NULL,
  user_id INTEGER REFERENCES users(id),
  subtotal NUMERIC(12,3) NOT NULL,
  discount_amount NUMERIC(12,3) DEFAULT 0,
  discount_percentage NUMERIC(5,2) DEFAULT 0,
  total_amount NUMERIC(12,3) NOT NULL,
  payment_method VARCHAR(20) NOT NULL,
  knet_reference VARCHAR(100),
  cheque_number VARCHAR(50),
  notes TEXT,
  status VARCHAR(20) DEFAULT 'completed',
  sale_date TIMESTAMP DEFAULT NOW()
);

-- Sale Items
CREATE TABLE sale_items (
  id SERIAL PRIMARY KEY,
  sale_id INTEGER REFERENCES sales(id) ON DELETE CASCADE,
  item_id INTEGER REFERENCES items(id),
  item_name_en VARCHAR(255),
  item_name_ar VARCHAR(255),
  quantity NUMERIC(8,3),
  unit_price NUMERIC(10,3),
  line_total NUMERIC(12,3)
);

-- Contractors
CREATE TABLE contractors (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  company_name VARCHAR(255),
  phone VARCHAR(20),
  email VARCHAR(100),
  address TEXT,
  credit_limit NUMERIC(12,3) DEFAULT 0,
  total_credits NUMERIC(12,3) DEFAULT 0,
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Credit Transactions
CREATE TABLE credit_transactions (
  id SERIAL PRIMARY KEY,
  contractor_id INTEGER REFERENCES contractors(id),
  sale_id INTEGER REFERENCES sales(id),
  transaction_type VARCHAR(50),
  amount NUMERIC(12,3),
  description TEXT,
  balance_after NUMERIC(12,3),
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Audit Logs
CREATE TABLE audit_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  action VARCHAR(100),
  details TEXT,
  contractor_id INTEGER REFERENCES contractors(id),
  timestamp TIMESTAMP DEFAULT NOW()
);

-- Refunds
CREATE TABLE refunds (
  id SERIAL PRIMARY KEY,
  refund_number VARCHAR(20) UNIQUE NOT NULL,
  sale_id INTEGER REFERENCES sales(id),
  amount NUMERIC(12,3),
  reason TEXT,
  created_by_user_id INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create test admin user
INSERT INTO users (username, password_hash, role, name) 
VALUES ('admin', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin', 'Admin');
-- Password: password
