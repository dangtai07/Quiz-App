const Quiz = require('../models/quiz.model');
const fs = require('fs');
const path = require('path');

class QuizService {
    async createQuiz(quizData, files) {
        try {
            const quizInfo = JSON.parse(quizData.quizInfo);
            const questionsData = JSON.parse(quizData.questionsData);
            
            // Process images and save paths
            // In your createQuiz method, replace the image processing section with this:

            // Process images and save paths
            const processedQuestions = questionsData.map(question => {
                const imageKey = `questionImage_${question.number}`;
                // Find file where fieldname matches imageKey
                const imageFile = files ? Object.values(files).flat().find(f => f.fieldname === imageKey) : null;
                let imagePath = null;
                
                if (imageFile && imageFile.path) {
                    try {
                        // Use the path from multer - handle both Windows and Unix paths
                        const pathParts = imageFile.path.split('public');
                        if (pathParts.length > 1) {
                            imagePath = '/' + pathParts[1].replace(/\\/g, '/');
                            // Remove leading slash if it exists
                            if (imagePath.startsWith('//')) {
                                imagePath = imagePath.substring(1);
                            }
                        }
                    } catch (error) {
                        console.error('Error processing image path:', error);
                        imagePath = null;
                    }
                }
                
                return {
                    number: question.number,
                    content: question.content,
                    type: question.type,
                    options: question.type === 'multiple_choice' ? question.options : [],
                    correctAnswer: question.correctAnswer || [],
                    image: imagePath
                };
            });
            
            // Create quiz document
            const quiz = new Quiz({
                title: quizInfo.title,
                mode: quizInfo.mode,
                language: quizInfo.language,
                scheduleSettings: quizInfo.mode === 'offline' ? quizInfo.scheduleSettings : null,
                questions: processedQuestions,
                // Add metadata for enhanced functionality
                createdBy: null, // You can add user ID here if available
                metadata: {
                    version: '1.0',
                    estimatedDuration: this.calculateEstimatedDuration(processedQuestions.length),
                    difficulty: this.calculateDifficulty(processedQuestions),
                    tags: this.extractTags(quizInfo.title),
                    lastModified: new Date()
                }
            });
            
            await quiz.save();
            return quiz;
            
        } catch (error) {
            // Delete uploaded files if error occurs
            if (files) {
                Object.keys(files).forEach(key => {
                    const file = files[key][0];
                    if (file && file.path) {
                        fs.unlink(file.path, err => {
                            if (err) console.error('Error deleting file:', err);
                        });
                    }
                });
            }
            throw new Error(`Error creating quiz: ${error.message}`);
        }
    }

    async getQuiz(id) {
        try {
            const quiz = await Quiz.findById(id);
            if (!quiz) {
                throw new Error('Quiz not found');
            }
            return quiz;
        } catch (error) {
            throw new Error(`Error getting quiz: ${error.message}`);
        }
    }

    async deleteQuiz(id) {
        try {
            const quiz = await Quiz.findById(id);
            if (!quiz) {
                throw new Error('Quiz not found');
            }

            // Delete associated images from local storage
            quiz.questions.forEach(question => {
                if (question.image) {
                    const imagePath = path.join(__dirname, '../public', question.image);
                    fs.unlink(imagePath, err => {
                        if (err) console.error('Error deleting image:', err);
                    });
                }
            });

            await Quiz.findByIdAndDelete(id);
            return { message: 'Quiz deleted successfully' };
        } catch (error) {
            throw new Error(`Error deleting quiz: ${error.message}`);
        }
    }

