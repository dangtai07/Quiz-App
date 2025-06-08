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
     * Join test as participant
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
            
            // Add participant
            const participant = test.addParticipant(participantName, socketId);
            await test.save();
            
            console.log(`👤 Participant "${participantName}" joined test ${testCode}`);
            
            return {
                test,
                participant,
                waitingRoom: this.getWaitingRoomData(test)
            };
            
        } catch (error) {
            console.error('Join test error:', error);
            throw error;
        }
    }
    
    /**
     * Leave test
     */
    async leaveTest(testCode, socketId) {
        try {
            const test = await Test.findOne({ testCode });
            if (!test) {
                return false;
            }
            
            const removed = test.removeParticipant(socketId);
            if (removed) {
                await test.save();
                console.log(`👋 Participant left test ${testCode}`);
            }
            
            return removed;
        } catch (error) {
            console.error('Leave test error:', error);
            return false;
        }
    }
    
    /**
     * Start test (admin only)
     */
    async startTest(testCode, adminSocketId) {
        try {
            const test = await this.getTestByCode(testCode);
            
            // Verify admin
            if (test.adminSocketId !== adminSocketId) {
                throw new Error('Unauthorized: Only the test creator can start the test');
            }
            
            // Check if test can be started
            if (test.getActiveParticipants().length === 0) {
                throw new Error('Cannot start test with no participants');
            }
            
            test.startTest();
            await test.save();
            
            console.log(`🚀 Test ${testCode} started by admin`);
            
            return test;
        } catch (error) {
            console.error('Start test error:', error);
            throw error;
        }
    }
    
    /**
     * Start question (admin only)
     */
    async startQuestion(testCode, questionNumber, adminSocketId) {
        try {
            const test = await this.getTestByCode(testCode);
            
            // Verify admin
            if (test.adminSocketId !== adminSocketId) {
                throw new Error('Unauthorized');
            }
            
            if (test.status !== 'active') {
                throw new Error('Test is not active');
            }
            
            test.startQuestion(questionNumber);
            await test.save();
            
            console.log(`❓ Question ${questionNumber} started in test ${testCode}`);
            
            return test;
        } catch (error) {
            console.error('Start question error:', error);
            throw error;
        }
    }
    
    /**
     * End question (admin only)
     */
    async endQuestion(testCode, adminSocketId) {
        try {
            const test = await this.getTestByCode(testCode);
            
            // Verify admin
            if (test.adminSocketId !== adminSocketId) {
                throw new Error('Unauthorized');
            }
            
            test.endQuestion();
            await test.save();
            
            console.log(`⏹️ Question ended in test ${testCode}`);
            
            return test;
        } catch (error) {
            console.error('End question error:', error);
            throw error;
        }
    }
    
    /**
     * Submit answer (participant)
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
            
            // Override the checkAnswer method with actual quiz data
            test.checkAnswer = function(answer, qNum) {
                const q = quiz.questions[qNum];
                return q && q.correctAnswer === answer;
            };
            
            test.getQuestionTime = function(qNum) {
                const q = quiz.questions[qNum];
                return q ? q.answerTime || 30 : 30;
            };
            
            const result = test.submitAnswer(socketId, questionNumber, selectedAnswer, timeRemaining);
            await Test.updateOne(
                { _id: test._id, 'participants.socketId': socketId },
                {
                    $set: {
                    'participants.$.answers': result.updatedAnswers,
                    'participants.$.score': result.newScore
                    }
                }
            );
            
            console.log(`📝 Answer submitted in test ${testCode}: ${selectedAnswer} (${result.isCorrect ? 'correct' : 'wrong'})`);
            
            return {
                ...result,
                participant: {
                    socketId: result.socketId,
                    answers: result.updatedAnswers,
                    score: result.newScore
                }
            };
            
        } catch (error) {
            console.error('Submit answer error:', error);
            throw error;
        }
    }
    
    /**
     * Complete test
     */
    async completeTest(testCode, adminSocketId) {
        try {
            const test = await this.getTestByCode(testCode);
            
            // Verify admin
            if (test.adminSocketId !== adminSocketId) {
                throw new Error('Unauthorized');
            }
            
            test.completeTest();
            await test.save();
            
            console.log(`🏁 Test ${testCode} completed`);
            
            return test;
        } catch (error) {
            console.error('Complete test error:', error);
            throw error;
        }
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
                joinedAt: p.joinedAt
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