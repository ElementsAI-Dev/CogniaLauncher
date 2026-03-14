"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  HardDrive,
  Trash2,
  RefreshCw,
  FolderOpen,
  Download,
  FileCode,
  Loader2,
  Copy,
} from "lucide-react";
import { toast } from "sonner";
import { isTauri } from "@/lib/tauri";
import { useGo } from "@/hooks/use-go";
import { cn } from "@/lib/utils";

function EnvRow({ label, value }: { label: string; value: string }) {
  const handleCopy = () => {
    if (value) {
      navigator.clipboard.writeText(value);
      toast.success(`Copied ${label}`);
    }
  };

  return (
    <div className="group flex items-center justify-between gap-4 py-1.5">
      <span className="text-muted-foreground shrink-0 text-sm font-medium">
        {label}
      </span>
      <div className="flex min-w-0 items-center gap-1.5">
        <span
          className="truncate text-sm font-mono"
          title={value || "(not set)"}
        >
          {value || <span className="text-muted-foreground italic">not set</span>}
        </span>
        {value && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={handleCopy}
          >
            <Copy className="h-3 w-3" />
          </Button>
        )}
      </div>
    </div>
  );
}

export function GoToolsPanel() {
  const {
    envInfo,
    cacheInfo,
    loading,
    error,
    fetchEnvInfo,
    fetchCacheInfo,
    modTidy,
    modDownload,
    cleanCache,
    refreshAll,
  } = useGo();

  const [projectPath, setProjectPath] = useState("");
  const [operationResult, setOperationResult] = useState<string | null>(null);
  const [cleaningBuild, setCleaningBuild] = useState(false);
  const [cleaningMod, setCleaningMod] = useState(false);
  const [runningTidy, setRunningTidy] = useState(false);
  const [runningDownload, setRunningDownload] = useState(false);

  useEffect(() => {
    if (isTauri()) {
      refreshAll();
    }
  }, [refreshAll]);

  const handleCleanCache = async (cacheType: string) => {
    const setter = cacheType === "build" ? setCleaningBuild : setCleaningMod;
    setter(true);
    try {
      const result = await cleanCache(cacheType);
      toast.success(result || `${cacheType} cache cleaned`);
      await fetchCacheInfo();
    } catch {
      toast.error(`Failed to clean ${cacheType} cache`);
    } finally {
      setter(false);
    }
  };

  const handleModTidy = async () => {
    const path = projectPath.trim() || ".";
    setRunningTidy(true);
    setOperationResult(null);
    try {
      const result = await modTidy(path);
      setOperationResult(result || "go mod tidy completed successfully");
      toast.success("go mod tidy completed");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setOperationResult(`Error: ${msg}`);
      toast.error("go mod tidy failed");
    } finally {
      setRunningTidy(false);
    }
  };

  const handleModDownload = async () => {
    const path = projectPath.trim() || ".";
    setRunningDownload(true);
    setOperationResult(null);
    try {
      const result = await modDownload(path);
      setOperationResult(result || "go mod download completed successfully");
      toast.success("go mod download completed");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setOperationResult(`Error: ${msg}`);
      toast.error("go mod download failed");
    } finally {
      setRunningDownload(false);
    }
  };

  if (!isTauri()) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Go Tools</CardTitle>
          <CardDescription>
            Go tools are only available in the desktop app.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const totalSize =
    cacheInfo != null
      ? cacheInfo.buildCacheSize + cacheInfo.modCacheSize
      : null;

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024)
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-destructive/10 text-destructive rounded-md p-3 text-sm">
          {error}
        </div>
      )}

      {/* Go Environment Info */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <HardDrive className="h-4 w-4" />
              Go Environment
            </CardTitle>
            <CardDescription>Go environment variables and configuration</CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchEnvInfo()}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="mr-1 h-3.5 w-3.5" />
            )}
            Refresh
          </Button>
        </CardHeader>
        <CardContent>
          {envInfo ? (
            <div className="grid gap-0.5 sm:grid-cols-2">
              <div className="space-y-0.5">
                <EnvRow label="GOROOT" value={envInfo.goroot} />
                <EnvRow label="GOPATH" value={envInfo.gopath} />
                <EnvRow label="GOBIN" value={envInfo.gobin} />
                <EnvRow label="GOPROXY" value={envInfo.goproxy} />
                <EnvRow label="GOPRIVATE" value={envInfo.goprivate} />
                <EnvRow label="GONOSUMDB" value={envInfo.gonosumdb} />
              </div>
              <div className="space-y-0.5">
                <EnvRow label="GOTOOLCHAIN" value={envInfo.gotoolchain} />
                <EnvRow label="GOVERSION" value={envInfo.goversion} />
                <EnvRow label="GOOS" value={envInfo.goos} />
                <EnvRow label="GOARCH" value={envInfo.goarch} />
                <EnvRow label="CGO_ENABLED" value={envInfo.cgoEnabled} />
                <EnvRow label="GOFLAGS" value={envInfo.goflags} />
              </div>
            </div>
          ) : (
            <div className="text-muted-foreground flex items-center gap-2 py-4 text-sm">
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading environment info...
                </>
              ) : (
                "No environment info available. Click Refresh."
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cache Management */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <HardDrive className="h-4 w-4" />
              Cache Management
            </CardTitle>
            <CardDescription>Build and module cache sizes</CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchCacheInfo()}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="mr-1 h-3.5 w-3.5" />
            )}
            Refresh
          </Button>
        </CardHeader>
        <CardContent>
          {cacheInfo ? (
            <div className="space-y-3">
              {/* Build cache */}
              <div className="flex items-center justify-between">
                <div className="min-w-0 space-y-0.5">
                  <div className="text-sm font-medium">Build Cache</div>
                  <div
                    className="text-muted-foreground truncate text-xs font-mono"
                    title={cacheInfo.buildCachePath}
                  >
                    {cacheInfo.buildCachePath}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">
                    {cacheInfo.buildCacheSizeHuman}
                  </Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleCleanCache("build")}
                    disabled={cleaningBuild}
                  >
                    {cleaningBuild ? (
                      <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="mr-1 h-3.5 w-3.5" />
                    )}
                    Clean
                  </Button>
                </div>
              </div>

              <Separator />

              {/* Module cache */}
              <div className="flex items-center justify-between">
                <div className="min-w-0 space-y-0.5">
                  <div className="text-sm font-medium">Module Cache</div>
                  <div
                    className="text-muted-foreground truncate text-xs font-mono"
                    title={cacheInfo.modCachePath}
                  >
                    {cacheInfo.modCachePath}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">
                    {cacheInfo.modCacheSizeHuman}
                  </Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleCleanCache("mod")}
                    disabled={cleaningMod}
                  >
                    {cleaningMod ? (
                      <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="mr-1 h-3.5 w-3.5" />
                    )}
                    Clean
                  </Button>
                </div>
              </div>

              <Separator />

              {/* Total */}
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Total</span>
                <Badge variant="outline">
                  {totalSize != null ? formatBytes(totalSize) : "—"}
                </Badge>
              </div>
            </div>
          ) : (
            <div className="text-muted-foreground flex items-center gap-2 py-4 text-sm">
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading cache info...
                </>
              ) : (
                "No cache info available. Click Refresh."
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Module Operations */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileCode className="h-4 w-4" />
            Module Operations
          </CardTitle>
          <CardDescription>
            Run go module commands on a project directory
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="go-project-path">Project Path</Label>
            <div className="flex gap-2">
              <Input
                id="go-project-path"
                placeholder="Leave empty for current directory"
                value={projectPath}
                onChange={(e) => setProjectPath(e.target.value)}
              />
              <Button
                variant="outline"
                size="icon"
                title="Browse"
                className="shrink-0"
                onClick={() => {
                  // Optionally integrate with file picker in the future
                  toast.info("Enter a path or leave empty for current directory");
                }}
              >
                <FolderOpen className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleModTidy}
              disabled={runningTidy || runningDownload}
            >
              {runningTidy ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <FileCode className="mr-1.5 h-3.5 w-3.5" />
              )}
              go mod tidy
            </Button>
            <Button
              variant="outline"
              onClick={handleModDownload}
              disabled={runningTidy || runningDownload}
            >
              {runningDownload ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Download className="mr-1.5 h-3.5 w-3.5" />
              )}
              go mod download
            </Button>
          </div>

          {operationResult && (
            <pre
              className={cn(
                "rounded-md border p-3 text-xs font-mono whitespace-pre-wrap max-h-48 overflow-auto",
                operationResult.startsWith("Error")
                  ? "bg-destructive/10 text-destructive border-destructive/20"
                  : "bg-muted"
              )}
            >
              {operationResult}
            </pre>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
