const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const { isSmsConfigured, sendVerificationCode } = require('../lib/sms');

// Public quote review page (no auth required - uses token)
router.get('/review/:token', async (req, res) => {
  const pool = req.app.locals.pool;
  try {
    const tokenRow = await pool.query(
      `SELECT t.*, q.id as qid, q.title, q.quote_number, q.status, q.subtotal, q.total, q.total_override,
              q.legal_terms, q.notes, q.valid_until, q.term_months, q.customer_name, q.customer_email,
              q.customer_company, q.customer_phone, q.customer_address,
              o.name as org_name, o.logo_url as org_logo, o.slug as org_slug,
              cr.full_name as creator_name
       FROM quote_access_tokens t
       JOIN quotes q ON q.id = t.quote_id
       LEFT JOIN organizations o ON q.org_id = o.id
       LEFT JOIN users cr ON q.created_by = cr.id
       WHERE t.token = $1`,
      [req.params.token]
    );

    if (tokenRow.rows.length === 0) {
      return res.status(404).render('public-error', { message: 'This link is invalid or has expired.' });
    }

    const data = tokenRow.rows[0];

    if (data.expires_at && new Date(data.expires_at) < new Date()) {
      return res.status(410).render('public-error', { message: 'This link has expired. Please contact your account representative.' });
    }

    await pool.query(
      'UPDATE quote_access_tokens SET last_accessed_at = NOW(), access_count = access_count + 1 WHERE id = $1',
      [data.id]
    );

    const items = await pool.query(
      'SELECT * FROM line_items WHERE quote_id = $1 ORDER BY sort_order, created_at',
      [data.qid]
    );

    const revisions = await pool.query(
      `SELECT r.*, u.full_name as requester_name, resp.full_name as responder_name
       FROM revision_requests r
       LEFT JOIN users u ON r.requested_by = u.id
       LEFT JOIN users resp ON r.responded_by = resp.id
       WHERE r.quote_id = $1 ORDER BY r.created_at DESC`,
      [data.qid]
    );

    const contract = await pool.query(
      'SELECT id, status, signed_by_customer FROM contracts WHERE quote_id = $1', [data.qid]
    );

    res.render('public-review', {
      token: req.params.token,
      quote: data,
      items: items.rows,
      revisions: revisions.rows,
      contract: contract.rows[0] || null
    });
  } catch (err) {
    console.error('Public review error:', err);
    res.status(500).render('public-error', { message: 'Something went wrong. Please try again.' });
  }
});

