import {
  digestWithSubtle,
  fillRandomValues,
  generateRandomUuid,
  supportsRandomUuid,
  supportsRandomValues,
  supportsSubtleDigest,
} from './browser-api';

describe('browser-api', () => {
  const originalCrypto = globalThis.crypto;

  afterEach(() => {
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: originalCrypto,
    });
  });

  it('reports missing crypto capabilities when browser APIs are unavailable', async () => {
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: undefined,
    });

    expect(supportsRandomUuid()).toBe(false);
    expect(generateRandomUuid()).toBeNull();
    expect(supportsRandomValues()).toBe(false);
    expect(fillRandomValues(new Uint32Array(2))).toBe(false);
    expect(supportsSubtleDigest()).toBe(false);
    await expect(digestWithSubtle('SHA-256', new Uint8Array([1, 2, 3]))).resolves.toBeNull();
  });

  it('uses Web Crypto helpers when available', async () => {
    const randomUUID = jest.fn(() => 'uuid-123');
    const getRandomValues = jest.fn((target: Uint32Array) => {
      target[0] = 7;
      target[1] = 11;
      return target;
    });
    const digest = jest.fn(async () => new Uint8Array([9, 9, 9]).buffer);

    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      value: {
        randomUUID,
        getRandomValues,
        subtle: { digest },
      },
    });

    const target = new Uint32Array(2);
    const result = await digestWithSubtle('SHA-256', new Uint8Array([1, 2, 3]));

    expect(supportsRandomUuid()).toBe(true);
    expect(generateRandomUuid()).toBe('uuid-123');
    expect(supportsRandomValues()).toBe(true);
    expect(fillRandomValues(target)).toBe(true);
    expect(Array.from(target)).toEqual([7, 11]);
    expect(supportsSubtleDigest()).toBe(true);
    expect(digest).toHaveBeenCalledWith('SHA-256', expect.any(Uint8Array));
    expect(result).toBeInstanceOf(ArrayBuffer);
  });
});
