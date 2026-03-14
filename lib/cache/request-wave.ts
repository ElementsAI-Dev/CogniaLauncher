'use client';

export interface RequestWaveRef {
  current: number;
}

export function startRequestWave(ref: RequestWaveRef): number {
  ref.current += 1;
  return ref.current;
}

export function isRequestWaveCurrent(ref: RequestWaveRef, wave: number): boolean {
  return ref.current === wave;
}

export function invalidateRequestWave(ref: RequestWaveRef): void {
  ref.current += 1;
}
