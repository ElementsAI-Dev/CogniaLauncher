"use client";

import { useState } from "react";
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
  TerminalConfigEditorMetadata,
  TerminalConfigMutationResult,
  TerminalConfigRestoreResult,
} from "@/types/tauri";
import { useLocale } from "@/components/providers/locale-provider";
import { toast } from "sonner";

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
  mutationResult?: TerminalConfigMutationResult | null;
  onClearMutationState?: () => void;
}

export function TerminalShellConfig({
  shells,
  onReadConfig,
  onFetchConfigEntries,
  onParseConfigContent,
  onBackupConfig,
  onWriteConfig,
  onGetConfigEditorMetadata,
  onRestoreConfigSnapshot,
  mutationStatus = "idle",
  mutationMessage = null,
  mutationResult = null,
  onClearMutationState,
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
  const [editing, setEditing] = useState(false);
  const [entries, setEntries] = useState<ShellConfigEntries | null>(null);
  const [editorMetadata, setEditorMetadata] =
    useState<TerminalConfigEditorMetadata | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const selectedShell = shells.find((s) => s.id === selectedShellId);
  const configFiles = selectedShell?.configFiles.filter((f) => f.exists) ?? [];
  const diagnostics = mutationResult?.diagnosticDetails ?? [];
  const effectiveLanguage =
    editorMetadata?.language ??
    (selectedShell
      ? getTerminalEditorLanguage(selectedShell.shellType)
      : "plaintext");
  const isBusy = loading || mutationStatus === "loading";

  const clearMutationFeedback = () => {
    onClearMutationState?.();
  };

  const resetLoadedTargetState = () => {
    setPersistedBaseline(null);
    setDraftContent("");
    setEditing(false);
    setEntries(null);
    setEditorMetadata(null);
    setError(null);
    setLoaded(false);
  };

  const handleShellChange = (shellId: string) => {
    setSelectedShellId(shellId);
    setSelectedConfigPath("");
    clearMutationFeedback();
    resetLoadedTargetState();
  };

  const handleConfigPathChange = (path: string) => {
    setSelectedConfigPath(path);
    clearMutationFeedback();
    resetLoadedTargetState();
  };

  const handleLoadConfig = async () => {
    if (!selectedConfigPath || !selectedShell) return;
    clearMutationFeedback();
    setLoading(true);
    setError(null);
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
      setEntries(parsed);
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
    } catch (e) {
      setError(String(e));
      setPersistedBaseline(null);
      setDraftContent("");
      setEntries(null);
      setEditorMetadata(null);
      setLoaded(false);
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

  const refreshFromBackend = async () => {
    if (!selectedConfigPath || !selectedShell) return;
    const refreshed = await onReadConfig(selectedConfigPath);
    setPersistedBaseline(refreshed);
    setDraftContent(refreshed);
    const parsed = onParseConfigContent
      ? await onParseConfigContent(refreshed, selectedShell.shellType)
      : await onFetchConfigEntries(selectedConfigPath, selectedShell.shellType);
    setEntries(parsed);
    if (onGetConfigEditorMetadata) {
      const metadata = await onGetConfigEditorMetadata(
        selectedConfigPath,
        selectedShell.shellType,
      );
      setEditorMetadata(metadata);
    }
  };

  const handleSaveDraft = async () => {
    if (!onWriteConfig || !selectedConfigPath || !selectedShell) return;
    const writeResult = await onWriteConfig(
      selectedConfigPath,
      draftContent,
      selectedShell.shellType,
    );
    if (writeResult && writeResult.verified === false) {
      return;
    }
    await refreshFromBackend();
    setEditing(false);
  };

  const handleRestoreSnapshot = async () => {
    if (!onRestoreConfigSnapshot || !selectedConfigPath) return;
    const restored = await onRestoreConfigSnapshot(selectedConfigPath);
    if (!restored) return;
    await refreshFromBackend();
    setEditing(false);
  };

  if (shells.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("terminal.shellConfig")}</CardTitle>
        <CardDescription>{t("terminal.shellConfigDesc")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
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
          <p className="text-sm text-muted-foreground">
            {t("terminal.noConfigFiles")}
          </p>
        )}

        {error && !loading && (
          <div className="flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span className="break-all">{error}</span>
            <Button
              size="sm"
              variant="outline"
              className="ml-auto shrink-0"
              onClick={handleLoadConfig}
            >
              {t("terminal.loadConfig")}
            </Button>
          </div>
        )}

        {mutationStatus === "success" && mutationMessage && (
          <div className="flex items-center gap-2 rounded-md border border-emerald-600/20 bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-300">
            <span className="break-all">{mutationMessage}</span>
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
        )}

        {mutationStatus === "error" && mutationMessage && (
          <div className="flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span className="break-all">{mutationMessage}</span>
            {editing && onWriteConfig ? (
              <Button
                size="sm"
                variant="outline"
                className="ml-auto shrink-0"
                onClick={() => void handleSaveDraft()}
              >
                {t("terminal.retryFailed")}
              </Button>
            ) : (
              <Button
                size="sm"
                variant="outline"
                className="ml-auto shrink-0"
                onClick={handleLoadConfig}
              >
                {t("terminal.loadConfig")}
              </Button>
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
                  onChange={setDraftContent}
                  language={effectiveLanguage}
                  diagnostics={diagnostics}
                  baselineValue={persistedBaseline}
                  shellType={selectedShell?.shellType ?? null}
                  configPath={editorMetadata?.path ?? selectedConfigPath}
                  snapshotPath={
                    editorMetadata?.snapshotPath ??
                    mutationResult?.snapshotPath ??
                    null
                  }
                  fingerprint={
                    editorMetadata?.fingerprint ??
                    mutationResult?.fingerprint ??
                    null
                  }
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
                        clearMutationFeedback();
                      } else {
                        setDraftContent(persistedBaseline);
                        setEditing(true);
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
                    onClick={() => void handleSaveDraft()}
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
                    Restore Snapshot
                  </Button>
                )}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
