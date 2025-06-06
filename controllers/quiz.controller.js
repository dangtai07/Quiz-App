const QuizService = require('../services/quiz.service');
const multer = require('multer');

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
function estimateQuizDuration(questions) {
    if (!questions || questions.length === 0) return '0 min';
    
    const totalSeconds = questions.reduce((sum, question) => {
        return sum + (question.answerTime || 30);
    }, 0);
    
    if (totalSeconds < 60) {
        return `${totalSeconds}s`;
    } else {
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
    }
}

// Helper function to migrate old quiz data to new format
function migrateQuizData(quiz) {
    if (!quiz.questions) return quiz;
    
    // Migrate questions to new format if needed
    quiz.questions = quiz.questions.map(question => {
        // If question has old 'type' field, remove it (we only support single choice now)
        if (question.type) {
            delete question.type;
        }
        
        // Ensure answerTime exists
        if (!question.answerTime) {
            question.answerTime = 30; // Default 30 seconds
        }
        
        // Ensure options are in new format
        if (question.options && question.options.length > 0) {
            // If options are in old format, convert them
            if (typeof question.options[0] === 'string') {
                question.options = question.options.map((text, index) => ({
                    letter: String.fromCharCode(65 + index), // A, B, C, D, etc.
                    text: text
                }));
            }
        } else {
            // Default to 2 empty options
            question.options = [
                { letter: 'A', text: '' },
                { letter: 'B', text: '' }
            ];
        }
        
        // Ensure correctAnswer is a single letter (not array)
        if (Array.isArray(question.correctAnswer)) {
            question.correctAnswer = question.correctAnswer[0] || 'A';
        } else if (!question.correctAnswer) {
            question.correctAnswer = 'A';
        }
        
        return question;
    });
    
    return quiz;
}

class QuizController {
    async createQuiz(req, res) {
        try {
            const quiz = await QuizService.createQuiz(req.body, req.files);
            res.status(201).json(quiz);
        } catch (error) {
            console.error('Create quiz error:', error);
            res.status(500).json({ error: error.message });
        }
    }

    async getQuiz(req, res) {
        try {
            let quiz = await QuizService.getQuiz(req.params.id);
            // Migrate data if needed
            quiz = migrateQuizData(quiz);
            res.json(quiz);
        } catch (error) {
            res.status(404).json({ error: error.message });
        }
    }

