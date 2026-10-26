import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import authRoutes from './routes/authRoutes.js';
import fileRoutes from './routes/fileRoutes.js';
import shareRoutes from './routes/shareRoutes.js';
import statsRoutes from './routes/statsRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import { db } from './db/store.js';
import { isMongoConnected } from './db/mongo.js';
import { StorageService } from './services/storage.js';
import fs from 'fs';
import path from 'path';

const app = express();

// Configurable CORS origins for production and local development
const configuredOrigins = [];
if (process.env.CLIENT_URL) {
  configuredOrigins.push(process.env.CLIENT_URL.trim().replace(/\/+$/, ''));
}
if (process.env.FRONTEND_URL) {
  configuredOrigins.push(process.env.FRONTEND_URL.trim().replace(/\/+$/, ''));
}

const localOrigins = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:5000',
  'http://127.0.0.1:5000'
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow non-browser requests (e.g. mobile apps, curl, server-to-server)
    if (!origin) return callback(null, true);

    const isLocal = localOrigins.includes(origin);
    const isConfigured = configuredOrigins.includes(origin);
    const isVercel = /^https:\/\/.*\.vercel\.app$/.test(origin);
    const isDev = process.env.NODE_ENV !== 'production';

    if (isConfigured || isVercel || (isDev && isLocal)) {
      return callback(null, true);
    }

    if (!process.env.CLIENT_URL && !process.env.FRONTEND_URL && isLocal) {
      return callback(null, true);
    }

    console.warn(`[CORS] Blocked request from origin: ${origin}`);
    return callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logger
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Lightweight health check endpoint for cloud service monitors (Render)
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/share', shareRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/notifications', notificationRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  const mongoLive = isMongoConnected();
  res.json({
    status: 'online',
    service: 'SecureShare Enterprise Core API',
    version: '1.0.0',
    mongoConnected: mongoLive,
    database: mongoLive ? 'MongoDB Atlas (Live Connected)' : 'Local JSON Fallback Datastore',
    stack: {
      frontend: 'Next.js 14 + TypeScript + Tailwind CSS',
      backend: 'Node.js + Express.js',
      database: 'MongoDB Metadata Layer',
      storage: 'Cloudflare R2 Object Store',
      security: 'Sentinel Malware Scanner API'
    },
    timestamp: new Date().toISOString()
  });
});

// Seed demo files helper for presentation demo
app.post('/api/seed-samples', async (req, res) => {
  const demoUserId = 'usr_demo_01';
  
  // Create sample 1: Project Report
  const sample1Content = '# Enterprise Cloud Architecture Whitepaper\n\nPlatform: SecureShare Enterprise\nArchitecture: Next.js + Express + MongoDB + Cloudflare R2 + Sentinel Virus Scan API\n\nAll uploads undergo real-time cryptographic SHA-256 and deep virus signature scanning before object commitment.';
  const sample1Path = path.join(config.dataDir, 'temp_sample1.md');
  fs.writeFileSync(sample1Path, sample1Content);
  const sample1Storage = await StorageService.saveFile('sample_doc_01', 'Cloud_Security_Architecture.md', sample1Path, 'text/markdown');

  const file1 = {
    fileId: 'sample_doc_01',
    ownerId: demoUserId,
    ownerName: 'Alex Chen',
    fileName: 'Cloud_Security_Architecture.md',
    fileType: 'text/markdown',
    fileSize: Buffer.byteLength(sample1Content),
    storageKey: sample1Storage.storageKey,
    storageProvider: 'Cloudflare R2 (Simulated Storage)',
    scanStatus: 'CLEAN',
    scanDetails: {
      engine: 'Sentinel Virus Scan API v2.4',
      scanDurationMs: 145,
      sha256: 'a38f92182c0b4356b71fba2981030e460a87612dc579122c4f51e0321a4f0891',
      quarantineAction: 'APPROVED_FOR_STORAGE',
      scannedAt: new Date().toISOString()
    },
    uploadedAt: new Date(Date.now() - 3600000).toISOString()
  };

  // Create sample 2: Architecture Presentation
  const sample2Content = 'System Architecture Overview:\n- Frontend: Next.js 14 (Blackish Enterprise Theme, Responsive UI)\n- Core API: Express REST Server\n- Security Engine: Sentinel Anti-Malware Multi-Heuristic Scanner\n- Storage Layer: Cloudflare R2 Object Store\n- Metadata Store: MongoDB Document Engine';
  const sample2Path = path.join(config.dataDir, 'temp_sample2.txt');
  fs.writeFileSync(sample2Path, sample2Content);
  const sample2Storage = await StorageService.saveFile('sample_doc_02', 'System_Architecture_Specs.txt', sample2Path, 'text/plain');

  const file2 = {
    fileId: 'sample_doc_02',
    ownerId: demoUserId,
    ownerName: 'Alex Chen',
    fileName: 'System_Architecture_Specs.txt',
    fileType: 'text/plain',
    fileSize: Buffer.byteLength(sample2Content),
    storageKey: sample2Storage.storageKey,
    storageProvider: 'Cloudflare R2 (Simulated Storage)',
    scanStatus: 'CLEAN',
    scanDetails: {
      engine: 'Sentinel Virus Scan API v2.4',
      scanDurationMs: 180,
      sha256: '9f83a2182c0b4356b71fba2981030e460a87612dc579122c4f51e0321a4f0777',
      quarantineAction: 'APPROVED_FOR_STORAGE',
      scannedAt: new Date().toISOString()
    },
    uploadedAt: new Date(Date.now() - 7200000).toISOString()
  };

  // Add sample files if not present
  if (!db.getFileById(file1.fileId)) db.addFile(file1);
  if (!db.getFileById(file2.fileId)) db.addFile(file2);

  // Add a sample share link for file 1
  if (!db.getShareByToken('demo-shared-doc')) {
    db.addShare({
      shareId: 'shr_sample_01',
      fileId: file1.fileId,
      ownerId: demoUserId,
      shareToken: 'demo-shared-doc',
      accessType: 'download',
      downloadsCount: 3,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 86400000 * 3).toISOString()
    });
  }

  res.json({ message: 'Sample documentation files seeded successfully', files: [file1, file2] });
});

