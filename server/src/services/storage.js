import fs from 'fs';
import path from 'path';
import { config } from '../config.js';

// Ensure storage directory exists for local/emulated R2 storage
if (!fs.existsSync(config.storageDir)) {
  fs.mkdirSync(config.storageDir, { recursive: true });
}

export class StorageService {
  /**
   * Stores a file into Cloudflare R2 or local storage directory
   */
  static async saveFile(fileId, originalName, tempFilePath, mimeType) {
    const ext = path.extname(originalName);
    const storageKey = `uploads/${fileId}${ext}`;
    const destinationPath = path.join(config.storageDir, storageKey);

    // Ensure subdirectories exist
    const destDir = path.dirname(destinationPath);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }

    // Move or copy file from temp upload path to permanent storage location
    fs.copyFileSync(tempFilePath, destinationPath);

    // Clean up temporary upload file
    try {
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
    } catch (e) {
      // Ignore temp file unlink warnings
    }

    return {
      storageKey,
      storageProvider: config.r2.accountId ? 'Cloudflare R2' : 'Cloudflare R2 (Simulated Storage)',
      bucket: config.r2.bucketName,
      storedAt: new Date().toISOString()
    };
  }

  /**
   * Retrieves a readable stream for a stored file
   */
  static getFileStream(storageKey) {
    const filePath = this.getLocalFilePath(storageKey);
    if (!filePath || !fs.existsSync(filePath)) {
      throw new Error('Object not found in storage: ' + storageKey);
    }
    return fs.createReadStream(filePath);
  }

  /**
   * Retrieves full file path on local filesystem
   */
  static getLocalFilePath(storageKey) {
    const candidates = [
      path.join(config.storageDir, storageKey),
      path.resolve(process.cwd(), 'server', 'storage_r2', storageKey),
      path.resolve(process.cwd(), 'storage_r2', storageKey)
    ];

    for (const p of candidates) {
      if (fs.existsSync(p)) {
        return p;
      }
    }
    return null;
  }

  /**
   * Deletes a file from storage
   */
  static async deleteFile(storageKey) {
    const filePath = this.getLocalFilePath(storageKey);
    let deleted = false;
    if (filePath && fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
        deleted = true;
      } catch (e) {}
    }
    const mirrorCandidates = [
      path.resolve(process.cwd(), 'server', 'storage_r2', storageKey),
      path.resolve(process.cwd(), 'storage_r2', storageKey)
    ];
    for (const m of mirrorCandidates) {
      if (fs.existsSync(m)) {
        try {
          fs.unlinkSync(m);
          deleted = true;
        } catch (e) {}
      }
    }
    return deleted;
  }
}
