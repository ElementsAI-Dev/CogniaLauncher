"use client";

import Image from "next/image";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import {
  PROVIDER_ICON_FILES,
  PLATFORM_ICON_FILES,
  LANGUAGE_ICON_FILES,
  CACHE_PROVIDER_MAP,
} from "@/lib/constants/icon-maps";
import type {
  ProviderIconProps,
  PlatformIconProps,
  LanguageIconProps,
} from "@/types/provider";

function useIconTheme(): "light" | "dark" {
  const { resolvedTheme } = useTheme();
  return resolvedTheme === "dark" ? "dark" : "light";
}

function FallbackIcon({
  label,
  size = 24,
  className,
}: {
  label: string;
  size?: number;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded bg-muted text-muted-foreground font-bold text-xs",
        className,
      )}
      style={{ width: size, height: size, fontSize: size * 0.45 }}
      aria-hidden="true"
    >
      {label.charAt(0).toUpperCase()}
    </span>
  );
}

export function ProviderIcon({
  providerId,
  size = 24,
  className,
}: ProviderIconProps) {
  const theme = useIconTheme();
  const file = PROVIDER_ICON_FILES[providerId];

  if (!file) {
    return <FallbackIcon label={providerId} size={size} className={className} />;
  }

  return (
    <Image
      src={`/icons/providers/${theme}/${file}.svg`}
      alt={providerId}
      width={size}
      height={size}
      className={cn("inline-block flex-shrink-0", className)}
      aria-hidden="true"
      unoptimized
    />
  );
}

export function PlatformIcon({
  platform,
  size = 20,
  className,
}: PlatformIconProps) {
  const theme = useIconTheme();
  const file = PLATFORM_ICON_FILES[platform.toLowerCase()];

  if (!file) {
    return <FallbackIcon label={platform} size={size} className={className} />;
  }

  return (
    <Image
      src={`/icons/platforms/${theme}/${file}.svg`}
      alt={platform}
      width={size}
      height={size}
      className={cn("inline-block flex-shrink-0", className)}
      aria-hidden="true"
      unoptimized
    />
  );
}

export function LanguageIcon({
  languageId,
  size = 24,
  className,
}: LanguageIconProps) {
  const theme = useIconTheme();
  const file = LANGUAGE_ICON_FILES[languageId];

  if (!file) {
    return (
      <FallbackIcon label={languageId} size={size} className={className} />
    );
  }

  return (
    <Image
      src={`/icons/languages/${theme}/${file}.svg`}
      alt={languageId}
      width={size}
      height={size}
      className={cn("inline-block flex-shrink-0", className)}
      aria-hidden="true"
      unoptimized
    />
  );
}

export function CacheProviderIcon({
  provider,
  size = 24,
  className,
}: {
  provider: string;
  size?: number;
  className?: string;
}) {
  const theme = useIconTheme();
  const file = CACHE_PROVIDER_MAP[provider];

  if (!file) {
    return <FallbackIcon label={provider} size={size} className={className} />;
  }

  return (
    <Image
      src={`/icons/providers/${theme}/${file}.svg`}
      alt={provider}
      width={size}
      height={size}
      className={cn("inline-block flex-shrink-0", className)}
      aria-hidden="true"
      unoptimized
    />
  );
}
