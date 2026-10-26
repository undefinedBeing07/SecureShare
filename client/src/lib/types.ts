export interface AuthUser {
  userId: string;
  email: string;
  displayName: string;
  role: string;
  token?: string;
}

export interface SavedAccount extends AuthUser {
  lastActive?: string;
}

export interface FileItem {
  fileId: string;
  ownerId: string;
  ownerName: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  storageKey: string;
  storageProvider: string;
  scanStatus: 'CLEAN' | 'INFECTED' | 'QUARANTINED' | 'SCANNING' | 'PENDING';
  scanDetails?: {
    engine: string;
    scanDurationMs: number;
    sha256: string;
    md5?: string;
    entropy?: number;
    quarantineAction: string;
    scannedAt: string;
  };
  shareInfo?: {
    shareId: string;
    shareToken: string;
    accessType: 'view' | 'download';
    expiresAt: string | null;
    downloadsCount: number;
    isBurnAfterReading?: boolean;
  } | null;
  uploadedAt: string;
  isDeleted?: boolean;
  deletedAt?: string | null;
}

export interface ShareData {
  shareId: string;
  fileId: string;
  ownerId: string;
  shareToken: string;
  accessType: 'view' | 'download';
  hasPassword?: boolean;
  isBurnAfterReading?: boolean;
  downloadsCount: number;
  createdAt: string;
  expiresAt: string | null;
}

export interface SystemStats {
  totalFiles: number;
  totalStorageBytes: number;
  safeFilesCount: number;
  blockedThreatsCount: number;
  activeSharesCount: number;
  auditLogsCount: number;
  trashCount?: number;
  unreadNotificationsCount?: number;
}

export interface NotificationItem {
  notificationId: string;
  userId: string;
  title: string;
  message: string;
  type: 'info' | 'security' | 'warning' | 'success';
  isRead: boolean;
  link?: string | null;
  createdAt: string;
}

export interface ShareAccessLog {
  id: string;
  ip: string;
  browser: string;
  os: string;
  accessType: 'view' | 'download';
  timestamp: string;
  userAgent: string;
}

export interface ShareAnalytics {
  shareId: string;
  shareToken: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  accessType: 'view' | 'download';
  expiresAt: string | null;
  viewsCount: number;
  downloadsCount: number;
  createdAt: string;
  accessLogs: ShareAccessLog[];
}

export interface DocumentSummary {
  fileName: string;
  category: string;
  wordCount: number;
  readingTime: string;
  executiveTakeaway: string;
  highlights: string[];
  generatedAt: string;
}

export interface SystemInfo {
  isR2Configured: boolean;
  storageEngine: string;
  isMongoConfigured: boolean;
  database: string;
  securityEngine: string;
  scannerType: string;
  authProvider: string;
  serverTime: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  action: string;
  fileId?: string;
  fileName?: string;
  ownerId?: string;
  status?: string;
  threats?: string[];
  engine?: string;
}
