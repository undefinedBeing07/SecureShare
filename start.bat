@echo off
echo ===============================================================
echo  SECURESHARE ENTERPRISE - CLOUD STORAGE PLATFORM
echo  Next.js 14 + Express + MongoDB + Cloudflare R2 + Anti-Malware
echo ===============================================================
echo.

echo Starting Express REST API Server on port 5000...
start "SecureShare Backend (Port 5000)" cmd /k "cd server && npm start"

timeout /t 2 /nobreak >nul

echo Starting Next.js Frontend on port 3000...
start "SecureShare Frontend (Port 3000)" cmd /k "cd client && npm run dev"

echo.
echo ===============================================================
echo  Both services launched!
echo  Frontend UI:  http://localhost:3000
echo  Backend API:  http://localhost:5000/api/health
echo ===============================================================
