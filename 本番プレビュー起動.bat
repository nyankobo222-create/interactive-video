@echo off
cd /d D:\interactive-video

echo ========================================
echo  インタラクティブ動画システム 本番起動
echo ========================================
echo.
echo ビルド中... しばらくお待ちください
echo.

:: ビルド実行
call npm run build
if %errorlevel% neq 0 (
  echo.
  echo [エラー] ビルドに失敗しました。
  pause
  exit /b 1
)

echo.
echo ビルド完了！サーバーを起動します...
echo.

:: サーバー起動（バックグラウンドで）
start "サーバー (port 3000)" cmd /k "cd /d D:\interactive-video && node server.js"

:: 2秒待ってからブラウザを開く
timeout /t 2 /nobreak > nul
start http://localhost:3000

echo.
echo ブラウザが開きます: http://localhost:3000
echo.
echo 終了するときはサーバーのウィンドウを閉じてください。
pause
