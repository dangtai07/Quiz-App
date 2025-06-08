const TestService = require('../services/test.service');

// In-memory storage for active tests and connections
const activeTests = new Map(); // testCode -> test data
const adminConnections = new Map(); // testCode -> admin socket
const participantConnections = new Map(); // testCode -> array of participant sockets

class TestSocketHandler {
    constructor(io) {
        this.io = io;
        this.setupSocketHandlers();
        
        // Cleanup interval (every 5 minutes)
        setInterval(() => {
            this.cleanupInactiveTests();
        }, 5 * 60 * 1000);
    }
    
    setupSocketHandlers() {
        this.io.on('connection', (socket) => {
            console.log(`🔌 Socket connected: ${socket.id}`);
            
            // ========================================
            // ADMIN EVENTS
            // ========================================
            
            // Admin joins test room
            socket.on('admin:join', async (data) => {
                try {
                    const { testCode, adminId } = data;
                    
                    // Validate admin and test
                    const test = await TestService.getTestByCode(testCode);
                    // if (test.createdBy.toString() !== adminId) {
                    //     socket.emit('error', { message: 'Unauthorized access' });
                    //     return;
                    // }
                    
                    // Store admin connection
                    adminConnections.set(testCode, socket);
                    socket.testCode = testCode;
                    socket.role = 'admin';
                    
                    // Store admin socket ID in test
                    test.adminSocketId = socket.id;
                    await test.save();
                    
                    // Join socket room
                    socket.join(`test_${testCode}`);
                    
                    // Send initial data
                    socket.emit('admin:joined', {
                        test: this.formatTestData(test),
                        waitingRoom: TestService.getWaitingRoomData(test)
                    });
                    
                    console.log(`👨‍💼 Admin joined test ${testCode}`);
                    
                } catch (error) {
                    console.error('Admin join error:', error);
                    socket.emit('error', { message: error.message });
                }
            });
            
            // Admin starts test
            socket.on('admin:start_test', async (data) => {
                try {
                    const { testCode } = data;
                    
                    const test = await TestService.startTest(testCode, socket.id);
                    
                    // Update active tests cache
                    activeTests.set(testCode, test);
                    
                    // Notify all participants
                    this.io.to(`test_${testCode}`).emit('test:started', {
                        test: this.formatTestData(test)
                    });
                    
                    console.log(`🚀 Test ${testCode} started`);
                    
                } catch (error) {
                    console.error('Start test error:', error);
                    socket.emit('error', { message: error.message });
                }
            });
            
            // Admin starts question
            socket.on('admin:start_question', async (data) => {
                try {
                    const { testCode, questionNumber } = data;
                    
                    const test = await TestService.startQuestion(testCode, questionNumber, socket.id);
                    
                    // Update cache
                    activeTests.set(testCode, test);
                    
                    // Get question data
                    const question = test.quizId.questions[questionNumber];
                    const questionTime = question.answerTime || 30;
                    
                    // Notify all participants
                    this.io.to(`test_${testCode}`).emit('question:started', {
                        questionNumber,
                        question: this.formatQuestionData(question, questionNumber),
                        timeLimit: questionTime,
                        startTime: Date.now()
                    });
                    
                    // Auto-end question after time limit
                    setTimeout(async () => {
                        try {
                            await this.endQuestion(testCode, socket.id);
                        } catch (error) {
                            console.error('Auto-end question error:', error);
                        }
                    }, questionTime * 1000);
                    
                    console.log(`❓ Question ${questionNumber} started in test ${testCode}`);
                    
                } catch (error) {
                    console.error('Start question error:', error);
                    socket.emit('error', { message: error.message });
                }
            });
            
            // Admin requests question stats
            socket.on('admin:get_question_stats', async (data) => {
                try {
                    const { testCode, questionNumber } = data;
                    const test = activeTests.get(testCode) || await TestService.getTestByCode(testCode);
                    
                    const stats = TestService.getQuestionStats(test, questionNumber);
                    
                    socket.emit('admin:question_stats', {
                        questionNumber,
                        stats
                    });
                    
                } catch (error) {
                    console.error('Get question stats error:', error);
                    socket.emit('error', { message: error.message });
                }
            });
            
            // Admin requests leaderboard
            socket.on('admin:get_leaderboard', async (data) => {
                try {
                    const { testCode } = data;
                    const test = activeTests.get(testCode) || await TestService.getTestByCode(testCode);
                    
                    const leaderboard = test.getLeaderboard(20);
                    
                    socket.emit('admin:leaderboard', {
                        leaderboard
                    });
                    
                } catch (error) {
                    console.error('Get leaderboard error:', error);
                    socket.emit('error', { message: error.message });
                }
            });
            
            // Admin completes test
            socket.on('admin:complete_test', async (data) => {
                try {
                    const { testCode } = data;
                    
                    const test = await TestService.completeTest(testCode, socket.id);
                    
                    // Remove from active tests
                    activeTests.delete(testCode);
                    
                    // Notify all participants
                    this.io.to(`test_${testCode}`).emit('test:completed', {
                        finalResults: test.finalResults
                    });
                    
                    console.log(`🏁 Test ${testCode} completed`);
                    
                } catch (error) {
                    console.error('Complete test error:', error);
                    socket.emit('error', { message: error.message });
                }
            });
            
            // ========================================
            // PARTICIPANT EVENTS
            // ========================================
            
            // Participant joins test
            socket.on('participant:join', async (data) => {
                try {
                    const { testCode, participantName } = data;
                    
                    const result = await TestService.joinTest(testCode, participantName, socket.id);
                    
                    // Store participant connection
                    if (!participantConnections.has(testCode)) {
                        participantConnections.set(testCode, []);
                    }
                    participantConnections.get(testCode).push(socket);
                    
                    socket.testCode = testCode;
                    socket.role = 'participant';
                    socket.participantName = participantName;
                    
                    // Join socket room
                    socket.join(`test_${testCode}`);
                    
                    // Send participant data
                    socket.emit('participant:joined', {
                        participant: result.participant,
                        test: this.formatTestData(result.test),
                        waitingRoom: result.waitingRoom
                    });
                    
                    // Update waiting room for admin
                    const adminSocket = adminConnections.get(testCode);
                    if (adminSocket) {
                        adminSocket.emit('admin:participant_joined', {
                            participant: result.participant,
                            waitingRoom: result.waitingRoom
                        });
                    }
                    
                    // Broadcast to other participants
                    socket.to(`test_${testCode}`).emit('participant:user_joined', {
                        participantName,
                        participantCount: result.waitingRoom.participantCount
                    });
                    
                    console.log(`👤 Participant "${participantName}" joined test ${testCode}`);
                    
                } catch (error) {
                    console.error('Participant join error:', error);
                    socket.emit('error', { message: error.message });
                }
            });
            
            // Participant submits answer
            socket.on('participant:submit_answer', async (data) => {
                try {
                    const { testCode, questionNumber, selectedAnswer, timeRemaining } = data;
                    
                    const result = await TestService.submitAnswer(
                        testCode, 
                        socket.id, 
                        questionNumber, 
                        selectedAnswer, 
                        timeRemaining
                    );
                    
                    // Send result to participant
                    socket.emit('participant:answer_submitted', {
                        questionNumber,
                        selectedAnswer,
                        isCorrect: result.isCorrect,
                        points: result.points,
                        newScore: result.newScore
                    });
                    
                    // Update admin stats
                    const adminSocket = adminConnections.get(testCode);
                    if (adminSocket) {
                        const test = activeTests.get(testCode) || await TestService.getTestByCode(testCode);
                        const stats = TestService.getQuestionStats(test, questionNumber);
                        
                        adminSocket.emit('admin:answer_submitted', {
                            participantName: socket.participantName,
                            questionNumber,
                            selectedAnswer,
                            stats
                        });
                    }
                    
                    console.log(`📝 Answer submitted by ${socket.participantName} in test ${testCode}`);
                    
                } catch (error) {
                    console.error('Submit answer error:', error);
                    socket.emit('error', { message: error.message });
                }
            });
            
            // ========================================
            // COMMON EVENTS
            // ========================================
            
            // Disconnect handling
            socket.on('disconnect', async () => {
                console.log(`🔌 Socket disconnected: ${socket.id}`);
                
                if (socket.testCode) {
                    if (socket.role === 'admin') {
                        adminConnections.delete(socket.testCode);
                        console.log(`👨‍💼 Admin left test ${socket.testCode}`);
                    } else if (socket.role === 'participant') {
                        // Remove from participant connections
                        const participants = participantConnections.get(socket.testCode);
                        if (participants) {
                            const index = participants.indexOf(socket);
                            if (index > -1) {
                                participants.splice(index, 1);
                            }
                        }
                        
                        // Mark as inactive in database
                        try {
                            await TestService.leaveTest(socket.testCode, socket.id);
                            
                            // Notify admin and other participants
                            socket.to(`test_${socket.testCode}`).emit('participant:user_left', {
                                participantName: socket.participantName
                            });
                            
                        } catch (error) {
                            console.error('Leave test error:', error);
                        }
                        
                        console.log(`👤 Participant "${socket.participantName}" left test ${socket.testCode}`);
                    }
                }
            });
            
            // Ping/Pong for connection health
            socket.on('ping', () => {
                socket.emit('pong');
            });
        });
    }
    
