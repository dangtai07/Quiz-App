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
    }],
    
    // Concurrency control - version field for optimistic locking
    version: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true,
    // Enable optimistic concurrency control
    optimisticConcurrency: true
});

// ========================================
// STATIC METHODS
// ========================================

// Generate unique 6-digit test code
testSchema.statics.generateTestCode = async function() {
    let code;
    let isUnique = false;
    let attempts = 0;
    const maxAttempts = 10;
    
    while (!isUnique && attempts < maxAttempts) {
        // Generate 6-digit code
        code = Math.floor(100000 + Math.random() * 900000).toString();
        
        // Check if code already exists using atomic operation
        const existingTest = await this.findOne({ testCode: code }).select('_id');
        if (!existingTest) {
            isUnique = true;
        }
        attempts++;
    }
    
    if (!isUnique) {
        throw new Error('Failed to generate unique test code after multiple attempts');
    }
    
    return code;
};

// ========================================
// ATOMIC OPERATION HELPERS
// ========================================

// Atomic join participant - returns filter and update objects
testSchema.statics.getJoinParticipantQuery = function(testCode, participantName, socketId) {
    return {
        filter: {
            testCode: testCode,
            status: 'waiting',
            $expr: { $lt: [{ $size: '$participants' }, '$maxParticipants'] },
            'participants.name': { $ne: participantName }
        },
        update: {
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
        }
    };
};

// Atomic start test query
testSchema.statics.getStartTestQuery = function(testCode, adminSocketId) {
    return {
        filter: {
            testCode: testCode,
            status: 'waiting',
            adminSocketId: adminSocketId,
            $expr: { $gt: [{ $size: { $filter: { input: '$participants', as: 'p', cond: '$$p.isActive' } } }, 0] }
        },
        update: {
            $set: {
                status: 'active',
                currentQuestion: 0,
                isQuestionActive: false
            },
            $inc: { version: 1 }
        }
    };
};

// Atomic start question query
testSchema.statics.getStartQuestionQuery = function(testCode, questionNumber, adminSocketId) {
    return {
        filter: {
            testCode: testCode,
            status: 'active',
            adminSocketId: adminSocketId
        },
        update: {
            $set: {
                currentQuestion: questionNumber,
                isQuestionActive: true,
                questionStartTime: new Date()
            },
            $inc: { version: 1 }
        }
    };
};

// Atomic submit answer query
testSchema.statics.getSubmitAnswerQuery = function(testCode, socketId, questionNumber, answer) {
    return {
        filter: {
            testCode: testCode,
            'participants.socketId': socketId,
            'participants.isActive': true,
            isQuestionActive: true,
            currentQuestion: questionNumber,
            'participants.answers.questionNumber': { $ne: questionNumber }
        },
        update: {
            $push: { 'participants.$.answers': answer },
            $inc: { 
                'participants.$.score': answer.points,
                version: 1
            }
        }
    };
};

// ========================================
// INSTANCE METHODS (for backward compatibility)
// ========================================

// Method to get active participants
testSchema.methods.getActiveParticipants = function() {
    return this.participants.filter(p => p.isActive);
};

// Method to get leaderboard
testSchema.methods.getLeaderboard = function(limit = 20) {
    const activeParticipants = this.getActiveParticipants();
    return activeParticipants
        .sort((a, b) => {
            // Sort by score first, then by completion time (faster is better)
            if (b.score !== a.score) {
                return b.score - a.score;
            }
            // If scores are equal, sort by average answer time (faster is better)
            const aAvgTime = a.answers.length > 0 ? 
                a.answers.reduce((sum, ans) => sum + ans.answerTime, 0) / a.answers.length : 0;
            const bAvgTime = b.answers.length > 0 ? 
                b.answers.reduce((sum, ans) => sum + ans.answerTime, 0) / b.answers.length : 0;
            return aAvgTime - bAvgTime;
        })
        .slice(0, limit)
        .map((participant, index) => ({
            rank: index + 1,
            name: participant.name,
            score: participant.score,
            correctAnswers: participant.answers.filter(a => a.isCorrect).length,
            totalAnswers: participant.answers.length,
            avgAnswerTime: participant.answers.length > 0 ? 
                Math.round(participant.answers.reduce((sum, ans) => sum + ans.answerTime, 0) / participant.answers.length) : 0,
            isOnline: true // All participants in active test are online
        }));
};

// Method to check if participant can join
testSchema.methods.canJoin = function(participantName) {
    if (this.status !== 'waiting') {
        return { canJoin: false, reason: 'Test has already started' };
    }
    
    if (this.participants.length >= this.maxParticipants) {
        return { canJoin: false, reason: 'Test is full' };
    }
    
    const nameExists = this.participants.some(p => p.name === participantName && p.isActive);
    if (nameExists) {
        return { canJoin: false, reason: 'Name already taken' };
    }
    
    return { canJoin: true };
};

