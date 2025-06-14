const express = require('express');
const expressLayouts = require('express-ejs-layouts');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');
const app = express();

// Create HTTP server and Socket.IO
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const connectDB = require('./config/db.mongdb.cloud');
const multer = require('multer');
const AuthService = require('./services/auth.service');
const PlayerService = require('./services/player.service');
const QuizService = require('./services/quiz.service');
const TestService = require('./services/test.service');
const TestSocketHandler = require('./sockets/test.socket');
const i18next = require('./config/i18n');
const i18nextMiddleware = require('i18next-http-middleware');
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
app.use(i18nextMiddleware.handle(i18next));

// Make user available in all templates
app.use((req, res, next) => {
    res.locals.user = req.session ? req.session.user : null;
    
    // i18n helpers for templates
    res.locals.t = req.t;
    res.locals.lng = req.language;
    res.locals.languages = ['vi', 'en'];
    
    // Enhanced translation function with interpolation
    res.locals.ti = function(key, options = {}) {
        let translation = req.t(key);
        
        // Simple interpolation
        if (options && typeof options === 'object') {
            Object.keys(options).forEach(placeholder => {
                const regex = new RegExp(`{{${placeholder}}}`, 'g');
                translation = translation.replace(regex, options[placeholder]);
            });
        }
        
        return translation;
    };
    
    // Helper function để format date theo ngôn ngữ
    res.locals.formatDate = (date, options = {}) => {
        if (!date) return '';
        
        const defaultOptions = { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric'
        };
        
        const formatOptions = { ...defaultOptions, ...options };
        const locale = req.language === 'vi' ? 'vi-VN' : 'en-US';
        
        return new Date(date).toLocaleDateString(locale, formatOptions);
    };
    
    // Helper function để format số theo ngôn ngữ
    res.locals.formatNumber = (number, options = {}) => {
        if (number === null || number === undefined) return '';
        
        const locale = req.language === 'vi' ? 'vi-VN' : 'en-US';
        return new Intl.NumberFormat(locale, options).format(number);
    };
    
    next();
});

// EJS setup
app.use(expressLayouts);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.set('layout', 'layouts/main');

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// NEW: Initialize Socket.IO for real-time tests
const testSocketHandler = new TestSocketHandler(io);

// Connect to MongoDB and create initial admin user
connectDB().then(async () => {
    try {
        // Create initial admin and demo users
        await AuthService.createInitialAdmin();
        await AuthService.createInitialUsers();
        
        // NEW: Start test cleanup scheduler
        console.log('🧹 Starting test cleanup scheduler...');
        setInterval(async () => {
            try {
                // const cleanedCount = await TestService.cleanupExpiredTests();
                const cleanedCount = 0;
                if (cleanedCount > 0) {
                    console.log(`🧹 Cleaned up ${cleanedCount} expired tests`);
                }
            } catch (error) {
                console.error('Test cleanup error:', error);
            }
        }, 60 * 60 * 1000); // Run every hour
        
    } catch (error) {
        console.error('❌ Error setting up initial users:', error);
    }
});

// Routes
const quizRoutes = require('./routes/quiz.route');
const authRoutes = require('./routes/auth.route');
const testRoutes = require('./routes/test.route'); // NEW: Test routes
const { requireAuth, requireAdmin } = require('./controllers/auth.controller');

// Auth routes (no middleware needed)
app.use('/auth', authRoutes);

// NEW: Test routes (public and authenticated)
app.use('/test', testRoutes);

// ========================================
// QUIZ OPERATION LOGGING MIDDLEWARE
// ========================================
// Add this BEFORE your quiz routes for audit trail
app.use('/quizzes', (req, res, next) => {
    const user = req.session?.user;
    const operation = `${req.method} ${req.path}`;
    
    // Log quiz operations for audit trail
    if (user && ['POST', 'PUT', 'DELETE'].includes(req.method)) {
        console.log(`Quiz Operation: ${operation} by ${user.email} at ${new Date().toISOString()}`);
    }
    
    next();
});

