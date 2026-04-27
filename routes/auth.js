const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const rateLimit = require('express-rate-limit');

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many login attempts. Please try again in 15 minutes.',
  handler: (req, res) => {
    res.render('login', { error: 'Too many login attempts. Please try again in 15 minutes.' });
  },
  standardHeaders: true,
  legacyHeaders: false
});

router.get('/', (req, res) => {
  if (req.session.user) return res.redirect('/dashboard');
  res.redirect('/login');
});

router.get('/login', (req, res) => {
  if (req.session.user) return res.redirect('/dashboard');
  res.render('login', { error: null });
});

router.post('/login', loginLimiter, async (req, res) => {
  const pool = req.app.locals.pool;
  const { email, password } = req.body;
  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1 AND is_active = true', [email]);
    if (result.rows.length === 0) return res.render('login', { error: 'Invalid email or password' });
    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.render('login', { error: 'Invalid email or password' });

    req.session.user = { id: user.id, email: user.email, full_name: user.full_name, role: user.role, company: user.company, org_id: user.org_id };

    // Audit log
    await pool.query(
      'INSERT INTO audit_log (entity_type, entity_id, action_type, new_value, user_id, user_role, ip_address) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      ['user', user.id, 'login', JSON.stringify({ email: user.email }), user.id, user.role, req.ip]
    );

    res.redirect('/dashboard');
  } catch (err) {
    console.error(err);
    res.render('login', { error: 'An error occurred' });
  }
});

router.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login');
});

module.exports = router;
