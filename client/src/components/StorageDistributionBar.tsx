'use client';

import React, { useMemo } from 'react';
import { 
  HardDrive, 
  FileText, 
  Image as ImageIcon, 
  Film, 
  FileCode, 
  Archive
} from 'lucide-react';
import { FileItem } from '../lib/types';
import { formatBytes } from '../lib/api';

interface StorageDistributionBarProps {
  files: FileItem[];
  totalQuotaBytes?: number; // default: 512 MB
}

interface CategoryMetric {
  id: string;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  bytes: number;
  count: number;
  colorBg: string;
  colorText: string;
  colorDot: string;
  colorBorder: string;
}

export function StorageDistributionBar({ 
  files, 
  totalQuotaBytes = 512 * 1024 * 1024 // 512 MB prototype quota
}: StorageDistributionBarProps) {
  // Filter out any deleted files
  const activeFiles = useMemo(() => files.filter((f) => !f.isDeleted), [files]);

  const { categories, totalUsedBytes } = useMemo(() => {
    let docsBytes = 0, docsCount = 0;
    let imgBytes = 0, imgCount = 0;
    let mediaBytes = 0, mediaCount = 0;
    let codeBytes = 0, codeCount = 0;
    let otherBytes = 0, otherCount = 0;
    let totalUsed = 0;

    for (const f of activeFiles) {
      const size = Number(f.fileSize) || 0;
      totalUsed += size;
      const mime = (f.fileType || '').toLowerCase();
      const ext = (f.fileName || '').split('.').pop()?.toLowerCase() || '';

      // 1. Documents
      if (
        mime.includes('pdf') || 
        mime.includes('document') || 
        mime.includes('msword') || 
        mime.includes('presentation') || 
        mime.includes('spreadsheet') ||
        ['pdf', 'doc', 'docx', 'txt', 'rtf', 'odt', 'pages', 'xls', 'xlsx', 'csv', 'ppt', 'pptx'].includes(ext)
      ) {
        docsBytes += size;
        docsCount++;
      }
      // 2. Images
      else if (
        mime.startsWith('image/') || 
        ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico', 'tiff', 'heic'].includes(ext)
      ) {
        imgBytes += size;
        imgCount++;
      }
      // 3. Media (Audio & Video)
      else if (
        mime.startsWith('video/') || 
        mime.startsWith('audio/') || 
        ['mp4', 'mov', 'webm', 'mkv', 'avi', 'mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac'].includes(ext)
      ) {
        mediaBytes += size;
        mediaCount++;
      }
      // 4. Code & Structured Data
      else if (
        mime.includes('json') || 
        mime.includes('javascript') || 
        mime.includes('typescript') || 
        mime.includes('html') || 
        mime.includes('xml') ||
        ['json', 'js', 'jsx', 'ts', 'tsx', 'html', 'css', 'py', 'java', 'c', 'cpp', 'rs', 'go', 'php', 'sql', 'yaml', 'yml', 'sh', 'md'].includes(ext)
      ) {
        codeBytes += size;
        codeCount++;
      }
      // 5. Archives & Other
      else {
        otherBytes += size;
        otherCount++;
      }
    }

    const catList: CategoryMetric[] = [
      {
        id: 'docs',
        name: 'Documents',
        icon: FileText,
        bytes: docsBytes,
        count: docsCount,
        colorBg: 'bg-violet-600',
        colorText: 'text-violet-700',
        colorDot: 'bg-violet-600',
        colorBorder: 'border-violet-200'
      },
      {
        id: 'images',
        name: 'Images',
        icon: ImageIcon,
        bytes: imgBytes,
        count: imgCount,
        colorBg: 'bg-sky-500',
        colorText: 'text-sky-700',
        colorDot: 'bg-sky-500',
        colorBorder: 'border-sky-200'
      },
      {
        id: 'media',
        name: 'Audio & Video',
        icon: Film,
        bytes: mediaBytes,
        count: mediaCount,
        colorBg: 'bg-amber-500',
        colorText: 'text-amber-700',
        colorDot: 'bg-amber-500',
        colorBorder: 'border-amber-200'
      },
      {
        id: 'code',
        name: 'Code & Data',
        icon: FileCode,
        bytes: codeBytes,
        count: codeCount,
        colorBg: 'bg-emerald-500',
        colorText: 'text-emerald-700',
        colorDot: 'bg-emerald-500',
        colorBorder: 'border-emerald-200'
      },
      {
        id: 'other',
        name: 'Archives & Other',
        icon: Archive,
        bytes: otherBytes,
        count: otherCount,
        colorBg: 'bg-slate-400',
        colorText: 'text-slate-700',
        colorDot: 'bg-slate-400',
        colorBorder: 'border-slate-200'
      }
    ];

    return { categories: catList, totalUsedBytes: totalUsed };
  }, [activeFiles]);

  const effectiveQuota = Math.max(totalQuotaBytes, totalUsedBytes * 1.1);
  const usedPercentOfQuota = totalUsedBytes > 0 
    ? Math.min(100, (totalUsedBytes / effectiveQuota) * 100) 
    : 0;

  const freeBytes = Math.max(0, effectiveQuota - totalUsedBytes);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:border-slate-300 transition-all">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-violet-100 text-violet-700 flex items-center justify-center shrink-0 shadow-sm">
            <HardDrive className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              Storage Utilization & Breakdown
            </h2>
            <p className="text-xs text-slate-500">
              Real-time zero-trust vault storage categorized by document type
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-50 border border-violet-200/80 px-3 py-1 text-xs font-semibold text-violet-800">
            <span>{formatBytes(totalUsedBytes)} of {formatBytes(effectiveQuota)} Used</span>
            <span className="text-violet-500 font-mono">({usedPercentOfQuota.toFixed(1)}%)</span>
          </span>
          <span className="hidden md:inline-block text-xs font-medium text-slate-500">
            • {formatBytes(freeBytes)} free
          </span>
        </div>
      </div>

      {/* Segmented Visual Bar */}
      <div className="mt-4">
        <div 
          className="h-3.5 w-full rounded-full bg-slate-100 overflow-hidden flex shadow-inner border border-slate-200/70"
          role="progressbar"
          aria-valuenow={usedPercentOfQuota}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Storage capacity breakdown bar"
        >
          {totalUsedBytes === 0 ? (
            <div className="h-full w-full bg-slate-200/60 flex items-center justify-center text-[10px] text-slate-400 font-mono">
              Empty Vault
            </div>
          ) : (
            categories.map((cat) => {
              if (cat.bytes <= 0) return null;
              const shareOfUsed = (cat.bytes / totalUsedBytes) * 100;
              return (
                <div
                  key={cat.id}
                  style={{ width: `${shareOfUsed}%` }}
                  title={`${cat.name}: ${formatBytes(cat.bytes)} (${shareOfUsed.toFixed(1)}%)`}
                  className={`h-full ${cat.colorBg} transition-all duration-300 first:rounded-l-full last:rounded-r-full hover:opacity-90 relative group`}
                />
              );
            })
          )}
        </div>
      </div>

      {/* Category Pills Breakdown */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 mt-4">
        {categories.map((cat) => {
          const Icon = cat.icon;
          const sharePercent = totalUsedBytes > 0 ? (cat.bytes / totalUsedBytes) * 100 : 0;
          return (
            <div 
              key={cat.id}
              className={`rounded-xl border border-slate-200/80 bg-slate-50/60 p-2.5 transition-colors hover:bg-slate-50 hover:border-slate-300`}
            >
              <div className="flex items-center justify-between text-xs font-semibold text-slate-800">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className={`h-2 w-2 rounded-full ${cat.colorDot} shrink-0`} />
                  <span className="truncate">{cat.name}</span>
                </div>
                <Icon className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              </div>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-xs font-bold text-slate-900">
                  {formatBytes(cat.bytes)}
                </span>
                <span className="text-[10px] font-mono font-medium text-slate-500">
                  {sharePercent.toFixed(0)}%
                </span>
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                {cat.count} {cat.count === 1 ? 'file' : 'files'}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
