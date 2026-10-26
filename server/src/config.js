import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Explicitly load server/.env
dotenv.config({ path: path.join(__dirname, '..', '.env') });
dotenv.config();

export const config = {
  port: process.env.PORT || 5000,
  jwtSecret: process.env.JWT_SECRET || 'secureshare-enterprise-jwt-secret-2026',
  storageDir: process.env.STORAGE_DIR || path.join(__dirname, '..', 'storage_r2'),
  dataDir: process.env.DATA_DIR || path.join(__dirname, '..', 'data'),
  
  // Cloudflare R2 / S3 config (Optional - uses local R2-emulated storage if missing)
  r2: {
    accountId: process.env.R2_ACCOUNT_ID || '',
    accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
    bucketName: process.env.R2_BUCKET_NAME || 'secure-files',
    endpoint: process.env.R2_ENDPOINT || '',
  },
  
  // MongoDB config (Optional - uses persistent JSON datastore if missing or unreachable)
  mongoUri: process.env.MONGODB_URI || '',

  // Firebase Auth (Optional - uses built-in JWT / demo sessions if credentials not set)
  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID || '',
  },
  
  // Max upload size (e.g., 500 MB for prototype)
  maxUploadSizeBytes: 500 * 1024 * 1024,

  // SMTP Email Delivery Configuration
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true' || process.env.SMTP_PORT === '465',
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.EMAIL_FROM || 'Secure Share <no-reply@secureshare.io>',
  },
};
