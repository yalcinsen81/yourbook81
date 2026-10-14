import { useSyncExternalStore } from "react";
import { localeVersion, subscribe } from ".";

/** Dil ya da tarih biçimi değişince bileşeni yeniden çizer; dönen sayı useMemo bağımlılığı olarak kullanılır. */
export function useLocale(): number {
  return useSyncExternalStore(subscribe, localeVersion, localeVersion);
}
