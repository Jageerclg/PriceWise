// PriceWise - Authentication routes (Phase 4)
// Thin routes: authentication logic lives in services/auth-service.js.
// Responses NEVER contain password or passwordHash.

const express = require('express');
const { AuthService } = require('../services/auth-service');

const router = express.Router();
const authService = new AuthService();

const STATUS_BY_CODE = {
  VALIDATION_ERROR: 400,
  EMAIL_EXISTS: 409,
  INVALID_CREDENTIALS: 401,
  SERVER_ERROR: 500
};

function errorStatus(error) {
  if (error && error.code && STATUS_BY_CODE[error.code]) {
    return STATUS_BY_CODE[error.code];
  }
  return 500;
}

router.post('/signup', async (req, res) => {
  const { fullName, email, password } = req.body || {};
  const result = await authService.signup(fullName, email, password);

  if (!result.success) {
    return res.status(errorStatus(result.error)).json({
      success: false,
      error: result.error || { code: 'SERVER_ERROR', message: 'Account creation failed. Please try again.' }
    });
  }

  return res.status(201).json({
    success: true,
    user: result.user
  });
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  const result = await authService.login(email, password);

  if (!result.success) {
    return res.status(errorStatus(result.error)).json({
      success: false,
      error: result.error || { code: 'SERVER_ERROR', message: 'Login failed. Please try again.' }
    });
  }

  return res.json({
    success: true,
    user: result.user
  });
});

module.exports = router;
