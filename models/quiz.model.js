const mongoose = require('mongoose');

const optionSchema = new mongoose.Schema({
    letter: {
        type: String,
        required: true,
        enum: ['A', 'B', 'C', 'D']
    },
    text: {
        type: String,
        required: true
    }
});

const questionSchema = new mongoose.Schema({
    number: {
        type: Number,
        required: true
    },
    content: {
        type: String,
        required: true
    },
    type: {
        type: String,
        required: true,
        enum: ['multiple_choice', 'text_input']
    },
    image: {
        type: String
    },
    options: {
        type: [optionSchema],
        validate: {
            validator: function(options) {
                return this.type !== 'multiple_choice' || (options && options.length > 0);
            },
            message: 'Multiple choice questions must have options'
        }
    },
    correctAnswer: {
        type: [String],
        default: []
    }
});

const quizSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true
    },
    mode: {
        type: String,
        required: true,
        enum: ['online', 'offline']
    },
    language: {
        type: String,
        required: true,
        enum: ['vietnamese', 'english']
    },
    scheduleSettings: {
        startTime: Date,
        endTime: Date
    },
    questions: [questionSchema],
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Quiz', quizSchema);
