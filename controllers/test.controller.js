const TestService = require('../services/test.service');
const QuizService = require('../services/quiz.service');

class TestController {
    /**
     * Create new test session
     */
    async createTest(req, res) {
        try {
            const { quizNumber, mode, maxParticipants, scheduleSettings } = req.body;
            const roomCode = req.session?.selectedRoom?.code;
            const createdBy = req.session.user.id;
            
            if (!roomCode) {
                return res.status(400).json({
                    success: false,
                    message: 'Room selection required'
                });
            }
            
            // Validate input
            if (!quizNumber || !mode || !maxParticipants) {
                return res.status(400).json({
                    success: false,
                    message: 'Missing required fields'
                });
            }
            
            if (!['online', 'offline'].includes(mode)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid mode. Must be online or offline'
                });
            }
            
            if (maxParticipants < 1 || maxParticipants > 1000) {
                return res.status(400).json({
                    success: false,
                    message: 'Max participants must be between 1 and 1000'
                });
            }
            
            const testData = {
                quizNumber: parseInt(quizNumber),
                mode,
                maxParticipants: parseInt(maxParticipants),
                scheduleSettings,
                roomCode
            };
            
            const result = await TestService.createTest(testData, createdBy);
            
            res.json({
                success: true,
                message: 'Test created successfully',
                test: {
                    testCode: result.test.testCode,
                    mode: result.test.mode,
                    quizTitle: result.quiz.title,
                    quizNumber: result.quiz.number,
                    maxParticipants: result.test.maxParticipants,
                    scheduleSettings: result.test.scheduleSettings
                },
                joinLink: result.joinLink,
                qrCode: result.qrCode
            });
            
        } catch (error) {
            console.error('Create test error:', error);
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }
    
    /**
     * Join test page
     */
    async renderJoinPage(req, res) {
        try {
            const { testCode } = req.params;
            
            if (!testCode || testCode.length !== 6) {
                return res.status(404).render('error/404', {
                    title: 'Test Not Found',
                    message: 'Invalid test code',
                    layout: false
                });
            }
            
            const test = await TestService.getTestByCode(testCode);
            
            // Check if test is accessible
            if (test.mode === 'offline') {
                const now = new Date();
                if (test.scheduleSettings) {
                    if (now < new Date(test.scheduleSettings.startTime)) {
                        return res.render('test/not_started', {
                            title: 'Test Not Started',
                            test: test,
                            startTime: test.scheduleSettings.startTime,
                            layout: false
                        });
                    }
                    if (now > new Date(test.scheduleSettings.endTime)) {
                        return res.render('test/expired', {
                            title: 'Test Expired',
                            test: test,
                            layout: false
                        });
                    }
                }
            }
            
            if (test.status === 'completed') {
                return res.render('test/completed', {
                    title: 'Test Completed',
                    test: test,
                    layout: false
                });
            }
            
            res.render('test/join', {
                title: `Join Test ${testCode}`,
                test: test,
                error: req.session.testError || null, // Pass error message if any
                layout: false
            });
            
            // Clear error message after displaying
            if (req.session.testError) {
                delete req.session.testError;
            }
            
        } catch (error) {
            console.error('Join page error:', error);
            res.status(404).render('error/404', {
                title: 'Test Not Found',
                message: 'The test you are looking for does not exist',
                layout: false
            });
        }
    }
    
    /**
     * Test room (for both admin and participants) - FIXED for offline mode with participant join
     */
    async renderTestRoom(req, res) {
        try {
            const { testCode } = req.params;
            const isAdmin = req.query.admin === 'true';
            
            if (!testCode || testCode.length !== 6) {
                return res.status(404).render('error/404', {
                    title: 'Test Not Found',
                    layout: false
                });
            }
            
            const test = await TestService.getTestByCode(testCode);
            
            // Verify admin access for online mode
            if (isAdmin && test.mode === 'online') {
                if (!req.session.user || req.session.user.role !== 'admin') {
                    return res.redirect(`/test/join/${testCode}`);
                }
            }
            
            // FIXED: For offline mode, join participant first then render
            if (test.mode === 'offline' && !isAdmin) {
                // Check if participant has valid session
                const testSession = req.session?.testSession;
                if (!testSession || testSession.testCode !== testCode || !testSession.participantName) {
                    return res.redirect(`/test/join/${testCode}`);
                }
                
                try {
                    // FIXED: Actually join the participant to the test before rendering
                    const joinResult = await TestService.joinOfflineTest(testCode, testSession.participantName);
                    
                    console.log(`✅ Offline participant "${testSession.participantName}" joined test ${testCode}`);
                    
                    // Render offline quiz with participant data
                    return res.render('test/offline_quiz', {
                        title: `${test.quizId.title} - ${testCode}`,
                        test: joinResult.test,
                        quiz: joinResult.test.quizId,
                        participantName: testSession.participantName,
                        participant: joinResult.participant,
                        isOfflineMode: true,
                        layout: false
                    });
                    
                } catch (joinError) {
                    console.error('Failed to join offline test:', joinError);
                    
                    // If join fails, redirect back to join page with error
                    req.session.testError = joinError.message;
                    return res.redirect(`/test/join/${testCode}`);
                }
            }
            
            // Existing room logic for online mode or admin view
            res.render('test/room', {
                title: `Test ${testCode} - ${test.quizId.title}`,
                test: test,
                quiz: test.quizId,
                isAdmin: isAdmin,
                user: req.session.user || null,
                layout: false
            });
            
        } catch (error) {
            console.error('Test room error:', error);
            res.status(404).render('error/404', {
                title: 'Test Not Found',
                layout: false
            });
        }
    }
    
    /**
     * Join test by code (for quiz list page)
     */
    async renderJoinByCode(req, res) {
        try {
            res.render('test/join_by_code', {
                title: 'Join Test by Code',
                user: req.session.user || null,
                layout: false
            });
        } catch (error) {
            console.error('Join by code error:', error);
            res.status(500).render('error/500', {
                title: 'Server Error',
                layout: false
            });
        }
    }
    
    /**
     * Validate test code and redirect - UPDATED for offline mode
     */
    async validateAndJoinTest(req, res) {
        try {
            const { testCode } = req.body;
            
            if (!testCode || testCode.length !== 6) {
                return res.status(400).json({
                    success: false,
                    message: 'Please enter a valid 6-digit test code'
                });
            }
            
            // Check if test exists
            const test = await TestService.getTestByCode(testCode);
            
            res.json({
                success: true,
                message: 'Test found',
                redirectUrl: `/test/join/${testCode}`
            });
            
        } catch (error) {
            console.error('Validate test code error:', error);
            res.status(404).json({
                success: false,
                message: 'Test not found. Please check your code and try again.'
            });
        }
    }
    
    /**
     * Validate test availability - UPDATED for offline mode
     */
    async validateTestAvailability(req, res) {
        try {
            const { testCode, participantName } = req.body;
            
            // Basic input validation
            if (!testCode || testCode.length !== 6) {
                return res.status(400).json({
                    success: false,
                    message: 'Please enter a valid 6-digit test code'
                });
            }
            
            if (!participantName) {
                return res.status(400).json({
                    success: false,
                    message: 'Please enter your name'
                });
            }
            
            // Use TestService helper for comprehensive validation
            const validation = await TestService.validateParticipantCanJoin(testCode, participantName);
            
            if (!validation.canJoin) {
                return res.status(400).json({
                    success: false,
                    message: validation.reason,
                    errorType: validation.errorType || 'VALIDATION_ERROR',
                    startTime: validation.startTime // For scheduled tests
                });
            }
            
            // NEW: Store participant session for offline mode
            req.session.testSession = {
                testCode: testCode,
                participantName: participantName.trim(),
                validated: true,
                timestamp: Date.now()
            };
            
            // All validations passed
            res.json({
                success: true,
                message: 'Validation successful - ready to join test',
                test: validation.test,
                participant: validation.participant
            });
            
        } catch (error) {
            console.error('Validate test availability error:', error);
            res.status(404).json({
                success: false,
                message: 'Test not found. Please check your code and try again.',
                errorType: 'TEST_NOT_FOUND'
            });
        }
    }
    
    /**
     * Submit offline answer - FIXED with better session validation
     */
    async submitOfflineAnswer(req, res) {
        try {
            const { testCode, participantName, questionNumber, selectedAnswer, timeRemaining } = req.body;
            
            // Validate input
            if (!testCode || !participantName || questionNumber === undefined) {
                return res.status(400).json({
                    success: false,
                    message: 'Missing required fields'
                });
            }
            
            // Validate session (optional but recommended)
            const testSession = req.session?.testSession;
            if (testSession && (testSession.testCode !== testCode || testSession.participantName !== participantName)) {
                console.warn(`Session mismatch for ${participantName} in test ${testCode}`);
            }
            
            const result = await TestService.submitOfflineAnswer(
                testCode,
                participantName,
                questionNumber,
                selectedAnswer,
                timeRemaining
            );
            
            res.json({
                success: true,
                result: result
            });
            
        } catch (error) {
            console.error('Submit offline answer error:', error);
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }
    
    /**
     * Complete offline test - FIXED with better session validation
     */
    async completeOfflineTest(req, res) {
        try {
            const { testCode, participantName } = req.body;
            
            // Validate input
            if (!testCode || !participantName) {
                return res.status(400).json({
                    success: false,
                    message: 'Missing required fields'
                });
            }
            
            // Validate session (optional but recommended)
            const testSession = req.session?.testSession;
            if (testSession && (testSession.testCode !== testCode || testSession.participantName !== participantName)) {
                console.warn(`Session mismatch for ${participantName} in test ${testCode}`);
            }
            
            const result = await TestService.completeOfflineTest(testCode, participantName);
            
            // Clear session after completion
            if (req.session?.testSession) {
                delete req.session.testSession;
            }
            
            res.json({
                success: true,
                message: 'Test completed successfully',
                results: result
            });
            
        } catch (error) {
            console.error('Complete offline test error:', error);
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }
    
    /**
     * Get test results
     */
    async getTestResults(req, res) {
        try {
            const { testCode } = req.params;
            const results = await TestService.getTestResults(testCode);
            
            res.json({
                success: true,
                results: results
            });
            
        } catch (error) {
            console.error('Get test results error:', error);
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }
    
    /**
     * Render test results page
     */
    async renderTestResults(req, res) {
        try {
            const { testCode } = req.params;
            const results = await TestService.getTestResults(testCode);
            
            res.render('test/results', {
                title: `Test Results - ${testCode}`,
                results: results,
                layout: false
            });
            
        } catch (error) {
            console.error('Render test results error:', error);
            res.status(404).render('error/404', {
                title: 'Results Not Found',
                message: 'Test results not found or test is not completed yet',
                layout: false
            });
        }
    }
    
    /**
     * API endpoint to get live test data
     */
    async getTestData(req, res) {
        try {
            const { testCode } = req.params;
            const test = await TestService.getTestByCode(testCode);
            
            res.json({
                success: true,
                test: {
                    testCode: test.testCode,
                    status: test.status,
                    currentQuestion: test.currentQuestion,
                    isQuestionActive: test.isQuestionActive,
                    participantCount: test.getActiveParticipants().length,
                    maxParticipants: test.maxParticipants
                }
            });
            
        } catch (error) {
            console.error('Get test data error:', error);
            res.status(404).json({
                success: false,
                message: 'Test not found'
            });
        }
    }
}

module.exports = new TestController();