// Method to check test availability for offline mode
testSchema.methods.isAvailable = function() {
    if (this.status === 'completed' || this.status === 'cancelled') {
        return { available: false, reason: 'Test has ended' };
    }
    
    if (this.mode === 'offline' && this.scheduleSettings) {
        const now = new Date();
        if (now < new Date(this.scheduleSettings.startTime)) {
            return { available: false, reason: 'Test has not started yet' };
        }
        if (now > new Date(this.scheduleSettings.endTime)) {
            return { available: false, reason: 'Test has expired' };
        }
    }
    
    return { available: true };
};

// ========================================
// VIRTUAL PROPERTIES
// ========================================

// Virtual for active participant count
testSchema.virtual('activeParticipantCount').get(function() {
    return this.participants.filter(p => p.isActive).length;
});

// Virtual for test progress
testSchema.virtual('progress').get(function() {
    if (!this.quizId || !this.quizId.questions) return 0;
    return Math.round((this.currentQuestion / this.quizId.questions.length) * 100);
});

// ========================================
// MIDDLEWARE
// ========================================

// Pre-save middleware for validation
testSchema.pre('save', function(next) {
    // Validate participant limit
    if (this.participants.length > this.maxParticipants) {
        return next(new Error('Too many participants'));
    }
    
    // Validate status transitions
    if (this.isModified('status')) {
        const validTransitions = {
            waiting: ['active', 'cancelled'],
            active: ['completed', 'cancelled'],
            completed: [],
            cancelled: []
        };
        
        const currentStatus = this.status;
        const previousStatus = this.constructor.findOne({ _id: this._id }).select('status');
        
        // Allow any transition on new documents
        if (!this.isNew && previousStatus && !validTransitions[previousStatus.status]?.includes(currentStatus)) {
            return next(new Error(`Invalid status transition from ${previousStatus.status} to ${currentStatus}`));
        }
    }
    
    next();
});

// Pre-update middleware to handle version increment
testSchema.pre(['updateOne', 'findOneAndUpdate'], function() {
    // Auto-increment version for concurrency control
    if (!this.getUpdate().$inc) {
        this.getUpdate().$inc = {};
    }
    if (!this.getUpdate().$inc.version) {
        this.getUpdate().$inc.version = 1;
    }
});

// ========================================
// INDEXES FOR PERFORMANCE
// ========================================

// Primary indexes
testSchema.index({ testCode: 1 }, { unique: true });
testSchema.index({ status: 1 });
testSchema.index({ quizId: 1 });
testSchema.index({ roomCode: 1 });
testSchema.index({ createdAt: -1 });

// Compound indexes for complex queries
testSchema.index({ status: 1, createdAt: -1 });
testSchema.index({ roomCode: 1, status: 1 });
testSchema.index({ createdBy: 1, status: 1 });

// Sparse index for admin socket ID
testSchema.index({ adminSocketId: 1 }, { sparse: true });

// TTL index for automatic cleanup of old tests
testSchema.index({ updatedAt: 1 }, { 
    expireAfterSeconds: 7 * 24 * 60 * 60, // 7 days
    partialFilterExpression: { status: { $in: ['completed', 'cancelled'] } }
});

// ========================================
// STATICS FOR BULK OPERATIONS
// ========================================

// Bulk cleanup inactive participants
testSchema.statics.cleanupInactiveParticipants = async function() {
    const result = await this.updateMany(
        { 
            status: { $in: ['waiting', 'active'] },
            'participants.isActive': false
        },
        {
            $pull: {
                participants: { isActive: false }
            }
        }
    );
    
    return result.modifiedCount;
};

// Bulk cancel expired offline tests
testSchema.statics.cancelExpiredTests = async function() {
    const now = new Date();
    const result = await this.updateMany(
        {
            mode: 'offline',
            status: { $in: ['waiting', 'active'] },
            'scheduleSettings.endTime': { $lt: now }
        },
        {
            $set: { status: 'cancelled' }
        }
    );
    
    return result.modifiedCount;
};

// ========================================
// ERROR HANDLING
// ========================================

// Handle unique constraint errors
testSchema.post('save', function(error, doc, next) {
    if (error.name === 'MongoError' && error.code === 11000) {
        if (error.keyPattern && error.keyPattern.testCode) {
            next(new Error('Test code already exists'));
        } else {
            next(new Error('Duplicate key error'));
        }
    } else {
        next(error);
    }
});

// Handle version conflicts
testSchema.post(['updateOne', 'findOneAndUpdate'], function(error, doc, next) {
    if (error.name === 'MongoError' && error.code === 16836) {
        next(new Error('Document was modified by another process. Please retry.'));
    } else {
        next(error);
    }
});

module.exports = mongoose.model('Test', testSchema);