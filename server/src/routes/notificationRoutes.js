import express from 'express';
import { db } from '../db/store.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

// GET /api/notifications — List notifications for authenticated user
router.get('/', requireAuth, (req, res) => {
  const notifications = db.getNotifications(req.user.userId);
  const unreadCount = notifications.filter(n => !n.isRead).length;

  res.json({
    success: true,
    notifications,
    unreadCount
  });
});

// POST /api/notifications/read-all — Mark all user notifications as read
router.post('/read-all', requireAuth, (req, res) => {
  db.markAllNotificationsRead(req.user.userId);
  res.json({ success: true, message: 'All notifications marked as read.' });
});

// DELETE /api/notifications/:id — Dismiss a notification
router.delete('/:id', requireAuth, (req, res) => {
  const success = db.deleteNotification(req.user.userId, req.params.id);
  res.json({ success, message: success ? 'Notification dismissed' : 'Notification not found' });
});

export default router;
