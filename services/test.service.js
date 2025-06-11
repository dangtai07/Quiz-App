const Test = require('../models/test.model');
const Quiz = require('../models/quiz.model');
const QRCode = require('qrcode');

class TestService {
    /**
     * Create a new test session
     */
    async createTest(testData, createdBy) {
        try {
            const { quizNumber, mode, maxParticipants, scheduleSettings, roomCode } = testData;
            
            // Find quiz by number and room code
            const quiz = await Quiz.findOne({ 
                number: quizNumber, 
                roomCode: roomCode 
            });
            
            if (!quiz) {
                throw new Error(`Quiz #${quizNumber} not found in ${roomCode.toUpperCase()} department`);
            }
            
            // Validate mode compatibility
            if (quiz.mode !== mode) {
                throw new Error(`Quiz #${quizNumber} is ${quiz.mode} mode, but you selected ${mode} mode`);
            }
            
            // Validate schedule for offline mode
            if (mode === 'offline') {
                if (!scheduleSettings || !scheduleSettings.startTime || !scheduleSettings.endTime) {
                    throw new Error('Schedule settings are required for offline mode');
                }
                
                const startTime = new Date(scheduleSettings.startTime);
                const endTime = new Date(scheduleSettings.endTime);
                const now = new Date();
                
                if (startTime <= now) {
                    throw new Error('Start time must be in the future');
                }
                
                if (endTime <= startTime) {
                    throw new Error('End time must be after start time');
                }
            }
            
            // Generate unique test code
            const testCode = await Test.generateTestCode();
            
            // Create test
            const test = new Test({
                testCode,
                quizId: quiz._id,
                quizNumber: quiz.number,
                roomCode,
                mode,
                maxParticipants: Math.min(maxParticipants, 1000), // Cap at 1000
                scheduleSettings: mode === 'offline' ? scheduleSettings : null,
                createdBy,
                participants: []
            });
            
            await test.save();
            
            console.log(`✅ Test created: ${testCode} for Quiz #${quiz.number} (${mode} mode)`);
            
            return {
                test,
                quiz,
                joinLink: this.generateJoinLink(testCode),
                qrCode: await this.generateQRCode(testCode)
            };
            
        } catch (error) {
            console.error('Create test error:', error);
            throw error;
        }
    }
    
    /**
     * Get test by code
     */
    async getTestByCode(testCode) {
        try {
            const test = await Test.findOne({ testCode })
                .populate('quizId')
                .populate('createdBy', 'name email');
                
            if (!test) {
                throw new Error('Test not found');
            }
            
            return test;
        } catch (error) {
            console.error('Get test error:', error);
            throw error;
        }
    }
    
    /**
     * Join test as participant - FIXED with atomic operation and reconnect handling
     */
    async joinTest(testCode, participantName, socketId) {
        try {
            const test = await this.getTestByCode(testCode);
            
            // Check if test is available for joining
            if (test.mode === 'offline') {
                const now = new Date();
                if (test.scheduleSettings) {
                    if (now < new Date(test.scheduleSettings.startTime)) {
                        throw new Error('Test has not started yet');
                    }
                    if (now > new Date(test.scheduleSettings.endTime)) {
                        throw new Error('Test has ended');
                    }
                }
            }
            
            if (test.status === 'completed') {
                throw new Error('Test has already completed');
            }
            
            if (test.status === 'cancelled') {
                throw new Error('Test has been cancelled');
            }
            
            // First, try to reactivate existing inactive participant with same name
            const reactivateResult = await Test.findOneAndUpdate(
                {
                    testCode: testCode,
                    status: 'waiting',
                    'participants.name': participantName,
                    'participants.isActive': false
                },
                {
                    $set: {
                        'participants.$.socketId': socketId,
                        'participants.$.isActive': true,
                        'participants.$.joinedAt': new Date()
                    }
                },
                { 
                    new: true,
                    populate: { path: 'quizId' }
                }
            );
            
            if (reactivateResult) {
                const participant = reactivateResult.participants.find(p => p.name === participantName && p.isActive);
                
                return {
                    test: reactivateResult,
                    participant,
                    waitingRoom: this.getWaitingRoomData(reactivateResult)
                };
            }
            
            // If no inactive participant found, try to add new participant
            const addResult = await Test.findOneAndUpdate(
                {
                    testCode: testCode,
                    status: 'waiting',
                    $expr: { 
                        $and: [
                            { $lt: [{ $size: { $filter: { input: '$participants', as: 'p', cond: '$$p.isActive' } } }, '$maxParticipants'] },
                            { $not: { $in: [participantName, { $map: { input: { $filter: { input: '$participants', as: 'p', cond: '$$p.isActive' } }, as: 'ap', in: '$$ap.name' } }] } }
                        ]
                    }
                },
                {
                    $push: {
                        participants: {
                            name: participantName,
                            socketId: socketId,
                            score: 0,
                            answers: [],
                            joinedAt: new Date(),
                            isActive: true
                        }
                    }
                },
                { 
                    new: true,
                    populate: { path: 'quizId' }
                }
            );
            
            if (!addResult) {
                // Get current test state to provide specific error
                const currentTest = await Test.findOne({ testCode });
                if (!currentTest) {
                    throw new Error('Test not found');
                }
                if (currentTest.status !== 'waiting') {
                    throw new Error('Test has already started');
                }
                
                const activeParticipants = currentTest.participants.filter(p => p.isActive);
                if (activeParticipants.length >= currentTest.maxParticipants) {
                    throw new Error('Test is full');
                }
                if (activeParticipants.some(p => p.name === participantName)) {
                    throw new Error('Name already taken');
                }
                
                console.error('Join test failed with conditions:', {
                    testCode,
                    participantName,
                    status: currentTest.status,
                    activeCount: activeParticipants.length,
                    maxParticipants: currentTest.maxParticipants,
                    nameExists: activeParticipants.some(p => p.name === participantName)
                });
                
                throw new Error('Unable to join test. Please try again.');
            }
            
            const participant = addResult.participants[addResult.participants.length - 1];
            
            return {
                test: addResult,
                participant,
                waitingRoom: this.getWaitingRoomData(addResult)
            };
            
        } catch (error) {
            console.error('Join test error:', error);
            throw error;
        }
    }
    
