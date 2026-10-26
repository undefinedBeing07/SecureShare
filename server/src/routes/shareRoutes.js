import express from 'express';
import fs from 'fs';
import path from 'path';
import { db } from '../db/store.js';
import { StorageService } from '../services/storage.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

function getMimeType(fileName, fallbackMime) {
  const ext = path.extname(fileName).toLowerCase();
  switch (ext) {
    case '.pdf': return 'application/pdf';
    case '.png': return 'image/png';
    case '.jpg':
    case '.jpeg': return 'image/jpeg';
    case '.gif': return 'image/gif';
    case '.webp': return 'image/webp';
    case '.svg': return 'image/svg+xml';
    case '.bmp': return 'image/bmp';
    case '.txt':
    case '.log': return 'text/plain; charset=utf-8';
    case '.md': return 'text/markdown; charset=utf-8';
    case '.csv': return 'text/csv; charset=utf-8';
    case '.json': return 'application/json; charset=utf-8';
    case '.mp4': return 'video/mp4';
    case '.webm': return 'video/webm';
    case '.mp3': return 'audio/mpeg';
    case '.wav': return 'audio/wav';
    case '.ogg': return 'audio/ogg';
    default: return fallbackMime || 'application/octet-stream';
  }
}

// GET /api/share/:token — Access shared file metadata & verification
router.get('/:token', (req, res) => {
  const { token } = req.params;
  const share = db.getShareByToken(token);

  if (!share) {
    return res.status(404).json({ error: 'Shared link not found or has been revoked.' });
  }

  // Check if link has self-destructed / been revoked
  if (share.isRevoked) {
    return res.status(410).json({ 
      error: 'This share link has self-destructed. One-time "Burn After Reading" links are destroyed upon access.',
      isBurned: true 
    });
  }

  // Check expiration
  if (share.expiresAt && new Date(share.expiresAt) < new Date()) {
    return res.status(410).json({ error: 'This share link has expired.' });
  }

  const file = db.getFileById(share.fileId);
  if (!file || file.isDeleted) {
    return res.status(404).json({ error: 'The shared file was deleted or moved to trash by its owner.' });
  }

  const owner = db.findUserById(share.ownerId);

  res.json({
    valid: true,
    share: {
      shareToken: share.shareToken,
      accessType: share.accessType,
      expiresAt: share.expiresAt,
      hasPassword: share.hasPassword || Boolean(share.password),
      isBurnAfterReading: Boolean(share.isBurnAfterReading),
      downloadsCount: share.downloadsCount || 0,
      createdAt: share.createdAt
    },
    file: {
      fileName: file.fileName,
      fileType: getMimeType(file.fileName, file.fileType),
      fileSize: file.fileSize,
      scanStatus: file.scanStatus,
      scanDetails: {
        engine: file.scanDetails?.engine,
        sha256: file.scanDetails?.sha256,
        scannedAt: file.scanDetails?.scannedAt
      },
      ownerName: owner ? owner.displayName : file.ownerName || 'Verified User',
      uploadedAt: file.uploadedAt
    }
  });
});

// POST /api/share/:token/verify — Verify passcode for protected share link
router.post('/:token/verify', (req, res) => {
  const { token } = req.params;
  const { password } = req.body;
  const share = db.getShareByToken(token);

  if (!share) {
    return res.status(404).json({ error: 'Shared link not found or has expired' });
  }

  if (share.isRevoked) {
    return res.status(410).json({ error: 'This share link has self-destructed.', isBurned: true });
  }

  if (share.expiresAt && new Date(share.expiresAt) < new Date()) {
    return res.status(410).json({ error: 'This share link has expired.' });
  }

  if (share.password && share.password !== password) {
    return res.status(401).json({ error: 'Incorrect passcode. Access denied.' });
  }

  return res.json({ success: true, message: 'Passcode verified successfully.' });
});

// GET /api/share/:token/analytics — Retrieve access analytics for file owner
router.get('/:token/analytics', requireAuth, (req, res) => {
  const { token } = req.params;
  const share = db.getShareByToken(token);

  if (!share) {
    return res.status(404).json({ error: 'Shared link not found' });
  }

  if (share.ownerId !== req.user.userId) {
    return res.status(403).json({ error: 'Access denied. You can only view analytics for your own shared links.' });
  }

  const analytics = db.getShareAnalytics(token);
  return res.json({ success: true, analytics });
});