    async getAllQuizzes() {
        try {
            const quizzes = await Quiz.find()
                .select('title mode language questions scheduleSettings createdAt updatedAt metadata')
                .sort({ createdAt: -1 });

            return quizzes.map(quiz => {
                const quizObject = quiz.toObject();
                
                // Calculate enhanced statistics
                const questionCount = quiz.questions.length;
                const hasImages = quiz.questions.some(q => q.image);
                const multipleChoiceCount = quiz.questions.filter(q => q.type === 'multiple_choice').length;
                const textInputCount = quiz.questions.filter(q => q.type === 'text_input').length;
                
                // Calculate difficulty score (0-100)
                const difficultyScore = this.calculateDifficultyScore(quiz.questions);
                
                return {
                    ...quizObject,
                    questionCount: questionCount,
                    completedCount: 0, // TODO: Implement completion tracking
                    totalCount: 0,     // TODO: Implement participant counting
                    averageScore: 0,   // TODO: Implement score tracking
                    formattedDate: new Date(quiz.updatedAt).toLocaleDateString(),
                    // Enhanced metadata
                    hasImages: hasImages,
                    questionTypes: {
                        multipleChoice: multipleChoiceCount,
                        textInput: textInputCount
                    },
                    difficulty: this.getDifficultyLabel(difficultyScore),
                    difficultyScore: difficultyScore,
                    estimatedDuration: this.calculateEstimatedDuration(questionCount),
                    tags: quizObject.metadata?.tags || [],
                    isRecent: this.isRecentlyUpdated(quiz.updatedAt),
                    status: this.getQuizStatus(quiz)
                };
            });
        } catch (error) {
            throw new Error(`Error fetching quizzes: ${error.message}`);
        }
    }

    async updateQuiz(id, quizData, files) {
        try {
            const quiz = await Quiz.findById(id);
            if (!quiz) {
                throw new Error('Quiz not found');
            }

            const quizInfo = JSON.parse(quizData.quizInfo);
            const questionsData = JSON.parse(quizData.questionsData);
            
            // Process images and save paths
            const processedQuestions = questionsData.map(question => {
                const imageKey = `questionImage_${question.number}`;
                let imageFile = null;
                if (files && Array.isArray(files)) {
                    imageFile = files.find(f => f.fieldname === imageKey);
                } else if (files && typeof files === 'object') {
                    imageFile = Object.values(files).flat().find(f => f.fieldname === imageKey);
                }

                let imagePath = null;

                // If imageFile exists, process new upload
                if (imageFile && imageFile.path) {
                    try {
                        const pathParts = imageFile.path.split('public');
                        if (pathParts.length > 1 && pathParts[1]) {
                            imagePath = pathParts[1].replace(/\\/g, '/');
                            if (!imagePath.startsWith('/')) {
                                imagePath = '/' + imagePath;
                            }
                            imagePath = imagePath.replace(/\/+/g, '/');
                        } else {
                            const filename = path.basename(imageFile.path);
                            imagePath = `/uploads/quiz_images/${filename}`;
                        }
                        // Delete old image if exists
                        const oldQuestion = quiz.questions.find(q => q.number === question.number);
                        if (oldQuestion?.image) {
                            const oldImagePath = path.join(__dirname, '../public', oldQuestion.image);
                            fs.unlink(oldImagePath, err => {
                                if (err) console.log('Note: Could not delete old image:', err.message);
                            });
                        }
                    } catch (error) {
                        console.error('Error processing image path:', error);
                        imagePath = null;
                    }
                } else {
                    // Check if the image should be removed (frontend sends image: null or empty)
                    const existingQuestion = quiz.questions.find(q => q.number === question.number);
                    // If the incoming question.image is null/empty and there was an old image, remove it
                    if (
                        (!question.image || question.image === '' || question.image === null) &&
                        existingQuestion?.image
                    ) {
                        const oldImagePath = path.join(__dirname, '../public', existingQuestion.image);
                        fs.unlink(oldImagePath, err => {
                            if (err) console.log('Note: Could not delete removed image:', err.message);
                        });
                        imagePath = null;
                    } else {
                        // Otherwise, keep the existing image
                        imagePath = existingQuestion?.image || null;
                    }
                }

                return {
                    number: question.number,
                    content: question.content,
                    type: question.type,
                    options: question.type === 'multiple_choice' ? question.options : [],
                    correctAnswer: question.correctAnswer || [],
                    image: imagePath
                };
            });

            // Handle deleted questions' images
            quiz.questions.forEach(oldQuestion => {
                const stillExists = processedQuestions.some(q => q.number === oldQuestion.number);
                if (!stillExists && oldQuestion.image) {
                    const oldImagePath = path.join(__dirname, '../public', oldQuestion.image);
                    fs.unlink(oldImagePath, err => {
                        if (err) console.error('Error deleting removed question image:', err);
                    });
                }
            });

            // Update quiz document with enhanced metadata
            const updatedQuiz = await Quiz.findByIdAndUpdate(
                id,
                {
                    title: quizInfo.title,
                    mode: quizInfo.mode,
                    language: quizInfo.language,
                    scheduleSettings: quizInfo.mode === 'offline' ? quizInfo.scheduleSettings : null,
                    questions: processedQuestions,
                    'metadata.lastModified': new Date(),
                    'metadata.estimatedDuration': this.calculateEstimatedDuration(processedQuestions.length),
                    'metadata.difficulty': this.calculateDifficulty(processedQuestions),
                    'metadata.tags': this.extractTags(quizInfo.title)
                },
                {
                    new: true,
                    runValidators: true
                }
            );

            return updatedQuiz;

        } catch (error) {
            // Delete uploaded files if error occurs
            if (files) {
                const uploadedFiles = Object.values(files).flat();
                uploadedFiles.forEach(file => {
                    if (file && file.path) {
                        fs.unlink(file.path, err => {
                            if (err) console.error('Error deleting file:', err);
                        });
                    }
                });
            }
            throw new Error(`Error updating quiz: ${error.message}`);
        }
    }

