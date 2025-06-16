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

// Helper function to get room name
function getRoomName(roomCode) {
    const roomNames = {
        'hrm': 'Human Resource Management',
        'hse': 'Health, Safety & Environment',
        'gm': 'General Management',
        'qasx': 'Quality Assurance - Production',
        'sm': 'Sales Marketing'
    };
    return roomNames[roomCode] || roomCode.toUpperCase();
}

class QuizController {
    async createQuiz(req, res) {
        try {
            // Lấy roomCode từ session của admin đã chọn phòng
            const roomCode = req.session?.selectedRoom?.code;
            if (!roomCode) {
                return res.status(400).json({ 
                    error: req.t ? req.t('quiz:room_selection_required') : 'Room selection required. Please select a department first.'
                });
            }

            // Thêm roomCode vào dữ liệu quiz
            const quizData = { ...req.body };
            const quizInfo = JSON.parse(quizData.quizInfo);
            quizInfo.roomCode = roomCode; // Thêm roomCode
            quizData.quizInfo = JSON.stringify(quizInfo);

            const quiz = await QuizService.createQuiz(quizData, req.files);
            
            console.log(`✅ Quiz "${quiz.title}" (Number: ${quiz.number}) created for ${roomCode.toUpperCase()} department by ${req.session.user.email}`);
            
            res.status(201).json(quiz);
        } catch (error) {
            console.error('Create quiz error:', error);
            res.status(500).json({ 
                error: req.t ? req.t('quiz:create_quiz_error') : error.message 
            });
        }
    }

    async getQuiz(req, res) {
        try {
            let quiz = await QuizService.getQuiz(req.params.id);
            
            // Kiểm tra quyền truy cập theo phòng ban
            const userRoomCode = req.session?.selectedRoom?.code;
            if (userRoomCode && quiz.roomCode && quiz.roomCode !== userRoomCode) {
                return res.status(403).json({ 
                    error: req.t ? req.t('quiz:access_denied_different_department') : 'Access denied. This quiz belongs to a different department.'
                });
            }

            // Migrate data if needed
            quiz = migrateQuizData(quiz);
            res.json(quiz);
        } catch (error) {
            res.status(404).json({ 
                error: req.t ? req.t('quiz:quiz_not_found') : error.message 
            });
        }
    }

    async updateQuiz(req, res) {
        try {
            // Kiểm tra quyền sửa theo phòng ban
            const quiz = await QuizService.getQuiz(req.params.id);
            const userRoomCode = req.session?.selectedRoom?.code;
            
            if (userRoomCode && quiz.roomCode && quiz.roomCode !== userRoomCode) {
                return res.status(403).json({ 
                    error: req.t ? req.t('quiz:access_denied_edit_department') : 'Access denied. You can only edit quizzes from your department.'
                });
            }

            const updatedQuiz = await QuizService.updateQuiz(req.params.id, req.body, req.files);
            
            console.log(`✅ Quiz "${updatedQuiz.title}" (Number: ${updatedQuiz.number}) updated in ${quiz.roomCode?.toUpperCase()} department by ${req.session.user.email}`);
            
            res.json(updatedQuiz);
        } catch (error) {
            console.error('Error updating quiz:', error);
            res.status(400).json({ 
                error: req.t ? req.t('quiz:update_quiz_error') : error.message 
            });
        }
    }

    async deleteQuiz(req, res) {
        try {
            // Kiểm tra quyền xóa theo phòng ban
            const quiz = await QuizService.getQuiz(req.params.id);
            const userRoomCode = req.session?.selectedRoom?.code;
            
            if (userRoomCode && quiz.roomCode && quiz.roomCode !== userRoomCode) {
                return res.status(403).json({ 
                    error: req.t ? req.t('quiz:access_denied_delete_department') : 'Access denied. You can only delete quizzes from your department.'
                });
            }

            const result = await QuizService.deleteQuiz(req.params.id);
            
            console.log(`🗑️ Quiz "${quiz.title}" (Number: ${quiz.number}) deleted from ${quiz.roomCode?.toUpperCase()} department by ${req.session.user.email}`);
            
            res.json(result);
        } catch (error) {
            res.status(400).json({ 
                error: req.t ? req.t('quiz:delete_quiz_error') : error.message 
            });
        }
    }

