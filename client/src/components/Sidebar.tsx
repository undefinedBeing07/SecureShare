'use client';

import React from 'react';
import { 
  ShieldCheck, 
  LayoutDashboard, 
  Folder, 
  Share2, 
  Clock, 
  Star, 
  Trash2, 
  HardDrive, 
  Settings, 
  X,
  Sparkles
} from 'lucide-react';
import { formatBytes } from '../lib/api';
import { SystemInfo, AuthUser } from '../lib/types';
import { AuthTab } from './AuthModal';

export type NavItem = 'overview' | 'my-files' | 'shared' | 'recent' | 'starred' | 'trash';

interface SidebarProps {
  currentNav: NavItem;
  onNavigate: (item: NavItem) => void;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
  currentUser: AuthUser;
  totalStorageBytes: number;
  totalFiles: number;
  systemInfo?: SystemInfo;
  onTriggerUpload: () => void;
  onOpenAuth?: (tab?: AuthTab) => void;
  trashCount?: number;
}

export function Sidebar({
  currentNav,
  onNavigate,
  isOpenMobile,
  onCloseMobile,
  currentUser,
  totalStorageBytes,
  systemInfo,
  onTriggerUpload,
  onOpenAuth,
  trashCount = 0
}: SidebarProps) {
  // Approximate free tier storage quota (500 MB to match prototype config)
  const quotaBytes = 500 * 1024 * 1024;
  const usedPercent = Math.min(100, Math.round((totalStorageBytes / quotaBytes) * 100));

  const navItems: { id: NavItem; label: string; icon: React.ElementType; badge?: string }[] = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'my-files', label: 'My Files', icon: Folder },
    { id: 'shared', label: 'Shared Links', icon: Share2 },
    { id: 'recent', label: 'Recent Files', icon: Clock },
    { id: 'starred', label: 'Starred', icon: Star },
    { id: 'trash', label: 'Trash', icon: Trash2, badge: trashCount > 0 ? String(trashCount) : undefined },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpenMobile && (
        <div 
          onClick={onCloseMobile}
          className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm lg:hidden transition-opacity"
          aria-hidden="true"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-64 bg-white border-r border-slate-200 flex flex-col justify-between transition-transform duration-200 ease-in-out lg:static lg:translate-x-0 ${
          isOpenMobile ? 'translate-x-0 shadow-2xl' : '-translate-x-full'
        }`}
        aria-label="Main Navigation"
      >
        {/* Top: Logo & Nav items */}
        <div className="flex flex-col">
          {/* Brand Header */}
          <div className="h-16 px-5 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-violet-600 flex items-center justify-center text-white shadow-sm shadow-violet-500/30">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-slate-900 tracking-tight text-base leading-none">
                    SecureShare
                  </span>
                  <span className="rounded bg-violet-50 px-1.5 py-0.5 text-[10px] font-semibold text-violet-700 border border-violet-200/60">
                    PRO
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 font-medium leading-none mt-1">
                  Zero-Trust Storage
                </p>
              </div>
            </div>

            {/* Mobile Close Button */}
            <button
              onClick={onCloseMobile}
              className="lg:hidden p-1.5 rounded-lg text-slate-600 hover:bg-slate-100"
              aria-label="Close navigation"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Quick Action Button */}
          <div className="p-3">
            <button
              onClick={() => {
                onTriggerUpload();
                if (isOpenMobile) onCloseMobile();
              }}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white px-3.5 py-2.5 text-xs font-semibold shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
            >
              <Sparkles className="h-4 w-4" />
              <span>Upload new file</span>
            </button>
          </div>

          {/* Nav List */}
          <nav className="px-3 py-2 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentNav === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    onNavigate(item.id);
                    if (isOpenMobile) onCloseMobile();
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                    isActive
                      ? 'bg-violet-50 text-violet-700 font-semibold'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className={`h-4 w-4 ${isActive ? 'text-violet-600' : 'text-slate-600'}`} />
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span className="text-[10px] font-semibold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-md">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom Section: Storage quota card & User Profile */}
        <div className="p-3 border-t border-slate-100 space-y-3">
          
          {/* Storage Quota Card */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
                <HardDrive className="h-3.5 w-3.5 text-slate-600" />
                <span>Storage</span>
              </div>
              <span className="text-[11px] font-medium text-slate-600">
                {usedPercent}%
              </span>
            </div>

            {/* Storage Progress Bar */}
            <div className="h-1.5 w-full rounded-full bg-slate-200 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  usedPercent > 90 ? 'bg-rose-500' : 'bg-violet-600'
                }`}
                style={{ width: `${Math.max(usedPercent, 2)}%` }}
              />
            </div>

            <div className="flex items-center justify-between mt-2 text-[11px] text-slate-600">
              <span>{formatBytes(totalStorageBytes)} of 500 MB</span>
              <span className="text-[10px] text-slate-600 truncate max-w-[85px]" title={systemInfo?.storageEngine || 'Local R2 Emulator'}>
                {systemInfo?.isR2Configured ? 'Cloudflare R2' : 'Local Emulator'}
              </span>
            </div>
          </div>

          {/* User Profile Snippet (Clickable to open Authentication Menu) */}
          <div 
            onClick={() => onOpenAuth?.('switch')}
            className="flex items-center justify-between rounded-xl p-2 hover:bg-slate-100/80 transition-colors cursor-pointer group"
            title="Click to view authentication & switch user"
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onOpenAuth?.('switch');
              }
            }}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-violet-600 to-purple-500 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                {currentUser.displayName.charAt(0)}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-900 truncate group-hover:text-violet-700 transition-colors">
                  {currentUser.displayName}
                </p>
                <p className="text-[11px] text-slate-500 truncate capitalize">
                  {currentUser.role || 'user'} • {currentUser.email.split('@')[0]}
                </p>
              </div>
            </div>
            
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenAuth?.('login');
              }}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
              title="Authentication & account settings"
              aria-label="Authentication & account settings"
            >
              <Settings className="h-4 w-4" />
            </button>
          </div>

        </div>
      </aside>
    </>
  );
}
