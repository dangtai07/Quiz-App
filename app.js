const express = require('express');
const expressLayouts = require('express-ejs-layouts');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const path = require('path');
const app = express();
const connectDB = require('./config/db.mongdb.cloud');
const multer = require('multer');
const AuthService = require('./services/auth.service'); // Add this import
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

// Connect to MongoDB and create initial admin user
connectDB().then(async () => {
    try {
        // Create initial admin and demo users
        await AuthService.createInitialAdmin();
        await AuthService.createInitialUsers();
    } catch (error) {
        console.error('❌ Error setting up initial users:', error);
    }
});

// Routes
const quizRoutes = require('./routes/quiz.route');
const authRoutes = require('./routes/auth.route');
const { requireAuth, requireAdmin } = require('./controllers/auth.controller');

// Auth routes (no middleware needed)
app.use('/auth', authRoutes);

// Protected routes (require authentication AND admin role)
app.use('/quizzes', requireAuth, requireAdmin, quizRoutes);

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

// Player routes
app.get('/player/dashboard', requireAuth, (req, res) => {
    if (req.session.user.role !== 'player') {
        return res.redirect('/quizzes'); // Redirect admins to quiz management
    }
    
    const user = req.session.user;
    res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Player Dashboard - Quiz App</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet">
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <style>
        body {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            font-family: 'Inter', sans-serif;
            padding: 2rem 0;
        }
        .dashboard-container {
            max-width: 800px;
            margin: 0 auto;
            padding: 0 1rem;
        }
        .welcome-card {
            background: white;
            border-radius: 15px;
            padding: 2rem;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
            margin-bottom: 2rem;
            text-align: center;
        }
        .action-card {
            background: white;
            border-radius: 15px;
            padding: 1.5rem;
            box-shadow: 0 10px 25px rgba(0,0,0,0.1);
            margin-bottom: 1rem;
            transition: transform 0.3s ease;
        }
        .action-card:hover {
            transform: translateY(-5px);
        }
        .action-icon {
            width: 60px;
            height: 60px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 1rem;
            font-size: 1.5rem;
            color: white;
        }
        .join-icon { background: linear-gradient(135deg, #10b981, #059669); }
        .history-icon { background: linear-gradient(135deg, #3b82f6, #1d4ed8); }
        .profile-icon { background: linear-gradient(135deg, #8b5cf6, #7c3aed); }
        .logout-icon { background: linear-gradient(135deg, #ef4444, #dc2626); }
        .btn-action {
            border: none;
            border-radius: 10px;
            padding: 1rem 2rem;
            font-weight: 600;
            text-decoration: none;
            display: inline-block;
            transition: all 0.3s ease;
            width: 100%;
        }
        .btn-primary-custom {
            background: linear-gradient(135deg, #10b981, #059669);
            color: white;
        }
        .btn-secondary-custom {
            background: linear-gradient(135deg, #6b7280, #4b5563);
            color: white;
        }
        .btn-action:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 20px rgba(0,0,0,0.2);
            color: white;
        }
    </style>
</head>
<body>
    <div class="dashboard-container">
        <div class="welcome-card">
            <div class="action-icon join-icon mb-3">
                <i class="fas fa-user-circle"></i>
            </div>
            <h1 class="h2 mb-2">Welcome back, ${user.name}!</h1>
            <p class="text-muted mb-0">${user.email}</p>
            <p class="text-muted">Ready to join a quiz or check your progress?</p>
        </div>

        <div class="row">
            <div class="col-md-6 mb-3">
                <div class="action-card">
                    <div class="action-icon join-icon">
                        <i class="fas fa-gamepad"></i>
                    </div>
                    <h5 class="mb-2">Join a Quiz</h5>
                    <p class="text-muted mb-3">Enter a quiz PIN code to join a live quiz session.</p>
                    <a href="/player/join-quiz" class="btn btn-action btn-primary-custom">
                        <i class="fas fa-play me-2"></i>Join Quiz
                    </a>
                </div>
            </div>
            
            <div class="col-md-6 mb-3">
                <div class="action-card">
                    <div class="action-icon history-icon">
                        <i class="fas fa-history"></i>
                    </div>
                    <h5 class="mb-2">Quiz History</h5>
                    <p class="text-muted mb-3">View your past quiz results and scores.</p>
                    <a href="/player/history" class="btn btn-action btn-secondary-custom">
                        <i class="fas fa-chart-line me-2"></i>View History
                    </a>
                </div>
            </div>
            
            <div class="col-md-6 mb-3">
                <div class="action-card">
                    <div class="action-icon profile-icon">
                        <i class="fas fa-user-cog"></i>
                    </div>
                    <h5 class="mb-2">Profile Settings</h5>
                    <p class="text-muted mb-3">Update your profile information and preferences.</p>
                    <a href="/player/profile" class="btn btn-action btn-secondary-custom">
                        <i class="fas fa-cog me-2"></i>Settings
                    </a>
                </div>
            </div>
            
            <div class="col-md-6 mb-3">
                <div class="action-card">
                    <div class="action-icon logout-icon">
                        <i class="fas fa-sign-out-alt"></i>
                    </div>
                    <h5 class="mb-2">Logout</h5>
                    <p class="text-muted mb-3">Sign out of your account securely.</p>
                    <a href="/auth/logout" class="btn btn-action btn-secondary-custom">
                        <i class="fas fa-sign-out-alt me-2"></i>Logout
                    </a>
                </div>
            </div>
        </div>
    </div>
</body>
</html>
    `);
});

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
                <h1 class="card-title">Join a Quiz</h1>
                <p class="card-subtitle">Enter your 6-digit quiz code and your name to continue.</p>
            </div>
            
            <div class="card-body">
                <div class="user-info">
                    <div class="user-name">
                        <i class="fas fa-user-circle me-2"></i>
                        Welcome, ${user.name}!
                    </div>
                    <div class="user-email">${user.email}</div>
                </div>

                <form id="joinQuizForm" action="/player/join-quiz" method="POST">
                    <div class="form-floating">
                        <input type="number" 
                               class="form-control pin-code-input" 
                               id="pinCode" 
                               name="pinCode"
                               placeholder="000000" 
                               min="100000" 
                               max="999999"
                               maxlength="6"
                               required>
                        <label for="pinCode">
                            <i class="fas fa-key me-2"></i>6-Digit Quiz PIN
                        </label>
                    </div>

                    <div class="form-floating">
                        <input type="text" 
                               class="form-control" 
                               id="playerName" 
                               name="playerName"
                               placeholder="Your Name" 
                               maxlength="50"
                               value="${user.name}"
                               required>
                        <label for="playerName">
                            <i class="fas fa-user me-2"></i>Your Display Name
                        </label>
                    </div>

                    <button type="submit" class="btn btn-start-quiz" id="startQuizBtn">
                        <i class="fas fa-play me-2"></i>
                        Start Quiz
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
            const form = document.getElementById('joinQuizForm');
            const pinCodeInput = document.getElementById('pinCode');
            const playerNameInput = document.getElementById('playerName');
            const startQuizBtn = document.getElementById('startQuizBtn');

            pinCodeInput.addEventListener('input', function(e) {
                let value = e.target.value.replace(/\\D/g, '');
                if (value.length > 6) {
                    value = value.slice(0, 6);
                }
                e.target.value = value;
                
                if (value.length === 6) {
                    playerNameInput.focus();
                }
            });

            function validateForm() {
                const pinCode = pinCodeInput.value;
                const playerName = playerNameInput.value.trim();
                
                const isValid = pinCode.length === 6 && playerName.length >= 2;
                startQuizBtn.disabled = !isValid;
                
                return isValid;
            }

            pinCodeInput.addEventListener('input', validateForm);
            playerNameInput.addEventListener('input', validateForm);
            validateForm();

            form.addEventListener('submit', function(e) {
                e.preventDefault();
                
                if (!validateForm()) {
                    Swal.fire({
                        icon: 'error',
                        title: 'Invalid Input',
                        text: 'Please enter a valid 6-digit PIN code and your name (at least 2 characters).',
                        confirmButtonColor: '#667eea'
                    });
                    return;
                }

                const originalContent = startQuizBtn.innerHTML;
                startQuizBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Joining Quiz...';
                startQuizBtn.disabled = true;

                fetch('/player/join-quiz', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        pinCode: pinCodeInput.value,
                        playerName: playerNameInput.value.trim()
                    })
                })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        Swal.fire({
                            icon: 'success',
                            title: 'Joined Quiz!',
                            text: data.message,
                            timer: 2000,
                            timerProgressBar: true,
                            showConfirmButton: false
                        });
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
                    startQuizBtn.innerHTML = originalContent;
                    startQuizBtn.disabled = false;
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
        const { pinCode, playerName } = req.body;
        
        // Validate input
        if (!pinCode || pinCode.toString().length !== 6) {
            return res.status(400).json({
                success: false,
                message: 'Please enter a valid 6-digit PIN code'
            });
        }
        
        if (!playerName || playerName.trim().length < 2) {
            return res.status(400).json({
                success: false,
                message: 'Please enter a valid name (at least 2 characters)'
            });
        }

        // For now, simulate successful join (implement actual quiz joining logic later)
        console.log(`🎮 Player ${playerName} attempting to join quiz with PIN: ${pinCode}`);
        
        // Store quiz session
        req.session.currentQuiz = {
            pinCode: pinCode.toString(),
            playerName: playerName.trim(),
            joinedAt: new Date()
        };

        res.json({
            success: true,
            message: 'Successfully joined quiz! Redirecting to quiz lobby...',
            redirectUrl: `/quiz/${pinCode}/lobby`
        });

    } catch (error) {
        console.error('Join quiz error:', error);
        res.status(500).json({
            success: false,
            message: 'An error occurred while joining the quiz'
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server đang chạy tại http://localhost:${PORT}`);
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
});