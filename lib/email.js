const sgMail = require('@sendgrid/mail');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const { generatePDF } = require('./pdf');

sgMail.setApiKey(process.env.SENDGRID_API_KEY);
const BASE_URL = (process.env.BASE_URL || 'https://agreements.hawaiidata.ai').replace(/\/+$/, '');
const FROM_EMAIL = process.env.SENDGRID_FROM || 'agreements@example.com';
const STORAGE_DIR = path.join(__dirname, '..', 'storage', 'contracts');

async function createAccessToken(pool, quoteId, email, expiresInDays) {
  expiresInDays = expiresInDays || 90;
  const token = crypto.randomBytes(48).toString('hex');
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + expiresInDays);
  await pool.query(
    'INSERT INTO quote_access_tokens (quote_id, token, email, expires_at) VALUES ($1, $2, $3, $4)',
    [quoteId, token, email, expiresAt]
  );
  return token;
}

async function sendQuoteEmail(pool, quoteId, userId) {
  const quote = await pool.query(
    'SELECT q.*, o.name as org_name, o.logo_url as org_logo, cr.full_name as sender_name FROM quotes q LEFT JOIN organizations o ON q.org_id = o.id LEFT JOIN users cr ON q.created_by = cr.id WHERE q.id = $1', [quoteId]
  );
  if (quote.rows.length === 0) throw new Error('Quote not found');
  var q = quote.rows[0];
  if (!q.customer_email) throw new Error('No customer email');

  var items = await pool.query('SELECT * FROM line_items WHERE quote_id = $1 ORDER BY sort_order, created_at', [quoteId]);
  var token = await createAccessToken(pool, quoteId, q.customer_email);
  var reviewUrl = BASE_URL + '/review/' + token;
  var orgName = q.org_name || 'Hawaii Data AI';

  var itemsHtml = items.rows.map(function(i) {
    return '<tr><td style="padding:8px 12px;border-bottom:1px solid #eee;">' + i.description.replace(/</g, '&lt;') + '</td><td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:center;">' + parseFloat(i.quantity) + '</td><td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right;">$' + parseFloat(i.unit_price).toFixed(2) + '</td><td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right;font-weight:600;">$' + parseFloat(i.total_price).toFixed(2) + '</td></tr>';
  }).join('');

  var html = '<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;"><div style="max-width:600px;margin:0 auto;padding:20px;"><div style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);"><div style="background:linear-gradient(135deg,#1e293b,#334155);padding:24px 32px;text-align:center;">' + (q.org_logo ? '<img src="' + BASE_URL + q.org_logo + '" alt="' + orgName + '" style="height:40px;max-width:200px;margin-bottom:12px;">' : '') + '<h1 style="color:#fff;margin:0;font-size:20px;">' + orgName + '</h1></div><div style="padding:32px;"><p style="color:#334155;font-size:16px;">Hello <strong>' + (q.customer_name || q.customer_email) + '</strong>,</p><p style="color:#64748b;">You have a new agreement ready for your review:</p><div style="background:#f8fafc;border-radius:8px;padding:16px;margin:16px 0;border-left:4px solid #2563eb;"><h2 style="margin:0 0 4px;color:#1e293b;font-size:18px;">' + q.title + '</h2><p style="margin:0;color:#64748b;font-size:14px;">Agreement #' + q.quote_number + (q.term_months ? ' &middot; ' + (q.term_months == 0 ? 'Month-to-Month' : q.term_months + ' Month Term') : '') + '</p></div><table style="width:100%;border-collapse:collapse;margin:20px 0;font-size:14px;"><thead><tr style="background:#f1f5f9;"><th style="padding:8px 12px;text-align:left;">Item</th><th style="padding:8px 12px;text-align:center;">Qty</th><th style="padding:8px 12px;text-align:right;">Price</th><th style="padding:8px 12px;text-align:right;">Total</th></tr></thead><tbody>' + itemsHtml + '</tbody></table><div style="text-align:right;font-size:18px;font-weight:700;color:#1e293b;padding:12px 0;border-top:2px solid #e2e8f0;">Total: $' + parseFloat(q.total || 0).toFixed(2) + '</div><div style="text-align:center;margin:28px 0;"><a href="' + reviewUrl + '" style="display:inline-block;background:#2563eb;color:#fff;padding:14px 36px;border-radius:8px;text-decoration:none;font-weight:600;font-size:16px;">Review Agreement</a></div><p style="color:#94a3b8;font-size:13px;text-align:center;">This link is valid for 90 days.</p></div><div style="background:#f8fafc;padding:16px 32px;text-align:center;border-top:1px solid #e2e8f0;"><p style="color:#94a3b8;font-size:12px;margin:0;">' + orgName + ' &middot; Powered by Agreements Platform</p></div></div></div></body></html>';

  var msg = {
    to: q.customer_email,
    from: { email: FROM_EMAIL, name: orgName },
    subject: 'Your Agreement from ' + orgName + ' — ' + q.title + ' (#' + q.quote_number + ')',
    html: html,
    text: 'Hello ' + (q.customer_name || '') + ',\n\nYou have a new agreement from ' + orgName + '.\n\n' + q.title + ' (#' + q.quote_number + ')\nTotal: $' + parseFloat(q.total || 0).toFixed(2) + '\n\nReview and accept your agreement here:\n' + reviewUrl + '\n\nThis link is valid for 90 days.\n\n-- ' + orgName
  };

  await sgMail.send(msg);
  console.log('Quote email sent to ' + q.customer_email + ' for quote #' + q.quote_number + ' (' + orgName + ')');

  await pool.query(
    'INSERT INTO audit_log (entity_type, entity_id, action_type, new_value, user_id, user_role, ip_address) VALUES ($1,$2,$3,$4,$5,$6,$7)',
    ['quote', quoteId, 'email_sent', JSON.stringify({ to: q.customer_email, org: orgName }), userId, 'system', '127.0.0.1']
  );

  return { token: token, reviewUrl: reviewUrl };
}

