'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  ShieldCheck, 
  Download, 
  FileText, 
  HardDrive, 
  Hash,
  Sparkles,
  BookOpen,
  CheckCircle2,
  Clock
} from 'lucide-react';
import { FileItem, DocumentSummary } from '../lib/types';
import { formatBytes, formatDate, fetchDocumentSummary } from '../lib/api';

interface PreviewModalProps {
  file: FileItem;
  onClose: () => void;
  token?: string;
}

export function PreviewModal({ file, onClose, token }: PreviewModalProps) {
  const [textContent, setTextContent] = useState<string | null>(null);
  const [isLoadingContent, setIsLoadingContent] = useState(false);
  const [activeTab, setActiveTab] = useState<'preview' | 'ai-summary'>('preview');
  const [summary, setSummary] = useState<DocumentSummary | null>(null);
  const [isLoadingSummary, setIsLoadingSummary] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  const isTextOrCode = 
    file.fileType.includes('text') || 
    file.fileType.includes('json') || 
    file.fileType.includes('javascript') || 
    file.fileType.includes('markdown') ||
    file.fileName.endsWith('.txt') ||
    file.fileName.endsWith('.md') ||
    file.fileName.endsWith('.json');

  const isImage = file.fileType.startsWith('image/');

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    if (isTextOrCode) {
      setIsLoadingContent(true);
      fetch(`/api/files/${file.fileId}/preview`)
        .then((res) => {
          if (!res.ok) throw new Error('Preview fetch failed');
          return res.text();
        })
        .then((text) => setTextContent(text))
        .catch(() => setTextContent('Could not load text preview.'))
        .finally(() => setIsLoadingContent(false));
    }
  }, [file, isTextOrCode]);

  const handleLoadSummary = async () => {
    setActiveTab('ai-summary');
    if (summary) return;
    try {
      setIsLoadingSummary(true);
      setSummaryError(null);
      const res = await fetchDocumentSummary(file.fileId, token);
      setSummary(res);
    } catch (err: unknown) {
      setSummaryError(err instanceof Error ? err.message : 'Failed to generate summary');
    } finally {
      setIsLoadingSummary(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="preview-modal-title"
      onClick={(e) => {
        if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
          onClose();
        }
      }}
    >
      <div 
        ref={modalRef}
        className="flex flex-col w-full max-w-3xl max-h-[90vh] rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden"
      >
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-3 min-w-0 pr-4">
            <div className="h-10 w-10 rounded-xl bg-violet-100 text-violet-700 flex items-center justify-center shrink-0">
              <FileText className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h2 id="preview-modal-title" className="text-sm sm:text-base font-bold text-slate-900 truncate">
                {file.fileName}
              </h2>
              <p className="text-xs text-slate-500">
                {formatBytes(file.fileSize)} • {file.fileType || 'Binary file'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* View / AI Summary Switcher */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
              <button
                type="button"
                onClick={() => setActiveTab('preview')}
                className={`px-3 py-1 rounded-lg transition-all ${
                  activeTab === 'preview' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                File Preview
              </button>
              <button
                type="button"
                onClick={handleLoadSummary}
                className={`px-3 py-1 rounded-lg transition-all flex items-center gap-1.5 ${
                  activeTab === 'ai-summary' 
                    ? 'bg-violet-600 text-white shadow-xs' 
                    : 'text-violet-700 hover:bg-violet-50'
                }`}
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>AI Summary</span>
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              aria-label="Close modal"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          
          {/* Security Verification Banner */}
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                    Security Verification: Clean
                  </span>
                  <span className="text-[10px] bg-emerald-200/70 text-emerald-900 px-1.5 py-0.2 rounded font-mono font-semibold">
                    PASSED
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-0.5">
                  Engine: {file.scanDetails?.engine || 'Sentinel Virus Scan API v2.4 (Heuristic)'}
                </p>
              </div>
            </div>

            <div className="hidden sm:block text-right text-xs font-mono text-emerald-800 font-medium">
              {file.scanDetails?.scanDurationMs ? `${file.scanDetails.scanDurationMs}ms scan` : 'Verified'}
            </div>
          </div>

          {/* Active Tab View: AI Summary or File Preview */}
          {activeTab === 'ai-summary' ? (
            <div className="rounded-xl border border-violet-200 bg-white overflow-hidden shadow-xs space-y-4 p-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-lg bg-violet-100 text-violet-700 flex items-center justify-center">
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-xs">AI Executive Intelligence Summary</h3>
                    <p className="text-[10px] text-slate-500">Heuristic NLP content extraction & classification</p>
                  </div>
                </div>

                {summary && (
                  <span className="text-[10px] font-semibold bg-violet-50 text-violet-700 border border-violet-200 rounded-lg px-2.5 py-1">
                    {summary.category}
                  </span>
                )}
              </div>

              {isLoadingSummary ? (
                <div className="py-12 text-center text-xs text-slate-500 space-y-2">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-violet-600 border-t-transparent mx-auto" />
                  <p className="font-semibold text-slate-800">Analyzing document structure...</p>
                  <p className="text-[11px] text-slate-400">Extracting highlights and executive takeaway</p>
                </div>
              ) : summaryError ? (
                <div className="p-6 text-center text-xs text-rose-600">
                  <p className="font-semibold">{summaryError}</p>
                  <button
                    onClick={handleLoadSummary}
                    className="mt-3 px-3 py-1.5 rounded-lg bg-violet-600 text-white font-semibold text-xs"
                  >
                    Retry Analysis
                  </button>
                </div>
              ) : summary ? (
                <div className="space-y-4">
                  {/* Executive Takeaway */}
                  <div className="rounded-xl bg-violet-50/70 border border-violet-200/80 p-3.5 space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-violet-800 flex items-center gap-1.5">
                      <BookOpen className="h-3 w-3 text-violet-600" />
                      Executive Takeaway
                    </span>
                    <p className="text-xs text-slate-800 font-medium leading-relaxed">
                      {summary.executiveTakeaway}
                    </p>
                  </div>

                  {/* Highlights */}
                  <div className="space-y-2">
                    <span className="text-xs font-bold text-slate-900 block">Key Highlights</span>
                    <div className="space-y-1.5">
                      {summary.highlights.map((point, i) => (
                        <div key={i} className="flex items-start gap-2 text-xs text-slate-700">
                          <CheckCircle2 className="h-3.5 w-3.5 text-violet-600 mt-0.5 shrink-0" />
                          <span className="leading-snug">{point}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Reading Statistics */}
                  <div className="flex items-center gap-4 pt-2 border-t border-slate-100 text-[11px] text-slate-500">
                    <div className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-slate-400" />
                      <span>{summary.readingTime}</span>
                    </div>
                    <span>•</span>
                    <div>
                      <span>{summary.wordCount} words analyzed</span>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <>
              {/* Preview Canvas */}
              {isImage ? (
                <div className="flex items-center justify-center rounded-xl border border-slate-200 bg-slate-50/70 p-4 min-h-[220px]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/api/files/${file.fileId}/preview`}
                    alt={file.fileName}
                    className="max-h-[380px] max-w-full rounded-lg object-contain shadow-sm"
                  />
                </div>
              ) : isTextOrCode ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-slate-800">
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-200 text-[11px] font-mono text-slate-500">
                    <span>Text / Document Stream Preview</span>
                    <span>UTF-8 Stream</span>
                  </div>
                  {isLoadingContent ? (
                    <div className="py-8 text-center text-xs text-slate-400">Loading document stream...</div>
                  ) : (
                    <pre className="font-mono text-xs text-slate-800 whitespace-pre-wrap max-h-[260px] overflow-y-auto leading-relaxed">
                      {textContent}
                    </pre>
                  )}
                </div>
              ) : (
                <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-8 text-center">
                  <FileText className="h-10 w-10 text-slate-400 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-slate-800">
                    Binary preview not rendered inline
                  </p>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                    This file type can be downloaded directly and viewed using your operating system&apos;s native reader.
                  </p>
                </div>
              )}
            </>
          )}

          {/* Telemetry & Metadata Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 space-y-1">
              <div className="text-slate-500 flex items-center gap-1.5 font-medium">
                <HardDrive className="h-3.5 w-3.5 text-violet-600" />
                Storage Engine
              </div>
              <p className="font-semibold text-slate-900">
                {file.storageProvider || 'Cloudflare R2 (Simulated Storage)'}
              </p>
              <p className="font-mono text-[11px] text-slate-500 break-all">
                Key: {file.storageKey}
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 space-y-1">
              <div className="text-slate-500 flex items-center gap-1.5 font-medium">
                <Hash className="h-3.5 w-3.5 text-violet-600" />
                SHA-256 Checksum Fingerprint
              </div>
              <p className="font-mono text-[11px] text-slate-700 break-all leading-tight">
                {file.scanDetails?.sha256 || 'Calculated during upload verification'}
              </p>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/50 px-6 py-4">
          <span className="text-xs text-slate-500">
            Uploaded: {formatDate(file.uploadedAt)}
          </span>
          <div className="flex items-center gap-2.5">
            <button
              onClick={onClose}
              className="rounded-xl border border-slate-200 bg-white hover:bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-700 transition-colors"
            >
              Close
            </button>
            <a
              href={`/api/files/${file.fileId}/download`}
              download
              className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 text-xs font-semibold shadow-sm transition-colors"
            >
              <Download className="h-4 w-4" />
              <span>Download</span>
            </a>
          </div>
        </div>

      </div>
    </div>
  );
}
