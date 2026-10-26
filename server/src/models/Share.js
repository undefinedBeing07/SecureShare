import mongoose from 'mongoose';

const shareSchema = new mongoose.Schema({
  shareId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  shareToken: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  fileId: {
    type: String,
    required: true,
    index: true
  },
  ownerId: {
    type: String,
    required: true
  },
  accessType: {
    type: String,
    enum: ['view', 'download'],
    default: 'view'
  },
  expiresAt: {
    type: Date
  },
  downloadsCount: {
    type: Number,
    default: 0
  },
  viewsCount: {
    type: Number,
    default: 0
  },
  password: {
    type: String,
    default: null
  },
  hasPassword: {
    type: Boolean,
    default: false
  },
  isBurnAfterReading: {
    type: Boolean,
    default: false
  },
  isRevoked: {
    type: Boolean,
    default: false
  },
  burnedAt: {
    type: Date,
    default: null
  },
  revokedReason: {
    type: String,
    default: null
  },
  accessLogs: [
    {
      id: String,
      ip: String,
      userAgent: String,
      browser: String,
      os: String,
      accessType: String,
      timestamp: {
        type: Date,
        default: Date.now
      }
    }
  ],
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

export const ShareModel = mongoose.models.Share || mongoose.model('Share', shareSchema);
