import { useState, useEffect } from "react";
import { useT } from "../i18n/I18nProvider";
import { motion, AnimatePresence } from "framer-motion";
import { DCheck as Check, DDownload as Download, DRefresh as RotateCcw, DUser as User, DX as X } from "./icons/doodle";
import {
  type AppUser,
  loginUser,
  registerUser,
  logoutUser,
  isCloudConfigured,
  requestPasswordReset,
} from "../lib/supabase";
import { performCloudSync, getLastSyncedTime } from "../lib/syncEngine";
import { playPopSound, playSuccessSound } from "../lib/sound";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** v-migrate: ilk aktarim onayi (App'ten gelir) */
  migrationNotice?: { keyCount: number; bytes: number } | null;
  onMigrationSeen?: () => void;
  currentUser: AppUser | null;
  onUserChange: (user: AppUser | null) => void;
  onOpenInstall?: () => void;
}

export function AuthModal({
  isOpen,
  onClose,
  migrationNotice,
  onMigrationSeen,
  currentUser,
  onUserChange,
  onOpenInstall,
}: AuthModalProps) {
  const LOCALE = { tr: "tr-TR", en: "en-GB", de: "de-DE", es: "es-ES", pt: "pt-PT", ar: "ar-SA", ru: "ru-RU", fr: "fr-FR" } as Record<string, string>;
  const { t, lang } = useT();
  const [tab, setTab] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  // v-auth2: sifre sifirlama
  const [forgotMode, setForgotMode] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsLoading(true);

    const { user, error } = await loginUser(email, password);
    setIsLoading(false);

    if (error) {
      setErrorMsg(error);
    } else if (user) {
      playSuccessSound();
      onUserChange(user);
      // v-migrate: ilk aktarimda yerel veri buluta tasinir -> kullaniciya bildir
      const syncRes = await performCloudSync(user);
      // v-migrate: ONAY MESAJI varsa modal ACIK kalsin (kullanici gorsun);
      // yoksa normal davranis: hemen kapat.
        if (!syncRes?.migrated?.happened) {
        // v-migrate: onay varsa modal ACIK kalsin (kullanici mesaji gorsun)
        if (!migrationNotice) onClose();
      }
      return;
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsLoading(true);

    const { user, error } = await registerUser(email, password, displayName);
    setIsLoading(false);

    if (error) {
      setErrorMsg(error);
    } else if (user) {
      playSuccessSound();
      onUserChange(user);
      // v-migrate: ILK AKTARIM BURADA OLUR (yeni hesap + yerel veri).
      const regSync = await performCloudSync(user);
      // v-migrate: ONAY MESAJI varsa modal ACIK kalsin (kullanici gorsun);
      // yoksa normal davranis: hemen kapat.
        if (!regSync?.migrated?.happened) {
        // v-migrate: onay varsa modal ACIK kalsin (kullanici mesaji gorsun)
        if (!migrationNotice) onClose();
      }
      return;
    }
  };

  // v-auth2: sifre sifirlama e-postasi gonderir.
  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!email.trim()) { setErrorMsg(t("auth.reset_need_email")); return; }
    setIsLoading(true);
    const res = await requestPasswordReset(email.trim());
    setIsLoading(false);
    if (res.ok) {
      playSuccessSound();
      setResetSent(true);
    } else {
      playPopSound();
      setErrorMsg(t("auth.reset_failed"));
    }
  };

  const handleLogout = async () => {
    playPopSound();
    await logoutUser();
    onUserChange(null);
    // v-migrate: onay varsa modal acik kalsin
    onClose();
  };

  const handleSyncNow = async () => {
    playPopSound();
    setSyncStatus(t("auth.sync_in_progress"));
    const res = await performCloudSync(currentUser);
    if (res.success) {
      playSuccessSound();
      setSyncStatus(t("auth.synced"));
      setTimeout(() => setSyncStatus(null), 2500);
    } else {
      setSyncStatus(t("auth.sync_waiting"));
    }
  };

  const lastSyncTime = getLastSyncedTime();

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          data-qa-modal="auth"
            data-lovable-target="auth-modal"
            data-lovable-name="Modal: Giriş / Kaydol"
            data-lovable-file="src/components/AuthModal.tsx"
            data-lovable-desc="Kimlik doğrulama modalı (e-posta girişi, şifre, kaydol)"
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[950] flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs select-none"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 10 }}
            transition={{ type: "spring", stiffness: 400, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-[var(--paper)] border-2 border-[var(--ink)] rounded-[16px] shadow-superrCard overflow-hidden relative"
          >
            {/* Üst Kütüphane / Defter Kimlik Kartı Bandı */}
            {/* v-migrate: veriler buluta tasindi onayi (profil gorunumunde) */}
            {migrationNotice && (
              <div className="mb-3 rounded-[8px] border-[1.5px] border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] p-3">
                <p className="font-handwritten text-[13px] text-[var(--accent)]">
                  {t("auth.migrated_title")}
                </p>
                <p className="mt-1 font-geist text-[10px] text-[var(--ink-soft)]">
                  {t("auth.migrated_detail").replace("{n}", String(migrationNotice.keyCount)).replace("{kb}", String(Math.max(1, Math.round(migrationNotice.bytes / 1024))))}
                </p>
                <button type="button" onClick={() => onMigrationSeen?.()} className="mt-2 font-gelica text-[10px] text-[var(--accent)] hover:underline">
                  {t("auth.migrated_ok")}
                </button>
              </div>
            )}
            <div className="bg-[var(--ink)] text-[var(--app-bg)] px-6 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs tracking-wider uppercase opacity-80">
                  {currentUser ? t("auth.identity_card") : t("auth.user_login")}
                </span>
              </div>
              <button
                onClick={onClose}
                className="text-[var(--app-bg)] opacity-80 hover:opacity-100 p-0.5 rounded-full"
              >
                <X size={15} />
              </button>
            </div>

            {currentUser ? (
              /* ⭐ 1. GİRİŞ YAPILMIŞ PROFİL VE BULUT KARTI */
              <div className="p-6 space-y-4">
                <div className="flex items-center gap-4 pb-4 border-b-2 border-dashed border-[color-mix(in_srgb,var(--border-ink)_25%,transparent)]">
                  {/* Fotoğraf / Baş Harf Damgası */}
                  <div className="w-14 h-14 rounded-xl border-2 border-[var(--ink)] bg-[var(--accent)] text-white flex items-center justify-center font-gelica text-2xl font-bold shadow-sm">
                    {currentUser.avatarLetter}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="font-handwritten text-xs text-[var(--accent)] font-bold">
                      {t("auth.member_no")} #{currentUser.id.slice(0, 8)}
                    </span>
                    <h3 className="font-gelica text-xl font-bold text-[var(--ink)] truncate">
                      {currentUser.displayName}
                    </h3>
                    <span className="font-geist text-xs text-[var(--ink-soft)] truncate">
                      {currentUser.email}
                    </span>
                  </div>
                </div>

                {/* Bulut ve Senkronizasyon Durumu */}
                <div className="bg-[var(--app-bg)] p-3.5 rounded-[12px] border border-[var(--ink)] space-y-2">
                  <div className="flex items-center justify-between text-xs font-gelica">
                    <span className="font-semibold text-[var(--ink)]">{t("auth.sync_title")}</span>
                    <span className="font-mono text-[11px] text-[var(--accent)] font-bold">
                      {currentUser.isCloud ? t("auth.cloud_on") : t("auth.local_on")}
                    </span>
                  </div>
                  <p className="font-geist text-[11px] text-[var(--ink-soft)] leading-relaxed">
                    {t("auth.sync_desc")}
                  </p>
                  {lastSyncTime && (
                    <span className="font-mono text-[10px] text-[var(--ink-soft)] block pt-1">
                      {t("auth.last_sync")} {new Date(lastSyncTime).toLocaleTimeString(LOCALE[lang] || "tr-TR")}
                    </span>
                  )}
                </div>

                {syncStatus && (
                  <p className="text-center font-handwritten text-sm text-[var(--accent)] font-bold">
                    {syncStatus}
                  </p>
                )}

                {onOpenInstall && (
                  <button
                    type="button"
                    onClick={() => {
                      playPopSound();
                      onClose();
                      onOpenInstall();
                    }}
                    className="w-full btn-pill-superr text-xs !py-2 justify-center gap-2 border-[1.5px] border-[var(--ink)] shadow-xs"
                  >
                    <Download size={13} />
                    <span>{t("auth.install_pwa")}</span>
                  </button>
                )}

                {/* Aksiyon Butonları */}
                <div className="flex items-center justify-between pt-2">
                  <button
                    onClick={handleSyncNow}
                    className="btn-pill-superr text-xs !py-1.5 !px-3.5"
                  >
                    <RotateCcw size={12} />
                    <span>{t("auth.sync_now")}</span>
                  </button>

                  <button
                    onClick={handleLogout}
                    className="text-xs font-gelica text-red-600 hover:underline px-3 py-1.5"
                  >
                    {t("auth.sign_out")}
                  </button>
                </div>
              </div>
            ) : (
              /* ⭐ 2. GİRİŞ YAP / KAYIT OL FORMU */
              <div className="p-6 space-y-4">
                {/* Giriş & Kayıt Ol Sekmeleri */}
                <div className="flex border-b border-[color-mix(in_srgb,var(--border-ink)_20%,transparent)] gap-4 pb-2">
                  <button
                    type="button"
                    onClick={() => {
                      playPopSound();
                      setTab("login");
                      setErrorMsg(null);
                    }}
                    className={`font-gelica text-sm font-semibold pb-1 border-b-2 transition-all ${
                      tab === "login"
                        ? "border-[var(--accent)] text-[var(--accent)]"
                        : "border-transparent text-[var(--ink-soft)] hover:text-[var(--ink)]"
                    }`}
                  >
                    {t("auth.sign_in")}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      playPopSound();
                      setTab("register");
                      setErrorMsg(null);
                    }}
                    className={`font-gelica text-sm font-semibold pb-1 border-b-2 transition-all ${
                      tab === "register"
                        ? "border-[var(--accent)] text-[var(--accent)]"
                        : "border-transparent text-[var(--ink-soft)] hover:text-[var(--ink)]"
                    }`}
                  >
                    {t("auth.register_tab")}
                  </button>
                </div>

                {!isCloudConfigured && (
                  <p
                    role="note"
                    data-testid="auth-local-notice"
                    className="mb-3 rounded-[8px] border-[1.5px] border-dashed border-[var(--ink)] bg-[var(--app-bg)] p-2.5 font-geist text-[11px] leading-snug text-[var(--ink-soft)]"
                  >
                    {t("auth.local_notice")}
                  </p>
                )}
                <form
                  onSubmit={forgotMode ? handleForgotPassword : tab === "login" ? handleLogin : handleRegister}
                  className="space-y-3"
                >
                  {!forgotMode && tab === "register" && (
                    <div>
                      <label className="font-gelica text-xs text-[var(--ink-soft)] block mb-1">
                        {t("auth.name")}
                      </label>
                      <input
                        type="text"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder={t("auth.name_ph")}
                        className="w-full rounded-[8px] border-[1.5px] border-[var(--ink)] bg-[var(--app-bg)] px-3 py-2 font-geist text-xs text-[var(--ink)] outline-none focus:border-[var(--accent)]"
                      />
                    </div>
                  )}

                  <div>
                    <label className="font-gelica text-xs text-[var(--ink-soft)] block mb-1">
                      {t("auth.email_label")}
                    </label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder={t("auth.email_ph")}
                      className="w-full rounded-[8px] border-[1.5px] border-[var(--ink)] bg-[var(--app-bg)] px-3 py-2 font-geist text-xs text-[var(--ink)] outline-none focus:border-[var(--accent)]"
                    />
                  </div>

                  {!forgotMode && <div>
                    <label className="font-gelica text-xs text-[var(--ink-soft)] block mb-1">
                      {t("auth.password")}
                    </label>
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full rounded-[8px] border-[1.5px] border-[var(--ink)] bg-[var(--app-bg)] px-3 py-2 font-geist text-xs text-[var(--ink)] outline-none focus:border-[var(--accent)]"
                    />
                  </div>}

                  {/* v-migrate: veriler buluta tasindi onayi */}
                  {migrationNotice && (
                    <div className="rounded-[8px] border-[1.5px] border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] p-3">
                      <p className="font-handwritten text-[13px] text-[var(--accent)]">
                        {t("auth.migrated_title")}
                      </p>
                      <p className="mt-1 font-geist text-[10px] text-[var(--ink-soft)]">
                        {t("auth.migrated_detail")
                          .replace("{n}", String(migrationNotice.keyCount))
                          .replace("{kb}", String(Math.max(1, Math.round(migrationNotice.bytes / 1024))))}
                      </p>
                      <button
                        type="button"
                        onClick={() => onMigrationSeen?.()}
                        className="mt-2 font-gelica text-[10px] text-[var(--accent)] hover:underline"
                      >
                        {t("auth.migrated_ok")}
                      </button>
                    </div>
                  )}

                  {/* v-auth2: sifirlama e-postasi gonderildi */}
                  {resetSent && (
                    <p className="font-geist text-xs text-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] p-2 rounded-[6px]">
                      {t("auth.reset_sent")}
                    </p>
                  )}

                  {errorMsg && (
                    <p className="font-geist text-xs text-red-600 bg-red-50 p-2 rounded-[6px] border border-red-200">
                      {errorMsg}
                    </p>
                  )}

                  <div className="pt-2 flex items-center justify-between">
                    {/* v-auth2: sifre sifirlama */}
                    {!forgotMode && tab === "login" && (
                      <button
                        type="button"
                        data-forgot-password="1"
                        onClick={() => { setForgotMode(true); setErrorMsg(null); setResetSent(false); }}
                        className="font-gelica text-xs text-[var(--accent)] hover:underline"
                      >
                        {t("auth.forgot")}
                      </button>
                    )}
                    {forgotMode && (
                      <button
                        type="button"
                        onClick={() => { setForgotMode(false); setErrorMsg(null); setResetSent(false); }}
                        className="font-gelica text-xs text-[var(--ink-soft)] hover:text-[var(--ink)]"
                      >
                        {t("auth.back_to_login")}
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={onClose}
                      className="font-gelica text-xs text-[var(--ink-soft)] hover:text-[var(--ink)]"
                    >
                      {t("auth.guest")}
                    </button>

                    <button
                      type="submit"
                      disabled={isLoading}
                      className="btn-pill-orange text-xs !py-1.5 !px-5"
                    >
                      <Check size={13} strokeWidth={2.5} />
                      <span>{isLoading ? t("auth.syncing") : tab === "login" ? t("auth.sign_in") : t("auth.create")}</span>
                    </button>
                  </div>
                </form>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
