import { 
  FileItem, 
  ShareData, 
  SystemStats, 
  AuditLog, 
  SystemInfo, 
  AuthUser,
  NotificationItem,
  ShareAnalytics,
  DocumentSummary
} from './types';

const rawApiUrl = (process.env.NEXT_PUBLIC_API_URL || '').trim().replace(/\/+$/, '');
export const API_BASE = rawApiUrl
  ? (rawApiUrl.endsWith('/api') ? rawApiUrl : `${rawApiUrl}/api`)
  : '/api';

/**
 * Safely parse response text as JSON without throwing on empty bodies or HTML error pages
 */
async function parseResponseBody<T = Record<string, unknown>>(res: Response): Promise<{ isJson: boolean; data: T | null }> {
  try {
    const text = await res.text();
    if (!text || !text.trim()) {
      return { isJson: false, data: null };
    }
    const data = JSON.parse(text);
    return { isJson: true, data: data as T };
  } catch {
    return { isJson: false, data: null };
  }
}

export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export function formatDate(isoString: string): string {
  try {
    const d = new Date(isoString);
    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return isoString;
  }
}

export async function fetchFiles(query = '', type = 'all', token?: string): Promise<FileItem[]> {
  const params = new URLSearchParams();
  if (query) params.append('search', query);
  if (type && type !== 'all') params.append('type', type);

  const res = await fetch(`${API_BASE}/files?${params.toString()}`, {
    headers: {
      Authorization: `Bearer ${token || 'usr_demo_01'}`
    }
  });

  const { data } = await parseResponseBody<{ files?: FileItem[]; error?: string }>(res);

  if (!res.ok) {
    throw new Error(data?.error || `Failed to load files (HTTP ${res.status})`);
  }

  return data?.files || [];
}

export async function fetchStats(token?: string): Promise<{ stats: SystemStats; auditLogs: AuditLog[]; systemInfo?: SystemInfo }> {
  const res = await fetch(`${API_BASE}/stats`, {
    headers: {
      Authorization: `Bearer ${token || 'usr_demo_01'}`
    }
  });

  const { data } = await parseResponseBody<{ stats: SystemStats; auditLogs: AuditLog[]; systemInfo?: SystemInfo; error?: string }>(res);

  if (!res.ok || !data?.stats) {
    throw new Error(data?.error || `Failed to load statistics (HTTP ${res.status})`);
  }

  return data;
}

export async function deleteFile(fileId: string, token?: string): Promise<void> {
  const res = await fetch(`${API_BASE}/files/${fileId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token || 'usr_demo_01'}`
    }
  });

  const { data } = await parseResponseBody<{ error?: string }>(res);

  if (!res.ok) {
    throw new Error(data?.error || `Failed to move file to trash (HTTP ${res.status})`);
  }
}

export async function fetchTrashFiles(token?: string): Promise<FileItem[]> {
  const res = await fetch(`${API_BASE}/files/trash`, {
    headers: {
      Authorization: `Bearer ${token || 'usr_demo_01'}`
    }
  });

  const { data } = await parseResponseBody<{ files?: FileItem[]; error?: string }>(res);

  if (!res.ok) {
    throw new Error(data?.error || `Failed to load trash files (HTTP ${res.status})`);
  }

  return data?.files || [];
}

export async function restoreFile(fileId: string, token?: string): Promise<void> {
  const res = await fetch(`${API_BASE}/files/${fileId}/restore`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token || 'usr_demo_01'}`
    }
  });

  const { data } = await parseResponseBody<{ error?: string }>(res);

  if (!res.ok) {
    throw new Error(data?.error || `Failed to restore file (HTTP ${res.status})`);
  }
}

export async function permanentDeleteFile(fileId: string, token?: string): Promise<void> {
  const res = await fetch(`${API_BASE}/files/${fileId}/permanent`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token || 'usr_demo_01'}`
    }
  });

  const { data } = await parseResponseBody<{ error?: string }>(res);

  if (!res.ok) {
    throw new Error(data?.error || `Failed to permanently delete file (HTTP ${res.status})`);
  }
}

