/**
 * Web Audio API ile sıfır gecikmeli, harici ses dosyası indirmeden
 * taktil ve zarif mikro-etkileşim sesleri.
 */
let isMuted = false;
try {
  isMuted = localStorage.getItem("lexi_sound_muted") === "true";
} catch { }

export type SoundProfileType = "fountain" | "pencil" | "ballpoint" | "typewriter";

export const SOUND_PROFILES: {
  id: SoundProfileType;
  name: string;
  nameKey: string;
  emoji: string;
  description: string;
  descKey: string;
  subtext: string;
  subKey: string;
}[] = [
  {
    id: "fountain",
    nameKey: "sound.fountain.name",
    descKey: "sound.fountain.desc",
    subKey: "sound.fountain.sub",
    name: "Dolmakalem",
    emoji: "",
    description: "Islak mürekkep & metalik uç kayması",
    subtext: "Zarif, pürüzsüz ve akıcı sıvı mürekkep sürtünmesi",
  },
  {
    id: "pencil",
    nameKey: "sound.pencil.name",
    descKey: "sound.pencil.desc",
    subKey: "sound.pencil.sub",
    name: "Kurşun Kalem",
    emoji: "",
    description: "Grafit & pürüzlü kağıt dokusu",
    subtext: "Doğal ahşap ve grafitin kağıt liflerindeki dokusal sürtünmesi",
  },
  {
    id: "ballpoint",
    nameKey: "sound.ballpoint.name",
    descKey: "sound.ballpoint.desc",
    subKey: "sound.ballpoint.sub",
    name: "Tükenmez Kalem",
    emoji: "",
    description: "Bilyeli uç & mekanik çıtçıt",
    subtext: "Klasik tükenmez kalemin ritmik ve net tıklama hissiyatı",
  },
  {
    id: "typewriter",
    nameKey: "sound.typewriter.name",
    descKey: "sound.typewriter.desc",
    subKey: "sound.typewriter.sub",
    name: "Vintage Daktilo",
    emoji: "",
    description: "Nostaljik mekanik tuş tıkırtısı",
    subtext: "Eski mekanik daktilo tuşlarının tok ve yankılı vuruşu",
  },
];

export function getSavedSoundProfile(): SoundProfileType {
  try {
    const val = localStorage.getItem("yourbook_sound_profile_v1");
    if (val === "fountain" || val === "pencil" || val === "ballpoint" || val === "typewriter") return val;
  } catch {}
  return "fountain";
}

export function setSavedSoundProfile(profile: SoundProfileType): void {
  try {
    localStorage.setItem("yourbook_sound_profile_v1", profile);
  } catch {}
}

/** Taktil haptik titreşim (Capacitor / Web Vibration API güvenli sarmalayıcı) */
export function triggerHaptic(style: "light" | "medium" | "heavy" = "light"): void {
  try {
    if (typeof window === "undefined") return;
    const win = window as any;
    if (win.Capacitor?.isPluginAvailable?.("Haptics")) {
      win.Capacitor.Plugins.Haptics.impact({ style });
    } else if (typeof win.navigator !== "undefined" && typeof win.navigator.vibrate === "function") {
      win.navigator.vibrate(style === "light" ? 10 : style === "medium" ? 25 : 45);
    }
  } catch {
    // Web ortamında no-op, asla hata fırlatmaz
  }
}

export function isSoundMuted(): boolean {
  return isMuted;
}

export function toggleSound(): boolean {
  isMuted = !isMuted;
  try {
    localStorage.setItem("lexi_sound_muted", String(isMuted));
  } catch { }
  triggerHaptic("medium");
  if (!isMuted) playPopSound();
  return isMuted;
}

/**
 * Zamana duyarlı ses profili:
 * Gündüz saatlerinde net ve canlı sesler (1.0x).
 * Gece (22:00 - 06:00 arası) sessiz ortamlarda rahatsız etmemek için
 * sesler otomatik olarak fısıltı seviyesinde daha kısık ve yumuşak (0.40x) çalınır.
 */
export function getTimeAwareVolumeMultiplier(): number {
  if (typeof window === "undefined") return 1.0;
  const hour = new Date().getHours();
  if (hour >= 22 || hour < 6) return 0.40;
  return 1.0;
}

// Tek, paylaşılan bağlam: her sesde yeni AudioContext açmak pahalıydı (tıklama gecikmesi) ve
// hiç kapatılmadığı için tarayıcının eşzamanlı bağlam sınırını (~6) aşıp sesi susturabiliyordu.
let sharedCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (isMuted || typeof window === "undefined") return null;
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return null;
    if (!sharedCtx || sharedCtx.state === "closed") sharedCtx = new AudioContextClass();
    if (sharedCtx.state === "suspended") void sharedCtx.resume().catch(() => {});
    return sharedCtx;
  } catch {
    return null;
  }
}

/** İlk kullanıcı dokunuşunda bağlamı önceden hazırlar: ilk tıklama sesi arayüzü bekletmesin. */
export function warmUpAudio(): void {
  void getAudioContext();
}

/** Pop / Taktil tık (butonlar, kategori hapları) */
export function playPopSound(): void {
  try {
    triggerHaptic("light");
    const ctx = getAudioContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(600, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(180, ctx.currentTime + 0.04);
    gain.gain.setValueAtTime(0.12 * getTimeAwareVolumeMultiplier(), ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.045);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.05);
  } catch { }
}

/** Active Recall perde açılış sesi */
export function playRevealSound(): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(1200, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(2400, ctx.currentTime + 0.06);
    gain.gain.setValueAtTime(0.08 * getTimeAwareVolumeMultiplier(), ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.08);
  } catch { }
}

