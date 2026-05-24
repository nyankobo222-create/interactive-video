@echo off
set "PATH=C:\nvm4w\nodejs;%PATH%"
cd /d D:\interactive-video
node_modules\.bin\concurrently.cmd "node server.js" "node_modules\.bin\vite.cmd"
pause
