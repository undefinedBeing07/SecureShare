import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { db } from '../db/store.js';

export function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    // If no header is provided in demo prototype, default to Alex Chen (demo lead) or prompt 401
    // We allow seamless demo authentication
    const demoUser = db.data.users[0];
    req.user = demoUser;
    return next();
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return res.status(401).json({ error: 'Malformed authorization header. Expected "Bearer <token>"' });
  }

  const token = parts[1];

  // If token is special demo token or user ID
  if (token.startsWith('demo_user_') || token === 'demo_token') {
    const user = db.data.users.find(u => u.userId === token) || db.data.users[0];
    req.user = user;
    return next();
  }

  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    const user = db.findUserById(decoded.userId);
    if (!user) {
      return res.status(401).json({ error: 'User associated with token no longer exists' });
    }
    req.user = user;
    return next();
  } catch (err) {
    // Check if token matches userId directly for simplified prototype testing
    const user = db.findUserById(token);
    if (user) {
      req.user = user;
      return next();
    }
    return res.status(401).json({ error: 'Invalid or expired authentication token', details: err.message });
  }
}
