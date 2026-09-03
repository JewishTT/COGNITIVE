@echo off
title COGNITIVE Platform - All Services
echo.
echo  ============================================
echo   COGNITIVE Platform - Full Stack Launcher
echo  ============================================
echo.
echo  Starting all services...
echo   - Globe (Cesium 3D)     :4173
echo   - Platform (Vue)        :5180
echo   - Pipeline Server       :5181
echo   - Factory (Postiz)      :4007
echo.
echo  Press Ctrl+C to stop all.
echo.

cd /d "%~dp0"
node scripts\dev-all.mjs
