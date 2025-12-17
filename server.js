import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import bcryptjs from 'bcryptjs';
import { query } from './lib/db.js';

console.log('DB INFO:', {
  DATABASE_URL: process.env.DATABASE_URL,
  DB_USER: process.env.DB_USER,
  DB_HOST: process.env.DB_HOST,
  DB_NAME: process.env.DB_NAME,
});


const app = express();

// Middleware
app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:3000',
    'http://localhost:3001',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:5174',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3001',
    'http://192.168.1.3:3000',
    'http://192.168.1.3:5173',
    'http://192.168.1.3:5174',
    'http://192.168.1.3:3001'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  headers: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// ==================== AUTHENTICATION ====================

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    console.log('LOGIN ATTEMPT:', { username, password });

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }
    
    // Query database for user
    const result = await query('SELECT * FROM users WHERE username = $1', [username]);
    console.log('DB USER ROWS:', result.rows);


    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];

    // Compare password with hash
    const passwordMatch = await bcryptjs.compare(password, user.password_hash);
    console.log('PASSWORD MATCH?', passwordMatch);


    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Log the login
    await query(
      'INSERT INTO audit_logs (user_id, action, details) VALUES ($1, $2, $3)',
      [user.id, 'LOGIN', `User ${username} logged in`]
    );

    // Return user (without password)
    const { password_hash, ...userWithoutPassword } = user;
    res.json({ user: userWithoutPassword });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  res.json({ success: true });
});

// ==================== ITEMS ====================

app.get('/api/items', async (req, res) => {
  try {
    const result = await query('SELECT * FROM items WHERE active = true ORDER BY name_en');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching items:', error);
    res.status(500).json({ error: 'Failed to fetch items' });
  }
});

app.get('/api/items/:id', async (req, res) => {
  try {
    const result = await query('SELECT * FROM items WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching item:', error);
    res.status(500).json({ error: 'Failed to fetch item' });
  }
});

app.post('/api/items', async (req, res) => {
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
      'INSERT INTO audit_logs (action, details) VALUES ($1, $2)',
      ['CREATE_ITEM', `Created item: ${name_en}`]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating item:', error);
    res.status(500).json({ error: 'Failed to create item' });
  }
});

