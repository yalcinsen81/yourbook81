import type { NavView } from "../components/SuperrSidebar";

const VIEWS: readonly NavView[] = ["hero", "cards", "notes", "daily", "journal", "collections", "work", "calendar", "youtube"];

/** `?view=notes` gibi bir adresten başlangıç görünümünü okur; geçersizse null. */
export function viewFromSearch(search: string): NavView | null {
  try {
    const v = new URLSearchParams(search).get("view");
    return v && (VIEWS as readonly string[]).includes(v) ? (v as NavView) : null;
  } catch {
    return null;
  }
}
