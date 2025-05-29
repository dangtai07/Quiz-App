// services/auth.service.js
class AuthService {
    async login(email, password, remember = false) {
        try {
            // For demo purposes - replace with actual database authentication
            // You should hash passwords in production and compare with database
            const validCredentials = [
                { email: 'admin@quizapp.com', password: 'admin123', name: 'Admin User', role: 'admin' },
                { email: 'teacher@quizapp.com', password: 'teacher123', name: 'Teacher User', role: 'teacher' },
                { email: 'demo@demo.com', password: 'demo123', name: 'Demo User', role: 'admin' }
            ];
            
            const user = validCredentials.find(
                cred => cred.email.toLowerCase() === email.toLowerCase() && cred.password === password
            );
            
            if (user) {
                // Remove password from user object before returning
                const { password: _, ...userWithoutPassword } = user;
                
                return {
                    success: true,
                    user: {
                        ...userWithoutPassword,
                        id: Date.now(), // Generate a simple ID
                        loginTime: new Date(),
                        rememberMe: remember
                    }
                };
            } else {
                return {
                    success: false,
                    message: 'Invalid email or password'
                };
            }
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
}

module.exports = new AuthService();