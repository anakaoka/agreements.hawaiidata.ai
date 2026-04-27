const express = require('express');
const router = express.Router();
const { requireAuth, requireEditor, requireAdmin } = require('../middleware/auth');

// Add line item
router.post('/quotes/:id/items', requireEditor, async (req, res) => {
  const pool = req.app.locals.pool;
  const user = req.session.user;
  const { description, quantity, unit_price, notes, notes_visible_to_customer } = req.body;
  try {
    const total = (parseFloat(quantity) || 1) * (parseFloat(unit_price) || 0);
    const result = await pool.query(
      `INSERT INTO line_items (quote_id, description, quantity, unit_price, total_price, notes, notes_visible_to_customer)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [req.params.id, description, quantity || 1, unit_price, total, notes, notes_visible_to_customer === 'true']
    );
    await recalcQuote(pool, req.params.id);
    await pool.query(
      'INSERT INTO audit_log (entity_type, entity_id, action_type, new_value, user_id, user_role, ip_address) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      ['line_item', result.rows[0].id, 'add', JSON.stringify(result.rows[0]), user.id, user.role, req.ip]
    );
    await pool.query("UPDATE quotes SET status = 'Revised', updated_at = NOW() WHERE id = $1 AND status = 'Sent'", [req.params.id]);
    res.json({ success: true, item: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to add line item' });
  }
});

// Update line item
router.put('/quotes/:qid/items/:iid', requireEditor, async (req, res) => {
  const pool = req.app.locals.pool;
  const user = req.session.user;
  const { description, quantity, unit_price, notes, notes_visible_to_customer, is_locked, is_non_negotiable, is_informational } = req.body;
  try {
    const prev = await pool.query('SELECT * FROM line_items WHERE id = $1', [req.params.iid]);
    if (prev.rows.length === 0) return res.status(404).json({ error: 'Item not found' });
    if ((is_locked !== undefined || is_non_negotiable !== undefined) && user.role !== 'domain_admin') {
      return res.status(403).json({ error: 'Only admins can lock items' });
    }
    if (prev.rows[0].is_locked && user.role !== 'domain_admin') {
      return res.status(403).json({ error: 'Item is locked' });
    }
    const total = (parseFloat(quantity) || prev.rows[0].quantity) * (parseFloat(unit_price) || prev.rows[0].unit_price);
    await pool.query(
      `UPDATE line_items SET description=COALESCE($1,description), quantity=COALESCE($2,quantity),
       unit_price=COALESCE($3,unit_price), total_price=$4, notes=COALESCE($5,notes),
       notes_visible_to_customer=COALESCE($6,notes_visible_to_customer),
       is_locked=COALESCE($7,is_locked), is_non_negotiable=COALESCE($8,is_non_negotiable),
       is_informational=COALESCE($9,is_informational), status='Modified', updated_at=NOW()
       WHERE id=$10`,
      [description, quantity, unit_price, total, notes, notes_visible_to_customer, is_locked, is_non_negotiable, is_informational, req.params.iid]
    );
    await recalcQuote(pool, req.params.qid);
    await pool.query(
      'INSERT INTO audit_log (entity_type, entity_id, action_type, previous_value, new_value, user_id, user_role, ip_address) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
      ['line_item', req.params.iid, 'edit', JSON.stringify(prev.rows[0]), JSON.stringify(req.body), user.id, user.role, req.ip]
    );
    await pool.query("UPDATE quotes SET status = 'Revised', updated_at = NOW() WHERE id = $1 AND status = 'Sent'", [req.params.qid]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update item' });
  }
});

// Delete line item
router.delete('/quotes/:qid/items/:iid', requireEditor, async (req, res) => {
  const pool = req.app.locals.pool;
  const user = req.session.user;
  try {
    const prev = await pool.query('SELECT * FROM line_items WHERE id = $1', [req.params.iid]);
    if (prev.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    if (user.role !== 'domain_admin') return res.status(403).json({ error: 'Only admins can delete items' });
    await pool.query('DELETE FROM line_items WHERE id = $1', [req.params.iid]);
    await recalcQuote(pool, req.params.qid);
    await pool.query(
      'INSERT INTO audit_log (entity_type, entity_id, action_type, previous_value, user_id, user_role, ip_address) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      ['line_item', req.params.iid, 'delete', JSON.stringify(prev.rows[0]), user.id, user.role, req.ip]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete item' });
  }
});

// Override quote total
router.post('/quotes/:id/override', requireAdmin, async (req, res) => {
  const pool = req.app.locals.pool;
  const user = req.session.user;
  const { total_override } = req.body;
  try {
    const prev = await pool.query('SELECT total, total_override FROM quotes WHERE id = $1', [req.params.id]);
    await pool.query('UPDATE quotes SET total_override = $1, total = $1, updated_at = NOW() WHERE id = $2', [total_override, req.params.id]);
    await pool.query(
      'INSERT INTO audit_log (entity_type, entity_id, action_type, previous_value, new_value, user_id, user_role, ip_address) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
      ['quote', req.params.id, 'override', JSON.stringify(prev.rows[0]), JSON.stringify({ total_override }), user.id, user.role, req.ip]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to override total' });
  }
});

// Update quote status — auto-create contract on Accepted
router.post('/quotes/:id/status', requireEditor, async (req, res) => {
  const pool = req.app.locals.pool;
  const user = req.session.user;
  const { status } = req.body;
  try {
    if (['Ready for Acceptance', 'Accepted'].includes(status) && user.role !== 'domain_admin') {
      return res.status(403).json({ error: 'Only admins can approve quotes' });
    }
    const prev = await pool.query('SELECT status FROM quotes WHERE id = $1', [req.params.id]);
    await pool.query('UPDATE quotes SET status = $1, updated_at = NOW() WHERE id = $2', [status, req.params.id]);
    await pool.query(
      'INSERT INTO audit_log (entity_type, entity_id, action_type, previous_value, new_value, user_id, user_role, ip_address) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
      ['quote', req.params.id, 'status_change', JSON.stringify(prev.rows[0]), JSON.stringify({ status }), user.id, user.role, req.ip]
    );

    // Auto-create contract when quote is Accepted
    if (status === 'Accepted') {
      const quoteData = await pool.query(
        'SELECT * FROM quotes WHERE id = $1', [req.params.id]
      );
      const q = quoteData.rows[0];
      if (q) {
        const existing = await pool.query('SELECT id FROM contracts WHERE quote_id = $1', [req.params.id]);
        if (existing.rows.length === 0) {
          // Build contract body from line items
          const items = await pool.query('SELECT * FROM line_items WHERE quote_id = $1 ORDER BY sort_order, created_at', [req.params.id]);
          let bodyLines = items.rows.map(i =>
            i.description + '  —  Qty: ' + parseFloat(i.quantity) + '  x  $' + parseFloat(i.unit_price).toFixed(2) + '  =  $' + parseFloat(i.total_price).toFixed(2)
          );
          bodyLines.push('');
          bodyLines.push('Total: $' + parseFloat(q.total || 0).toFixed(2));

          const contract = await pool.query(
            `INSERT INTO contracts (title, quote_id, customer_id, created_by, status, total_value, org_id,
             contract_body, legal_terms, signed_by_admin, admin_signed_at, admin_signature_name)
             VALUES ($1, $2, $3, $4, 'Pending Signature', $5, $6, $7, $8, true, NOW(), $9) RETURNING id`,
            [q.title, q.id, q.customer_id, user.id, q.total || 0, q.org_id,
             bodyLines.join('\n'), q.legal_terms, user.full_name]
          );

          // Save initial version
          await pool.query(
            'INSERT INTO contract_versions (contract_id, version_number, contract_body, legal_terms, changed_by, change_summary) VALUES ($1, 1, $2, $3, $4, $5)',
            [contract.rows[0].id, bodyLines.join('\n'), q.legal_terms, user.id, 'Auto-generated from accepted quote #' + q.quote_number]
          );

          await pool.query(
            'INSERT INTO audit_log (entity_type, entity_id, action_type, new_value, user_id, user_role, ip_address) VALUES ($1,$2,$3,$4,$5,$6,$7)',
            ['contract', contract.rows[0].id, 'add', JSON.stringify({ from_quote: q.id, title: q.title }), user.id, user.role, req.ip]
          );
        }
      }
    }

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update status' });
  }
});

// Revision requests
router.post('/quotes/:id/revisions', requireAuth, async (req, res) => {
  const pool = req.app.locals.pool;
  const user = req.session.user;
  const { line_item_id, request_message } = req.body;
  try {
    await pool.query(
      'INSERT INTO revision_requests (quote_id, line_item_id, requested_by, request_message) VALUES ($1,$2,$3,$4)',
      [req.params.id, line_item_id || null, user.id, request_message]
    );
    await pool.query("UPDATE quotes SET status = 'Pending Revision', updated_at = NOW() WHERE id = $1", [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to submit revision' });
  }
});

// Respond to revision
router.post('/revisions/:id/respond', requireEditor, async (req, res) => {
  const pool = req.app.locals.pool;
  const user = req.session.user;
  const { response_message, status } = req.body;
  try {
    await pool.query(
      'UPDATE revision_requests SET responded_by=$1, response_message=$2, status=$3, resolved_at=NOW() WHERE id=$4',
      [user.id, response_message, status || 'Resolved', req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to respond to revision' });
  }
});

async function recalcQuote(pool, quoteId) {
  const items = await pool.query('SELECT total_price, total_override FROM line_items WHERE quote_id = $1', [quoteId]);
  const subtotal = items.rows.reduce((sum, i) => sum + parseFloat(i.total_override || i.total_price || 0), 0);
  const quote = await pool.query('SELECT total_override FROM quotes WHERE id = $1', [quoteId]);
  const total = quote.rows[0]?.total_override || subtotal;
  await pool.query('UPDATE quotes SET subtotal = $1, total = $2, updated_at = NOW() WHERE id = $3', [subtotal, total, quoteId]);
}



// Get pricing rules for an org at a given term
router.get('/pricing/:orgId/:termMonths', requireEditor, async (req, res) => {
  const pool = req.app.locals.pool;
  try {
    const rules = await pool.query(
      'SELECT category, description, billing_cycle, unit_price, discount_at_term, sort_order FROM pricing_rules WHERE org_id = $1 AND term_months = $2 ORDER BY sort_order, category',
      [req.params.orgId, parseInt(req.params.termMonths) || 0]
    );
    res.json({ success: true, rules: rules.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load pricing' });
  }
});


// Send agreement email to customer
router.post("/quotes/:id/send", requireEditor, async function(req, res) {
  var pool = req.app.locals.pool;
  var user = req.session.user;
  try {
    var emailHelper = require("../lib/email");
    var result = await emailHelper.sendQuoteEmail(pool, req.params.id, user.id);
    await pool.query("UPDATE quotes SET status = CASE WHEN status = $2 THEN $3 ELSE status END, updated_at = NOW() WHERE id = $1", [req.params.id, "Draft", "Sent"]);
    res.json({ success: true, reviewUrl: result.reviewUrl });
  } catch (err) {
    console.error("Send email error:", err);
    res.status(500).json({ error: "Failed to send: " + err.message });
  }
});

module.exports = router;
