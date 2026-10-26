'use client';

import React, { useState } from 'react';
import { 
  FileText, 
  Image as ImageIcon, 
  Video, 
  Archive, 
  FileCode, 
  File, 
  ShieldCheck, 
  Download, 
  Share2, 
  Trash2, 
  Eye, 
  HardDrive, 
  Star, 
  UploadCloud,
  Flame
} from 'lucide-react';
import { FileItem } from '../lib/types';
import { formatBytes, formatDate } from '../lib/api';

interface FileListProps {
  files: FileItem[];
  isLoading: boolean;
  onPreview: (file: FileItem) => void;
  onShare: (file: FileItem) => void;
  onDelete: (fileId: string) => void;
  onTriggerUpload?: () => void;
  searchQuery?: string;
  onSearchChange?: (q: string) => void;
  starredIds?: Set<string>;
  onToggleStar?: (fileId: string) => void;
}

export function FileList({
  files,
  isLoading,
  onPreview,
  onShare,
  onDelete,
  onTriggerUpload,
  searchQuery = '',
  starredIds = new Set(),
  onToggleStar
}: FileListProps) {
  const [typeFilter, setTypeFilter] = useState<'all' | 'documents' | 'images' | 'media' | 'archives'>('all');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const effectiveSearch = searchQuery;

  // Helper: File Type Icon with color-coded containers
  const getFileBadge = (mime: string, name: string) => {
    const ext = name.split('.').pop()?.toLowerCase() || '';

    if (mime.startsWith('image/')) {
      return (
        <div className="h-9 w-9 rounded-xl bg-purple-50 text-purple-600 border border-purple-200/60 flex items-center justify-center shrink-0">
          <ImageIcon className="h-4.5 w-4.5" />
        </div>
      );
    }
    if (mime.startsWith('video/') || mime.startsWith('audio/')) {
      return (
        <div className="h-9 w-9 rounded-xl bg-amber-50 text-amber-600 border border-amber-200/60 flex items-center justify-center shrink-0">
          <Video className="h-4.5 w-4.5" />
        </div>
      );
    }
    if (mime.includes('zip') || mime.includes('rar') || mime.includes('tar') || mime.includes('compressed')) {
      return (
        <div className="h-9 w-9 rounded-xl bg-orange-50 text-orange-600 border border-orange-200/60 flex items-center justify-center shrink-0">
          <Archive className="h-4.5 w-4.5" />
        </div>
      );
    }
    if (['js', 'ts', 'jsx', 'tsx', 'json', 'py', 'java', 'html', 'css', 'go', 'rs', 'sh'].includes(ext)) {
      return (
        <div className="h-9 w-9 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-200/60 flex items-center justify-center shrink-0">
          <FileCode className="h-4.5 w-4.5" />
        </div>
      );
    }
    if (mime.includes('pdf') || mime.includes('text') || mime.includes('doc') || mime.includes('md') || ext === 'md' || ext === 'txt') {
      return (
        <div className="h-9 w-9 rounded-xl bg-blue-50 text-blue-600 border border-blue-200/60 flex items-center justify-center shrink-0">
          <FileText className="h-4.5 w-4.5" />
        </div>
      );
    }
    return (
      <div className="h-9 w-9 rounded-xl bg-slate-100 text-slate-600 border border-slate-200 flex items-center justify-center shrink-0">
        <File className="h-4.5 w-4.5" />
      </div>
    );
  };

  // Filter files
  const filteredFiles = files.filter((f) => {
    const matchesSearch = f.fileName.toLowerCase().includes(effectiveSearch.toLowerCase());
    if (!matchesSearch) return false;

    if (typeFilter === 'images') return f.fileType.startsWith('image/');
    if (typeFilter === 'documents') {
      return f.fileType.includes('pdf') || f.fileType.includes('text') || f.fileType.includes('md') || f.fileType.includes('doc') || f.fileName.endsWith('.md') || f.fileName.endsWith('.txt');
    }
    if (typeFilter === 'media') return f.fileType.startsWith('video/') || f.fileType.startsWith('audio/');
    if (typeFilter === 'archives') return f.fileType.includes('zip') || f.fileType.includes('rar') || f.fileType.includes('tar');
    return true;
  });

  const handleDeleteConfirmed = async (fileId: string) => {
    setDeletingId(fileId);
    setConfirmDeleteId(null);
    try {
      await onDelete(fileId);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-4">
      
      {/* Controls Bar: Filter pills & local search (if not in top bar) */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        
        {/* Category Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 text-xs">
          {[
            { id: 'all', label: 'All Files' },
            { id: 'documents', label: 'Documents' },
            { id: 'images', label: 'Images' },
            { id: 'media', label: 'Media' },
            { id: 'archives', label: 'Archives' },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setTypeFilter(cat.id as 'all' | 'documents' | 'images' | 'media' | 'archives')}
              className={`rounded-xl px-3 py-1.5 font-medium transition-all whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${
                typeFilter === cat.id
                  ? 'bg-violet-600 text-white shadow-sm'
                  : 'bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 border border-slate-200'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Count indicator */}
        <div className="text-xs text-slate-500 self-end sm:self-auto">
          Showing <span className="font-semibold text-slate-800">{filteredFiles.length}</span> of {files.length} files
        </div>

      </div>

      {/* Files Table Container */}
      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
        
        <div 
          tabIndex={0} 
          role="region" 
          aria-label="Secure files table"
          className="overflow-x-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
        >
          <table className="w-full text-left border-collapse text-xs">
            
            {/* Header */}
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                <th scope="col" className="w-10 px-4 py-3 text-center">
                  <span className="sr-only">Star</span>
                </th>
                <th scope="col" className="px-4 py-3">File Name</th>
                <th scope="col" className="px-4 py-3 hidden md:table-cell">Size</th>
                <th scope="col" className="px-4 py-3 hidden sm:table-cell">Uploaded</th>
                <th scope="col" className="px-4 py-3">Security Status</th>
                <th scope="col" className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>

            {/* Body */}
            <tbody className="divide-y divide-slate-100">
              
              {/* Skeleton Loaders */}
              {isLoading && (
                <>
                  {[1, 2, 3, 4].map((i) => (
                    <tr key={i} className="animate-pulse">
                      <td className="px-4 py-3 text-center">
                        <div className="h-4 w-4 bg-slate-200 rounded mx-auto" />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-xl bg-slate-200 shrink-0" />
                          <div className="space-y-1.5 w-48">
                            <div className="h-3.5 bg-slate-200 rounded w-full" />
                            <div className="h-2.5 bg-slate-100 rounded w-24" />
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <div className="h-3 bg-slate-200 rounded w-16" />
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <div className="h-3 bg-slate-200 rounded w-24" />
                      </td>
                      <td className="px-4 py-3">
                        <div className="h-5 bg-slate-200 rounded-full w-20" />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="h-7 w-28 bg-slate-200 rounded-lg ml-auto" />
                      </td>
                    </tr>
                  ))}
                </>
              )}

              {/* Empty State */}
              {!isLoading && filteredFiles.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-16 px-4 text-center">
                    <div className="h-12 w-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                      <HardDrive className="h-6 w-6" />
                    </div>
                    <h3 className="text-sm font-semibold text-slate-800">
                      {effectiveSearch ? 'No matching files found' : 'No files in repository'}
                    </h3>
                    <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                      {effectiveSearch
                        ? `No stored files match "${effectiveSearch}". Try adjusting your search query or category filter.`
                        : 'Upload your first document, image, or archive to begin zero-trust file storage.'}
                    </p>
                    {onTriggerUpload && !effectiveSearch && (
                      <button
                        type="button"
                        onClick={onTriggerUpload}
                        className="mt-4 inline-flex items-center gap-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 text-xs font-semibold shadow-sm transition-colors"
                      >
                        <UploadCloud className="h-4 w-4" />
                        <span>Upload File</span>
                      </button>
                    )}
                  </td>
                </tr>
              )}

              {/* Data Rows */}
              {!isLoading && filteredFiles.length > 0 && filteredFiles.map((file) => {
                const isStarred = starredIds.has(file.fileId);
                const isConfirmingDelete = confirmDeleteId === file.fileId;
                const isDeleting = deletingId === file.fileId;

                return (
                  <tr 
                    key={file.fileId} 
                    className="hover:bg-slate-50/70 transition-colors group"
                  >
                    
                    {/* Star icon */}
                    <td className="px-4 py-3 text-center">
                      <button
                        type="button"
                        onClick={() => onToggleStar && onToggleStar(file.fileId)}
                        className="p-1 rounded text-slate-300 hover:text-amber-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-violet-500 transition-colors"
                        title={isStarred ? 'Unstar file' : 'Star file'}
                        aria-label={isStarred ? 'Unstar file' : 'Star file'}
                      >
                        <Star className={`h-4 w-4 ${isStarred ? 'fill-amber-400 text-amber-400' : ''}`} />
                      </button>
                    </td>

                    {/* File name & info */}
                    <td className="px-4 py-3 min-w-0">
                      <div className="flex items-center gap-3 min-w-0">
                        {getFileBadge(file.fileType, file.fileName)}
                        <div className="min-w-0">
                          <p 
                            onClick={() => onPreview(file)}
                            className="text-xs font-semibold text-slate-900 truncate hover:text-violet-700 transition-colors cursor-pointer max-w-[200px] sm:max-w-xs md:max-w-sm"
                            title={file.fileName}
                          >
                            {file.fileName}
                          </p>
                          <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                            <span className="md:hidden font-mono">{formatBytes(file.fileSize)}</span>
                            {file.shareInfo && (
                              <span className="inline-flex items-center gap-1 rounded bg-violet-50 text-violet-700 font-medium px-1.5 py-0.2 border border-violet-200/60">
                                <Share2 className="h-2.5 w-2.5" />
                                Shared ({file.shareInfo.accessType})
                              </span>
                            )}
                            {file.shareInfo?.isBurnAfterReading && (
                              <span className="inline-flex items-center gap-0.5 rounded bg-amber-50 text-amber-800 font-medium px-1.5 py-0.2 border border-amber-200/60">
                                <Flame className="h-2.5 w-2.5 text-amber-600 fill-amber-500" />
                                Burn
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Size */}
                    <td className="px-4 py-3 hidden md:table-cell font-mono text-slate-600">
                      {formatBytes(file.fileSize)}
                    </td>

                    {/* Upload Date */}
                    <td className="px-4 py-3 hidden sm:table-cell text-slate-500">
                      {formatDate(file.uploadedAt)}
                    </td>

                    {/* Security Status */}
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-medium text-emerald-800">
                        <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                        <span>Clean</span>
                      </span>
                    </td>

                    {/* Actions Menu */}
                    <td className="px-4 py-3 text-right">
                      
                      {isConfirmingDelete ? (
                        <div className="inline-flex items-center gap-1.5 bg-rose-50 border border-rose-200 rounded-lg p-1 text-[11px]">
                          <span className="text-rose-700 font-medium px-1">Delete?</span>
                          <button
                            type="button"
                            onClick={() => handleDeleteConfirmed(file.fileId)}
                            className="bg-rose-600 hover:bg-rose-700 text-white rounded px-2 py-0.5 font-bold"
                          >
                            Yes
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="bg-white hover:bg-slate-100 text-slate-600 rounded px-1.5 py-0.5 border border-slate-200"
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-1">
                          
                          {/* Preview button */}
                          <button
                            type="button"
                            onClick={() => onPreview(file)}
                            className="h-8 w-8 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-900 flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-violet-500"
                            title="Preview file"
                            aria-label={`Preview ${file.fileName}`}
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>

                          {/* Share button */}
                          <button
                            type="button"
                            onClick={() => onShare(file)}
                            className={`h-8 w-8 rounded-lg border flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-violet-500 ${
                              file.shareInfo
                                ? 'border-violet-300 bg-violet-50 text-violet-700'
                                : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-900'
                            }`}
                            title="Share file link"
                            aria-label={`Share ${file.fileName}`}
                          >
                            <Share2 className="h-3.5 w-3.5" />
                          </button>

                          {/* Download button */}
                          <a
                            href={`/api/files/${file.fileId}/download`}
                            download
                            className="h-8 w-8 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-900 flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-violet-500"
                            title="Download file"
                            aria-label={`Download ${file.fileName}`}
                          >
                            <Download className="h-3.5 w-3.5" />
                          </a>

                          {/* Delete button */}
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(file.fileId)}
                            disabled={isDeleting}
                            className="h-8 w-8 rounded-lg border border-slate-200 bg-white hover:bg-rose-50 hover:border-rose-200 text-slate-400 hover:text-rose-600 flex items-center justify-center transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-rose-500"
                            title="Delete file"
                            aria-label={`Delete ${file.fileName}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>

                        </div>
                      )}

                    </td>

                  </tr>
                );
              })}

            </tbody>

          </table>
        </div>

      </div>

    </div>
  );
}
