@echo off
set "ROOT=%~dp0"
start "BidderPlatform API" cmd /k "cd /d "%ROOT%backend\api" && npm run start:dev"
start "BidderPlatform Web" cmd /k "cd /d "%ROOT%" && npm run dev"
