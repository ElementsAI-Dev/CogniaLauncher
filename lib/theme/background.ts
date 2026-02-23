const BG_IMAGE_KEY = 'cognia-bg-image';
export const BG_CHANGE_EVENT = 'cognia-bg-change';

export function getBackgroundImage(): string | null {
  try {
    return localStorage.getItem(BG_IMAGE_KEY);
  } catch {
    return null;
  }
}

export function setBackgroundImageData(dataUrl: string): void {
  localStorage.setItem(BG_IMAGE_KEY, dataUrl);
}

export function removeBackgroundImage(): void {
  try {
    localStorage.removeItem(BG_IMAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function notifyBackgroundChange(): void {
  window.dispatchEvent(new CustomEvent(BG_CHANGE_EVENT));
}

/**
 * Compress an image blob/file to a JPEG data URL under the given max size.
 * Scales down to max 1920px on the longest side and iteratively reduces
 * JPEG quality until the result is within budget.
 */
export async function compressImage(
  source: Blob,
  maxSizeKB: number = 800,
): Promise<string> {
  const url = URL.createObjectURL(source);
  try {
    const img = await loadImage(url);
    const { width, height } = scaleDown(img.naturalWidth, img.naturalHeight, 1920);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0, width, height);

    let quality = 0.85;
    const maxBytes = maxSizeKB * 1024;

    while (quality > 0.1) {
      const dataUrl = canvas.toDataURL('image/jpeg', quality);
      const byteLength = Math.round((dataUrl.length - 'data:image/jpeg;base64,'.length) * 0.75);
      if (byteLength <= maxBytes) {
        return dataUrl;
      }
      quality -= 0.1;
    }

    return canvas.toDataURL('image/jpeg', 0.1);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function scaleDown(
  w: number,
  h: number,
  maxDim: number,
): { width: number; height: number } {
  if (w <= maxDim && h <= maxDim) return { width: w, height: h };
  const ratio = Math.min(maxDim / w, maxDim / h);
  return {
    width: Math.round(w * ratio),
    height: Math.round(h * ratio),
  };
}
