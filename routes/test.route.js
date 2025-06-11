const express = require('express');
const router = express.Router();
const TestController = require('../controllers/test.controller');
const { requireAuth, requireAdmin } = require('../controllers/auth.controller');

// ========================================
// PUBLIC ROUTES (No authentication required)
// ========================================

// Join test by direct link
router.get('/join/:testCode', TestController.renderJoinPage);

// Test room (both admin and participant)
router.get('/room/:testCode', TestController.renderTestRoom);

// Test results (public after completion)
router.get('/results/:testCode', TestController.renderTestResults);

// API: Get test results
router.get('/api/results/:testCode', TestController.getTestResults);

// API: Get live test data
router.get('/api/data/:testCode', TestController.getTestData);

// ========================================
// AUTHENTICATED ROUTES
// ========================================

// Join test by code page (for authenticated users)
router.get('/join', requireAuth, TestController.renderJoinByCode);

// MODIFIED: Validate
router.post('/validate', TestController.validateTestAvailability);

// Validate and join test (legacy support)
router.post('/join', TestController.validateAndJoinTest);

// ========================================
// ADMIN ROUTES
// ========================================

// Create new test
router.post('/create', requireAuth, requireAdmin, TestController.createTest);

module.exports = router;