// GET /api/share/:token/download — Download the shared file
router.get('/:token/download', (req, res) => {
  const { token } = req.params;
  const password = req.query.password || req.headers['x-share-password'];
  const share = db.getShareByToken(token);

  if (!share) {
    return res.status(404).json({ error: 'Shared link not found or expired' });
  }

  // Check if link has self-destructed
  if (share.isRevoked) {
    return res.status(410).json({ 
      error: 'This share link has self-destructed. One-time "Burn After Reading" links are destroyed upon access.',
      isBurned: true 
    });
  }

  // Check expiration
  if (share.expiresAt && new Date(share.expiresAt) < new Date()) {
    return res.status(410).json({ error: 'Share link has expired' });
  }

  // Check access type
  if (share.accessType === 'view') {
    return res.status(403).json({ error: 'This link grants view-only access. Downloads are restricted.' });
  }

  // Check password if set
  if (share.password && share.password !== password) {
    return res.status(401).json({ error: 'Passcode required or incorrect passcode.' });
  }

  const file = db.getFileById(share.fileId);
  if (!file || file.isDeleted) {
    return res.status(404).json({ error: 'File no longer exists or was moved to trash' });
  }

  try {
    const stream = StorageService.getFileStream(file.storageKey);
    // Record download telemetry
    db.recordShareAccess(token, {
      ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress,
      userAgent: req.headers['user-agent'],
      accessType: 'download'
    });
    
    // If burn-after-reading, destroy immediately after stream completes
    if (share.isBurnAfterReading) {
      res.on('finish', () => {
        db.burnShare(token, 'Burned after one-time file download');
      });
    }

    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.fileName)}"`);
    res.setHeader('Content-Type', getMimeType(file.fileName, file.fileType));
    res.setHeader('Content-Length', file.fileSize);
    stream.pipe(res);
  } catch (err) {
    res.status(500).json({ error: 'Failed to stream shared file: ' + err.message });
  }
});

// GET /api/share/:token/preview — Stream preview for shared file with byte-range support
router.get('/:token/preview', (req, res) => {
  const { token } = req.params;
  const password = req.query.password || req.headers['x-share-password'];
  const share = db.getShareByToken(token);

  if (!share) {
    return res.status(404).json({ error: 'Shared link not found' });
  }

  // Check if link has self-destructed
  if (share.isRevoked) {
    return res.status(410).json({ 
      error: 'This share link has self-destructed. One-time "Burn After Reading" links are destroyed upon access.',
      isBurned: true 
    });
  }

  if (share.expiresAt && new Date(share.expiresAt) < new Date()) {
    return res.status(410).json({ error: 'Share link has expired' });
  }

  // Check password if set
  if (share.password && share.password !== password) {
    return res.status(401).json({ error: 'Passcode required or incorrect passcode.' });
  }

  const file = db.getFileById(share.fileId);
  if (!file || file.isDeleted) {
    return res.status(404).json({ error: 'File not found or was moved to trash' });
  }

  try {
    // Record view telemetry
    db.recordShareAccess(token, {
      ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress,
      userAgent: req.headers['user-agent'],
      accessType: 'view'
    });

    // If burn-after-reading:
    if (share.isBurnAfterReading) {
      if (req.headers.range) {
        // Range requests (e.g. video player): give a 20-second grace window to buffer initial chunks before self-destructing
        if (!share._burnTimer) {
          share._burnTimer = setTimeout(() => {
            db.burnShare(token, 'Burned after media preview buffering completed');
          }, 20000);
        }
      } else {
        // Single preview request (images, text, pdfs, etc.): destroy upon stream finish
        res.on('finish', () => {
          db.burnShare(token, 'Burned after one-time document preview');
        });
      }
    }

    const filePath = StorageService.getLocalFilePath(file.storageKey);
    if (!filePath || !fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File content could not be located in storage' });
    }

    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const contentType = getMimeType(file.fileName, file.fileType);
    const range = req.headers.range;

    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

      if (start >= fileSize || end >= fileSize) {
        res.setHeader('Content-Range', `bytes */${fileSize}`);
        return res.status(416).end();
      }

      const chunksize = (end - start) + 1;
      const fileStream = fs.createReadStream(filePath, { start, end });
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': contentType,
        'Content-Disposition': `inline; filename="${encodeURIComponent(file.fileName)}"`
      });
      fileStream.pipe(res);
    } else {
      res.writeHead(200, {
        'Content-Length': fileSize,
        'Content-Type': contentType,
        'Accept-Ranges': 'bytes',
        'Content-Disposition': `inline; filename="${encodeURIComponent(file.fileName)}"`
      });
      fs.createReadStream(filePath).pipe(res);
    }
  } catch (err) {
    res.status(500).json({ error: 'Failed to stream preview: ' + err.message });
  }
});

export default router;
