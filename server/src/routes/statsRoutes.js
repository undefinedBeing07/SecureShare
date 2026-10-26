import express from 'express';
import { db } from '../db/store.js';
import { config } from '../config.js';
import { requireAuth } from '../middleware/auth.js';
import { isMongoConnected } from '../db/mongo.js';

const router = express.Router();

// GET /api/stats — Get dashboard summary metrics
router.get('/', requireAuth, (req, res) => {
  const stats = db.getStats(req.user.userId);
  const auditLogs = db.getAuditLogs(15);
  const hasRealR2 = Boolean(config.r2.accountId && config.r2.accessKeyId);
  const mongoConnected = isMongoConnected();
  const hasRealMongo = mongoConnected || Boolean(config.mongoUri);

  res.json({
    stats,
    auditLogs,
    systemInfo: {
      isR2Configured: hasRealR2,
      storageEngine: hasRealR2 ? 'Cloudflare R2 Object Store' : 'Local R2-Emulated Storage (./storage_r2)',
      isMongoConfigured: hasRealMongo,
      database: mongoConnected 
        ? 'MongoDB Atlas / Local Cluster (Connected)' 
        : (hasRealMongo ? 'MongoDB (Connecting/Fallback)' : 'Local JSON Datastore (./data/db.json)'),
      securityEngine: 'Sentinel Heuristic Scanner v2.4 (Active)',
      scannerType: 'Heuristic & EICAR Signature Detection',
      authProvider: 'Session Token / JWT Middleware',
      serverTime: new Date().toISOString()
    }
  });
});

export default router;