    // NEW: Unified render method for both create and edit
    renderCreateQuiz(req, res) {
        const roomInfo = req.session?.selectedRoom;
        if (!roomInfo) {
            return res.redirect('/auth/admin/select-room');
        }

        res.render('quiz/form', {
            title: req.t ? req.t('quiz:create_new_quiz') + ' - ' + getRoomName(roomInfo.code) : `Create New Quiz - ${getRoomName(roomInfo.code)}`,
            isEdit: false,
            quiz: null,
            user: req.session.user,
            roomInfo: roomInfo,
            lng: req.language || 'vi',
            layout: false
        });
    }

    async renderEditQuiz(req, res) {
        try {
            let quiz = await QuizService.getQuiz(req.params.id);
            
            // Kiểm tra quyền truy cập theo phòng ban
            const userRoomCode = req.session?.selectedRoom?.code;
            if (userRoomCode && quiz.roomCode && quiz.roomCode !== userRoomCode) {
                return res.status(403).render('error/403', {
                    title: req.t ? req.t('error:access_denied') : 'Access Denied',
                    message: req.t ? req.t('quiz:access_denied_edit_department') : 'You can only edit quizzes from your department.',
                    lng: req.language || 'vi',
                    layout: false
                });
            }

            // Migrate data if needed for backward compatibility
            quiz = migrateQuizData(quiz);
            
            const roomInfo = req.session?.selectedRoom;
            
            res.render('quiz/form', {
                title: req.t ? 
                    req.t('quiz:edit_quiz') + ` #${quiz.number} - ` + getRoomName(roomInfo?.code || quiz.roomCode) :
                    `Edit Quiz #${quiz.number} - ${getRoomName(roomInfo?.code || quiz.roomCode)}`,
                isEdit: true,
                quiz: quiz,
                user: req.session.user,
                roomInfo: roomInfo,
                lng: req.language || 'vi',
                layout: false
            });
        } catch (error) {
            console.error('Error loading quiz for edit:', error);
            res.status(404).render('error/404', {
                title: req.t ? req.t('error:quiz_not_found') : 'Quiz Not Found',
                message: req.t ? req.t('error:quiz_not_found_desc') : 'The quiz you are looking for does not exist.',
                lng: req.language || 'vi',
                layout: false
            });
        }
    }

