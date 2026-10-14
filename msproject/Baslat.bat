@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul || (echo Node.js yuklu degil. https://nodejs.org adresinden LTS surumunu kurup tekrar deneyin. & pause & exit /b 1)
if not exist node_modules (
  echo Ilk calistirma: gerekli paketler yukleniyor, birkac dakika surebilir...
  call npm install || (pause & exit /b 1)
)
echo Proje Planlayici hazirlaniyor: http://localhost:5173
echo Tarayicida adres cubugundaki "Yukle" simgesiyle ya da uygulamadaki "Uygulamayi yukle" dugmesiyle bilgisayara kurabilirsiniz.
echo Kurduktan sonra bu pencereyi kapatabilirsiniz; uygulama internetsiz ve bu pencere olmadan da acilir.
call npm start
pause
