const express = require('express');
const expressLayouts = require('express-ejs-layouts');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const path = require('path');
const app = express();
const connectDB = require('./config/db.mongdb.cloud');
const multer = require('multer');
require('dotenv').config();

// Body parser middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Session configuration
app.use(session({
    secret: process.env.SESSION_SECRET || 'quiz-app-secret-key-change-in-production',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
        mongoUrl: process.env.MONGO_URI,
        touchAfter: 24 * 3600 // lazy session update
    }),
    cookie: {
        secure: false, // Set to true if using HTTPS
        httpOnly: true,
        maxAge: 1000 * 60 * 60 * 24 // 24 hours
    }
}));

// Make user available in all templates
app.use((req, res, next) => {
    res.locals.user = req.session ? req.session.user : null;
    next();
});

// EJS setup
app.use(expressLayouts);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.set('layout', 'layouts/main');

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Kết nối MongoDB
connectDB();

// Routes
const quizRoutes = require('./routes/quiz.route');
const authRoutes = require('./routes/auth.route');
const { requireAuth } = require('./controllers/auth.controller');

// Auth routes (no middleware needed)
app.use('/auth', authRoutes);

// Protected routes (require authentication)
app.use('/quizzes', requireAuth, quizRoutes);

// Redirect root to login if not authenticated, otherwise to quizzes
app.get('/', (req, res) => {
  if (req.session && req.session.user) {
    res.redirect('/quizzes');
  } else {
    res.redirect('/auth/login');
  }
});

// Error handling for file uploads
app.use((error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ 
                error: 'File is too large. Maximum size is 5MB' 
            });
        }
    }
    next(error);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server đang chạy tại http://localhost:${PORT}`);
});