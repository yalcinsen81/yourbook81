import { useCallback, useEffect, useRef, useState } from "react";
import { sanitizeProject } from "./model/storage";
import type { Project } from "./model/types";

// Projeyi diskteki bir .json dosyasına bağlar (File System Access API; Chrome / Edge).
// Bağlıyken her değişiklik dosyaya yazılır; dosya dışarıdan (ör. Claude'un MCP sunucusu) değişirse uygulamaya yüklenir.

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

const PICKER_TYPES = [{ description: "Proje dosyası", accept: { "application/json": [".json"] } }];
const POLL_MS = 1500;

export const fileLinkSupported = typeof window !== "undefined" && "showOpenFilePicker" in window;

export function serializeProject(project: Project): string {
  return JSON.stringify(project, null, 2);
}

export function useFileLink(project: Project, replace: (p: Project) => void, notify: (text: string) => void) {
  const [handle, setHandle] = useState<FileHandle | null>(null);
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

  /** Var olan dosyayı aç ve bağla: dosyadaki proje yüklenir. */
  const linkExisting = useCallback(async () => {
    const w = window as PickerWindow;
    try {
      const [h] = await w.showOpenFilePicker!({ types: PICKER_TYPES, multiple: false });
      if (h.requestPermission && (await h.requestPermission({ mode: "readwrite" })) !== "granted") return;
      const file = await h.getFile();
      const text = await file.text();
      const parsed = text.trim() ? sanitizeProject(JSON.parse(text)) : null;
      if (parsed) {
        replace(parsed);
        lastText.current = serializeProject(parsed);
        lastModified.current = file.lastModified;
      } else {
        // Boş dosya: mevcut proje yazılır
        await write(h, serializeProject(project));
      }
      setHandle(h);
      notify(`"${h.name}" dosyasına bağlandı. Değişiklikler otomatik kaydedilir.`);
    } catch (e) {
      if ((e as Error)?.name !== "AbortError") notify("Dosya açılamadı ya da geçerli bir proje dosyası değil.");
    }
  }, [notify, project, replace, write]);

  /** Mevcut projeyi yeni bir dosyaya kaydet ve bağla. */
  const linkNew = useCallback(async () => {
    const w = window as PickerWindow;
    try {
      const h = await w.showSaveFilePicker!({ types: PICKER_TYPES, suggestedName: "proje.json" });
      await write(h, serializeProject(project));
      setHandle(h);
      notify(`"${h.name}" oluşturuldu ve bağlandı.`);
    } catch (e) {
      if ((e as Error)?.name !== "AbortError") notify("Dosya oluşturulamadı.");
    }
  }, [notify, project, write]);

  const unlink = useCallback(() => {
    setHandle(null);
    notify("Dosya bağlantısı kaldırıldı; proje tarayıcıda saklanmaya devam ediyor.");
  }, [notify]);

  // Uygulamadaki değişikliği dosyaya yaz (kısa gecikmeyle)
  useEffect(() => {
    if (!handle) return;
    const text = serializeProject(project);
    if (text === lastText.current) return;
    const t = window.setTimeout(() => {
      write(handle, text).catch(() => notify("Dosyaya yazılamadı; bağlantı kaldırıldı."));
    }, 400);
    return () => window.clearTimeout(t);
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
        const parsed = sanitizeProject(JSON.parse(text));
        if (!parsed) return;
        lastModified.current = file.lastModified;
        lastText.current = serializeProject(parsed);
        replace(parsed);
        notify("Proje dosyası dışarıdan güncellendi, değişiklikler yüklendi.");
      } catch {
        // Yazma sırasında yarım okunan dosya: bir sonraki turda yeniden denenir
      }
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [handle, notify, replace]);

  return { fileName: handle?.name ?? null, linkExisting, linkNew, unlink };
}
