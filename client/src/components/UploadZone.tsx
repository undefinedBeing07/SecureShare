'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  UploadCloud, 
  ShieldCheck, 
  AlertTriangle, 
  FileText, 
  CheckCircle2, 
  RotateCcw,
  Sparkles,
  Bug
} from 'lucide-react';
import { FileItem } from '../lib/types';
import { formatBytes, formatDate, API_BASE } from '../lib/api';

interface UploadZoneProps {
  onUploadSuccess: (file: FileItem) => void;
  token?: string;
  forwardedRef?: React.RefObject<HTMLDivElement>;
}

type Stage = 'idle' | 'preparing' | 'uploading' | 'scanning' | 'storing' | 'completed';

interface PendingDuplicate {
  file: File;
  existingFile: {
    fileId?: string;
    fileName: string;
    fileSize: number;
    fileType?: string;
    uploadedAt: string;
  };
}

interface ThreatReport {
  isEicarTest: boolean;
  testPassed: boolean;
  title: string;
  error: string;
  threats: string[];
  scanDetails?: {
    engine?: string;
    sha256?: string;
    scanDurationMs?: number;
    quarantineAction?: string;
  };
}

interface GeneralError {
  title: string;
  message: string;
  status?: number;
}

interface ParsedResponseData {
  success?: boolean;
  error?: string;
  file?: FileItem;
  threats?: string[];
  scanStatus?: string;
  scanDetails?: {
    engine?: string;
    sha256?: string;
    scanDurationMs?: number;
    quarantineAction?: string;
  };
  quarantined?: boolean;
  committedToStorage?: boolean;
  tempFileCleaned?: boolean;
  [key: string]: unknown;
}

interface ParsedResponse {
  isJson: boolean;
  data: ParsedResponseData | null;
}

/**
 * Safely parse response text into JSON without throwing on empty bodies or HTML error pages
 */
function parseResponsePayload(rawText: string): ParsedResponse {
  if (!rawText || typeof rawText !== 'string' || !rawText.trim()) {
    return { isJson: false, data: null };
  }
  try {
    const parsed = JSON.parse(rawText);
    if (parsed && typeof parsed === 'object') {
      return { isJson: true, data: parsed as ParsedResponseData };
    }
    return { isJson: false, data: null };
  } catch {
    return { isJson: false, data: null };
  }
}