    /**
     * Leave test - FIXED with atomic operation
     */
    async leaveTest(testCode, socketId) {
        try {
            const updateResult = await Test.updateOne(
                { 
                    testCode: testCode,
                    'participants.socketId': socketId 
                },
                { 
                    $set: { 'participants.$.isActive': false } 
                }
            );
            
            if (updateResult.modifiedCount > 0) {
                return true;
            }
            
            return false;
        } catch (error) {
            console.error('Leave test error:', error);
            return false;
        }
    }
    
    /**
     * Start test (admin only) - FIXED with atomic operation
     */
    async startTest(testCode, adminSocketId) {
        try {
            // First get test to verify admin
            const test = await this.getTestByCode(testCode);
            
            // Verify admin
            if (test.adminSocketId !== adminSocketId) {
                throw new Error('Unauthorized: Only the test creator can start the test');
            }
            
            // Update test status atomically
            const updateResult = await Test.findOneAndUpdate(
                {
                    testCode: testCode,
                    status: 'waiting',
                    adminSocketId: adminSocketId,
                    $expr: { $gt: [{ $size: { $filter: { input: '$participants', as: 'p', cond: '$$p.isActive' } } }, 0] }
                },
                {
                    $set: {
                        status: 'active',
                        currentQuestion: 0,
                        isQuestionActive: false
                    }
                },
                { 
                    new: true,
                    populate: { path: 'quizId' }
                }
            );
            
            if (!updateResult) {
                // Get current state for specific error
                const currentTest = await Test.findOne({ testCode });
                if (!currentTest) {
                    throw new Error('Test not found');
                }
                if (currentTest.status !== 'waiting') {
                    throw new Error('Test has already started or completed');
                }
                if (currentTest.getActiveParticipants().length === 0) {
                    throw new Error('Cannot start test with no participants');
                }
                throw new Error('Failed to start test');
            }
            
            return updateResult;
        } catch (error) {
            console.error('Start test error:', error);
            throw error;
        }
    }
    
    /**
     * Start question (admin only) - FIXED with atomic operation
     */
    async startQuestion(testCode, questionNumber, adminSocketId) {
        try {
            const updateResult = await Test.findOneAndUpdate(
                {
                    testCode: testCode,
                    status: 'active',
                    adminSocketId: adminSocketId
                },
                {
                    $set: {
                        currentQuestion: questionNumber,
                        isQuestionActive: true,
                        questionStartTime: new Date()
                    }
                },
                { 
                    new: true,
                    populate: { path: 'quizId' }
                }
            );
            
            if (!updateResult) {
                throw new Error('Test not found or unauthorized');
            }
            
            return updateResult;
        } catch (error) {
            console.error('Start question error:', error);
            throw error;
        }
    }
    
