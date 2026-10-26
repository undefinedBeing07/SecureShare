'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { 
  ShieldCheck, 
  Download, 
  FileText, 
  Lock, 
  Clock, 
  AlertTriangle, 
  Eye, 
  EyeOff,
  Key,
  ArrowLeft, 
  Image as ImageIcon,
  Video,
  Music,
  FileCode,
  File,
  Flame
} from 'lucide-react';
import { formatBytes, formatDate, verifySharePassword } from '../../../lib/api';

interface SharedFileResponse {
  valid: boolean;
  share: {
    shareToken: string;
    accessType: 'view' | 'download';
    expiresAt: string | null;
    hasPassword: boolean;
    isBurnAfterReading?: boolean;
    downloadsCount: number;
    createdAt: string;
  };
  file: {
    fileName: string;
    fileType: string;
    fileSize: number;
    scanStatus: string;
    scanDetails: {
      engine?: string;
      sha256?: string;
      scannedAt?: string;
    };
    ownerName: string;
    uploadedAt: string;
  };
}

export default function ShareRecipientPage() {
  const routeParams = useParams();
  const token = typeof routeParams?.token === 'string' ? routeParams.token : Array.isArray(routeParams?.token) ? routeParams.token[0] : '';
  const [data, setData] = useState<SharedFileResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const fetchTextPreview = (fileToken: string, fileData: SharedFileResponse, pass = '') => {
    const mime = (fileData.file.fileType || '').toLowerCase();
    const name = (fileData.file.fileName || '').toLowerCase();
    const ext = name.split('.').pop() || '';
    const isTextLike = 
      mime.includes('text') || 
      mime.includes('markdown') || 
      mime.includes('json') || 
      mime.includes('csv') || 
      ['txt', 'md', 'csv', 'json', 'log', 'xml', 'yaml', 'yml', 'js', 'ts', 'html', 'css'].includes(ext);

    if (isTextLike) {
      setIsLoadingPreview(true);
      const queryParam = pass ? `?password=${encodeURIComponent(pass)}` : '';
      fetch(`/api/share/${fileToken}/preview${queryParam}`)
        .then(async (r) => {
          if (!r.ok) {
            const errJson = await r.json().catch(() => ({}));
            throw new Error(errJson.error || `Failed to stream content (${r.status})`);
          }
          return r.text();
        })
        .then((t) => setPreviewContent(t))
        .catch((err: unknown) => {
          setPreviewError(err instanceof Error ? err.message : 'Could not load document preview.');
        })
        .finally(() => setIsLoadingPreview(false));
    }
  };

  useEffect(() => {
    async function loadShared() {
      try {
        setLoading(true);
        const res = await fetch(`/api/share/${token}`);
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || 'This link has expired or does not exist.');
        }
        const json: SharedFileResponse = await res.json();
        setData(json);

        if (!json.share.hasPassword) {
          setIsUnlocked(true);
          fetchTextPreview(token, json, '');
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }

    if (token) {
      loadShared();
    }
  }, [token]);

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      setPasswordError('Please enter the access passcode');
      return;
    }
    try {
      setIsVerifying(true);
      setPasswordError('');
      await verifySharePassword(token, password);
      setIsUnlocked(true);
      if (data) {
        fetchTextPreview(token, data, password);
      }
    } catch (err: unknown) {
      setPasswordError(err instanceof Error ? err.message : 'Invalid passcode');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleDownload = () => {
    if (!data) return;
    const downloadUrl = `/api/share/${token}/download${password ? `?password=${encodeURIComponent(password)}` : ''}`;
    window.location.href = downloadUrl;
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-[#F8F9FA] flex items-center justify-center p-4">
        <div className="text-center text-slate-500">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-violet-600 border-t-transparent mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-800">Verifying secure share token...</p>
          <p className="text-xs text-slate-500 mt-1">Validating token permissions & security clearance</p>
        </div>
      </main>
    );
  }

  if (error || !data) {
    const isBurnedError = error && (error.toLowerCase().includes('self-destructed') || error.toLowerCase().includes('burn'));

    return (
      <main className="min-h-screen bg-[#F8F9FA] flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 text-center shadow-lg">
          <div className={`mx-auto flex h-14 w-14 items-center justify-center rounded-2xl mb-4 border ${
            isBurnedError ? 'bg-amber-50 text-amber-600 border-amber-200' : 'bg-rose-50 text-rose-600 border-rose-200'
          }`}>
            {isBurnedError ? (
              <Flame className="h-7 w-7 text-amber-600 fill-amber-500" />
            ) : (
              <AlertTriangle className="h-7 w-7" />
            )}
          </div>
          <h1 className="text-lg font-bold text-slate-900">
            {isBurnedError ? '🔥 Link Has Self-Destructed' : 'Share Link Unavailable'}
          </h1>
          <p className="mt-2 text-xs text-slate-600 leading-relaxed">
            {isBurnedError 
              ? 'This file was shared using one-time "Burn After Reading" protection. It has already been accessed and permanently destroyed.'
              : (error || 'The requested file could not be accessed. It may have expired, reached its download limit, or been removed by its owner.')}
          </p>
          <div className="mt-6">
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-xl bg-violet-600 hover:bg-violet-700 px-4 py-2 text-xs font-semibold text-white shadow-sm transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Return to Vaultspace</span>
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const { file, share } = data;
  const mime = (file.fileType || '').toLowerCase();
  const name = (file.fileName || '').toLowerCase();
  const ext = name.split('.').pop() || '';

  const isPdf = mime.includes('pdf') || ext === 'pdf';
  const isImage = mime.startsWith('image/') || ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp'].includes(ext);
  const isVideo = mime.startsWith('video/') || ['mp4', 'webm', 'ogg', 'mov'].includes(ext);
  const isAudio = mime.startsWith('audio/') || ['mp3', 'wav', 'ogg', 'm4a', 'flac'].includes(ext);
  const isTextDocument = 
    mime.includes('text') || 
    mime.includes('markdown') || 
    mime.includes('json') || 
    mime.includes('csv') || 
    ['txt', 'md', 'csv', 'json', 'log', 'xml', 'yaml', 'yml', 'js', 'ts', 'html', 'css'].includes(ext);

  const isUnsupported = !isPdf && !isImage && !isVideo && !isAudio && !isTextDocument;
  const isDownloadAllowed = share.accessType === 'download';

  const getHeaderIcon = () => {
    if (isImage) return <ImageIcon className="h-7 w-7 text-purple-600" />;
    if (isPdf) return <FileText className="h-7 w-7 text-rose-600" />;
    if (isVideo) return <Video className="h-7 w-7 text-amber-600" />;
    if (isAudio) return <Music className="h-7 w-7 text-indigo-600" />;
    if (isTextDocument) return <FileCode className="h-7 w-7 text-blue-600" />;
    return <File className="h-7 w-7 text-slate-600" />;
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-slate-900 flex flex-col justify-between p-4 sm:p-6 md:p-8">
      
      {/* Top Header */}
      <header className="mx-auto w-full max-w-3xl flex items-center justify-between pb-6 border-b border-slate-200">
        <Link 
          href="/" 
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>SecureShare Platform</span>
        </Link>
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-violet-100 text-violet-700 flex items-center justify-center">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <span className="text-xs font-bold text-slate-800">Secure Recipient Portal</span>
        </div>
      </header>

      {/* Main Recipient Card */}
      <main className="my-auto mx-auto w-full max-w-3xl py-8">
        <div className="rounded-2xl border border-slate-200 bg-white shadow-md overflow-hidden">
          
          {/* Clearance Header Banner */}
          <div className="border-b border-emerald-200 bg-emerald-50/80 px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0">
                <ShieldCheck className="h-4 w-4" />
              </div>
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                  Security Clearance: Clean
                </span>
                <p className="text-[11px] text-slate-600">
                  Validated by {file.scanDetails.engine || 'Sentinel Virus Scan API'}
                </p>
              </div>
            </div>
            {share.expiresAt && (
              <div className="flex items-center gap-1.5 text-xs font-mono text-slate-600 bg-white/70 px-2.5 py-1 rounded-lg border border-slate-200/80">
                <Clock className="h-3.5 w-3.5 text-violet-600" />
                <span>Expires: {formatDate(share.expiresAt)}</span>
              </div>
            )}
          </div>

          {/* Burn After Reading Single-Use Warning */}
          {share.isBurnAfterReading && (
            <div className="border-b border-amber-200 bg-amber-50/90 px-6 py-2.5 flex items-center gap-2.5 text-xs text-amber-950 font-medium">
              <Flame className="h-4 w-4 text-amber-600 fill-amber-500 shrink-0 animate-pulse" />
              <span>
                <strong>Burn After Reading Active:</strong> This link is strictly single-use. Closing or refreshing this window permanently destroys access.
              </span>
            </div>
          )}

          {/* File Card Details */}
          <div className="p-6 sm:p-8 space-y-6">
            
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-4 min-w-0">
                <div className="h-14 w-14 rounded-2xl bg-violet-50 border border-violet-200/60 flex items-center justify-center shrink-0">
                  {getHeaderIcon()}
                </div>
                <div className="min-w-0">
                  <h1 className="text-lg sm:text-xl font-bold text-slate-900 truncate">
                    {file.fileName}
                  </h1>
                  <p className="text-xs text-slate-500 mt-1">
                    {formatBytes(file.fileSize)} • Shared by <strong className="text-slate-700">{file.ownerName}</strong>
                  </p>
                </div>
              </div>

              <div className="hidden sm:block text-right shrink-0">
                <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 border border-violet-200 px-3 py-1 text-xs font-semibold text-violet-700">
                  {share.accessType === 'download' ? 'Download Permitted' : 'View Only Link'}
                </span>
              </div>
            </div>

            {/* PASSCODE CHALLENGE SCREEN (When password required and not yet unlocked) */}
            {share.hasPassword && !isUnlocked ? (
              <div className="rounded-2xl border border-violet-200 bg-violet-50/50 p-6 sm:p-8 text-center space-y-4">
                <div className="mx-auto h-12 w-12 rounded-2xl bg-violet-600 text-white flex items-center justify-center shadow-md">
                  <Lock className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">Passcode Protected Document</h2>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                    The author has restricted access to this file. Enter the security passcode to view and download this file.
                  </p>
                </div>

                <form onSubmit={handleUnlock} className="max-w-xs mx-auto space-y-3 pt-2">
                  <div className="relative">
                    <Key className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setPasswordError('');
                      }}
                      placeholder="Enter security passcode..."
                      className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-10 text-xs text-slate-900 placeholder-slate-400 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20 shadow-xs"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                  </div>

                  {passwordError && (
                    <div className="rounded-lg bg-rose-50 border border-rose-200 p-2 text-[11px] text-rose-700 font-medium">
                      {passwordError}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isVerifying}
                    className="w-full rounded-xl bg-violet-600 hover:bg-violet-700 text-white py-2 text-xs font-semibold shadow-sm shadow-violet-500/20 transition-all flex items-center justify-center gap-1.5 disabled:opacity-60"
                  >
                    {isVerifying ? (
                      <>
                        <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        <span>Verifying...</span>
                      </>
                    ) : (
                      <>
                        <Lock className="h-3.5 w-3.5" />
                        <span>Unlock & Access Document</span>
                      </>
                    )}
                  </button>
                </form>
              </div>
            ) : (
              <>
                {/* 1. PDF Viewer */}
                {isPdf && (
                  <div className="rounded-xl border border-slate-200 overflow-hidden bg-slate-100 shadow-sm">
                    <div className="bg-slate-50 border-b border-slate-200 px-4 py-2.5 flex items-center justify-between text-xs text-slate-600 font-mono">
                      <span className="font-semibold text-slate-700 flex items-center gap-2">
                        <FileText className="h-3.5 w-3.5 text-rose-600" />
                        Embedded PDF Document Viewer
                      </span>
                      <span>{formatBytes(file.fileSize)}</span>
                    </div>
                    <div className="relative w-full h-[620px] bg-slate-200/60">
                      <iframe
                        src={`/api/share/${token}/preview${password ? `?password=${encodeURIComponent(password)}` : ''}#toolbar=0`}
                        className="w-full h-full border-0"
                        title={file.fileName}
                      />
                    </div>
                  </div>
                )}

                {/* 2. Image Viewer */}
                {isImage && (
                  <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 flex items-center justify-center min-h-[260px] overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`/api/share/${token}/preview${password ? `?password=${encodeURIComponent(password)}` : ''}`}
                      alt={file.fileName}
                      className="max-h-[600px] w-auto max-w-full rounded-lg object-contain shadow-sm"
                    />
                  </div>
                )}

            {/* 3. Text / Markdown / Code / JSON / CSV Viewer */}
            {isTextDocument && (
              <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
                <div className="bg-slate-50 border-b border-slate-200 px-4 py-2.5 flex items-center justify-between text-xs font-mono text-slate-500">
                  <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                    <FileCode className="h-3.5 w-3.5 text-blue-600" />
                    {file.fileName}
                  </span>
                  <span>Complete Document ({formatBytes(file.fileSize)})</span>
                </div>
                {isLoadingPreview ? (
                  <div className="p-12 text-center text-xs text-slate-500">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-violet-600 border-t-transparent mx-auto mb-2" />
                    <span>Loading document content...</span>
                  </div>
                ) : previewError ? (
                  <div className="p-8 text-center text-xs text-rose-600">{previewError}</div>
                ) : (
                  <div className="p-4 max-h-[550px] overflow-y-auto bg-slate-50/40">
                    <pre className="font-mono text-xs text-slate-800 whitespace-pre-wrap leading-relaxed select-text">
                      {previewContent || '(Empty document)'}
                    </pre>
                  </div>
                )}
              </div>
            )}

            {/* 4. Video Player */}
            {isVideo && (
              <div className="rounded-xl border border-slate-200 bg-black overflow-hidden shadow-sm">
                <video
                  controls
                  controlsList={!isDownloadAllowed ? 'nodownload' : undefined}
                  className="w-full max-h-[500px]"
                  src={`/api/share/${token}/preview${password ? `?password=${encodeURIComponent(password)}` : ''}`}
                >
                  Your browser does not support video playback.
                </video>
              </div>
            )}

            {/* 5. Audio Player */}
            {isAudio && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 shadow-sm flex flex-col items-center justify-center gap-3">
                <div className="h-14 w-14 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-600 flex items-center justify-center">
                  <Music className="h-7 w-7" />
                </div>
                <p className="text-xs font-semibold text-slate-800">{file.fileName}</p>
                <audio
                  controls
                  controlsList={!isDownloadAllowed ? 'nodownload' : undefined}
                  className="w-full max-w-md mt-2"
                  src={`/api/share/${token}/preview${password ? `?password=${encodeURIComponent(password)}` : ''}`}
                >
                  Your browser does not support audio playback.
                </audio>
              </div>
            )}

            {/* 6. Unsupported format (DOCX, etc.) */}
            {isUnsupported && (
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-8 text-center space-y-3">
                <div className="h-12 w-12 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200/80 flex items-center justify-center mx-auto">
                  <File className="h-6 w-6" />
                </div>
                <h3 className="text-sm font-bold text-slate-900">
                  Inline Browser Preview Unavailable
                </h3>
                <p className="text-xs text-slate-600 max-w-md mx-auto leading-relaxed">
                  {isDownloadAllowed
                    ? `Browser preview is not available for this file format (${ext ? `.${ext}` : 'binary'}). You can download the file below to view it using your desktop application.`
                    : `Browser preview is not available for this file format (${ext ? `.${ext}` : 'binary'}), and direct file downloads have been restricted by the owner.`}
                </p>
              </div>
            )}
              </>
            )}

            {/* Action Bar */}
            <div className="pt-3 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-100">
              <div className="text-xs text-slate-500 font-mono text-center sm:text-left">
                SHA-256: <span className="text-slate-700">{file.scanDetails.sha256?.substring(0, 24)}...</span>
              </div>

              {isDownloadAllowed ? (
                <button
                  type="button"
                  onClick={handleDownload}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 hover:bg-violet-700 px-6 py-2.5 text-xs font-semibold text-white shadow-sm shadow-violet-500/20 transition-all"
                >
                  <Download className="h-4 w-4" />
                  <span>Download File</span>
                </button>
              ) : (
                <div className="inline-flex items-center gap-2 text-xs font-medium text-amber-800 bg-amber-50 border border-amber-200 px-3.5 py-2 rounded-xl">
                  <Eye className="h-4 w-4 text-amber-600" />
                  <span>View Only: Direct file downloads have been restricted by the owner.</span>
                </div>
              )}
            </div>

          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="mx-auto w-full max-w-3xl text-center text-xs text-slate-500 pt-4 border-t border-slate-200">
        SecureShare • Zero-Trust Cloud Storage & Malware Verification Engine
      </footer>

    </div>
  );
}