// ========================================
// MAIN QUIZ ROUTES (KEEP THIS EXISTING LINE!)
// ========================================
// Protected routes (require authentication AND admin role)
app.use('/quizzes', requireAuth, requireAdmin, quizRoutes);

// ========================================
// ENHANCED API ROUTES FOR QUIZ MANAGEMENT
// ========================================
// Add these new routes AFTER your main quiz routes

// Enhanced Analytics API
app.get('/api/quizzes/analytics', requireAuth, requireAdmin, async (req, res) => {
    try {
        const analytics = await QuizService.getQuizAnalytics();
        
        // Additional real-time calculations
        const quizzes = await QuizService.getAllQuizzes();
        const enhancedAnalytics = {
            ...analytics,
            realTime: {
                totalQuizzes: quizzes.length,
                totalQuestions: quizzes.reduce((sum, q) => sum + q.questions.length, 0),
                totalParticipants: quizzes.reduce((sum, q) => sum + (q.totalCount || 0), 0),
                byMode: {
                    online: quizzes.filter(q => q.mode === 'online').length,
                    offline: quizzes.filter(q => q.mode === 'offline').length
                },
                recentActivity: quizzes.filter(q => {
                    const daysDiff = Math.floor((new Date() - new Date(q.updatedAt)) / (1000 * 60 * 60 * 24));
                    return daysDiff <= 7;
                }).length,
                averageQuestionsPerQuiz: quizzes.length > 0 ? 
                    Math.round(quizzes.reduce((sum, q) => sum + q.questions.length, 0) / quizzes.length) : 0,
                mostPopularMode: quizzes.filter(q => q.mode === 'online').length > 
                    quizzes.filter(q => q.mode === 'offline').length ? 'online' : 'offline'
            }
        };
        
        res.json({
            success: true,
            analytics: enhancedAnalytics,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Analytics error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch analytics'
        });
    }
});

// Refresh Quiz Data API
app.get('/api/quizzes/refresh', requireAuth, requireAdmin, async (req, res) => {
    try {
        const quizzes = await QuizService.getAllQuizzes();
        
        // Simulate some processing time for refresh effect
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        res.json({
            success: true,
            message: 'Quiz data refreshed successfully',
            count: quizzes.length,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Refresh error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to refresh quiz data'
        });
    }
});

// Advanced Search API
app.get('/api/quizzes/search', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { q, mode, language, status, sortBy, limit = 50 } = req.query;
        
        let quizzes = await QuizService.getAllQuizzes();
        
        // Apply filters
        if (q) {
            const searchTerm = q.toLowerCase();
            quizzes = quizzes.filter(quiz => 
                quiz.title.toLowerCase().includes(searchTerm) ||
                quiz.questions.some(question => 
                    question.content.toLowerCase().includes(searchTerm)
                )
            );
        }
        
        if (mode) {
            quizzes = quizzes.filter(quiz => quiz.mode === mode);
        }
        
        if (language) {
            quizzes = quizzes.filter(quiz => quiz.language === language);
        }
        
        // Apply sorting
        if (sortBy) {
            switch (sortBy) {
                case 'newest':
                    quizzes.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
                    break;
                case 'oldest':
                    quizzes.sort((a, b) => new Date(a.updatedAt) - new Date(b.updatedAt));
                    break;
                case 'name':
                    quizzes.sort((a, b) => a.title.localeCompare(b.title));
                    break;
                case 'questions':
                    quizzes.sort((a, b) => b.questions.length - a.questions.length);
                    break;
            }
        }
        
        // Apply limit
        quizzes = quizzes.slice(0, parseInt(limit));
        
        res.json({
            success: true,
            quizzes: quizzes,
            total: quizzes.length,
            filters: { q, mode, language, status, sortBy }
        });
        
    } catch (error) {
        console.error('Search error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to search quizzes'
        });
    }
});

