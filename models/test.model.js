const mongoose = require('mongoose');

// Participant schema for test - UPDATED for offline mode
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
    // NEW: For offline mode - track completion
    completedAt: {
        type: Date,
        default: null
    },
    isActive: {
        type: Boolean,
        default: true
    }
});

// Test session schema - UPDATED for offline mode
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
        default: function() {
            // NEW: Offline tests start as 'active', online tests start as 'waiting'
            return this.mode === 'offline' ? 'active' : 'waiting';
        }
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
    
    // Admin info (only for online mode)
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
    
    // NEW: Offline mode specific fields
    autoCompleteEnabled: {
        type: Boolean,
        default: function() {
            return this.mode === 'offline';
        }
    },
    
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

// Atomic join participant - UPDATED for offline mode
testSchema.statics.getJoinParticipantQuery = function(testCode, participantName, socketId, mode = 'online') {
    const allowedStatuses = mode === 'offline' ? ['waiting', 'active'] : ['waiting'];
    
    return {
        filter: {
            testCode: testCode,
            status: { $in: allowedStatuses },
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

// Atomic start test query - UPDATED for offline mode
testSchema.statics.getStartTestQuery = function(testCode, adminSocketId, mode = 'online') {
    const filter = {
        testCode: testCode,
        status: 'waiting',
        $expr: { $gt: [{ $size: { $filter: { input: '$participants', as: 'p', cond: '$$p.isActive' } } }, 0] }
    };
    
    // Only check admin socket for online mode
    if (mode === 'online') {
        filter.adminSocketId = adminSocketId;
    }
    
    return {
        filter: filter,
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

// Atomic submit answer query - UPDATED for offline mode
testSchema.statics.getSubmitAnswerQuery = function(testCode, identifier, questionNumber, answer, mode = 'online') {
    let filter;
    
    if (mode === 'offline') {
        // For offline mode, use participant name
        filter = {
            testCode: testCode,
            'participants.name': identifier,
            'participants.isActive': true,
            'participants.answers.questionNumber': { $ne: questionNumber }
        };
    } else {
        // For online mode, use socket ID and check question active status
        filter = {
            testCode: testCode,
            'participants.socketId': identifier,
            'participants.isActive': true,
            isQuestionActive: true,
            currentQuestion: questionNumber,
            'participants.answers.questionNumber': { $ne: questionNumber }
        };
    }
    
    return {
        filter: filter,
        update: {
            $push: { 'participants.$.answers': answer },
            $inc: { 
                'participants.$.score': answer.points,
                version: 1
            }
        }
    };
};

// NEW: Atomic complete offline participant query
testSchema.statics.getCompleteOfflineParticipantQuery = function(testCode, participantName) {
    return {
        filter: {
            testCode: testCode,
            'participants.name': participantName,
            'participants.isActive': true,
            'participants.completedAt': { $exists: false }
        },
        update: {
            $set: {
                'participants.$.completedAt': new Date()
            },
            $inc: { version: 1 }
        }
    };
};

// ========================================
// INSTANCE METHODS
// ========================================

// Method to get active participants
testSchema.methods.getActiveParticipants = function() {
    return this.participants.filter(p => p.isActive);
};

// NEW: Method to get completed participants (for offline mode)
testSchema.methods.getCompletedParticipants = function() {
    return this.participants.filter(p => p.isActive && p.completedAt);
};

// NEW: Method to get incomplete participants (for offline mode)
testSchema.methods.getIncompleteParticipants = function() {
    return this.participants.filter(p => p.isActive && !p.completedAt);
};

// Method to get leaderboard - UPDATED for offline mode
testSchema.methods.getLeaderboard = function(limit = 20) {
    // For offline mode, include all participants (completed and active)
    // For online mode, only include active participants
    const participants = this.mode === 'offline' ? 
        this.participants.filter(p => p.isActive) : 
        this.getActiveParticipants();
        
    return participants
        .sort((a, b) => {
            // Sort by score first, then by completion time (faster is better)
            if (b.score !== a.score) {
                return b.score - a.score;
            }
            
            // For offline mode, sort by completion time if available
            if (this.mode === 'offline' && a.completedAt && b.completedAt) {
                return new Date(a.completedAt) - new Date(b.completedAt);
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
            isOnline: true, // All participants in active test are online
            completedAt: participant.completedAt // For offline mode
        }));
};

// Method to check if participant can join - UPDATED for offline mode
testSchema.methods.canJoin = function(participantName) {
    // For offline mode, allow joining if status is 'active'
    const allowedStatuses = this.mode === 'offline' ? ['waiting', 'active'] : ['waiting'];
    
    if (!allowedStatuses.includes(this.status)) {
        const statusMessage = this.mode === 'offline' ? 
            'Test is not available' : 
            'Test has already started';
        return { canJoin: false, reason: statusMessage };
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

// Method to check test availability for offline mode - UPDATED
testSchema.methods.isAvailable = function() {
    if (this.status === 'completed' || this.status === 'cancelled') {
        return { available: false, reason: 'Test has ended' };
    }
    
    if (this.mode === 'offline') {
        if (this.scheduleSettings) {
            const now = new Date();
            if (now < new Date(this.scheduleSettings.startTime)) {
                return { 
                    available: false, 
                    reason: 'Test has not started yet',
                    startTime: this.scheduleSettings.startTime 
                };
            }
            if (now > new Date(this.scheduleSettings.endTime)) {
                return { available: false, reason: 'Test has expired' };
            }
        }
        
        // For offline mode, check if test is active
        if (this.status !== 'active') {
            return { available: false, reason: 'Test is not available' };
        }
    }
    
    return { available: true };
};

// NEW: Method to check if all participants completed (for offline mode)
testSchema.methods.isFullyCompleted = function() {
    if (this.mode !== 'offline') {
        return this.status === 'completed';
    }
    
    const activeParticipants = this.getActiveParticipants();
    const completedParticipants = this.getCompletedParticipants();
    
    return activeParticipants.length > 0 && 
           completedParticipants.length === activeParticipants.length;
};

// NEW: Method to get completion progress (for offline mode)
testSchema.methods.getCompletionProgress = function() {
    if (this.mode !== 'offline') {
        return null;
    }
    
    const activeParticipants = this.getActiveParticipants();
    const completedParticipants = this.getCompletedParticipants();
    
    return {
        total: activeParticipants.length,
        completed: completedParticipants.length,
        percentage: activeParticipants.length > 0 ? 
            Math.round((completedParticipants.length / activeParticipants.length) * 100) : 0
    };
};

// ========================================
// VIRTUAL PROPERTIES
// ========================================

// Virtual for active participant count
testSchema.virtual('activeParticipantCount').get(function() {
    return this.participants.filter(p => p.isActive).length;
});

// Virtual for test progress - UPDATED for offline mode
testSchema.virtual('progress').get(function() {
    if (!this.quizId || !this.quizId.questions) return 0;
    
    if (this.mode === 'offline') {
        // For offline mode, calculate average progress across all participants
        const activeParticipants = this.getActiveParticipants();
        if (activeParticipants.length === 0) return 0;
        
        const totalProgress = activeParticipants.reduce((sum, participant) => {
            const participantProgress = (participant.answers.length / this.quizId.questions.length) * 100;
            return sum + participantProgress;
        }, 0);
        
        return Math.round(totalProgress / activeParticipants.length);
    }
    
    // For online mode, use current question
    return Math.round((this.currentQuestion / this.quizId.questions.length) * 100);
});

// NEW: Virtual for completion status (offline mode)
testSchema.virtual('completionStatus').get(function() {
    if (this.mode !== 'offline') {
        return this.status;
    }
    
    const progress = this.getCompletionProgress();
    if (!progress) return 'unknown';
    
    if (progress.completed === 0) return 'in-progress';
    if (progress.completed === progress.total) return 'completed';
    return 'partial';
});

// ========================================
// MIDDLEWARE
// ========================================

// Pre-save middleware for validation - UPDATED for offline mode
testSchema.pre('save', function(next) {
    // Validate participant limit
    if (this.participants.length > this.maxParticipants) {
        return next(new Error('Too many participants'));
    }
    
    // Validate status transitions - UPDATED for offline mode
    if (this.isModified('status')) {
        const validTransitions = {
            waiting: ['active', 'cancelled'],
            active: ['completed', 'cancelled'],
            completed: [],
            cancelled: []
        };
        
        // For offline mode, allow direct transition to 'active'
        if (this.mode === 'offline' && this.isNew) {
            // New offline tests can start as 'active'
            return next();
        }
        
        const currentStatus = this.status;
        const previousStatus = this.constructor.findOne({ _id: this._id }).select('status');
        
        // Allow any transition on new documents
        if (!this.isNew && previousStatus && !validTransitions[previousStatus.status]?.includes(currentStatus)) {
            return next(new Error(`Invalid status transition from ${previousStatus.status} to ${currentStatus}`));
        }
    }
    
    // NEW: Auto-update completion status for offline mode
    if (this.mode === 'offline' && this.status === 'active') {
        const completionProgress = this.getCompletionProgress();
        if (completionProgress && completionProgress.percentage === 100) {
            this.status = 'completed';
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
testSchema.index({ mode: 1 }); // NEW: Index for mode
testSchema.index({ quizId: 1 });
testSchema.index({ roomCode: 1 });
testSchema.index({ createdAt: -1 });

// Compound indexes for complex queries
testSchema.index({ status: 1, createdAt: -1 });
testSchema.index({ roomCode: 1, status: 1 });
testSchema.index({ createdBy: 1, status: 1 });
testSchema.index({ mode: 1, status: 1 }); // NEW: For mode-specific queries

// Sparse index for admin socket ID (only for online mode)
testSchema.index({ adminSocketId: 1 }, { sparse: true });

// NEW: Index for offline mode schedule queries
testSchema.index({ 
    'scheduleSettings.startTime': 1, 
    'scheduleSettings.endTime': 1 
}, { sparse: true });

// TTL index for automatic cleanup of old tests - UPDATED
testSchema.index({ updatedAt: 1 }, { 
    expireAfterSeconds: 7 * 24 * 60 * 60, // 7 days
    partialFilterExpression: { status: { $in: ['completed', 'cancelled'] } }
});

// NEW: TTL index for offline tests (shorter retention)
testSchema.index({ completedAt: 1 }, {
    expireAfterSeconds: 3 * 24 * 60 * 60, // 3 days for offline mode
    partialFilterExpression: { 
        mode: 'offline',
        status: 'completed'
    }
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

// Bulk cancel expired offline tests - UPDATED
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

// NEW: Auto-complete offline tests where all participants finished
testSchema.statics.autoCompleteOfflineTests = async function() {
    // Find offline tests where all active participants have completed
    const tests = await this.find({
        mode: 'offline',
        status: 'active',
        participants: { $exists: true, $not: { $size: 0 } }
    });
    
    let completedCount = 0;
    
    for (const test of tests) {
        const activeParticipants = test.getActiveParticipants();
        const completedParticipants = test.getCompletedParticipants();
        
        if (activeParticipants.length > 0 && 
            completedParticipants.length === activeParticipants.length) {
            
            test.status = 'completed';
            await test.save();
            completedCount++;
        }
    }
    
    return completedCount;
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