Write-Host "===============================================================" -ForegroundColor Cyan
Write-Host " SECURESHARE ENTERPRISE - CLOUD STORAGE PLATFORM" -ForegroundColor Green
Write-Host " Next.js 14 + Express + MongoDB + Cloudflare R2 + Sentinel Anti-Malware" -ForegroundColor Yellow
Write-Host "===============================================================" -ForegroundColor Cyan

$serverJob = Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\server'; npm start" -PassThru
Start-Sleep -Seconds 2

$clientJob = Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\client'; npm run dev" -PassThru

Write-Host "`nBoth services launched!" -ForegroundColor Green
Write-Host " Frontend UI:  http://localhost:3000" -ForegroundColor Cyan
Write-Host " Backend API:  http://localhost:5000/api/health" -ForegroundColor Cyan
Write-Host "===============================================================" -ForegroundColor Cyan
