"use client";

import { useSyncExternalStore } from "react";
import { useAppearanceStore } from "@/lib/stores/appearance";
import { getBackgroundImage, BG_CHANGE_EVENT } from "@/lib/theme/background";

function fitToCss(fit: string): string {
  switch (fit) {
    case "cover":
      return "cover";
    case "contain":
      return "contain";
    case "fill":
      return "100% 100%";
    case "tile":
      return "auto";
    default:
      return "cover";
  }
}

let bgVersion = 0;

function subscribeToBgChange(callback: () => void) {
  const handler = () => {
    bgVersion++;
    callback();
  };
  window.addEventListener(BG_CHANGE_EVENT, handler);
  return () => window.removeEventListener(BG_CHANGE_EVENT, handler);
}

function getBgSnapshot() {
  return `${bgVersion}:${getBackgroundImage() ?? ""}`;
}

function getBgServerSnapshot() {
  return "0:";
}

export function BackgroundImage() {
  const { backgroundEnabled, backgroundOpacity, backgroundBlur, backgroundFit } =
    useAppearanceStore();

  const snapshot = useSyncExternalStore(subscribeToBgChange, getBgSnapshot, getBgServerSnapshot);
  const imageUrl = backgroundEnabled ? (snapshot.slice(snapshot.indexOf(":") + 1) || null) : null;

  if (!backgroundEnabled || !imageUrl) return null;

  return (
    <>
      <div
        className="fixed pointer-events-none"
        style={{
          zIndex: 0,
          inset: backgroundBlur > 0 ? `-${backgroundBlur}px` : 0,
          backgroundImage: `url(${imageUrl})`,
          backgroundSize: fitToCss(backgroundFit),
          backgroundPosition: "center",
          backgroundRepeat: backgroundFit === "tile" ? "repeat" : "no-repeat",
          filter: backgroundBlur > 0 ? `blur(${backgroundBlur}px)` : undefined,
        }}
      />
      <div
        className="fixed inset-0 pointer-events-none bg-background"
        style={{
          zIndex: 0,
          opacity: 1 - backgroundOpacity / 100,
        }}
      />
    </>
  );
}
