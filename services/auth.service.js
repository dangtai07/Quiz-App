// services/auth.service.js
const User = require('../models/user.model');

class AuthService {
    async login(email, password, remember = false) {
        try {
            // First, try to find user in database
            let user = await User.findByEmail(email);
            
            if (user && user.isActive) {
                // Check password
                const isPasswordValid = await user.comparePassword(password);
                
                if (isPasswordValid) {
                    // Update last login
                    await user.updateLastLogin();
                    
                    return {
                        success: true,
                        user: {
                            id: user._id,
                            user_id: user.user_id,
                            name: user.name,
                            email: user.email,
                            role: user.role,
                            loginTime: new Date(),
                            rememberMe: remember
                        }
                    };
                }
            }
            
            // Fallback to hardcoded credentials for development
            const validCredentials = [
                { email: 'admin@quizapp.com', password: 'admin123', name: 'Admin User', role: 'admin' },
                { email: 'teacher@quizapp.com', password: 'teacher123', name: 'Teacher User', role: 'admin' },
                { email: 'demo@demo.com', password: 'demo123', name: 'Demo User', role: 'admin' },
                { email: 'player@demo.com', password: 'player123', name: 'Demo Player', role: 'player' }
            ];
            
            const hardcodedUser = validCredentials.find(
                cred => cred.email.toLowerCase() === email.toLowerCase() && cred.password === password
            );
            
            if (hardcodedUser) {
                // Create user in database if doesn't exist
                try {
                    let dbUser = await User.findByEmail(hardcodedUser.email);
                    if (!dbUser) {
                        const result = await User.createUser({
                            name: hardcodedUser.name,
                            email: hardcodedUser.email,
                            password: hardcodedUser.password,
                            role: hardcodedUser.role
                        });
                        
                        if (result.success) {
                            dbUser = result.user;
                        } else {
                            console.error('Error creating user in DB:', result.message);
                            // Return hardcoded user data if DB creation fails
                            return {
                                success: true,
                                user: {
                                    id: Date.now(),
                                    user_id: Date.now(),
                                    name: hardcodedUser.name,
                                    email: hardcodedUser.email,
                                    role: hardcodedUser.role,
                                    loginTime: new Date(),
                                    rememberMe: remember
                                }
                            };
                        }
                    }
                    
                    await dbUser.updateLastLogin();
                    
                    return {
                        success: true,
                        user: {
                            id: dbUser._id,
                            user_id: dbUser.user_id,
                            name: dbUser.name,
                            email: dbUser.email,
                            role: dbUser.role,
                            loginTime: new Date(),
                            rememberMe: remember
                        }
                    };
                } catch (dbError) {
                    console.error('Database user creation error:', dbError);
                    // Return hardcoded user data even if DB save fails
                    return {
                        success: true,
                        user: {
                            id: Date.now(),
                            user_id: Date.now(),
                            name: hardcodedUser.name,
                            email: hardcodedUser.email,
                            role: hardcodedUser.role,
                            loginTime: new Date(),
                            rememberMe: remember
                        }
                    };
                }
            }
            
            return {
                success: false,
                message: 'Invalid email or password'
            };
            
        } catch (error) {
            console.error('Login error:', error);
            return {
                success: false,
                message: 'An error occurred during login'
            };
        }
    }
    
    async logout(userId) {
        try {
            // In a real application, you might want to:
            // - Clear session data from database
            // - Invalidate tokens
            // - Log the logout event
            
            return {
                success: true,
                message: 'Logged out successfully'
            };
        } catch (error) {
            console.error('Logout error:', error);
            return {
                success: false,
                message: 'An error occurred during logout'
            };
        }
    }
    
    async validateSession(sessionData) {
        try {
            // Basic session validation
            if (!sessionData || !sessionData.user) {
                return { valid: false, message: 'No session found' };
            }
            
            // Check if session is expired (optional)
            const sessionAge = Date.now() - new Date(sessionData.user.loginTime).getTime();
            const maxAge = sessionData.user.rememberMe ? 30 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000; // 30 days or 1 day
            
            if (sessionAge > maxAge) {
                return { valid: false, message: 'Session expired' };
            }
            
            return { valid: true, user: sessionData.user };
        } catch (error) {
            console.error('Session validation error:', error);
            return { valid: false, message: 'Session validation failed' };
        }
    }

    // Method to create initial admin user
    async createInitialAdmin() {
        try {
            const adminExists = await User.findOne({ role: 'admin' });
            
            if (!adminExists) {
                console.log('🔧 Creating initial admin user...');
                
                const result = await User.createUser({
                    name: 'System Administrator',
                    email: 'admin@quizapp.com',
                    password: 'admin123', // Change this in production
                    role: 'admin'
                });
                
                if (result.success) {
                    console.log('✅ Initial admin user created: admin@quizapp.com / admin123');
                    return result.user;
                } else {
                    console.error('❌ Failed to create initial admin:', result.message);
                    return null;
                }
            } else {
                console.log('✅ Admin user already exists');
                return adminExists;
            }
        } catch (error) {
            console.error('❌ Error creating initial admin:', error);
            return null;
        }
    }

    // Method to create initial demo users
    async createInitialUsers() {
        try {
            const demoUsers = [
                { name: 'System Administrator', email: 'admin@quizapp.com', password: 'admin123', role: 'admin' },
                { name: 'Teacher User', email: 'teacher@quizapp.com', password: 'teacher123', role: 'admin' },
                { name: 'Demo User', email: 'demo@demo.com', password: 'demo123', role: 'admin' },
                { name: 'Demo Player', email: 'player@demo.com', password: 'player123', role: 'player' }
            ];

            for (const userData of demoUsers) {
                const existingUser = await User.findByEmail(userData.email);
                if (!existingUser) {
                    const result = await User.createUser(userData);
                    if (result.success) {
                        console.log(`✅ Demo user created: ${userData.email}`);
                    }
                }
            }
        } catch (error) {
            console.error('Error creating demo users:', error);
        }
    }
}

module.exports = new AuthService();