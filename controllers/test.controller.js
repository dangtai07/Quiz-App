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
                layout: false
            });
            
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
     * Test room (for both admin and participants)
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
            
            // Verify admin access
            if (isAdmin) {
                if (!req.session.user || req.session.user.role !== 'admin') {
                    return res.redirect(`/test/join/${testCode}`);
                }
                
                // if (test.createdBy.toString() !== req.session.user.id) {
                //     return res.status(403).render('error/403', {
                //         title: 'Access Denied',
                //         message: 'You are not the creator of this test',
                //         layout: false
                //     });
                // }
            }
            
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
     * Validate test code and redirect
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
}

module.exports = new TestController();