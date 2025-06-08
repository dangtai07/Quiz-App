const mongoose = require('mongoose');

// Participant schema for test
const participantSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    socketId: {
        type: String,
        required: true
    },
    score: {
        type: Number,
        default: 0
    },
    answers: [{
        questionNumber: Number,
        selectedAnswer: String,
        isCorrect: Boolean,
        answerTime: Number, // Time taken to answer in seconds
        timeRemaining: Number, // Time remaining when answered
        points: Number // Points earned for this question
    }],
    joinedAt: {
        type: Date,
        default: Date.now
    },
    isActive: {
        type: Boolean,
        default: true
    }
});

// Test session schema
const testSchema = new mongoose.Schema({
    // Basic test info
    testCode: {
        type: String,
        unique: true,
        required: true,
        length: 6
    },
    quizId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Quiz',
        required: true
    },
    quizNumber: {
        type: Number,
        required: true
    },
    roomCode: {
        type: String,
        required: true,
        enum: ['hrm', 'hse', 'gm']
    },
    
    // Test configuration
    mode: {
        type: String,
        required: true,
        enum: ['online', 'offline']
    },
    maxParticipants: {
        type: Number,
        required: true,
        min: 1,
        max: 1000
    },
    
    // Schedule settings (for offline mode)
    scheduleSettings: {
        startTime: Date,
        endTime: Date
    },
    
    // Test state
    status: {
        type: String,
        enum: ['waiting', 'active', 'completed', 'cancelled'],
        default: 'waiting'
    },
    currentQuestion: {
        type: Number,
        default: 0
    },
    isQuestionActive: {
        type: Boolean,
        default: false
    },
    questionStartTime: Date,
    
    // Participants
    participants: [participantSchema],
    
    // Admin info
    adminSocketId: String,
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    
    // Results (saved after completion)
    finalResults: [{
        rank: Number,
        name: String,
        score: Number,
        correctAnswers: Number,
        totalQuestions: Number,
        completionTime: Number
    }]
}, {
    timestamps: true
});

// Generate unique 6-digit test code
testSchema.statics.generateTestCode = async function() {
    let code;
    let isUnique = false;
    
    while (!isUnique) {
        // Generate 6-digit code
        code = Math.floor(100000 + Math.random() * 900000).toString();
        
        // Check if code already exists
        const existingTest = await this.findOne({ testCode: code });
        if (!existingTest) {
            isUnique = true;
        }
    }
    
    return code;
};

// Method to add participant
testSchema.methods.addParticipant = function(name, socketId) {
    // Check if test is full
    if (this.participants.length >= this.maxParticipants) {
        throw new Error('Test is full');
    }
    
    // Check if test is still accepting participants
    if (this.status !== 'waiting') {
        throw new Error('Test has already started');
    }
    
    // Check if name already exists
    const existingParticipant = this.participants.find(p => p.name === name && p.isActive);
    if (existingParticipant) {
        throw new Error('Name already taken');
    }
    
    // Add participant
    this.participants.push({
        name: name,
        socketId: socketId,
        score: 0,
        answers: [],
        joinedAt: new Date(),
        isActive: true
    });
    
    return this.participants[this.participants.length - 1];
};

// Method to remove participant
testSchema.methods.removeParticipant = function(socketId) {
    const participantIndex = this.participants.findIndex(p => p.socketId === socketId);
    if (participantIndex > -1) {
        this.participants[participantIndex].isActive = false;
        return true;
    }
    return false;
};

// Method to get active participants
testSchema.methods.getActiveParticipants = function() {
    return this.participants.filter(p => p.isActive);
};

// Method to start test
testSchema.methods.startTest = function() {
    if (this.status !== 'waiting') {
        throw new Error('Test cannot be started');
    }
    
    this.status = 'active';
    this.currentQuestion = 0;
    this.isQuestionActive = false;
    
    return this;
};

// Method to start question
testSchema.methods.startQuestion = function(questionNumber) {
    this.currentQuestion = questionNumber;
    this.isQuestionActive = true;
    this.questionStartTime = new Date();
    
    return this;
};

// Method to end question
testSchema.methods.endQuestion = function() {
    this.isQuestionActive = false;
    return this;
};

// Method to submit answer
testSchema.methods.submitAnswer = function(socketId, questionNumber, selectedAnswer, timeRemaining) {
    console.log(this.participants);
    console.log(`Submitting answer for socketId: ${socketId}`);
    const participant = this.participants.find(p => p.socketId === socketId && p.isActive);
    if (!participant) {
        throw new Error('Participant not found');
    }
    
    // Check if question is still active
    if (!this.isQuestionActive || this.currentQuestion !== questionNumber) {
        throw new Error('Question is not active');
    }
    
    // Check if already answered this question
    const existingAnswer = participant.answers.find(a => a.questionNumber === questionNumber);
    if (existingAnswer) {
        throw new Error('Already answered this question');
    }
    
    // Calculate points (implement scoring logic here)
    const points = this.calculatePoints(selectedAnswer, timeRemaining, questionNumber);
    const isCorrect = this.checkAnswer(selectedAnswer, questionNumber);
    
    // Add answer
    participant.answers.push({
        questionNumber: questionNumber,
        selectedAnswer: selectedAnswer,
        isCorrect: isCorrect,
        answerTime: this.getQuestionTime() - timeRemaining,
        timeRemaining: timeRemaining,
        points: points
    });
    
    // Update score
    participant.score += points;
    
    return { isCorrect, points, newScore: participant.score };
};

// Helper method to calculate points
testSchema.methods.calculatePoints = function(selectedAnswer, timeRemaining, questionNumber) {
    const isCorrect = this.checkAnswer(selectedAnswer, questionNumber);
    if (!isCorrect) return 0;
    
    const questionTime = this.getQuestionTime(questionNumber);
    const timePercentage = timeRemaining / questionTime;
    
    // Base points (10) + time bonus (up to 10 more)
    return Math.round(10 + (10 * timePercentage));
};

// Helper method to check if answer is correct
testSchema.methods.checkAnswer = function(selectedAnswer, questionNumber) {
    // This would need to be populated with quiz data
    // For now, return false as placeholder
    return false;
};

// Helper method to get question time
testSchema.methods.getQuestionTime = function(questionNumber) {
    // This would need to be populated with quiz data
    // Default to 30 seconds
    return 30;
};

// Method to complete test
testSchema.methods.completeTest = function() {
    this.status = 'completed';
    this.isQuestionActive = false;
    
    // Generate final results
    const activeParticipants = this.getActiveParticipants();
    this.finalResults = activeParticipants
        .sort((a, b) => b.score - a.score)
        .map((participant, index) => ({
            rank: index + 1,
            name: participant.name,
            score: participant.score,
            correctAnswers: participant.answers.filter(a => a.isCorrect).length,
            totalQuestions: participant.answers.length,
            completionTime: Math.round((new Date() - participant.joinedAt) / 1000)
        }));
    
    return this;
};

// Method to get leaderboard
testSchema.methods.getLeaderboard = function(limit = 20) {
    const activeParticipants = this.getActiveParticipants();
    return activeParticipants
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map((participant, index) => ({
            rank: index + 1,
            name: participant.name,
            score: participant.score,
            correctAnswers: participant.answers.filter(a => a.isCorrect).length,
            isOnline: true // All participants in active test are online
        }));
};

// Index for better performance
testSchema.index({ testCode: 1 });
testSchema.index({ status: 1 });
testSchema.index({ quizId: 1 });
testSchema.index({ roomCode: 1 });
testSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Test', testSchema);