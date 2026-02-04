'use client';

import { useTraySync } from '@/lib/hooks/use-tray-sync';

interface TrayProviderProps {
  children: React.ReactNode;
}

export function TrayProvider({ children }: TrayProviderProps) {
  useTraySync();
  return <>{children}</>;
}
