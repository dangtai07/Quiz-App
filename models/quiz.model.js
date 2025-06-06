const mongoose = require('mongoose');

const optionSchema = new mongoose.Schema({
    letter: {
        type: String,
        required: true,
        enum: ['A', 'B', 'C', 'D', 'E', 'F'] // Mở rộng để hỗ trợ tối đa 6 lựa chọn
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
    // Loại bỏ type - mặc định tất cả đều là single choice
    image: {
        type: String
    },
    options: {
        type: [optionSchema],
        validate: {
            validator: function(options) {
                // Yêu cầu ít nhất 2 lựa chọn, tối đa 6 lựa chọn
                return options && options.length >= 2 && options.length <= 6;
            },
            message: 'Each question must have between 2 and 6 options'
        },
        default: function() {
            // Mặc định tạo 2 lựa chọn trống
            return [
                { letter: 'A', text: '' },
                { letter: 'B', text: '' }
            ];
        }
    },
    correctAnswer: {
        type: String, // Chỉ 1 đáp án đúng (single choice)
        required: true,
        enum: ['A', 'B', 'C', 'D', 'E', 'F']
    },
    // Thêm trường thời gian trả lời cho mỗi câu hỏi
    answerTime: {
        type: Number, // Thời gian tính bằng giây
        default: 30,  // Mặc định 30 giây
        min: 5,       // Tối thiểu 5 giây
        max: 300      // Tối đa 5 phút (300 giây)
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
    scheduleSettings: {
        startTime: Date,
        endTime: Date
    },
    questions: [questionSchema],
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    // Thêm metadata để tính tổng thời gian quiz
    metadata: {
        totalDuration: {
            type: Number, // Tổng thời gian của tất cả câu hỏi (giây)
            default: 0
        },
        version: {
            type: String,
            default: '2.0' // Version mới sau khi loại bỏ answer-type
        }
    }
}, {
    timestamps: true
});

// Pre-save middleware để tính tổng thời gian
quizSchema.pre('save', function(next) {
    if (this.questions && this.questions.length > 0) {
        this.metadata.totalDuration = this.questions.reduce((total, question) => {
            return total + (question.answerTime || 30);
        }, 0);
    }
    next();
});

module.exports = mongoose.model('Quiz', quizSchema);