const User = require('../models/user.model');
const Quiz = require('../models/quiz.model'); // Assuming this exists

class AuthController {
    // GET login page
    getLoginPage = (req, res) => {
        // Check if user is already logged in
        if (req.session && req.session.user) {
            return this.redirectBasedOnRole(req, res);
        }
        
        res.render('auth/login', {
            title: 'Login - Quiz Management System',
            layout: false,
            error: null,
            email: ''
        });
    };

    // POST login
    login = async (req, res) => {
        try {
            const { email, password, remember } = req.body;
            
            // Validate input
            if (!email || !password) {
                return res.render('auth/login', {
                    title: 'Login - Quiz Management System',
                    layout: false,
                    error: 'Please enter both email and password',
                    email: email || ''
                });
            }

            // Find user by email
            const user = await User.findByEmail(email);
            
            if (!user) {
                return res.render('auth/login', {
                    title: 'Login - Quiz Management System',
                    layout: false,
                    error: 'Invalid email or password',
                    email: email
                });
            }

            // Check if user is active
            if (!user.isActive) {
                return res.render('auth/login', {
                    title: 'Login - Quiz Management System',
                    layout: false,
                    error: 'Your account has been deactivated. Please contact support.',
                    email: email
                });
            }

            // Compare password
            const isPasswordValid = await user.comparePassword(password);
            
            if (!isPasswordValid) {
                return res.render('auth/login', {
                    title: 'Login - Quiz Management System',
                    layout: false,
                    error: 'Invalid email or password',
                    email: email
                });
            }

            // Update last login
            await user.updateLastLogin();

            // Store user in session
            req.session.user = {
                id: user._id,
                user_id: user.user_id,
                name: user.name,
                email: user.email,
                role: user.role,
                loginTime: new Date(),
                rememberMe: remember || false
            };

            // Configure session based on remember me
            if (remember) {
                req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days
            } else {
                req.session.cookie.maxAge = 24 * 60 * 60 * 1000; // 24 hours
            }

            // Redirect based on user role
            return this.redirectBasedOnRole(req, res);

        } catch (error) {
            console.error('Login error:', error);
            res.render('auth/login', {
                title: 'Login - Quiz Management System',
                layout: false,
                error: 'An error occurred during login. Please try again.',
                email: req.body.email || ''
            });
        }
    };

    // Role-based redirection logic
    redirectBasedOnRole = async (req, res) => {
        try {
            const user = req.session.user;
            
            if (user.role === 'admin') {
                // Admin: Redirect to existing quiz management page
                return res.redirect('/quizzes');
            } 
            else if (user.role === 'player') {
                // Player: Redirect to player dashboard
                return res.redirect('/player/dashboard');
            }
            else {
                // Invalid role - logout and redirect to login
                req.session.destroy();
                return res.redirect('/auth/login');
            }
        } catch (error) {
            console.error('Role-based redirection error:', error);
            res.redirect('/auth/login');
        }
    };

    // GET logout
    logout = async (req, res) => {
        try {
            if (req.session && req.session.user) {
                // Destroy session
                req.session.destroy((err) => {
                    if (err) {
                        console.error('Session destruction error:', err);
                    }
                    res.clearCookie('connect.sid'); // Clear session cookie
                    res.redirect('/auth/login');
                });
            } else {
                res.redirect('/auth/login');
            }
        } catch (error) {
            console.error('Logout error:', error);
            res.redirect('/auth/login');
        }
    };

    // Middleware to check if user is authenticated
    requireAuth = async (req, res, next) => {
        try {
            if (!req.session || !req.session.user) {
                return res.redirect('/auth/login');
            }
            
            // Verify user still exists and is active
            const user = await User.findById(req.session.user.id);
            
            if (!user || !user.isActive) {
                req.session.destroy();
                return res.redirect('/auth/login');
            }
            
            // Add user to request object for use in routes
            req.user = req.session.user;
            next();
        } catch (error) {
            console.error('Auth middleware error:', error);
            res.redirect('/auth/login');
        }
    };

    // Middleware to check if user is admin
    requireAdmin = (req, res, next) => {
        if (!req.user || req.user.role !== 'admin') {
            return res.status(403).send(`
                <!DOCTYPE html>
                <html lang="en">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>403 - Access Denied</title>
                    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet">
                    <style>
                        body { 
                            background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
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
                            margin: 1rem 0.5rem;
                            display: inline-block;
                        }
                        .btn-home:hover { background: white; color: #f59e0b; }
                    </style>
                </head>
                <body>
                    <div class="error-container">
                        <div class="error-code">403</div>
                        <h2>Access Denied</h2>
                        <p>You do not have permission to access this page.</p>
                        <a href="/" class="btn-home">Go Home</a>
                        <a href="/auth/logout" class="btn-home">Logout</a>
                    </div>
                </body>
                </html>
            `);
        }
        next();
    };

    // Middleware to check if user is player
    requirePlayer = (req, res, next) => {
        if (!req.user || req.user.role !== 'player') {
            return res.status(403).send(`
                <!DOCTYPE html>
                <html lang="en">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>403 - Access Denied</title>
                    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet">
                    <style>
                        body { 
                            background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
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
                            margin: 1rem 0.5rem;
                            display: inline-block;
                        }
                        .btn-home:hover { background: white; color: #f59e0b; }
                    </style>
                </head>
                <body>
                    <div class="error-container">
                        <div class="error-code">403</div>
                        <h2>Access Denied</h2>
                        <p>This page is only accessible to players.</p>
                        <a href="/" class="btn-home">Go Home</a>
                        <a href="/auth/logout" class="btn-home">Logout</a>
                    </div>
                </body>
                </html>
            `);
        }
        next();
    };

    // Register new user (if needed)
    register = async (req, res) => {
        try {
            const { name, email, password, role = 'player' } = req.body;
            
            // Check if user already exists
            const existingUser = await User.findByEmail(email);
            if (existingUser) {
                return res.status(400).json({
                    success: false,
                    message: 'User with this email already exists'
                });
            }

            // Create new user
            const newUser = new User({
                name,
                email,
                password,
                role
            });

            await newUser.save();

            res.status(201).json({
                success: true,
                message: 'User registered successfully',
                user: {
                    user_id: newUser.user_id,
                    name: newUser.name,
                    email: newUser.email,
                    role: newUser.role
                }
            });

        } catch (error) {
            console.error('Registration error:', error);
            res.status(500).json({
                success: false,
                message: 'Registration failed',
                error: error.message
            });
        }
    };
}

module.exports = new AuthController();