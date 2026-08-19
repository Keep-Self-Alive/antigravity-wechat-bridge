@echo off
chcp 65001 >nul
title Antigravity WeChat Bridge V1.0
cd /d "%~dp0"
echo ========================================================
echo   Antigravity WeChat Bridge V1.0 - 生产环境启动
echo ========================================================
npm run wechat:live
pause