    /**
     * End question (admin only) - FIXED with atomic operation
     */
    async endQuestion(testCode, adminSocketId) {
        try {
            const updateResult = await Test.findOneAndUpdate(
                {
                    testCode: testCode,
                    adminSocketId: adminSocketId
                },
                {
                    $set: {
                        isQuestionActive: false
                    }
                },
                { 
                    new: true,
                    populate: { path: 'quizId' }
                }
            );
            
            if (!updateResult) {
                throw new Error('Test not found or unauthorized');
            }
            
            return updateResult;
        } catch (error) {
            console.error('End question error:', error);
            throw error;
        }
    }
    
    /**
     * Submit answer (participant) - COMPLETELY FIXED with proper validation
     */
    async submitAnswer(testCode, socketId, questionNumber, selectedAnswer, timeRemaining) {
        try {
            const test = await this.getTestByCode(testCode);
            
            // Get quiz data to validate answer
            const quiz = test.quizId;
            if (!quiz.questions || questionNumber >= quiz.questions.length) {
                throw new Error('Invalid question number');
            }
            
            const question = quiz.questions[questionNumber];
            const isCorrect = question.correctAnswer === selectedAnswer;
            
            // Calculate points
            const points = this.calculatePoints(selectedAnswer, timeRemaining, questionNumber, question);
            
            const answer = {
                questionNumber: questionNumber,
                selectedAnswer: selectedAnswer,
                isCorrect: isCorrect,
                answerTime: (question.answerTime || 30) - timeRemaining,
                timeRemaining: timeRemaining,
                points: points
            };
            
            // Check current state first for better error messages
            const currentTest = await Test.findOne({ testCode }).lean();
            const participant = currentTest.participants.find(p => p.socketId === socketId);
            
            if (!participant) {
                throw new Error('Participant not found');
            }
            
            if (!participant.isActive) {
                throw new Error('Participant is not active');
            }
            
            if (currentTest.currentQuestion !== questionNumber) {
                throw new Error(`Wrong question - current is ${currentTest.currentQuestion}, submitted ${questionNumber}`);
            }
            
            if (!currentTest.isQuestionActive) {
                throw new Error('Question is not active');
            }
            
            // Check if already answered - FIXED to properly check nested array
            const alreadyAnswered = participant.answers.some(a => a.questionNumber === questionNumber);
            if (alreadyAnswered) {
                throw new Error('Already answered this question');
            }
            
            // Simple atomic update without complex conditions
            const updateResult = await Test.findOneAndUpdate(
                {
                    testCode: testCode,
                    'participants.socketId': socketId
                },
                {
                    $push: { 'participants.$.answers': answer },
                    $inc: { 'participants.$.score': points }
                },
                { new: true }
            );
            
            if (!updateResult) {
                // More detailed error checking
                const latestTest = await Test.findOne({ testCode });
                console.error('Submit answer failed - current state:', {
                    testCode,
                    currentQuestion: latestTest.currentQuestion,
                    isQuestionActive: latestTest.isQuestionActive,
                    participantFound: !!latestTest.participants.find(p => p.socketId === socketId),
                    questionNumber
                });
                throw new Error('Cannot submit answer - test state changed');
            }
            
            // Find updated participant
            const updatedParticipant = updateResult.participants.find(p => p.socketId === socketId);
            
            return {
                isCorrect,
                points,
                newScore: updatedParticipant.score,
                updatedAnswers: updatedParticipant.answers,
                socketId,
                participant: {
                    socketId: updatedParticipant.socketId,
                    answers: updatedParticipant.answers,
                    score: updatedParticipant.score
                }
            };
            
        } catch (error) {
            console.error('Submit answer error:', error.message);
            throw error;
        }
    }
    
    /**
     * Complete test - FIXED with atomic operation
     */
    async completeTest(testCode, adminSocketId) {
        try {
            // First get the test data to calculate final results
            const test = await this.getTestByCode(testCode);
            
            // Verify admin
            if (test.adminSocketId !== adminSocketId) {
                throw new Error('Unauthorized');
            }
            
            // Calculate final results
            const activeParticipants = test.getActiveParticipants();
            const finalResults = activeParticipants
                .sort((a, b) => b.score - a.score)
                .map((participant, index) => ({
                    rank: index + 1,
                    name: participant.name,
                    score: participant.score,
                    correctAnswers: participant.answers.filter(a => a.isCorrect).length,
                    totalQuestions: participant.answers.length,
                    completionTime: Math.round((new Date() - participant.joinedAt) / 1000)
                }));
            
            // Atomic update
            const updateResult = await Test.findOneAndUpdate(
                {
                    testCode: testCode,
                    adminSocketId: adminSocketId
                },
                {
                    $set: {
                        status: 'completed',
                        isQuestionActive: false,
                        finalResults: finalResults
                    }
                },
                { 
                    new: true,
                    populate: { path: 'quizId' }
                }
            );
            
            if (!updateResult) {
                throw new Error('Test not found or unauthorized');
            }
            
            console.log(`🏁 Test ${testCode} completed`);
            
            return updateResult;
        } catch (error) {
            console.error('Complete test error:', error);
            throw error;
        }
    }
    
