// PriceWise - User model (Phase 4)
// MongoDB is the source of truth for user accounts.
// Only a bcrypt password hash is stored — never a plaintext password.

const mongoose = require('mongoose');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const userSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: [true, 'Please enter your name.'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters.'],
      maxlength: [100, 'Name must be at most 100 characters.']
    },
    firstName: {
      type: String,
      trim: true,
      default: ''
    },
    email: {
      type: String,
      required: [true, 'Please enter a valid email address.'],
      trim: true,
      lowercase: true,
      unique: true,
      match: [EMAIL_REGEX, 'Please enter a valid email address.']
    },
    passwordHash: {
      type: String,
      required: true,
      select: false
    }
  },
  { timestamps: true }
);

// Derive firstName from fullName when not provided explicitly.
// NOTE: synchronous hook style (no `next` callback) — Mongoose 9 removed
// support for callback-style middleware, where `next` would be undefined.
userSchema.pre('validate', function deriveFirstName() {
  if (!this.firstName && typeof this.fullName === 'string') {
    const first = this.fullName.trim().split(/\s+/)[0];
    this.firstName = first || '';
  }
});

module.exports = mongoose.models.User || mongoose.model('User', userSchema);
