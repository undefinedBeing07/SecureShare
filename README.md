# SecureShare Enterprise

> **High-Performance, Secure and Reliable Cloud File Platform**  
> *End-to-End Encrypted Storage • Real-Time Sentinel Anti-Malware Engine • Cloudflare R2 Global Delivery*

---

## 📌 Architecture & Security Overview

SecureShare Enterprise is designed for zero-trust cloud file storage, granular link sharing, and multi-stage malware scanning.

### Core Capabilities
1. **Real-Time 5-Stage Upload Pipeline**: 
   - `01 Preparing` — Client-side header and file validation
   - `02 Uploading` — Secure streamed buffer transfer to Express API
   - `03 Scanning` — Sentinel Anti-Malware signature and heuristic analysis
   - `04 Storing` — Encrypted object commitment to Cloudflare R2 & indexing in MongoDB
   - `05 Completed` — Verified asset ready for instant retrieval or sharing
2. **Sentinel Anti-Malware Security Engine**: Multi-heuristic scanning, EICAR signature detection, dangerous double-extension masquerade interception, and cryptographic SHA-256 fingerprint generation. Unsafe files are immediately blocked and quarantined.
3. **Granular Access Control**: Unique tokenized links with configurable permissions (`Allow Download` vs `View Only`), custom expiration countdowns (1h, 24h, 7d, never), and optional passcode protection.
4. **Scalable Cloud Architecture**: Next.js 14 App Router + Express REST Core + MongoDB Document Engine + Cloudflare R2 Object Storage.

---

## 🏛️ System Architecture

```
+-------------------------------------------------------------+
|                      User Browser                           |
+-------------------------------------------------------------+
                              |
                              v
+-------------------------------------------------------------+
|               Frontend Layer (Next.js 14 + TS)              |
|        - Modern Blackish Theme (Tailwind CSS)               |
|        - Real-Time 5-Stage Live Progress UI                 |
|        - Granular Share Link Generator & Recipient Portal   |
+-------------------------------------------------------------+
                              |
                              v (REST API Proxy)
+-------------------------------------------------------------+
|                Backend Layer (Node.js + Express)            |
|        - Authentication & Session Validation                |
|        - Multer Upload Staging Buffer                       |
|        - REST Endpoints (/api/files, /api/share, /api/stats)|
+-------------------------------------------------------------+
              |                                 |
              v                                 v
+-------------------------------+ +---------------------------+
|        Security Layer         | |        Data Layer         |
| - Sentinel Virus Scan API     | | - Cloudflare R2 Storage   |
| - EICAR Signature Detection   | | - MongoDB Document Engine |
| - Heuristic Script Analysis   | | - Access Token Registry   |
| - SHA-256 Hash Calculation    | | - Real-time Audit Logs    |
+-------------------------------+ +---------------------------+
```

---

## 🚀 Quick Start Guide

### 1. Prerequisites
- Node.js (v18 or higher)
- npm

### 2. Launching Both Services (Single Command)
On Windows, run the included launcher:
```powershell
.\start.bat
# or
.\start.ps1
```

Or run each service manually in separate terminals:

**Terminal 1 (Backend - Express Core API):**
```bash
cd server
npm start
# Express runs on http://localhost:5000
```

**Terminal 2 (Frontend - Next.js UI):**
```bash
cd client
npm run dev
# Next.js runs on http://localhost:3000
```

### 3. Open in Browser
Visit **[http://localhost:3000](http://localhost:3000)**

---

## 🧪 Demonstration & Testing Features

### 1. Test Real-time 5-Stage Upload (Safe File)
Click **"Upload Safe Sample"** on the dashboard:
- Observe the 5 distinct progress stages:
  1. `01 Preparing` — Validating file headers and size
  2. `02 Uploading` — Streaming payload to Express backend
  3. `03 Scanning` — Sentinel Malware Scanner executing signature & SHA-256 analysis
  4. `04 Storing` — Persisting object to Cloudflare R2 and indexing in MongoDB
  5. `05 Completed` — File instantly available with active share controls

### 2. Test Malware Interception (EICAR Industry Standard Test)
Click **"Test Malware Scan"** on the dashboard:
- The system uploads a payload containing the standard EICAR test signature (`X5O!P%@AP[4\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+TH$`).
- The Sentinel Security Layer immediately intercepts the threat `Virus:DOS/EICAR_Test_File.A`.
- The upload is **rejected and quarantined**. Storage in Cloudflare R2 is prevented.
- A high-visibility security alert modal displays the threat signature, SHA-256 checksum, and audit event.

### 3. Test Granular Share Links & Recipient View
1. Click the **Share** (🔗) icon on any file.
2. Configure permissions:
   - Choose `Allow Download` or `View Only`
   - Select expiration duration (`1 Hour`, `24 Hours`, `7 Days`, or `Never`)
   - Optional: set an access passcode
3. Click **"Generate Unique Share Link"**.
4. Click **"Open Recipient Page"** to test what recipients see.
5. Notice the clean recipient view, verification badge, inline preview, and expiration timer.

### 4. Inspect Live Audit Logs
Click **"Audit Trail"** in the top navbar or **"Live Security Telemetry"** to view real-time upload and quarantine records.

---

## ⚙️ Environment Configuration (`server/.env`)

```env
PORT=5000
JWT_SECRET=secureshare-enterprise-jwt-secret-2026
STORAGE_DIR=./storage_r2

# Optional Cloudflare R2 (If blank, uses built-in local R2 emulator)
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=secure-files

# Optional MongoDB (If blank, uses zero-crash JSON datastore in ./data/db.json)
MONGODB_URI=
```
