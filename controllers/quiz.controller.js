const QuizService = require('../services/quiz.service');
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });

class QuizController {
    async createQuiz(req, res) {
        try {
            const quiz = await QuizService.createQuiz(req.body, req.files);
            res.status(201).json(quiz);
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: error.message });
        }
    }

    async getQuiz(req, res) {
        try {
            const quiz = await QuizService.getQuiz(req.params.id);
            res.json(quiz);
        } catch (error) {
            res.status(404).json({ error: error.message });
        }
    }

    async updateQuiz(req, res) {
        try {
          console.log(req.body);
            const updatedQuiz = await QuizService.updateQuiz(req.params.id, req.body, req.files);
            res.json(updatedQuiz);
        } catch (error) {
            console.error('Error updating quiz:', error);
            res.status(400).json({ error: error.message });
        }
    }

    async deleteQuiz(req, res) {
        try {
            const result = await QuizService.deleteQuiz(req.params.id);
            res.json(result);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    }

    renderCreateQuiz(req, res) {
        res.render('quiz/create', {
            title: 'Create New Quiz',
            style: '',
        });
    }

    async getQuizzes(req, res) {
        try {
            const quizzes = await QuizService.getAllQuizzes();
            res.render('quiz/list', {
                title: 'Quiz List',
                quizzes: quizzes,
                style: '',
                script: ''
            });
        } catch (error) {
            res.render('quiz/list', {
                title: 'Quiz List',
                quizzes: [],
                error: 'Failed to load quizzes',
                style: '',
                script: ''
            });
        }
    }

    async previewQuiz(req, res) {
        try {
            const quiz = await QuizService.getQuiz(req.params.id);

            res.render('quiz/preview', {
                title: 'Preview Quiz',
                quiz: quiz,
                isPreview: true
            });
        } catch (error) {
            res.status(404).render('error', {
                message: 'Quiz not found',
                error: error
            });
        }
    }

    async renderEditQuiz(req, res) {
        try {
            const quiz = await QuizService.getQuiz(req.params.id);
            res.render('quiz/edit', {
                title: 'Edit Quiz',
                quiz: quiz,
                questionCount: quiz.questions.length, // Add this
                style: '',
                script: ''
            });
        } catch (error) {
            console.error('Error loading quiz:', error);
            res.redirect('/quizzes');
        }
    }
}

module.exports = new QuizController();