    async updateQuiz(req, res) {
        try {
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

    // NEW: Unified render method for both create and edit
    renderCreateQuiz(req, res) {
        res.render('quiz/form', {
            title: 'Create New Quiz',
            isEdit: false,
            quiz: null,
            user: req.session.user,
            layout: false
        });
    }

    async renderEditQuiz(req, res) {
        try {
            let quiz = await QuizService.getQuiz(req.params.id);
            // Migrate data if needed for backward compatibility
            quiz = migrateQuizData(quiz);
            
            res.render('quiz/form', {
                title: 'Edit Quiz',
                isEdit: true,
                quiz: quiz,
                user: req.session.user,
                layout: false
            });
        } catch (error) {
            console.error('Error loading quiz for edit:', error);
            res.status(404).render('error/404', {
                title: 'Quiz Not Found',
                message: 'The quiz you are looking for does not exist.',
                layout: false
            });
        }
    }

    // Enhanced getQuizzes method with better data processing
    async getQuizzes(req, res) {
        try {
            const user = req.session.user;
            
            // Fetch quizzes with enhanced data
            const quizzes = await QuizService.getAllQuizzes();
            
            // Add additional stats and formatting
            const enhancedQuizzes = quizzes.map(quiz => {
                // Migrate quiz data if needed
                const migratedQuiz = migrateQuizData(quiz);
                
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
                    ...migratedQuiz.toObject ? migratedQuiz.toObject() : migratedQuiz,
                    completionRate,
                    relativeTime,
                    isRecent: daysDiff <= 7,
                    hasParticipants: (quiz.totalCount || 0) > 0,
                    averageScore: quiz.averageScore || 0,
                    status: getQuizStatus(quiz),
                    estimatedDuration: estimateQuizDuration(migratedQuiz.questions),
                    // Enhanced metadata
                    totalDuration: migratedQuiz.questions ? 
                        migratedQuiz.questions.reduce((sum, q) => sum + (q.answerTime || 30), 0) : 0,
                    hasImages: migratedQuiz.questions ? 
                        migratedQuiz.questions.some(q => q.image) : false,
                    optionCounts: migratedQuiz.questions ? 
                        migratedQuiz.questions.map(q => q.options ? q.options.length : 2) : []
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
                    Math.round(enhancedQuizzes.reduce((sum, q) => sum + q.questions.length, 0) / enhancedQuizzes.length) : 0,
                totalDuration: enhancedQuizzes.reduce((sum, q) => sum + (q.totalDuration || 0), 0)
            };
            
            res.render('quiz/list', {
                title: 'Quiz Management',
                user: user,
                quizzes: enhancedQuizzes,
                stats: stats,
                layout: false
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
            let quiz = await QuizService.getQuiz(req.params.id);
            // Migrate data if needed
            quiz = migrateQuizData(quiz);

            res.render('quiz/preview', {
                title: 'Preview Quiz',
                quiz: quiz,
                isPreview: true,
                user: req.session.user
            });
        } catch (error) {
            console.error('Error loading quiz preview:', error);
            res.status(404).render('error/404', {
                title: 'Quiz Not Found',
                message: 'The quiz you are looking for does not exist.',
                layout: false
            });
        }
    }

    // Enhanced duplication with new format support
    async duplicateQuiz(req, res) {
        try {
            const originalQuizId = req.params.id;
            
            // Get the original quiz
            let originalQuiz = await QuizService.getQuiz(originalQuizId);
            if (!originalQuiz) {
                return res.status(404).json({
                    success: false,
                    message: 'Original quiz not found'
                });
            }
            
            // Migrate data if needed
            originalQuiz = migrateQuizData(originalQuiz);
            
            // Create new quiz data in new format
            const duplicateData = {
                quizInfo: JSON.stringify({
                    title: `${originalQuiz.title} (Copy)`,
                    mode: originalQuiz.mode,
                    scheduleSettings: originalQuiz.scheduleSettings
                }),
                questionsData: JSON.stringify(originalQuiz.questions.map((q, index) => ({
                    number: index + 1,
                    content: q.content,
                    answerTime: q.answerTime || 30,
                    options: q.options || [
                        { letter: 'A', text: '' },
                        { letter: 'B', text: '' }
                    ],
                    correctAnswer: q.correctAnswer || 'A'
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

    // Enhanced analytics method
    async getAnalytics(req, res) {
        try {
            const quizzes = await QuizService.getAllQuizzes();
            
            // Migrate all quiz data for accurate analytics
            const migratedQuizzes = quizzes.map(quiz => migrateQuizData(quiz));
            
            const analytics = {
                totalQuizzes: migratedQuizzes.length,
                totalQuestions: migratedQuizzes.reduce((sum, q) => sum + q.questions.length, 0),
                totalParticipants: migratedQuizzes.reduce((sum, q) => sum + (q.totalCount || 0), 0),
                totalDuration: migratedQuizzes.reduce((sum, q) => {
                    return sum + q.questions.reduce((qSum, question) => {
                        return qSum + (question.answerTime || 30);
                    }, 0);
                }, 0),
                byMode: {
                    online: migratedQuizzes.filter(q => q.mode === 'online').length,
                    offline: migratedQuizzes.filter(q => q.mode === 'offline').length
                },
                questionStats: {
                    averageOptionsPerQuestion: this.calculateAverageOptions(migratedQuizzes),
                    averageTimePerQuestion: this.calculateAverageTime(migratedQuizzes),
                    questionsWithImages: this.countQuestionsWithImages(migratedQuizzes)
                },
                recentActivity: migratedQuizzes
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

    // Helper methods for analytics
    calculateAverageOptions(quizzes) {
        const totalOptions = quizzes.reduce((sum, quiz) => {
            return sum + quiz.questions.reduce((qSum, question) => {
                return qSum + (question.options ? question.options.length : 2);
            }, 0);
        }, 0);
        
        const totalQuestions = quizzes.reduce((sum, quiz) => sum + quiz.questions.length, 0);
        return totalQuestions > 0 ? Math.round((totalOptions / totalQuestions) * 10) / 10 : 0;
    }

    calculateAverageTime(quizzes) {
        const totalTime = quizzes.reduce((sum, quiz) => {
            return sum + quiz.questions.reduce((qSum, question) => {
                return qSum + (question.answerTime || 30);
            }, 0);
        }, 0);
        
        const totalQuestions = quizzes.reduce((sum, quiz) => sum + quiz.questions.length, 0);
        return totalQuestions > 0 ? Math.round(totalTime / totalQuestions) : 0;
    }

    countQuestionsWithImages(quizzes) {
        return quizzes.reduce((sum, quiz) => {
            return sum + quiz.questions.filter(question => question.image).length;
        }, 0);
    }

    // NEW: Migration endpoint for existing quizzes
    async migrateQuizzes(req, res) {
        try {
            const quizzes = await QuizService.getAllQuizzes();
            let migratedCount = 0;
            
            for (const quiz of quizzes) {
                const originalQuiz = await QuizService.getQuiz(quiz._id);
                const migratedQuiz = migrateQuizData(originalQuiz);
                
                // Check if migration is needed
                const needsMigration = originalQuiz.questions.some(q => 
                    q.type || !q.answerTime || !q.options || Array.isArray(q.correctAnswer)
                );
                
                if (needsMigration) {
                    await QuizService.updateQuiz(quiz._id, {
                        quizInfo: JSON.stringify({
                            title: migratedQuiz.title,
                            mode: migratedQuiz.mode,
                            language: migratedQuiz.language,
                            scheduleSettings: migratedQuiz.scheduleSettings
                        }),
                        questionsData: JSON.stringify(migratedQuiz.questions.map((q, index) => ({
                            number: index + 1,
                            content: q.content,
                            answerTime: q.answerTime || 30,
                            options: q.options || [
                                { letter: 'A', text: '' },
                                { letter: 'B', text: '' }
                            ],
                            correctAnswer: q.correctAnswer || 'A'
                        })))
                    }, null);
                    
                    migratedCount++;
                }
            }
            
            res.json({
                success: true,
                message: `Migration completed. ${migratedCount} quizzes were updated.`,
                migratedCount,
                totalQuizzes: quizzes.length
            });
            
        } catch (error) {
            console.error('Migration error:', error);
            res.status(500).json({
                success: false,
                message: 'Migration failed',
                error: error.message
            });
        }
    }
}

module.exports = new QuizController();