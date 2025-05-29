const Quiz = require('../models/quiz.model');
const fs = require('fs');
const path = require('path');

class QuizService {
    async createQuiz(quizData, files) {
        try {
            const quizInfo = JSON.parse(quizData.quizInfo);
            const questionsData = JSON.parse(quizData.questionsData);
            
            // Process images and save paths
            const processedQuestions = questionsData.map(question => {
                const imageKey = `questionImage_${question.number}`;
                // Find file where fieldname matches imageKey
                const imageFile = files ? Object.values(files).flat().find(f => f.fieldname === imageKey) : null;
                let imagePath = null;
                
                if (imageFile) {
                    // Use the path from multer
                    imagePath = '/' + imageFile.path.split('public\\')[1].replace(/\\/g, '/');
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
                questions: processedQuestions
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
                .select('title mode language questions scheduleSettings createdAt updatedAt')
                .sort({ createdAt: -1 });

            return quizzes.map(quiz => ({
                ...quiz.toObject(),
                questionCount: quiz.questions.length,
                completedCount: 0, // TODO: Implement completion tracking
                totalCount: 0,     // TODO: Implement participant counting
                formattedDate: new Date(quiz.updatedAt).toLocaleDateString()
            }));
        } catch (error) {
            throw new Error(`Error fetching quizzes: ${error.message}`);
        }
    }

    async updateQuiz(id, quizData, files) {
        try {
            console.log('quizData:', quizData);
            const quiz = await Quiz.findById(id);
            if (!quiz) {
                throw new Error('Quiz not found');
            }

            const quizInfo = JSON.parse(quizData.quizInfo);
            const questionsData = JSON.parse(quizData.questionsData);

            // Process images and save paths
            const processedQuestions = questionsData.map(question => {
                const imageKey = `questionImage_${question.number}`;
                // Find file where fieldname matches imageKey
                const imageFile = files ? Object.values(files).flat().find(f => f.fieldname === imageKey) : null;
                let imagePath = null;

                // If there's a new image uploaded
                if (imageFile) {
                    imagePath = '/' + imageFile.path.split('public\\')[1].replace(/\\/g, '/');
                    
                    // Delete old image if exists
                    const oldQuestion = quiz.questions.find(q => q.number === question.number);
                    if (oldQuestion?.image) {
                        const oldImagePath = path.join(__dirname, '../public', oldQuestion.image);
                        fs.unlink(oldImagePath, err => {
                            if (err) console.error('Error deleting old image:', err);
                        });
                    }
                } else {
                    // Keep existing image if no new image uploaded
                    const existingQuestion = quiz.questions.find(q => q.number === question.number);
                    imagePath = existingQuestion?.image || null;
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

            // Update quiz document
            const updatedQuiz = await Quiz.findByIdAndUpdate(
                id,
                {
                    title: quizInfo.title,
                    mode: quizInfo.mode,
                    language: quizInfo.language,
                    scheduleSettings: quizInfo.mode === 'offline' ? quizInfo.scheduleSettings : null,
                    questions: processedQuestions
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
}

module.exports = new QuizService();
