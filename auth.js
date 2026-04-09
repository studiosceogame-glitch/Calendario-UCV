const express = require('express');
const passport = require('passport');
const router = express.Router();

// Google OAuth login
router.get('/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

// Google OAuth callback
router.get('/google/callback',
  passport.authenticate('google', { failureRedirect: '/' }),
  (req, res) => {
    // Successful authentication, redirect directly to dashboard
    req.session.save(err => {
      if (err) {
        return res.redirect('/');
      }
      res.redirect('/dashboard');
    });
  }
);


// Logout
router.get('/logout', (req, res) => {
  req.logout((err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.redirect('/');
  });
});

// Get current user
router.get('/me', (req, res) => {
  if (req.isAuthenticated()) {
    res.json({
      _id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      avatar: req.user.avatar,
      role: req.user.role
    });
  } else {
    res.status(401).json({ error: 'Not authenticated' });
  }
});

module.exports = router;