    // Helper methods for enhanced functionality

    calculateEstimatedDuration(questionCount) {
        // Estimate 1-2 minutes per question
        const minutes = questionCount * 1.5;
        
        if (minutes < 60) {
            return `${Math.round(minutes)} min`;
        } else {
            const hours = Math.floor(minutes / 60);
            const remainingMinutes = Math.round(minutes % 60);
            return `${hours}h ${remainingMinutes}m`;
        }
    }

    calculateDifficulty(questions) {
        // Simple difficulty calculation based on question characteristics
        let score = 0;
        
        questions.forEach(question => {
            // Base difficulty
            score += 10;
            
            // Multiple choice is easier than text input
            if (question.type === 'text_input') {
                score += 15;
            }
            
            // More options = harder
            if (question.options && question.options.length > 3) {
                score += 5;
            }
            
            // Longer questions are harder
            if (question.content.length > 100) {
                score += 10;
            }
            
            // Questions with images might be easier (visual aids)
            if (question.image) {
                score -= 5;
            }
        });
        
        const averageScore = questions.length > 0 ? score / questions.length : 0;
        return this.getDifficultyLabel(averageScore);
    }

    calculateDifficultyScore(questions) {
        if (!questions || questions.length === 0) return 0;
        
        let totalScore = 0;
        
        questions.forEach(question => {
            let questionScore = 20; // Base score
            
            if (question.type === 'text_input') {
                questionScore += 30;
            }
            
            if (question.options && question.options.length > 3) {
                questionScore += 10;
            }
            
            if (question.content.length > 150) {
                questionScore += 15;
            }
            
            if (question.image) {
                questionScore -= 10; // Images might make it easier
            }
            
            totalScore += questionScore;
        });
        
        return Math.min(100, Math.max(0, Math.round(totalScore / questions.length)));
    }

    getDifficultyLabel(score) {
        if (score <= 25) return 'Easy';
        if (score <= 50) return 'Medium';
        if (score <= 75) return 'Hard';
        return 'Expert';
    }

    extractTags(title) {
        // Simple tag extraction from title
        const commonTags = [
            'math', 'science', 'history', 'english', 'geography', 
            'biology', 'chemistry', 'physics', 'literature', 'art',
            'technology', 'programming', 'business', 'economics'
        ];
        
        const titleLower = title.toLowerCase();
        return commonTags.filter(tag => titleLower.includes(tag));
    }

    isRecentlyUpdated(updatedAt) {
        const daysDiff = Math.floor((new Date() - new Date(updatedAt)) / (1000 * 60 * 60 * 24));
        return daysDiff <= 7;
    }

    getQuizStatus(quiz) {
        if (!quiz.scheduleSettings) {
            return 'active'; // Online quizzes are always active
        }
        
        const now = new Date();
        const startTime = new Date(quiz.scheduleSettings.startTime);
        const endTime = new Date(quiz.scheduleSettings.endTime);
        
        if (now < startTime) {
            return 'scheduled';
        } else if (now >= startTime && now <= endTime) {
            return 'active';
        } else {
            return 'expired';
        }
    }

