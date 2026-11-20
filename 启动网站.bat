@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo 正在启动【智忆 · 科学记忆力训练】服务...
echo 本地访问地址: http://localhost:3001
echo 提示: 首次注册的账号将自动成为管理员
echo.
node server/index.js
pause
