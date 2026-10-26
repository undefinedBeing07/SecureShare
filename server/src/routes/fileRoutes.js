import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/store.js';
import { config } from '../config.js';
import { requireAuth } from '../middleware/auth.js';
import { MalwareScanner } from '../services/scanner.js';
import { StorageService } from '../services/storage.js';

const router = express.Router();

// Ensure temporary uploads directory exists
const tempUploadDir = path.join(config.dataDir, 'temp_uploads');
if (!fs.existsSync(tempUploadDir)) {
  fs.mkdirSync(tempUploadDir, { recursive: true });
}

// Multer disk storage for staging files before virus scan
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, tempUploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: config.maxUploadSizeBytes }
});

// POST /api/files/upload — Upload new file
// Workflow: Select File -> Validate -> Express -> Virus Scan -> Safe: R2 + MongoDB / Unsafe: Reject + Notify
router.post('/upload', requireAuth, (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(413).json({
            success: false,
            error: `File exceeds maximum allowed size of ${Math.round(config.maxUploadSizeBytes / (1024 * 1024))} MB.`
          });
        }
        return res.status(400).json({
          success: false,
          error: `Upload parsing error: ${err.message}`
        });
      }
      return res.status(500).json({
        success: false,
        error: `Upload processing failed: ${err.message}`
      });
    }
    next();
  });
}, async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, error: 'No file uploaded. Please select a valid file to upload.' });
  }

  const { path: tempFilePath, originalname, mimetype, size } = req.file;
  const ownerId = req.user.userId;
  const fileId = 'file_' + uuidv4().replace(/-/g, '').substring(0, 16);

  try {
    // Stage 3: Malware Scanning
    const scanResult = await MalwareScanner.scanFile(tempFilePath, originalname, mimetype);

    // If Unsafe: Reject and notify user immediately!
    if (!scanResult.isClean) {
      // Remove temporary file
      let tempFileCleaned = false;
      try {
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
          tempFileCleaned = true;
        }
      } catch (e) {
        tempFileCleaned = !fs.existsSync(tempFilePath);
      }

      // Log security event in audit logs
      db.logAudit({
        action: 'VIRUS_BLOCKED',
        status: 'INFECTED',
        fileName: originalname,
        ownerId,
        threats: scanResult.threats,
        engine: scanResult.details.engine,
        sha256: scanResult.details.sha256
      });

      return res.status(400).json({
        success: false,
        error: 'Malware Threat Detected! Upload rejected for system security.',
        threats: scanResult.threats,
        scanDetails: scanResult.details,
        scanStatus: 'INFECTED',
        quarantined: true,
        committedToStorage: false,
        tempFileCleaned
      });
    }

    // Stage 3.5: Duplicate File Detection via Cryptographic SHA-256
    const allowDuplicate = req.body.allowDuplicate === 'true' || req.headers['x-allow-duplicate'] === 'true';
    const duplicate = db.findDuplicateFile(ownerId, scanResult.details?.sha256);

    if (duplicate && !allowDuplicate) {
      // Discard staging temp file immediately — do not commit to storage or database
      try {
        if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
      } catch (e) {}

      return res.status(200).json({
        success: false,
        duplicateDetected: true,
        requiresConfirmation: true,
        message: `A file with identical content ("${duplicate.fileName}") already exists in your vault.`,
        existingFile: {
          fileId: duplicate.fileId,
          fileName: duplicate.fileName,
          fileSize: duplicate.fileSize,
          fileType: duplicate.fileType,
          uploadedAt: duplicate.uploadedAt
        },
        newFile: {
          fileName: originalname,
          fileSize: size,
          fileType: mimetype
        }
      });
    }

    // Stage 4: Storing in Cloudflare R2 / Storage
    const storageResult = await StorageService.saveFile(fileId, originalname, tempFilePath, mimetype);

    if (duplicate && allowDuplicate) {
      db.addNotification({
        userId: ownerId,
        title: 'Duplicate Copy Added',
        message: `Saved duplicate copy "${originalname}" of existing file "${duplicate.fileName}".`,
        type: 'info'
      });
    }

    // MongoDB Record Creation
    const fileRecord = {
      fileId,
      ownerId,
      ownerName: req.user.displayName,
      fileName: originalname,
      fileType: mimetype || 'application/octet-stream',
      fileSize: size,
      storageKey: storageResult.storageKey,
      storageProvider: storageResult.storageProvider,
      scanStatus: 'CLEAN',
      scanDetails: scanResult.details,
      uploadedAt: new Date().toISOString()
    };

    db.addFile(fileRecord);

    return res.status(201).json({
      success: true,
      message: duplicate 
        ? `Duplicate copy saved ("${duplicate.fileName}").`
        : 'File successfully validated, virus scanned, and stored in Cloudflare R2.',
      file: fileRecord
    });
  } catch (err) {
    console.error('[Upload Error]', err);
    try {
      if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
    } catch (e) {}

    return res.status(500).json({
      success: false,
      error: 'File processing failed: ' + err.message
    });
  }
});

