import { useCallback, useEffect, useRef, useState } from "react";
import { clearHandle, loadHandle, saveHandle } from "./handleStore";
import { t } from "./i18n";
import { needsUpgradeBackup, sanitizeProject } from "./model/storage";
import { addBackup } from "./settings";
import type { Project } from "./model/types";

// Projeyi diskteki bir .json dosyasına bağlar (File System Access API; Chrome / Edge).
// Bağlıyken her değişiklik dosyaya yazılır; dosya dışarıdan (ör. Claude'un MCP sunucusu) değişirse uygulamaya yüklenir.
// Bağlı dosya hatırlanır: açılışta izin hâlâ varsa kendiliğinden, yoksa tek tıkla ("yeniden bağlan") aynı dosyaya dönülür.

interface FileHandle {
  name: string;
  getFile(): Promise<File>;
  createWritable(): Promise<{ write(data: string): Promise<void>; close(): Promise<void> }>;
  queryPermission?(opts: { mode: "readwrite" }): Promise<PermissionState>;
  requestPermission?(opts: { mode: "readwrite" }): Promise<PermissionState>;
}

type PickerWindow = Window & {
  showOpenFilePicker?: (opts: object) => Promise<FileHandle[]>;
  showSaveFilePicker?: (opts: object) => Promise<FileHandle>;
};

const pickerTypes = () => [{ description: t("link.pickerType"), accept: { "application/json": [".json"] } }];
const POLL_MS = 1500;

export const fileLinkSupported = typeof window !== "undefined" && "showOpenFilePicker" in window;

export function serializeProject(project: Project): string {
  return JSON.stringify(project, null, 2);
}

