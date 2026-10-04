import type { CSSProperties } from "react";

/**
 * Kart ID'sinden türetilmiş deterministik (her render'da sabit kalan)
 * hafif organik bir kağıt rotasyonu (-1.2° ile +1.2° arası) üretir.
 * Masaya rastgele serpilmiş kağıt hissi verir.
 */
export function getDeterministicRotation(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash << 5) - hash + id.charCodeAt(i);
    hash |= 0;
  }
  const angles = [-1.2, -0.8, -0.5, 0.4, 0.7, 1.1, -1.0, 0.9];
  const absHash = Math.abs(hash);
  return angles[absHash % angles.length];
}

export function getCardRotationStyle(id: string): CSSProperties {
  const rot = getDeterministicRotation(id);
  return {
    "--card-rot": `${rot}deg`,
    transform: `rotate(${rot}deg)`,
  } as CSSProperties;
}
