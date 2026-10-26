import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { sendOtpEmail } from './emailService.js';
import { db } from '../db/store.js';

// Configuration Constants
const OTP_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes
const RESEND_COOLDOWN_MS = 60 * 1000; // 60 seconds
const MAX_ATTEMPTS = 5; // Maximum incorrect guesses allowed
const MAX_HOURLY_REQUESTS = 5; // Maximum OTP generation attempts per hour per email
const VERIFICATION_TOKEN_EXPIRY = '15m'; // Valid for 15 minutes to complete registration form

// In-Memory store for active OTP verification records
// Map<normalizedEmail, OtpRecord>
const otpStore = new Map();

/**
 * Periodically purge expired records from memory every 10 minutes
 */
setInterval(() => {
  const now = Date.now();
  for (const [email, record] of otpStore.entries()) {
    if (now > record.expiresAt + 60000) {
      otpStore.delete(email);
    }
  }
}, 10 * 60 * 1000);

/**
 * Normalize an email address (trims surrounding whitespace and converts to lowercase)
 */
export function normalizeEmail(email) {
  if (!email || typeof email !== 'string') return '';
  return email.trim().toLowerCase();
}

/**
 * Validates email format using standard regex
 */
export function isValidEmail(email) {
  const norm = normalizeEmail(email);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(norm);
}

/**
 * Mask email address for user presentation (e.g., jo***@domain.com)
 */
export function maskEmail(email) {
  const norm = normalizeEmail(email);
  const parts = norm.split('@');
  if (parts.length !== 2) return norm;

  const [local, domain] = parts;
  if (local.length <= 2) {
    return `${local.charAt(0)}*@${domain}`;
  }
  return `${local.substring(0, 2)}***@${domain}`;
}

/**
 * Cryptographic HMAC hash of the OTP combined with email and secret
 */
function hashOtp(otp, email) {
  return crypto
    .createHmac('sha256', config.jwtSecret)
    .update(`${otp.trim()}:${normalizeEmail(email)}`)
    .digest('hex');
}

/**
 * Safe string comparison against timing attacks
 */