export async function createShareLink(
  fileId: string,
  options: { accessType: 'view' | 'download'; duration: string; password?: string; burnAfterReading?: boolean },
  token?: string
): Promise<{ share: ShareData; shareUrl: string }> {
  const res = await fetch(`${API_BASE}/files/${fileId}/share`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token || 'usr_demo_01'}`
    },
    body: JSON.stringify(options)
  });

  const { data } = await parseResponseBody<{ share: ShareData; shareUrl: string; error?: string }>(res);

  if (!res.ok || !data?.share) {
    throw new Error(data?.error || `Failed to generate share link (HTTP ${res.status})`);
  }

  return data;
}

export async function getSharedFileInfo(token: string) {
  const res = await fetch(`${API_BASE}/share/${token}`);
  const { data } = await parseResponseBody<Record<string, unknown>>(res);

  if (!res.ok || !data) {
    throw new Error((data?.error as string) || `Failed to resolve share token (HTTP ${res.status})`);
  }

  return data;
}

export async function loginUser(email: string, password?: string): Promise<{ token: string; user: AuthUser }> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ email, password })
  });

  const { data } = await parseResponseBody<{ token: string; user: AuthUser; error?: string }>(res);

  if (!res.ok || !data?.token) {
    throw new Error(data?.error || `Authentication failed (HTTP ${res.status})`);
  }

  return { token: data.token, user: data.user };
}

export async function sendRegistrationOtp(email: string): Promise<{ message: string; email: string; cooldownSeconds?: number }> {
  const res = await fetch(`${API_BASE}/auth/send-otp`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ email })
  });

  const { data } = await parseResponseBody<{ message?: string; email?: string; cooldownSeconds?: number; error?: string }>(res);

  if (!res.ok) {
    throw new Error(data?.error || `Failed to send verification code (HTTP ${res.status})`);
  }

  return {
    message: data?.message || 'Verification code sent',
    email: data?.email || email,
    cooldownSeconds: data?.cooldownSeconds
  };
}

export async function verifyRegistrationOtp(email: string, otp: string): Promise<{ message: string; verificationToken: string }> {
  const res = await fetch(`${API_BASE}/auth/verify-otp`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ email, otp })
  });

  const { data } = await parseResponseBody<{ message?: string; verificationToken?: string; error?: string }>(res);

  if (!res.ok || !data?.verificationToken) {
    throw new Error(data?.error || `Verification failed (HTTP ${res.status})`);
  }

  return {
    message: data.message || 'Email verified successfully',
    verificationToken: data.verificationToken
  };
}

export async function registerUser(
  email: string, 
  password: string, 
  displayName: string,
  verificationToken?: string
): Promise<{ token: string; user: AuthUser }> {
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ email, password, displayName, verificationToken })
  });

  const { data } = await parseResponseBody<{ token: string; user: AuthUser; error?: string }>(res);

  if (!res.ok || !data?.token) {
    throw new Error(data?.error || `Registration failed (HTTP ${res.status})`);
  }

  return { token: data.token, user: data.user };
}

export async function fetchDemoUsers(): Promise<AuthUser[]> {
  // Disabled for zero-trust privacy to prevent user enumeration
  return [];
}

// Notifications API
export async function fetchNotifications(token?: string): Promise<{ notifications: NotificationItem[]; unreadCount: number }> {
  const res = await fetch(`${API_BASE}/notifications`, {
    headers: {
      Authorization: `Bearer ${token || 'usr_demo_01'}`
    }
  });

  const { data } = await parseResponseBody<{ notifications?: NotificationItem[]; unreadCount?: number; error?: string }>(res);

  if (!res.ok) {
    return { notifications: [], unreadCount: 0 };
  }

  return {
    notifications: data?.notifications || [],
    unreadCount: data?.unreadCount || 0
  };
}

export async function markAllNotificationsRead(token?: string): Promise<void> {
  await fetch(`${API_BASE}/notifications/read-all`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token || 'usr_demo_01'}`
    }
  });
}

export async function dismissNotification(notificationId: string, token?: string): Promise<void> {
  await fetch(`${API_BASE}/notifications/${notificationId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token || 'usr_demo_01'}`
    }
  });
}

// Protected Share Verification
export async function verifySharePassword(token: string, password: string): Promise<boolean> {
  const res = await fetch(`${API_BASE}/share/${token}/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password })
  });

  const { data } = await parseResponseBody<{ success?: boolean; error?: string }>(res);
  if (!res.ok || !data?.success) {
    throw new Error(data?.error || 'Incorrect passcode. Access denied.');
  }

  return true;
}

// Share Analytics Telemetry
export async function fetchShareAnalytics(token: string, authToken?: string): Promise<ShareAnalytics> {
  const res = await fetch(`${API_BASE}/share/${token}/analytics`, {
    headers: {
      Authorization: `Bearer ${authToken || 'usr_demo_01'}`
    }
  });

  const { data } = await parseResponseBody<{ analytics?: ShareAnalytics; error?: string }>(res);
  if (!res.ok || !data?.analytics) {
    throw new Error(data?.error || 'Failed to load share analytics');
  }

  return data.analytics;
}

// AI Document Summary
export async function fetchDocumentSummary(fileId: string, token?: string): Promise<DocumentSummary> {
  const res = await fetch(`${API_BASE}/files/${fileId}/summarize`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token || 'usr_demo_01'}`
    }
  });

  const { data } = await parseResponseBody<{ summary?: DocumentSummary; error?: string }>(res);
  if (!res.ok || !data?.summary) {
    throw new Error(data?.error || 'Failed to generate document summary');
  }

  return data.summary;
}
