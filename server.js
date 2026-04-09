require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const helmet = require('helmet');
const cors = require('cors');
const path = require('path');
const User = require('./User');

console.log('🔍 Variables de entorno cargadas:');
console.log('MONGODB_URI:', process.env.MONGODB_URI ? '✅ Definida' : '❌ No definida');
console.log('SESSION_SECRET:', process.env.SESSION_SECRET ? '✅ Definida' : '❌ No definida (usando fallback)');
console.log('GOOGLE_CLIENT_ID:', process.env.GOOGLE_CLIENT_ID ? '✅ Definida' : '❌ No definida');
console.log('GOOGLE_CLIENT_SECRET:', process.env.GOOGLE_CLIENT_SECRET ? '✅ Definida' : '❌ No definida');
console.log('CALLBACK_URL:', process.env.CALLBACK_URL ? '✅ Definida' : '❌ No definida');

const app = express();

// Connect MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ MongoDB conectado'))
  .catch(err => console.error('❌ MongoDB error:', err));

// Middleware
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: process.env.CLIENT_URL || true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname)));

// Session
app.use(session({
  secret: process.env.SESSION_SECRET || 'grupo3secret',
  resave: false,
  saveUninitialized: false,
  // store: MongoStore.create({ mongoUrl: process.env.MONGODB_URI }), // Temporalmente comentado para probar
  cookie: { 
    secure: process.env.NODE_ENV === 'production',
    maxAge: 7 * 24 * 60 * 60 * 1000
  }
}));

// Passport
app.use(passport.initialize());
app.use(passport.session());

passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: process.env.CALLBACK_URL || '/auth/google/callback'
}, async (accessToken, refreshToken, profile, done) => {
  try {
    let user = await User.findOne({ googleId: profile.id });
    if (!user) {
      user = await User.create({
        googleId: profile.id,
        email: profile.emails[0].value,
        name: profile.displayName,
        avatar: profile.photos[0]?.value,
        role: 'user'
      });
    } else {
      // Update avatar in case it changed
      user.avatar = profile.photos[0]?.value || user.avatar;
      await user.save();
    }
    return done(null, user);
  } catch (err) {
    return done(err, null);
  }
}));

passport.serializeUser((user, done) => done(null, user._id));
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});

// Middleware to check authentication for API routes and browser pages
const requireAuth = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  if (req.accepts('html')) {
    return res.redirect('/');
  }
  res.status(401).json({ error: 'Authentication required' });
};

// Routes
app.use('/auth', require('./auth'));

// Public API routes (no authentication required)
app.get('/api/courses', async (req, res) => {
  try {
    const courses = await require('./Course').find().select('_id name description color');
    res.json(courses);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/courses/:courseId/events', async (req, res) => {
  try {
    const events = await require('./Event').find({ course: req.params.courseId })
      .populate('createdBy', 'name avatar');
    res.json(events);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/events/:eventId/comments', async (req, res) => {
  try {
    const comments = await require('./Comment').find({ event: req.params.eventId })
      .populate('createdBy', 'name avatar');
    res.json(comments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Protected API routes (authentication required)
app.use('/api', requireAuth, require('./api'));

// Serve frontend
app.get('/', (req, res) => {
  if (req.isAuthenticated()) {
    return res.redirect('/dashboard');
  }
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/dashboard', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'dashboard.html'));
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Servidor corriendo en puerto ${PORT}`));
