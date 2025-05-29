const express = require('express');
const expressLayouts = require('express-ejs-layouts');
const path = require('path');
const app = express();
const connectDB = require('./config/db.mongdb.cloud');
const multer = require('multer');
require('dotenv').config();

// EJS setup
app.use(expressLayouts);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.set('layout', 'layouts/main');

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Kết nối MongoDB
connectDB();

// Routes
const quizRoutes = require('./routes/quiz.route');
app.use('/quizzes', quizRoutes);

app.get('/', (req, res) => {
  res.render('index', { title: 'Quiz App - MongoDB' });
});

// Error handling for file uploads
app.use((error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ 
                error: 'File is too large. Maximum size is 5MB' 
            });
        }
    }
    next(error);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server đang chạy tại http://localhost:${PORT}`);
});