// Bulk Operations API
app.post('/api/quizzes/bulk', requireAuth, requireAdmin, async (req, res) => {
    try {
        const { action, quizIds } = req.body;
        
        if (!action || !quizIds || !Array.isArray(quizIds)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid bulk operation parameters'
            });
        }
        
        let results = [];
        
        switch (action) {
            case 'delete':
                for (const quizId of quizIds) {
                    try {
                        await QuizService.deleteQuiz(quizId);
                        results.push({ quizId, success: true });
                    } catch (error) {
                        results.push({ quizId, success: false, error: error.message });
                    }
                }
                break;
                
            case 'duplicate':
                for (const quizId of quizIds) {
                    try {
                        const originalQuiz = await QuizService.getQuiz(quizId);
                        const duplicateData = {
                            quizInfo: JSON.stringify({
                                title: `${originalQuiz.title} (Bulk Copy)`,
                                mode: originalQuiz.mode,
                                language: originalQuiz.language,
                                scheduleSettings: originalQuiz.scheduleSettings
                            }),
                            questionsData: JSON.stringify(originalQuiz.questions.map((q, index) => ({
                                number: index + 1,
                                content: q.content,
                                type: q.type,
                                options: q.options || [],
                                correctAnswer: q.correctAnswer || []
                            })))
                        };
                        const duplicate = await QuizService.createQuiz(duplicateData, null);
                        results.push({ quizId, success: true, newQuizId: duplicate._id });
                    } catch (error) {
                        results.push({ quizId, success: false, error: error.message });
                    }
                }
                break;
                
            default:
                return res.status(400).json({
                    success: false,
                    message: 'Unsupported bulk operation'
                });
        }
        
        const successCount = results.filter(r => r.success).length;
        const failureCount = results.filter(r => !r.success).length;
        
        res.json({
            success: true,
            message: `Bulk ${action} completed. ${successCount} successful, ${failureCount} failed.`,
            results: results,
            summary: {
                total: results.length,
                successful: successCount,
                failed: failureCount
            }
        });
        
    } catch (error) {
        console.error('Bulk operation error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to perform bulk operation'
        });
    }
});

// ========================================
// ROOT ROUTE - KEEP EXISTING
// ========================================
// Root route - redirect based on authentication and role
app.get('/', (req, res) => {
    if (req.session && req.session.user) {
        // Redirect based on role
        if (req.session.user.role === 'admin') {
            res.redirect('/quizzes');
        } else if (req.session.user.role === 'player') {
            res.redirect('/player/dashboard');
        } else {
            res.redirect('/auth/login');
        }
    } else {
        res.redirect('/auth/login');
    }
});

// ========================================
// ENHANCED PLAYER ROUTES
// ========================================
// Enhanced player dashboard with service integration
app.get('/player/dashboard', requireAuth, async (req, res) => {
    if (req.session.user.role !== 'player') {
        return res.redirect('/quizzes'); // Redirect admins to quiz management
    }
    
    try {
        const user = req.session.user;
        
        // Fetch player statistics
        const stats = await PlayerService.getPlayerStats(user.id);
        
        // Fetch recent quiz history
        const recentQuizzes = await PlayerService.getRecentQuizzes(user.id, 5);
        
        // Fetch player achievements
        const achievements = await PlayerService.getPlayerAchievements(user.id);
        
        // Additional dashboard data
        const dashboardData = {
            welcomeMessage: getWelcomeMessage(),
            quickActions: getQuickActions(),
            notifications: [], // TODO: Implement notifications system
            upcomingQuizzes: [], // TODO: Implement scheduled quizzes
        };
        
        res.render('player/dashboard', {
            title: 'Player Dashboard',
            user: user,
            stats: stats,
            recentQuizzes: recentQuizzes,
            achievements: achievements,
            dashboardData: dashboardData,
            layout: false // Use custom layout in the template
        });
        
    } catch (error) {
        console.error('Player dashboard error:', error);
        res.status(500).render('error/500', {
            title: 'Server Error',
            message: 'Unable to load dashboard. Please try again later.',
            layout: false
        });
    }
});

