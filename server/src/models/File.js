import mongoose from 'mongoose';

const fileSchema = new mongoose.Schema({
  fileId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  ownerId: {
    type: String,
    required: true,
    index: true
  },
  ownerName: {
    type: String,
    required: true
  },
  fileName: {
    type: String,
    required: true
  },
  fileType: {
    type: String,
    required: true
  },
  fileSize: {
    type: Number,
    required: true
  },
  storageKey: {
    type: String,
    required: true
  },
  storageProvider: {
    type: String,
    default: 'Cloudflare R2 (Simulated Storage)'
  },
  scanStatus: {
    type: String,
    enum: ['CLEAN', 'SAFE', 'INFECTED', 'PENDING'],
    default: 'CLEAN'
  },
  scanDetails: {
    engine: String,
    scanDurationMs: Number,
    sha256: String,
    md5: String,
    entropy: Number,
    quarantineAction: String,
    scannedAt: Date
  },
  uploadedAt: {
    type: Date,
    default: Date.now
  },
  isDeleted: {
    type: Boolean,
    default: false,
    index: true
  },
  deletedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true,
  strict: false
});

export const FileModel = mongoose.models.File || mongoose.model('File', fileSchema);