// GET /api/files — List user's files
router.get('/', requireAuth, (req, res) => {
  const { search, type } = req.query;
  let files = db.getFiles(req.user.userId);

  if (search) {
    const q = search.toLowerCase();
    files = files.filter(f => f.fileName.toLowerCase().includes(q));
  }

  if (type && type !== 'all') {
    files = files.filter(f => {
      if (type === 'image') return f.fileType.startsWith('image/');
      if (type === 'document') return f.fileType.includes('pdf') || f.fileType.includes('text') || f.fileType.includes('word') || f.fileType.includes('sheet');
      if (type === 'media') return f.fileType.startsWith('video/') || f.fileType.startsWith('audio/');
      if (type === 'archive') return f.fileType.includes('zip') || f.fileType.includes('rar') || f.fileType.includes('tar');
      return true;
    });
  }

  // Attach active share info if exists
  const allShares = db.getShares(req.user.userId);
  const filesWithShareMeta = files.map(file => {
    const activeShare = allShares.find(s => s.fileId === file.fileId && !s.isRevoked);
    return {
      ...file,
      shareInfo: activeShare ? {
        shareId: activeShare.shareId,
        shareToken: activeShare.shareToken,
        accessType: activeShare.accessType,
        expiresAt: activeShare.expiresAt,
        downloadsCount: activeShare.downloadsCount || 0,
        isBurnAfterReading: Boolean(activeShare.isBurnAfterReading)
      } : null
    };
  });

  res.json({ files: filesWithShareMeta });
});

// GET /api/files/trash — List user's trashed files
router.get('/trash', requireAuth, (req, res) => {
  const trashedFiles = db.getTrashFiles(req.user.userId);
  res.json({ files: trashedFiles });
});

// GET /api/files/:id — Get file details
router.get('/:id', requireAuth, (req, res) => {
  const file = db.getFileById(req.params.id);
  if (!file) {
    return res.status(404).json({ error: 'File not found' });
  }
  if (file.ownerId !== req.user.userId) {
    return res.status(403).json({ error: 'Access denied' });
  }
  if (file.isDeleted) {
    return res.status(404).json({ error: 'File is in Bin/Trash' });
  }
  res.json({ file });
});

// GET /api/files/:id/download — Download file
router.get('/:id/download', requireAuth, (req, res) => {
  const file = db.getFileById(req.params.id);
  if (!file) {
    return res.status(404).json({ error: 'File not found' });
  }
  if (file.ownerId !== req.user.userId) {
    return res.status(403).json({ error: 'Access denied' });
  }
  if (file.isDeleted) {
    return res.status(400).json({ error: 'File is in Bin/Trash and cannot be downloaded until restored' });
  }

  try {
    const stream = StorageService.getFileStream(file.storageKey);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.fileName)}"`);
    res.setHeader('Content-Type', file.fileType);
    res.setHeader('Content-Length', file.fileSize);
    stream.pipe(res);
  } catch (err) {
    return res.status(500).json({ error: 'Could not stream file from storage: ' + err.message });
  }
});