    /**
     * Set admin socket ID - NEW atomic operation
     */
    async setAdminSocketId(testCode, adminSocketId) {
        try {
            const updateResult = await Test.updateOne(
                { testCode: testCode },
                { $set: { adminSocketId: adminSocketId } }
            );
            
            return updateResult.modifiedCount > 0;
        } catch (error) {
            console.error('Set admin socket ID error:', error);
            return false;
        }
    }
    
    /**
     * Helper method to calculate points
     */
    calculatePoints(selectedAnswer, timeRemaining, questionNumber, question) {
        const isCorrect = question.correctAnswer === selectedAnswer;
        if (!isCorrect) return 0;
        
        const questionTime = question.answerTime || 30;
        const timePercentage = timeRemaining / questionTime;
        
        // Base points (10) + time bonus (up to 10 more)
        return Math.round(10 + (10 * timePercentage));
    }
    
    /**
     * Get test statistics for question
     */
    getQuestionStats(test, questionNumber) {
        const participants = test.getActiveParticipants();
        const answers = participants
            .map(p => p.answers.find(a => a.questionNumber === questionNumber))
            .filter(Boolean);
            
        const stats = {
            totalAnswers: answers.length,
            totalParticipants: participants.length,
            answerDistribution: {},
            correctAnswers: 0
        };
        
        // Count answers for each option
        answers.forEach(answer => {
            stats.answerDistribution[answer.selectedAnswer] = 
                (stats.answerDistribution[answer.selectedAnswer] || 0) + 1;
                
            if (answer.isCorrect) {
                stats.correctAnswers++;
            }
        });
        
        return stats;
    }
    
    /**
     * Get waiting room data
     */
    getWaitingRoomData(test) {
        const activeParticipants = test.getActiveParticipants();
        
        return {
            testCode: test.testCode,
            status: test.status,
            participantCount: activeParticipants.length,
            maxParticipants: test.maxParticipants,
            participants: activeParticipants.slice(0, 10).map(p => ({ // First 10 only
                name: p.name,
                joinedAt: p.joinedAt,
                score: p.score || 0,
                isActive: p.isActive
            })),
            quiz: test.quizId ? {
                title: test.quizId.title,
                questionCount: test.quizId.questions ? test.quizId.questions.length : 0
            } : null
        };
    }
    
    /**
     * Generate join link
     */
    generateJoinLink(testCode) {
        const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
        return `${baseUrl}/test/join/${testCode}`;
    }
    
    /**
     * Generate QR code
     */
    async generateQRCode(testCode) {
        try {
            const joinLink = this.generateJoinLink(testCode);
            const qrCodeDataURL = await QRCode.toDataURL(joinLink, {
                width: 200,
                margin: 2,
                color: {
                    dark: '#1f2937',
                    light: '#ffffff'
                }
            });
            return qrCodeDataURL;
        } catch (error) {
            console.error('QR code generation error:', error);
            return null;
        }
    }
    
    /**
     * Clean up expired tests
     */
    async cleanupExpiredTests() {
        try {
            const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
            
            const result = await Test.deleteMany({
                $or: [
                    { status: 'completed', updatedAt: { $lt: oneDayAgo } },
                    { status: 'cancelled', updatedAt: { $lt: oneDayAgo } },
                    { 
                        mode: 'offline',
                        'scheduleSettings.endTime': { $lt: new Date() },
                        updatedAt: { $lt: oneDayAgo }
                    }
                ]
            });
            
            if (result.deletedCount > 0) {
                console.log(`🧹 Cleaned up ${result.deletedCount} expired tests`);
            }
            
            return result.deletedCount;
        } catch (error) {
            console.error('Cleanup error:', error);
            return 0;
        }
    }
    
    /**
     * Get test results
     */
    async getTestResults(testCode) {
        try {
            const test = await this.getTestByCode(testCode);
            
            if (test.status !== 'completed') {
                throw new Error('Test is not completed yet');
            }
            
            return {
                testCode: test.testCode,
                quiz: {
                    title: test.quizId.title,
                    number: test.quizNumber
                },
                completedAt: test.updatedAt,
                participantCount: test.getActiveParticipants().length,
                results: test.finalResults
            };
        } catch (error) {
            console.error('Get test results error:', error);
            throw error;
        }
    }
}

module.exports = new TestService();