import {
  Settings2,
  Network,
  Shield,
  Server,
  Palette,
  RefreshCw,
  Monitor,
  FolderOpen,
  Package,
  Info,
  type LucideIcon,
} from "lucide-react";

export type TranslateFunction = (
  key: string,
  params?: Record<string, string | number>,
) => string;

export const SECTION_ICONS: Record<string, LucideIcon> = {
  Settings2,
  Network,
  Shield,
  Server,
  Palette,
  RefreshCw,
  Monitor,
  FolderOpen,
  Package,
  Info,
};
