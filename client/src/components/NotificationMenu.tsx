'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Bell, 
  CheckCheck, 
  ShieldAlert, 
  AlertTriangle, 
  CheckCircle2, 
  Info, 
  X,
  ExternalLink
} from 'lucide-react';
import { NotificationItem } from '../lib/types';
import { fetchNotifications, markAllNotificationsRead, dismissNotification } from '../lib/api';

interface NotificationMenuProps {
  token?: string;
  onRefreshStats?: () => void;
}

export function NotificationMenu({ token, onRefreshStats }: NotificationMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const menuRef = useRef<HTMLDivElement>(null);

  const loadNotifications = useCallback(async () => {
    try {
      const data = await fetchNotifications(token);
      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);
    } catch (err) {
      console.error('Failed to load notifications:', err);
    }
  }, [token]);

  useEffect(() => {
    loadNotifications();
    // Poll every 30 seconds for live notifications
    const interval = setInterval(loadNotifications, 30000);
    return () => clearInterval(interval);
  }, [loadNotifications]);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsRead(token);
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
      if (onRefreshStats) onRefreshStats();
    } catch (err) {
      console.error('Failed to mark read:', err);
    }
  };

  const handleDismiss = async (notificationId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await dismissNotification(notificationId, token);
      setNotifications(prev => {
        const target = prev.find(n => n.notificationId === notificationId);
        if (target && !target.isRead) {
          setUnreadCount(c => Math.max(0, c - 1));
        }
        return prev.filter(n => n.notificationId !== notificationId);
      });
      if (onRefreshStats) onRefreshStats();
    } catch (err) {
      console.error('Failed to dismiss:', err);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'security':
        return (
          <div className="h-7 w-7 rounded-lg bg-violet-100 text-violet-700 border border-violet-200 flex items-center justify-center shrink-0">
            <ShieldAlert className="h-3.5 w-3.5" />
          </div>
        );
      case 'warning':
        return (
          <div className="h-7 w-7 rounded-lg bg-amber-100 text-amber-700 border border-amber-200 flex items-center justify-center shrink-0">
            <AlertTriangle className="h-3.5 w-3.5" />
          </div>
        );
      case 'success':
        return (
          <div className="h-7 w-7 rounded-lg bg-emerald-100 text-emerald-700 border border-emerald-200 flex items-center justify-center shrink-0">
            <CheckCircle2 className="h-3.5 w-3.5" />
          </div>
        );
      default:
        return (
          <div className="h-7 w-7 rounded-lg bg-blue-100 text-blue-700 border border-blue-200 flex items-center justify-center shrink-0">
            <Info className="h-3.5 w-3.5" />
          </div>
        );
    }
  };

  const formatRelativeTime = (isoString: string) => {
    try {
      const diffMs = Date.now() - new Date(isoString).getTime();
      const mins = Math.floor(diffMs / 60000);
      if (mins < 1) return 'Just now';
      if (mins < 60) return `${mins}m ago`;
      const hours = Math.floor(mins / 60);
      if (hours < 24) return `${hours}h ago`;
      return `${Math.floor(hours / 24)}d ago`;
    } catch {
      return 'Recently';
    }
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) loadNotifications();
        }}
        className="relative p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition-colors shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
        aria-label="View notifications"
        aria-expanded={isOpen}
      >
        <Bell className="h-4 w-4 text-slate-600" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-rose-600 text-[10px] font-bold text-white shadow-xs animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl border border-slate-200 bg-white shadow-2xl z-50 overflow-hidden text-xs animate-in fade-in slide-in-from-top-1 duration-150">
          
          {/* Header */}
          <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-900 text-xs">Notifications</span>
              {unreadCount > 0 && (
                <span className="rounded-full bg-violet-100 text-violet-700 font-semibold text-[10px] px-2 py-0.5 border border-violet-200">
                  {unreadCount} unread
                </span>
              )}
            </div>
            {notifications.length > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="text-[11px] font-semibold text-violet-700 hover:text-violet-800 flex items-center gap-1 transition-colors"
              >
                <CheckCheck className="h-3 w-3" />
                <span>Mark all read</span>
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-[380px] overflow-y-auto divide-y divide-slate-100 bg-white">
            {notifications.length > 0 ? (
              notifications.map((item) => (
                <div
                  key={item.notificationId}
                  className={`p-3 transition-colors flex items-start gap-2.5 group ${
                    item.isRead ? 'bg-white hover:bg-slate-50' : 'bg-violet-50/50 hover:bg-violet-50'
                  }`}
                >
                  {getNotificationIcon(item.type)}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-1">
                      <p className={`font-semibold text-xs leading-snug truncate ${item.isRead ? 'text-slate-800' : 'text-slate-950 font-bold'}`}>
                        {item.title}
                      </p>
                      <span className="text-[10px] text-slate-400 whitespace-nowrap shrink-0">
                        {formatRelativeTime(item.createdAt)}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
                      {item.message}
                    </p>

                    {item.link && (
                      <a
                        href={item.link}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-violet-700 hover:text-violet-800 mt-1"
                      >
                        <span>Open link</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={(e) => handleDismiss(item.notificationId, e)}
                    className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-600 rounded-md transition-opacity"
                    title="Dismiss"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-slate-500">
                <Bell className="h-8 w-8 mx-auto text-slate-300 mb-2" />
                <p className="font-semibold text-slate-700 text-xs">No notifications yet</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Activity logs, logins, and share alerts will appear here.
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="p-2 border-t border-slate-100 bg-slate-50 text-center">
              <span className="text-[10px] text-slate-400 font-medium">
                Showing recent security alerts & notifications
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