// Player join quiz route - KEEP EXISTING
app.get('/player/join-quiz', requireAuth, (req, res) => {
    if (req.session.user.role !== 'player') {
        return res.redirect('/quizzes'); // Redirect admins to quiz management
    }
    
    // Render the join quiz page directly
    const user = req.session.user;
    res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Join a Quiz - Quiz App</title>
    
    <!-- Bootstrap CSS -->
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet">
    
    <!-- Google Fonts -->
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    
    <!-- Font Awesome -->
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
    
    <!-- SweetAlert2 CSS -->
    <link href="https://cdn.jsdelivr.net/npm/@sweetalert2/theme-bootstrap-4/bootstrap-4.css" rel="stylesheet">
    
    <style>
        :root {
            --primary-color: #667eea;
            --secondary-color: #764ba2;
            --success-color: #10b981;
            --border-radius: 12px;
            --shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
            --shadow-lg: 0 20px 40px rgba(0, 0, 0, 0.1);
        }

        * {
            font-family: 'Inter', sans-serif;
        }

        body {
            background: linear-gradient(135deg, var(--primary-color) 0%, var(--secondary-color) 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }

        .join-quiz-container {
            width: 100%;
            max-width: 480px;
            margin: 0 auto;
        }

        .quiz-card {
            background: white;
            border-radius: var(--border-radius);
            box-shadow: var(--shadow-lg);
            border: none;
            overflow: hidden;
            transition: transform 0.3s ease, box-shadow 0.3s ease;
        }

        .quiz-card:hover {
            transform: translateY(-5px);
            box-shadow: 0 25px 50px rgba(0, 0, 0, 0.15);
        }

        .card-header {
            background: linear-gradient(135deg, var(--primary-color) 0%, var(--secondary-color) 100%);
            color: white;
            text-align: center;
            padding: 2rem 1.5rem;
            border: none;
        }

        .header-icon {
            width: 60px;
            height: 60px;
            background: rgba(255, 255, 255, 0.2);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 1rem;
            font-size: 1.5rem;
        }

        .card-title {
            font-size: 1.75rem;
            font-weight: 700;
            margin-bottom: 0.5rem;
            letter-spacing: -0.025em;
        }

        .card-subtitle {
            font-size: 1rem;
            opacity: 0.9;
            font-weight: 400;
            line-height: 1.5;
        }

        .card-body {
            padding: 2rem 1.5rem;
        }

        .form-floating {
            margin-bottom: 1.5rem;
        }

        .form-control {
            border: 2px solid #e2e8f0;
            border-radius: 8px;
            padding: 1rem 0.75rem;
            font-size: 1rem;
            transition: all 0.3s ease;
            background-color: #f8fafc;
        }

        .form-control:focus {
            background-color: white;
            border-color: var(--primary-color);
            box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
        }

        .form-floating > label {
            color: #64748b;
            font-weight: 500;
        }

        .pin-code-input {
            text-align: center;
            font-size: 1.25rem;
            font-weight: 600;
            letter-spacing: 0.5rem;
            padding-left: 1.5rem;
        }

        .btn-start-quiz {
            background: linear-gradient(135deg, var(--success-color) 0%, #059669 100%);
            border: none;
            border-radius: 8px;
            padding: 1rem 2rem;
            font-size: 1.1rem;
            font-weight: 600;
            color: white;
            width: 100%;
            transition: all 0.3s ease;
            box-shadow: 0 4px 15px rgba(16, 185, 129, 0.3);
        }

        .btn-start-quiz:hover {
            background: linear-gradient(135deg, #059669 0%, #047857 100%);
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(16, 185, 129, 0.4);
            color: white;
        }

        .user-info {
            background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
            border: 1px solid #fbbf24;
            border-radius: 8px;
            padding: 1rem;
            margin-bottom: 1.5rem;
            text-align: center;
        }

        .user-info .user-name {
            font-weight: 600;
            color: #f59e0b;
            margin-bottom: 0.25rem;
        }

        .footer-links {
            text-align: center;
            margin-top: 1.5rem;
            padding-top: 1.5rem;
            border-top: 1px solid #e2e8f0;
        }

        .footer-links a {
            color: var(--primary-color);
            text-decoration: none;
            font-size: 0.9rem;
            margin: 0 1rem;
            transition: color 0.3s ease;
        }

        .footer-links a:hover {
            color: var(--secondary-color);
            text-decoration: underline;
        }
    </style>
</head>
<body>
    <div class="join-quiz-container">
        <div class="card quiz-card">
            <div class="card-header">
                <div class="header-icon">
                    <i class="fas fa-gamepad"></i>
                </div>
                <h1 class="card-title">Join a Test</h1>
                <p class="card-subtitle">Enter your 6-digit test code to continue.</p>
            </div>
            
            <div class="card-body">
                <div class="user-info">
                    <div class="user-name">
                        <i class="fas fa-user-circle me-2"></i>
                        Welcome, ${user.name}!
                    </div>
                    <div class="user-email">${user.email}</div>
                </div>

                <form id="joinTestForm" action="/test/join" method="POST">
                    <div class="form-floating">
                        <input type="text" 
                               class="form-control pin-code-input" 
                               id="testCode" 
                               name="testCode"
                               placeholder="000000" 
                               maxlength="6"
                               pattern="[0-9]{6}"
                               required>
                        <label for="testCode">
                            <i class="fas fa-key me-2"></i>6-Digit Test Code
                        </label>
                    </div>

                    <button type="submit" class="btn btn-start-quiz" id="startTestBtn">
                        <i class="fas fa-play me-2"></i>
                        Join Test
                    </button>
                </form>

                <div class="footer-links">
                    <a href="/player/dashboard">
                        <i class="fas fa-home me-1"></i>Dashboard
                    </a>
                    <a href="/auth/logout">
                        <i class="fas fa-sign-out-alt me-1"></i>Logout
                    </a>
                </div>
            </div>
        </div>
    </div>

    <!-- Bootstrap JS -->
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js"></script>
    
    <!-- SweetAlert2 JS -->
    <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>

    <script>
        document.addEventListener('DOMContentLoaded', function() {
            const form = document.getElementById('joinTestForm');
            const codeInput = document.getElementById('testCode');
            const startTestBtn = document.getElementById('startTestBtn');

            codeInput.addEventListener('input', function(e) {
                let value = e.target.value.replace(/\\D/g, '');
                if (value.length > 6) {
                    value = value.slice(0, 6);
                }
                e.target.value = value;
            });

            function validateForm() {
                const testCode = codeInput.value;
                const isValid = testCode.length === 6;
                startTestBtn.disabled = !isValid;
                return isValid;
            }

            codeInput.addEventListener('input', validateForm);
            validateForm();

            form.addEventListener('submit', function(e) {
                e.preventDefault();
                
                if (!validateForm()) {
                    Swal.fire({
                        icon: 'error',
                        title: 'Invalid Code',
                        text: 'Please enter a valid 6-digit test code.',
                        confirmButtonColor: '#667eea'
                    });
                    return;
                }

                const originalContent = startTestBtn.innerHTML;
                startTestBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Finding Test...';
                startTestBtn.disabled = true;

                fetch('/test/join', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        testCode: codeInput.value
                    })
                })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        window.location.href = data.redirectUrl;
                    } else {
                        Swal.fire({
                            icon: 'error',
                            title: 'Error',
                            text: data.message,
                            confirmButtonColor: '#667eea'
                        });
                    }
                })
                .catch(error => {
                    Swal.fire({
                        icon: 'error',
                        title: 'Error',
                        text: 'Something went wrong. Please try again.',
                        confirmButtonColor: '#667eea'
                    });
                })
                .finally(() => {
                    startTestBtn.innerHTML = originalContent;
                    startTestBtn.disabled = false;
                });
            });
        });
    </script>
