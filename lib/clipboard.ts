import { isTauri } from '@/lib/platform';

/**
 * Write text to the system clipboard.
 * Uses tauri-plugin-clipboard-manager in Tauri, falls back to navigator.clipboard in web.
 */
export async function writeClipboard(text: string): Promise<void> {
  if (isTauri()) {
    const { writeText } = await import('@tauri-apps/plugin-clipboard-manager');
    await writeText(text);
  } else {
    await navigator.clipboard.writeText(text);
  }
}

/**
 * Read text from the system clipboard.
 * Uses tauri-plugin-clipboard-manager in Tauri, falls back to navigator.clipboard in web.
 */
export async function readClipboard(): Promise<string> {
  if (isTauri()) {
    const { readText } = await import('@tauri-apps/plugin-clipboard-manager');
    return await readText();
  }
  return await navigator.clipboard.readText();
}

/**
 * Write image data to the system clipboard.
 * Uses tauri-plugin-clipboard-manager in Tauri, falls back to Clipboard API in web.
 * Note: Android/iOS not supported by Tauri plugin.
 */
export async function writeClipboardImage(
  image: string | number[] | ArrayBuffer | Uint8Array,
): Promise<void> {
  if (isTauri()) {
    const { writeImage } = await import('@tauri-apps/plugin-clipboard-manager');
    await writeImage(image);
  } else {
    if (image instanceof Uint8Array || image instanceof ArrayBuffer) {
      const buffer = image instanceof Uint8Array ? image.buffer as ArrayBuffer : image;
      const blob = new Blob([buffer], { type: 'image/png' });
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob }),
      ]);
    }
  }
}

/**
 * Read image data from the system clipboard.
 * Uses tauri-plugin-clipboard-manager in Tauri, falls back to Clipboard API in web.
 * Returns null if no image is available.
 */
export async function readClipboardImage(): Promise<Uint8Array | null> {
  if (isTauri()) {
    try {
      const { readImage } = await import(
        '@tauri-apps/plugin-clipboard-manager'
      );
      const image = await readImage();
      return new Uint8Array(await image.rgba());
    } catch {
      return null;
    }
  }
  try {
    const items = await navigator.clipboard.read();
    for (const item of items) {
      if (item.types.includes('image/png')) {
        const blob = await item.getType('image/png');
        return new Uint8Array(await blob.arrayBuffer());
      }
    }
  } catch {
    // Clipboard API may not support images
  }
  return null;
}

/**
 * Clear the system clipboard.
 * Uses tauri-plugin-clipboard-manager in Tauri, falls back to writing empty text in web.
 */
export async function clearClipboard(): Promise<void> {
  if (isTauri()) {
    const { clear } = await import('@tauri-apps/plugin-clipboard-manager');
    await clear();
  } else {
    await navigator.clipboard.writeText('');
  }
}
