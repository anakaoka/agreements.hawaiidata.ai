#!/usr/bin/env node
// Contract Renewal Notification Script
// Run daily via cron: 0 8 * * * /usr/bin/node /opt/agreements/scripts/notify-renewals.js

require('dotenv').config({ path: '/opt/agreements/.env' });
const { Pool } = require('pg');
const sgMail = require('@sendgrid/mail');

sgMail.setApiKey(process.env.SENDGRID_API_KEY);
const FROM = process.env.SENDGRID_FROM || 'agreements@example.com';
const BASE_URL = (process.env.BASE_URL || 'https://agreements.hawaiidata.ai').replace(/\/+$/, '');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function checkRenewals() {
  const client = await pool.connect();
  try {
    // Find contracts expiring in 6, 3, or 1 month(s) that haven't been notified
    const thresholds = [
      { months: 6, col: 'renewal_notified_6mo', label: '6 months' },
      { months: 3, col: 'renewal_notified_3mo', label: '3 months' },
      { months: 1, col: 'renewal_notified_1mo', label: '1 month' },
    ];

    for (const t of thresholds) {
      const contracts = await client.query(`
        SELECT c.id, c.title, c.contract_number, c.end_date, c.total_value,
               c.org_id, o.name as org_name,
               cust.full_name as customer_name, cust.email as customer_email,
               cust.company as customer_company
        FROM contracts c
        LEFT JOIN organizations o ON c.org_id = o.id
        LEFT JOIN users cust ON c.customer_id = cust.id
        WHERE c.status = 'Active'
          AND c.end_date IS NOT NULL
          AND c.end_date <= (CURRENT_DATE + interval '${t.months} months')
          AND c.end_date > CURRENT_DATE
          AND (c.${t.col} IS NULL OR c.${t.col} = false)
      `);

      for (const contract of contracts.rows) {
        // Get domain admins for this org
        const admins = await client.query(`
          SELECT u.email, u.full_name FROM users u
          JOIN user_organizations uo ON uo.user_id = u.id
          WHERE uo.org_id = $1 AND u.role = 'domain_admin' AND u.is_active = true
        `, [contract.org_id]);

        if (admins.rows.length === 0) continue;

        const endDate = new Date(contract.end_date).toLocaleDateString('en-US', {
          year: 'numeric', month: 'long', day: 'numeric'
        });

        const subject = `Contract Expiring in ${t.label}: ${contract.title} (#${contract.contract_number})`;
        const body = `
Hello,

This is a reminder that the following contract is expiring in ${t.label}:

  Contract: ${contract.title} (#${contract.contract_number})
  Organization: ${contract.org_name}
  Customer: ${contract.customer_name || 'N/A'} ${contract.customer_company ? '(' + contract.customer_company + ')' : ''}
  End Date: ${endDate}
  Value: $${parseFloat(contract.total_value || 0).toFixed(2)}

Please review this contract and take appropriate action (renew, renegotiate, or allow to expire).

View contract: ${BASE_URL}/contracts/${contract.id}

— Agreements Platform
`.trim();

        for (const admin of admins.rows) {
          try {
            await sgMail.send({
              to: admin.email,
              from: FROM,
              subject,
              text: body,
            });
            console.log(`Notified ${admin.email} about contract #${contract.contract_number} (${t.label})`);
          } catch (err) {
            console.error(`Failed to email ${admin.email}:`, err.message);
          }
        }

        // Mark as notified
        await client.query(`UPDATE contracts SET ${t.col} = true WHERE id = $1`, [contract.id]);
      }
    }

    console.log('Renewal check complete:', new Date().toISOString());
  } catch (err) {
    console.error('Renewal check error:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

checkRenewals();