</body>
</html>
    `);
});

app.post('/player/join-quiz', requireAuth, async (req, res) => {
    try {
        const { testCode } = req.body;
        
        // Validate input
        if (!testCode || testCode.toString().length !== 6) {
            return res.status(400).json({
                success: false,
                message: 'Please enter a valid 6-digit test code'
            });
        }

        // Redirect to test join page
        res.json({
            success: true,
            message: 'Redirecting to test...',
            redirectUrl: `/test/join/${testCode}`
        });

    } catch (error) {
        console.error('Join test error:', error);
        res.status(500).json({
            success: false,
            message: 'An error occurred while joining the test'
        });
    }
});

// Additional player routes (placeholders for now)
app.get('/player/history', requireAuth, (req, res) => {
    if (req.session.user.role !== 'player') {
        return res.redirect('/quizzes');
    }
    
    res.send(`
        <!DOCTYPE html>
        <html><head><title>Quiz History</title>
        <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet">
        </head><body class="bg-light">
        <div class="container mt-5 text-center">
            <h1>🚧 Quiz History</h1>
            <p class="lead">This feature is coming soon!</p>
            <a href="/player/dashboard" class="btn btn-primary">Back to Dashboard</a>
        </div></body></html>
    `);
});

app.get('/player/profile', requireAuth, (req, res) => {
    if (req.session.user.role !== 'player') {
        return res.redirect('/quizzes');
    }
    
    res.send(`
        <!DOCTYPE html>
        <html><head><title>Player Profile</title>
        <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet">
        </head><body class="bg-light">
        <div class="container mt-5 text-center">
            <h1>🚧 Player Profile</h1>
            <p class="lead">Profile settings coming soon!</p>
            <a href="/player/dashboard" class="btn btn-primary">Back to Dashboard</a>
        </div></body></html>
    `);
});

// ========================================
// API ENDPOINTS FOR PLAYER STATS
// ========================================
// API endpoint for updating player stats (for AJAX calls)
app.get('/api/player/stats', requireAuth, async (req, res) => {
    if (req.session.user.role !== 'player') {
        return res.status(403).json({ error: 'Access denied' });
    }
    
    try {
        const stats = await PlayerService.getPlayerStats(req.session.user.id);
        res.json({ success: true, stats: stats });
    } catch (error) {
        console.error('API stats error:', error);
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
});

// API endpoint for updating player profile
app.put('/api/player/profile', requireAuth, async (req, res) => {
    if (req.session.user.role !== 'player') {
        return res.status(403).json({ error: 'Access denied' });
    }
    
    try {
        const updatedUser = await PlayerService.updatePlayerProfile(
            req.session.user.id, 
            req.body
        );
        
        // Update session data
        req.session.user.name = updatedUser.name;
        req.session.user.email = updatedUser.email;
        
        res.json({ 
            success: true, 
            message: 'Profile updated successfully',
            user: {
                name: updatedUser.name,
                email: updatedUser.email
            }
        });
    } catch (error) {
        console.error('API profile update error:', error);
        res.status(500).json({ error: 'Failed to update profile' });
    }
});

// ========================================
// HELPER FUNCTIONS
// ========================================
// Helper function to get time-based welcome message
function getWelcomeMessage() {
    const hour = new Date().getHours();
    
    if (hour < 12) {
        return "Good morning! Ready to start your day with a quiz?";
    } else if (hour < 17) {
        return "Good afternoon! How about a quick knowledge check?";
    } else {
        return "Good evening! End your day with some learning!";
    }
}

// Helper function to get available quick actions
function getQuickActions() {
    return [
        {
            name: 'Join Test',
            icon: 'fas fa-play',
            url: '/player/join-quiz',
            description: 'Enter a test code to join',
            primary: true
        },
        {
            name: 'View History',
            icon: 'fas fa-chart-line',
            url: '/player/history',
            description: 'See your past performance'
        },
        {
            name: 'Leaderboard',
            icon: 'fas fa-trophy',
            url: '/player/leaderboard',
            description: 'Check your ranking'
        },
        {
            name: 'Achievements',
            icon: 'fas fa-medal',
            url: '/player/achievements',
            description: 'View your badges'
        },
        {
            name: 'Study Guide',
            icon: 'fas fa-book',
            url: '/player/study-guide',
            description: 'Review topics'
        }
    ];
}

// ========================================
// ERROR HANDLING MIDDLEWARE - KEEP EXISTING
// ========================================
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

// Global error handler
app.use((error, req, res, next) => {
    console.error('Global error:', error);
    
    res.status(500).send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>500 - Server Error</title>
            <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet">
            <style>
                body { 
                    background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
                    min-height: 100vh;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: white;
                    font-family: 'Inter', sans-serif;
                }
                .error-container { text-align: center; }
                .error-code { font-size: 5rem; font-weight: bold; margin-bottom: 1rem; }
                .btn-home { 
                    background: rgba(255,255,255,0.2);
                    border: 2px solid white;
                    color: white;
                    padding: 0.75rem 2rem;
                    border-radius: 50px;
                    text-decoration: none;
                    margin-top: 2rem;
                    display: inline-block;
                }
                .btn-home:hover { background: white; color: #ef4444; }
            </style>
        </head>
        <body>
            <div class="error-container">
                <div class="error-code">500</div>
                <h2>Internal Server Error</h2>
                <p>Something went wrong. Please try again later.</p>
                <a href="/" class="btn-home">Go Back Home</a>
            </div>
        </body>
        </html>
    `);
});

