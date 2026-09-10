// PriceWise - Authentication service (Phase 4)
// Business logic for MongoDB-backed signup/login.
// Follows the existing service-oriented architecture (see product-service.js):
// methods return plain result objects; routes map them to HTTP responses.
// Only bcrypt password hashes are stored — never plaintext passwords.

const bcrypt = require('bcryptjs');
const User = require('../models/User');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_PASSWORD_LENGTH = 128;

function getBcryptRounds() {
  const parsed = parseInt(process.env.BCRYPT_ROUNDS, 10);
  return Number.isInteger(parsed) && parsed >= 4 && parsed <= 15 ? parsed : 12;
}

function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

function deriveFirstName(fullName) {
  return fullName.trim().split(/\s+/)[0] || '';
}

/**
 * Project a User document to the safe shape returned to clients.
 * NEVER includes password or passwordHash.
 */
function toSafeUser(doc) {
  if (!doc) {
    return null;
  }
  return {
    id: String(doc._id),
    fullName: doc.fullName,
    firstName: doc.firstName || deriveFirstName(doc.fullName || ''),
    email: doc.email
  };
}

class AuthService {
  constructor({ userModel = User } = {}) {
    this.users = userModel;
  }

  validateName(fullName) {
    if (typeof fullName !== 'string' || fullName.trim().length === 0) {
      return { isValid: false, message: 'Please enter your name.' };
    }
    if (fullName.trim().length < 2) {
      return { isValid: false, message: 'Name must be at least 2 characters.' };
    }
    if (fullName.trim().length > 100) {
      return { isValid: false, message: 'Name must be at most 100 characters.' };
    }
    return { isValid: true, message: '' };
  }

  validateEmail(email) {
    if (typeof email !== 'string' || !EMAIL_REGEX.test(email.trim())) {
      return { isValid: false, message: 'Please enter a valid email address.' };
    }
    return { isValid: true, message: '' };
  }

  validatePassword(password) {
    if (typeof password !== 'string') {
      return { isValid: false, message: 'Password must be a string.' };
    }
    if (password.length < 8) {
      return { isValid: false, message: 'Password must be at least 8 characters.' };
    }
    if (password.length > MAX_PASSWORD_LENGTH) {
      return {
        isValid: false,
        message: `Password must be at most ${MAX_PASSWORD_LENGTH} characters.`
      };
    }
    return { isValid: true, message: '' };
  }

  async signup(fullName, email, password) {
    const nameValidation = this.validateName(fullName);
    if (!nameValidation.isValid) {
      return { success: false, error: { code: 'VALIDATION_ERROR', message: nameValidation.message } };
    }

    if (typeof email !== 'string') {
      return {
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Please enter a valid email address.' }
      };
    }
    const normalizedEmail = normalizeEmail(email);
    const emailValidation = this.validateEmail(normalizedEmail);
    if (!emailValidation.isValid) {
      return { success: false, error: { code: 'VALIDATION_ERROR', message: emailValidation.message } };
    }

    const passwordValidation = this.validatePassword(password);
    if (!passwordValidation.isValid) {
      return { success: false, error: { code: 'VALIDATION_ERROR', message: passwordValidation.message } };
    }

    try {
      // Layer 1: application-level duplicate check (friendly error).
      const existing = await this.users.findOne({ email: normalizedEmail });
      if (existing) {
        return {
          success: false,
          error: { code: 'EMAIL_EXISTS', message: 'An account with this email already exists.' }
        };
      }

      const trimmedName = fullName.trim();
      const passwordHash = await bcrypt.hash(password, getBcryptRounds());

      const created = await this.users.create({
        fullName: trimmedName,
        firstName: deriveFirstName(trimmedName),
        email: normalizedEmail,
        passwordHash
      });

      return { success: true, user: toSafeUser(created) };
    } catch (error) {
      // Layer 2: MongoDB unique-index backstop for race conditions.
      if (error && (error.code === 11000 || error.code === '11000')) {
        return {
          success: false,
          error: { code: 'EMAIL_EXISTS', message: 'An account with this email already exists.' }
        };
      }
      console.error('AuthService.signup failed:', error && error.message ? error.message : error);
      return {
        success: false,
        error: { code: 'SERVER_ERROR', message: 'Account creation failed. Please try again.' }
      };
    }
  }

  async login(email, password) {
    if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) {
      return {
        success: false,
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password.' }
      };
    }

    const normalizedEmail = normalizeEmail(email);
    if (!this.validateEmail(normalizedEmail).isValid) {
      return {
        success: false,
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password.' }
      };
    }

    try {
      // passwordHash is select:false in the schema, so select it explicitly.
      const user = await this.users.findOne({ email: normalizedEmail }).select('+passwordHash');
      if (!user || !user.passwordHash) {
        return {
          success: false,
          error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password.' }
        };
      }

      const matches = await bcrypt.compare(password, user.passwordHash);
      if (!matches) {
        return {
          success: false,
          error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password.' }
        };
      }

      return { success: true, user: toSafeUser(user) };
    } catch (error) {
      console.error('AuthService.login failed:', error && error.message ? error.message : error);
      return {
        success: false,
        error: { code: 'SERVER_ERROR', message: 'Login failed. Please try again.' }
      };
    }
  }
}

module.exports = { AuthService, toSafeUser, normalizeEmail };
