import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { UserModel, FileModel, ShareModel, AuditLogModel } from './mongo.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

const dbFilePath = path.join(__dirname, '..', '..', 'data', 'db.json');

async function runSync() {
  const uri = process.argv[2] || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/secureshare';
  console.log('\n=======================================================');
  console.log(' SecureShare — MongoDB Migration & Sync Engine');
  console.log('=======================================================');
  console.log(`Connecting to: ${uri.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@')}`);

  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 6000 });
    console.log(' Connected to MongoDB successfully!\n');

    if (!fs.existsSync(dbFilePath)) {
      console.error(` Error: Data file not found at ${dbFilePath}`);
      process.exit(1);
    }

    const raw = fs.readFileSync(dbFilePath, 'utf-8');
    const localData = JSON.parse(raw);

    // 1. Users
    const users = localData.users || [];
    console.log(`Syncing ${users.length} Users...`);
    for (const u of users) {
      await UserModel.findOneAndUpdate({ userId: u.userId }, { ...u }, { upsert: true, returnDocument: 'after' });
    }
    const userCount = await UserModel.countDocuments();
    console.log(`✔ Users in MongoDB: ${userCount}`);

    // 2. Files
    const files = localData.files || [];
    console.log(`Syncing ${files.length} Files...`);
    for (const f of files) {
      await FileModel.findOneAndUpdate({ fileId: f.fileId }, { ...f }, { upsert: true, returnDocument: 'after' });
    }
    const fileCount = await FileModel.countDocuments();
    console.log(`✔ Files in MongoDB: ${fileCount}`);

    // 3. Shares
    const shares = localData.shares || [];
    console.log(`Syncing ${shares.length} Shares...`);
    for (const s of shares) {
      await ShareModel.findOneAndUpdate({ shareId: s.shareId }, { ...s }, { upsert: true, returnDocument: 'after' });
    }
    const shareCount = await ShareModel.countDocuments();
    console.log(`✔ Shares in MongoDB: ${shareCount}`);

    // 4. Audit Logs
    const auditLogs = localData.auditLogs || [];
    console.log(`Syncing ${auditLogs.length} Audit Logs...`);
    for (const a of auditLogs) {
      await AuditLogModel.findOneAndUpdate(
        { logId: a.id || a.logId },
        { 
          logId: a.id || a.logId,
          action: a.action,
          fileId: a.fileId,
          fileName: a.fileName,
          ownerId: a.ownerId,
          status: a.status,
          details: a.details || a,
          timestamp: a.timestamp || new Date()
        },
        { upsert: true, returnDocument: 'after' }
      );
    }
    const auditCount = await AuditLogModel.countDocuments();
    console.log(`✔ Audit Logs in MongoDB: ${auditCount}`);

    console.log('\n=======================================================');
    console.log(' All collections verified and synced to MongoDB!');
    console.log(' You can now open MongoDB Compass or Mongo Shell to view.');
    console.log('=======================================================\n');

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('\n MongoDB Connection/Sync Failed:');
    console.error(err.message);
    console.log('\nTip: To connect to MongoDB Atlas, add your connection URI to server/.env:');
    console.log('MONGODB_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/secureshare?retryWrites=true&w=majority\n');
    process.exit(1);
  }
}

runSync();
