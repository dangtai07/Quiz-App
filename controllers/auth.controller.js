const AuthService = require('../services/auth.service');

exports.getLoginPage = (req, res) => {
    res.render('auth/login', {
        title: 'Sign In - Quiz Management System',
        layout: false // If you want to disable your main layout for login page
    });
};

exports.login = async (req, res) => {
    try {
        const { email, password, remember } = req.body;
        const result = await AuthService.login(email, password, remember);
        
        if (result.success) {
            req.session.user = result.user;
            res.redirect('/dashboard');
        } else {
            res.render('auth/login', {
                error: 'Invalid credentials',
                email
            });
        }
    } catch (error) {
        res.render('auth/login', {
            error: 'An error occurred during login',
            email: req.body.email
        });
    }
};