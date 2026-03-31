import { useState, useCallback, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Layers, Package, Settings, Wrench } from 'lucide-react';
import { useLocale } from '@/components/providers/locale-provider';
import { getDesktopAction } from '@/lib/desktop-actions';
import {
  getSearchHistory,
  saveSearchHistory,
  clearSearchHistory as clearStoredHistory,
} from '@/lib/dashboard-utils';
import { getToolboxDetailPath } from '@/lib/toolbox-route';
import type { SearchResult } from '@/types/dashboard';
import type { EnvironmentInfo, InstalledPackage } from '@/lib/tauri';
import { createElement } from 'react';
import { LanguageIcon } from '@/components/provider-management/provider-icon';
import { useDesktopActionExecutor } from '@/hooks/desktop/use-desktop-action-executor';
import { useToolbox } from '@/hooks/toolbox/use-toolbox';

interface UseDashboardSearchParams {
  environments: EnvironmentInfo[];
  packages: InstalledPackage[];
  containerRef: React.RefObject<HTMLDivElement | null>;
  inputRef: React.RefObject<HTMLInputElement | null>;
}

export interface UseDashboardSearchReturn {
  query: string;
  setQuery: (query: string) => void;
  open: boolean;
  setOpen: (open: boolean) => void;
  searchHistory: string[];
  quickActions: SearchResult[];
  envResults: SearchResult[];
  pkgResults: SearchResult[];
  toolResults: SearchResult[];
  actionResults: SearchResult[];
  hasResults: boolean;
  showDropdown: boolean;
  clearHistory: () => void;
  handleSelect: (result: SearchResult) => void;
}

export function useDashboardSearch({
  environments,
  packages,
  containerRef,
  inputRef,
}: UseDashboardSearchParams): UseDashboardSearchReturn {
  const router = useRouter();
  const { t } = useLocale();
  const executeDesktopAction = useDesktopActionExecutor();

  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [searchHistory, setSearchHistory] = useState<string[]>(getSearchHistory);
  const { allTools } = useToolbox();

  const quickActions: SearchResult[] = useMemo(
    () => {
      const openSettingsAction = getDesktopAction("open_settings");

      return [
        {
          type: "action",
          id: "add-environment",
          title: t("dashboard.quickActions.addEnvironment"),
          icon: createElement(Layers, { className: "h-4 w-4" }),
          href: "/environments",
        },
        {
          type: "action",
          id: "install-package",
          title: t("dashboard.quickActions.installPackage"),
          icon: createElement(Package, { className: "h-4 w-4" }),
          href: "/packages",
        },
        {
          type: "action",
          id: openSettingsAction.id,
          title: t(openSettingsAction.titleKey),
          icon: createElement(Settings, { className: "h-4 w-4" }),
          action: () => {
            void executeDesktopAction("open_settings");
          },
        },
      ];
    },
    [executeDesktopAction, t],
  );

  const envResults = useMemo((): SearchResult[] => {
    if (!query.trim()) return [];
    const lowerQuery = query.toLowerCase();
    return environments
      .filter(
        (env) =>
          env.env_type.toLowerCase().includes(lowerQuery) ||
          env.provider.toLowerCase().includes(lowerQuery),
      )
      .slice(0, 3)
      .map((env) => ({
        type: "environment" as const,
        id: `env-${env.env_type}`,
        title: env.env_type,
        subtitle: `${env.provider} • ${env.current_version || t("common.none")}`,
        icon: createElement(LanguageIcon, { languageId: env.env_type, size: 16 }),
        href: "/environments",
      }));
  }, [query, environments, t]);

  const pkgResults = useMemo((): SearchResult[] => {
    if (!query.trim()) return [];
    const lowerQuery = query.toLowerCase();
    return packages
      .filter(
        (pkg) =>
          pkg.name.toLowerCase().includes(lowerQuery) ||
          pkg.provider.toLowerCase().includes(lowerQuery),
      )
      .slice(0, 3)
      .map((pkg) => ({
        type: "package" as const,
        id: `pkg-${pkg.provider}-${pkg.name}`,
        title: pkg.name,
        subtitle: `${pkg.provider} • ${pkg.version}`,
        icon: createElement(Package, { className: "h-4 w-4" }),
        href: "/packages",
      }));
  }, [query, packages]);

  const toolResults = useMemo((): SearchResult[] => {
    if (!query.trim()) return [];
    const lowerQuery = query.toLowerCase();
    return allTools
      .filter(
        (tool) =>
          tool.name.toLowerCase().includes(lowerQuery) ||
          tool.keywords.some((kw) => kw.toLowerCase().includes(lowerQuery)),
      )
      .slice(0, 4)
      .map((tool) => ({
        type: 'action' as const,
        id: `tool-${tool.id}`,
        title: tool.name,
        subtitle: tool.description,
        icon: createElement(Wrench, { className: 'h-4 w-4' }),
        href: getToolboxDetailPath(tool.id),
      }));
  }, [query, allTools]);

  const actionResults = useMemo((): SearchResult[] => {
    if (!query.trim()) return [];
    const lowerQuery = query.toLowerCase();
    return quickActions.filter((action) =>
      action.title.toLowerCase().includes(lowerQuery),
    );
  }, [query, quickActions]);

  const hasResults = envResults.length > 0 || pkgResults.length > 0 || toolResults.length > 0 || actionResults.length > 0;
  const showDropdown = open && (!!query.trim() || searchHistory.length > 0 || quickActions.length > 0);

  const saveToHistory = useCallback((searchQuery: string) => {
    if (!searchQuery.trim()) return;
    setSearchHistory((prev) => saveSearchHistory(prev, searchQuery));
  }, []);

  const clearHistory = useCallback(() => {
    setSearchHistory([]);
    clearStoredHistory();
  }, []);

  const handleSelect = useCallback(
    (result: SearchResult) => {
      if (query.trim()) {
        saveToHistory(query);
      }

      if (result.action) {
        result.action();
      } else if (result.href) {
        router.push(result.href);
      }

      setQuery("");
      setOpen(false);
    },
    [query, router, saveToHistory],
  );

  // Global keyboard shortcut
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === "/" && !e.ctrlKey && !e.metaKey) {
        const target = e.target as HTMLElement;
        if (target.tagName !== "INPUT" && target.tagName !== "TEXTAREA") {
          e.preventDefault();
          inputRef.current?.focus();
          setOpen(true);
        }
      }
    };

    document.addEventListener("keydown", handleGlobalKeyDown);
    return () => document.removeEventListener("keydown", handleGlobalKeyDown);
  }, [inputRef]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [containerRef]);

  return {
    query,
    setQuery,
    open,
    setOpen,
    searchHistory,
    quickActions,
    envResults,
    pkgResults,
    toolResults,
    actionResults,
    hasResults,
    showDropdown,
    clearHistory,
    handleSelect,
  };
}