// Generate and store PDF — returns { pdfBuffer, pdfPath } or throws
async function generateAndStorePDF(pool, quoteId, contractId, signerDetails) {
  var contract = await pool.query(
    `SELECT c.*, o.name as org_name, o.logo_url as org_logo,
            cust.full_name as customer_name, cust.email as customer_email, cust.company as customer_company
     FROM contracts c
     LEFT JOIN organizations o ON c.org_id = o.id
     LEFT JOIN users cust ON c.customer_id = cust.id
     WHERE c.id = $1`, [contractId]
  );
  if (contract.rows.length === 0) throw new Error('Contract not found');
  var ct = contract.rows[0];

  var items = await pool.query('SELECT * FROM line_items WHERE quote_id = $1 ORDER BY sort_order, created_at', [quoteId]);
  var orgName = ct.org_name || 'Hawaii Data AI';

  var pdfData = {
    orgName: orgName, contractNumber: ct.contract_number, title: ct.title,
    customerName: ct.customer_name, customerCompany: ct.customer_company || (signerDetails && signerDetails.signerCompany),
    customerEmail: ct.accepted_email || ct.customer_email,
    items: items.rows, totalValue: ct.total_value, legalTerms: ct.legal_terms,
    startDate: ct.start_date, endDate: ct.end_date, termMonths: ct.term_months,
    customerSignatureName: ct.customer_signature_name, customerSignedAt: ct.customer_signed_at,
    adminSignatureName: ct.admin_signature_name, adminSignedAt: ct.admin_signed_at
  };

  if (signerDetails) {
    pdfData.signerTitle = signerDetails.signerTitle;
    pdfData.signerCompany = signerDetails.signerCompany;
    pdfData.signerEmail = signerDetails.signerEmail;
    pdfData.signerPhone = signerDetails.signerPhone;
    pdfData.signerAddress = signerDetails.signerAddress;
  }

  var pdfBuffer = await generatePDF(pdfData);
  if (!pdfBuffer) throw new Error('PDF generation returned empty buffer');

  // Store on disk
  if (!fs.existsSync(STORAGE_DIR)) fs.mkdirSync(STORAGE_DIR, { recursive: true });
  var pdfFilename = 'contract-' + ct.contract_number + '-' + contractId + '.pdf';
  var pdfPath = path.join(STORAGE_DIR, pdfFilename);
  fs.writeFileSync(pdfPath, pdfBuffer);
  fs.chmodSync(pdfPath, 0o600); // Restrict to owner only

  await pool.query('UPDATE contracts SET pdf_path = $1 WHERE id = $2', [pdfPath, contractId]);
  console.log('PDF stored at ' + pdfPath);

  return { pdfBuffer, pdfPath };
}

