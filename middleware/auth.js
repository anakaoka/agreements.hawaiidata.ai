function requireAuth(req, res, next) {
  if (!req.session.user) return res.redirect('/login');
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session.user) return res.redirect('/login');
  if (req.session.user.role !== 'domain_admin') return res.status(403).render('error', { message: 'Access denied' });
  next();
}

function requireEditor(req, res, next) {
  if (!req.session.user) return res.redirect('/login');
  if (!['domain_admin', 'editor'].includes(req.session.user.role)) return res.status(403).render('error', { message: 'Access denied' });
  next();
}

module.exports = { requireAuth, requireAdmin, requireEditor };