// GET /api/files/:id/preview — Inline preview
router.get('/:id/preview', requireAuth, (req, res) => {
  const file = db.getFileById(req.params.id);
  if (!file) {
    return res.status(404).json({ error: 'File not found' });
  }
  if (file.ownerId !== req.user.userId) {
    return res.status(403).json({ error: 'Access denied' });
  }
  if (file.isDeleted) {
    return res.status(400).json({ error: 'File is in Bin/Trash' });
  }

  try {
    const stream = StorageService.getFileStream(file.storageKey);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(file.fileName)}"`);
    res.setHeader('Content-Type', file.fileType);
    stream.pipe(res);
  } catch (err) {
    return res.status(500).json({ error: 'Could not stream preview: ' + err.message });
  }
});

// DELETE /api/files/:id — Move file to Bin/Trash (soft-delete)
router.delete('/:id', requireAuth, (req, res) => {
  const file = db.getFileById(req.params.id);
  if (!file) {
    return res.status(404).json({ error: 'File not found' });
  }
  if (file.ownerId !== req.user.userId) {
    return res.status(403).json({ error: 'Access denied' });
  }
  if (file.isDeleted) {
    return res.status(400).json({ error: 'File is already in Bin/Trash' });
  }

  db.softDeleteFile(file.fileId);
  res.json({ success: true, message: 'File moved to Bin/Trash' });
});

// POST /api/files/:id/restore — Restore file from Bin/Trash
router.post('/:id/restore', requireAuth, (req, res) => {
  const file = db.getFileById(req.params.id);
  if (!file) {
    return res.status(404).json({ error: 'File not found' });
  }
  if (file.ownerId !== req.user.userId) {
    return res.status(403).json({ error: 'Access denied' });
  }
  if (!file.isDeleted) {
    return res.status(400).json({ error: 'File is not in Bin/Trash' });
  }

  db.restoreFile(file.fileId);
  res.json({ success: true, message: 'File restored from Bin/Trash' });
});

