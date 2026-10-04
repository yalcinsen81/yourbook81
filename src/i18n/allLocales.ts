// Yalnızca testler için: tüm sözlükleri senkron yükler ve kaydeder.
import tr from "./locales/tr";
import en from "./locales/en";
import de from "./locales/de";
import es from "./locales/es";
import pt from "./locales/pt";
import ar from "./locales/ar";
import ru from "./locales/ru";
import fr from "./locales/fr";
import nl from "./locales/nl";
import it from "./locales/it";
import { registerDictionary } from "./index";

const all = { tr, en, de, es, pt, ar, ru, fr, nl, it };
for (const [code, dict] of Object.entries(all)) registerDictionary(code, dict);

export { tr, en, de, es, pt, ar, ru, fr, nl, it };
