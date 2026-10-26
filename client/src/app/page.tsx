'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  ShieldCheck, 
  HardDrive, 
  AlertTriangle, 
  FileText, 
  ExternalLink,
  Share2,
  Trash2,
  Star,
  ArrowUpRight,
  RotateCcw,
  BarChart3,
  Flame
} from 'lucide-react';
import { Sidebar, NavItem } from '../components/Sidebar';
import { Navbar } from '../components/Navbar';
import { UploadZone } from '../components/UploadZone';
import { StorageDistributionBar } from '../components/StorageDistributionBar';
import { FileList } from '../components/FileList';
import { ShareModal } from '../components/ShareModal';
import { PreviewModal } from '../components/PreviewModal';
import { ShareAnalyticsModal } from '../components/ShareAnalyticsModal';
import { AuditDrawer } from '../components/AuditDrawer';
import { AuthModal, AuthTab } from '../components/AuthModal';
import { FileItem, SystemStats, AuditLog, SystemInfo, AuthUser, SavedAccount } from '../lib/types';
import { getSavedAccounts, saveAccountToDevice, removeAccountFromDevice } from '../lib/session';
import { 
  fetchFiles, 
  fetchStats, 
  fetchTrashFiles, 
  deleteFile, 
  restoreFile, 
  permanentDeleteFile, 
  formatBytes, 
  formatDate
} from '../lib/api';

const DEFAULT_USER: AuthUser = {
  displayName: 'Alex Chen',
  email: 'admin@secureshare.io',
  userId: 'usr_demo_01',
  role: 'admin'
};
const DEFAULT_TOKEN = 'usr_demo_01';

