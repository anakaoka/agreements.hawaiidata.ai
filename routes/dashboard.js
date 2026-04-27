const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');

// Resolve org by slug or UUID
async function resolveOrg(pool, param) {
  // Try slug first
  var result = await pool.query('SELECT * FROM organizations WHERE slug = $1', [param]);
  if (result.rows.length > 0) return result.rows[0];
  // Only try UUID if it looks like a valid UUID
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(param)) {
    result = await pool.query('SELECT * FROM organizations WHERE id = $1', [param]);
    return result.rows[0] || null;
  }
  // Try partial/fuzzy match on name
  result = await pool.query("SELECT * FROM organizations WHERE LOWER(REPLACE(name, ' ', '-')) = LOWER($1)", [param]);
  return result.rows[0] || null;
}

// Switch active org and go to org detail
router.get('/switch-org/:orgParam', requireAuth, async function(req, res) {
  var pool = req.app.locals.pool;
  var user = req.session.user;
  var org = await resolveOrg(pool, req.params.orgParam);
  if (org) {
    var check = await pool.query('SELECT org_id FROM user_organizations WHERE user_id = $1 AND org_id = $2', [user.id, org.id]);
    if (check.rows.length > 0) req.session.user.active_org_id = org.id;
    return res.redirect('/dashboard/' + org.slug);
  }
  res.redirect('/dashboard');
});

// Main dashboard = Overview (clickable summary bar leads to filtered views)
router.get('/', requireAuth, async function(req, res) {
  var pool = req.app.locals.pool;
  var user = req.session.user;

  if (user.role === 'customer') {
    return renderOrgDashboard(req, res, pool, user, null, null);
  }

  try {
    var userOrgs = await pool.query(
      'SELECT o.* FROM organizations o JOIN user_organizations uo ON o.id = uo.org_id WHERE uo.user_id = $1 ORDER BY o.name', [user.id]
    );

    var orgStats = [];
    for (var i = 0; i < userOrgs.rows.length; i++) {
      var org = userOrgs.rows[i];
      var quotes = await pool.query('SELECT status, count(*)::int as cnt FROM quotes WHERE org_id = $1 GROUP BY status', [org.id]);
      var contracts = await pool.query('SELECT status, count(*)::int as cnt FROM contracts WHERE org_id = $1 GROUP BY status', [org.id]);
      var expiring = await pool.query(
        "SELECT id, title, contract_number, end_date, customer_id, (SELECT full_name FROM users WHERE id = c.customer_id) as customer_name FROM contracts c WHERE org_id = $1 AND status = 'Active' AND end_date IS NOT NULL AND end_date <= (CURRENT_DATE + interval '3 months') AND end_date > CURRENT_DATE ORDER BY end_date ASC LIMIT 10", [org.id]
      );

      var qMap = {};
      quotes.rows.forEach(function(r) { qMap[r.status] = r.cnt; });
      var cMap = {};
      contracts.rows.forEach(function(r) { cMap[r.status] = r.cnt; });

      orgStats.push({
        org: org,
        quotes: { total: Object.values(qMap).reduce(function(a,b){return a+b;}, 0), draft: qMap['Draft'] || 0, sent: qMap['Sent'] || 0, accepted: qMap['Accepted'] || 0 },
        contracts: { total: Object.values(cMap).reduce(function(a,b){return a+b;}, 0), active: cMap['Active'] || 0, pending: cMap['Pending Signature'] || 0 },
        expiring: expiring.rows
      });
    }

    res.render('overview', { orgStats: orgStats, userOrgs: userOrgs.rows });
  } catch (err) {
    console.error(err);
    res.render('error', { message: 'Failed to load dashboard' });
  }
});

// Filtered view: show all quotes/contracts of a given status across all orgs
router.get('/filter/:type/:status', requireAuth, async function(req, res) {
  var pool = req.app.locals.pool;
  var user = req.session.user;
  var type = req.params.type; // 'quotes' or 'contracts'
  var status = decodeURIComponent(req.params.status);

  try {
    var userOrgs = await pool.query(
      'SELECT o.* FROM organizations o JOIN user_organizations uo ON o.id = uo.org_id WHERE uo.user_id = $1 ORDER BY o.name', [user.id]
    );
    var orgIds = userOrgs.rows.map(function(o) { return o.id; });

    var items = [];
    if (type === 'quotes') {
      var result = await pool.query(
        "SELECT q.*, c.full_name as customer_name, c.company as customer_company, o.name as org_name, o.slug as org_slug FROM quotes q LEFT JOIN users c ON q.customer_id = c.id LEFT JOIN organizations o ON q.org_id = o.id WHERE q.org_id = ANY($1) AND q.status = $2 ORDER BY q.updated_at DESC",
        [orgIds, status]
      );
      items = result.rows;
    } else {
      var result = await pool.query(
        "SELECT c.*, u.full_name as customer_name, u.company as customer_company, o.name as org_name, o.slug as org_slug FROM contracts c LEFT JOIN users u ON c.customer_id = u.id LEFT JOIN organizations o ON c.org_id = o.id WHERE c.org_id = ANY($1) AND c.status = $2 ORDER BY c.updated_at DESC",
        [orgIds, status]
      );
      items = result.rows;
    }

    res.render('filtered-list', { type: type, status: status, items: items, userOrgs: userOrgs.rows });
  } catch (err) {
    console.error(err);
    res.render('error', { message: 'Failed to load filtered view' });
  }
});

