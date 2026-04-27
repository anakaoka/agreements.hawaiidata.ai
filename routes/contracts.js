const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();
const { requireAuth, requireEditor, requireAdmin } = require('../middleware/auth');

// List contracts
router.get('/', requireAuth, async (req, res) => {
  const pool = req.app.locals.pool;
  const user = req.session.user;
  try {
    let contracts;
    if (user.role === 'customer') {
      contracts = await pool.query(
        `SELECT c.*, u.full_name as customer_name, u.company as customer_company, cr.full_name as creator_name
         FROM contracts c LEFT JOIN users u ON c.customer_id = u.id LEFT JOIN users cr ON c.created_by = cr.id
         WHERE c.customer_id = $1 ORDER BY c.updated_at DESC`, [user.id]
      );
    } else {
      contracts = await pool.query(
        `SELECT c.*, u.full_name as customer_name, u.company as customer_company, cr.full_name as creator_name
         FROM contracts c LEFT JOIN users u ON c.customer_id = u.id LEFT JOIN users cr ON c.created_by = cr.id
         ORDER BY c.updated_at DESC`
      );
    }
    res.render('contracts', { contracts: contracts.rows });
  } catch (err) {
    console.error(err);
    res.render('error', { message: 'Failed to load contracts' });
  }
});

// New contract form
router.get('/new', requireEditor, async (req, res) => {
  const pool = req.app.locals.pool;
  const customers = await pool.query("SELECT id, full_name, company, email FROM users WHERE role = 'customer' AND is_active = true ORDER BY full_name");
  const quotes = await pool.query("SELECT id, quote_number, title, total FROM quotes WHERE status IN ('Accepted', 'Ready for Acceptance') ORDER BY quote_number DESC");
  res.render('contract-form', { contract: null, customers: customers.rows, quotes: quotes.rows, error: null });
});

