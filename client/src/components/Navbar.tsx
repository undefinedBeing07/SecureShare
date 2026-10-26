'use client';

import React, { useState, useRef, useEffect } from 'react';
import { 
  Menu, 
  Activity, 
  UploadCloud, 
  ShieldCheck, 
  ChevronDown, 
  Server, 
  Database,
  LogIn,
  UserPlus,
  Key,
  LogOut,
  Users,
  Check,
  Copy
} from 'lucide-react';
import { SystemInfo, AuthUser, SavedAccount, FileItem } from '../lib/types';
import { AuthTab } from './AuthModal';
import { SearchAutocomplete } from './SearchAutocomplete';
import { NotificationMenu } from './NotificationMenu';

interface NavbarProps {
  onToggleSidebar: () => void;
  currentTitle: string;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  files?: FileItem[];
  onSelectFile?: (file: FileItem) => void;
  onExecuteSearch?: (query: string) => void;
  onOpenAudit: () => void;
  onTriggerUpload: () => void;
  currentUser: AuthUser;
  systemInfo?: SystemInfo;
  blockedThreatsCount?: number;
  onOpenAuth: (initialTab?: AuthTab) => void;
  onQuickSwitchUser: (user: AuthUser) => void;
  onSignOut: () => void;
  savedAccounts?: SavedAccount[];
}

