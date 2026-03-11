"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { writeClipboard } from "@/lib/clipboard";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  FileText,
  Copy,
  RefreshCw,
  Pencil,
  Save,
  AlertCircle,
  RotateCcw,
} from "lucide-react";
import { getTerminalEditorLanguage } from "@/lib/constants/terminal";
import { TerminalConfigEditor } from "./terminal-config-editor";
import type {
  ShellInfo,
  ShellType,
  ShellConfigEntries,
  TerminalConfigDiagnostic,
  TerminalConfigEditorMetadata,
  TerminalConfigMutationResult,
  TerminalConfigRestoreResult,
} from "@/types/tauri";
import { useLocale } from "@/components/providers/locale-provider";
import { toast } from "sonner";

type TerminalConfigResult =
  | TerminalConfigMutationResult
  | TerminalConfigRestoreResult;
type ConfigSessionStatus =
  | "idle"
  | "loading"
  | "loaded"
  | "editing"
  | "saving"
  | "error"
  | "conflict";

interface TargetChangeIntent {
  shellId: string;
  configPath: string;
}

interface SavePreflightSummary {
  lineDelta: number;
  changedCategories: PreflightChangedCategory[];
  riskFlags: PreflightRiskCode[];
}

interface RefreshIntent {
  signal: number;
  configEntries: boolean;
  configMetadata: boolean;
}

interface RefreshHandledResult {
  configEntries: boolean;
  configMetadata: boolean;
}

const EMPTY_ENTRIES: ShellConfigEntries = {
  aliases: [],
  exports: [],
  sources: [],
};

function tupleListEqual(left: [string, string][], right: [string, string][]) {
  if (left.length !== right.length) return false;
  return left.every(([lk, lv], index) => {
    const [rk, rv] = right[index] ?? ["", ""];
    return lk === rk && lv === rv;
  });
}

function listEqual(left: string[], right: string[]) {
  if (left.length !== right.length) return false;
  return left.every((item, index) => item === right[index]);
}

function quoteShellValue(value: string) {
  return `"${value.replace(/"/g, '\\"')}"`;
}

function serializeEntries(entries: ShellConfigEntries, shellType: ShellType) {
  const aliasLines = entries.aliases
    .filter(([name, value]) => name.trim() && value.trim())
    .map(([name, value]) => {
      switch (shellType) {
        case "powershell":
          return `Set-Alias ${name.trim()} ${value.trim()}`;
        case "fish":
          return `alias ${name.trim()} ${quoteShellValue(value.trim())}`;
        case "cmd":
          return `doskey ${name.trim()}=${value.trim()}`;
        case "nushell":
          return `alias ${name.trim()} = ${value.trim()}`;
        default:
          return `alias ${name.trim()}=${quoteShellValue(value.trim())}`;
      }
    });

  const exportLines = entries.exports
    .filter(([key]) => key.trim())
    .map(([key, value]) => {
      switch (shellType) {
        case "powershell":
          return `$Env:${key.trim()} = ${quoteShellValue(value)}`;
        case "fish":
          return `set -gx ${key.trim()} ${quoteShellValue(value)}`;
        case "cmd":
          return `set ${key.trim()}=${value}`;
        case "nushell":
          return `let-env ${key.trim()} = ${quoteShellValue(value)}`;
        default:
          return `export ${key.trim()}=${quoteShellValue(value)}`;
      }
    });

  const sourceLines = entries.sources
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      switch (shellType) {
        case "powershell":
          return `. ${quoteShellValue(item)}`;
        case "cmd":
          return `call ${item}`;
        default:
          return `source ${quoteShellValue(item)}`;
      }
    });

  return [...aliasLines, ...exportLines, ...sourceLines].join("\n");
}

interface StructuredFallbackReason {
  unsupportedLine: string;
}

function detectStructuredFallbackReason(
  content: string,
  shellType: ShellType,
): StructuredFallbackReason | null {
  const lines = content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"));

  const supportsLine = (line: string) => {
    switch (shellType) {
      case "powershell":
        return (
          line.startsWith("Set-Alias ") ||
          line.startsWith("$Env:") ||
          line.startsWith(". ")
        );
      case "fish":
        return (
          line.startsWith("alias ") ||
          line.startsWith("set -gx ") ||
          line.startsWith("source ")
        );
      case "cmd":
        return (
          line.startsWith("doskey ") ||
          line.startsWith("set ") ||
          line.startsWith("call ")
        );
      case "nushell":
        return (
          line.startsWith("alias ") ||
          line.startsWith("let-env ") ||
          line.startsWith("source ")
        );
      default:
        return (
          line.startsWith("alias ") ||
          line.startsWith("export ") ||
          line.startsWith("source ") ||
          line.startsWith(". ")
        );
    }
  };

  const unsupported = lines.find((line) => !supportsLine(line));
  if (!unsupported) return null;
  return { unsupportedLine: unsupported };
}