// Create contract
router.post('/', requireEditor, async (req, res) => {
  const pool = req.app.locals.pool;
  const user = req.session.user;
  const { title, quote_id, customer_id, start_date, end_date, auto_renew, renewal_terms, contract_body, legal_terms, total_value, notes } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO contracts (title, quote_id, customer_id, created_by, start_date, end_date, auto_renew, renewal_terms, contract_body, legal_terms, total_value, notes, org_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id`,
      [title, quote_id || null, customer_id || null, user.id, start_date || null, end_date || null, auto_renew === 'on', renewal_terms, contract_body, legal_terms, total_value || 0, notes, req.session.user.org_id || null]
    );
    // Save first version
    await pool.query(
      'INSERT INTO contract_versions (contract_id, version_number, contract_body, legal_terms, changed_by, change_summary) VALUES ($1, 1, $2, $3, $4, $5)',
      [result.rows[0].id, contract_body, legal_terms, user.id, 'Initial draft']
    );
    await pool.query(
      'INSERT INTO audit_log (entity_type, entity_id, action_type, new_value, user_id, user_role, ip_address) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      ['contract', result.rows[0].id, 'add', JSON.stringify({ title }), user.id, user.role, req.ip]
    );
    res.redirect('/contracts/' + result.rows[0].id);
  } catch (err) {
    console.error(err);
    const customers = await pool.query("SELECT id, full_name, company, email FROM users WHERE role = 'customer' AND is_active = true");
    const quotes = await pool.query("SELECT id, quote_number, title, total FROM quotes WHERE status IN ('Accepted', 'Ready for Acceptance')");
    res.render('contract-form', { contract: null, customers: customers.rows, quotes: quotes.rows, error: 'Failed to create contract' });
  }
});

// View contract
router.get('/:id', requireAuth, async (req, res) => {
  const pool = req.app.locals.pool;
  const user = req.session.user;
  try {
    const result = await pool.query(
      `SELECT c.*, u.full_name as customer_name, u.company as customer_company, u.email as customer_email,
       cr.full_name as creator_name, q.quote_number, q.title as quote_title
       FROM contracts c
       LEFT JOIN users u ON c.customer_id = u.id
       LEFT JOIN users cr ON c.created_by = cr.id
       LEFT JOIN quotes q ON c.quote_id = q.id
       WHERE c.id = $1`, [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).render('error', { message: 'Contract not found' });
    const contract = result.rows[0];
    if (user.role === 'customer' && contract.customer_id !== user.id) return res.status(403).render('error', { message: 'Access denied' });

    const versions = await pool.query(
      'SELECT v.*, u.full_name as changed_by_name FROM contract_versions v LEFT JOIN users u ON v.changed_by = u.id WHERE v.contract_id = $1 ORDER BY v.version_number DESC',
      [req.params.id]
    );
    const audit = await pool.query(
      'SELECT a.*, u.full_name as user_name FROM audit_log a LEFT JOIN users u ON a.user_id = u.id WHERE a.entity_id = $1 ORDER BY a.created_at DESC LIMIT 30',
      [req.params.id]
    );
    res.render('contract', { contract, versions: versions.rows, audit: audit.rows });
  } catch (err) {
    console.error(err);
    res.render('error', { message: 'Failed to load contract' });
  }
});

// Sign contract (customer or admin)
router.post('/:id/sign', requireAuth, async (req, res) => {
  const pool = req.app.locals.pool;
  const user = req.session.user;
  const { signature_name } = req.body;
  try {
    if (user.role === 'customer') {
      await pool.query(
        'UPDATE contracts SET signed_by_customer = true, customer_signed_at = NOW(), customer_signature_name = $1, updated_at = NOW() WHERE id = $2',
        [signature_name, req.params.id]
      );
    } else {
      await pool.query(
        'UPDATE contracts SET signed_by_admin = true, admin_signed_at = NOW(), admin_signature_name = $1, updated_at = NOW() WHERE id = $2',
        [signature_name, req.params.id]
      );
    }
    // Check if both signed -> activate
    const c = await pool.query('SELECT signed_by_customer, signed_by_admin FROM contracts WHERE id = $1', [req.params.id]);
    if (c.rows[0].signed_by_customer && c.rows[0].signed_by_admin) {
      await pool.query("UPDATE contracts SET status = 'Active', updated_at = NOW() WHERE id = $1", [req.params.id]);
    }
    await pool.query(
      'INSERT INTO audit_log (entity_type, entity_id, action_type, new_value, user_id, user_role, ip_address) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      ['contract', req.params.id, 'edit', JSON.stringify({ action: 'signed', signature_name }), user.id, user.role, req.ip]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to sign' });
  }
});

// Update contract status
router.post('/:id/status', requireAdmin, async (req, res) => {
  const pool = req.app.locals.pool;
  const user = req.session.user;
  const { status } = req.body;
  try {
    await pool.query('UPDATE contracts SET status = $1, updated_at = NOW() WHERE id = $2', [status, req.params.id]);
    await pool.query(
      'INSERT INTO audit_log (entity_type, entity_id, action_type, new_value, user_id, user_role, ip_address) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      ['contract', req.params.id, 'status_change', JSON.stringify({ status }), user.id, user.role, req.ip]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update' });
  }
});

// Send for signature
router.post('/:id/send', requireEditor, async (req, res) => {
  const pool = req.app.locals.pool;
  const user = req.session.user;
  try {
    await pool.query("UPDATE contracts SET status = 'Pending Signature', updated_at = NOW() WHERE id = $1", [req.params.id]);
    await pool.query(
      'INSERT INTO audit_log (entity_type, entity_id, action_type, new_value, user_id, user_role, ip_address) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      ['contract', req.params.id, 'status_change', JSON.stringify({ status: 'Pending Signature' }), user.id, user.role, req.ip]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to send' });
  }
});


// Download contract PDF (authenticated)
router.get('/:id/download', requireAuth, async (req, res) => {
  const pool = req.app.locals.pool;
  const user = req.session.user;
  try {
    const result = await pool.query('SELECT * FROM contracts WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).send('Contract not found');
    const contract = result.rows[0];
    if (user.role === 'customer' && contract.customer_id !== user.id) return res.status(403).send('Access denied');

    if (contract.pdf_path && fs.existsSync(contract.pdf_path)) {
      var filename = 'Agreement-' + contract.contract_number + '.pdf';
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="' + filename + '"');
      return fs.createReadStream(contract.pdf_path).pipe(res);
    }

    // Generate PDF on the fly if not stored
    const pdfLib = require('../lib/pdf');
    let orgName = 'Hawaii Data AI';
    let customerName = contract.customer_signature_name;
    let customerCompany = contract.accepted_company;
    let customerEmail = contract.accepted_email;
    let items = [];

    if (contract.quote_id) {
      const quoteData = await pool.query(
        `SELECT q.*, o.name as org_name, o.logo_url as org_logo, cr.full_name as creator_name,
                cust.full_name as customer_name, cust.email as customer_email, cust.company as customer_company
         FROM quotes q LEFT JOIN organizations o ON q.org_id = o.id LEFT JOIN users cr ON q.created_by = cr.id
         LEFT JOIN users cust ON q.customer_id = cust.id WHERE q.id = $1`, [contract.quote_id]);
      if (quoteData.rows.length > 0) {
        const q = quoteData.rows[0];
        orgName = q.org_name || orgName;
        customerName = customerName || q.customer_name;
        customerCompany = customerCompany || q.customer_company;
        customerEmail = customerEmail || q.customer_email;
      }
      const itemRows = await pool.query('SELECT * FROM line_items WHERE quote_id = $1 ORDER BY sort_order', [contract.quote_id]);
      items = itemRows.rows;
    } else {
      // Contract without quote — get org name from org_id
      if (contract.org_id) {
        const orgRow = await pool.query('SELECT name FROM organizations WHERE id = $1', [contract.org_id]);
        if (orgRow.rows.length > 0) orgName = orgRow.rows[0].name;
      }
      // Get customer name from customer_id
      if (contract.customer_id && !customerName) {
        const custRow = await pool.query('SELECT full_name, email, company FROM users WHERE id = $1', [contract.customer_id]);
        if (custRow.rows.length > 0) {
          customerName = custRow.rows[0].full_name;
          customerEmail = customerEmail || custRow.rows[0].email;
          customerCompany = customerCompany || custRow.rows[0].company;
        }
      }
    }

    var pdfData = {
      orgName: orgName, contractNumber: contract.contract_number,
      title: contract.title, customerName: customerName, customerCompany: customerCompany,
      customerEmail: customerEmail,
      items: items, totalValue: contract.total_value, legalTerms: contract.legal_terms,
      startDate: contract.start_date, endDate: contract.end_date, termMonths: contract.term_months,
      customerSignatureName: contract.customer_signature_name, customerSignedAt: contract.customer_signed_at,
      adminSignatureName: contract.admin_signature_name, adminSignedAt: contract.admin_signed_at,
      signerTitle: contract.accepted_title, signerCompany: contract.accepted_company,
      signerEmail: contract.accepted_email, signerPhone: contract.accepted_phone,
      signerAddress: contract.accepted_address
    };

    const pdfBuffer = await pdfLib.generatePDF(pdfData);
    var filename = 'Agreement-' + contract.contract_number + '.pdf';
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="' + filename + '"');
    res.send(pdfBuffer);
  } catch (err) {
    console.error('PDF download error:', err);
    res.status(500).send('Error generating PDF');
  }
});


// Start billing — sets billing start date and recalculates term end date
router.post('/:id/start-billing', requireAdmin, async (req, res) => {
  const pool = req.app.locals.pool;
  try {
    const contract = await pool.query('SELECT * FROM contracts WHERE id = $1', [req.params.id]);
    if (contract.rows.length === 0) return res.status(404).json({ error: 'Contract not found' });
    const c = contract.rows[0];

    if (c.billing_started_at) return res.status(400).json({ error: 'Billing already started' });

    const startDate = new Date();
    let endDate = null;
    if (c.term_months && c.term_months > 0) {
      endDate = new Date(startDate);
      endDate.setMonth(endDate.getMonth() + parseInt(c.term_months));
    }

    await pool.query(
      `UPDATE contracts SET billing_started_at = NOW(), billing_started_by = $2,
       start_date = $3, end_date = $4 WHERE id = $1`,
      [req.params.id, req.session.user.id,
       startDate.toISOString().split('T')[0],
       endDate ? endDate.toISOString().split('T')[0] : null]
    );

    // Audit log
    await pool.query(
      'INSERT INTO audit_log (entity_type, entity_id, action_type, new_value, user_id, user_role, ip_address) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      ['contract', req.params.id, 'status_change',
       JSON.stringify({ action: 'billing_started', start_date: startDate.toISOString().split('T')[0], end_date: endDate ? endDate.toISOString().split('T')[0] : null }),
       req.session.user.id, req.session.user.role, req.ip]
    );

    res.json({
      success: true,
      startDate: startDate.toLocaleDateString(),
      endDate: endDate ? endDate.toLocaleDateString() : 'Month-to-Month'
    });
  } catch (err) {
    console.error('Start billing error:', err);
    res.status(500).json({ error: 'Failed to start billing' });
  }
});

module.exports = router;