// 404 handler
app.use((req, res) => {
    res.status(404).send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>404 - Page Not Found</title>
            <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet">
            <style>
                body { 
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    min-height: 100vh;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: white;
                    font-family: 'Inter', sans-serif;
                }
                .error-container { text-align: center; }
                .error-code { font-size: 5rem; font-weight: bold; margin-bottom: 1rem; }
                .btn-home { 
                    background: rgba(255,255,255,0.2);
                    border: 2px solid white;
                    color: white;
                    padding: 0.75rem 2rem;
                    border-radius: 50px;
                    text-decoration: none;
                    margin-top: 2rem;
                    display: inline-block;
                }
                .btn-home:hover { background: white; color: #667eea; }
            </style>
        </head>
        <body>
            <div class="error-container">
                <div class="error-code">404</div>
                <h2>Page Not Found</h2>
                <p>The page you are looking for does not exist.</p>
                <a href="/" class="btn-home">Go Back Home</a>
            </div>
        </body>
        </html>
    `);
});

// ========================================
// SERVER STARTUP - UPDATED FOR SOCKET.IO
// ========================================
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Server đang chạy tại http://localhost:${PORT}`);
    console.log(`🔌 Socket.IO server ready for real-time tests`);
    console.log(`\n👤 Demo credentials:`);
    console.log(`   🔑 Admin: admin@quizapp.com / admin123`);
    console.log(`   🔑 Teacher: teacher@quizapp.com / teacher123`);
    console.log(`   🔑 Demo Admin: demo@demo.com / demo123`);
    console.log(`   🎮 Player: player@demo.com / player123`);
    console.log(`\n📝 Role-based routing:`);
    console.log(`   👨‍💼 Admins → Quiz Management Dashboard (/quizzes)`);
    console.log(`   🎮 Players → Player Dashboard (/player/dashboard)`);
    console.log(`\n🔒 Access Control:`);
    console.log(`   ✅ Quiz management now requires admin role`);
    console.log(`   ✅ Players have their own dashboard and features`);
    console.log(`\n🚀 Enhanced Features:`);
    console.log(`   ✅ Modern quiz list with advanced filtering`);
    console.log(`   ✅ Quiz analytics and statistics`);
    console.log(`   ✅ Enhanced player dashboard`);
    console.log(`   ✅ API endpoints for real-time data`);
    console.log(`   🆕 Real-time test functionality with Socket.IO`);
    console.log(`   🆕 Test creation and management`);
    console.log(`   🆕 Live quiz sessions with admin controls`);
    console.log(`   🆕 Real-time scoring and leaderboards`);
});