function safeCompare(a, b) {
  try {
    const bufA = Buffer.from(a, 'utf-8');
    const bufB = Buffer.from(b, 'utf-8');
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

export class OtpService {
  /**
   * Request and send a new 6-digit verification code to the target email
   */
  static async requestOtp(rawEmail) {
    const email = normalizeEmail(rawEmail);

    if (!isValidEmail(email)) {
      const err = new Error('Please provide a valid email address.');
      err.statusCode = 400;
      throw err;
    }

    // 1. Check whether an account already exists with this normalized email
    const existingUser = db.findUserByEmail(email);
    if (existingUser) {
      const err = new Error('This email is already registered. Please log in instead.');
      err.statusCode = 409;
      throw err;
    }

    const now = Date.now();
    const existingRecord = otpStore.get(email);

    // 2. Check 60-second resend cooldown
    if (existingRecord && now - existingRecord.lastSentAt < RESEND_COOLDOWN_MS) {
      const remainingSeconds = Math.ceil((RESEND_COOLDOWN_MS - (now - existingRecord.lastSentAt)) / 1000);
      const err = new Error(`Please wait ${remainingSeconds} second(s) before requesting another code.`);
      err.statusCode = 429;
      err.cooldownSeconds = remainingSeconds;
      throw err;
    }

    // 3. Hourly Rate Limiting
    let hourlyCount = 1;
    let windowStart = now;
    if (existingRecord && now - existingRecord.windowStart < 3600000) {
      windowStart = existingRecord.windowStart;
      hourlyCount = (existingRecord.hourlyCount || 0) + 1;
      if (hourlyCount > MAX_HOURLY_REQUESTS) {
        const err = new Error('Too many verification code requests. Please try again in an hour.');
        err.statusCode = 429;
        throw err;
      }
    }

    // 4. Generate cryptographically secure random 6-digit OTP
    const otp = crypto.randomInt(100000, 1000000).toString();
    const hashedOtp = hashOtp(otp, email);

    // 5. Invalidate previous OTP by overwriting the record
    otpStore.set(email, {
      email,
      hashedOtp,
      expiresAt: now + OTP_EXPIRY_MS,
      attempts: 0,
      maxAttempts: MAX_ATTEMPTS,
      lastSentAt: now,
      windowStart,
      hourlyCount,
    });

    // 6. Deliver OTP via email
    try {
      await sendOtpEmail(email, otp);
    } catch (err) {
      // If delivery failed, remove this OTP so an unsent code is never expected
      otpStore.delete(email);
      throw err;
    }

    return {
      success: true,
      email: maskEmail(email),
      cooldownSeconds: 60,
      expiresInSeconds: 300,
    };
  }

  /**
   * Verify an entered 6-digit OTP code
   */
  static verifyOtp(rawEmail, enteredOtp) {
    const email = normalizeEmail(rawEmail);

    if (!isValidEmail(email)) {
      const err = new Error('Please provide a valid email address.');
      err.statusCode = 400;
      throw err;
    }

    if (!enteredOtp || typeof enteredOtp !== 'string' || enteredOtp.trim().length !== 6) {
      const err = new Error('Please enter the complete 6-digit verification code.');
      err.statusCode = 400;
      throw err;
    }

    const record = otpStore.get(email);
    if (!record) {
      const err = new Error('No active verification code found for this email. Please request a new code.');
      err.statusCode = 400;
      throw err;
    }

    const now = Date.now();

    // Check expiration (5 minutes)
    if (now > record.expiresAt) {
      otpStore.delete(email);
      const err = new Error('Verification code has expired. Please request a new code.');
      err.statusCode = 400;
      throw err;
    }

    // Check attempts limit
    if (record.attempts >= record.maxAttempts) {
      otpStore.delete(email);
      const err = new Error('Too many incorrect attempts. This code has been invalidated. Please request a new code.');
      err.statusCode = 400;
      throw err;
    }

    // Compare hash
    const enteredHash = hashOtp(enteredOtp, email);
    const isMatch = safeCompare(enteredHash, record.hashedOtp);

    if (!isMatch) {
      record.attempts += 1;
      const remaining = record.maxAttempts - record.attempts;

      if (remaining <= 0) {
        otpStore.delete(email);
        const err = new Error('Too many incorrect attempts. This code has been invalidated. Please request a new code.');
        err.statusCode = 400;
        throw err;
      }

      const err = new Error(`Incorrect verification code. ${remaining} attempt(s) remaining.`);
      err.statusCode = 400;
      throw err;
    }

    // Successful verification! Invalidate the OTP immediately so it cannot be reused
    otpStore.delete(email);

    // Issue short-lived, server-signed verification token
    const verificationToken = OtpService.generateVerificationToken(email);

    return {
      success: true,
      message: 'Email verified successfully',
      verificationToken,
    };
  }

  /**
   * Helper to generate a signed verification token for verified email
   */
  static generateVerificationToken(rawEmail) {
    const email = normalizeEmail(rawEmail);
    return jwt.sign(
      {
        email,
        purpose: 'registration-email-verification',
        verifiedAt: Date.now(),
      },
      config.jwtSecret,
      { expiresIn: VERIFICATION_TOKEN_EXPIRY }
    );
  }

  /**
   * Validate a server-signed verification token before account creation
   */
  static verifyRegistrationToken(token, rawEmail) {
    if (!token || typeof token !== 'string') {
      const err = new Error('Email verification is required before registration. Please verify your email first.');
      err.statusCode = 403;
      throw err;
    }

    const email = normalizeEmail(rawEmail);

    let decoded;
    try {
      decoded = jwt.verify(token, config.jwtSecret);
    } catch {
      const err = new Error('Verification session has expired or is invalid. Please request a new verification code.');
      err.statusCode = 403;
      throw err;
    }

    if (decoded.purpose !== 'registration-email-verification') {
      const err = new Error('Invalid verification token purpose.');
      err.statusCode = 403;
      throw err;
    }

    if (normalizeEmail(decoded.email) !== email) {
      const err = new Error('Verification token does not match the provided email address.');
      err.statusCode = 403;
      throw err;
    }

    return true;
  }
}
