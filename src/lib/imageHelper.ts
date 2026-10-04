/**
 * Tarayıcıda görüntüyü yeniden boyutlandırıp sıkıştırarak
 * Base64 (Data URL) olarak döndür — yerel depolamayı şişirmemek için.
 */
export function processAndCompressImage(
  file: File,
  maxWidth = 800,
  quality = 0.82
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      reject(new Error("Invalid file type: only images are accepted."));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error("File could not be read."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Image could not be decoded."));
      img.onload = () => {
        try {
          const scale = Math.min(1, maxWidth / img.width);
          const width = Math.max(1, Math.round(img.width * scale));
          const height = Math.max(1, Math.round(img.height * scale));

          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            reject(new Error("Canvas is not supported."));
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);

          const dataUrl = canvas.toDataURL("image/jpeg", quality);
          resolve(dataUrl);
        } catch (err) {
          reject(err);
        }
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}
