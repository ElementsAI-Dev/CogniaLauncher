"use client";

import { useState, useCallback, useRef } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Terminal,
  Play,
  Search,
  FileCode,
  Loader2,
  Copy,
  Trash2,
  Info,
} from "lucide-react";
import { useLaunch } from "@/hooks/use-launch";
import { isTauri } from "@/lib/tauri";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface EnvDetailShellProps {
  envType: string;
  currentVersion?: string | null;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export function EnvDetailShell({
  envType,
  currentVersion,
  t,
}: EnvDetailShellProps) {
  const {
    loading,
    error,
    lastResult,
    streamingOutput,
    execShellWithEnv,
    getActivationScript,
    getEnvInfo,
    whichProgram,
    clearOutput,
  } = useLaunch();

  const [command, setCommand] = useState("");
  const [whichQuery, setWhichQuery] = useState("");
  const [whichResult, setWhichResult] = useState<string | null>(null);
  const [activationScript, setActivationScript] = useState<string | null>(null);
  const [envInfo, setEnvInfo] = useState<Record<string, string> | null>(null);
  const [loadingScript, setLoadingScript] = useState(false);
  const [loadingInfo, setLoadingInfo] = useState(false);
  const outputEndRef = useRef<HTMLDivElement>(null);

  const handleExecCommand = useCallback(async () => {
    if (!command.trim()) return;
    await execShellWithEnv(
      command.trim(),
      envType,
      currentVersion || undefined
    );
    outputEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [command, envType, currentVersion, execShellWithEnv]);

  const handleWhich = useCallback(async () => {
    if (!whichQuery.trim()) return;
    const result = await whichProgram(
      whichQuery.trim(),
      envType,
      currentVersion || undefined
    );
    setWhichResult(result);
  }, [whichQuery, envType, currentVersion, whichProgram]);

  const handleGetActivationScript = useCallback(async () => {
    setLoadingScript(true);
    try {
      const script = await getActivationScript(
        envType,
        currentVersion || undefined
      );
      if (script) {
        setActivationScript(script.script);
      }
    } finally {
      setLoadingScript(false);
    }
  }, [envType, currentVersion, getActivationScript]);

  const handleGetEnvInfo = useCallback(async () => {
    if (!currentVersion) return;
    setLoadingInfo(true);
    try {
      const info = await getEnvInfo(envType, currentVersion);
      if (info) {
        setEnvInfo(info.envVars || null);
      }
    } finally {
      setLoadingInfo(false);
    }
  }, [envType, currentVersion, getEnvInfo]);

  const handleCopy = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(t("common.copied"));
    } catch {
      toast.error(t("common.copyFailed"));
    }
  }, [t]);

  if (!isTauri()) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Terminal className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <h3 className="text-lg font-medium">
          {t("environments.shell.desktopOnly")}
        </h3>
        <p className="text-sm mt-1">
          {t("environments.shell.desktopOnlyDesc")}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Quick Execute */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Terminal className="h-4 w-4" />
            {t("environments.shell.executeTitle")}
          </CardTitle>
          <CardDescription>
            {t("environments.shell.executeDesc", { envType })}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input
              placeholder={t("environments.shell.commandPlaceholder")}
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleExecCommand();
              }}
              className="flex-1 font-mono text-sm"
            />
            <Button
              onClick={handleExecCommand}
              disabled={!command.trim() || loading}
              className="gap-1.5"
            >
              {loading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Play className="h-3.5 w-3.5" />
              )}
              {t("environments.shell.run")}
            </Button>
          </div>

          {currentVersion && (
            <p className="text-xs text-muted-foreground">
              {t("environments.shell.runningWith", {
                envType,
                version: currentVersion,
              })}
            </p>
          )}

          {/* Output */}
          {(lastResult || streamingOutput.length > 0 || error) && (
            <div className="relative">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted-foreground">
                  {t("environments.shell.output")}
                </span>
                <div className="flex gap-1">
                  {lastResult?.stdout && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => handleCopy(lastResult.stdout || "")}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={clearOutput}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              <ScrollArea className="h-[200px] rounded-md border bg-black/95 p-3">
                <pre className="text-xs font-mono text-green-400 whitespace-pre-wrap break-all">
                  {streamingOutput.length > 0
                    ? streamingOutput.map((o) => o.data).join("")
                    : lastResult?.stdout || ""}
                </pre>
                {lastResult?.stderr && (
                  <pre className="text-xs font-mono text-red-400 whitespace-pre-wrap break-all mt-1">
                    {lastResult.stderr}
                  </pre>
                )}
                {error && (
                  <pre className="text-xs font-mono text-red-400 whitespace-pre-wrap break-all">
                    {error}
                  </pre>
                )}
                {lastResult && (
                  <div className="mt-2 pt-2 border-t border-white/10">
                    <Badge
                      variant={
                        lastResult.exitCode === 0 ? "default" : "destructive"
                      }
                      className="text-xs"
                    >
                      exit: {lastResult.exitCode}
                    </Badge>
                  </div>
                )}
                <div ref={outputEndRef} />
              </ScrollArea>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Which Program */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Search className="h-4 w-4" />
            {t("environments.shell.whichTitle")}
          </CardTitle>
          <CardDescription>
            {t("environments.shell.whichDesc")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input
              placeholder={t("environments.shell.whichPlaceholder")}
              value={whichQuery}
              onChange={(e) => setWhichQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleWhich();
              }}
              className="flex-1 font-mono text-sm"
            />
            <Button
              variant="outline"
              onClick={handleWhich}
              disabled={!whichQuery.trim() || loading}
              className="gap-1.5"
            >
              <Search className="h-3.5 w-3.5" />
              {t("environments.shell.lookup")}
            </Button>
          </div>
          {whichResult !== null && (
            <div className="flex items-center gap-2 p-2 rounded-md bg-muted/50">
              <code className="text-xs font-mono flex-1 break-all">
                {whichResult || t("environments.shell.notFound")}
              </code>
              {whichResult && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 shrink-0"
                  onClick={() => handleCopy(whichResult)}
                >
                  <Copy className="h-3 w-3" />
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Activation Script & Environment Info */}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <FileCode className="h-4 w-4" />
              {t("environments.shell.activationScript")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {activationScript ? (
              <div className="relative">
                <ScrollArea className="h-[150px] rounded-md border bg-muted/50 p-2">
                  <pre className="text-xs font-mono whitespace-pre-wrap break-all">
                    {activationScript}
                  </pre>
                </ScrollArea>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-1 right-1 h-6 w-6"
                  onClick={() => handleCopy(activationScript)}
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={handleGetActivationScript}
                disabled={loadingScript}
                className="w-full gap-1.5"
              >
                {loadingScript ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <FileCode className="h-3.5 w-3.5" />
                )}
                {t("environments.shell.loadScript")}
              </Button>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Info className="h-4 w-4" />
              {t("environments.shell.envInfoTitle")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {envInfo ? (
              <ScrollArea className="h-[150px]">
                <div className="space-y-1">
                  {Object.entries(envInfo).map(([key, value]) => (
                    <div
                      key={key}
                      className={cn(
                        "flex items-start gap-2 p-1.5 rounded text-xs",
                        "hover:bg-muted/50"
                      )}
                    >
                      <code className="font-mono font-medium shrink-0 text-primary">
                        {key}
                      </code>
                      <span className="text-muted-foreground">=</span>
                      <code className="font-mono break-all text-muted-foreground">
                        {value}
                      </code>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={handleGetEnvInfo}
                disabled={loadingInfo || !currentVersion}
                className="w-full gap-1.5"
              >
                {loadingInfo ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Info className="h-3.5 w-3.5" />
                )}
                {t("environments.shell.loadEnvInfo")}
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
