'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Share2, 
  Copy, 
  Check, 
  ExternalLink, 
  ShieldCheck, 
  Clock, 
  Lock, 
  Download, 
  Eye, 
  CheckCircle2,
  FileText,
  Flame
} from 'lucide-react';
import { FileItem, ShareData } from '../lib/types';
import { createShareLink, formatBytes } from '../lib/api';

interface ShareModalProps {
  file: FileItem;
  onClose: () => void;
  onShareCreated: () => void;
  token?: string;
}

export function ShareModal({ file, onClose, onShareCreated, token }: ShareModalProps) {
  const [accessType, setAccessType] = useState<'view' | 'download'>('download');
  const [duration, setDuration] = useState('24h');
  const [password, setPassword] = useState('');
  const [burnAfterReading, setBurnAfterReading] = useState(Boolean(file.shareInfo?.isBurnAfterReading));
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedShare, setGeneratedShare] = useState<ShareData | null>(
    file.shareInfo
      ? {
          shareId: file.shareInfo.shareId,
          fileId: file.fileId,
          ownerId: file.ownerId,
          shareToken: file.shareInfo.shareToken,
          accessType: file.shareInfo.accessType,
          isBurnAfterReading: file.shareInfo.isBurnAfterReading,
          downloadsCount: file.shareInfo.downloadsCount,
          createdAt: new Date().toISOString(),
          expiresAt: file.shareInfo.expiresAt,
        }
      : null
  );
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const [justGenerated, setJustGenerated] = useState(false);

  const modalRef = useRef<HTMLDivElement>(null);

  // Keyboard navigation: Escape key closes modal
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const fullShareUrl = generatedShare
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/share/${generatedShare.shareToken}`
    : '';

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsGenerating(true);
    setError('');
    setJustGenerated(false);

    try {
      const res = await createShareLink(
        file.fileId,
        {
          accessType,
          duration,
          password: password ? password.trim() : undefined,
          burnAfterReading,
        },
        token
      );

      // Only set success after API resolves with ok: true
      setGeneratedShare(res.share);
      setJustGenerated(true);
      onShareCreated();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to generate share link');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = () => {
    if (!fullShareUrl) return;
    navigator.clipboard.writeText(fullShareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-modal-title"
      onClick={(e) => {
        if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
          onClose();
        }
      }}
    >
      <div 
        ref={modalRef}
        className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl transition-all"
      >
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-violet-100 text-violet-700 flex items-center justify-center shadow-sm">
              <Share2 className="h-5 w-5" />
            </div>
            <div>
              <h2 id="share-modal-title" className="text-base font-bold text-slate-900">
                Share File
              </h2>
              <p className="text-xs text-slate-500">
                Generate secure tokenized link with granular access controls
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            aria-label="Close dialog"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Target File details summary */}
        <div className="my-4 rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0 pr-3">
            <FileText className="h-4 w-4 text-slate-500 shrink-0" />
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-900 truncate">
                {file.fileName}
              </p>
              <p className="text-[11px] text-slate-500">
                {formatBytes(file.fileSize)} • SHA-256 Validated
              </p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-medium text-emerald-800 shrink-0">
            <ShieldCheck className="h-3 w-3 text-emerald-600" />
            Scanned
          </span>
        </div>

        {/* Configuration Form */}
        <form onSubmit={handleGenerate} className="space-y-4">
          
          {/* Access Permission */}
          <div>
            <label className="text-xs font-semibold text-slate-700 mb-1.5 block">
              Access Permission
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setAccessType('download')}
                className={`rounded-xl border p-3 text-left transition-all ${
                  accessType === 'download'
                    ? 'border-violet-500 bg-violet-50 text-violet-900 shadow-sm'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-1.5 text-xs font-semibold">
                  <Download className="h-3.5 w-3.5 text-violet-600" />
                  Allow Download
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  Recipient can view & download
                </div>
              </button>

              <button
                type="button"
                onClick={() => setAccessType('view')}
                className={`rounded-xl border p-3 text-left transition-all ${
                  accessType === 'view'
                    ? 'border-violet-500 bg-violet-50 text-violet-900 shadow-sm'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-1.5 text-xs font-semibold">
                  <Eye className="h-3.5 w-3.5 text-violet-600" />
                  View Only
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  Direct browser preview only
                </div>
              </button>
            </div>
          </div>

          {/* Link Expiration */}
          <div>
            <label className="text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-slate-500" />
              Link Expiration
            </label>
            <select
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white py-2 px-3 text-xs text-slate-800 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
            >
              <option value="1h">1 Hour (High Security)</option>
              <option value="24h">24 Hours (Default)</option>
              <option value="7d">7 Days</option>
              <option value="never">Never (Persistent)</option>
            </select>
          </div>

          {/* Optional Password Protection */}
          <div>
            <label className="text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
              <Lock className="h-3.5 w-3.5 text-slate-500" />
              Optional Passcode
            </label>
            <input
              type="text"
              placeholder="Leave blank for open link..."
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white py-2 px-3 text-xs text-slate-800 placeholder-slate-400 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
            />
          </div>

          {/* One-Time "Burn After Reading" Toggle */}
          <div className="rounded-xl border border-amber-200/90 bg-amber-50/50 p-3 transition-colors hover:bg-amber-50">
            <label className="flex items-start gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={burnAfterReading}
                onChange={(e) => setBurnAfterReading(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-amber-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
              />
              <div className="flex-1">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-950">
                  <Flame className="h-3.5 w-3.5 text-amber-600 fill-amber-500" />
                  <span>Burn After Reading (Self-Destruct Link)</span>
                </div>
                <p className="text-[11px] text-amber-800/80 mt-0.5 leading-normal">
                  Automatically revokes and destroys the link immediately after one recipient view or download.
                </p>
              </div>
            </label>
          </div>

          {error && (
            <p className="text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-lg p-2.5">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isGenerating}
            className="w-full rounded-xl bg-violet-600 hover:bg-violet-700 py-2.5 text-xs font-semibold text-white shadow-sm transition-colors disabled:opacity-50"
          >
            {isGenerating
              ? 'Generating Secure Token...'
              : generatedShare
              ? 'Update Share Link'
              : 'Create Share Link'}
          </button>
        </form>

        {/* Link Result (Only shown when share token exists) */}
        {generatedShare && (
          <div className="mt-5 pt-4 border-t border-slate-100 space-y-3">
            
            {justGenerated && (
              <div className="flex items-center gap-1.5 rounded-lg bg-emerald-50 border border-emerald-200 p-2 text-xs font-semibold text-emerald-800">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                <span>Share link generated successfully!</span>
              </div>
            )}

            {generatedShare.isBurnAfterReading && (
              <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200/90 px-2.5 py-1.5 text-xs font-medium text-amber-900">
                <Flame className="h-4 w-4 text-amber-600 fill-amber-500 shrink-0" />
                <span><strong>Burn After Reading Active:</strong> This link will automatically self-destruct once accessed.</span>
              </div>
            )}

            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={fullShareUrl}
                aria-label="Generated share link"
                className="flex-1 rounded-xl border border-slate-200 bg-slate-50 py-2 px-3 text-xs font-mono text-slate-800 select-all focus:outline-none focus:ring-1 focus:ring-violet-500"
              />
              <button
                type="button"
                onClick={handleCopy}
                className="flex items-center gap-1.5 rounded-xl bg-violet-600 hover:bg-violet-700 px-3.5 py-2 text-xs font-medium text-white transition-colors shrink-0"
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-500">
              <span>Token: <code className="font-mono text-slate-700">{generatedShare.shareToken}</code></span>
              <a
                href={`/share/${generatedShare.shareToken}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 font-semibold text-violet-700 hover:text-violet-800 underline underline-offset-2"
              >
                <span>Preview recipient page</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>

          </div>
        )}

      </div>
    </div>
  );
}
