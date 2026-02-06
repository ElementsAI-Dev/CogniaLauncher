"use client";

import { useTraySync } from "@/hooks/use-tray-sync";

interface TrayProviderProps {
  children: React.ReactNode;
}

export function TrayProvider({ children }: TrayProviderProps) {
  useTraySync();
  return <>{children}</>;
}