export default function DashboardPage() {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [trashFiles, setTrashFiles] = useState<FileItem[]>([]);
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [systemInfo, setSystemInfo] = useState<SystemInfo | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);

  // Authentication State
  const [currentUser, setCurrentUser] = useState<AuthUser>(DEFAULT_USER);
  const [currentToken, setCurrentToken] = useState<string>(DEFAULT_TOKEN);
  const [savedAccounts, setSavedAccounts] = useState<SavedAccount[]>([]);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalTab, setAuthModalTab] = useState<AuthTab>('login');

  // Navigation & Search
  const [currentNav, setCurrentNav] = useState<NavItem>('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [starredIds, setStarredIds] = useState<Set<string>>(new Set());
  const [isSidebarMobileOpen, setIsSidebarMobileOpen] = useState(false);

  // Modals & Drawers state
  const [selectedFileForShare, setSelectedFileForShare] = useState<FileItem | null>(null);
  const [selectedFileForPreview, setSelectedFileForPreview] = useState<FileItem | null>(null);
  const [selectedFileForAnalytics, setSelectedFileForAnalytics] = useState<FileItem | null>(null);
  const [showAuditDrawer, setShowAuditDrawer] = useState(false);

  // Upload area reference for smooth scrolling when "Upload" is clicked
  const uploadZoneRef = useRef<HTMLDivElement>(null);

  // Load stored credentials and device saved accounts
  useEffect(() => {
    try {
      const storedUser = localStorage.getItem('secureshare_user');
      const storedToken = localStorage.getItem('secureshare_auth_token');
      let activeU = DEFAULT_USER;
      let activeT = DEFAULT_TOKEN;
      if (storedUser) {
        activeU = JSON.parse(storedUser);
        setCurrentUser(activeU);
      }
      if (storedToken) {
        activeT = storedToken;
        setCurrentToken(activeT);
      }

      // Load device-isolated sessions (only accounts logged into on this device)
      const accounts = getSavedAccounts();
      if (accounts.length > 0) {
        setSavedAccounts(accounts);
      } else {
        const initial = saveAccountToDevice(activeU, activeT);
        setSavedAccounts(initial);
      }
    } catch {}
  }, []);

  // Load Starred files from local state/localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('secureshare_starred');
      if (stored) {
        setStarredIds(new Set(JSON.parse(stored)));
      }
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  const handleUserChange = (newUser: AuthUser, token?: string) => {
    setCurrentUser(newUser);
    const activeTok = token || newUser.token || newUser.userId;
    setCurrentToken(activeTok);
    try {
      localStorage.setItem('secureshare_user', JSON.stringify(newUser));
      localStorage.setItem('secureshare_auth_token', activeTok);
    } catch {}
    // Save to device sessions
    const updated = saveAccountToDevice(newUser, activeTok);
    setSavedAccounts(updated);
  };

  const handleRemoveSavedAccount = (userId: string) => {
    const updated = removeAccountFromDevice(userId);
    setSavedAccounts(updated);
    if (currentUser.userId === userId) {
      if (updated.length > 0) {
        handleUserChange(updated[0], updated[0].token);
      } else {
        handleSignOut();
      }
    }
  };

  const handleSignOut = () => {
    try {
      localStorage.removeItem('secureshare_auth_token');
      localStorage.removeItem('secureshare_user');
    } catch {}
    setAuthModalTab('login');
    setIsAuthModalOpen(true);
  };

  const handleQuickSwitch = (targetUser: AuthUser) => {
    handleUserChange(targetUser, targetUser.token || targetUser.userId);
  };

  const toggleStar = (fileId: string) => {
    setStarredIds((prev) => {
      const next = new Set(prev);
      if (next.has(fileId)) next.delete(fileId);
      else next.add(fileId);
      try {
        localStorage.setItem('secureshare_starred', JSON.stringify(Array.from(next)));
      } catch {}
      return next;
    });
  };

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      const activeTok = currentToken || currentUser.userId;
      const [filesData, statsData, trashData] = await Promise.all([
        fetchFiles('', 'all', activeTok),
        fetchStats(activeTok),
        fetchTrashFiles(activeTok)
      ]);
      setFiles(filesData);
      setStats(statsData.stats);
      setTrashFiles(trashData);
      setAuditLogs(statsData.auditLogs);
      if (statsData.systemInfo) {
        setSystemInfo(statsData.systemInfo);
      }
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [currentUser.userId, currentToken]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleUploadSuccess = (newFile: FileItem) => {
    setFiles((prev) => [newFile, ...prev]);
    loadData(); // Refresh metrics and audit log stream
  };

  const handleDeleteFile = async (fileId: string) => {
    try {
      const activeTok = currentToken || currentUser.userId;
      await deleteFile(fileId, activeTok);
      await loadData();
    } catch (err: unknown) {
      alert('Delete failed: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  const handleRestoreFile = async (fileId: string) => {
    try {
      const activeTok = currentToken || currentUser.userId;
      await restoreFile(fileId, activeTok);
      await loadData();
    } catch (err: unknown) {
      alert('Restore failed: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  const handlePermanentDelete = async (fileId: string) => {
    if (!window.confirm('Are you sure you want to permanently delete this file from storage and database? This action cannot be undone.')) {
      return;
    }
    try {
      const activeTok = currentToken || currentUser.userId;
      await permanentDeleteFile(fileId, activeTok);
      await loadData();
    } catch (err: unknown) {
      alert('Permanent delete failed: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  const handleEmptyTrash = async () => {
    if (trashFiles.length === 0) return;
    if (!window.confirm(`Are you sure you want to permanently delete all ${trashFiles.length} file(s) in Bin/Trash? This cannot be undone.`)) {
      return;
    }
    try {
      const activeTok = currentToken || currentUser.userId;
      for (const f of trashFiles) {
        await permanentDeleteFile(f.fileId, activeTok);
      }
      await loadData();
    } catch (err: unknown) {
      alert('Empty trash failed: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  const scrollToUpload = () => {
    if (currentNav !== 'overview') {
      setCurrentNav('overview');
    }
    setTimeout(() => {
      uploadZoneRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  // Nav page title calculation
  const getNavTitle = () => {
    switch (currentNav) {
      case 'overview': return 'Overview';
      case 'my-files': return 'My Files';
      case 'shared': return 'Shared Links';
      case 'recent': return 'Recent Files';
      case 'starred': return 'Starred Files';
      case 'trash': return 'Trash';
      default: return 'Overview';
    }
  };

  // Files with active share links
  const sharedFiles = files.filter((f) => f.shareInfo);

  // Files sorted by recent upload date
  const recentFiles = [...files].sort(
    (a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
  );

  // Starred files
  const starredFiles = files.filter((f) => starredIds.has(f.fileId));

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-slate-900 flex">
      
      {/* 1. Persistent Sidebar (Mobile drawer + Desktop sticky) */}
      <Sidebar
        currentNav={currentNav}
        onNavigate={(item) => setCurrentNav(item)}
        isOpenMobile={isSidebarMobileOpen}
        onCloseMobile={() => setIsSidebarMobileOpen(false)}
        currentUser={currentUser}
        totalStorageBytes={stats ? stats.totalStorageBytes : 0}
        totalFiles={files.length}
        systemInfo={systemInfo}
        onTriggerUpload={scrollToUpload}
        onOpenAuth={(tab) => {
          setAuthModalTab(tab || 'login');
          setIsAuthModalOpen(true);
        }}
        trashCount={stats?.trashCount || trashFiles.length}
      />

      {/* Main Container */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* 2. Top Header */}
        <Navbar
          onToggleSidebar={() => setIsSidebarMobileOpen((prev) => !prev)}
          currentTitle={getNavTitle()}
          searchQuery={searchQuery}
          onSearchChange={(q) => setSearchQuery(q)}
          files={files}
          onSelectFile={(f) => setSelectedFileForPreview(f)}
          onExecuteSearch={() => {
            if (currentNav !== 'my-files' && currentNav !== 'overview') {
              setCurrentNav('my-files');
            }
          }}
          onOpenAudit={() => setShowAuditDrawer(true)}
          onTriggerUpload={scrollToUpload}
          currentUser={currentUser}
          systemInfo={systemInfo}
          blockedThreatsCount={stats?.blockedThreatsCount || 0}
          onOpenAuth={(tab) => {
            setAuthModalTab(tab || 'login');
            setIsAuthModalOpen(true);
          }}
          onQuickSwitchUser={handleQuickSwitch}
          onSignOut={handleSignOut}
          savedAccounts={savedAccounts}
        />

        {/* 3. Main Content Workspace */}
        <main className="flex-1 mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8 space-y-8">
          
          {/* VIEW: OVERVIEW (Default Dashboard) */}
          {currentNav === 'overview' && (
            <>
              {/* Dashboard Hero */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-6">
                <div>
                  <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
                    Welcome back, {currentUser.displayName ? currentUser.displayName.split(' ')[0] : 'Alex'}
                  </h1>
                  <p className="text-sm text-slate-600 mt-1">
                    Your files, organized and secure.
                  </p>
                </div>

                {/* Tasteful Security & Infrastructure Indicator */}
                <div className="flex items-center gap-2 self-start md:self-auto">
                  <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 shadow-sm">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span>
                      {systemInfo?.isR2Configured ? 'Cloudflare R2 Object Store' : 'Local Storage Emulator'}
                    </span>
                    <span className="text-slate-300">•</span>
                    <span className="text-emerald-700 font-semibold">
                      Sentinel Active
                    </span>
                  </div>
                </div>
              </div>

              {/* Analytics Cards (4 Responsive Cards with Real Values from API) */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                
                {/* 1. Total Files */}
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:border-slate-300 hover:shadow-md transition-all">
                  <div className="flex items-center justify-between text-slate-500 mb-3">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Total Files
                    </span>
                    <div className="h-8 w-8 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center">
                      <FileText className="h-4 w-4" />
                    </div>
                  </div>
                  <div className="text-2xl sm:text-3xl font-extrabold text-slate-900">
                    {stats ? stats.totalFiles : files.length}
                  </div>
                  <p className="text-[11px] text-slate-600 mt-1 font-medium">
                    {systemInfo?.isMongoConfigured ? 'Indexed in MongoDB' : 'Indexed in Local JSON Store'}
                  </p>
                </div>

                {/* 2. Storage Used */}
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:border-slate-300 hover:shadow-md transition-all">
                  <div className="flex items-center justify-between text-slate-500 mb-3">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Storage Used
                    </span>
                    <div className="h-8 w-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                      <HardDrive className="h-4 w-4" />
                    </div>
                  </div>
                  <div className="text-2xl sm:text-3xl font-extrabold text-slate-900">
                    {formatBytes(stats ? stats.totalStorageBytes : 0)}
                  </div>
                  <p className="text-[11px] text-slate-600 mt-1 font-medium">
                    {systemInfo?.isR2Configured ? 'In Cloudflare R2 bucket' : 'In local ./storage_r2 emulator'}
                  </p>
                </div>

                {/* 3. Files Scanned */}
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:border-slate-300 hover:shadow-md transition-all">
                  <div className="flex items-center justify-between text-slate-500 mb-3">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Files Scanned
                    </span>
                    <div className="h-8 w-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                      <ShieldCheck className="h-4 w-4" />
                    </div>
                  </div>
                  <div className="text-2xl sm:text-3xl font-extrabold text-emerald-700">
                    {stats ? stats.safeFilesCount : 0}
                  </div>
                  <p className="text-[11px] text-slate-600 mt-1 font-medium">
                    100% Passed Heuristic Security
                  </p>
                </div>

                {/* 4. Threats Blocked */}
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:border-slate-300 hover:shadow-md transition-all">
                  <div className="flex items-center justify-between text-slate-500 mb-3">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Threats Blocked
                    </span>
                    <div className="h-8 w-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
                      <AlertTriangle className="h-4 w-4" />
                    </div>
                  </div>
                  <div className="text-2xl sm:text-3xl font-extrabold text-rose-700">
                    {stats ? stats.blockedThreatsCount : 0}
                  </div>
                  <p className="text-[11px] text-slate-600 mt-1 font-medium">
                    Quarantined before storage
                  </p>
                </div>

              </div>

              {/* Visual Storage Distribution Bar */}
              <StorageDistributionBar files={files} />

              {/* Upload Zone Panel */}
              <UploadZone
                forwardedRef={uploadZoneRef}
                token={currentToken || currentUser.userId}
                onUploadSuccess={handleUploadSuccess}
              />

              {/* Recent Files Table Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-base font-bold text-slate-900">
                      Recent Files
                    </h2>
                    <p className="text-xs text-slate-500">
                      Files securely indexed and ready for retrieval
                    </p>
                  </div>
                  <button
                    onClick={() => setCurrentNav('my-files')}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-violet-700 hover:text-violet-800 underline underline-offset-2"
                  >
                    <span>View all files</span>
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </button>
                </div>

                <FileList
                  files={files}
                  isLoading={isLoading}
                  searchQuery={searchQuery}
                  onSearchChange={(q) => setSearchQuery(q)}
                  starredIds={starredIds}
                  onToggleStar={toggleStar}
                  onPreview={(f) => setSelectedFileForPreview(f)}
                  onShare={(f) => setSelectedFileForShare(f)}
                  onDelete={handleDeleteFile}
                  onTriggerUpload={scrollToUpload}
                />
              </div>
            </>
          )}

          {/* VIEW: MY FILES */}
          {currentNav === 'my-files' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                <div>
                  <h1 className="text-2xl font-bold text-slate-900">My Files Repository</h1>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Browse and manage all stored assets in your zero-trust vault
                  </p>
                </div>
                <button
                  type="button"
                  onClick={scrollToUpload}
                  className="rounded-xl bg-violet-600 hover:bg-violet-700 text-white px-3.5 py-2 text-xs font-semibold shadow-sm transition-colors"
                >
                  Upload File
                </button>
              </div>

              <FileList
                files={files}
                isLoading={isLoading}
                searchQuery={searchQuery}
                onSearchChange={(q) => setSearchQuery(q)}
                starredIds={starredIds}
                onToggleStar={toggleStar}
                onPreview={(f) => setSelectedFileForPreview(f)}
                onShare={(f) => setSelectedFileForShare(f)}
                onDelete={handleDeleteFile}
                onTriggerUpload={scrollToUpload}
              />
            </div>
          )}

          {/* VIEW: SHARED LINKS */}
          {currentNav === 'shared' && (
            <div className="space-y-6">
              <div className="border-b border-slate-200 pb-4">
                <h1 className="text-2xl font-bold text-slate-900">Shared Links & Access Tokens</h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  Files shared with external recipients via tokenized permission links
                </p>
              </div>

              {sharedFiles.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm">
                  <div className="h-12 w-12 rounded-2xl bg-violet-50 text-violet-600 flex items-center justify-center mx-auto mb-3">
                    <Share2 className="h-6 w-6" />
                  </div>
                  <h3 className="text-sm font-semibold text-slate-800">No active shared links</h3>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                    You haven&apos;t generated any share links yet. Click the Share icon next to any file to create a view-only or download link with expiration.
                  </p>
                  <button
                    onClick={() => setCurrentNav('my-files')}
                    className="mt-4 rounded-xl bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 text-xs font-semibold transition-colors"
                  >
                    Browse My Files to Share
                  </button>
                </div>
              ) : (
                <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                          <th className="px-4 py-3">File Name</th>
                          <th className="px-4 py-3">Access Permission</th>
                          <th className="px-4 py-3">Link Expiration</th>
                          <th className="px-4 py-3">Downloads</th>
                          <th className="px-4 py-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {sharedFiles.map((file) => (
                          <tr key={file.fileId} className="hover:bg-slate-50/60 transition-colors">
                            <td className="px-4 py-3.5">
                              <p className="font-semibold text-slate-900">{file.fileName}</p>
                              <p className="text-[11px] text-slate-400 font-mono">
                                Token: {file.shareInfo?.shareToken}
                              </p>
                            </td>
                            <td className="px-4 py-3.5">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 text-violet-700 border border-violet-200 px-2.5 py-0.5 text-[11px] font-semibold">
                                  {file.shareInfo?.accessType === 'download' ? 'Allow Download' : 'View Only'}
                                </span>
                                {file.shareInfo?.isBurnAfterReading && (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 text-amber-900 border border-amber-200 px-2 py-0.5 text-[10px] font-semibold">
                                    <Flame className="h-3 w-3 text-amber-600 fill-amber-500" />
                                    <span>Burn After Reading</span>
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3.5 text-slate-600 font-mono text-[11px]">
                              {file.shareInfo?.expiresAt ? formatDate(file.shareInfo.expiresAt) : 'Never (Persistent)'}
                            </td>
                            <td className="px-4 py-3.5 font-mono text-slate-700">
                              {file.shareInfo?.downloadsCount || 0} times
                            </td>
                            <td className="px-4 py-3.5 text-right space-x-2">
                              <button
                                type="button"
                                onClick={() => setSelectedFileForAnalytics(file)}
                                className="inline-flex items-center gap-1 rounded-lg border border-violet-200 bg-violet-50 hover:bg-violet-100 px-3 py-1.5 text-xs font-semibold text-violet-700 transition-colors"
                              >
                                <BarChart3 className="h-3 w-3" />
                                <span>Analytics</span>
                              </button>
                              <a
                                href={`/share/${file.shareInfo?.shareToken}`}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors"
                              >
                                <span>Open Page</span>
                                <ExternalLink className="h-3 w-3" />
                              </a>
                              <button
                                type="button"
                                onClick={() => setSelectedFileForShare(file)}
                                className="rounded-lg bg-violet-600 hover:bg-violet-700 text-white px-3 py-1.5 text-xs font-semibold transition-colors"
                              >
                                Manage
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* VIEW: RECENT FILES */}
          {currentNav === 'recent' && (
            <div className="space-y-6">
              <div className="border-b border-slate-200 pb-4">
                <h1 className="text-2xl font-bold text-slate-900">Recent Files</h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  Chronological log of files committed to storage
                </p>
              </div>

              <FileList
                files={recentFiles}
                isLoading={isLoading}
                searchQuery={searchQuery}
                onSearchChange={(q) => setSearchQuery(q)}
                starredIds={starredIds}
                onToggleStar={toggleStar}
                onPreview={(f) => setSelectedFileForPreview(f)}
                onShare={(f) => setSelectedFileForShare(f)}
                onDelete={handleDeleteFile}
                onTriggerUpload={scrollToUpload}
              />
            </div>
          )}

          {/* VIEW: STARRED FILES */}
          {currentNav === 'starred' && (
            <div className="space-y-6">
              <div className="border-b border-slate-200 pb-4">
                <h1 className="text-2xl font-bold text-slate-900">Starred Files</h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  Your bookmarked files for quick one-click access
                </p>
              </div>

              {starredFiles.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm">
                  <div className="h-12 w-12 rounded-2xl bg-amber-50 text-amber-500 flex items-center justify-center mx-auto mb-3">
                    <Star className="h-6 w-6" />
                  </div>
                  <h3 className="text-sm font-semibold text-slate-800">No starred files yet</h3>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                    Click the star icon next to any file in your repository to bookmark it here for fast retrieval.
                  </p>
                  <button
                    onClick={() => setCurrentNav('my-files')}
                    className="mt-4 rounded-xl bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 text-xs font-semibold transition-colors"
                  >
                    View All Files
                  </button>
                </div>
              ) : (
                <FileList
                  files={starredFiles}
                  isLoading={isLoading}
                  searchQuery={searchQuery}
                  onSearchChange={(q) => setSearchQuery(q)}
                  starredIds={starredIds}
                  onToggleStar={toggleStar}
                  onPreview={(f) => setSelectedFileForPreview(f)}
                  onShare={(f) => setSelectedFileForShare(f)}
                  onDelete={handleDeleteFile}
                  onTriggerUpload={scrollToUpload}
                />
              )}
            </div>
          )}

          {/* VIEW: BIN / TRASH */}
          {currentNav === 'trash' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
                <div>
                  <h1 className="text-2xl font-bold text-slate-900">Bin / Trash</h1>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Items in trash can be restored back to your vault or permanently shredded
                  </p>
                </div>
                {trashFiles.length > 0 && (
                  <button
                    type="button"
                    onClick={handleEmptyTrash}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 px-3.5 py-2 text-xs font-semibold shadow-xs transition-colors self-start sm:self-auto"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Empty Bin ({trashFiles.length})</span>
                  </button>
                )}
              </div>

              {trashFiles.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm">
                  <div className="h-12 w-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                    <Trash2 className="h-6 w-6" />
                  </div>
                  <h3 className="text-sm font-semibold text-slate-800">Your Bin / Trash is empty</h3>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                    Files you delete will appear here before being permanently scrubbed. You can restore them anytime.
                  </p>
                  <button
                    onClick={() => setCurrentNav('my-files')}
                    className="mt-4 rounded-xl bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 text-xs font-semibold transition-colors"
                  >
                    View My Files
                  </button>
                </div>
              ) : (
                <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                          <th className="px-4 py-3">File Name</th>
                          <th className="px-4 py-3 hidden md:table-cell">File Size</th>
                          <th className="px-4 py-3 hidden sm:table-cell">Deleted At</th>
                          <th className="px-4 py-3">Status</th>
                          <th className="px-4 py-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {trashFiles.map((file) => (
                          <tr key={file.fileId} className="hover:bg-slate-50/60 transition-colors">
                            <td className="px-4 py-3.5">
                              <div className="flex items-center gap-3">
                                <div className="h-8 w-8 rounded-lg bg-rose-50 text-rose-600 border border-rose-200/60 flex items-center justify-center shrink-0">
                                  <FileText className="h-4 w-4" />
                                </div>
                                <div className="min-w-0">
                                  <p className="font-semibold text-slate-900 truncate max-w-[200px] sm:max-w-xs">
                                    {file.fileName}
                                  </p>
                                  <p className="text-[10px] text-slate-400 font-mono">
                                    ID: {file.fileId}
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3.5 hidden md:table-cell font-mono text-slate-600">
                              {formatBytes(file.fileSize)}
                            </td>
                            <td className="px-4 py-3.5 hidden sm:table-cell text-slate-500 font-mono text-[11px]">
                              {file.deletedAt ? formatDate(file.deletedAt) : 'Recently deleted'}
                            </td>
                            <td className="px-4 py-3.5">
                              <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200 px-2.5 py-0.5 text-[11px] font-semibold">
                                In Trash
                              </span>
                            </td>
                            <td className="px-4 py-3.5 text-right space-x-2">
                              <button
                                type="button"
                                onClick={() => handleRestoreFile(file.fileId)}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 hover:bg-violet-100 px-3 py-1.5 text-xs font-semibold text-violet-700 transition-colors"
                                title="Restore file to My Files"
                              >
                                <RotateCcw className="h-3.5 w-3.5" />
                                <span>Restore</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handlePermanentDelete(file.fileId)}
                                className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-white hover:bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 transition-colors"
                                title="Permanently delete from vault and storage"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                <span>Delete Forever</span>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

        </main>

        {/* 4. Footer */}
        <footer className="border-t border-slate-200 bg-white py-5 text-center text-xs text-slate-500">
          <div className="mx-auto max-w-7xl px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="font-medium text-slate-700">
              SecureShare • <span className="font-normal text-slate-500">Zero-Trust Cloud Storage Platform</span>
            </p>
            <p className="text-slate-500">
              Next.js 14 • Express REST API • Cloudflare R2 • Sentinel Heuristic Malware Engine
            </p>
          </div>
        </footer>

      </div>

      {/* 5. Modals & Drawers */}
      {selectedFileForShare && (
        <ShareModal
          file={selectedFileForShare}
          token={currentUser.userId}
          onClose={() => setSelectedFileForShare(null)}
          onShareCreated={() => loadData()}
        />
      )}

      {selectedFileForPreview && (
        <PreviewModal
          file={selectedFileForPreview}
          token={currentToken || currentUser.userId}
          onClose={() => setSelectedFileForPreview(null)}
        />
      )}

      {selectedFileForAnalytics && (
        <ShareAnalyticsModal
          file={selectedFileForAnalytics}
          token={currentToken || currentUser.userId}
          onClose={() => setSelectedFileForAnalytics(null)}
        />
      )}

      {showAuditDrawer && (
        <AuditDrawer
          logs={auditLogs}
          onClose={() => setShowAuditDrawer(false)}
        />
      )}

      {/* 6. Authentication & User Profile Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        currentUser={currentUser}
        currentToken={currentToken}
        onUserChange={handleUserChange}
        initialTab={authModalTab}
        savedAccounts={savedAccounts}
        onRemoveSavedAccount={handleRemoveSavedAccount}
      />

    </div>
  );
}
