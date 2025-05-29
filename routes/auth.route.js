const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');

// GET login page
router.get('/login', authController.getLoginPage);

// POST login
router.post('/login', authController.login);

module.exports = router;