app.patch('/api/items/:id/price', async (req, res) => {
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

app.delete('/api/items/:id', async (req, res) => {
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

app.patch('/api/items/:id/status', async (req, res) => {
  try {
    await query('UPDATE items SET active = NOT active WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating status:', error);
    res.status(500).json({ error: 'Failed to update status' });
  }
});

// ==================== SALES ====================

app.post('/api/sales', async (req, res) => {
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

    // Generate sale number
    const saleNumberResult = await query(
      "SELECT LPAD((COALESCE(MAX(CAST(SUBSTRING(sale_number FROM 11) AS INTEGER)), 0) + 1)::text, 6, '0') as next_num FROM sales WHERE sale_number LIKE 'SALE-2025-%'"
    );
    const nextNum = saleNumberResult.rows[0].next_num;
    const sale_number = `SALE-2025-${nextNum}`;

    // Insert sale
    const saleResult = await query(
      `INSERT INTO sales (sale_number, user_id, subtotal, discount_amount, discount_percentage, total_amount, payment_method, knet_reference, cheque_number, notes, status, sale_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'completed', NOW())
       RETURNING *`,
      [sale_number, 1, subtotal, discount_amount, discount_percentage, total_amount, payment_method, knet_reference, cheque_number, notes]
    );

    const sale = saleResult.rows[0];

    // Insert sale items
    for (const item of saleItems) {
      await query(
        `INSERT INTO sale_items (sale_id, item_id, item_name_en, item_name_ar, quantity, unit_price, line_total)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [sale.id, item.item_id, item.item_name_en, item.item_name_ar, item.quantity, item.unit_price, item.line_total]
      );
    }

    // Get sale with items
    const fullSaleResult = await query('SELECT * FROM sales WHERE id = $1', [sale.id]);
    const itemsResult = await query('SELECT * FROM sale_items WHERE sale_id = $1', [sale.id]);

    const fullSale = {
      ...fullSaleResult.rows[0],
      items: itemsResult.rows,
    };

    // Log
    await query(
      'INSERT INTO audit_logs (user_id, action, details) VALUES ($1, $2, $3)',
      [1, 'CREATE_SALE', `Sale ${sale_number} created for ${total_amount} KWD`]
    );

    res.status(201).json(fullSale);
  } catch (error) {
    console.error('Error creating sale:', error);
    res.status(500).json({ error: 'Failed to create sale' });
  }
});

app.get('/api/sales', async (req, res) => {
  try {
    const { date } = req.query;

    let sql = `
      SELECT s.*, u.name as cashier_name,
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
      LEFT JOIN sale_items si ON s.id = si.sale_id
    `;

    let params = [];

    if (date) {
      sql += ' WHERE DATE(s.sale_date) = $1';
      params = [date];
    }

    sql += ' GROUP BY s.id, u.id ORDER BY s.sale_date DESC';

    const result = await query(sql, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching sales:', error);
    res.status(500).json({ error: 'Failed to fetch sales' });
  }
});

app.get('/api/sales/:saleNumber', async (req, res) => {
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

app.post('/api/refunds', async (req, res) => {
  try {
    const { sale_id, amount, reason } = req.body;

    // Check if sale exists
    const saleResult = await query('SELECT * FROM sales WHERE id = $1', [sale_id]);
    if (saleResult.rows.length === 0) {
      return res.status(404).json({ error: 'Sale not found' });
    }

    // Generate refund number
    const refundNumberResult = await query(
      "SELECT LPAD((COALESCE(MAX(CAST(SUBSTRING(refund_number FROM 15) AS INTEGER)), 0) + 1)::text, 6, '0') as next_num FROM refunds WHERE refund_number LIKE 'REFUND-2025-%'"
    );
    const nextNum = refundNumberResult.rows[0].next_num;
    const refund_number = `REFUND-2025-${nextNum}`;

    // Insert refund
    const refundResult = await query(
      'INSERT INTO refunds (refund_number, sale_id, amount, reason, created_by_user_id) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [refund_number, sale_id, amount, reason, 1]
    );

    // Update sale status
    await query('UPDATE sales SET status = $1 WHERE id = $2', ['refunded', sale_id]);

    // Log
    await query(
      'INSERT INTO audit_logs (user_id, action, details) VALUES ($1, $2, $3)',
      [1, 'CREATE_REFUND', `Refund ${refund_number} created for ${amount} KWD`]
    );

    res.status(201).json(refundResult.rows[0]);
  } catch (error) {
    console.error('Error creating refund:', error);
    res.status(500).json({ error: 'Failed to create refund' });
  }
});

app.get('/api/refunds', async (req, res) => {
  try {
    const result = await query('SELECT * FROM refunds ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching refunds:', error);
    res.status(500).json({ error: 'Failed to fetch refunds' });
  }
});

app.get('/api/refunds/:refundNumber', async (req, res) => {
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

app.get('/api/reports/daily', async (req, res) => {
  try {
    const { date } = req.query;
    const dateFilter = date || new Date().toISOString().split('T')[0];

    // Get sales for date
    const salesResult = await query(
      'SELECT * FROM sales WHERE DATE(sale_date) = $1',
      [dateFilter]
    );

    const total_revenue = salesResult.rows.reduce((sum, s) => sum + s.total_amount, 0);
    const total_sales_count = salesResult.rows.length;

    // Sales by payment method
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

    // Top items
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

app.get('/api/reports/sales-csv', async (req, res) => {
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

// ==================== AUDIT LOGS ====================

app.get('/api/audit-logs', async (req, res) => {
  try {
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
  console.log('  Kuwait POS Backend API');
  console.log(`${'='.repeat(50)}`);
  console.log(`\n✅ Server running on http://localhost:${PORT}`);
  console.log(`\n📍 API Base: http://localhost:${PORT}/api`);
  console.log(`\n🧪 Test credentials:`);
  console.log(`   admin / admin123`);
  console.log(`   cashier1 / cashier123\n`);
});