// Step 1: Accept quote - sends SMS verification code
router.post('/review/:token/accept', async (req, res) => {
  const pool = req.app.locals.pool;
  const client = await pool.connect();
  try {
    const tokenRow = await client.query(
      'SELECT t.*, q.id as qid, q.status FROM quote_access_tokens t JOIN quotes q ON q.id = t.quote_id WHERE t.token = $1',
      [req.params.token]
    );

    if (tokenRow.rows.length === 0) return res.status(404).json({ error: 'Invalid link' });
    const data = tokenRow.rows[0];
    if (data.expires_at && new Date(data.expires_at) < new Date()) return res.status(410).json({ error: 'Link expired' });

    const {
      signature_name, accepted_title, accepted_company, accepted_email,
      accepted_phone, accepted_address, terms_agreed,
      electronic_consent, esign_disclosure_accepted
    } = req.body;

    // Validate required fields
    if (!signature_name) return res.status(400).json({ error: 'Full name is required' });
    if (!accepted_title) return res.status(400).json({ error: 'Title/position is required' });
    if (!accepted_company) return res.status(400).json({ error: 'Company name is required' });
    if (!accepted_email) return res.status(400).json({ error: 'Email address is required' });
    if (!accepted_phone) return res.status(400).json({ error: 'Phone number is required' });
    if (!accepted_address) return res.status(400).json({ error: 'Business address is required' });
    if (!terms_agreed) return res.status(400).json({ error: 'You must agree to the Terms & Conditions' });
    if (!electronic_consent) return res.status(400).json({ error: 'You must consent to electronic communications' });
    if (!esign_disclosure_accepted) return res.status(400).json({ error: 'You must acknowledge the electronic signature disclosure' });
    if (!isSmsConfigured()) return res.status(500).json({ error: 'SMS verification is not configured. Please contact your account representative.' });

    // Generate 6-digit verification code
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const codeExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    await client.query('BEGIN');

    // Store signer details and verification code on the quote (pending verification)
    await client.query(
      `UPDATE quotes SET
       accepted_name = $2, accepted_ip = $3, accepted_title = $4, accepted_company = $5,
       accepted_email = $6, accepted_phone = $7, accepted_address = $8,
       accepted_terms_agreed = true, electronic_consent = true, esign_disclosure_accepted = true,
       verification_code = $9, verification_code_expires_at = $10,
       updated_at = NOW()
       WHERE id = $1`,
      [data.qid, signature_name, req.ip, accepted_title, accepted_company,
       accepted_email, accepted_phone, accepted_address, verificationCode, codeExpires]
    );

    // Audit log: acceptance initiated (pending verification)
    const userAgent = req.get('user-agent') || '';
    await client.query(
      'INSERT INTO audit_log (entity_type, entity_id, action_type, new_value, user_id, user_role, ip_address, user_agent) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
      ['quote', data.qid, 'customer_accepted', JSON.stringify({
        stage: 'verification_sent',
        signature_name, accepted_title, accepted_company, accepted_email,
        accepted_phone, accepted_address,
        terms_agreed: true, electronic_consent: true, esign_disclosure_accepted: true,
        via: 'public_link'
      }), null, 'customer', req.ip, userAgent]
    );

    await client.query('COMMIT');

    const quoteData = await pool.query(
      'SELECT q.*, o.name as org_name FROM quotes q LEFT JOIN organizations o ON q.org_id = o.id WHERE q.id = $1',
      [data.qid]
    );
    const q = quoteData.rows[0];
    const orgName = q.org_name || 'Hawaii Data AI';

    await sendVerificationCode(accepted_phone, verificationCode, orgName);

    res.json({ success: true, step: 'verify_sms', message: 'Verification code sent by text message' });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Accept error:', err);
    res.status(500).json({ error: 'Failed to process acceptance. Please try again.' });
  } finally {
    client.release();
  }
});

