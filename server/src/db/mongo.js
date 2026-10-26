import mongoose from 'mongoose';
import { config } from '../config.js';
import { UserModel } from '../models/User.js';
import { FileModel } from '../models/File.js';
import { ShareModel } from '../models/Share.js';
import { AuditLogModel } from '../models/AuditLog.js';
import { NotificationModel } from '../models/Notification.js';

let isConnected = false;
let isConnecting = false;
let reconnectTimer = null;
let onConnectedHandler = null;

// Listen to Mongoose connection lifecycle
mongoose.connection.on('connected', () => {
  isConnected = true;
  isConnecting = false;
  console.log('[MongoDB] Successfully established connection to MongoDB database!');
  if (reconnectTimer) {
    clearInterval(reconnectTimer);
    reconnectTimer = null;
  }
  if (onConnectedHandler) {
    try {
      onConnectedHandler();
    } catch (e) {
      console.error('[MongoDB] Post-connect sync handler error:', e.message);
    }
  }
});

mongoose.connection.on('disconnected', () => {
  isConnected = false;
  isConnecting = false;
  console.warn('[MongoDB] Disconnected from MongoDB. Operating in local fallback mode.');
  startAutoReconnect();
});

mongoose.connection.on('error', (err) => {
  isConnected = false;
  isConnecting = false;
  console.warn(`[MongoDB] Connection error: ${err.message}`);
  startAutoReconnect();
});

function startAutoReconnect() {
  const uri = config.mongoUri || process.env.MONGODB_URI;
  if (!uri || reconnectTimer) return;

  reconnectTimer = setInterval(async () => {
    if (mongoose.connection.readyState === 1) {
      isConnected = true;
      isConnecting = false;
      clearInterval(reconnectTimer);
      reconnectTimer = null;
      return;
    }

    if (isConnecting || mongoose.connection.readyState === 2) {
      return;
    }

    try {
      isConnecting = true;
      console.log('[MongoDB] Attempting background reconnection to MongoDB Atlas...');
      await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
      isConnected = true;
      console.log('[MongoDB] Successfully reconnected to MongoDB Atlas!');
      clearInterval(reconnectTimer);
      reconnectTimer = null;
      if (onConnectedHandler) {
        onConnectedHandler();
      }
    } catch (err) {
      // Still unreachable, wait for next cycle
    } finally {
      isConnecting = false;
    }
  }, 15000);
}

export async function connectMongo(onConnectCallback = null) {
  if (onConnectCallback) {
    onConnectedHandler = onConnectCallback;
  }

  const uri = config.mongoUri || process.env.MONGODB_URI;
  if (!uri) {
    console.log('[MongoDB] No MONGODB_URI configured. Operating in high-performance local JSON datastore mode.');
    return false;
  }

  try {
    console.log(`[MongoDB] Connecting to MongoDB instance...`);
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000
    });
    isConnected = true;
    console.log('[MongoDB] Successfully connected to MongoDB database!');
    if (onConnectedHandler) {
      onConnectedHandler();
    }
    return true;
  } catch (err) {
    console.warn(`[MongoDB] Connection failed (${err.message}). Gracefully using fallback local datastore.`);
    isConnected = false;
    startAutoReconnect();
    return false;
  }
}

export function isMongoConnected() {
  return isConnected && mongoose.connection.readyState === 1;
}

export async function syncLocalToMongo(localData) {
  if (!isMongoConnected()) return false;

  try {
    // 1. Sync Users
    if (localData.users && localData.users.length > 0) {
      for (const u of localData.users) {
        await UserModel.findOneAndUpdate(
          { userId: u.userId },
          { ...u },
          { upsert: true, returnDocument: 'after' }
        );
      }
    }

    // 2. Sync Files
    if (localData.files && localData.files.length > 0) {
      for (const f of localData.files) {
        await FileModel.findOneAndUpdate(
          { fileId: f.fileId },
          { ...f },
          { upsert: true, returnDocument: 'after' }
        );
      }
    }

    // 3. Sync Shares
    if (localData.shares && localData.shares.length > 0) {
      for (const s of localData.shares) {
        await ShareModel.findOneAndUpdate(
          { shareId: s.shareId },
          { ...s },
          { upsert: true, returnDocument: 'after' }
        );
      }
    }

    // 4. Sync Audit Logs
    if (localData.auditLogs && localData.auditLogs.length > 0) {
      for (const a of localData.auditLogs) {
        await AuditLogModel.findOneAndUpdate(
          { logId: a.id || a.logId },
          { 
            logId: a.id || a.logId,
            action: a.action,
            fileId: a.fileId,
            fileName: a.fileName,
            ownerId: a.ownerId,
            status: a.status,
            details: a.details || a,
            timestamp: a.timestamp || new Date()
          },
          { upsert: true, returnDocument: 'after' }
        );
      }
    }

    // 5. Sync Notifications
    if (localData.notifications && localData.notifications.length > 0) {
      for (const n of localData.notifications) {
        await NotificationModel.findOneAndUpdate(
          { notificationId: n.notificationId },
          { ...n },
          { upsert: true, returnDocument: 'after' }
        );
      }
    }

    console.log('[MongoDB] Successfully synchronized local vault records to MongoDB collections!');
    return true;
  } catch (err) {
    console.error('[MongoDB] Sync error:', err.message);
    return false;
  }
}

export { UserModel, FileModel, ShareModel, AuditLogModel, NotificationModel };
