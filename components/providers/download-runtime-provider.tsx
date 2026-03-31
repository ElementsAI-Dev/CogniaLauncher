"use client";

import type { ReactNode } from "react";
import { useDownloads } from "@/hooks/downloads/use-downloads";

interface DownloadRuntimeProviderProps {
  children: ReactNode;
}

export function DownloadRuntimeProvider({ children }: DownloadRuntimeProviderProps) {
  useDownloads({ enableRuntime: true });
  return <>{children}</>;
}
