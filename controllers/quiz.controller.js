const QuizService = require('../services/quiz.service');
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });

// Helper function to determine quiz status
function getQuizStatus(quiz) {
    if (!quiz.scheduleSettings) {
        return 'active'; // Online quizzes are always active
    }
    
    const now = new Date();
    const startTime = new Date(quiz.scheduleSettings.startTime);
    const endTime = new Date(quiz.scheduleSettings.endTime);
    
    if (now < startTime) {
        return 'scheduled';
    } else if (now >= startTime && now <= endTime) {
        return 'active';
    } else {
        return 'expired';
    }
}

// Helper function to estimate quiz duration
function estimateQuizDuration(questionCount) {
    // Assume 1-2 minutes per question on average
    const minutes = questionCount * 1.5;
    
    if (minutes < 60) {
        return `${Math.round(minutes)} min`;
    } else {
        const hours = Math.floor(minutes / 60);
        const remainingMinutes = Math.round(minutes % 60);
        return `${hours}h ${remainingMinutes}m`;
    }
}

class QuizController {
    async createQuiz(req, res) {
        try {
            const quiz = await QuizService.createQuiz(req.body, req.files);
            res.status(201).json(quiz);
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: error.message });
        }
    }

    async getQuiz(req, res) {
        try {
            const quiz = await QuizService.getQuiz(req.params.id);
            res.json(quiz);
        } catch (error) {
            res.status(404).json({ error: error.message });
        }
    }

    async updateQuiz(req, res) {
        try {
            console.log(req.body);
            const updatedQuiz = await QuizService.updateQuiz(req.params.id, req.body, req.files);
            res.json(updatedQuiz);
        } catch (error) {
            console.error('Error updating quiz:', error);
            res.status(400).json({ error: error.message });
        }
    }

    async deleteQuiz(req, res) {
        try {
            const result = await QuizService.deleteQuiz(req.params.id);
            res.json(result);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    }

    renderCreateQuiz(req, res) {
        res.render('quiz/create', {
            title: 'Create New Quiz',
            style: '',
        });
    }

    // Enhanced getQuizzes method with better data processing
    async getQuizzes(req, res) {
        try {
            const user = req.session.user;
            
            // Fetch quizzes with enhanced data
            const quizzes = await QuizService.getAllQuizzes();
            
            // Add additional stats and formatting
            const enhancedQuizzes = quizzes.map(quiz => {
                // Calculate completion percentage
                const completionRate = quiz.totalCount > 0 ? 
                    Math.round((quiz.completedCount / quiz.totalCount) * 100) : 0;
                
                // Format dates
                const createdDate = new Date(quiz.createdAt);
                const updatedDate = new Date(quiz.updatedAt);
                const now = new Date();
                
                // Calculate relative time
                const daysDiff = Math.floor((now - updatedDate) / (1000 * 60 * 60 * 24));
                let relativeTime;
                if (daysDiff === 0) {
                    relativeTime = 'Today';
                } else if (daysDiff === 1) {
                    relativeTime = 'Yesterday';
                } else if (daysDiff < 7) {
                    relativeTime = `${daysDiff} days ago`;
                } else {
                    relativeTime = updatedDate.toLocaleDateString();
                }
                
                return {
                    ...quiz,
                    completionRate,
                    relativeTime,
                    isRecent: daysDiff <= 7,
                    hasParticipants: quiz.totalCount > 0,
                    averageScore: quiz.averageScore || 0,
                    // Add status based on schedule
                    status: getQuizStatus(quiz),
                    // Add estimated duration
                    estimatedDuration: estimateQuizDuration(quiz.questions.length)
                };
            });
            
            // Calculate summary statistics
            const stats = {
                total: enhancedQuizzes.length,
                online: enhancedQuizzes.filter(q => q.mode === 'online').length,
                offline: enhancedQuizzes.filter(q => q.mode === 'offline').length,
                active: enhancedQuizzes.filter(q => q.status === 'active').length,
                totalParticipants: enhancedQuizzes.reduce((sum, q) => sum + (q.totalCount || 0), 0),
                averageQuestions: enhancedQuizzes.length > 0 ? 
                    Math.round(enhancedQuizzes.reduce((sum, q) => sum + q.questions.length, 0) / enhancedQuizzes.length) : 0
            };
            
            res.render('quiz/list', {
                title: 'Quiz Management',
                user: user,
                quizzes: enhancedQuizzes,
                stats: stats,
                layout: false // Using custom layout
            });
            
        } catch (error) {
            console.error('Error fetching quizzes:', error);
            res.status(500).render('error/500', {
                title: 'Server Error',
                message: 'Unable to load quizzes. Please try again later.',
                layout: false
            });
        }
    }

    async previewQuiz(req, res) {
        try {
            const quiz = await QuizService.getQuiz(req.params.id);

            res.render('quiz/preview', {
                title: 'Preview Quiz',
                quiz: quiz,
                isPreview: true
            });
        } catch (error) {
            res.status(404).render('error', {
                message: 'Quiz not found',
                error: error
            });
        }
    }

    async renderEditQuiz(req, res) {
        try {
            const quiz = await QuizService.getQuiz(req.params.id);
            res.render('quiz/edit', {
                title: 'Edit Quiz',
                quiz: quiz,
                questionCount: quiz.questions.length, // Add this
                style: '',
                script: ''
            });
        } catch (error) {
            console.error('Error loading quiz:', error);
            res.redirect('/quizzes');
        }
    }

    // New method for quiz duplication
    async duplicateQuiz(req, res) {
        try {
            const originalQuizId = req.params.id;
            
            // Get the original quiz
            const originalQuiz = await QuizService.getQuiz(originalQuizId);
            if (!originalQuiz) {
                return res.status(404).json({
                    success: false,
                    message: 'Original quiz not found'
                });
            }
            
            // Create new quiz data
            const duplicateData = {
                quizInfo: JSON.stringify({
                    title: `${originalQuiz.title} (Copy)`,
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
            
            // Create the duplicate
            const duplicatedQuiz = await QuizService.createQuiz(duplicateData, null);
            
            // Log the action
            console.log(`Quiz "${originalQuiz.title}" duplicated by user ${req.session.user.email}`);
            
            res.json({
                success: true,
                message: 'Quiz duplicated successfully',
                quiz: {
                    id: duplicatedQuiz._id,
                    title: duplicatedQuiz.title
                }
            });
            
        } catch (error) {
            console.error('Duplicate quiz error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to duplicate quiz',
                error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
            });
        }
    }

    // Enhanced delete method with better error handling
    async deleteQuizEnhanced(req, res) {
        try {
            const quizId = req.params.id;
            
            // Verify quiz exists and user has permission
            const quiz = await QuizService.getQuiz(quizId);
            if (!quiz) {
                return res.status(404).json({
                    success: false,
                    message: 'Quiz not found'
                });
            }
            
            // Check if quiz has active participants (optional business logic)
            const hasActiveParticipants = quiz.totalCount > 0;
            if (hasActiveParticipants) {
                // You might want to prevent deletion of quizzes with participants
                // or add additional confirmation
                console.log(`Warning: Deleting quiz with ${quiz.totalCount} participants`);
            }
            
            // Delete the quiz
            await QuizService.deleteQuiz(quizId);
            
            // Log the action
            console.log(`Quiz "${quiz.title}" (ID: ${quizId}) deleted by user ${req.session.user.email}`);
            
            res.json({
                success: true,
                message: 'Quiz deleted successfully'
            });
            
        } catch (error) {
            console.error('Delete quiz error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to delete quiz',
                error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
            });
        }
    }

    // Analytics method
    async getAnalytics(req, res) {
        try {
            const quizzes = await QuizService.getAllQuizzes();
            
            const analytics = {
                totalQuizzes: quizzes.length,
                totalQuestions: quizzes.reduce((sum, q) => sum + q.questions.length, 0),
                totalParticipants: quizzes.reduce((sum, q) => sum + (q.totalCount || 0), 0),
                byMode: {
                    online: quizzes.filter(q => q.mode === 'online').length,
                    offline: quizzes.filter(q => q.mode === 'offline').length
                },
                byLanguage: {
                    vietnamese: quizzes.filter(q => q.language === 'vietnamese').length,
                    english: quizzes.filter(q => q.language === 'english').length
                },
                recentActivity: quizzes
                    .filter(q => {
                        const daysDiff = Math.floor((new Date() - new Date(q.updatedAt)) / (1000 * 60 * 60 * 24));
                        return daysDiff <= 7;
                    })
                    .length
            };
            
            res.json(analytics);
            
        } catch (error) {
            console.error('Analytics error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch analytics'
            });
        }
    }
}

module.exports = new QuizController();