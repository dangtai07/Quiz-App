// routes/auth.route.js
const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');

// GET login page
router.get('/login', authController.getLoginPage);

// POST login
router.post('/login', authController.login);

// GET logout
router.get('/logout', authController.logout);

module.exports = router;