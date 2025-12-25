import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import bcryptjs from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from './lib/db.js';

console.log('DB INFO:', {
  DATABASE_URL: process.env.DATABASE_URL,
  DB_USER: process.env.DB_USER,
  DB_HOST: process.env.DB_HOST,
  DB_NAME: process.env.DB_NAME,
});

const app = express();
const PORT = process.env.PORT || 3000;

// ✅ FIXED CORS - Add this immediately after app = express()
app.use(cors({
  origin: ['https://apexgroupintl.space', 'https://www.apexgroupintl.space', 'http://localhost:4173'],
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
// ✅ JWT CONFIG
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production-12345';
const JWT_EXPIRES_IN = '7d';

app.get('/health', async (req, res) => {
  try {
    await query('SELECT 1');
    res.json({ 
      status: 'ok', 
      database: 'connected', 
      timestamp: new Date().toISOString() 
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'error', 
      database: 'disconnected', 
      error: error.message 
    });
  }
});
app.use(express.json());

// ==================== JWT MIDDLEWARE ====================
// ✅ NEW: Verify JWT token from Authorization header
const authenticateJWT = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const userResult = await query('SELECT id, username, role, name FROM users WHERE id = $1', [decoded.userId]);
    
    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'User not found' });
    }

    req.user = userResult.rows[0];
    next();
  } catch (error) {
    console.error('JWT verification error:', error.message);
    res.status(403).json({ error: 'Invalid or expired token' });
  }
};

// ==================== AUTHENTICATION ====================

