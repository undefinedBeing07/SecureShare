'use client';

import React, { useEffect, useRef } from 'react';
import { 
  X, 
  ShieldAlert, 
  Activity, 
  Clock, 
  FileText, 
  Share2, 
  Trash2, 
  UploadCloud,
  Bug
} from 'lucide-react';
import { AuditLog } from '../lib/types';
import { formatDate } from '../lib/api';

interface AuditDrawerProps {
  logs: AuditLog[];
  onClose: () => void;
}

export function AuditDrawer({ logs, onClose }: AuditDrawerProps) {
  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const getEventBadge = (action: string, isBlocked: boolean, isTest: boolean) => {
    if (isBlocked) {
      if (isTest) {
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800">
            <Bug className="h-3 w-3 text-emerald-600" />
            <span>Malware Test Passed</span>
          </span>
        );
      }
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 border border-rose-200 px-2.5 py-0.5 text-[11px] font-semibold text-rose-800">
          <ShieldAlert className="h-3 w-3 text-rose-600" />
          <span>Threat Quarantined</span>
        </span>
      );
    }

    if (action === 'FILE_UPLOAD') {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800">
          <UploadCloud className="h-3 w-3 text-emerald-600" />
          <span>Upload Verified</span>
        </span>
      );
    }

    if (action === 'SHARE_CREATE') {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 border border-violet-200 px-2.5 py-0.5 text-[11px] font-semibold text-violet-800">
          <Share2 className="h-3 w-3 text-violet-600" />
          <span>Link Created</span>
        </span>
      );
    }

    if (action === 'FILE_DELETE') {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 border border-slate-200 px-2.5 py-0.5 text-[11px] font-semibold text-slate-700">
          <Trash2 className="h-3 w-3 text-slate-500" />
          <span>Object Purged</span>
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-700">
        <Activity className="h-3 w-3 text-slate-500" />
        <span>{action}</span>
      </span>
    );
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="audit-drawer-title"
      onClick={(e) => {
        if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) {
          onClose();
        }
      }}
    >
      <aside 
        ref={drawerRef}
        className="w-full max-w-lg h-full border-l border-slate-200 bg-white flex flex-col shadow-2xl animate-in slide-in-from-right duration-200"
      >
        
        {/* Drawer Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-violet-100 text-violet-700 flex items-center justify-center">
              <Activity className="h-5 w-5" />
            </div>
            <div>
              <h2 id="audit-drawer-title" className="text-sm sm:text-base font-bold text-slate-900">
                Security & Audit Activity
              </h2>
              <p className="text-xs text-slate-500">
                Real-time security telemetry & access events
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            aria-label="Close activity drawer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Telemetry Summary Banner */}
        <div className="px-6 py-3 bg-slate-50/70 border-b border-slate-100 flex items-center justify-between text-xs text-slate-600">
          <span>Logged Events: <strong className="text-slate-900">{logs.length}</strong></span>
          <span className="flex items-center gap-1.5 text-emerald-700 font-medium">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            Live Event Stream
          </span>
        </div>

        {/* Activity Feed */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {logs.length === 0 ? (
            <div className="py-16 text-center text-slate-400">
              <Activity className="h-8 w-8 mx-auto mb-2 text-slate-300" />
              <p className="text-sm font-semibold text-slate-700">No security events recorded yet</p>
              <p className="text-xs text-slate-500 mt-1">
                Upload a file or run the malware scanner test to generate real-time audit records.
              </p>
            </div>
          ) : (
            logs.map((log) => {
              const isBlocked = log.action === 'VIRUS_BLOCKED' || log.status === 'INFECTED';
              const isTest = Boolean(
                (log.fileName && log.fileName.toLowerCase().includes('eicar')) ||
                (log.threats && log.threats.some((t) => t.toLowerCase().includes('eicar') || t.toLowerCase().includes('test')))
              );

              return (
                <div
                  key={log.id}
                  className={`rounded-xl border p-4 text-xs transition-all ${
                    isBlocked
                      ? isTest
                        ? 'border-emerald-200 bg-emerald-50/50'
                        : 'border-rose-200 bg-rose-50/50'
                      : 'border-slate-200 bg-white hover:bg-slate-50/60'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    {getEventBadge(log.action, isBlocked, isTest)}
                    <span className="text-[11px] text-slate-400 flex items-center gap-1 font-mono">
                      <Clock className="h-3 w-3" />
                      {formatDate(log.timestamp)}
                    </span>
                  </div>

                  {log.fileName && (
                    <div className="flex items-center gap-2 font-medium text-slate-800">
                      <FileText className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{log.fileName}</span>
                    </div>
                  )}

                  {log.threats && log.threats.length > 0 && (
                    <div className="mt-2.5 rounded-lg bg-white border border-slate-200 p-2.5 text-[11px] font-mono text-rose-700 space-y-1">
                      <div className="font-semibold text-slate-700">Intercepted Signatures:</div>
                      {log.threats.map((threat, idx) => (
                        <div key={idx} className="flex items-center gap-1.5">
                          <span className="h-1.5 w-1.5 rounded-full bg-rose-500 shrink-0" />
                          <span className="break-all">{threat}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
                    <span>Event ID: <code className="text-slate-600">{log.id}</code></span>
                    <span>Result: <strong className="text-slate-700">{log.status || (isBlocked ? 'INFECTED_QUARANTINE' : 'SUCCESS')}</strong></span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-100 bg-slate-50/60 p-4 text-center text-xs text-slate-500">
          Persistent audit logs indexed in database metadata stream
        </div>

      </aside>
    </div>
  );
}