// Seed default samples on initial launch if empty
const existingFiles = db.getFiles();
if (existingFiles.length === 0) {
  setTimeout(async () => {
    try {
      const sampleContent = '# SecureShare Enterprise — Cloud Storage Engine\n\n' +
        'High-Performance, Secure and Scalable File Sharing Platform.\n\n' +
        'Core Platform Pillars:\n' +
        '1. Enterprise Authentication & Session Management\n' +
        '2. Multi-stage Virus & Malware Scanning\n' +
        '3. Cloudflare R2 Global Edge Object Storage\n' +
        '4. MongoDB Metadata & Token Access Security\n' +
        '5. Live 5-Stage Upload Progress Stream\n';
      const samplePath = path.join(config.dataDir, 'temp_readme.md');
      fs.writeFileSync(samplePath, sampleContent);
      const st = await StorageService.saveFile('file_welcome_01', 'Enterprise_Platform_Overview.md', samplePath, 'text/markdown');
      db.addFile({
        fileId: 'file_welcome_01',
        ownerId: 'usr_demo_01',
        ownerName: 'Alex Chen',
        fileName: 'Enterprise_Platform_Overview.md',
        fileType: 'text/markdown',
        fileSize: Buffer.byteLength(sampleContent),
        storageKey: st.storageKey,
        storageProvider: 'Cloudflare R2 (Simulated Storage)',
        scanStatus: 'CLEAN',
        scanDetails: {
          engine: 'Sentinel Virus Scan API v2.4',
          scanDurationMs: 120,
          sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
          quarantineAction: 'APPROVED_FOR_STORAGE',
          scannedAt: new Date().toISOString()
        },
        uploadedAt: new Date().toISOString()
      });
    } catch (e) {
      console.warn('Initial seed skipped:', e.message);
    }
  }, 100);
}

// Global error handler
app.use((err, req, res, next) => {
  console.error('[Server Error]', err);
  const isProd = process.env.NODE_ENV === 'production';
  res.status(err.status || 500).json({
    error: 'Internal Server Error',
    message: isProd ? 'An unexpected server error occurred' : err.message
  });
});

// Start Express server
const PORT = process.env.PORT || config.port || 5000;
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`=======================================================`);
  console.log(` SecureShare Enterprise Server - Express API `);
  console.log(` Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(` Running on: http://0.0.0.0:${PORT}`);
  console.log(` Health: http://0.0.0.0:${PORT}/api/health`);
  console.log(`=======================================================`);
});

// Graceful shutdown handling for container platforms like Render
process.on('SIGTERM', () => {
  console.log('[Server] SIGTERM received. Gracefully closing HTTP server...');
  server.close(() => {
    console.log('[Server] HTTP server closed cleanly.');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('[Server] SIGINT received. Shutting down...');
  server.close(() => {
    process.exit(0);
  });
});
