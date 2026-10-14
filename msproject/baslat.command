#!/bin/sh
# macOS / Linux: çift tıkla ya da terminalde ./baslat.command
cd "$(dirname "$0")" || exit 1
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js yüklü değil. https://nodejs.org adresinden LTS sürümünü kurup tekrar deneyin."
  exit 1
fi
[ -d node_modules ] || npm install || exit 1
echo "Proje Planlayıcı açılıyor: http://localhost:5173"
echo "Chrome/Edge'de 'Uygulamayı yükle' ile kurduktan sonra bu pencereyi kapatabilirsiniz (Ctrl+C)."
exec npm start
