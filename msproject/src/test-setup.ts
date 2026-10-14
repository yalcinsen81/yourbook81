import { beforeEach } from "vitest";
import { setCurrency, setLocale } from "./i18n";

beforeEach(() => {
  setLocale({ lang: "tr", dateStyle: "locale" });
  setCurrency("TRY");
});
