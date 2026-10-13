@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul || (echo Node.js yuklu degil. https://nodejs.org adresinden LTS surumunu kurup tekrar deneyin. & pause & exit /b 1)
if not exist node_modules (
  echo Ilk calistirma: gerekli paketler yukleniyor, birkac dakika surebilir...
  call npm install || (pause & exit /b 1)
)
echo Proje Planlayici aciliyor: http://localhost:5173
echo Kapatmak icin bu pencereyi kapatin.
call npx vite --open
pause
