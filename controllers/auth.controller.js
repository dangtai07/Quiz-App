// controllers/auth.controller.js
const AuthService = require('../services/auth.service');

exports.getLoginPage = (req, res) => {
    // Check if user is already logged in
    if (req.session && req.session.user) {
        return res.redirect('/quizzes');
    }
    
    res.render('auth/login', {
        title: 'Admin Login - Quiz Management System',
        layout: false // Disable main layout for login page
    });
};

exports.login = async (req, res) => {
    try {
        const { email, password, remember } = req.body;
        
        // Validate input
        if (!email || !password) {
            return res.render('auth/login', {
                title: 'Admin Login - Quiz Management System',
                layout: false,
                error: 'Please enter both email and password',
                email: email || ''
            });
        }
        
        const result = await AuthService.login(email, password, remember);
        
        if (result.success) {
            // Store user in session
            req.session.user = result.user;
            
            // Redirect to dashboard/quizzes
            res.redirect('/quizzes');
        } else {
            res.render('auth/login', {
                title: 'Admin Login - Quiz Management System',
                layout: false,
                error: result.message || 'Invalid credentials',
                email: email
            });
        }
    } catch (error) {
        console.error('Login controller error:', error);
        res.render('auth/login', {
            title: 'Admin Login - Quiz Management System',
            layout: false,
            error: 'An error occurred during login. Please try again.',
            email: req.body.email || ''
        });
    }
};

exports.logout = async (req, res) => {
    try {
        if (req.session && req.session.user) {
            const userId = req.session.user.id;
            await AuthService.logout(userId);
            
            // Destroy session
            req.session.destroy((err) => {
                if (err) {
                    console.error('Session destruction error:', err);
                }
                res.redirect('/auth/login');
            });
        } else {
            res.redirect('/auth/login');
        }
    } catch (error) {
        console.error('Logout controller error:', error);
        res.redirect('/auth/login');
    }
};

// Middleware to check if user is authenticated
exports.requireAuth = async (req, res, next) => {
    try {
        if (!req.session || !req.session.user) {
            return res.redirect('/auth/login');
        }
        
        const validation = await AuthService.validateSession(req.session);
        
        if (!validation.valid) {
            req.session.destroy();
            return res.redirect('/auth/login');
        }
        
        // Add user to request object for use in routes
        req.user = validation.user;
        next();
    } catch (error) {
        console.error('Auth middleware error:', error);
        res.redirect('/auth/login');
    }
};