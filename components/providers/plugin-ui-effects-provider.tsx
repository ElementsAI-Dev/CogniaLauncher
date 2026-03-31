"use client";

import type { ReactNode } from "react";
import { usePluginUiEffects } from "@/hooks/plugins/use-plugin-ui-effects";

interface PluginUiEffectsProviderProps {
  children: ReactNode;
}

export function PluginUiEffectsProvider({ children }: PluginUiEffectsProviderProps) {
  usePluginUiEffects();
  return <>{children}</>;
}
