const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const MicrosoftStrategy = require('passport-microsoft').Strategy;
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const BASE_URL = (process.env.BASE_URL || 'https://agreements.hawaiidata.ai').replace(/\/+$/, '');

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

// Find org by email domain
async function findOrgByDomain(email) {
  const domain = email.split('@')[1];
  const result = await pool.query("SELECT id FROM organizations WHERE $1 = ANY(domains)", [domain]);
  return result.rows.length > 0 ? result.rows[0].id : null;
}

// Shared OAuth login handler
async function handleOAuthLogin(req, profile, provider, done) {
  try {
    const email = profile.emails && profile.emails[0] && profile.emails[0].value;
    if (!email) return done(null, false, { message: 'No email found in profile' });

    const emailLower = email.toLowerCase();
    const idColumn = provider === 'google' ? 'google_id' : 'microsoft_id';

    let result = await pool.query('SELECT * FROM users WHERE email = $1', [emailLower]);

    if (result.rows.length > 0) {
      const user = result.rows[0];
      if (!user.is_active) return done(null, false, { message: 'Account is disabled' });

      if (!user[idColumn]) {
        await pool.query(`UPDATE users SET ${idColumn} = $1, updated_at = NOW() WHERE id = $2`, [profile.id, user.id]);
      }

      // Auto-assign org if missing
      if (!user.org_id) {
        const orgId = await findOrgByDomain(emailLower);
        if (orgId) await pool.query('UPDATE users SET org_id = $1 WHERE id = $2', [orgId, user.id]);
        user.org_id = orgId;
      }

      await pool.query(
        'INSERT INTO audit_log (entity_type, entity_id, action_type, new_value, user_id, user_role, ip_address) VALUES ($1,$2,$3,$4,$5,$6,$7)',
        ['user', user.id, 'login', JSON.stringify({ method: provider, email: emailLower }), user.id, user.role, req.ip]
      );

      return done(null, {
        id: user.id, email: user.email, full_name: user.full_name,
        role: user.role, company: user.company, org_id: user.org_id
      });
    }

    // Auto-provision new user as customer
    const orgId = await findOrgByDomain(emailLower);
    const fullName = profile.displayName || emailLower.split('@')[0];
    const domain = emailLower.split('@')[1];

    const newUser = await pool.query(
      `INSERT INTO users (email, password_hash, full_name, role, company, ${idColumn}, org_id) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [emailLower, provider.toUpperCase() + '_AUTH_ONLY', fullName, 'customer', domain, profile.id, orgId]
    );

    await pool.query(
      'INSERT INTO audit_log (entity_type, entity_id, action_type, new_value, user_id, user_role, ip_address) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      ['user', newUser.rows[0].id, 'add', JSON.stringify({ method: provider + '_auto_provision', email: emailLower }), newUser.rows[0].id, 'customer', req.ip]
    );

    return done(null, {
      id: newUser.rows[0].id, email: newUser.rows[0].email, full_name: newUser.rows[0].full_name,
      role: newUser.rows[0].role, company: newUser.rows[0].company, org_id: newUser.rows[0].org_id
    });

  } catch (err) {
    console.error(provider + ' auth error:', err);
    return done(err);
  }
}

// Google OAuth
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL || BASE_URL + '/auth/google/callback',
    passReqToCallback: true
  }, (req, accessToken, refreshToken, profile, done) => {
    handleOAuthLogin(req, profile, 'google', done);
  }));
}

// Microsoft / Office 365 OAuth
if (process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET) {
  passport.use(new MicrosoftStrategy({
    clientID: process.env.MICROSOFT_CLIENT_ID,
    clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
    callbackURL: process.env.MICROSOFT_CALLBACK_URL || BASE_URL + '/auth/microsoft/callback',
    scope: ['user.read'],
    tenant: process.env.MICROSOFT_TENANT_ID || 'common',
    passReqToCallback: true
  }, (req, accessToken, refreshToken, profile, done) => {
    handleOAuthLogin(req, profile, 'microsoft', done);
  }));
}

module.exports = passport;
