export function supportsRandomUuid(): boolean {
  return typeof globalThis.crypto !== 'undefined'
    && typeof globalThis.crypto.randomUUID === 'function';
}

export function generateRandomUuid(): string | null {
  if (!supportsRandomUuid()) return null;
  return globalThis.crypto.randomUUID();
}

export function supportsRandomValues(): boolean {
  return typeof globalThis.crypto !== 'undefined'
    && typeof globalThis.crypto.getRandomValues === 'function';
}

export function fillRandomValues(target: Uint32Array): boolean {
  if (!supportsRandomValues()) return false;
  globalThis.crypto.getRandomValues(target);
  return true;
}

export function supportsSubtleDigest(): boolean {
  return typeof globalThis.crypto !== 'undefined'
    && typeof globalThis.crypto.subtle !== 'undefined'
    && typeof globalThis.crypto.subtle.digest === 'function';
}

export async function digestWithSubtle(
  algorithm: string,
  data: BufferSource,
): Promise<ArrayBuffer | null> {
  if (!supportsSubtleDigest()) return null;
  return globalThis.crypto.subtle.digest(algorithm, data);
}