// Step 2: Verify SMS code and finalize acceptance
router.post('/review/:token/verify', async (req, res) => {
  const pool = req.app.locals.pool;
  const client = await pool.connect();
  try {
    const tokenRow = await client.query(
      'SELECT t.*, q.id as qid, q.status, q.verification_code, q.verification_code_expires_at, q.accepted_name, q.accepted_email, q.accepted_title, q.accepted_company, q.accepted_phone, q.accepted_address FROM quote_access_tokens t JOIN quotes q ON q.id = t.quote_id WHERE t.token = $1',
      [req.params.token]
    );

    if (tokenRow.rows.length === 0) return res.status(404).json({ error: 'Invalid link' });
    const data = tokenRow.rows[0];

    const { code } = req.body;
    if (!code) return res.status(400).json({ error: 'Verification code is required' });

    // Check code
    if (!data.verification_code) return res.status(400).json({ error: 'No verification pending. Please start the acceptance process again.' });
    if (new Date() > new Date(data.verification_code_expires_at)) {
      return res.status(400).json({ error: 'Verification code has expired. Please start over.' });
    }
    if (code.toString().trim() !== data.verification_code.toString().trim()) {
      return res.status(400).json({ error: 'Invalid verification code. Please check your text messages and try again.' });
    }

    const userAgent = req.get('user-agent') || '';
    const signature_name = data.accepted_name;
    const accepted_email = data.accepted_email;
    const accepted_title = data.accepted_title;
    const accepted_company = data.accepted_company;
    const accepted_phone = data.accepted_phone;
    const accepted_address = data.accepted_address;

    await client.query('BEGIN');

    // Mark email as verified and quote as accepted
    await client.query(
      `UPDATE quotes SET status = 'Accepted', email_verified_at = NOW(), accepted_at = NOW(),
       verification_code = NULL, verification_code_expires_at = NULL, updated_at = NOW()
       WHERE id = $1`,
      [data.qid]
    );

    // Get full quote data
    const quoteData = await client.query('SELECT * FROM quotes WHERE id = $1', [data.qid]);
    const q = quoteData.rows[0];

    // Check if contract already exists
    const existing = await client.query('SELECT id FROM contracts WHERE quote_id = $1', [data.qid]);
    let contractId;

    if (existing.rows.length === 0) {
      const items = await client.query('SELECT * FROM line_items WHERE quote_id = $1 ORDER BY sort_order, created_at', [data.qid]);
      let bodyLines = items.rows.map(i =>
        i.description + '  —  Qty: ' + parseFloat(i.quantity) + '  x  $' + parseFloat(i.unit_price).toFixed(2) + '  =  $' + parseFloat(i.total_price).toFixed(2)
      );
      bodyLines.push('', 'Total: $' + parseFloat(q.total || 0).toFixed(2));

      const startDate = new Date();
      let endDate = null;
      if (q.term_months) {
        endDate = new Date(startDate);
        endDate.setMonth(endDate.getMonth() + parseInt(q.term_months));
      }

      // Generate agreement hash (SHA-256 of terms + items + pricing)
      const hashSource = JSON.stringify({
        legal_terms: q.legal_terms,
        items: items.rows.map(i => ({ desc: i.description, qty: i.quantity, price: i.unit_price, total: i.total_price })),
        total: q.total,
        term_months: q.term_months
      });
      const agreementHash = crypto.createHash('sha256').update(hashSource).digest('hex');

      const contract = await client.query(
        `INSERT INTO contracts (title, quote_id, customer_id, created_by, status, total_value, org_id,
         contract_body, legal_terms, term_months, start_date, end_date,
         signed_by_customer, customer_signed_at, customer_signature_name,
         signed_by_admin, admin_signed_at, admin_signature_name,
         accepted_title, accepted_company, accepted_email, accepted_phone, accepted_address,
         accepted_terms_agreed, accepted_ip, agreement_hash,
         electronic_consent, esign_disclosure_accepted)
         VALUES ($1,$2,$3,$4,'Active',$5,$6,$7,$8,$9,$10,$11,true,NOW(),$12,true,NOW(),$13,$14,$15,$16,$17,$18,true,$19,$20,true,true) RETURNING id, contract_number`,
        [q.title, q.id, q.customer_id, q.created_by, q.total || 0, q.org_id,
         bodyLines.join('\n'), q.legal_terms, q.term_months ? parseInt(q.term_months) : null,
         startDate.toISOString().split('T')[0], endDate ? endDate.toISOString().split('T')[0] : null,
         signature_name, 'Auto-approved',
         accepted_title, accepted_company, accepted_email, accepted_phone, accepted_address, req.ip, agreementHash]
      );
      contractId = contract.rows[0].id;

      await client.query(
        'INSERT INTO contract_versions (contract_id, version_number, contract_body, legal_terms, changed_by, change_summary) VALUES ($1,1,$2,$3,$4,$5)',
        [contractId, bodyLines.join('\n'), q.legal_terms, q.customer_id, 'Customer accepted via review link (email verified)']
      );
    } else {
      contractId = existing.rows[0].id;
      await client.query(
        `UPDATE contracts SET signed_by_customer = true, customer_signed_at = NOW(),
         customer_signature_name = $1, status = 'Active', start_date = COALESCE(start_date, CURRENT_DATE),
         accepted_title = $3, accepted_company = $4, accepted_email = $5,
         accepted_phone = $6, accepted_address = $7, accepted_terms_agreed = true, accepted_ip = $8,
         electronic_consent = true, esign_disclosure_accepted = true
         WHERE id = $2`,
        [signature_name, contractId, accepted_title, accepted_company, accepted_email, accepted_phone, accepted_address, req.ip]
      );
      if (q.term_months) {
        await client.query(
          "UPDATE contracts SET end_date = (COALESCE(start_date, CURRENT_DATE) + ($1 || ' months')::interval)::date, term_months = $1::integer WHERE id = $2 AND end_date IS NULL",
          [parseInt(q.term_months), contractId]
        );
      }
    }

    // Audit log with full signer details + user agent
    await client.query(
      'INSERT INTO audit_log (entity_type, entity_id, action_type, new_value, user_id, user_role, ip_address, user_agent) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
      ['quote', data.qid, 'customer_accepted', JSON.stringify({
        stage: 'finalized',
        signature_name, accepted_title, accepted_company, accepted_email, accepted_phone, accepted_address,
        terms_agreed: true, electronic_consent: true, esign_disclosure_accepted: true,
        email_verified: true, via: 'public_link'
      }), q.customer_id, 'customer', req.ip, userAgent]
    );

    await client.query('UPDATE quote_access_tokens SET contract_id = $1 WHERE id = $2', [contractId, data.id]);

    // Generate PDF (BLOCKING — rollback if fails)
    const emailHelper = require('../lib/email');
    let pdfResult;
    try {
      pdfResult = await emailHelper.generateAndStorePDF(pool, data.qid, contractId, {
        signerName: signature_name, signerTitle: accepted_title, signerCompany: accepted_company,
        signerEmail: accepted_email, signerPhone: accepted_phone, signerAddress: accepted_address
      });
    } catch (pdfErr) {
      console.error('PDF generation failed (blocking):', pdfErr);
      await client.query('ROLLBACK');
      return res.status(500).json({ error: 'Failed to generate agreement PDF. Please try again.' });
    }

    // Store pdf_hash if we got a buffer
    if (pdfResult && pdfResult.pdfBuffer) {
      const pdfHash = crypto.createHash('sha256').update(pdfResult.pdfBuffer).digest('hex');
      await client.query('UPDATE contracts SET pdf_hash = $1 WHERE id = $2', [pdfHash, contractId]);
    }

    await client.query('COMMIT');

    // Send confirmation email (BLOCKING — but don't rollback DB, just warn)
    try {
      await emailHelper.sendAcceptanceEmail(pool, data.qid, contractId, {
        signerName: signature_name, signerTitle: accepted_title, signerCompany: accepted_company,
        signerEmail: accepted_email, signerPhone: accepted_phone, signerAddress: accepted_address
      }, pdfResult ? pdfResult.pdfBuffer : null);

      await pool.query('UPDATE contracts SET confirmation_email_sent_at = NOW() WHERE id = $1', [contractId]);
    } catch (emailErr) {
      console.error('Confirmation email failed (non-blocking):', emailErr);
      // Acceptance is already committed — log the failure
      await pool.query(
        'INSERT INTO audit_log (entity_type, entity_id, action_type, new_value, user_role, ip_address, user_agent) VALUES ($1,$2,$3,$4,$5,$6,$7)',
        ['contract', contractId, 'email_sent', JSON.stringify({ status: 'failed', error: emailErr.message, to: accepted_email }), 'system', req.ip, userAgent]
      );
    }

    res.json({ success: true, contractId });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Verify error:', err);
    res.status(500).json({ error: 'Failed to finalize acceptance' });
  } finally {
    client.release();
  }
});