// POST /api/auth/login - ✅ UPDATED: Return JWT token
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    console.log('LOGIN ATTEMPT:', { username });

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }
    
    const result = await query('SELECT * FROM users WHERE username = $1', [username]);

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];
    const passwordMatch = await bcryptjs.compare(password, user.password_hash);

    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // ✅ NEW: Generate JWT token
    const token = jwt.sign(
      { userId: user.id }, 
      JWT_SECRET, 
      { expiresIn: JWT_EXPIRES_IN }
    );

    // Log the login
    await query(
      'INSERT INTO audit_logs (user_id, action, details) VALUES ($1, $2, $3)',
      [user.id, 'LOGIN', `User ${username} logged in`]
    );

    const { password_hash, ...userWithoutPassword } = user;
    res.json({ 
      user: userWithoutPassword,
      token  // ✅ NEW: Frontend stores this in localStorage
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});
app.post('/api/debug-login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const result = await query('SELECT * FROM users WHERE username = $1', [username]);
    const user = result.rows[0];

    if (!user) return res.json({ error: 'User not found', found: false });


    const match = await bcryptjs.compare(password, user.password_hash);

    res.json({ 
      found: true, 
      username: user.username, 
      hash_preview: user.password_hash.substring(0, 30) + '...',
      password_match: match,
      full_hash: user.password_hash
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// GET /api/auth/me - ✅ UPDATED: Protected, verify JWT
app.get('/api/auth/me', authenticateJWT, (req, res) => {
  res.json({ user: req.user });
});

// POST /api/auth/logout - ✅ NEW: Just for consistency
app.post('/api/auth/logout', (req, res) => {
  res.json({ message: 'Logged out successfully' });
});

// ==================== USERS (Admin only) ====================

// POST /api/users - ✅ UPDATED: Protected, admin-only
app.post('/api/users', authenticateJWT, async (req, res) => {
  try {
    const currentUser = req.user;
    if (currentUser.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    console.log('Creating user request:', req.body);

    const { username, password, role } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }
    if (username.length < 3) {
      return res.status(400).json({ error: 'Username must be at least 3 characters' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    if (!['admin', 'cashier'].includes(role)) {
      return res.status(400).json({ error: 'Role must be "admin" or "cashier"' });
    }

    const existingUser = await query('SELECT id FROM users WHERE username = $1', [username]);
    if (existingUser.rows.length > 0) {
      return res.status(409).json({ error: 'Username already exists' });
    }

    const hashedPassword = await bcryptjs.hash(password, 10);
    const newUser = await query(
      `INSERT INTO users (username, password_hash, role, name, created_at) 
       VALUES ($1, $2, $3, $4, NOW()) 
       RETURNING id, username, role, name`,
      [username, hashedPassword, role, username]
    );

    console.log(`✅ User created: ${username} (${role}) ID: ${newUser.rows[0].id}`);

    res.status(201).json(newUser.rows[0]);
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ==================== ITEMS ====================

// POST /api/items - ✅ UPDATED: Protected
app.post('/api/items', authenticateJWT, async (req, res) => {
  try {
    const { name_en, name_ar, price_per_unit } = req.body;

    if (!name_en || !name_ar || !price_per_unit) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const result = await query(
      'INSERT INTO items (name_en, name_ar, price_per_unit, active) VALUES ($1, $2, $3, true) RETURNING *',
      [name_en, name_ar, price_per_unit]
    );

    await query(
      'INSERT INTO audit_logs (user_id, action, details) VALUES ($1, $2, $3)',
      [req.user.id, 'CREATE_ITEM', `Created item: ${name_en}`]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating item:', error);
    res.status(500).json({ error: 'Failed to create item' });
  }
});

// GET /api/items - ✅ UPDATED: Protected
app.get('/api/items', authenticateJWT, async (req, res) => {
  try {
    const result = await query('SELECT * FROM items WHERE active = true ORDER BY name_en');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching items:', error);
    res.status(500).json({ error: 'Failed to fetch items' });
  }
});

// PATCH /api/items/:id/price - ✅ UPDATED: Protected
app.patch('/api/items/:id/price', authenticateJWT, async (req, res) => {
  try {
    const { price_per_unit } = req.body;
    const result = await query(
      'UPDATE items SET price_per_unit = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [price_per_unit, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating price:', error);
    res.status(500).json({ error: 'Failed to update price' });
  }
});

// DELETE /api/items/:id - ✅ UPDATED: Protected
app.delete('/api/items/:id', authenticateJWT, async (req, res) => {
  try {
    const result = await query('DELETE FROM items WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting item:', error);
    res.status(500).json({ error: 'Failed to delete item' });
  }
});

// PATCH /api/items/:id/status - ✅ UPDATED: Protected
app.patch('/api/items/:id/status', authenticateJWT, async (req, res) => {
  try {
    await query('UPDATE items SET active = NOT active WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating status:', error);
    res.status(500).json({ error: 'Failed to update status' });
  }
});

// ==================== SALES ====================

// POST /api/sales - ✅ UPDATED: Protected, use req.user.id
app.post('/api/sales', authenticateJWT, async (req, res) => {
  try {
    const {
      items: saleItems,
      subtotal,
      discount_amount,
      discount_percentage,
      total_amount,
      payment_method,
      knet_reference,
      cheque_number,
      notes,
    } = req.body;

    const saleNumberResult = await query(
      "SELECT LPAD((COALESCE(MAX(CAST(SUBSTRING(sale_number FROM 11) AS INTEGER)), 0) + 1)::text, 6, '0') as next_num FROM sales WHERE sale_number LIKE 'SALE-2025-%'"
    );
    const nextNum = saleNumberResult.rows[0].next_num;
    const sale_number = `SALE-2025-${nextNum}`;

    // ✅ UPDATED: Use req.user.id instead of hardcoded 1
    const saleResult = await query(
      `INSERT INTO sales (sale_number, user_id, subtotal, discount_amount, discount_percentage, total_amount, payment_method, knet_reference, cheque_number, notes, status, sale_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'completed', NOW())
       RETURNING *`,
      [sale_number, req.user.id, subtotal, discount_amount, discount_percentage, total_amount, payment_method, knet_reference, cheque_number, notes]
    );

    const sale = saleResult.rows[0];

    for (const item of saleItems) {
      await query(
        `INSERT INTO sale_items (sale_id, item_id, item_name_en, item_name_ar, quantity, unit_price, line_total)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [sale.id, item.item_id, item.item_name_en, item.item_name_ar, item.quantity, item.unit_price, item.line_total]
      );
    }

    const fullSaleResult = await query('SELECT * FROM sales WHERE id = $1', [sale.id]);
    const itemsResult = await query('SELECT * FROM sale_items WHERE sale_id = $1', [sale.id]);

    const fullSale = {
      ...fullSaleResult.rows[0],
      items: itemsResult.rows,
    };

    await query(
      'INSERT INTO audit_logs (user_id, action, details) VALUES ($1, $2, $3)',
      [req.user.id, 'CREATE_SALE', `Sale ${sale_number} created for ${total_amount} KWD`]
    );

    res.status(201).json(fullSale);
  } catch (error) {
    console.error('Error creating sale:', error);
    res.status(500).json({ error: 'Failed to create sale' });
  }
});

// GET /api/sales - ✅ UPDATED: Protected
app.get('/api/sales', authenticateJWT, async (req, res) => {
  try {
    const { date } = req.query;

    let sql = `
      SELECT s.*, u.name as cashier_name, c.name as contractor_name,
        json_agg(json_build_object(
          'id', si.id,
          'item_id', si.item_id,
          'item_name_en', si.item_name_en,
          'item_name_ar', si.item_name_ar,
          'quantity', si.quantity,
          'unit_price', si.unit_price,
          'line_total', si.line_total
        )) as items
      FROM sales s
      LEFT JOIN users u ON s.user_id = u.id
      LEFT JOIN contractors c ON s.contractor_id = c.id
      LEFT JOIN sale_items si ON s.id = si.sale_id
    `;

    let params = [];

    if (date) {
      sql += ' WHERE DATE(s.sale_date) = $1';
      params = [date];
    }

    sql += ' GROUP BY s.id, u.id, c.id ORDER BY s.sale_date DESC';

    const result = await query(sql, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching sales:', error);
    res.status(500).json({ error: 'Failed to fetch sales' });
  }
});

// GET /api/sales/:saleNumber - ✅ UPDATED: Protected
app.get('/api/sales/:saleNumber', authenticateJWT, async (req, res) => {
  try {
    const result = await query('SELECT * FROM sales WHERE sale_number = $1', [req.params.saleNumber]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Sale not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching sale:', error);
    res.status(500).json({ error: 'Failed to fetch sale' });
  }
});

// ==================== REFUNDS ====================

// POST /api/refunds - ✅ UPDATED: Protected
app.post('/api/refunds', authenticateJWT, async (req, res) => {
  try {
    const { sale_id, amount, reason } = req.body;

    const saleResult = await query('SELECT * FROM sales WHERE id = $1', [sale_id]);
    if (saleResult.rows.length === 0) {
      return res.status(404).json({ error: 'Sale not found' });
    }

    const refundNumberResult = await query(
      "SELECT LPAD((COALESCE(MAX(CAST(SUBSTRING(refund_number FROM 15) AS INTEGER)), 0) + 1)::text, 6, '0') as next_num FROM refunds WHERE refund_number LIKE 'REFUND-2025-%'"
    );
    const nextNum = refundNumberResult.rows[0].next_num;
    const refund_number = `REFUND-2025-${nextNum}`;

    // ✅ UPDATED: Use req.user.id
    const refundResult = await query(
      'INSERT INTO refunds (refund_number, sale_id, amount, reason, created_by_user_id) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [refund_number, sale_id, amount, reason, req.user.id]
    );

    await query('UPDATE sales SET status = $1 WHERE id = $2', ['refunded', sale_id]);

    await query(
      'INSERT INTO audit_logs (user_id, action, details) VALUES ($1, $2, $3)',
      [req.user.id, 'CREATE_REFUND', `Refund ${refund_number} created for ${amount} KWD`]
    );

    res.status(201).json(refundResult.rows[0]);
  } catch (error) {
    console.error('Error creating refund:', error);
    res.status(500).json({ error: 'Failed to create refund' });
  }
});

// GET /api/refunds - ✅ UPDATED: Protected
app.get('/api/refunds', authenticateJWT, async (req, res) => {
  try {
    const result = await query('SELECT * FROM refunds ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching refunds:', error);
    res.status(500).json({ error: 'Failed to fetch refunds' });
  }
});

// GET /api/refunds/:refundNumber - ✅ UPDATED: Protected
app.get('/api/refunds/:refundNumber', authenticateJWT, async (req, res) => {
  try {
    const result = await query('SELECT * FROM refunds WHERE refund_number = $1', [req.params.refundNumber]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Refund not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching refund:', error);
    res.status(500).json({ error: 'Failed to fetch refund' });
  }
});

// ==================== REPORTS ====================

// GET /api/reports/daily - ✅ UPDATED: Protected
app.get('/api/reports/daily', authenticateJWT, async (req, res) => {
  try {
    const { date } = req.query;
    const dateFilter = date || new Date().toISOString().split('T')[0];

    const salesResult = await query(
      'SELECT * FROM sales WHERE DATE(sale_date) = $1',
      [dateFilter]
    );

    const total_revenue = salesResult.rows.reduce((sum, s) => sum + s.total_amount, 0);
    const total_sales_count = salesResult.rows.length;

    const paymentResult = await query(
      `SELECT payment_method, SUM(total_amount) as total
       FROM sales WHERE DATE(sale_date) = $1
       GROUP BY payment_method`,
      [dateFilter]
    );

    const sales_by_payment = [
      { name: 'Cash', value: paymentResult.rows.find(r => r.payment_method === 'cash')?.total || 0 },
      { name: 'KNET', value: paymentResult.rows.find(r => r.payment_method === 'knet')?.total || 0 },
      { name: 'Cheque', value: paymentResult.rows.find(r => r.payment_method === 'cheque')?.total || 0 },
      { name: 'Credit', value: paymentResult.rows.find(r => r.payment_method === 'credit')?.total || 0 },
    ];

    const topItemsResult = await query(
      `SELECT item_name_en, SUM(quantity) as total
       FROM sale_items si
       JOIN sales s ON si.sale_id = s.id
       WHERE DATE(s.sale_date) = $1
       GROUP BY item_name_en
       ORDER BY total DESC
       LIMIT 5`,
      [dateFilter]
    );

    const top_items = topItemsResult.rows.map(r => ({ name: r.item_name_en, value: r.total }));

    res.json({
      date: dateFilter,
      total_revenue,
      total_sales_count,
      sales_by_payment,
      top_items,
    });
  } catch (error) {
    console.error('Error fetching daily report:', error);
    res.status(500).json({ error: 'Failed to fetch report' });
  }
});

// GET /api/reports/sales-csv - ✅ UPDATED: Protected
app.get('/api/reports/sales-csv', authenticateJWT, async (req, res) => {
  try {
    const { date } = req.query;

    let sql = `
      SELECT s.sale_number, s.sale_date, s.status, s.total_amount, s.payment_method, s.knet_reference, s.cheque_number, u.name as cashier_name
      FROM sales s
      LEFT JOIN users u ON s.user_id = u.id
    `;

    let params = [];
    if (date) {
      sql += ' WHERE DATE(s.sale_date) = $1';
      params = [date];
    }

    sql += ' ORDER BY s.sale_date DESC';

    const result = await query(sql, params);

    const headers = ['Sale No', 'Date', 'Time', 'Cashier', 'Status', 'Total (KWD)', 'Payment Method', 'Reference'];
    const rows = result.rows.map(s => [
      s.sale_number,
      new Date(s.sale_date).toLocaleDateString(),
      new Date(s.sale_date).toLocaleTimeString(),
      s.cashier_name,
      s.status,
      s.total_amount.toFixed(3),
      s.payment_method,
      s.knet_reference || s.cheque_number || '',
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="sales_${date || 'export'}.csv"`);
    res.send(csvContent);
  } catch (error) {
    console.error('Error exporting CSV:', error);
    res.status(500).json({ error: 'Failed to export CSV' });
  }
});
app.get('/api/contractors', authenticateJWT, async (req, res) => {
  try {
    const result = await query(
      'SELECT id, name, company_name, phone, email, credit_limit, total_credits, status FROM contractors WHERE status = $1 ORDER BY name',
      ['active']
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching contractors:', error);
    res.status(500).json({ error: 'Failed to fetch contractors' });
  }
});

// CREATE new contractor
app.post('/api/contractors', authenticateJWT, async (req, res) => {
  try {
    const { name, company_name, phone, email, address, credit_limit } = req.body;

    if (!name?.trim()) {
      return res.status(400).json({ error: 'Contractor name required' });
    }

    const result = await query(
      `INSERT INTO contractors (name, company_name, phone, email, address, credit_limit, total_credits)
       VALUES ($1, $2, $3, $4, $5, $6, 0)
       RETURNING id, name, company_name, phone, email, credit_limit, total_credits, status`,
      [name.trim(), company_name || null, phone || null, email || null, address || null, credit_limit || 10000]
    );

    await query(
      'INSERT INTO audit_logs (user_id, action, details, contractor_id) VALUES ($1, $2, $3, $4)',
      [req.user.id, 'CREATE_CONTRACTOR', `Created contractor: ${name}`, result.rows[0].id]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating contractor:', error);
    res.status(500).json({ error: 'Failed to create contractor' });
  }
});

// GET contractor details + credit history
app.get('/api/contractors/:id', authenticateJWT, async (req, res) => {
  try {
    const contractor = await query(
      'SELECT * FROM contractors WHERE id = $1',
      [req.params.id]
    );

    if (contractor.rows.length === 0) {
      return res.status(404).json({ error: 'Contractor not found' });
    }

    // Get credit history
    const history = await query(
      `SELECT id, transaction_type, amount, description, balance_after, created_at, created_by
       FROM credit_transactions WHERE contractor_id = $1
       ORDER BY created_at DESC LIMIT 50`,
      [req.params.id]
    );

    res.json({
      contractor: contractor.rows[0],
      history: history.rows
    });
  } catch (error) {
    console.error('Error fetching contractor:', error);
    res.status(500).json({ error: 'Failed to fetch contractor' });
  }
});

// ==================== CREDIT SALES ====================

// POST credit sale (when payment_method = 'credit')
app.post('/api/credit-sales', authenticateJWT, async (req, res) => {
  try {
    const {
      contractor_id,
      items,
      subtotal,
      discount_amount,
      discount_percentage,
      total_amount,
      notes
    } = req.body;
    
    // Validate contractor exists
    const contractorResult = await query(
      'SELECT id, total_credits, credit_limit FROM contractors WHERE id = $1',
      [contractor_id]
    );

    if (contractorResult.rows.length === 0) {
      return res.status(404).json({ error: 'Contractor not found' });
    }
    const contractor = contractorResult.rows[0];

    const currentCredits = Number(contractor.total_credits) || 0;
    const limit = Number(contractor.credit_limit) || 0;
    const saleTotal = Number(total_amount) || 0;

    const newTotalCredits = currentCredits + saleTotal;
 

    // Check credit limit
    if (newTotalCredits > contractor.credit_limit) {
      return res.status(400).json({
        error: `Credit limit exceeded. Current: ${contractor.total_credits}, Limit: ${contractor.credit_limit}, Would be: ${newTotalCredits}`
      });
    }

    // Generate sale number
    const saleNumberResult = await query(
      "SELECT LPAD((COALESCE(MAX(CAST(SUBSTRING(sale_number FROM 11) AS INTEGER)), 0) + 1)::text, 6, '0') as next_num FROM sales WHERE sale_number LIKE 'SALE-2025-%'"
    );
    const sale_number = `SALE-2025-${saleNumberResult.rows[0].next_num}`;

    // Create sale
    const saleResult = await query(
      `INSERT INTO sales (sale_number, user_id, contractor_id, subtotal, discount_amount, discount_percentage, total_amount, payment_method, notes, status, sale_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'credit', $8, 'completed', NOW())
       RETURNING *`,
      [sale_number, req.user.id, contractor_id, subtotal, discount_amount, discount_percentage, total_amount, notes]
    );

    const sale = saleResult.rows[0];

    // Add sale items
    for (const item of items) {
      await query(
        `INSERT INTO sale_items (sale_id, item_id, item_name_en, item_name_ar, quantity, unit_price, line_total)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [sale.id, item.item_id, item.item_name_en, item.item_name_ar, item.quantity, item.unit_price, item.line_total]
      );
    }

    // Update contractor credits
    await query(
      'UPDATE contractors SET total_credits = $1, updated_at = NOW() WHERE id = $2',
      [newTotalCredits, contractor_id]
    );

    // Log credit transaction
    await query(
      `INSERT INTO credit_transactions (contractor_id, sale_id, transaction_type, amount, description, balance_after, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [contractor_id, sale.id, 'credit_sale', total_amount, `Sale ${sale_number}`, newTotalCredits, req.user.id]
    );

    // Audit log
    await query(
      'INSERT INTO audit_logs (user_id, action, details, contractor_id) VALUES ($1, $2, $3, $4)',
      [req.user.id, 'CREDIT_SALE', `Credit sale ${sale_number} for ${total_amount} KWD`, contractor_id]
    );

    // Fetch the complete sale with items to return
    const itemsResult = await query(
      'SELECT * FROM sale_items WHERE sale_id = $1',
      [sale.id]
    );

    const completeSale = {
      ...sale,
      items: itemsResult.rows,
      cashier_name: req.user.name
    };

    console.log('Credit Sale Response:', JSON.stringify(completeSale, null, 2));

    res.status(201).json(completeSale);
  } catch (error) {
    console.error('Error creating credit sale:', error);
    res.status(500).json({ error: 'Failed to create credit sale' });
  }
});

// ==================== CREDIT PAYMENTS ====================

// POST credit payment (contractor pays back)
app.post('/api/credit-payments', authenticateJWT, async (req, res) => {
  try {
    const { contractor_id, amount, payment_method, description } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Payment amount must be greater than 0' });
    }

    // Get contractor
    const contractorResult = await query(
      'SELECT id, total_credits FROM contractors WHERE id = $1',
      [contractor_id]
    );

    if (contractorResult.rows.length === 0) {
      return res.status(404).json({ error: 'Contractor not found' });
    }

    const contractor = contractorResult.rows[0];
    const newTotalCredits = Math.max(0, contractor.total_credits - amount);

    // Update contractor credits
    await query(
      'UPDATE contractors SET total_credits = $1, updated_at = NOW() WHERE id = $2',
      [newTotalCredits, contractor_id]
    );

    // Log credit transaction
    const txnResult = await query(
      `INSERT INTO credit_transactions (contractor_id, transaction_type, amount, description, balance_after, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [contractor_id, 'payment', amount, description || `${payment_method} payment`, newTotalCredits, req.user.id]
    );

    // Audit log
    await query(
      'INSERT INTO audit_logs (user_id, action, details, contractor_id) VALUES ($1, $2, $3, $4)',
      [req.user.id, 'CREDIT_PAYMENT', `Payment of ${amount} KWD received from contractor`, contractor_id]
    );

    res.status(201).json({
      transaction: txnResult.rows[0],
      contractor_balance: newTotalCredits
    });
  } catch (error) {
    console.error('Error processing payment:', error);
    res.status(500).json({ error: 'Failed to process payment' });
  }
});

// GET contractor credit report
app.get('/api/credit-report/:contractorId', authenticateJWT, async (req, res) => {
  try {
    const result = await query(
      `SELECT c.*, 
              (SELECT COUNT(*) FROM credit_transactions WHERE contractor_id = c.id) as transaction_count,
              (SELECT SUM(amount) FROM credit_transactions WHERE contractor_id = c.id AND transaction_type = 'credit_sale') as total_debts,
              (SELECT SUM(amount) FROM credit_transactions WHERE contractor_id = c.id AND transaction_type = 'payment') as total_paid
       FROM contractors c WHERE c.id = $1`,
      [req.params.contractorId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Contractor not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching credit report:', error);
    res.status(500).json({ error: 'Failed to fetch credit report' });
  }
});
// ==================== AUDIT LOGS ====================

// GET /api/audit-logs - ✅ UPDATED: Protected, admin only
app.get('/api/audit-logs', authenticateJWT, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { limit = 100, action } = req.query;

    let sql = 'SELECT * FROM audit_logs';
    let params = [];

    if (action) {
      sql += ' WHERE action = $1';
      params = [action];
    }

    sql += ' ORDER BY timestamp DESC LIMIT $' + (params.length + 1);
    params.push(limit);

    const result = await query(sql, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

// ==================== HEALTH CHECK ====================

app.get('/health', async (req, res) => {
  try {
    await query('SELECT 1');
    res.json({ status: 'ok', database: 'connected', timestamp: new Date().toISOString() });
  } catch (error) {
    res.status(500).json({ status: 'error', database: 'disconnected', error: error.message });
  }
});

// ==================== START SERVER ====================

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n${'='.repeat(50)}`);
  console.log('  Kuwait POS Backend API (JWT)');
  console.log(`${'='.repeat(50)}`);
  console.log(`\n✅ Server running on http://localhost:${PORT}`);
  console.log(`\n📍 API Base: http://localhost:${PORT}/api`);
  console.log(`\n🔐 JWT Auth Enabled`);
  console.log(`\n🧪 Test credentials:`);
  console.log(`   admin / admin123`);
  console.log(`   cashier1 / cashier123\n`);
  
  // Run migrations after a short delay to ensure DB is ready
 
});