export function useFileLink(
  project: Project,
  replace: (p: Project) => void,
  notify: (text: string) => void,
  /** Dosya okunamadı (bozuk JSON / proje değil): kurtarma önerilir */
  onInvalid?: (name: string, detail: string) => void,
) {
  const [handle, setHandle] = useState<FileHandle | null>(null);
  /** Önceki oturumdan hatırlanan, izni yenilenmeyi bekleyen dosya */
  const [pending, setPending] = useState<FileHandle | null>(null);
  const lastText = useRef<string>("");
  const lastModified = useRef(0);
  const writing = useRef(false);

  const write = useCallback(async (h: FileHandle, text: string) => {
    writing.current = true;
    try {
      const w = await h.createWritable();
      await w.write(text);
      await w.close();
      lastText.current = text;
      lastModified.current = (await h.getFile()).lastModified;
    } finally {
      writing.current = false;
    }
  }, []);

  /** Dosyayı bağla: dosyadaki proje yüklenir (dosya boşsa mevcut proje yazılır). */
  const attach = useCallback(
    async (h: FileHandle) => {
      const file = await h.getFile();
      const text = await file.text();
      const raw = text.trim() ? JSON.parse(text) : null;
      const parsed = raw ? sanitizeProject(raw) : null;
      if (text.trim() && !parsed) throw new Error("invalid");
      if (parsed && needsUpgradeBackup(raw)) {
        // Eski biçimli dosya yeni biçimle üzerine yazılmadan önce özgün metin saklanır (Ayarlar > Yedeği indir)
        addBackup(h.name, text);
        notify(t("link.upgraded", { name: h.name }));
      }
      if (parsed) {
        replace(parsed);
        lastText.current = serializeProject(parsed);
        lastModified.current = file.lastModified;
      } else {
        await write(h, serializeProject(project));
      }
      setHandle(h);
      setPending(null);
      void saveHandle(h);
    },
    [project, replace, write],
  );

  /** Var olan dosyayı aç ve bağla: dosyadaki proje yüklenir. */
  const linkExisting = useCallback(async () => {
    const w = window as PickerWindow;
    let h: FileHandle | undefined;
    try {
      [h] = await w.showOpenFilePicker!({ types: pickerTypes(), multiple: false });
      if (h.requestPermission && (await h.requestPermission({ mode: "readwrite" })) !== "granted") return;
      await attach(h);
      notify(t("link.linked", { name: h.name }));
    } catch (e) {
      if ((e as Error)?.name === "AbortError") return;
      if (h && onInvalid && (e instanceof SyntaxError || (e as Error)?.message === "invalid")) onInvalid(h.name, e instanceof SyntaxError ? e.message : "");
      else notify(t("link.openFailed"));
    }
  }, [attach, notify, onInvalid]);

  /** Son dosyalardan: hatırlanan tutamacı izin isteyip bağla (bağlı dosya değişir) */
  const openHandle = useCallback(
    async (raw: unknown): Promise<boolean> => {
      const h = raw as FileHandle;
      try {
        if (h.requestPermission && (await h.requestPermission({ mode: "readwrite" })) !== "granted") return false;
        await attach(h);
        notify(t("link.linked", { name: h.name }));
        return true;
      } catch (e) {
        if (onInvalid && (e instanceof SyntaxError || (e as Error)?.message === "invalid")) {
          onInvalid(h.name, e instanceof SyntaxError ? e.message : "");
          return true;
        }
        return false;
      }
    },
    [attach, notify, onInvalid],
  );

  /** Hatırlanan dosyaya yeniden bağlan (izin istemi kullanıcı tıklamasıyla açılmalı). */
  const reconnect = useCallback(async () => {
    if (!pending) return;
    try {
      if (pending.requestPermission && (await pending.requestPermission({ mode: "readwrite" })) !== "granted") return;
      await attach(pending);
      notify(t("link.reconnected", { name: pending.name }));
    } catch {
      setPending(null);
      void clearHandle();
      notify(t("link.missing", { name: pending.name }));
    }
  }, [attach, notify, pending]);

  // Açılışta hatırlanan dosya: izin sürüyorsa hemen bağlan, yoksa "yeniden bağlan" düğmesi gösterilir
  const restored = useRef(false);
  useEffect(() => {
    if (restored.current || !fileLinkSupported) return;
    restored.current = true;
    void (async () => {
      const h = await loadHandle<FileHandle>();
      if (!h) return;
      const state = h.queryPermission ? await h.queryPermission({ mode: "readwrite" }).catch(() => "prompt" as const) : "prompt";
      if (state === "granted") {
        try {
          await attach(h);
          notify(t("link.restored", { name: h.name }));
          return;
        } catch {
          // dosya yok: aşağıda yeniden bağlan önerilir
        }
      }
      setPending(h);
    })();
    // Yalnızca ilk açılışta
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Mevcut projeyi yeni bir dosyaya kaydet ve bağla. */
  const linkNew = useCallback(async () => {
    const w = window as PickerWindow;
    try {
      const h = await w.showSaveFilePicker!({ types: pickerTypes(), suggestedName: `${t("default.fileName")}.json` });
      await write(h, serializeProject(project));
      setHandle(h);
      setPending(null);
      void saveHandle(h);
      notify(t("link.created", { name: h.name }));
    } catch (e) {
      if ((e as Error)?.name !== "AbortError") notify(t("link.createFailed"));
    }
  }, [notify, project, write]);

  const unlink = useCallback(() => {
    setHandle(null);
    setPending(null);
    void clearHandle();
    notify(t("link.unlinked"));
  }, [notify]);

  // Uygulamadaki değişikliği dosyaya yaz (kısa gecikmeyle)
  useEffect(() => {
    if (!handle) return;
    const text = serializeProject(project);
    if (text === lastText.current) return;
    const timer = window.setTimeout(() => {
      write(handle, text).catch(() => {
        // İzin geri alındı ya da dosya kayboldu: bağlantı askıya alınır, tek tıkla yeniden bağlanılır
        setHandle(null);
        setPending(handle);
        notify(t("link.writeFailed", { name: handle.name }));
      });
    }, 400);
    return () => window.clearTimeout(timer);
  }, [handle, notify, project, write]);

  // Dosya dışarıdan değişti mi? (Claude / MCP ya da başka bir düzenleyici)
  useEffect(() => {
    if (!handle) return;
    const timer = window.setInterval(async () => {
      if (writing.current) return;
      try {
        const file = await handle.getFile();
        if (file.lastModified <= lastModified.current) return;
        const text = await file.text();
        if (text === lastText.current) {
          lastModified.current = file.lastModified;
          return;
        }
        const raw = JSON.parse(text);
        const parsed = sanitizeProject(raw);
        if (!parsed) return;
        if (needsUpgradeBackup(raw)) addBackup(handle.name, text);
        lastModified.current = file.lastModified;
        lastText.current = serializeProject(parsed);
        replace(parsed);
        notify(t("link.externalUpdate"));
      } catch {
        // Yazma sırasında yarım okunan dosya: bir sonraki turda yeniden denenir
      }
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [handle, notify, replace]);

  return { handle: handle as unknown, fileName: handle?.name ?? null, pendingName: pending?.name ?? null, linkExisting, linkNew, unlink, reconnect, openHandle };
}
