const express = require('express');
const router = express.Router();
const QuizController = require('../controllers/quiz.controller');
const upload = require('../config/multer.config');

// Add new route for rendering create page
router.get('/create', QuizController.renderCreateQuiz);

// New route for getting all quizzes
router.get('/', QuizController.getQuizzes);

// Existing routes
router.post('/', upload.any(), QuizController.createQuiz);
router.get('/:id', QuizController.getQuiz);
router.get('/:id/preview', QuizController.previewQuiz);
router.get('/:id/edit', QuizController.renderEditQuiz);
router.put('/:id', upload.any(), QuizController.updateQuiz);
router.delete('/:id', QuizController.deleteQuiz);

module.exports = router;
