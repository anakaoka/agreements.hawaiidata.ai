const express = require('express');
const router = express.Router();
const { requireAuth, requireEditor, requireAdmin } = require('../middleware/auth');

// View single quote
router.get('/:id', requireAuth, async (req, res) => {
  const pool = req.app.locals.pool;
  const user = req.session.user;
  try {
    const quote = await pool.query(
      `SELECT q.*, c.full_name as customer_name_user, c.company as customer_company_user, c.email as customer_email_user,
       e.full_name as editor_name, cr.full_name as creator_name,
       o.name as org_name, o.logo_url as org_logo
       FROM quotes q
       LEFT JOIN users c ON q.customer_id = c.id
       LEFT JOIN users e ON q.assigned_editor = e.id
       LEFT JOIN users cr ON q.created_by = cr.id
       LEFT JOIN organizations o ON q.org_id = o.id
       WHERE q.id = $1`, [req.params.id]
    );
    if (quote.rows.length === 0) return res.status(404).render('error', { message: 'Quote not found' });

    const q = quote.rows[0];
    if (user.role === 'customer' && q.customer_id !== user.id) return res.status(403).render('error', { message: 'Access denied' });

    const items = await pool.query('SELECT * FROM line_items WHERE quote_id = $1 ORDER BY sort_order, created_at', [req.params.id]);
    const revisions = await pool.query(
      `SELECT r.*, u.full_name as requester_name, resp.full_name as responder_name
       FROM revision_requests r
       LEFT JOIN users u ON r.requested_by = u.id
       LEFT JOIN users resp ON r.responded_by = resp.id
       WHERE r.quote_id = $1 ORDER BY r.created_at DESC`, [req.params.id]
    );
    const audit = await pool.query(
      `SELECT a.*, u.full_name as user_name FROM audit_log a LEFT JOIN users u ON a.user_id = u.id
       WHERE a.entity_id = $1 ORDER BY a.created_at DESC LIMIT 50`, [req.params.id]
    );

    res.render('quote', { quote: q, items: items.rows, revisions: revisions.rows, audit: audit.rows });
  } catch (err) {
    console.error(err);
    res.render('error', { message: 'Failed to load quote' });
  }
});

// Create quote form — single page
router.get('/new/create', requireEditor, async (req, res) => {
  const pool = req.app.locals.pool;
  const user = req.session.user;
  try {
    // Get orgs user has access to, with their contract template legal terms
    const orgs = await pool.query(
      `SELECT o.id, o.name, o.slug, o.logo_url,
              ct.legal_terms, ct.default_term_months
       FROM organizations o
       JOIN user_organizations uo ON uo.org_id = o.id AND uo.user_id = $1
       LEFT JOIN contract_templates ct ON ct.org_id = o.id
       ORDER BY o.name`, [user.id]
    );

    // Get all pricing rules grouped by org (for JS-side auto-population)
    const pricingRules = await pool.query(
      `SELECT org_id, category, description, billing_cycle, unit_price, discount_at_term, sort_order, term_months, detail_text
       FROM pricing_rules ORDER BY org_id, sort_order, category`
    );

    const activeOrgId = req.session.user.active_org_id || (orgs.rows.length > 0 ? orgs.rows[0].id : null);

    res.render('quote-form', {
      quote: null,
      userOrgs: orgs.rows,
      activeOrgId,
      pricingRules: pricingRules.rows
    });
  } catch (err) {
    console.error(err);
    res.render('error', { message: 'Failed to load quote form' });
  }
});

// Create quote — handles inline customer creation and line items
router.post('/', requireEditor, async (req, res) => {
  const pool = req.app.locals.pool;
  const user = req.session.user;
  const {
    org_id, title, customer_name, customer_email, customer_phone,
    customer_company, customer_address, term_months, valid_until,
    legal_terms, notes,
    items_desc: descs, items_qty: qtys, items_price: prices,
    items_cycle: cycles, items_category: categories, items_is_discount: isDiscounts, items_detail: details
  } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Look up or create customer user if email provided
    let customerId = null;
    if (customer_email) {
      const existing = await client.query('SELECT id FROM users WHERE email = $1', [customer_email]);
      if (existing.rows.length > 0) {
        customerId = existing.rows[0].id;
      } else {
        const newCust = await client.query(
          `INSERT INTO users (email, full_name, company, role, is_active)
           VALUES ($1, $2, $3, 'customer', true) RETURNING id`,
          [customer_email, customer_name || customer_email, customer_company || null]
        );
        customerId = newCust.rows[0].id;
        // Add customer to the org
        if (org_id) {
          await client.query(
            'INSERT INTO user_organizations (user_id, org_id, role) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
            [customerId, org_id, 'customer']
          );
        }
      }
    }

    // Create the quote
    const result = await client.query(
      `INSERT INTO quotes (title, customer_id, created_by, assigned_editor, legal_terms, notes, valid_until, org_id,
       term_months, customer_name, customer_email, customer_phone, customer_company, customer_address)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING id`,
      [title, customerId, user.id, user.id, legal_terms, notes, valid_until || null, org_id || null,
       term_months || null, customer_name, customer_email, customer_phone, customer_company, customer_address]
    );
    const quoteId = result.rows[0].id;

    // Add line items
    const descArr = Array.isArray(descs) ? descs : (descs ? [descs] : []);
    const qtyArr = Array.isArray(qtys) ? qtys : (qtys ? [qtys] : []);
    const priceArr = Array.isArray(prices) ? prices : (prices ? [prices] : []);
    const cycleArr = Array.isArray(cycles) ? cycles : (cycles ? [cycles] : []);
    const catArr = Array.isArray(categories) ? categories : (categories ? [categories] : []);
    const discArr = Array.isArray(isDiscounts) ? isDiscounts : (isDiscounts ? [isDiscounts] : []);
    const detailArr = Array.isArray(details) ? details : (details ? [details] : []);

    let subtotal = 0;
    for (let i = 0; i < descArr.length; i++) {
      if (!descArr[i]) continue;
      const qty = parseFloat(qtyArr[i]) || 1;
      const price = parseFloat(priceArr[i]) || 0;
      const total = qty * price;
      const cycle = cycleArr[i] || 'one_time';
      const category = catArr[i] || 'custom';
      const isDiscount = discArr[i] === '1';
      subtotal += total;

      await client.query(
        `INSERT INTO line_items (quote_id, description, quantity, unit_price, total_price, sort_order,
         billing_cycle, category, is_discount, created_by_role, notes, notes_visible_to_customer)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [quoteId, descArr[i], qty, price, total, i, cycle, category, isDiscount, user.role, detailArr[i] || null, !!(detailArr[i])]
      );
    }

    // Update quote totals
    await client.query(
      'UPDATE quotes SET subtotal = $1, total = $1 WHERE id = $2',
      [subtotal, quoteId]
    );

    // Audit log
    await client.query(
      'INSERT INTO audit_log (entity_type, entity_id, action_type, new_value, user_id, user_role, ip_address) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      ['quote', quoteId, 'add', JSON.stringify({ title, org_id, customer_name, line_items: descArr.length }), user.id, user.role, req.ip]
    );

    await client.query('COMMIT');
    res.redirect('/quotes/' + quoteId);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.render('error', { message: 'Failed to create quote: ' + err.message });
  } finally {
    client.release();
  }
});

module.exports = router;
