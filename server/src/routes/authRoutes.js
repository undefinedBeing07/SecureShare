import express from 'express';
import jwt from 'jsonwebtoken';
import { db } from '../db/store.js';
import { config } from '../config.js';
import { requireAuth } from '../middleware/auth.js';
import { OtpService, normalizeEmail, isValidEmail } from '../services/otpService.js';

const router = express.Router();

/**
 * POST /api/auth/send-otp
 * Step 1 of registration: Verifies email eligibility, generates secure 6-digit OTP,
 * and sends it via email delivery service.
 */
router.post('/send-otp', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email address is required' });
    }

    const normalizedEmail = normalizeEmail(email);

    if (!isValidEmail(normalizedEmail)) {
      return res.status(400).json({ error: 'Please enter a valid email address' });
    }

    // Check whether an account already exists before issuing OTP
    const existing = db.findUserByEmail(normalizedEmail);
    if (existing) {
      return res.status(409).json({ error: 'This email is already registered. Please log in instead.' });
    }

    const result = await OtpService.requestOtp(normalizedEmail);

    return res.json({
      message: 'Verification code sent to your email address',
      email: result.email,
      cooldownSeconds: result.cooldownSeconds,
      expiresInSeconds: result.expiresInSeconds,
    });
  } catch (err) {
    const status = err.statusCode || 500;
    return res.status(status).json({
      error: err.message,
      code: err.code || undefined,
      cooldownSeconds: err.cooldownSeconds || undefined,
    });
  }
});

/**
 * POST /api/auth/verify-otp
 * Step 2 of registration: Verifies the 6-digit OTP code against secure cryptographic hash,
 * enforce rate/attempts limits, and issues a short-lived server-signed verification token.
 */
router.post('/verify-otp', (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ error: 'Email and 6-digit verification code are required' });
    }

    const normalizedEmail = normalizeEmail(email);
    const result = OtpService.verifyOtp(normalizedEmail, otp);

    return res.json({
      message: result.message,
      verificationToken: result.verificationToken,
    });
  } catch (err) {
    const status = err.statusCode || 400;
    return res.status(status).json({ error: err.message });
  }
});

/**
 * POST /api/auth/login
 * Standard login with normalized email lookup
 */
router.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  const normalizedEmail = normalizeEmail(email);
  const user = db.findUserByEmail(normalizedEmail);
  if (!user) {
    return res.status(401).json({ error: 'User with this email not found' });
  }

  if (password && user.passwordHash && password !== user.passwordHash) {
    return res.status(401).json({ error: 'Invalid password' });
  }

  const token = jwt.sign(
    { userId: user.userId, email: user.email, displayName: user.displayName },
    config.jwtSecret,
    { expiresIn: '7d' }
  );

  db.logAudit({
    action: 'USER_LOGIN',
    ownerId: user.userId,
    status: 'SUCCESS',
    fileName: `Login: ${user.displayName} (${user.email})`,
  });

  db.addNotification({
    userId: user.userId,
    title: 'New Login Session',
    message: `Secure session authenticated for ${user.displayName} (${user.email}).`,
    type: 'security',
  });

  return res.json({
    message: 'Login successful',
    token,
    user: {
      userId: user.userId,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
    },
  });
});

/**
 * POST /api/auth/register
 * Step 3 of registration: Requires a valid server-issued verificationToken proving
 * that the email was successfully verified via OTP. Enforces unique index in MongoDB.
 */
router.post('/register', async (req, res) => {
  const { email, password, displayName, verificationToken } = req.body;
  if (!email || !displayName) {
    return res.status(400).json({ error: 'Email and Display Name are required' });
  }

  const normalizedEmail = normalizeEmail(email);

  if (!isValidEmail(normalizedEmail)) {
    return res.status(400).json({ error: 'Please enter a valid email address' });
  }

  // 1. Mandatory verification check - clients cannot bypass via flags like isVerified: true
  if (!verificationToken) {
    return res.status(403).json({
      error: 'Email verification is required before registration. Please verify your email first.',
    });
  }

  try {
    OtpService.verifyRegistrationToken(verificationToken, normalizedEmail);
  } catch (err) {
    return res.status(err.statusCode || 403).json({ error: err.message });
  }

  // 2. Check for duplicate accounts in database
  const existing = db.findUserByEmail(normalizedEmail);
  if (existing) {
    return res.status(409).json({ error: 'This email is already registered. Please log in instead.' });
  }

  const newUser = {
    userId: 'usr_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6),
    email: normalizedEmail,
    displayName: displayName.trim(),
    passwordHash: password || 'demo123',
    role: 'user',
    createdAt: new Date().toISOString(),
  };

  try {
    await db.addUser(newUser);
  } catch (err) {
    if (err.code === 11000 || (err.message && err.message.includes('already exists'))) {
      return res.status(409).json({ error: 'This email is already registered. Please log in instead.' });
    }
    return res.status(500).json({ error: 'Failed to create user account', message: err.message });
  }

  db.logAudit({
    action: 'USER_REGISTER',
    ownerId: newUser.userId,
    status: 'SUCCESS',
    fileName: `Registered: ${newUser.displayName} (${newUser.email})`,
  });

  db.addNotification({
    userId: newUser.userId,
    title: 'Welcome to Secure Share!',
    message: `Account created for ${newUser.displayName} (${newUser.email}). Your zero-trust vault is ready.`,
    type: 'success',
  });

  const token = jwt.sign(
    { userId: newUser.userId, email: newUser.email, displayName: newUser.displayName },
    config.jwtSecret,
    { expiresIn: '7d' }
  );

  return res.status(201).json({
    message: 'Registration successful',
    token,
    user: {
      userId: newUser.userId,
      email: newUser.email,
      displayName: newUser.displayName,
      role: newUser.role,
    },
  });
});

// GET /api/auth/me
router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

// GET /api/auth/demo-users - disabled for zero-trust privacy
router.get('/demo-users', (req, res) => {
  res.json({ users: [] });
});

export default router;
