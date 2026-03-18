"use client";

import Image from "next/image";
import { useTheme } from "next-themes";
import { BRAND_ICON_FILES, LANGUAGE_ICON_FILES, PROVIDER_ICON_FILES } from "@/lib/constants/icon-maps";
import type { AboutBrandAsset, AboutBrandIconCategory } from "@/lib/constants/about";
import { cn } from "@/lib/utils";

const ICON_FILE_MAPS: Record<AboutBrandIconCategory, Record<string, string>> = {
  brands: BRAND_ICON_FILES,
  languages: LANGUAGE_ICON_FILES,
  providers: PROVIDER_ICON_FILES,
};

interface AboutBrandIconProps {
  asset: AboutBrandAsset;
  size?: number;
  className?: string;
}

export function AboutBrandIcon({
  asset,
  size = 20,
  className,
}: AboutBrandIconProps) {
  const { resolvedTheme } = useTheme();
  const theme = resolvedTheme === "dark" ? "dark" : "light";
  const file = ICON_FILE_MAPS[asset.category][asset.name];

  if (!file) {
    return null;
  }

  return (
    <Image
      src={`/icons/${asset.category}/${theme}/${file}.svg`}
      alt=""
      width={size}
      height={size}
      className={cn("inline-block shrink-0 object-contain", className)}
      aria-hidden="true"
      unoptimized
    />
  );
}
