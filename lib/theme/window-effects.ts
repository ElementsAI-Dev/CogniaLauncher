import { isWindowEffect, type WindowEffect } from "./types";
export type { WindowEffect } from "./types";

export interface WindowEffectRuntimeState {
  desktop: boolean;
  nativeAvailable: boolean;
  requested: WindowEffect;
  requestedSupported: boolean;
  unsupportedRequested: WindowEffect | null;
  selectable: WindowEffect[];
  effective: WindowEffect | null;
}

export function normalizeSupportedWindowEffects(
  supported: readonly string[],
): WindowEffect[] {
  return supported.filter((effect): effect is WindowEffect => isWindowEffect(effect));
}

export function resolveEffectiveWindowEffect(
  requested: WindowEffect,
  supported: readonly string[],
): WindowEffect | null {
  const normalizedSupported = normalizeSupportedWindowEffects(supported);

  if (requested === "none") {
    return null;
  }

  if (requested === "auto") {
    if (normalizedSupported.includes("mica")) {
      return "mica";
    }
    if (normalizedSupported.includes("vibrancy")) {
      return "vibrancy";
    }
    return null;
  }

  return normalizedSupported.includes(requested) ? requested : null;
}

export function buildWindowEffectRuntimeState({
  requested,
  supported,
  desktop,
}: {
  requested: WindowEffect;
  supported: readonly string[];
  desktop: boolean;
}): WindowEffectRuntimeState {
  const normalizedSupported = normalizeSupportedWindowEffects(supported);

  if (!desktop) {
    return {
      desktop: false,
      nativeAvailable: false,
      requested,
      requestedSupported: requested === "none",
      unsupportedRequested: requested === "none" ? null : requested,
      selectable: ["none"],
      effective: null,
    };
  }

  const requestedSupported =
    requested === "auto"
      ? normalizedSupported.includes("auto")
      : requested === "none"
        ? normalizedSupported.includes("none")
        : normalizedSupported.includes(requested);

  return {
    desktop: true,
    nativeAvailable: normalizedSupported.some((effect) => effect !== "none"),
    requested,
    requestedSupported,
    unsupportedRequested: requestedSupported ? null : requested,
    selectable: normalizedSupported.length > 0 ? normalizedSupported : ["none"],
    effective: resolveEffectiveWindowEffect(requested, normalizedSupported),
  };
}