type PreflightRiskCode =
  | "destructiveRootDelete"
  | "pathOverwrite"
  | "sourceSystemProfile";

type PreflightChangedCategory = "aliases" | "exports" | "sources";

function detectHighRiskPatterns(content: string, shellType: ShellType): PreflightRiskCode[] {
  const risks: PreflightRiskCode[] = [];
  if (/\brm\s+-rf\s+\/\b/.test(content)) {
    risks.push("destructiveRootDelete");
  }
  if (
    shellType !== "powershell" &&
    /\bexport\s+PATH\s*=/.test(content) &&
    !/\$PATH/.test(content)
  ) {
    risks.push("pathOverwrite");
  }
  if (/^\s*source\s+["']?\/etc\//m.test(content) || /^\s*\. ["']?\/etc\//m.test(content)) {
    risks.push("sourceSystemProfile");
  }
  return risks;
}

function getResultSnapshotPath(result: TerminalConfigResult | null) {
  return result?.snapshotPath ?? null;
}

function getResultFingerprint(result: TerminalConfigResult | null) {
  return result?.fingerprint ?? null;
}

interface TerminalShellConfigProps {
  shells: ShellInfo[];
  onReadConfig: (path: string) => Promise<string>;
  onFetchConfigEntries: (
    path: string,
    shellType: ShellType,
  ) => Promise<ShellConfigEntries | null>;
  onParseConfigContent?: (
    content: string,
    shellType: ShellType,
  ) => Promise<ShellConfigEntries | null>;
  onValidateConfigContent?: (
    content: string,
    shellType: ShellType,
  ) => Promise<TerminalConfigDiagnostic[]>;
  onBackupConfig: (path: string) => Promise<string | undefined>;
  onWriteConfig?: (
    path: string,
    content: string,
    shellType?: ShellType,
  ) => Promise<TerminalConfigMutationResult | void>;
  onGetConfigEditorMetadata?: (
    path: string,
    shellType: ShellType,
  ) => Promise<TerminalConfigEditorMetadata | null>;
  onRestoreConfigSnapshot?: (
    path: string,
  ) => Promise<TerminalConfigRestoreResult | undefined>;
  mutationStatus?: "idle" | "loading" | "success" | "error";
  mutationMessage?: string | null;
  mutationResult?: TerminalConfigResult | null;
  onClearMutationState?: () => void;
  onDirtyChange?: (dirty: boolean) => void;
  onRequestDiscard?: () => void;
  discardSignal?: number;
  refreshIntent?: RefreshIntent;
  onRefreshHandled?: (handled: RefreshHandledResult) => void;
}

export function TerminalShellConfig({
  shells,
  onReadConfig,
  onFetchConfigEntries,
  onParseConfigContent,
  onValidateConfigContent,
  onBackupConfig,
  onWriteConfig,
  onGetConfigEditorMetadata,
  onRestoreConfigSnapshot,
  mutationStatus = "idle",
  mutationMessage = null,
  mutationResult = null,
  onClearMutationState,
  onDirtyChange,
  discardSignal = 0,
  refreshIntent = { signal: 0, configEntries: false, configMetadata: false },
  onRefreshHandled,
}: TerminalShellConfigProps) {
  const { t } = useLocale();
  const [selectedShellId, setSelectedShellId] = useState<string>(
    shells[0]?.id ?? "",
  );
  const [selectedConfigPath, setSelectedConfigPath] = useState<string>("");
  const [persistedBaseline, setPersistedBaseline] = useState<string | null>(
    null,
  );
  const [draftContent, setDraftContent] = useState<string>("");
  const [baselineEntries, setBaselineEntries] = useState<ShellConfigEntries | null>(null);
  const [editing, setEditing] = useState(false);
  const [entries, setEntries] = useState<ShellConfigEntries | null>(null);
  const [liveDiagnostics, setLiveDiagnostics] = useState<TerminalConfigDiagnostic[]>([]);
  const [editorMetadata, setEditorMetadata] =
    useState<TerminalConfigEditorMetadata | null>(null);
  const [sessionStatus, setSessionStatus] = useState<ConfigSessionStatus>("idle");
  const [conflictMessage, setConflictMessage] = useState<string | null>(null);
  const [targetDialogOpen, setTargetDialogOpen] = useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [switchSaving, setSwitchSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [pendingTargetChange, setPendingTargetChange] = useState<TargetChangeIntent | null>(null);
  const [lastDiscardSignal, setLastDiscardSignal] = useState(discardSignal);
  const [lastRefreshSignal, setLastRefreshSignal] = useState(refreshIntent.signal);

  const selectedShell = shells.find((s) => s.id === selectedShellId);
  const configFiles = selectedShell?.configFiles.filter((f) => f.exists) ?? [];
  const diagnostics = mutationResult?.diagnosticDetails?.length
    ? mutationResult.diagnosticDetails
    : liveDiagnostics;
  const effectiveLanguage =
    editorMetadata?.language ??
    (selectedShell
      ? getTerminalEditorLanguage(selectedShell.shellType)
      : "plaintext");
  const isBusy = loading || mutationStatus === "loading" || sessionStatus === "saving";
  const isDirty =
    loaded &&
    editing &&
    persistedBaseline != null &&
    draftContent !== persistedBaseline;
  const structuredFallbackReason = useMemo(() => {
    if (!selectedShell || !editing) return null;
    const fallback = detectStructuredFallbackReason(draftContent, selectedShell.shellType);
    if (!fallback) return null;
    return t("terminal.structuredFallbackAdvancedSyntax", {
      line: fallback.unsupportedLine,
    });
  }, [draftContent, editing, selectedShell, t]);
  const preflightSummary = useMemo<SavePreflightSummary | null>(() => {
    if (!persistedBaseline || !selectedShell) return null;
    const lineDelta =
      draftContent.split("\n").length - persistedBaseline.split("\n").length;
    const baseEntries = baselineEntries ?? EMPTY_ENTRIES;
    const currentEntries = entries ?? EMPTY_ENTRIES;
    const changedCategories: PreflightChangedCategory[] = [];
    if (!tupleListEqual(baseEntries.aliases, currentEntries.aliases)) {
      changedCategories.push("aliases");
    }
    if (!tupleListEqual(baseEntries.exports, currentEntries.exports)) {
      changedCategories.push("exports");
    }
    if (!listEqual(baseEntries.sources, currentEntries.sources)) {
      changedCategories.push("sources");
    }
    return {
      lineDelta,
      changedCategories,
      riskFlags: detectHighRiskPatterns(draftContent, selectedShell.shellType),
    };
  }, [baselineEntries, draftContent, entries, persistedBaseline, selectedShell]);
  const sessionStatusLabel = useMemo(() => {
    switch (sessionStatus) {
      case "loading":
        return t("terminal.sessionStatusLoading");
      case "loaded":
        return t("terminal.sessionStatusLoaded");
      case "editing":
        return t("terminal.sessionStatusEditing");
      case "saving":
        return t("terminal.sessionStatusSaving");
      case "error":
        return t("terminal.sessionStatusError");
      case "conflict":
        return t("terminal.sessionStatusConflict");
      default:
        return t("terminal.sessionStatusIdle");
    }
  }, [sessionStatus, t]);

  const clearMutationFeedback = useCallback(() => {
    onClearMutationState?.();
  }, [onClearMutationState]);

  const resetLoadedTargetState = useCallback(() => {
    setPersistedBaseline(null);
    setDraftContent("");
    setBaselineEntries(null);
    setEditing(false);
    setEntries(null);
    setLiveDiagnostics([]);
    setEditorMetadata(null);
    setError(null);
    setLoaded(false);
    setConflictMessage(null);
    setSessionStatus("idle");
  }, []);

  const applyTargetChange = useCallback((target: TargetChangeIntent) => {
    setSelectedShellId(target.shellId);
    setSelectedConfigPath(target.configPath);
    clearMutationFeedback();
    resetLoadedTargetState();
  }, [clearMutationFeedback, resetLoadedTargetState]);

  const handleShellChange = (shellId: string) => {
    const nextTarget: TargetChangeIntent = { shellId, configPath: "" };
    if (isDirty) {
      setPendingTargetChange(nextTarget);
      setTargetDialogOpen(true);
      return;
    }
    applyTargetChange(nextTarget);
  };

  const handleConfigPathChange = (path: string) => {
    const nextTarget: TargetChangeIntent = { shellId: selectedShellId, configPath: path };
    if (isDirty) {
      setPendingTargetChange(nextTarget);
      setTargetDialogOpen(true);
      return;
    }
    applyTargetChange(nextTarget);
  };

  const refreshDerivedState = async (content: string, shellType: ShellType) => {
    const parsed = onParseConfigContent
      ? await onParseConfigContent(content, shellType)
      : await onFetchConfigEntries(selectedConfigPath, shellType);
    if (parsed) {
      setEntries(parsed);
    }
    if (onValidateConfigContent) {
      const validated = await onValidateConfigContent(content, shellType);
      setLiveDiagnostics(validated);
    }
  };

  const handleLoadConfig = async () => {
    if (!selectedConfigPath || !selectedShell) return;
    clearMutationFeedback();
    setLoading(true);
    setError(null);
    setConflictMessage(null);
    setSessionStatus("loading");
    try {
      const content = await onReadConfig(selectedConfigPath);
      setPersistedBaseline(content);
      setDraftContent(content);
      const parsed = onParseConfigContent
        ? await onParseConfigContent(content, selectedShell.shellType)
        : await onFetchConfigEntries(
            selectedConfigPath,
            selectedShell.shellType,
          );
      const parsedEntries = parsed ?? EMPTY_ENTRIES;
      setEntries(parsedEntries);
      setBaselineEntries(parsedEntries);
      if (onValidateConfigContent) {
        const validated = await onValidateConfigContent(content, selectedShell.shellType);
        setLiveDiagnostics(validated);
      } else {
        setLiveDiagnostics([]);
      }
      if (onGetConfigEditorMetadata) {
        const metadata = await onGetConfigEditorMetadata(
          selectedConfigPath,
          selectedShell.shellType,
        );
        setEditorMetadata(metadata);
      } else {
        setEditorMetadata(null);
      }
      setLoaded(true);
      setSessionStatus("loaded");
    } catch (e) {
      setError(String(e));
      setPersistedBaseline(null);
      setDraftContent("");
      setBaselineEntries(null);
      setEntries(null);
      setLiveDiagnostics([]);
      setEditorMetadata(null);
      setLoaded(false);
      setSessionStatus("error");
    } finally {
      setLoading(false);
    }
  };

  const handleCopyContent = async () => {
    if (persistedBaseline == null) return;
    try {
      await writeClipboard(persistedBaseline);
      toast.success(t("terminal.configCopied"));
    } catch {
      toast.error(t("terminal.configCopyFailed"));
    }
  };

  const handleBackup = async () => {
    if (!selectedConfigPath) return;
    await onBackupConfig(selectedConfigPath);
  };

  const refreshFromBackend = useCallback(async (
    scope: RefreshHandledResult = { configEntries: true, configMetadata: true },
  ): Promise<RefreshHandledResult> => {
    if (!selectedConfigPath || !selectedShell) {
      return { configEntries: false, configMetadata: false };
    }

    const handled: RefreshHandledResult = {
      configEntries: false,
      configMetadata: false,
    };

    if (scope.configEntries) {
      const refreshed = await onReadConfig(selectedConfigPath);
      setPersistedBaseline(refreshed);
      setDraftContent(refreshed);
      const parsed = onParseConfigContent
        ? await onParseConfigContent(refreshed, selectedShell.shellType)
        : await onFetchConfigEntries(selectedConfigPath, selectedShell.shellType);
      const parsedEntries = parsed ?? EMPTY_ENTRIES;
      setEntries(parsedEntries);
      setBaselineEntries(parsedEntries);
      if (onValidateConfigContent) {
        const validated = await onValidateConfigContent(refreshed, selectedShell.shellType);
        setLiveDiagnostics(validated);
      } else {
        setLiveDiagnostics([]);
      }
      handled.configEntries = true;
    }

    if (scope.configMetadata && onGetConfigEditorMetadata) {
      const metadata = await onGetConfigEditorMetadata(
        selectedConfigPath,
        selectedShell.shellType,
      );
      setEditorMetadata(metadata);
      handled.configMetadata = true;
    }

    return handled;
  }, [
    onFetchConfigEntries,
    onGetConfigEditorMetadata,
    onParseConfigContent,
    onReadConfig,
    onValidateConfigContent,
    selectedConfigPath,
    selectedShell,
  ]);

  const checkFingerprintConflict = async () => {
    if (!onGetConfigEditorMetadata || !selectedShell || !selectedConfigPath) {
      return false;
    }
    const currentFingerprint = editorMetadata?.fingerprint ?? null;
    if (!currentFingerprint) return false;

    const latestMetadata = await onGetConfigEditorMetadata(
      selectedConfigPath,
      selectedShell.shellType,
    );
    const latestFingerprint = latestMetadata?.fingerprint ?? null;
    if (!latestFingerprint || latestFingerprint === currentFingerprint) {
      return false;
    }

    setSessionStatus("conflict");
    setConflictMessage(
      t("terminal.configConflictMessage", {
        from: currentFingerprint.slice(0, 8),
        to: latestFingerprint.slice(0, 8),
      }),
    );
    return true;
  };

  const handleSaveDraft = async (force = false) => {
    if (!onWriteConfig || !selectedConfigPath || !selectedShell) return false;
    if (!force) {
      const conflicted = await checkFingerprintConflict();
      if (conflicted) return false;
    }
    setSessionStatus("saving");
    const writeResult = await onWriteConfig(
      selectedConfigPath,
      draftContent,
      selectedShell.shellType,
    );
    if (writeResult && writeResult.verified === false) {
      setSessionStatus("error");
      return false;
    }
    await refreshFromBackend();
    setEditing(false);
    setConflictMessage(null);
    setSessionStatus("loaded");
    return true;
  };

  const handleRestoreSnapshot = async () => {
    if (!onRestoreConfigSnapshot || !selectedConfigPath) return;
    setSessionStatus("saving");
    const restored = await onRestoreConfigSnapshot(selectedConfigPath);
    if (!restored) {
      setSessionStatus("error");
      return;
    }
    await refreshFromBackend();
    setEditing(false);
    setConflictMessage(null);
    setSessionStatus("loaded");
  };

  const handleDraftChange = (next: string) => {
    setDraftContent(next);
    setSessionStatus("editing");
    if (conflictMessage) {
      setConflictMessage(null);
    }
    if (selectedShell) {
      void refreshDerivedState(next, selectedShell.shellType);
    }
  };

  const handleStructuredEntriesChange = (next: ShellConfigEntries) => {
    if (!selectedShell) return;
    const nextContent = serializeEntries(next, selectedShell.shellType);
    setEntries(next);
    setDraftContent(nextContent);
    setSessionStatus("editing");
    void refreshDerivedState(nextContent, selectedShell.shellType);
  };

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  useEffect(() => {
    if (discardSignal === lastDiscardSignal) return;
    setLastDiscardSignal(discardSignal);
    clearMutationFeedback();
    setEditing(false);
    if (persistedBaseline != null) {
      setDraftContent(persistedBaseline);
    }
    if (pendingTargetChange) {
      setPendingTargetChange(null);
      applyTargetChange(pendingTargetChange);
    }
  }, [
    applyTargetChange,
    clearMutationFeedback,
    discardSignal,
    lastDiscardSignal,
    pendingTargetChange,
    persistedBaseline,
  ]);

  useEffect(() => {
    if (refreshIntent.signal === lastRefreshSignal) return;
    setLastRefreshSignal(refreshIntent.signal);
    if (!loaded || !selectedConfigPath || !selectedShell) {
      onRefreshHandled?.({ configEntries: false, configMetadata: false });
      return;
    }
    if (!refreshIntent.configEntries && !refreshIntent.configMetadata) {
      onRefreshHandled?.({ configEntries: false, configMetadata: false });
      return;
    }
    void refreshFromBackend({
      configEntries: refreshIntent.configEntries,
      configMetadata: refreshIntent.configMetadata,
    })
      .then((handled) => onRefreshHandled?.(handled))
      .catch(() => onRefreshHandled?.({ configEntries: false, configMetadata: false }));
  }, [
    loaded,
    onRefreshHandled,
    refreshFromBackend,
    refreshIntent,
    lastRefreshSignal,
    selectedConfigPath,
    selectedShell,
  ]);

  if (shells.length === 0) return null;

  return (
    <>
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("terminal.shellConfig")}</CardTitle>
        <CardDescription>{t("terminal.shellConfigDesc")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{t("terminal.sessionLabel", { status: sessionStatusLabel })}</Badge>
          {isDirty && <Badge variant="secondary">{t("terminal.unsavedDraft")}</Badge>}
        </div>

        <div className="flex gap-3">
          <Select value={selectedShellId} onValueChange={handleShellChange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder={t("terminal.selectShell")} />
            </SelectTrigger>
            <SelectContent>
              {shells.map((shell) => (
                <SelectItem key={shell.id} value={shell.id}>
                  {shell.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {configFiles.length > 0 && (
            <Select
              value={selectedConfigPath}
              onValueChange={handleConfigPathChange}
            >
              <SelectTrigger className="flex-1">
                <SelectValue placeholder={t("terminal.selectConfigFile")} />
              </SelectTrigger>
              <SelectContent>
                {configFiles.map((cf) => (
                  <SelectItem key={cf.path} value={cf.path}>
                    <span className="font-mono text-xs">{cf.path}</span>
                    <span className="ml-2 text-muted-foreground text-xs">
                      ({(cf.sizeBytes / 1024).toFixed(1)} KB)
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <Button
            size="sm"
            onClick={handleLoadConfig}
            disabled={!selectedConfigPath || loading}
          >
            <RefreshCw className="h-3.5 w-3.5 mr-1" />
            {t("terminal.loadConfig")}
          </Button>
        </div>

        {configFiles.length === 0 && selectedShellId && (
          <Empty className="border-dashed py-5">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <FileText />
              </EmptyMedia>
              <EmptyTitle className="text-sm font-normal text-muted-foreground">
                {t("terminal.noConfigFiles")}
              </EmptyTitle>
            </EmptyHeader>
          </Empty>
        )}

        {conflictMessage && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>{t("terminal.conflictDetected")}</AlertTitle>
            <AlertDescription className="space-y-2">
              <p>{conflictMessage}</p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={handleLoadConfig}>
                  {t("terminal.reloadFromDisk")}
                </Button>
                {editing && onWriteConfig && (
                  <Button size="sm" onClick={() => void handleSaveDraft(true)}>
                    {t("terminal.saveAnyway")}
                  </Button>
                )}
              </div>
            </AlertDescription>
          </Alert>
        )}

        {error && !loading && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <AlertTitle>{t("terminal.shellConfig")}</AlertTitle>
            <AlertDescription className="flex flex-wrap items-center gap-2">
              <span className="break-all">{error}</span>
              <Button
                size="sm"
                variant="outline"
                className="ml-auto shrink-0"
                onClick={handleLoadConfig}
              >
                {t("terminal.loadConfig")}
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {mutationStatus !== "idle" && mutationMessage && (
          <div
            className={[
              "space-y-2 rounded-md border p-3 text-sm",
              mutationStatus === "success"
                ? "border-emerald-600/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                : "border-destructive/50 bg-destructive/10 text-destructive",
            ].join(" ")}
          >
            <div className="flex items-center gap-2">
              {mutationStatus === "error" && <AlertCircle className="h-4 w-4 shrink-0" />}
              <span className="break-all">{mutationMessage}</span>
              {mutationStatus === "error" && editing && onWriteConfig && (
                <Button
                  size="sm"
                  variant="outline"
                  className="ml-auto shrink-0"
                  onClick={() => void handleSaveDraft()}
                >
                  {t("terminal.retryFailed")}
                </Button>
              )}
              {onClearMutationState && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="ml-auto shrink-0"
                  onClick={onClearMutationState}
                >
                  {t("terminal.cancel")}
                </Button>
              )}
            </div>

            {mutationResult && (
              <div className="rounded-md border border-border/60 bg-background/60 p-2 text-xs">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">
                    {t("terminal.resultVerified", { value: String(mutationResult.verified) })}
                  </Badge>
                  {getResultSnapshotPath(mutationResult) && (
                    <Badge variant="secondary">
                      {t("terminal.resultSnapshot", { value: getResultSnapshotPath(mutationResult)! })}
                    </Badge>
                  )}
                  {getResultFingerprint(mutationResult) && (
                    <Badge variant="secondary">
                      {t("terminal.resultFingerprint", { value: getResultFingerprint(mutationResult)! })}
                    </Badge>
                  )}
                </div>
                {mutationResult.diagnostics.length > 0 && (
                  <ul className="mt-2 list-disc space-y-1 pl-4">
                    {mutationResult.diagnostics.map((item, index) => (
                      <li key={`${item}-${index}`}>{item}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}

        {loading && (
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        )}

        {entries && !loading && (
          <Accordion
            type="multiple"
            defaultValue={["aliases", "exports", "sources"]}
          >
            {entries.aliases.length > 0 && (
              <AccordionItem value="aliases">
                <AccordionTrigger className="py-3">
                  <span className="flex items-center gap-2 text-sm">
                    {t("terminal.aliases")}
                    <Badge variant="secondary">{entries.aliases.length}</Badge>
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="rounded-md border">
                    <ScrollArea className="max-h-[200px]">
                      <div className="p-2 space-y-1">
                        {entries.aliases.map(([name, value], i) => (
                          <div
                            key={i}
                            className="flex items-center gap-2 text-xs font-mono"
                          >
                            <span className="text-primary font-semibold min-w-[100px]">
                              {name}
                            </span>
                            <span className="text-muted-foreground">=</span>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="truncate cursor-default">
                                  {value}
                                </span>
                              </TooltipTrigger>
                              {value.length > 40 && (
                                <TooltipContent
                                  side="bottom"
                                  className="max-w-sm font-mono text-xs break-all"
                                >
                                  {value}
                                </TooltipContent>
                              )}
                            </Tooltip>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                </AccordionContent>
              </AccordionItem>
            )}

            {entries.exports.length > 0 && (
              <AccordionItem value="exports">
                <AccordionTrigger className="py-3">
                  <span className="flex items-center gap-2 text-sm">
                    {t("terminal.envExports")}
                    <Badge variant="secondary">{entries.exports.length}</Badge>
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="rounded-md border">
                    <ScrollArea className="max-h-[200px]">
                      <div className="p-2 space-y-1">
                        {entries.exports.map(([key, value], i) => (
                          <div
                            key={i}
                            className="flex items-center gap-2 text-xs font-mono"
                          >
                            <span className="text-primary font-semibold min-w-[100px]">
                              {key}
                            </span>
                            <span className="text-muted-foreground">=</span>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="truncate cursor-default">
                                  {value}
                                </span>
                              </TooltipTrigger>
                              {value.length > 40 && (
                                <TooltipContent
                                  side="bottom"
                                  className="max-w-sm font-mono text-xs break-all"
                                >
                                  {value}
                                </TooltipContent>
                              )}
                            </Tooltip>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                </AccordionContent>
              </AccordionItem>
            )}

            {entries.sources.length > 0 && (
              <AccordionItem value="sources">
                <AccordionTrigger className="py-3">
                  <span className="flex items-center gap-2 text-sm">
                    {t("terminal.sources")}
                    <Badge variant="secondary">{entries.sources.length}</Badge>
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="rounded-md border p-2 space-y-1">
                    {entries.sources.map((src, i) => (
                      <div
                        key={i}
                        className="text-xs font-mono flex items-center gap-2"
                      >
                        <FileText className="h-3 w-3 text-muted-foreground shrink-0" />
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="truncate cursor-default">
                              {src}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent
                            side="bottom"
                            className="max-w-sm font-mono text-xs break-all"
                          >
                            {src}
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            )}
          </Accordion>
        )}

        {loaded && persistedBaseline != null && !loading && (
          <>
            <Separator />
            <div className="space-y-3">
              {editing && (
                <TerminalConfigEditor
                  value={draftContent}
                  onChange={handleDraftChange}
                  language={effectiveLanguage}
                  diagnostics={diagnostics}
                  baselineValue={persistedBaseline}
                  shellType={selectedShell?.shellType ?? null}
                  configPath={editorMetadata?.path ?? selectedConfigPath}
                  snapshotPath={
                    editorMetadata?.snapshotPath ??
                    getResultSnapshotPath(mutationResult) ??
                    null
                  }
                  fingerprint={
                    editorMetadata?.fingerprint ??
                    getResultFingerprint(mutationResult) ??
                    null
                  }
                  structuredEntries={entries}
                  structuredFallbackReason={structuredFallbackReason}
                  onStructuredEntriesChange={handleStructuredEntriesChange}
                />
              )}

              <div className="flex gap-2 flex-wrap">
                <Button size="sm" variant="outline" onClick={handleCopyContent}>
                  <Copy className="h-3.5 w-3.5 mr-1" />
                  {t("terminal.copyConfig")}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isBusy}
                  onClick={handleBackup}
                >
                  <FileText className="h-3.5 w-3.5 mr-1" />
                  {t("terminal.backupConfig")}
                </Button>
                {onWriteConfig && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isBusy}
                    onClick={() => {
                      if (editing) {
                        setEditing(false);
                        setDraftContent(persistedBaseline);
                        setEntries(baselineEntries);
                        setSessionStatus("loaded");
                        clearMutationFeedback();
                      } else {
                        setDraftContent(persistedBaseline);
                        setEntries(baselineEntries);
                        setEditing(true);
                        setSessionStatus("editing");
                      }
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5 mr-1" />
                    {editing ? t("terminal.cancel") : t("terminal.editConfig")}
                  </Button>
                )}
                {editing && onWriteConfig && (
                  <Button
                    size="sm"
                    disabled={isBusy}
                    onClick={() => setSaveDialogOpen(true)}
                  >
                    <Save className="h-3.5 w-3.5 mr-1" />
                    {t("terminal.saveConfig")}
                  </Button>
                )}
                {onRestoreConfigSnapshot && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isBusy || !selectedConfigPath}
                    onClick={() => void handleRestoreSnapshot()}
                  >
                    <RotateCcw className="h-3.5 w-3.5 mr-1" />
                    {t("terminal.restoreSnapshot")}
                  </Button>
                )}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
      <Dialog open={targetDialogOpen} onOpenChange={setTargetDialogOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("terminal.unsavedDraft")}</DialogTitle>
          <DialogDescription>
            {t("terminal.unsavedDraftSwitchDesc")}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => {
              setPendingTargetChange(null);
              setTargetDialogOpen(false);
            }}
          >
            {t("terminal.stay")}
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              if (pendingTargetChange) {
                applyTargetChange(pendingTargetChange);
              }
              setPendingTargetChange(null);
              setTargetDialogOpen(false);
            }}
          >
            {t("terminal.discardAndSwitch")}
          </Button>
          <Button
            disabled={!onWriteConfig || switchSaving}
            onClick={async () => {
              if (!pendingTargetChange) return;
              setSwitchSaving(true);
              const saved = await handleSaveDraft();
              setSwitchSaving(false);
              if (!saved) return;
              applyTargetChange(pendingTargetChange);
              setPendingTargetChange(null);
              setTargetDialogOpen(false);
            }}
          >
            {t("terminal.saveAndSwitch")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("terminal.savePreflightTitle")}</DialogTitle>
          <DialogDescription>
            {t("terminal.savePreflightDesc")}
          </DialogDescription>
        </DialogHeader>
        {preflightSummary && (
          <div className="space-y-3 text-sm">
            <div className="rounded-md border p-2">
              <p>{t("terminal.preflightLineDelta", {
                value: `${preflightSummary.lineDelta >= 0 ? "+" : ""}${preflightSummary.lineDelta}`,
              })}</p>
              <p>
                {t("terminal.preflightChangedCategories")}:{" "}
                {preflightSummary.changedCategories.length > 0
                  ? preflightSummary.changedCategories.map((category) => {
                      switch (category) {
                        case "aliases":
                          return t("terminal.aliases");
                        case "exports":
                          return t("terminal.envExports");
                        case "sources":
                          return t("terminal.sources");
                      }
                    }).join(", ")
                  : t("terminal.preflightNone")}
              </p>
            </div>
            {preflightSummary.riskFlags.length > 0 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>{t("terminal.preflightHighRiskPatterns")}</AlertTitle>
                <AlertDescription>
                  <ul className="list-disc space-y-1 pl-4">
                    {preflightSummary.riskFlags.map((risk) => (
                      <li key={risk}>
                        {risk === "destructiveRootDelete" && t("terminal.preflightRiskDestructiveRootDelete")}
                        {risk === "pathOverwrite" && t("terminal.preflightRiskPathOverwrite")}
                        {risk === "sourceSystemProfile" && t("terminal.preflightRiskSourceSystemProfile")}
                      </li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>
            {t("terminal.cancel")}
          </Button>
          <Button
            onClick={async () => {
              const saved = await handleSaveDraft();
              if (saved) {
                setSaveDialogOpen(false);
              }
            }}
          >
            {t("terminal.confirmSave")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