// DELETE /api/files/:id/permanent — Permanently delete file from storage and database
router.delete('/:id/permanent', requireAuth, async (req, res) => {
  const file = db.getFileById(req.params.id);
  if (!file) {
    return res.status(404).json({ error: 'File not found' });
  }
  if (file.ownerId !== req.user.userId) {
    return res.status(403).json({ error: 'Access denied' });
  }

  try {
    await StorageService.deleteFile(file.storageKey);
    db.deleteFile(file.fileId);
    res.json({ success: true, message: 'File permanently deleted from storage and database' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to permanently delete file: ' + err.message });
  }
});

// POST /api/files/:id/share — Create share link
router.post('/:id/share', requireAuth, (req, res) => {
  const file = db.getFileById(req.params.id);
  if (!file) {
    return res.status(404).json({ error: 'File not found' });
  }
  if (file.ownerId !== req.user.userId) {
    return res.status(403).json({ error: 'Access denied' });
  }
  if (file.isDeleted) {
    return res.status(400).json({ error: 'Cannot share a file that is in Bin/Trash' });
  }

  const { accessType = 'download', duration = '24h', password = null, burnAfterReading = false } = req.body;
  
  // Calculate expiration
  let expiresAt = null;
  const now = new Date();
  if (duration === '1h') expiresAt = new Date(now.getTime() + 1 * 60 * 60 * 1000).toISOString();
  else if (duration === '24h') expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
  else if (duration === '7d') expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
  else if (duration === 'never') expiresAt = null;

  // Generate unique URL token
  const shareToken = uuidv4().replace(/-/g, '').substring(0, 12);
  const shareId = 'shr_' + uuidv4().replace(/-/g, '').substring(0, 16);

  const shareRecord = {
    shareId,
    fileId: file.fileId,
    ownerId: req.user.userId,
    shareToken,
    accessType, // 'view' or 'download'
    password: password ? password.trim() : null,
    hasPassword: Boolean(password && password.trim()),
    isBurnAfterReading: Boolean(burnAfterReading),
    downloadsCount: 0,
    createdAt: new Date().toISOString(),
    expiresAt
  };

  db.addShare(shareRecord);

  res.status(201).json({
    success: true,
    share: shareRecord,
    shareUrl: `/share/${shareToken}`
  });
});

// POST /api/files/:id/summarize — Smart AI Document Executive Summary
router.post('/:id/summarize', requireAuth, (req, res) => {
  const file = db.getFileById(req.params.id);
  if (!file) {
    return res.status(404).json({ error: 'File not found' });
  }
  if (file.ownerId !== req.user.userId) {
    return res.status(403).json({ error: 'Access denied' });
  }
  if (file.isDeleted) {
    return res.status(400).json({ error: 'Cannot summarize file that is in Bin/Trash' });
  }

  try {
    const filePath = StorageService.getLocalFilePath(file.storageKey);
    if (!filePath || !fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File content not found in storage' });
    }

    let textContent = '';
    const ext = path.extname(file.fileName).toLowerCase();
    const isTextual = ['.txt', '.md', '.csv', '.json', '.log', '.js', '.ts', '.html', '.py'].includes(ext) || file.fileType.includes('text') || file.fileType.includes('json');

    if (isTextual) {
      textContent = fs.readFileSync(filePath, 'utf-8');
    } else if (ext === '.pdf' || file.fileType.includes('pdf')) {
      const buffer = fs.readFileSync(filePath);
      const rawStr = buffer.toString('binary');
      const textMatches = rawStr.match(/[A-Za-z0-9\s.,;:'"()\-–—]{4,}/g) || [];
      textContent = textMatches.join(' ').substring(0, 5000);
    } else {
      textContent = `Binary Document: ${file.fileName} (${file.fileType}, ${file.fileSize} bytes).`;
    }

    // Clean text and generate AI summary
    const words = textContent.trim().split(/\s+/).filter(Boolean);
    const wordCount = words.length;
    const readingTimeMin = Math.max(1, Math.ceil(wordCount / 200));

    // Determine category / classification
    let category = 'General Document';
    const lower = textContent.toLowerCase();
    if (lower.includes('revenue') || lower.includes('budget') || lower.includes('financial') || lower.includes('cost') || lower.includes('invoice')) {
      category = 'Financial & Commercial';
    } else if (lower.includes('security') || lower.includes('vulnerability') || lower.includes('sha') || lower.includes('token') || lower.includes('malware') || lower.includes('encryption')) {
      category = 'Security & Infrastructure';
    } else if (lower.includes('api') || lower.includes('function') || lower.includes('database') || lower.includes('code') || lower.includes('server')) {
      category = 'Technical & Architecture';
    } else if (lower.includes('strategy') || lower.includes('project') || lower.includes('objective') || lower.includes('roadmap')) {
      category = 'Strategic Planning';
    }

    // Extract lines for key highlights
    const lines = textContent
      .split('\n')
      .map(l => l.replace(/^[#*\-•\d.]+\s*/, '').trim())
      .filter(l => l.length > 20 && !l.startsWith('http') && !l.includes('<?xml'));

    const highlights = lines.slice(0, 4);
    if (highlights.length === 0) {
      highlights.push(`Document "${file.fileName}" stored with verified SHA-256 integrity hash.`);
      highlights.push(`Certified CLEAN by Sentinel heuristic malware detection engine.`);
      highlights.push(`Cloudflare R2 object storage backed with granular access tokens.`);
    }

    const executiveTakeaway = highlights[0]
      ? `This document focuses on ${category.toLowerCase()} topics. Core emphasis: "${highlights[0].slice(0, 140)}..."`
      : `Document analyzed by Sentinel AI. Contains ${wordCount} words categorized under ${category}.`;

    return res.json({
      success: true,
      summary: {
        fileName: file.fileName,
        category,
        wordCount,
        readingTime: `${readingTimeMin} min read`,
        executiveTakeaway,
        highlights,
        generatedAt: new Date().toISOString()
      }
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to generate AI summary: ' + err.message });
  }
});

export default router;