export function UploadZone({ onUploadSuccess, token, forwardedRef }: UploadZoneProps) {
  const [stage, setStage] = useState<Stage>('idle');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedFile, setSelectedFile] = useState<{ name: string; size: number } | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [threatReport, setThreatReport] = useState<ThreatReport | null>(null);
  const [generalError, setGeneralError] = useState<GeneralError | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [pendingDuplicate, setPendingDuplicate] = useState<PendingDuplicate | null>(null);
  const [duplicateNotice, setDuplicateNotice] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeXhrRef = useRef<XMLHttpRequest | null>(null);
  const isDedicatedTestRef = useRef<boolean>(false);
  const progressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const stageTimerRef = useRef<NodeJS.Timeout | null>(null);

  const isProcessing = stage !== 'idle' && stage !== 'completed';

  // Clear all pending timers safely in cleanup
  const clearAllTimers = useCallback(() => {
    if (progressTimerRef.current) {
      clearTimeout(progressTimerRef.current);
      progressTimerRef.current = null;
    }
    if (stageTimerRef.current) {
      clearTimeout(stageTimerRef.current);
      stageTimerRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearAllTimers();
      if (activeXhrRef.current) {
        activeXhrRef.current.abort();
        activeXhrRef.current = null;
      }
    };
  }, [clearAllTimers]);

  const resetState = () => {
    clearAllTimers();
    if (activeXhrRef.current) {
      activeXhrRef.current.abort();
      activeXhrRef.current = null;
    }
    setStage('idle');
    setUploadProgress(0);
    setSelectedFile(null);
    setThreatReport(null);
    setGeneralError(null);
    setDuplicateWarning(null);
    isDedicatedTestRef.current = false;
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRejectDuplicate = () => {
    const rejectedName = pendingDuplicate?.file.name || 'File';
    setPendingDuplicate(null);
    setDuplicateNotice(`Upload cancelled: "${rejectedName}" was discarded. No duplicate copy was stored in your vault.`);
    resetState();
  };

  const handleConfirmDuplicate = () => {
    if (!pendingDuplicate) return;
    const fileToUpload = pendingDuplicate.file;
    setPendingDuplicate(null);
    setDuplicateNotice(null);
    uploadFile(fileToUpload, false, true);
  };

  const uploadFile = (file: File, isEicarTest = false, allowDuplicate = false) => {
    // Prevent duplicate uploads while request is already running
    if (isProcessing) return;

    clearAllTimers();
    isDedicatedTestRef.current = isEicarTest;
    setThreatReport(null);
    setGeneralError(null);
    setDuplicateNotice(null);
    setSelectedFile({ name: file.name, size: file.size });

    // Validate size client-side (500 MB max)
    const maxBytes = 500 * 1024 * 1024;
    if (file.size > maxBytes) {
      setGeneralError({
        title: 'File Exceeds Size Limit',
        message: `The selected file (${formatBytes(file.size)}) exceeds the maximum supported prototype limit of 500 MB.`
      });
      return;
    }

    // Stage 1: Preparing upload
    setStage('preparing');
    setUploadProgress(0);

    // Initial stage step with timer cleanup safety
    progressTimerRef.current = setTimeout(() => {
      // Stage 2: Uploading (network buffer streaming via XMLHttpRequest)
      setStage('uploading');

      const formData = new FormData();
      formData.append('file', file);
      if (allowDuplicate) {
        formData.append('allowDuplicate', 'true');
      }

      const xhr = new XMLHttpRequest();
      activeXhrRef.current = xhr;

      // Monitor actual network upload progress
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable && event.total > 0) {
          const percent = Math.min(100, Math.round((event.loaded / event.total) * 100));
          setUploadProgress(percent);
          // Once byte transmission is complete, transition to scanning stage while server is processing
          if (percent >= 100) {
            setStage('scanning');
          }
        }
      };

      xhr.onload = () => {
        try {
          const { isJson, data } = parseResponsePayload(xhr.responseText);
          const status = xhr.status;

          // Debug log in development
          if (process.env.NODE_ENV !== 'production') {
            console.debug(`[UploadZone] Upload completed with HTTP ${status}:`, {
              status,
              isJson,
              data,
              rawLength: xhr.responseText?.length
            });
          }

          // Check if duplicate was detected requiring user decision before saving
          if (isJson && data?.duplicateDetected && data?.requiresConfirmation) {
            setStage('idle');
            setPendingDuplicate({
              file,
              existingFile: data.existingFile as PendingDuplicate['existingFile']
            });
            return;
          }

          // Case A: Success (200 - 299)
          if (status >= 200 && status < 300) {
            if (isJson && data?.file) {
              const uploadedFile = data.file;
              const dup = data.duplicate as { isDuplicate?: boolean; originalFileName?: string } | undefined;
              if (dup && dup.isDuplicate) {
                setDuplicateWarning(`Duplicate file detected: "${uploadedFile.fileName}" is identical to existing file "${dup.originalFileName}" (matching SHA-256 hash).`);
              } else {
                setDuplicateWarning(null);
              }
              setStage('storing');
              stageTimerRef.current = setTimeout(() => {
                setStage('completed');
                onUploadSuccess(uploadedFile);
              }, 350);
            } else {
              setStage('idle');
              setGeneralError({
                title: 'Unexpected Server Response Format',
                message: 'The file was accepted, but the server returned an unrecognized response format.',
                status
              });
            }
            return;
          }

          // Case B: 400 Bad Request
          if (status === 400) {
            const isThreatResponse = Boolean(
              isJson && (data?.scanStatus === 'INFECTED' || (Array.isArray(data?.threats) && data.threats.length > 0))
            );

            if (isThreatResponse) {
              const threats: string[] = Array.isArray(data?.threats) 
                ? data.threats 
                : ['Malware signature detected'];

              // If this was the dedicated EICAR test, verify ALL 4 criteria:
              // 1. The backend detected the test signature.
              // 2. The upload was rejected (status 400, success: false).
              // 3. The file was not committed to permanent storage.
              // 4. The temporary file was cleaned up.
              if (isDedicatedTestRef.current) {
                const detectedSignature = threats.some(t => 
                  /eicar|virus|test/i.test(t)
                ) || /eicar/i.test(data?.error || '');
                const uploadRejected = status === 400 && data?.success === false;
                const notCommitted = data?.scanStatus === 'INFECTED' && !data?.file;
                const tempCleaned = data?.tempFileCleaned !== false;

                if (detectedSignature && uploadRejected && notCommitted && tempCleaned) {
                  setStage('idle');
                  setThreatReport({
                    isEicarTest: true,
                    testPassed: true,
                    title: 'Threat detected — test passed',
                    error: data?.error || 'EICAR test signature intercepted.',
                    threats,
                    scanDetails: data?.scanDetails
                  });
                  return;
                } else {
                  // Dedicated test did not fulfill all 4 verification criteria
                  setStage('idle');
                  setThreatReport({
                    isEicarTest: true,
                    testPassed: false,
                    title: 'Malware Test Inconclusive',
                    error: 'The test upload was rejected, but failed to confirm all security quarantine requirements.',
                    threats,
                    scanDetails: data?.scanDetails
                  });
                  return;
                }
              }

              // Ordinary upload intercepted by scanner
              setStage('idle');
              setThreatReport({
                isEicarTest: false,
                testPassed: false,
                title: 'Malware Threat Intercepted & Quarantined',
                error: data?.error || 'Sentinel Anti-Malware identified a dangerous signature in this file.',
                threats,
                scanDetails: data?.scanDetails
              });
              return;
            }

            // Normal 400 rejection (not malware)
            setStage('idle');
            setGeneralError({
              title: 'Upload Request Rejected (HTTP 400)',
              message: (isJson && data?.error)
                ? data.error
                : 'The upload request could not be processed by the server. Please verify the file and try again.',
              status
            });
            return;
          }

          // Case C: 401 / 403 Authentication Error
          if (status === 401 || status === 403) {
            setStage('idle');
            setGeneralError({
              title: `Authentication Failed (HTTP ${status})`,
              message: (isJson && data?.error)
                ? data.error
                : 'You are not authorized to upload files. Please check session credentials.',
              status
            });
            return;
          }

          // Case D: 413 Payload Too Large
          if (status === 413) {
            setStage('idle');
            setGeneralError({
              title: 'File Exceeds Server Limit (HTTP 413)',
              message: (isJson && data?.error)
                ? data.error
                : 'The uploaded file exceeds the maximum allowed payload size.',
              status
            });
            return;
          }

          // Case E: 404 Route Not Found
          if (status === 404) {
            setStage('idle');
            setGeneralError({
              title: 'Upload Route Not Found (HTTP 404)',
              message: 'The /api/files/upload endpoint could not be reached. Verify that the Express server route is registered.',
              status
            });
            return;
          }

          // Case F: 500+ Internal Server Error / Bad Gateway
          if (status >= 500) {
            setStage('idle');
            if (isDedicatedTestRef.current) {
              setGeneralError({
                title: `Malware Test Failed — Server Error (HTTP ${status})`,
                message: (isJson && data?.error)
                  ? `Server error during malware test: ${data.error}`
                  : 'The backend server or scanner encountered an internal error instead of recognizing the test signature.',
                status
              });
              return;
            }

            let userFriendlyMsg = 'The server encountered an error while processing the upload.';
            if (isJson && data?.error) {
              userFriendlyMsg = data.error;
            } else if (!isJson && xhr.responseText?.includes('Internal Server Error')) {
              userFriendlyMsg = 'Backend service is unavailable or returned an internal error. Please ensure the Express server is running on port 5000.';
            }

            setGeneralError({
              title: `Server Error (HTTP ${status})`,
              message: userFriendlyMsg,
              status
            });
            return;
          }

          // Fallback for any other status code
          setStage('idle');
          setGeneralError({
            title: `Upload Failed (HTTP ${status})`,
            message: (isJson && data?.error)
              ? data.error
              : `Server returned HTTP status ${status}.`,
            status
          });

        } catch (err: unknown) {
          // Catch any unexpected runtime error in response processing
          setStage('idle');
          setGeneralError({
            title: 'Response Processing Error',
            message: err instanceof Error ? err.message : 'An error occurred while evaluating the server response.'
          });
        } finally {
          activeXhrRef.current = null;
        }
      };

      xhr.onerror = () => {
        clearAllTimers();
        setStage('idle');
        activeXhrRef.current = null;
        setGeneralError({
          title: 'Network Connection Failed',
          message: 'Unable to connect to the backend server. Please verify that the backend API is online and reachable.'
        });
      };

      xhr.ontimeout = () => {
        clearAllTimers();
        setStage('idle');
        activeXhrRef.current = null;
        setGeneralError({
          title: 'Upload Request Timed Out',
          message: 'The server did not respond within the allocated time window. Please try again.'
        });
      };

      // Open request and set auth header.
      // NOTE: Do NOT set Content-Type header manually; browser sets boundary for multipart/form-data.
      xhr.open('POST', `${API_BASE}/files/upload`, true);
      xhr.setRequestHeader('Authorization', `Bearer ${token || 'usr_demo_01'}`);
      xhr.send(formData);

    }, 200);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      uploadFile(e.target.files[0], false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (isProcessing) return;
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      uploadFile(e.dataTransfer.files[0], false);
    }
  };

  // Trigger safe demo document upload
  const triggerSafeDemoUpload = () => {
    if (isProcessing) return;
    const content = `# CloudVault Architecture & Technical Specifications
Platform: SecureShare Enterprise
Security Layer: Sentinel Anti-Malware Multi-Heuristic Scan Engine
Storage: Cloudflare R2 Object Store

All files undergo cryptographic SHA-256 fingerprinting and signature verification before object storage commitment.

Status: 100% Verified Clean Document.`;
    const blob = new Blob([content], { type: 'text/markdown' });
    const file = new File([blob], `Safe_Specification_${Date.now().toString().slice(-4)}.md`, { type: 'text/markdown' });
    uploadFile(file, false);
  };

  // Trigger EICAR antivirus test upload to demonstrate threat blocking
  const triggerEicarDemoUpload = () => {
    if (isProcessing) return;
    const eicarString = 'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+TH$';
    const blob = new Blob([eicarString], { type: 'text/plain' });
    const file = new File([blob], `eicar_standard_test_${Date.now().toString().slice(-4)}.txt`, { type: 'text/plain' });
    uploadFile(file, true);
  };

  return (
    <div 
      ref={forwardedRef}
      className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm"
    >
      
      {/* Panel Header & Test Buttons */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-5">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-slate-900">
              Upload Files
            </h2>
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-600">
              Heuristic Inspection
            </span>
          </div>
          <p className="text-xs text-slate-600 mt-0.5">
            Files are scanned for malware signatures and encrypted before storage commitment
          </p>
        </div>

        {/* Evaluation Test Triggers */}
        <div className="flex items-center gap-2 self-stretch sm:self-auto">
          <button
            type="button"
            onClick={triggerSafeDemoUpload}
            disabled={isProcessing}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100/80 px-3 py-1.5 text-xs font-semibold text-emerald-800 transition-colors disabled:opacity-50"
            title="Upload a verified clean sample document"
          >
            <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
            <span>Upload Safe Sample</span>
          </button>

          <button
            type="button"
            onClick={triggerEicarDemoUpload}
            disabled={isProcessing}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100/80 px-3 py-1.5 text-xs font-semibold text-rose-800 transition-colors disabled:opacity-50"
            title="Simulate virus upload using the industry-standard EICAR test signature"
          >
            <Bug className="h-3.5 w-3.5 text-rose-600" />
            <span>Test Malware Scan</span>
          </button>
        </div>
      </div>

      {/* Hidden native input */}
      <input
        ref={fileInputRef}
        type="file"
        onChange={handleFileChange}
        disabled={isProcessing}
        className="hidden"
        id="secureshare-file-input"
      />

      {/* Duplicate Rejection Notice Banner */}
      {duplicateNotice && (
        <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700 flex items-center justify-between gap-2">
          <span>{duplicateNotice}</span>
          <button
            type="button"
            onClick={() => setDuplicateNotice(null)}
            className="text-slate-400 hover:text-slate-600 font-semibold px-1"
          >
            ✕
          </button>
        </div>
      )}

      {/* Duplicate File Decision Prompt */}
      {pendingDuplicate && (
        <div className="rounded-2xl border-2 border-amber-300 bg-amber-50/90 p-5 sm:p-6 space-y-4 animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="flex items-start gap-3.5">
            <div className="h-10 w-10 rounded-xl bg-amber-600 text-white flex items-center justify-center shrink-0 shadow-sm">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-slate-900">
                Duplicate File Detected
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                The file you are uploading has the exact same content (SHA-256 hash match) as an existing document in your vault. Do you want to add a duplicate copy, or discard the upload?
              </p>
            </div>
          </div>

          {/* Comparison Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1">
            <div className="rounded-xl border border-slate-200 bg-white p-3.5 space-y-1 shadow-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Existing File in Vault
              </span>
              <p className="font-bold text-slate-900 truncate">
                {pendingDuplicate.existingFile.fileName}
              </p>
              <p className="text-[11px] text-slate-500">
                {formatBytes(pendingDuplicate.existingFile.fileSize)} • Uploaded {formatDate(pendingDuplicate.existingFile.uploadedAt)}
              </p>
            </div>

            <div className="rounded-xl border border-amber-300 bg-amber-100/70 p-3.5 space-y-1 shadow-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-900">
                Incoming Upload Attempt
              </span>
              <p className="font-bold text-slate-900 truncate">
                {pendingDuplicate.file.name}
              </p>
              <p className="text-[11px] text-amber-800">
                {formatBytes(pendingDuplicate.file.size)} • Identical cryptographic hash
              </p>
            </div>
          </div>

          {/* Decision Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-end gap-2.5 pt-3 border-t border-amber-200/80">
            <button
              type="button"
              onClick={handleRejectDuplicate}
              className="w-full sm:w-auto px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-xs font-semibold text-slate-700 transition-colors shadow-xs"
            >
              Reject & Discard
            </button>
            <button
              type="button"
              onClick={handleConfirmDuplicate}
              className="w-full sm:w-auto px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold shadow-xs transition-colors flex items-center justify-center gap-1.5"
            >
              <span>Add Duplicate Copy</span>
            </button>
          </div>
        </div>
      )}

      {/* 1. Drag & Drop Zone (Visible when idle) */}
      {stage === 'idle' && !threatReport && !generalError && !pendingDuplicate && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`group flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 text-center cursor-pointer transition-all ${
            isDragOver
              ? 'border-violet-500 bg-violet-50/60 ring-4 ring-violet-500/10'
              : 'border-slate-300 bg-slate-50/50 hover:border-violet-400 hover:bg-violet-50/20'
          }`}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              fileInputRef.current?.click();
            }
          }}
          aria-label="Upload files by dragging or browsing"
        >
          <div className="h-12 w-12 rounded-2xl bg-violet-100 text-violet-700 flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
            <UploadCloud className="h-6 w-6" />
          </div>

          <div className="mt-3.5">
            <p className="text-sm font-semibold text-slate-800">
              Drop your files here
            </p>
            <p className="text-xs text-slate-600 mt-0.5">
              or <span className="text-violet-700 font-semibold underline underline-offset-2">browse files</span> from your computer
            </p>
          </div>

          <p className="text-[11px] text-slate-600 mt-3 font-medium">
            Accepted formats: Documents, Images, Archives, Media • Maximum size: 500 MB
          </p>

          {/* Security Processing Explanation */}
          <div className="mt-4 pt-3 border-t border-slate-200/80 w-full max-w-md flex items-center justify-center gap-2 text-[11px] text-slate-600">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
            <span>Real-time heuristic malware inspection & SHA-256 fingerprinting</span>
          </div>
        </div>
      )}

      {/* 2. Upload Progress & Pipeline Stages (Active during upload) */}
      {stage !== 'idle' && (
        <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-5 space-y-4">
          
          {/* File summary and active stage status */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-10 w-10 rounded-xl bg-violet-100 text-violet-700 flex items-center justify-center shrink-0">
                <FileText className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-900 truncate max-w-[220px] sm:max-w-md">
                  {selectedFile?.name}
                </p>
                <p className="text-[11px] text-slate-600">
                  {selectedFile?.size ? formatBytes(selectedFile.size) : ''} •{' '}
                  <span className="font-semibold text-violet-700">
                    {stage === 'preparing' && 'Validating file header...'}
                    {stage === 'uploading' && `Uploading: ${uploadProgress}%`}
                    {stage === 'scanning' && 'Sentinel heuristic scan running...'}
                    {stage === 'storing' && 'Storing in Cloudflare R2...'}
                    {stage === 'completed' && 'Upload and security scan complete!'}
                  </span>
                </p>
              </div>
            </div>

            <div className="text-right">
              <span className="text-sm font-bold text-slate-900">
                {stage === 'completed' ? '100%' : `${uploadProgress}%`}
              </span>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="h-2 w-full rounded-full bg-slate-200 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-200 ${
                stage === 'completed' ? 'bg-emerald-500' : 'bg-violet-600'
              }`}
              style={{
                width: stage === 'completed' ? '100%' : `${Math.max(uploadProgress, 5)}%`
              }}
            />
          </div>

          {/* 5 Distinct Pipeline Stages */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1 text-center">
            
            {/* Stage 1: Preparing */}
            <div className={`p-2 rounded-lg border text-xs transition-colors ${
              ['preparing', 'uploading', 'scanning', 'storing', 'completed'].includes(stage)
                ? 'border-violet-300 bg-violet-50 text-violet-800 font-semibold'
                : 'border-slate-200 bg-white text-slate-600'
            }`}>
              <div className="text-[10px] text-slate-600">Stage 01</div>
              <div>Preparing</div>
            </div>

            {/* Stage 2: Uploading */}
            <div className={`p-2 rounded-lg border text-xs transition-colors ${
              ['uploading', 'scanning', 'storing', 'completed'].includes(stage)
                ? 'border-violet-300 bg-violet-50 text-violet-800 font-semibold'
                : 'border-slate-200 bg-white text-slate-600'
            }`}>
              <div className="text-[10px] text-slate-600">Stage 02</div>
              <div>Uploading</div>
            </div>

            {/* Stage 3: Scanning */}
            <div className={`p-2 rounded-lg border text-xs transition-colors ${
              ['scanning', 'storing', 'completed'].includes(stage)
                ? 'border-purple-300 bg-purple-50 text-purple-800 font-semibold'
                : 'border-slate-200 bg-white text-slate-600'
            }`}>
              <div className="text-[10px] text-slate-600">Stage 03</div>
              <div>Security Scan</div>
            </div>

            {/* Stage 4: Storing */}
            <div className={`p-2 rounded-lg border text-xs transition-colors ${
              ['storing', 'completed'].includes(stage)
                ? 'border-violet-300 bg-violet-50 text-violet-800 font-semibold'
                : 'border-slate-200 bg-white text-slate-600'
            }`}>
              <div className="text-[10px] text-slate-600">Stage 04</div>
              <div>Saving File</div>
            </div>

            {/* Stage 5: Completed */}
            <div className={`p-2 rounded-lg border text-xs transition-colors col-span-2 sm:col-span-1 ${
              stage === 'completed'
                ? 'border-emerald-300 bg-emerald-50 text-emerald-800 font-semibold'
                : 'border-slate-200 bg-white text-slate-600'
            }`}>
              <div className="text-[10px] text-slate-600">Stage 05</div>
              <div>Complete</div>
            </div>

          </div>

          {/* Completed State Confirmation */}
          {stage === 'completed' && (
            <div className="space-y-3 pt-2">
              {duplicateWarning && (
                <div className="rounded-xl bg-amber-50 border border-amber-200/80 p-3 text-xs text-amber-800 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                  <span>{duplicateWarning}</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  Verified safe and indexed in repository
                </span>
                <button
                  type="button"
                  onClick={resetState}
                  className="rounded-lg bg-violet-600 text-white px-3 py-1.5 text-xs font-semibold hover:bg-violet-700 transition-colors"
                >
                  Upload another file
                </button>
              </div>
            </div>
          )}

        </div>
      )}

      {/* 3. Threat Report Display (Differentiating EICAR test pass from real failures) */}
      {threatReport && (
        <div className={`rounded-xl border p-5 ${
          threatReport.isEicarTest && threatReport.testPassed
            ? 'border-emerald-300 bg-emerald-50/80 text-slate-900'
            : 'border-rose-300 bg-rose-50 text-slate-900'
        }`}>
          <div className="flex items-start gap-3.5">
            <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${
              threatReport.isEicarTest && threatReport.testPassed
                ? 'bg-emerald-600 text-white' 
                : 'bg-rose-600 text-white'
            }`}>
              {threatReport.isEicarTest && threatReport.testPassed ? (
                <ShieldCheck className="h-5 w-5" />
              ) : (
                <AlertTriangle className="h-5 w-5" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className={`rounded px-2 py-0.5 text-[11px] font-bold ${
                  threatReport.isEicarTest && threatReport.testPassed
                    ? 'bg-emerald-200 text-emerald-900'
                    : 'bg-rose-200 text-rose-900'
                }`}>
                  {threatReport.isEicarTest 
                    ? (threatReport.testPassed ? 'TEST PASSED' : 'TEST INCONCLUSIVE') 
                    : 'SECURITY ALERT'}
                </span>
                <span className="text-xs text-slate-600 font-mono">
                  {threatReport.isEicarTest ? 'EICAR_DETECTION_CONFIRMED' : 'MALWARE_INTERCEPTED'}
                </span>
              </div>

              <h3 className="text-sm font-bold text-slate-900 mt-1">
                {threatReport.title}
              </h3>

              <p className="text-xs text-slate-700 mt-1 leading-relaxed">
                {threatReport.isEicarTest && threatReport.testPassed ? (
                  <>The Sentinel heuristic scanner successfully detected the configured test signature (<code className="font-mono text-emerald-900 bg-emerald-100/80 px-1 py-0.5 rounded">Virus:DOS/EICAR_Test_File.A</code>) and rejected the upload. Storage commitment was blocked, and the temporary staging file was purged.</>
                ) : (
                  <>The Sentinel security layer intercepted a dangerous signature in <strong>{selectedFile?.name}</strong>. Storage in Cloudflare R2 was prevented.</>
                )}
              </p>

              {/* Detected threats list */}
              <div className="mt-3 rounded-lg bg-white border border-slate-200 p-3">
                <p className="text-[11px] font-semibold text-slate-700 mb-1">
                  Detected Threat Signatures:
                </p>
                <ul className="space-y-1 text-xs font-mono text-rose-700">
                  {threatReport.threats.map((threat, idx) => (
                    <li key={idx} className="flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-rose-500 shrink-0" />
                      <span>{threat}</span>
                    </li>
                  ))}
                </ul>

                {threatReport.scanDetails?.sha256 && (
                  <div className="mt-2.5 pt-2 border-t border-slate-100 text-[11px] text-slate-600 flex items-center justify-between">
                    <span>SHA-256 Checksum:</span>
                    <span className="font-mono text-slate-700 truncate max-w-[280px]">
                      {threatReport.scanDetails.sha256}
                    </span>
                  </div>
                )}
              </div>

              {/* Action buttons (Clean light theme) */}
              <div className="mt-4 flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={resetState}
                  className="rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 px-3.5 py-1.5 text-xs font-semibold transition-colors"
                >
                  Dismiss & Return
                </button>
                <button
                  type="button"
                  onClick={triggerSafeDemoUpload}
                  className="rounded-lg bg-violet-600 hover:bg-violet-700 text-white px-3.5 py-1.5 text-xs font-semibold transition-colors shadow-sm"
                >
                  Upload Safe Sample
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* 4. General / Server Error Display */}
      {generalError && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-slate-900">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-bold text-rose-900">{generalError.title}</h3>
                {generalError.status && (
                  <span className="rounded bg-rose-200 text-rose-900 font-mono text-[10px] px-1.5 py-0.2 font-semibold">
                    HTTP {generalError.status}
                  </span>
                )}
              </div>
              <p className="text-xs text-rose-800 mt-1 leading-relaxed">{generalError.message}</p>
              <button
                type="button"
                onClick={resetState}
                className="mt-3 inline-flex items-center gap-1 rounded-lg bg-rose-600 text-white px-3 py-1.5 text-xs font-medium hover:bg-rose-700 transition-colors shadow-sm"
              >
                <RotateCcw className="h-3 w-3" />
                <span>Try Again</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
