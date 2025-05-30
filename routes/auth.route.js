const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');

// Auth Routes
router.get('/login', authController.getLoginPage);
router.post('/login', authController.login);
router.get('/logout', authController.logout);
router.post('/register', authController.register);

// Player Routes (Protected)
router.get('/player/join-quiz', 
    authController.requireAuth, 
    authController.requirePlayer, 
    (req, res) => {
        res.render('player/join-quiz', {
            title: 'Join a Quiz',
            user: req.user,
            layout: false
        });
    }
);

router.post('/player/join-quiz',
    authController.requireAuth,
    authController.requirePlayer,
    async (req, res) => {
        try {
            const { pinCode, playerName } = req.body;
            
            // Validate input
            if (!pinCode || pinCode.length !== 6) {
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

            // Find quiz by PIN code (assuming Quiz model has pinCode field)
            const Quiz = require('../models/quiz.model');
            const quiz = await Quiz.findOne({ 
                pinCode: pinCode,
                isActive: true,
                // Add additional conditions like schedule validation
            });

            if (!quiz) {
                return res.status(404).json({
                    success: false,
                    message: 'Quiz not found or not currently active'
                });
            }

            // Check if quiz is within scheduled time (if applicable)
            if (quiz.scheduleSettings) {
                const now = new Date();
                if (now < quiz.scheduleSettings.startTime || now > quiz.scheduleSettings.endTime) {
                    return res.status(400).json({
                        success: false,
                        message: 'Quiz is not currently available'
                    });
                }
            }

            // Store quiz session and redirect to quiz lobby/room
            req.session.currentQuiz = {
                quizId: quiz._id,
                playerName: playerName.trim(),
                joinedAt: new Date()
            };

            res.json({
                success: true,
                message: 'Successfully joined quiz',
                redirectUrl: `/quiz/${quiz._id}/lobby`
            });

        } catch (error) {
            console.error('Join quiz error:', error);
            res.status(500).json({
                success: false,
                message: 'An error occurred while joining the quiz'
            });
        }
    }
);

// Admin Routes (Protected)
router.get('/admin/dashboard',
    authController.requireAuth,
    authController.requireAdmin,
    async (req, res) => {
        try {
            const Quiz = require('../models/quiz.model');
            const quizzes = await Quiz.find({ createdBy: req.user.id })
                .select('title mode language questions scheduleSettings createdAt updatedAt')
                .sort({ createdAt: -1 });

            const formattedQuizzes = quizzes.map(quiz => ({
                ...quiz.toObject(),
                questionCount: quiz.questions.length,
                completedCount: 0, // TODO: Implement completion tracking
                totalCount: 0,     // TODO: Implement participant counting
                formattedDate: new Date(quiz.updatedAt).toLocaleDateString()
            }));

            res.render('admin/dashboard', {
                title: 'Admin Dashboard',
                user: req.user,
                quizzes: formattedQuizzes,
                totalQuizzes: formattedQuizzes.length
            });
        } catch (error) {
            console.error('Admin dashboard error:', error);
            res.status(500).render('error/500', {
                title: 'Server Error',
                message: 'Unable to load dashboard'
            });
        }
    }
);

module.exports = router;