    // Enhanced getQuizzes method with room filtering and quiz number support
    async getQuizzes(req, res) {
        try {
            const user = req.session.user;
            const roomInfo = req.session?.selectedRoom;
            
            // Get pagination parameters
            const page = parseInt(req.query.page) || 1;
            const limit = 12; // Default 12 quizzes per page
            const skip = (page - 1) * limit;
            
            // Lấy roomCode để lọc quiz
            const roomCode = roomInfo?.code;
            if (!roomCode) {
                return res.redirect('/auth/admin/select-room');
            }
            
            // Fetch all quizzes filtered by room code
            const allQuizzes = await QuizService.getAllQuizzes();
            const filteredQuizzes = allQuizzes.filter(quiz => quiz.roomCode === roomCode);
            
            // Apply pagination
            const totalQuizzes = filteredQuizzes.length;
            const totalPages = Math.ceil(totalQuizzes / limit);
            const paginatedQuizzes = filteredQuizzes.slice(skip, skip + limit);
            
            // Add additional stats and formatting with quiz number support
            const enhancedQuizzes = paginatedQuizzes.map(quiz => {
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
                    relativeTime = req.t ? req.t('quiz:today') : 'Today';
                } else if (daysDiff === 1) {
                    relativeTime = req.t ? req.t('quiz:yesterday') : 'Yesterday';
                } else if (daysDiff < 7) {
                    relativeTime = req.t ? 
                        req.t('quiz:days_ago', { count: daysDiff }) : 
                        `${daysDiff} days ago`;
                } else {
                    relativeTime = updatedDate.toLocaleDateString(req.language === 'vi' ? 'vi-VN' : 'en-US');
                }
                
                return {
                    ...migratedQuiz.toObject ? migratedQuiz.toObject() : migratedQuiz,
                    // IMPORTANT: Include quiz number
                    number: quiz.number,
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
            
            // Calculate summary statistics for current room (based on all quizzes, not just current page)
            const stats = {
                total: totalQuizzes,
                online: filteredQuizzes.filter(q => q.mode === 'online').length,
                offline: filteredQuizzes.filter(q => q.mode === 'offline').length,
                active: filteredQuizzes.filter(q => q.status === 'active').length,
                totalParticipants: filteredQuizzes.reduce((sum, q) => sum + (q.totalCount || 0), 0),
                averageQuestions: filteredQuizzes.length > 0 ? 
                    Math.round(filteredQuizzes.reduce((sum, q) => sum + q.questions.length, 0) / filteredQuizzes.length) : 0,
                totalDuration: filteredQuizzes.reduce((sum, q) => {
                    const duration = q.questions ? q.questions.reduce((qSum, question) => qSum + (question.answerTime || 30), 0) : 0;
                    return sum + duration;
                }, 0),
                // NEW: Quiz number stats
                numberRange: filteredQuizzes.length > 0 ? {
                    lowest: Math.min(...filteredQuizzes.map(q => q.number || 999999)),
                    highest: Math.max(...filteredQuizzes.map(q => q.number || 0))
                } : null
            };
            
            res.render('quiz/list', {
                title: req.t ? 
                    req.t('quiz:quiz_management') + ' - ' + getRoomName(roomCode) :
                    `Quiz Management - ${getRoomName(roomCode)}`,
                user: user,
                quizzes: enhancedQuizzes,
                stats: stats,
                roomInfo: roomInfo,
                lng: req.language || 'vi',
                // Pagination data
                currentPage: page,
                totalPages: totalPages,
                totalQuizzes: totalQuizzes,
                pagination: {
                    hasNext: page < totalPages,
                    hasPrev: page > 1,
                    nextPage: page + 1,
                    prevPage: page - 1,
                    pages: Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                        const startPage = Math.max(1, page - 2);
                        return startPage + i;
                    }).filter(p => p <= totalPages)
                },
                layout: false
            });
            
        } catch (error) {
            console.error('Error fetching quizzes:', error);
            res.status(500).render('error/500', {
                title: req.t ? req.t('error:server_error') : 'Server Error',
                message: req.t ? req.t('error:unable_load_quizzes') : 'Unable to load quizzes. Please try again later.',
                lng: req.language || 'vi',
                layout: false
            });
        }
    }

    async previewQuiz(req, res) {
        try {
            let quiz = await QuizService.getQuiz(req.params.id);
            
            // Kiểm tra quyền truy cập theo phòng ban
            const userRoomCode = req.session?.selectedRoom?.code;
            if (userRoomCode && quiz.roomCode && quiz.roomCode !== userRoomCode) {
                return res.status(403).render('error/403', {
                    title: req.t ? req.t('error:access_denied') : 'Access Denied',
                    message: req.t ? req.t('quiz:access_denied_preview_department') : 'You can only preview quizzes from your department.',
                    lng: req.language || 'vi',
                    layout: false
                });
            }

            // Migrate data if needed
            quiz = migrateQuizData(quiz);

            res.render('quiz/preview', {
                title: req.t ? 
                    req.t('quiz:preview_quiz') + ` #${quiz.number} - ` + getRoomName(quiz.roomCode) :
                    `Preview Quiz #${quiz.number} - ${getRoomName(quiz.roomCode)}`,
                quiz: quiz,
                isPreview: true,
                user: req.session.user,
                roomInfo: req.session?.selectedRoom,
                lng: req.language || 'vi',
                // Đảm bảo i18n helpers được truyền
                t: req.t,
                ti: res.locals.ti,
                formatDate: res.locals.formatDate,
                formatNumber: res.locals.formatNumber,
                buildLangUrl: res.locals.buildLangUrl,
                layout: false
            });
        } catch (error) {
            console.error('Error loading quiz preview:', error);
            res.status(404).render('error/404', {
                title: req.t ? req.t('error:quiz_not_found') : 'Quiz Not Found',
                message: req.t ? req.t('error:quiz_not_found_desc') : 'The quiz you are looking for does not exist.',
                lng: req.language || 'vi',
                layout: false
            });
        }
    }

