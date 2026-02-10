"use client";

import type { ReactNode } from "react";
import { useTraySync } from "@/hooks/use-tray-sync";

interface TrayProviderProps {
  children: ReactNode;
}

export function TrayProvider({ children }: TrayProviderProps) {
  useTraySync();
  return <>{children}</>;
}