    // New methods for enhanced functionality

    async getQuizStatistics(quizId) {
        try {
            const quiz = await Quiz.findById(quizId);
            if (!quiz) {
                throw new Error('Quiz not found');
            }

            // TODO: Implement real statistics from quiz results
            return {
                totalAttempts: 0,
                averageScore: 0,
                completionRate: 0,
                averageTime: 0,
                questionStats: quiz.questions.map(q => ({
                    questionNumber: q.number,
                    correctPercentage: 0,
                    averageTime: 0,
                    skipPercentage: 0
                }))
            };
        } catch (error) {
            throw new Error(`Error getting quiz statistics: ${error.message}`);
        }
    }

    async searchQuizzes(searchParams) {
        try {
            const { query, mode, language, difficulty, tags, sortBy = 'newest' } = searchParams;
            
            let mongoQuery = {};
            
            if (query) {
                mongoQuery.$or = [
                    { title: { $regex: query, $options: 'i' } },
                    { 'questions.content': { $regex: query, $options: 'i' } }
                ];
            }
            
            if (mode) {
                mongoQuery.mode = mode;
            }
            
            if (language) {
                mongoQuery.language = language;
            }
            
            if (difficulty) {
                mongoQuery['metadata.difficulty'] = difficulty;
            }
            
            if (tags && tags.length > 0) {
                mongoQuery['metadata.tags'] = { $in: tags };
            }
            
            let sortQuery = {};
            switch (sortBy) {
                case 'newest':
                    sortQuery = { createdAt: -1 };
                    break;
                case 'oldest':
                    sortQuery = { createdAt: 1 };
                    break;
                case 'name':
                    sortQuery = { title: 1 };
                    break;
                case 'questions':
                    sortQuery = { 'questions.length': -1 };
                    break;
                default:
                    sortQuery = { createdAt: -1 };
            }
            
            const quizzes = await Quiz.find(mongoQuery)
                .sort(sortQuery)
                .select('title mode language questions scheduleSettings createdAt updatedAt metadata');
            
            return quizzes;
        } catch (error) {
            throw new Error(`Error searching quizzes: ${error.message}`);
        }
    }

    async getQuizAnalytics() {
        try {
            const quizzes = await Quiz.find().select('title mode language questions createdAt updatedAt');
            
            const totalQuizzes = quizzes.length;
            const totalQuestions = quizzes.reduce((sum, quiz) => sum + quiz.questions.length, 0);
            
            const modeDistribution = quizzes.reduce((acc, quiz) => {
                acc[quiz.mode] = (acc[quiz.mode] || 0) + 1;
                return acc;
            }, {});
            
            const languageDistribution = quizzes.reduce((acc, quiz) => {
                acc[quiz.language] = (acc[quiz.language] || 0) + 1;
                return acc;
            }, {});
            
            const questionTypeDistribution = {};
            quizzes.forEach(quiz => {
                quiz.questions.forEach(question => {
                    questionTypeDistribution[question.type] = (questionTypeDistribution[question.type] || 0) + 1;
                });
            });
            
            const averageQuestionsPerQuiz = totalQuizzes > 0 ? Math.round(totalQuestions / totalQuizzes) : 0;
            
            const recentQuizzes = quizzes.filter(quiz => {
                const daysDiff = Math.floor((new Date() - new Date(quiz.createdAt)) / (1000 * 60 * 60 * 24));
                return daysDiff <= 30;
            }).length;
            
            return {
                overview: {
                    totalQuizzes,
                    totalQuestions,
                    averageQuestionsPerQuiz,
                    recentQuizzes
                },
                distributions: {
                    mode: modeDistribution,
                    language: languageDistribution,
                    questionType: questionTypeDistribution
                },
                trends: {
                    // TODO: Implement trend analysis
                    weeklyGrowth: 0,
                    monthlyGrowth: 0,
                    popularTimes: []
                }
            };
        } catch (error) {
            throw new Error(`Error getting quiz analytics: ${error.message}`);
        }
    }
}

module.exports = new QuizService();