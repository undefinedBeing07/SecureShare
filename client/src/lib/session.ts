import { AuthUser, SavedAccount } from './types';

const STORAGE_KEY = 'vaultspace_saved_accounts';

/**
 * Get all accounts currently authenticated and saved on THIS browser/device.
 * Zero-trust privacy: Never fetches or exposes other users from the database.
 */
export function getSavedAccounts(): SavedAccount[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Save or update an authenticated account session to this device.
 */
export function saveAccountToDevice(user: AuthUser, token?: string): SavedAccount[] {
  if (typeof window === 'undefined') return [];
  try {
    const accounts = getSavedAccounts();
    const activeTok = token || user.token || user.userId;
    const existingIndex = accounts.findIndex(
      (a) => a.userId === user.userId || a.email.toLowerCase() === user.email.toLowerCase()
    );

    const updatedAccount: SavedAccount = {
      ...user,
      token: activeTok,
      lastActive: new Date().toISOString()
    };

    if (existingIndex >= 0) {
      accounts[existingIndex] = updatedAccount;
    } else {
      accounts.push(updatedAccount);
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(accounts));
    return accounts;
  } catch {
    return [];
  }
}

/**
 * Remove a saved account session from this device.
 */
export function removeAccountFromDevice(userId: string): SavedAccount[] {
  if (typeof window === 'undefined') return [];
  try {
    const accounts = getSavedAccounts().filter((a) => a.userId !== userId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(accounts));
    return accounts;
  } catch {
    return [];
  }
}
