const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const { requireAdmin } = require('../middleware/auth');

// Admin panel — separated internal users and customers
router.get('/', requireAdmin, async (req, res) => {
  const pool = req.app.locals.pool;
  const internalUsers = await pool.query(
    `SELECT u.id, u.email, u.full_name, u.role, u.company, u.phone, u.is_active, u.created_at,
            string_agg(DISTINCT o.name, ', ' ORDER BY o.name) as orgs
     FROM users u
     LEFT JOIN user_organizations uo ON uo.user_id = u.id
     LEFT JOIN organizations o ON o.id = uo.org_id
     WHERE u.role IN ('domain_admin', 'editor')
     GROUP BY u.id
     ORDER BY u.role, u.full_name`
  );
  const customers = await pool.query(
    `SELECT u.id, u.email, u.full_name, u.role, u.company, u.phone, u.is_active, u.created_at,
            string_agg(DISTINCT o.name, ', ' ORDER BY o.name) as orgs
     FROM users u
     LEFT JOIN user_organizations uo ON uo.user_id = u.id
     LEFT JOIN organizations o ON o.id = uo.org_id
     WHERE u.role = 'customer'
     GROUP BY u.id
     ORDER BY u.full_name`
  );
  res.render('admin', { internalUsers: internalUsers.rows, customers: customers.rows });
});

// Create user form
router.get('/users/new', requireAdmin, (req, res) => {
  res.render('user-form', { editUser: null, error: null });
});

// Create user
router.post('/users', requireAdmin, async (req, res) => {
  const pool = req.app.locals.pool;
  const { email, password, full_name, role, company, phone } = req.body;
  try {
    const hash = await bcrypt.hash(password, 12);
    await pool.query(
      'INSERT INTO users (email, password_hash, full_name, role, company, phone) VALUES ($1,$2,$3,$4,$5,$6)',
      [email, hash, full_name, role, company, phone]
    );
    res.redirect('/admin');
  } catch (err) {
    console.error(err);
    res.render('user-form', { editUser: null, error: err.detail || 'Failed to create user' });
  }
});

// Edit user form
router.get('/users/:id/edit', requireAdmin, async (req, res) => {
  const pool = req.app.locals.pool;
  const result = await pool.query('SELECT * FROM users WHERE id = $1', [req.params.id]);
  if (result.rows.length === 0) return res.status(404).render('error', { message: 'User not found' });
  res.render('user-form', { editUser: result.rows[0], error: null });
});

// Update user
router.post('/users/:id', requireAdmin, async (req, res) => {
  const pool = req.app.locals.pool;
  const { email, password, full_name, role, company, phone, is_active } = req.body;
  try {
    if (password) {
      const hash = await bcrypt.hash(password, 12);
      await pool.query('UPDATE users SET email=$1, password_hash=$2, full_name=$3, role=$4, company=$5, phone=$6, is_active=$7, updated_at=NOW() WHERE id=$8',
        [email, hash, full_name, role, company, phone, is_active === 'on', req.params.id]);
    } else {
      await pool.query('UPDATE users SET email=$1, full_name=$2, role=$3, company=$4, phone=$5, is_active=$6, updated_at=NOW() WHERE id=$7',
        [email, full_name, role, company, phone, is_active === 'on', req.params.id]);
    }
    res.redirect('/admin');
  } catch (err) {
    console.error(err);
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [req.params.id]);
    res.render('user-form', { editUser: result.rows[0], error: err.detail || 'Failed to update user' });
  }
});

module.exports = router;