export function Navbar({
  onToggleSidebar,
  currentTitle,
  searchQuery,
  onSearchChange,
  files = [],
  onSelectFile,
  onExecuteSearch,
  onOpenAudit,
  onTriggerUpload,
  currentUser,
  systemInfo,
  blockedThreatsCount = 0,
  onOpenAuth,
  onQuickSwitchUser,
  onSignOut,
  savedAccounts = []
}: NavbarProps) {
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  // Close profile dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleCopyUserId = () => {
    navigator.clipboard.writeText(currentUser.userId);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 1500);
  };

  return (
    <header className="sticky top-0 z-30 h-16 bg-white/90 backdrop-blur-md border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between gap-3">
      
      {/* Left: Hamburger & Current View / Breadcrumbs */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onToggleSidebar}
          className="lg:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
          aria-label="Toggle navigation menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-2 min-w-0">
          <span className="hidden sm:inline-block text-xs font-medium text-slate-500">
            SecureShare
          </span>
          <span className="hidden sm:inline-block text-slate-300">/</span>
          <h1 className="text-sm sm:text-base font-bold text-slate-900 truncate">
            {currentTitle}
          </h1>
        </div>
      </div>

      {/* Center: Smart Search Autocomplete */}
      <div className="flex-1 max-w-md mx-2">
        <SearchAutocomplete
          files={files}
          searchQuery={searchQuery}
          onSearchChange={onSearchChange}
          onSelectFile={onSelectFile || (() => {})}
          onExecuteSearch={onExecuteSearch}
          placeholder="Search files by name..."
        />
      </div>

      {/* Right: Security Status, Audit Trigger, Upload CTA & Authentication Menu */}
      <div className="flex items-center gap-2 sm:gap-2.5">
        
        {/* Verified Security Status Indicator */}
        <div className="hidden xl:flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50/80 px-2.5 py-1 text-[11px] font-medium text-emerald-700">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Sentinel v2.4 Active</span>
        </div>

        {/* Audit Trail Shortcut */}
        <button
          onClick={onOpenAudit}
          className="relative flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
          title="Security activity & audit trail"
          aria-label="Open security activity audit drawer"
        >
          <Activity className="h-3.5 w-3.5 text-violet-600" />
          <span className="hidden md:inline">Activity</span>
          {blockedThreatsCount > 0 && (
            <span className="ml-0.5 rounded-full bg-rose-600 text-white px-1.5 py-0.2 text-[10px] font-bold">
              {blockedThreatsCount}
            </span>
          )}
        </button>

        {/* In-App Live Notification Center */}
        <NotificationMenu token={currentUser.token || currentUser.userId} />

        {/* Purple Upload Files Button */}
        <button
          onClick={onTriggerUpload}
          className="flex items-center gap-1.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white px-3.5 py-1.5 text-xs font-semibold shadow-sm shadow-violet-500/20 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
        >
          <UploadCloud className="h-4 w-4" />
          <span className="hidden sm:inline">Upload</span>
        </button>

        {/* Full-on Authentication Menu */}
        <div className="relative" ref={profileMenuRef}>
          <button
            onClick={() => setIsProfileOpen((prev) => !prev)}
            className="flex items-center gap-2 p-1 pl-1.5 pr-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition-colors shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
            aria-expanded={isProfileOpen}
            aria-haspopup="true"
            aria-label="User authentication & account menu"
          >
            <div className="h-7 w-7 rounded-lg bg-violet-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
              {currentUser.displayName.charAt(0)}
            </div>
            <div className="hidden md:block text-left">
              <p className="text-xs font-semibold text-slate-900 leading-tight truncate max-w-[100px]">
                {currentUser.displayName}
              </p>
              <p className="text-[10px] text-violet-700 font-medium leading-none capitalize">
                {currentUser.role || 'user'}
              </p>
            </div>
            <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
          </button>

          {/* Authentication Dropdown Panel */}
          {isProfileOpen && (
            <div 
              className="absolute right-0 mt-2 w-80 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-2xl z-50 text-xs animate-in fade-in slide-in-from-top-1 duration-150"
              role="menu"
            >
              
              {/* Profile Card Header */}
              <div className="pb-3 border-b border-slate-100 flex items-start gap-3">
                <div className="h-10 w-10 rounded-xl bg-violet-100 text-violet-700 border border-violet-200 flex items-center justify-center font-bold text-sm shrink-0">
                  {currentUser.displayName.charAt(0)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-slate-900 truncate">
                      {currentUser.displayName}
                    </p>
                    <span className="rounded bg-violet-50 text-violet-700 border border-violet-200 font-semibold px-1.5 py-0.2 text-[9px] uppercase">
                      {currentUser.role || 'user'}
                    </span>
                  </div>
                  <p className="text-slate-500 text-[11px] truncate mt-0.5">{currentUser.email}</p>
                  
                  {/* User ID with copy */}
                  <div className="flex items-center gap-1.5 mt-1.5 text-[10px] text-slate-400 font-mono">
                    <span>ID:</span>
                    <span className="text-slate-600">{currentUser.userId}</span>
                    <button
                      type="button"
                      onClick={handleCopyUserId}
                      className="text-slate-400 hover:text-slate-700 transition-colors"
                      title="Copy User ID"
                      aria-label="Copy User ID"
                    >
                      {copiedId ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Quick Account Switcher Section (Device Accounts Only) */}
              {savedAccounts.length > 1 && (
                <div className="py-2.5 border-b border-slate-100">
                  <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 mb-2">
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      Switch Account
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setIsProfileOpen(false);
                        onOpenAuth('switch');
                      }}
                      className="text-violet-600 hover:text-violet-800 text-[10px]"
                    >
                      Manage
                    </button>
                  </div>

                  <div className="space-y-1">
                    {savedAccounts.map((u) => {
                      const isActive = currentUser.userId === u.userId;
                      return (
                        <button
                          key={u.userId}
                          type="button"
                          onClick={() => {
                            if (!isActive) {
                              onQuickSwitchUser(u);
                            }
                            setIsProfileOpen(false);
                          }}
                          className={`w-full flex items-center justify-between p-2 rounded-lg text-left transition-colors ${
                            isActive
                              ? 'bg-violet-50 text-violet-900 font-medium'
                              : 'hover:bg-slate-50 text-slate-700'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="h-6 w-6 rounded-md bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-[10px] shrink-0">
                              {u.displayName.charAt(0)}
                            </div>
                            <div className="min-w-0">
                              <p className="text-[11px] truncate leading-tight font-medium">{u.displayName}</p>
                              <p className="text-[10px] text-slate-400 truncate leading-tight">{u.email}</p>
                            </div>
                          </div>
                          {isActive && (
                            <Check className="h-3.5 w-3.5 text-violet-600 shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Authentication Actions */}
              <div className="py-2 border-b border-slate-100 space-y-0.5 text-slate-700">
                <button
                  type="button"
                  onClick={() => {
                    setIsProfileOpen(false);
                    onOpenAuth('login');
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-slate-50 text-slate-700 transition-colors"
                >
                  <LogIn className="h-3.5 w-3.5 text-slate-500" />
                  <span>Sign in with different account</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsProfileOpen(false);
                    onOpenAuth('register');
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-slate-50 text-slate-700 transition-colors"
                >
                  <UserPlus className="h-3.5 w-3.5 text-slate-500" />
                  <span>Register new account</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsProfileOpen(false);
                    onOpenAuth('token');
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-slate-50 text-slate-700 transition-colors"
                >
                  <Key className="h-3.5 w-3.5 text-slate-500" />
                  <span>Inspect session JWT token</span>
                </button>
              </div>

              {/* Verified Architecture Telemetry */}
              <div className="py-2.5 space-y-1.5 border-b border-slate-100 text-[11px] text-slate-600">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Database className="h-3 w-3 text-slate-400" />
                    Storage
                  </span>
                  <span className="font-medium text-slate-700 truncate max-w-[130px]" title={systemInfo?.storageEngine || 'Local R2 Emulator'}>
                    {systemInfo?.isR2Configured ? 'Cloudflare R2' : 'Local Emulator'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Server className="h-3 w-3 text-slate-400" />
                    Metadata
                  </span>
                  <span className="font-medium text-slate-700 truncate max-w-[130px]">
                    {systemInfo?.isMongoConfigured ? 'MongoDB' : 'Local JSON DB'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <ShieldCheck className="h-3 w-3 text-emerald-600" />
                    Security
                  </span>
                  <span className="font-medium text-emerald-700">
                    Sentinel Active
                  </span>
                </div>
              </div>

              {/* Sign Out Button */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsProfileOpen(false);
                    onSignOut();
                  }}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl border border-rose-200 bg-rose-50/70 hover:bg-rose-100 text-rose-700 font-semibold text-xs transition-colors"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span>Sign Out Session</span>
                </button>
              </div>

            </div>
          )}
        </div>

      </div>

    </header>
  );
}