/** "Öğrendim" kutlama akoru (C5, E5, G5, C6) */
export function playSuccessSound(): void {
  try {
    triggerHaptic("heavy");
    const ctx = getAudioContext();
    if (!ctx) return;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, idx) => {
      const startTime = ctx.currentTime + idx * 0.055;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, startTime);
      gain.gain.setValueAtTime(0.16, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.38);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(startTime);
      osc.stop(startTime + 0.4);
    });
  } catch { }
}

/** İğneleme / sabitleme sesi (metalik çıtçıt) */
export function playPinSound(): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(950, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.05);
    gain.gain.setValueAtTime(0.15 * getTimeAwareVolumeMultiplier(), ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.06);
  } catch { }
}

/** Defter sayfası çevirme hışırtısı (~140ms bandpass gürültü sentezi) */
export function playPaperRustle(): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const bufferSize = Math.floor(ctx.sampleRate * 0.14);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.4;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(1400, ctx.currentTime);
    filter.Q.setValueAtTime(1.4, ctx.currentTime);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.08, ctx.currentTime + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.14);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start(ctx.currentTime);
  } catch { }
}

/**
 * Seçili ses profiline göre (Kurşun kalem, dolmakalem, tükenmez kalem veya daktilo)
 * kağıda yazma / çizme / tikleme sürtünme sesi çalar.
 */
export function playPenScratch(profileOverride?: SoundProfileType): void {
  try {
    triggerHaptic("light");
    const ctx = getAudioContext();
    if (!ctx) return;
    const profile = profileOverride || getSavedSoundProfile();
    const vol = getTimeAwareVolumeMultiplier();

    if (profile === "pencil") {
      // 1. KURŞUN KALEM (Grafit & dokulu kağıt sürtünmesi)
      const bufferSize = Math.floor(ctx.sampleRate * 0.10);
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        // Pürüzlü grafit tanecikleri
        data[i] = (Math.random() * 2 - 1) * 0.38;
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.setValueAtTime(1900, ctx.currentTime);
      filter.Q.setValueAtTime(1.8, ctx.currentTime);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.001, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.11 * vol, ctx.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.10);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      noise.start(ctx.currentTime);
    } else if (profile === "ballpoint") {
      // 2. TÜKENMEZ KALEM (Mikro çıtçıt + bilye sürtünmesi)
      const osc = ctx.createOscillator();
      const oscGain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(750, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(190, ctx.currentTime + 0.025);
      oscGain.gain.setValueAtTime(0.07 * vol, ctx.currentTime);
      oscGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.025);
      osc.connect(oscGain);
      oscGain.connect(ctx.destination);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.03);

      const bufferSize = Math.floor(ctx.sampleRate * 0.06);
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * 0.28;
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = "highpass";
      filter.frequency.setValueAtTime(3200, ctx.currentTime);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.001, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.07 * vol, ctx.currentTime + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      noise.start(ctx.currentTime);
    } else if (profile === "typewriter") {
      // 3. VINTAGE DAKTİLO (Mekanik tuş vuruşu + hafif çan tınısı)
      const thud = ctx.createOscillator();
      const thudGain = ctx.createGain();
      thud.type = "triangle";
      thud.frequency.setValueAtTime(180, ctx.currentTime);
      thud.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 0.045);
      thudGain.gain.setValueAtTime(0.18 * vol, ctx.currentTime);
      thudGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
      thud.connect(thudGain);
      thudGain.connect(ctx.destination);
      thud.start(ctx.currentTime);
      thud.stop(ctx.currentTime + 0.05);

      const clack = ctx.createOscillator();
      const clackGain = ctx.createGain();
      clack.type = "square";
      clack.frequency.setValueAtTime(1600, ctx.currentTime);
      clack.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.02);
      clackGain.gain.setValueAtTime(0.06 * vol, ctx.currentTime);
      clackGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.025);
      clack.connect(clackGain);
      clackGain.connect(ctx.destination);
      clack.start(ctx.currentTime);
      clack.stop(ctx.currentTime + 0.03);
    } else {
      // 4. DOLMAKALEM (Varsayılan: Akıcı ıslak mürekkep & metalik uç süzülmesi)
      const bufferSize = Math.floor(ctx.sampleRate * 0.085);
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * 0.32;
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = "highpass";
      filter.frequency.setValueAtTime(2900, ctx.currentTime);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.001, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.09 * vol, ctx.currentTime + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.085);
      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      noise.start(ctx.currentTime);
    }
  } catch { }
}

/** Belirli bir ses profilini hemen dinletir (önizleme amaçlı) */
export function playPenProfileSample(profile: SoundProfileType): void {
  playPenScratch(profile);
}

/** Kağıda vurulan mürekkep damgası efekti (~90ms soft thud + click) */
export function playStampThud(): void {
  try {
    triggerHaptic("medium");
    const ctx = getAudioContext();
    if (!ctx) return;
    // 1. Düşük frekanslı ahşap damga darbesi
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(130, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(55, ctx.currentTime + 0.07);
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
    // 2. Kağıt temas çıtırtısı
    const clickOsc = ctx.createOscillator();
    const clickGain = ctx.createGain();
    clickOsc.type = "triangle";
    clickOsc.frequency.setValueAtTime(580, ctx.currentTime);
    clickGain.gain.setValueAtTime(0.08, ctx.currentTime);
    clickGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.03);
    osc.connect(gain);
    gain.connect(ctx.destination);
    clickOsc.connect(clickGain);
    clickGain.connect(ctx.destination);
    osc.start(ctx.currentTime);
    clickOsc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.09);
    clickOsc.stop(ctx.currentTime + 0.04);
  } catch { }
}