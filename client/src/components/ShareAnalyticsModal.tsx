'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  X, 
  BarChart3, 
  Eye, 
  Download, 
  Clock, 
  Globe, 
  RefreshCw
} from 'lucide-react';
import { ShareAnalytics, FileItem } from '../lib/types';
import { fetchShareAnalytics, formatDate, formatBytes } from '../lib/api';

interface ShareAnalyticsModalProps {
  file: FileItem;
  token?: string;
  onClose: () => void;
}

export function ShareAnalyticsModal({ file, token, onClose }: ShareAnalyticsModalProps) {
  const [analytics, setAnalytics] = useState<ShareAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  const shareToken = file.shareInfo?.shareToken;

  const loadAnalytics = useCallback(async () => {
    if (!shareToken) return;
    try {
      setIsLoading(true);
      setError(null);
      const data = await fetchShareAnalytics(shareToken, token);
      setAnalytics(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load telemetry');
    } finally {
      setIsLoading(false);
    }
  }, [shareToken, token]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  // Close on Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
          onClose();
        }
      }}
    >
      <div 
        ref={modalRef}
        className="flex flex-col w-full max-w-2xl max-h-[90vh] rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-violet-100 text-violet-700 flex items-center justify-center">
              <BarChart3 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Share Link Telemetry & Analytics
              </h2>
              <p className="text-xs text-slate-500">
                Real-time recipient access tracking & device audit
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadAnalytics}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
              title="Refresh telemetry"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* File Card Info */}
          <div className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 text-xs">
            <div>
              <p className="font-bold text-slate-900">{file.fileName}</p>
              <p className="text-slate-500 text-[11px] mt-0.5 font-mono">
                Token: <span className="text-violet-700 font-semibold">{shareToken}</span> • {formatBytes(file.fileSize)}
              </p>
            </div>
            <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-violet-50 text-violet-700 border border-violet-200 capitalize">
              {file.shareInfo?.accessType || 'view'} Link
            </span>
          </div>

          {/* Metric Stats Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs">
              <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium mb-1">
                <Eye className="h-3.5 w-3.5 text-blue-600" />
                <span>Total Views</span>
              </div>
              <p className="text-2xl font-extrabold text-slate-900">
                {analytics?.viewsCount || 0}
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs">
              <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium mb-1">
                <Download className="h-3.5 w-3.5 text-emerald-600" />
                <span>Downloads</span>
              </div>
              <p className="text-2xl font-extrabold text-slate-900">
                {analytics?.downloadsCount || file.shareInfo?.downloadsCount || 0}
              </p>
            </div>

            <div className="col-span-2 sm:col-span-1 rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs">
              <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium mb-1">
                <Clock className="h-3.5 w-3.5 text-violet-600" />
                <span>Expiration</span>
              </div>
              <p className="text-xs font-semibold text-slate-800 truncate">
                {file.shareInfo?.expiresAt ? formatDate(file.shareInfo.expiresAt) : 'Never (Permanent)'}
              </p>
            </div>
          </div>

          {/* Detailed Access Log Table */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Globe className="h-3.5 w-3.5 text-violet-600" />
                <span>Access Telemetry Logs</span>
              </h3>
              <span className="text-[11px] text-slate-400 font-medium">
                {analytics?.accessLogs.length || 0} logged events
              </span>
            </div>

            {isLoading ? (
              <div className="py-12 text-center text-xs text-slate-400">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-violet-600 border-t-transparent mx-auto mb-2" />
                <span>Loading telemetry data...</span>
              </div>
            ) : error ? (
              <div className="p-4 text-center text-xs text-rose-600 rounded-xl bg-rose-50 border border-rose-200">
                {error}
              </div>
            ) : analytics && analytics.accessLogs.length > 0 ? (
              <div className="rounded-xl border border-slate-200 overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold text-[11px]">
                    <tr>
                      <th className="py-2.5 px-3.5">Action</th>
                      <th className="py-2.5 px-3.5">IP Address</th>
                      <th className="py-2.5 px-3.5">Device / Browser</th>
                      <th className="py-2.5 px-3.5 text-right">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {analytics.accessLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-2.5 px-3.5 font-medium">
                          {log.accessType === 'download' ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 uppercase">
                              <Download className="h-2.5 w-2.5" />
                              Downloaded
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-violet-700 bg-violet-50 px-2 py-0.5 rounded-full border border-violet-200 uppercase">
                              <Eye className="h-2.5 w-2.5" />
                              Viewed
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3.5 font-mono text-[11px] text-slate-700">
                          {log.ip}
                        </td>
                        <td className="py-2.5 px-3.5 text-slate-600">
                          <span className="font-semibold text-slate-800">{log.browser}</span> on {log.os}
                        </td>
                        <td className="py-2.5 px-3.5 text-right text-slate-400 font-mono text-[11px]">
                          {formatDate(log.timestamp)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-8 text-center text-slate-500 space-y-2">
                <Globe className="h-8 w-8 text-slate-300 mx-auto" />
                <p className="font-semibold text-slate-700 text-xs">No external access logged yet</p>
                <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                  When someone opens or downloads this file via your share link, their IP address, browser, and access timestamp will automatically appear here.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-6 py-3.5 text-xs text-slate-500">
          <span>Encrypted with SHA-256 token verification</span>
          <button
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white hover:bg-slate-100 px-4 py-1.5 font-semibold text-slate-700 transition-colors shadow-xs"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
