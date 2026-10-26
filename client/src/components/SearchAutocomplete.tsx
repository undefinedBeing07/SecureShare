'use client';

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { 
  Search, 
  X, 
  FileText, 
  Image as ImageIcon, 
  Video, 
  Archive, 
  FileCode, 
  File, 
  Clock, 
  ArrowUpRight, 
  CornerDownLeft, 
  Sparkles
} from 'lucide-react';
import { FileItem } from '../lib/types';
import { formatBytes, formatDate } from '../lib/api';

interface SearchAutocompleteProps {
  files: FileItem[];
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onSelectFile: (file: FileItem) => void;
  onExecuteSearch?: (query: string) => void;
  placeholder?: string;
}

const RECENT_SEARCHES_KEY = 'secureshare_recent_searches';
const MAX_RECENT_SEARCHES = 5;
const MAX_SUGGESTIONS = 8;

export function SearchAutocomplete({
  files = [],
  searchQuery = '',
  onSearchChange,
  onSelectFile,
  onExecuteSearch,
  placeholder = 'Search files by name or extension...'
}: SearchAutocompleteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // 1. Load recent searches from localStorage safely
  useEffect(() => {
    try {
      const stored = localStorage.getItem(RECENT_SEARCHES_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setRecentSearches(parsed.filter((item): item is string => typeof item === 'string').slice(0, MAX_RECENT_SEARCHES));
        }
      }
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  // Save query to recent searches
  const saveRecentSearch = useCallback((term: string) => {
    const cleanTerm = term.trim();
    if (!cleanTerm || cleanTerm.length < 2) return;

    setRecentSearches((prev) => {
      const updated = [cleanTerm, ...prev.filter((t) => t.toLowerCase() !== cleanTerm.toLowerCase())].slice(0, MAX_RECENT_SEARCHES);
      try {
        localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
      } catch {
        // Ignore localStorage quota errors
      }
      return updated;
    });
  }, []);

  // Clear all recent searches
  const clearRecentSearches = useCallback((e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      localStorage.removeItem(RECENT_SEARCHES_KEY);
    } catch {}
    setRecentSearches([]);
  }, []);

  // Remove single recent search
  const removeRecentSearch = useCallback((termToRemove: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setRecentSearches((prev) => {
      const updated = prev.filter((t) => t !== termToRemove);
      try {
        localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
      } catch {}
      return updated;
    });
  }, []);

  // 2. Filter matching files (case-insensitive, spaces supported, excluding trash)
  const trimmedQuery = searchQuery.trim();
  const matchingFiles = useMemo(() => {
    if (!trimmedQuery) return [];
    const lowerQuery = trimmedQuery.toLowerCase();
    
    return files
      .filter((file) => {
        if (file.isDeleted) return false;
        return file.fileName.toLowerCase().includes(lowerQuery);
      })
      .slice(0, MAX_SUGGESTIONS);
  }, [files, trimmedQuery]);

  // Total matching count before capping to MAX_SUGGESTIONS
  const totalMatchesCount = useMemo(() => {
    if (!trimmedQuery) return 0;
    const lowerQuery = trimmedQuery.toLowerCase();
    return files.filter((f) => !f.isDeleted && f.fileName.toLowerCase().includes(lowerQuery)).length;
  }, [files, trimmedQuery]);

  // Recently uploaded files for empty search state
  const recentlyUploadedFiles = useMemo(() => {
    return [...files]
      .filter((f) => !f.isDeleted)
      .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime())
      .slice(0, 4);
  }, [files]);

  // Reset keyboard selection index when query or results change
  useEffect(() => {
    setSelectedIndex(-1);
  }, [searchQuery]);

  // Scroll active keyboard item into view smoothly
  useEffect(() => {
    if (selectedIndex >= 0 && itemRefs.current[selectedIndex]) {
      itemRefs.current[selectedIndex]?.scrollIntoView({
        block: 'nearest',
        behavior: 'smooth'
      });
    }
  }, [selectedIndex]);

  // 3. Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 4. File selection handler
  const handleSelectFile = useCallback((file: FileItem) => {
    if (trimmedQuery) {
      saveRecentSearch(trimmedQuery);
    }
    setIsOpen(false);
    onSelectFile(file);
  }, [trimmedQuery, saveRecentSearch, onSelectFile]);

  // 5. Search submission handler
  const handleExecuteSearch = useCallback((term: string) => {
    const cleanTerm = term.trim();
    if (cleanTerm) {
      saveRecentSearch(cleanTerm);
    }
    onSearchChange(term);
    setIsOpen(false);
    if (onExecuteSearch) {
      onExecuteSearch(term);
    }
  }, [saveRecentSearch, onSearchChange, onExecuteSearch]);

  // 6. Keyboard navigation handlers
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        setIsOpen(true);
        return;
      }
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (matchingFiles.length > 0) {
        setSelectedIndex((prev) => (prev + 1) % matchingFiles.length);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (matchingFiles.length > 0) {
        setSelectedIndex((prev) => (prev <= 0 ? matchingFiles.length - 1 : prev - 1));
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex >= 0 && selectedIndex < matchingFiles.length) {
        handleSelectFile(matchingFiles[selectedIndex]);
      } else {
        handleExecuteSearch(searchQuery);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
      inputRef.current?.blur();
    } else if (e.key === 'Tab') {
      // Allow natural tab out without focus trapping
      setIsOpen(false);
    }
  };

  // 7. Helper: File Type Icon with color-coded containers
  const getFileBadge = (mime: string, name: string) => {
    const ext = name.split('.').pop()?.toLowerCase() || '';

    if (mime.startsWith('image/') || ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) {
      return (
        <div className="h-8 w-8 rounded-lg bg-purple-50 text-purple-600 border border-purple-200/60 flex items-center justify-center shrink-0">
          <ImageIcon className="h-4 w-4" />
        </div>
      );
    }
    if (mime.startsWith('video/') || mime.startsWith('audio/') || ['mp4', 'webm', 'mp3', 'wav'].includes(ext)) {
      return (
        <div className="h-8 w-8 rounded-lg bg-amber-50 text-amber-600 border border-amber-200/60 flex items-center justify-center shrink-0">
          <Video className="h-4 w-4" />
        </div>
      );
    }
    if (mime.includes('json') || mime.includes('javascript') || mime.includes('code') || ['js', 'ts', 'jsx', 'tsx', 'html', 'css', 'json'].includes(ext)) {
      return (
        <div className="h-8 w-8 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-200/60 flex items-center justify-center shrink-0">
          <FileCode className="h-4 w-4" />
        </div>
      );
    }
    if (mime.includes('zip') || mime.includes('tar') || mime.includes('compressed') || ['zip', 'rar', '7z', 'gz'].includes(ext)) {
      return (
        <div className="h-8 w-8 rounded-lg bg-orange-50 text-orange-600 border border-orange-200/60 flex items-center justify-center shrink-0">
          <Archive className="h-4 w-4" />
        </div>
      );
    }
    if (mime.includes('pdf') || ext === 'pdf') {
      return (
        <div className="h-8 w-8 rounded-lg bg-rose-50 text-rose-600 border border-rose-200/60 flex items-center justify-center shrink-0">
          <FileText className="h-4 w-4" />
        </div>
      );
    }
    if (mime.includes('text') || mime.includes('markdown') || ['md', 'txt', 'csv', 'log', 'doc', 'docx'].includes(ext)) {
      return (
        <div className="h-8 w-8 rounded-lg bg-blue-50 text-blue-600 border border-blue-200/60 flex items-center justify-center shrink-0">
          <FileText className="h-4 w-4" />
        </div>
      );
    }
    return (
      <div className="h-8 w-8 rounded-lg bg-slate-100 text-slate-600 border border-slate-200 flex items-center justify-center shrink-0">
        <File className="h-4 w-4" />
      </div>
    );
  };

  // 8. Recursive substring highlighting without regex crashes
  const renderHighlightedFilename = (name: string, query: string): React.ReactNode => {
    if (!query) return name;
    const lowerName = name.toLowerCase();
    const lowerQuery = query.toLowerCase();
    const matchIndex = lowerName.indexOf(lowerQuery);

    if (matchIndex === -1) return name;

    const before = name.slice(0, matchIndex);
    const match = name.slice(matchIndex, matchIndex + query.length);
    const after = name.slice(matchIndex + query.length);

    return (
      <>
        {before}
        <mark className="bg-violet-100 text-violet-950 font-semibold rounded px-0.5 py-0.2">
          {match}
        </mark>
        {renderHighlightedFilename(after, query)}
      </>
    );
  };

  // Quick filter categories
  const quickFilters = [
    { label: 'PDF Documents', query: '.pdf', icon: FileText },
    { label: 'Images', query: 'image', icon: ImageIcon },
    { label: 'Markdown Notes', query: '.md', icon: FileText },
    { label: 'Data & CSV', query: '.csv', icon: FileCode }
  ];

  return (
    <div className="relative w-full" ref={containerRef}>
      {/* Search Bar Input */}
      <div className="relative flex items-center">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
        
        <input
          ref={inputRef}
          type="search"
          role="combobox"
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          aria-autocomplete="list"
          aria-controls="search-autocomplete-listbox"
          aria-activedescendant={selectedIndex >= 0 ? `suggestion-item-${selectedIndex}` : undefined}
          aria-label="Search files"
          value={searchQuery}
          onChange={(e) => {
            onSearchChange(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full rounded-xl border border-slate-200 bg-slate-50/70 hover:bg-slate-50 py-1.5 pl-9 pr-8 text-xs text-slate-900 placeholder-slate-400 transition-colors focus:border-violet-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/20"
        />

        {searchQuery && (
          <button
            type="button"
            onClick={() => {
              onSearchChange('');
              setSelectedIndex(-1);
              inputRef.current?.focus();
            }}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
            aria-label="Clear search query"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Smart Autocomplete Dropdown */}
      {isOpen && (
        <div
          ref={dropdownRef}
          id="search-autocomplete-listbox"
          role="listbox"
          aria-label="Search suggestions"
          className="absolute left-0 right-0 top-full mt-1.5 z-50 rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden text-xs animate-in fade-in slide-in-from-top-1 duration-150 max-h-[460px] flex flex-col"
        >
          {/* STATE 1: MATCHING RESULTS */}
          {trimmedQuery ? (
            matchingFiles.length > 0 ? (
              <div className="flex flex-col flex-1 overflow-hidden bg-white">
                {/* Header */}
                <div className="px-3.5 py-2 border-b border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-medium bg-slate-50">
                  <span>File Suggestions</span>
                  <span>{matchingFiles.length} {matchingFiles.length === 1 ? 'match' : 'matches'}</span>
                </div>

                {/* Suggestions List */}
                <div className="overflow-y-auto max-h-[320px] divide-y divide-slate-100/80 p-1 bg-white">
                  {matchingFiles.map((file, idx) => {
                    const isSelected = selectedIndex === idx;
                    const ext = file.fileName.split('.').pop()?.toUpperCase() || 'FILE';

                    return (
                      <button
                        key={file.fileId}
                        id={`suggestion-item-${idx}`}
                        role="option"
                        aria-selected={isSelected}
                        ref={(el) => { itemRefs.current[idx] = el; }}
                        onMouseDown={(e) => e.preventDefault()} // Prevents input blur before click
                        onClick={() => handleSelectFile(file)}
                        onMouseEnter={() => setSelectedIndex(idx)}
                        className={`w-full text-left p-2.5 rounded-xl flex items-center gap-3 transition-colors ${
                          isSelected 
                            ? 'bg-violet-50 text-slate-900 ring-1 ring-violet-400/40' 
                            : 'hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        {/* File Icon Badge */}
                        {getFileBadge(file.fileType, file.fileName)}

                        {/* Title & Metadata */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-slate-900 truncate">
                              {renderHighlightedFilename(file.fileName, trimmedQuery)}
                            </span>
                            <span className="shrink-0 text-[10px] font-semibold uppercase px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 border border-slate-200">
                              {ext}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500">
                            <span>{formatBytes(file.fileSize)}</span>
                            <span>•</span>
                            <span>{formatDate(file.uploadedAt)}</span>
                          </div>
                        </div>

                        {/* Preview Indicator */}
                        <div className="shrink-0 text-slate-400 group-hover:text-violet-600 flex items-center gap-1">
                          <span className="hidden sm:inline text-[10px] font-medium text-slate-400">Open</span>
                          <ArrowUpRight className="h-3.5 w-3.5" />
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Footer with full search CTA */}
                <div className="px-3.5 py-2.5 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-[11px] text-slate-600">
                  <div className="flex items-center gap-1.5">
                    <span className="kbd rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-mono shadow-xs font-semibold">Enter</span>
                    <span>to see all {totalMatchesCount} results in view</span>
                  </div>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleExecuteSearch(searchQuery)}
                    className="font-semibold text-violet-700 hover:text-violet-800 flex items-center gap-1"
                  >
                    <span>View all matches</span>
                    <CornerDownLeft className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ) : (
              /* STATE 2: NO MATCHES FOUND */
              <div className="p-6 text-center">
                <div className="mx-auto h-10 w-10 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center mb-2.5">
                  <Search className="h-5 w-5" />
                </div>
                <p className="font-bold text-slate-900 text-xs">
                  No matching files found
                </p>
                <p className="text-slate-500 text-[11px] mt-1 max-w-xs mx-auto">
                  No accessible files match &ldquo;<span className="font-medium text-slate-700">{trimmedQuery}</span>&rdquo;. Check spelling or try a broader keyword.
                </p>
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleExecuteSearch(searchQuery)}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 font-semibold text-slate-700 text-xs transition-colors"
                  >
                    Apply filter to vault
                  </button>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      onSearchChange('');
                      inputRef.current?.focus();
                    }}
                    className="px-3 py-1.5 rounded-lg text-slate-600 hover:text-slate-900 font-semibold text-xs"
                  >
                    Clear search
                  </button>
                </div>
              </div>
            )
          ) : (
            /* STATE 3: EMPTY QUERY PANEL (Recent searches + Quick filters + Recently uploaded) */
            <div className="flex flex-col flex-1 divide-y divide-slate-100 overflow-y-auto max-h-[380px]">
              
              {/* Section A: Recent Searches */}
              {recentSearches.length > 0 && (
                <div className="p-3">
                  <div className="flex items-center justify-between px-1 mb-1.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    <span className="flex items-center gap-1.5">
                      <Clock className="h-3 w-3 text-slate-400" />
                      Recent Searches
                    </span>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={clearRecentSearches}
                      className="text-[10px] normal-case font-medium text-slate-400 hover:text-rose-600 transition-colors"
                    >
                      Clear all
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {recentSearches.map((term) => (
                      <span
                        key={term}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-violet-50 hover:border-violet-200 hover:text-violet-900 text-slate-700 px-2.5 py-1 text-xs transition-colors group cursor-pointer"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          onSearchChange(term);
                          handleExecuteSearch(term);
                        }}
                      >
                        <Search className="h-3 w-3 text-slate-400 group-hover:text-violet-600" />
                        <span>{term}</span>
                        <button
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={(e) => removeRecentSearch(term, e)}
                          className="text-slate-400 hover:text-rose-600 ml-0.5"
                          title="Remove from history"
                          aria-label={`Remove ${term} from recent searches`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Section B: Quick File Type Shortcuts */}
              <div className="p-3 bg-slate-50/50">
                <div className="px-1 mb-2 text-[11px] font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="h-3 w-3 text-violet-500" />
                  Quick Filters
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {quickFilters.map((qf) => {
                    const IconComp = qf.icon;
                    return (
                      <button
                        key={qf.label}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          onSearchChange(qf.query);
                          handleExecuteSearch(qf.query);
                        }}
                        className="flex items-center gap-2 p-2 rounded-xl border border-slate-200 bg-white hover:bg-violet-50/60 hover:border-violet-200 text-left transition-all group"
                      >
                        <div className="h-6 w-6 rounded-md bg-slate-100 group-hover:bg-violet-100 text-slate-600 group-hover:text-violet-700 flex items-center justify-center shrink-0">
                          <IconComp className="h-3.5 w-3.5" />
                        </div>
                        <span className="font-semibold text-slate-800 text-xs group-hover:text-violet-950 truncate">
                          {qf.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Section C: Recently Uploaded Files */}
              {recentlyUploadedFiles.length > 0 && (
                <div className="p-3">
                  <div className="px-1 mb-1.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    Recent Files in Vault
                  </div>
                  <div className="space-y-1">
                    {recentlyUploadedFiles.map((file) => (
                      <button
                        key={file.fileId}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => handleSelectFile(file)}
                        className="w-full text-left p-2 rounded-xl hover:bg-slate-50 flex items-center justify-between gap-2 transition-colors group"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          {getFileBadge(file.fileType, file.fileName)}
                          <div className="min-w-0 truncate">
                            <p className="font-semibold text-slate-900 truncate">
                              {file.fileName}
                            </p>
                            <p className="text-[10px] text-slate-500">
                              {formatBytes(file.fileSize)} • {formatDate(file.uploadedAt)}
                            </p>
                          </div>
                        </div>
                        <span className="text-[10px] font-medium text-slate-400 group-hover:text-violet-700 shrink-0">
                          Open
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Prompt if no files and no history */}
              {recentSearches.length === 0 && recentlyUploadedFiles.length === 0 && (
                <div className="p-6 text-center text-slate-500">
                  <Search className="h-6 w-6 mx-auto mb-2 text-slate-400" />
                  <p className="font-medium text-slate-700">Type to search files</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Search your vault by document title, keywords, or extension.
                  </p>
                </div>
              )}

            </div>
          )}
        </div>
      )}
    </div>
  );
}