// Download contract PDF (public, requires token)
router.get('/review/:token/download', async (req, res) => {
  const pool = req.app.locals.pool;
  try {
    const tokenRow = await pool.query(
      `SELECT t.*, c.pdf_path, c.contract_number, o.name as org_name
       FROM quote_access_tokens t
       LEFT JOIN contracts c ON c.id = t.contract_id
       LEFT JOIN organizations o ON c.org_id = o.id
       WHERE t.token = $1`,
      [req.params.token]
    );
    if (tokenRow.rows.length === 0) return res.status(404).send('Invalid link');
    const data = tokenRow.rows[0];
    if (!data.pdf_path || !fs.existsSync(data.pdf_path)) {
      return res.status(404).send('PDF not yet available');
    }
    var filename = 'Agreement-' + data.contract_number + '-' + (data.org_name || 'Contract').replace(/\s+/g, '_') + '.pdf';
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="' + filename + '"');
    fs.createReadStream(data.pdf_path).pipe(res);
  } catch (err) {
    console.error('Download error:', err);
    res.status(500).send('Error downloading PDF');
  }
});

// Request revision (public)
router.post('/review/:token/revision', async (req, res) => {
  const pool = req.app.locals.pool;
  try {
    const tokenRow = await pool.query(
      'SELECT t.*, q.customer_id FROM quote_access_tokens t JOIN quotes q ON q.id = t.quote_id WHERE t.token = $1',
      [req.params.token]
    );
    if (tokenRow.rows.length === 0) return res.status(404).json({ error: 'Invalid link' });
    const data = tokenRow.rows[0];

    const { request_message } = req.body;
    if (!request_message) return res.status(400).json({ error: 'Message required' });

    await pool.query(
      'INSERT INTO revision_requests (quote_id, requested_by, request_message) VALUES ($1,$2,$3)',
      [data.quote_id, data.customer_id, request_message]
    );
    await pool.query("UPDATE quotes SET status = 'Pending Revision', updated_at = NOW() WHERE id = $1", [data.quote_id]);

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to submit revision' });
  }
});

module.exports = router;