// Expiring contracts across all orgs
router.get('/filter/expiring', requireAuth, async function(req, res) {
  var pool = req.app.locals.pool;
  var user = req.session.user;
  try {
    var userOrgs = await pool.query(
      'SELECT o.* FROM organizations o JOIN user_organizations uo ON o.id = uo.org_id WHERE uo.user_id = $1 ORDER BY o.name', [user.id]
    );
    var orgIds = userOrgs.rows.map(function(o) { return o.id; });

    var result = await pool.query(
      "SELECT c.*, u.full_name as customer_name, u.company as customer_company, o.name as org_name, o.slug as org_slug FROM contracts c LEFT JOIN users u ON c.customer_id = u.id LEFT JOIN organizations o ON c.org_id = o.id WHERE c.org_id = ANY($1) AND c.status = 'Active' AND c.end_date IS NOT NULL AND c.end_date <= (CURRENT_DATE + interval '3 months') AND c.end_date > CURRENT_DATE ORDER BY c.end_date ASC",
      [orgIds]
    );

    res.render('filtered-list', { type: 'contracts', status: 'Expiring Soon', items: result.rows, userOrgs: userOrgs.rows });
  } catch (err) {
    console.error(err);
    res.render('error', { message: 'Failed to load expiring contracts' });
  }
});

// Org detail dashboard by slug
router.get('/:orgSlug', requireAuth, async function(req, res) {
  var pool = req.app.locals.pool;
  var user = req.session.user;
  var org = await resolveOrg(pool, req.params.orgSlug);
  if (!org) return res.redirect('/dashboard');
  req.session.user.active_org_id = org.id;
  return renderOrgDashboard(req, res, pool, user, org.id, req.query.filter || null);
});

// Keep /overview as alias
router.get('/overview', requireAuth, function(req, res) {
  res.redirect('/dashboard');
});

// Old UUID route — redirect to slug
router.get('/org/:orgId', requireAuth, async function(req, res) {
  var pool = req.app.locals.pool;
  var org = await resolveOrg(pool, req.params.orgId);
  if (org) return res.redirect('/dashboard/' + org.slug);
  res.redirect('/dashboard');
});

async function renderOrgDashboard(req, res, pool, user, orgId, statusFilter) {
  try {
    var userOrgs = await pool.query(
      'SELECT o.* FROM organizations o JOIN user_organizations uo ON o.id = uo.org_id WHERE uo.user_id = $1 ORDER BY o.name', [user.id]
    );

    var activeOrgId = orgId || user.active_org_id || user.org_id || (userOrgs.rows[0] && userOrgs.rows[0].id);
    var org = null;
    if (activeOrgId) {
      var orgResult = await pool.query('SELECT * FROM organizations WHERE id = $1', [activeOrgId]);
      if (orgResult.rows.length > 0) org = orgResult.rows[0];
    }

    var quotes, contracts;
    if (user.role === 'customer') {
      quotes = await pool.query(
        'SELECT q.*, u.full_name as created_by_name FROM quotes q LEFT JOIN users u ON q.created_by = u.id WHERE q.customer_id = $1 ORDER BY q.updated_at DESC', [user.id]
      );
      contracts = await pool.query(
        'SELECT * FROM contracts WHERE customer_id = $1 ORDER BY updated_at DESC', [user.id]
      );
    } else if (activeOrgId) {
      quotes = await pool.query(
        'SELECT q.*, c.full_name as customer_name, c.company as customer_company FROM quotes q LEFT JOIN users c ON q.customer_id = c.id WHERE q.org_id = $1 ORDER BY q.updated_at DESC', [activeOrgId]
      );
      contracts = await pool.query(
        'SELECT c.*, u.full_name as customer_name, u.company as customer_company FROM contracts c LEFT JOIN users u ON c.customer_id = u.id WHERE c.org_id = $1 ORDER BY c.updated_at DESC', [activeOrgId]
      );
    } else {
      quotes = await pool.query(
        'SELECT q.*, c.full_name as customer_name, c.company as customer_company FROM quotes q LEFT JOIN users c ON q.customer_id = c.id ORDER BY q.updated_at DESC'
      );
      contracts = await pool.query(
        'SELECT c.*, u.full_name as customer_name, u.company as customer_company FROM contracts c LEFT JOIN users u ON c.customer_id = u.id ORDER BY c.updated_at DESC'
      );
    }

    var stats = {
      total: quotes.rows.length,
      draft: quotes.rows.filter(function(q){return q.status === 'Draft';}).length,
      sent: quotes.rows.filter(function(q){return q.status === 'Sent';}).length,
      accepted: quotes.rows.filter(function(q){return q.status === 'Accepted';}).length,
      pending: quotes.rows.filter(function(q){return ['Pending Revision','Revised'].indexOf(q.status) !== -1;}).length,
      contracts_total: contracts.rows.length,
      contracts_active: contracts.rows.filter(function(c){return c.status === 'Active';}).length,
      contracts_pending: contracts.rows.filter(function(c){return c.status === 'Pending Signature';}).length
    };

    // Apply status filter if present
    var filteredQuotes = quotes.rows;
    var filteredContracts = contracts.rows;
    var activeTab = 'quotes';
    if (statusFilter) {
      if (['Draft','Sent','Accepted','Pending Revision','Revised'].indexOf(statusFilter) !== -1) {
        filteredQuotes = quotes.rows.filter(function(q){return q.status === statusFilter;});
      } else if (['Active','Pending Signature'].indexOf(statusFilter) !== -1) {
        filteredContracts = contracts.rows.filter(function(c){return c.status === statusFilter;});
        activeTab = 'contracts';
      }
    }

    res.render('dashboard', { quotes: filteredQuotes, contracts: filteredContracts, stats: stats, org: org, userOrgs: userOrgs.rows, statusFilter: statusFilter, activeTab: activeTab });
  } catch (err) {
    console.error(err);
    res.render('error', { message: 'Failed to load dashboard' });
  }
}

module.exports = router;