// Send acceptance confirmation email with attached PDF
async function sendAcceptanceEmail(pool, quoteId, contractId, signerDetails, pdfBuffer) {
  var contract = await pool.query(
    `SELECT c.*, o.name as org_name, o.logo_url as org_logo
     FROM contracts c LEFT JOIN organizations o ON c.org_id = o.id
     WHERE c.id = $1`, [contractId]
  );
  if (contract.rows.length === 0) return;
  var ct = contract.rows[0];

  var recipientEmail = ct.accepted_email || signerDetails.signerEmail;
  if (!recipientEmail) throw new Error('No recipient email');

  var orgName = ct.org_name || 'Hawaii Data AI';
  var startStr = ct.start_date ? new Date(ct.start_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'N/A';
  var endStr = ct.end_date ? new Date(ct.end_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'Month-to-Month';

  var html = '<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f4f4f5;font-family:Arial,Helvetica,sans-serif;"><div style="max-width:600px;margin:0 auto;padding:20px;"><div style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);"><div style="background:linear-gradient(135deg,#059669,#10b981);padding:24px 32px;text-align:center;">' + (ct.org_logo ? '<img src="' + BASE_URL + ct.org_logo + '" alt="' + orgName + '" style="height:40px;max-width:200px;margin-bottom:12px;">' : '') + '<h1 style="color:#fff;margin:0;font-size:20px;">Agreement Confirmed</h1><p style="color:#d1fae5;margin:4px 0 0;font-size:14px;">' + orgName + '</p></div><div style="padding:32px;"><p style="color:#334155;font-size:16px;">Hello <strong>' + (ct.customer_signature_name || recipientEmail) + '</strong>,</p><p style="color:#64748b;">Your agreement has been accepted and is now active. A PDF copy of your signed agreement is attached for your records.</p><div style="background:#f0fdf4;border-radius:8px;padding:16px;margin:16px 0;border-left:4px solid #10b981;"><h2 style="margin:0 0 8px;color:#1e293b;font-size:18px;">' + ct.title + '</h2><p style="margin:0;color:#64748b;font-size:14px;">Contract #' + ct.contract_number + '</p><table style="margin-top:12px;font-size:14px;"><tr><td style="color:#94a3b8;padding-right:16px;">Start Date</td><td style="color:#1e293b;font-weight:600;">' + startStr + '</td></tr><tr><td style="color:#94a3b8;padding-right:16px;">End Date</td><td style="color:#1e293b;font-weight:600;">' + endStr + '</td></tr><tr><td style="color:#94a3b8;padding-right:16px;">Total Value</td><td style="color:#1e293b;font-weight:600;">$' + parseFloat(ct.total_value || 0).toFixed(2) + '/mo</td></tr></table></div><p style="color:#334155;font-size:14px;font-weight:600;">What happens next?</p><ul style="color:#64748b;font-size:14px;line-height:1.8;"><li>Your contract is now active and services will begin per the agreement</li><li>You can access your agreement anytime using the original review link</li><li>Keep this email and the attached PDF for your records</li></ul><p style="color:#64748b;font-size:14px;">Thank you for your business.</p></div><div style="background:#f8fafc;padding:16px 32px;text-align:center;border-top:1px solid #e2e8f0;"><p style="color:#94a3b8;font-size:12px;margin:0;">' + orgName + ' &middot; Powered by Agreements Platform</p></div></div></div></body></html>';

  var msg = {
    to: recipientEmail,
    from: { email: FROM_EMAIL, name: orgName },
    subject: 'Your Signed Agreement — ' + orgName + ' (#' + ct.contract_number + ')',
    html: html,
    text: 'Hello ' + (ct.customer_signature_name || '') + ',\n\nYour agreement with ' + orgName + ' has been accepted and is now active.\n\nContract: ' + ct.title + ' (#' + ct.contract_number + ')\nStart: ' + startStr + '\nEnd: ' + endStr + '\nTotal: $' + parseFloat(ct.total_value || 0).toFixed(2) + '/mo\n\nA PDF copy is attached. Thank you for your business.\n\n-- ' + orgName
  };

  if (pdfBuffer) {
    msg.attachments = [{
      content: pdfBuffer.toString('base64'),
      filename: 'Agreement-' + ct.contract_number + '-' + orgName.replace(/\s+/g, '_') + '.pdf',
      type: 'application/pdf',
      disposition: 'attachment'
    }];
  }

  await sgMail.send(msg);
  console.log('Confirmation email sent to ' + recipientEmail + ' for contract #' + ct.contract_number);
}

// Legacy function — kept for backwards compatibility
async function sendAcceptanceConfirmation(pool, quoteId, contractId, signerDetails) {
  try {
    const result = await generateAndStorePDF(pool, quoteId, contractId, signerDetails);
    await sendAcceptanceEmail(pool, quoteId, contractId, signerDetails, result ? result.pdfBuffer : null);
  } catch (err) {
    console.error('sendAcceptanceConfirmation error:', err);
    throw err;
  }
}

module.exports = { createAccessToken, sendQuoteEmail, sendAcceptanceConfirmation, generateAndStorePDF, sendAcceptanceEmail };
