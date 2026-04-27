const express = require('express');
const router = express.Router();
const passport = require('passport');

// Google OAuth
router.get('/google', passport.authenticate('google', {
  scope: ['profile', 'email'],
  prompt: 'select_account'
}));

router.get('/google/callback',
  passport.authenticate('google', { failureRedirect: '/login?error=google_failed' }),
  (req, res) => {
    // Set session from passport user
    req.session.user = req.user;
    res.redirect('/dashboard');
  }
);

// Microsoft / Office 365 OAuth
router.get('/microsoft', passport.authenticate('microsoft', {
  prompt: 'select_account'
}));

router.get('/microsoft/callback',
  passport.authenticate('microsoft', { failureRedirect: '/login?error=microsoft_failed' }),
  (req, res) => {
    req.session.user = req.user;
    res.redirect('/dashboard');
  }
);

module.exports = router;