    // ========================================
    // HELPER METHODS
    // ========================================
    
    async endQuestion(testCode, adminSocketId) {
        try {
            const test = await TestService.endQuestion(testCode, adminSocketId);
            
            // Update cache
            activeTests.set(testCode, test);
            
            // Get question stats
            const stats = TestService.getQuestionStats(test, test.currentQuestion);
            
            // Notify all participants and admin
            this.io.to(`test_${testCode}`).emit('question:ended', {
                questionNumber: test.currentQuestion,
                stats,
                correctAnswer: test.quizId.questions[test.currentQuestion].correctAnswer
            });
            
            console.log(`⏹️ Question ${test.currentQuestion} ended in test ${testCode}`);
            
        } catch (error) {
            console.error('End question error:', error);
        }
    }
    
    formatTestData(test) {
        return {
            testCode: test.testCode,
            status: test.status,
            mode: test.mode,
            currentQuestion: test.currentQuestion,
            isQuestionActive: test.isQuestionActive,
            participantCount: test.getActiveParticipants().length,
            maxParticipants: test.maxParticipants,
            quiz: {
                title: test.quizId.title,
                number: test.quizNumber,
                questionCount: test.quizId.questions.length
            }
        };
    }
    
    formatQuestionData(question, questionNumber) {
        return {
            number: questionNumber + 1,
            content: question.content,
            image: question.image,
            options: question.options,
            answerTime: question.answerTime || 30
        };
    }
    
    cleanupInactiveTests() {
        // Remove disconnected admin connections
        for (const [testCode, socket] of adminConnections.entries()) {
            if (socket.disconnected) {
                adminConnections.delete(testCode);
                console.log(`🧹 Cleaned up admin connection for test ${testCode}`);
            }
        }
        
        // Remove disconnected participant connections
        for (const [testCode, participants] of participantConnections.entries()) {
            const activeParticipants = participants.filter(socket => !socket.disconnected);
            if (activeParticipants.length !== participants.length) {
                participantConnections.set(testCode, activeParticipants);
                console.log(`🧹 Cleaned up participant connections for test ${testCode}`);
            }
            
            if (activeParticipants.length === 0) {
                participantConnections.delete(testCode);
                activeTests.delete(testCode);
            }
        }
    }
}

module.exports = TestSocketHandler;