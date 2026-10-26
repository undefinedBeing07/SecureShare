import fs from 'fs';
import path from 'path';
import { config } from '../config.js';
import { 
  connectMongo, 
  isMongoConnected, 
  syncLocalToMongo, 
  UserModel, 
  FileModel, 
  ShareModel, 
  AuditLogModel,
  NotificationModel
} from './mongo.js';

// Ensure data directory exists
if (!fs.existsSync(config.dataDir)) {
  fs.mkdirSync(config.dataDir, { recursive: true });
}

const dbFilePath = path.join(config.dataDir, 'db.json');

// Default initial database state with seed files & users
const initialData = {
  users: [
    {
      userId: 'usr_demo_01',
      email: 'admin@secureshare.io',
      displayName: 'Alex Chen',
      passwordHash: 'admin123',
      role: 'admin',
      createdAt: new Date().toISOString()
    },
    {
      userId: 'usr_demo_02',
      email: 'audit@secureshare.io',
      displayName: 'Enterprise Auditor',
      passwordHash: 'audit123',
      role: 'auditor',
      createdAt: new Date().toISOString()
    }
  ],
  files: [],
  shares: [],
  auditLogs: [],
  notifications: []
};

class Store {
  constructor() {
    this.data = this.load();
    if (!this.data.notifications) this.data.notifications = [];
    // Connect to MongoDB if configured, and auto-sync records whenever connected or restored
    connectMongo(() => {
      syncLocalToMongo(this.data);
    });
  }

  load() {
    try {
      if (fs.existsSync(dbFilePath)) {
        const raw = fs.readFileSync(dbFilePath, 'utf-8');
        return JSON.parse(raw);
      }
    } catch (err) {
      console.error('[Store] Failed to read db.json, using fallback initial data:', err.message);
    }
    this.save(initialData);
    return JSON.parse(JSON.stringify(initialData));
  }