    // Enhanced duplication with room code preservation and new quiz number
    async duplicateQuiz(req, res) {
        try {
            const originalQuizId = req.params.id;
            
            // Get the original quiz
            let originalQuiz = await QuizService.getQuiz(originalQuizId);
            if (!originalQuiz) {
                return res.status(404).json({
                    success: false,
                    message: req.t ? req.t('quiz:original_quiz_not_found') : 'Original quiz not found'
                });
            }

            // Kiểm tra quyền duplicate theo phòng ban
            const userRoomCode = req.session?.selectedRoom?.code;
            if (userRoomCode && originalQuiz.roomCode && originalQuiz.roomCode !== userRoomCode) {
                return res.status(403).json({
                    success: false,
                    message: req.t ? req.t('quiz:access_denied_duplicate_department') : 'You can only duplicate quizzes from your department'
                });
            }
            
            // Migrate data if needed
            originalQuiz = migrateQuizData(originalQuiz);
            
            // Create new quiz data in new format with same room code (new quiz number will be auto-generated)
            const copyLabel = req.t ? req.t('quiz:copy') : 'Copy';
            const duplicateData = {
                quizInfo: JSON.stringify({
                    title: `${originalQuiz.title} (${copyLabel})`,
                    mode: originalQuiz.mode,
                    roomCode: originalQuiz.roomCode, // Preserve room code
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
            console.log(`📋 Quiz "${originalQuiz.title}" (Number: ${originalQuiz.number}) duplicated as Quiz #${duplicatedQuiz.number} in ${originalQuiz.roomCode?.toUpperCase()} department by user ${req.session.user.email}`);
            
            res.json({
                success: true,
                message: req.t ? 
                    req.t('quiz:quiz_duplicated_as_number', { number: duplicatedQuiz.number }) :
                    `Quiz duplicated successfully as Quiz #${duplicatedQuiz.number}`,
                quiz: {
                    id: duplicatedQuiz._id,
                    number: duplicatedQuiz.number,
                    title: duplicatedQuiz.title,
                    roomCode: duplicatedQuiz.roomCode
                }
            });
            
        } catch (error) {
            console.error('Duplicate quiz error:', error);
            res.status(500).json({
                success: false,
                message: req.t ? req.t('quiz:failed_duplicate_quiz') : 'Failed to duplicate quiz',
                error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
            });
        }
    }

    // Enhanced delete method with room access check
    async deleteQuizEnhanced(req, res) {
        try {
            const quizId = req.params.id;
            
            // Verify quiz exists and user has permission
            const quiz = await QuizService.getQuiz(quizId);
            if (!quiz) {
                return res.status(404).json({
                    success: false,
                    message: req.t ? req.t('quiz:quiz_not_found') : 'Quiz not found'
                });
            }

            // Kiểm tra quyền xóa theo phòng ban
            const userRoomCode = req.session?.selectedRoom?.code;
            if (userRoomCode && quiz.roomCode && quiz.roomCode !== userRoomCode) {
                return res.status(403).json({
                    success: false,
                    message: req.t ? req.t('quiz:access_denied_delete_department') : 'You can only delete quizzes from your department'
                });
            }
            
            // Check if quiz has active participants (optional business logic)
            const hasActiveParticipants = quiz.totalCount > 0;
            if (hasActiveParticipants) {
                console.log(`⚠️ Warning: Deleting quiz #${quiz.number} with ${quiz.totalCount} participants`);
            }
            
            // Delete the quiz
            await QuizService.deleteQuiz(quizId);
            
            // Log the action
            console.log(`🗑️ Quiz "${quiz.title}" (Number: ${quiz.number}, ID: ${quizId}) deleted from ${quiz.roomCode?.toUpperCase()} department by user ${req.session.user.email}`);
            
            res.json({
                success: true,
                message: req.t ? 
                    req.t('quiz:quiz_number_deleted', { number: quiz.number }) :
                    `Quiz #${quiz.number} deleted successfully`
            });
            
        } catch (error) {
            console.error('Delete quiz error:', error);
            res.status(500).json({
                success: false,
                message: req.t ? req.t('quiz:failed_delete_quiz') : 'Failed to delete quiz',
                error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
            });
        }
    }

    // Enhanced analytics method with room filtering and quiz number analytics
    async getAnalytics(req, res) {
        try {
            const roomCode = req.session?.selectedRoom?.code;
            const allQuizzes = await QuizService.getAllQuizzes();
            
            // Filter quizzes by room code
            const quizzes = roomCode ? 
                allQuizzes.filter(quiz => quiz.roomCode === roomCode) : 
                allQuizzes;
            
            // Migrate all quiz data for accurate analytics
            const migratedQuizzes = quizzes.map(quiz => migrateQuizData(quiz));
            
            const analytics = {
                roomInfo: roomCode ? {
                    code: roomCode,
                    name: getRoomName(roomCode)
                } : null,
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
                // NEW: Quiz number statistics
                numberStats: migratedQuizzes.length > 0 ? {
                    lowest: Math.min(...migratedQuizzes.map(q => q.number || 999999)),
                    highest: Math.max(...migratedQuizzes.map(q => q.number || 0)),
                    range: Math.max(...migratedQuizzes.map(q => q.number || 0)) - 
                           Math.min(...migratedQuizzes.map(q => q.number || 999999)) + 1,
                    total: migratedQuizzes.length
                } : null,
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
                message: req.t ? req.t('quiz:failed_fetch_analytics') : 'Failed to fetch analytics'
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

    // NEW: Migration endpoint for existing quizzes to add room codes
    async migrateQuizzes(req, res) {
        try {
            const { targetRoom } = req.body; // Room code to assign to all existing quizzes
            
            if (!targetRoom || !['hrm', 'hse', 'gm', 'qasx', 'sm'].includes(targetRoom)) {
                return res.status(400).json({
                    success: false,
                    message: req.t ? req.t('quiz:specify_valid_target_room') : 'Please specify a valid target room (hrm, hse, gm, qasx or sm)'
                });
            }

            const quizzes = await QuizService.getAllQuizzes();
            let migratedCount = 0;
            
            for (const quiz of quizzes) {
                if (!quiz.roomCode) {
                    const originalQuiz = await QuizService.getQuiz(quiz._id);
                    const migratedQuiz = migrateQuizData(originalQuiz);
                    
                    await QuizService.updateQuiz(quiz._id, {
                        quizInfo: JSON.stringify({
                            title: migratedQuiz.title,
                            mode: migratedQuiz.mode,
                            roomCode: targetRoom, // Assign room code
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
                message: req.t ? 
                    req.t('quiz:migration_completed', { 
                        count: migratedCount,
                        roomName: getRoomName(targetRoom)
                    }) :
                    `Migration completed. ${migratedCount} quizzes were assigned to ${getRoomName(targetRoom)} department.`,
                migratedCount,
                totalQuizzes: quizzes.length,
                targetRoom: targetRoom,
                roomName: getRoomName(targetRoom)
            });
            
        } catch (error) {
            console.error('Migration error:', error);
            res.status(500).json({
                success: false,
                message: req.t ? req.t('quiz:migration_failed') : 'Migration failed',
                error: error.message
            });
        }
    }
}

module.exports = new QuizController();