  save(data = this.data) {
    try {
      fs.writeFileSync(dbFilePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (err) {
      console.error('[Store] Failed to write db.json:', err.message);
    }
  }

  // --- Files Collection ---
  getFiles(ownerId = null, includeDeleted = false) {
    if (!ownerId) {
      return this.data.files.filter(f => includeDeleted ? true : !f.isDeleted);
    }
    return this.data.files.filter(f => f.ownerId === ownerId && (includeDeleted ? true : !f.isDeleted));
  }

  getTrashFiles(ownerId = null) {
    if (!ownerId) {
      return this.data.files.filter(f => Boolean(f.isDeleted));
    }
    return this.data.files.filter(f => f.ownerId === ownerId && Boolean(f.isDeleted));
  }

  getFileById(fileId) {
    return this.data.files.find(f => f.fileId === fileId) || null;
  }

  addFile(fileRecord) {
    const record = {
      ...fileRecord,
      isDeleted: false,
      deletedAt: null
    };
    this.data.files.unshift(record);
    this.save();
    if (isMongoConnected()) {
      FileModel.findOneAndUpdate(
        { fileId: record.fileId },
        { ...record },
        { upsert: true, returnDocument: 'after' }
      ).catch(err => console.error('[MongoDB Error]', err.message));
    }
    this.logAudit({
      action: 'FILE_UPLOAD',
      fileId: record.fileId,
      fileName: record.fileName,
      ownerId: record.ownerId,
      status: record.scanStatus
    });
    return record;
  }

  updateFile(fileId, updates) {
    const idx = this.data.files.findIndex(f => f.fileId === fileId);
    if (idx === -1) return null;
    this.data.files[idx] = { ...this.data.files[idx], ...updates, updatedAt: new Date().toISOString() };
    this.save();
    if (isMongoConnected()) {
      FileModel.findOneAndUpdate({ fileId }, { ...updates }, { returnDocument: 'after' }).catch(err => console.error('[MongoDB Error]', err.message));
    }
    return this.data.files[idx];
  }

  softDeleteFile(fileId) {
    const file = this.getFileById(fileId);
    if (!file) return false;
    file.isDeleted = true;
    file.deletedAt = new Date().toISOString();
    // Remove active shares for trashed file so link is revoked
    this.data.shares = this.data.shares.filter(s => s.fileId !== fileId);
    this.save();
    if (isMongoConnected()) {
      FileModel.findOneAndUpdate(
        { fileId },
        { isDeleted: true, deletedAt: new Date(file.deletedAt) },
        { returnDocument: 'after' }
      ).catch(err => console.error('[MongoDB Error]', err.message));
      ShareModel.deleteMany({ fileId }).catch(err => console.error('[MongoDB Error]', err.message));
    }
    this.logAudit({
      action: 'FILE_TRASHED',
      fileId,
      fileName: file.fileName,
      ownerId: file.ownerId,
      status: 'TRASHED'
    });
    return true;
  }

  restoreFile(fileId) {
    const file = this.getFileById(fileId);
    if (!file) return false;
    file.isDeleted = false;
    file.deletedAt = null;
    this.save();
    if (isMongoConnected()) {
      FileModel.findOneAndUpdate(
        { fileId },
        { isDeleted: false, deletedAt: null },
        { returnDocument: 'after' }
      ).catch(err => console.error('[MongoDB Error]', err.message));
    }
    this.logAudit({
      action: 'FILE_RESTORED',
      fileId,
      fileName: file.fileName,
      ownerId: file.ownerId,
      status: 'RESTORED'
    });
    return true;
  }

  deleteFile(fileId) {
    const file = this.getFileById(fileId);
    if (!file) return false;
    this.data.files = this.data.files.filter(f => f.fileId !== fileId);
    // Also remove associated shares
    this.data.shares = this.data.shares.filter(s => s.fileId !== fileId);
    this.save();
    if (isMongoConnected()) {
      FileModel.deleteOne({ fileId }).catch(err => console.error('[MongoDB Error]', err.message));
      ShareModel.deleteMany({ fileId }).catch(err => console.error('[MongoDB Error]', err.message));
    }
    this.logAudit({
      action: 'FILE_PERMANENT_DELETE',
      fileId,
      fileName: file.fileName,
      ownerId: file.ownerId
    });
    return true;
  }

  findDuplicateFile(ownerId, sha256) {
    if (!sha256) return null;
    return this.data.files.find(f => 
      f.ownerId === ownerId && 
      !f.isDeleted && 
      f.scanDetails && 
      f.scanDetails.sha256 === sha256
    ) || null;
  }

  // --- Shares Collection ---
  getShares(ownerId = null) {
    if (!ownerId) return this.data.shares;
    return this.data.shares.filter(s => s.ownerId === ownerId);
  }

  getShareByToken(shareToken) {
    return this.data.shares.find(s => s.shareToken === shareToken) || null;
  }

  getShareById(shareId) {
    return this.data.shares.find(s => s.shareId === shareId) || null;
  }

  addShare(shareRecord) {
    const record = {
      ...shareRecord,
      isBurnAfterReading: Boolean(shareRecord.isBurnAfterReading),
      isRevoked: false,
      burnedAt: null,
      revokedReason: null
    };
    this.data.shares.unshift(record);
    this.save();
    if (isMongoConnected()) {
      ShareModel.findOneAndUpdate(
        { shareId: record.shareId },
        { ...record },
        { upsert: true, returnDocument: 'after' }
      ).catch(err => console.error('[MongoDB Error]', err.message));
    }
    this.logAudit({
      action: 'SHARE_CREATE',
      shareId: record.shareId,
      fileId: record.fileId,
      ownerId: record.ownerId,
      accessType: record.accessType,
      isBurnAfterReading: record.isBurnAfterReading
    });
    return record;
  }

  incrementShareDownloads(shareToken) {
    const share = this.getShareByToken(shareToken);
    if (share) {
      share.downloadsCount = (share.downloadsCount || 0) + 1;
      this.save();
      if (isMongoConnected()) {
        ShareModel.updateOne({ shareToken }, { $inc: { downloadsCount: 1 } }).catch(err => console.error('[MongoDB Error]', err.message));
      }
    }
    return share;
  }

  recordShareAccess(shareToken, { ip, userAgent, accessType = 'view' }) {
    const share = this.getShareByToken(shareToken);
    if (!share) return null;
    if (!share.accessLogs) share.accessLogs = [];
    if (accessType === 'download') {
      share.downloadsCount = (share.downloadsCount || 0) + 1;
    } else {
      share.viewsCount = (share.viewsCount || 0) + 1;
    }

    // Determine OS and Browser from User-Agent
    let browser = 'Browser';
    let os = 'Unknown OS';
    if (userAgent) {
      if (userAgent.includes('Firefox')) browser = 'Firefox';
      else if (userAgent.includes('Edg')) browser = 'Edge';
      else if (userAgent.includes('Chrome')) browser = 'Chrome';
      else if (userAgent.includes('Safari')) browser = 'Safari';

      if (userAgent.includes('Windows')) os = 'Windows';
      else if (userAgent.includes('Macintosh') || userAgent.includes('Mac OS')) os = 'macOS';
      else if (userAgent.includes('Linux')) os = 'Linux';
      else if (userAgent.includes('Android')) os = 'Android';
      else if (userAgent.includes('iPhone') || userAgent.includes('iPad')) os = 'iOS';
    }

    const cleanIp = (ip || '127.0.0.1').replace('::ffff:', '');
    const logEntry = {
      id: 'acc_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      ip: cleanIp,
      userAgent: userAgent || 'Unknown',
      browser,
      os,
      accessType, // 'view' or 'download'
      timestamp: new Date().toISOString()
    };

    share.accessLogs.unshift(logEntry);
    if (share.accessLogs.length > 50) share.accessLogs.pop(); // keep last 50 logs
    this.save();

    if (isMongoConnected()) {
      ShareModel.updateOne(
        { shareToken },
        { 
          $push: { accessLogs: { $each: [logEntry], $position: 0, $slice: 50 } },
          $inc: accessType === 'download' ? { downloadsCount: 1 } : { viewsCount: 1 }
        }
      ).catch(err => console.error('[MongoDB Error]', err.message));
    }

    // Push live notification to the file owner
    const file = this.getFileById(share.fileId);
    const fileName = file ? file.fileName : 'Shared file';
    this.addNotification({
      userId: share.ownerId,
      title: accessType === 'download' ? 'File Downloaded' : 'File Viewed',
      message: `"${fileName}" was ${accessType === 'download' ? 'downloaded' : 'viewed'} via share link (${browser} on ${os}, IP: ${cleanIp}).`,
      type: accessType === 'download' ? 'success' : 'info',
      link: `/share/${shareToken}`
    });

    return logEntry;
  }

  getShareAnalytics(shareToken) {
    const share = this.getShareByToken(shareToken);
    if (!share) return null;
    const file = this.getFileById(share.fileId);
    return {
      shareId: share.shareId,
      shareToken: share.shareToken,
      fileName: file ? file.fileName : 'Unknown File',
      fileType: file ? file.fileType : 'application/octet-stream',
      fileSize: file ? file.fileSize : 0,
      accessType: share.accessType,
      expiresAt: share.expiresAt,
      viewsCount: share.viewsCount || 0,
      downloadsCount: share.downloadsCount || 0,
      isBurnAfterReading: Boolean(share.isBurnAfterReading),
      isRevoked: Boolean(share.isRevoked),
      burnedAt: share.burnedAt || null,
      createdAt: share.createdAt,
      accessLogs: share.accessLogs || []
    };
  }

  burnShare(shareToken, reason = 'Accessed and burned') {
    const share = this.getShareByToken(shareToken);
    if (!share || share.isRevoked) return false;

    share.isRevoked = true;
    share.burnedAt = new Date().toISOString();
    share.revokedReason = reason;
    this.save();

    if (isMongoConnected()) {
      ShareModel.updateOne(
        { shareToken },
        { isRevoked: true, burnedAt: new Date(share.burnedAt), revokedReason: reason }
      ).catch(err => console.error('[MongoDB Error]', err.message));
    }

    this.logAudit({
      action: 'SHARE_BURNED',
      shareId: share.shareId,
      fileId: share.fileId,
      ownerId: share.ownerId,
      status: 'SELF_DESTRUCTED',
      details: reason
    });

    const file = this.getFileById(share.fileId);
    const fileName = file ? file.fileName : 'Shared file';
    this.addNotification({
      userId: share.ownerId,
      title: '🔥 One-Time Link Self-Destructed',
      message: `"${fileName}" share link has self-destructed following recipient access.`,
      type: 'security',
      link: '/share'
    });

    return true;
  }

  deleteShare(shareId) {
    const before = this.data.shares.length;
    this.data.shares = this.data.shares.filter(s => s.shareId !== shareId);
    this.save();
    if (isMongoConnected()) {
      ShareModel.deleteOne({ shareId }).catch(err => console.error('[MongoDB Error]', err.message));
    }
    return this.data.shares.length < before;
  }

  // --- Users Collection ---
  findUserByEmail(email) {
    if (!email) return null;
    const norm = email.trim().toLowerCase();
    return this.data.users.find(u => (u.email || '').trim().toLowerCase() === norm) || null;
  }

  findUserById(userId) {
    return this.data.users.find(u => u.userId === userId) || null;
  }

  async addUser(user) {
    const normalizedEmail = (user.email || '').trim().toLowerCase();
    if (this.findUserByEmail(normalizedEmail)) {
      const err = new Error('A user with this email already exists');
      err.code = 11000;
      throw err;
    }

    const cleanUser = {
      ...user,
      email: normalizedEmail
    };

    if (isMongoConnected()) {
      try {
        await UserModel.create(cleanUser);
      } catch (err) {
        if (err.code === 11000 || (err.message && err.message.includes('E11000'))) {
          const dupErr = new Error('A user with this email already exists');
          dupErr.code = 11000;
          throw dupErr;
        }
        console.error('[MongoDB Error]', err.message);
        throw err;
      }
    }

    this.data.users.push(cleanUser);
    this.save();
    return cleanUser;
  }

  // --- Audit Logs ---
  logAudit(entry) {
    const logItem = {
      id: 'log_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      timestamp: new Date().toISOString(),
      ...entry
    };
    this.data.auditLogs.unshift(logItem);
    // keep max 500 audit logs
    if (this.data.auditLogs.length > 500) {
      this.data.auditLogs.pop();
    }
    this.save();
    if (isMongoConnected()) {
      AuditLogModel.create({
        logId: logItem.id,
        action: logItem.action,
        fileId: logItem.fileId,
        fileName: logItem.fileName,
        ownerId: logItem.ownerId,
        status: logItem.status,
        details: logItem,
        timestamp: new Date(logItem.timestamp)
      }).catch(err => console.error('[MongoDB Error]', err.message));
    }
  }

  getAuditLogs(limit = 20) {
    return this.data.auditLogs.slice(0, limit);
  }

  // --- Notifications Collection ---
  getNotifications(userId) {
    if (!this.data.notifications) this.data.notifications = [];
    return this.data.notifications
      .filter(n => n.userId === userId)
      .slice(0, 30);
  }

  addNotification({ userId, title, message, type = 'info', link = null }) {
    if (!this.data.notifications) this.data.notifications = [];
    const notification = {
      notificationId: 'notif_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      userId,
      title,
      message,
      type, // 'info' | 'security' | 'warning' | 'success'
      isRead: false,
      link,
      createdAt: new Date().toISOString()
    };
    this.data.notifications.unshift(notification);
    if (this.data.notifications.length > 200) {
      this.data.notifications.pop();
    }
    this.save();
    if (isMongoConnected()) {
      NotificationModel.create({
        notificationId: notification.notificationId,
        userId: notification.userId,
        title: notification.title,
        message: notification.message,
        type: notification.type,
        isRead: false,
        link: notification.link,
        createdAt: new Date(notification.createdAt)
      }).catch(err => console.error('[MongoDB Error]', err.message));
    }
    return notification;
  }

  markAllNotificationsRead(userId) {
    if (!this.data.notifications) this.data.notifications = [];
    let updated = 0;
    for (const n of this.data.notifications) {
      if (n.userId === userId && !n.isRead) {
        n.isRead = true;
        updated++;
      }
    }
    if (updated > 0) {
      this.save();
      if (isMongoConnected()) {
        NotificationModel.updateMany({ userId, isRead: false }, { isRead: true }).catch(err => console.error('[MongoDB Error]', err.message));
      }
    }
    return true;
  }

  deleteNotification(userId, notificationId) {
    if (!this.data.notifications) this.data.notifications = [];
    const before = this.data.notifications.length;
    this.data.notifications = this.data.notifications.filter(
      n => !(n.userId === userId && n.notificationId === notificationId)
    );
    if (this.data.notifications.length < before) {
      this.save();
      if (isMongoConnected()) {
        NotificationModel.deleteOne({ userId, notificationId }).catch(err => console.error('[MongoDB Error]', err.message));
      }
      return true;
    }
    return false;
  }

  getStats(ownerId = null) {
    const files = this.getFiles(ownerId);
    const trashFiles = this.getTrashFiles(ownerId);
    const shares = this.getShares(ownerId);
    const totalBytes = files.reduce((acc, f) => acc + (f.fileSize || 0), 0);
    const safeCount = files.filter(f => f.scanStatus === 'CLEAN' || f.scanStatus === 'SAFE').length;
    const infectedBlocked = this.data.auditLogs.filter(a => a.status === 'INFECTED' || a.action === 'VIRUS_BLOCKED').length;
    const unreadNotifications = ownerId 
      ? (this.data.notifications || []).filter(n => n.userId === ownerId && !n.isRead).length 
      : 0;

    return {
      totalFiles: files.length,
      totalStorageBytes: totalBytes,
      safeFilesCount: safeCount,
      blockedThreatsCount: infectedBlocked,
      activeSharesCount: shares.length,
      auditLogsCount: this.data.auditLogs.length,
      trashCount: trashFiles.length,
      unreadNotificationsCount: unreadNotifications
    };
  }
}

export const db = new Store();
