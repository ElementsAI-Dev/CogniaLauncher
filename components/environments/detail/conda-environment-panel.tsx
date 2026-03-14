"use client";

import { useEffect, useState, useCallback } from "react";
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
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Plus,
  Trash2,
  Copy,
  Download,
  Upload,
  RefreshCw,
  Settings,
  Database,
  Loader2,
  ChevronDown,
  X,
  Edit,
} from "lucide-react";
import { toast } from "sonner";
import { isTauri } from "@/lib/tauri";
import { useConda } from "@/hooks/use-conda";
import { cn } from "@/lib/utils";

export function CondaEnvironmentPanel() {
  const conda = useConda();

  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createPython, setCreatePython] = useState("");
  const [createPackages, setCreatePackages] = useState("");

  const [cloneOpen, setCloneOpen] = useState(false);
  const [cloneSource, setCloneSource] = useState("");
  const [cloneTarget, setCloneTarget] = useState("");

  const [renameOpen, setRenameOpen] = useState(false);
  const [renameOld, setRenameOld] = useState("");
  const [renameNew, setRenameNew] = useState("");

  const [exportOpen, setExportOpen] = useState(false);
  const [exportContent, setExportContent] = useState("");
  const [exportEnvName, setExportEnvName] = useState("");

  const [importOpen, setImportOpen] = useState(false);
  const [importPath, setImportPath] = useState("");
  const [importName, setImportName] = useState("");

  const [channelInput, setChannelInput] = useState("");
  const [configOpen, setConfigOpen] = useState(false);

  useEffect(() => {
    if (isTauri()) {
      conda.refreshAll();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreate = useCallback(async () => {
    if (!createName.trim()) return;
    try {
      const pkgs = createPackages
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      await conda.createEnvironment(
        createName.trim(),
        createPython.trim() || undefined,
        pkgs.length > 0 ? pkgs : undefined,
      );
      toast.success(`Environment "${createName.trim()}" created`);
      setCreateOpen(false);
      setCreateName("");
      setCreatePython("");
      setCreatePackages("");
      await conda.listEnvironments();
    } catch (e) {
      toast.error(
        `Failed to create environment: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }, [conda, createName, createPython, createPackages]);

  const handleRemove = useCallback(
    async (name: string) => {
      try {
        await conda.removeEnvironment(name);
        toast.success(`Environment "${name}" removed`);
        await conda.listEnvironments();
      } catch (e) {
        toast.error(
          `Failed to remove: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    },
    [conda],
  );

  const handleClone = useCallback(async () => {
    if (!cloneSource.trim() || !cloneTarget.trim()) return;
    try {
      await conda.cloneEnvironment(cloneSource.trim(), cloneTarget.trim());
      toast.success(
        `Cloned "${cloneSource.trim()}" → "${cloneTarget.trim()}"`,
      );
      setCloneOpen(false);
      setCloneSource("");
      setCloneTarget("");
      await conda.listEnvironments();
    } catch (e) {
      toast.error(
        `Failed to clone: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }, [conda, cloneSource, cloneTarget]);

  const handleExport = useCallback(
    async (name: string) => {
      try {
        const result = await conda.exportEnvironment(name, true);
        setExportContent(result.content);
        setExportEnvName(result.envName);
        setExportOpen(true);
      } catch (e) {
        toast.error(
          `Failed to export: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    },
    [conda],
  );

  const handleImport = useCallback(async () => {
    if (!importPath.trim()) return;
    try {
      await conda.importEnvironment(
        importPath.trim(),
        importName.trim() || undefined,
      );
      toast.success("Environment imported successfully");
      setImportOpen(false);
      setImportPath("");
      setImportName("");
      await conda.listEnvironments();
    } catch (e) {
      toast.error(
        `Failed to import: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }, [conda, importPath, importName]);

  const handleRename = useCallback(async () => {
    if (!renameOld.trim() || !renameNew.trim()) return;
    try {
      await conda.renameEnvironment(renameOld.trim(), renameNew.trim());
      toast.success(
        `Renamed "${renameOld.trim()}" → "${renameNew.trim()}"`,
      );
      setRenameOpen(false);
      setRenameOld("");
      setRenameNew("");
      await conda.listEnvironments();
    } catch (e) {
      toast.error(
        `Failed to rename: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }, [conda, renameOld, renameNew]);

  const handleAddChannel = useCallback(async () => {
    if (!channelInput.trim()) return;
    try {
      await conda.addChannel(channelInput.trim());
      toast.success(`Channel "${channelInput.trim()}" added`);
      setChannelInput("");
      await conda.getInfo();
    } catch (e) {
      toast.error(
        `Failed to add channel: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }, [conda, channelInput]);

  const handleRemoveChannel = useCallback(
    async (channel: string) => {
      try {
        await conda.removeChannel(channel);
        toast.success(`Channel "${channel}" removed`);
        await conda.getInfo();
      } catch (e) {
        toast.error(
          `Failed to remove channel: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    },
    [conda],
  );

  const handleClean = useCallback(
    async (all: boolean) => {
      try {
        const result = await conda.clean(all, !all, !all);
        toast.success(result || "Cleanup complete");
      } catch (e) {
        toast.error(
          `Cleanup failed: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    },
    [conda],
  );

  if (!isTauri()) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Database className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <h3 className="text-lg font-medium">Desktop Only</h3>
        <p className="text-sm mt-1">
          Conda environment management is only available in the desktop app.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Error banner */}
      {conda.error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {conda.error}
        </div>
      )}

      {/* ── Conda Info Card ── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Conda Info
              </CardTitle>
              <CardDescription>
                System information and channel configuration
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => conda.refreshAll()}
              disabled={conda.loading}
            >
              {conda.loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {conda.info ? (
            <>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">
                    Conda Version
                  </span>
                  <p className="font-medium">
                    {conda.info.condaVersion ?? "Unknown"}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">
                    Python Version
                  </span>
                  <p className="font-medium">
                    {conda.info.pythonVersion ?? "Unknown"}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Platform</span>
                  <p className="font-medium">
                    {conda.info.platform ?? "Unknown"}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">
                    Root Prefix
                  </span>
                  <p className="font-mono text-xs truncate">
                    {conda.info.rootPrefix ?? "Unknown"}
                  </p>
                </div>
              </div>

              {conda.info.activePrefix && (
                <div className="flex items-center gap-2 text-sm">
                  <Badge variant="secondary">Active</Badge>
                  <span className="font-mono text-xs truncate">
                    {conda.info.activePrefix}
                  </span>
                </div>
              )}

              <Separator />

              {/* Channels */}
              <div className="space-y-2">
                <p className="text-sm font-medium">Channels</p>
                <div className="flex flex-wrap gap-2">
                  {conda.info.channels.map((ch) => (
                    <Badge
                      key={ch}
                      variant="outline"
                      className="gap-1"
                    >
                      {ch}
                      <button
                        onClick={() => handleRemoveChannel(ch)}
                        className="ml-1 hover:text-destructive"
                        aria-label={`Remove channel ${ch}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                  {conda.info.channels.length === 0 && (
                    <span className="text-sm text-muted-foreground">
                      No channels configured
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder="Add channel (e.g., conda-forge)"
                    value={channelInput}
                    onChange={(e) => setChannelInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleAddChannel();
                    }}
                    className="h-8 text-sm"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleAddChannel}
                    disabled={!channelInput.trim() || conda.loading}
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              <Separator />

              {/* Config viewer */}
              <Collapsible open={configOpen} onOpenChange={setConfigOpen}>
                <CollapsibleTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-2 -ml-2"
                  >
                    <ChevronDown
                      className={cn(
                        "h-4 w-4 transition-transform",
                        configOpen && "rotate-180",
                      )}
                    />
                    Configuration
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  {conda.config ? (
                    <pre className="mt-2 rounded-md bg-muted p-3 text-xs font-mono overflow-auto max-h-60">
                      {conda.config}
                    </pre>
                  ) : (
                    <div className="mt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => conda.getConfig()}
                        disabled={conda.loading}
                      >
                        Load Config
                      </Button>
                    </div>
                  )}
                </CollapsibleContent>
              </Collapsible>
            </>
          ) : (
            <div className="text-center py-4 text-sm text-muted-foreground">
              {conda.loading ? (
                <Loader2 className="h-5 w-5 animate-spin mx-auto" />
              ) : (
                "No conda info available. Click refresh to load."
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Environments Table ── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Database className="h-4 w-4" />
                Environments
              </CardTitle>
              <CardDescription>
                {conda.environments.length} environment
                {conda.environments.length !== 1 && "s"}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              {/* Import */}
              <Dialog open={importOpen} onOpenChange={setImportOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Upload className="h-3.5 w-3.5 mr-1.5" />
                    Import
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Import Environment</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-2">
                    <div className="space-y-2">
                      <Label>YAML File Path</Label>
                      <Input
                        placeholder="/path/to/environment.yml"
                        value={importPath}
                        onChange={(e) => setImportPath(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>
                        Environment Name{" "}
                        <span className="text-muted-foreground">
                          (optional, overrides YAML name)
                        </span>
                      </Label>
                      <Input
                        placeholder="my-env"
                        value={importName}
                        onChange={(e) => setImportName(e.target.value)}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <DialogClose asChild>
                      <Button variant="outline">Cancel</Button>
                    </DialogClose>
                    <Button
                      onClick={handleImport}
                      disabled={!importPath.trim() || conda.loading}
                    >
                      {conda.loading && (
                        <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                      )}
                      Import
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              {/* Create */}
              <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="h-3.5 w-3.5 mr-1.5" />
                    Create
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create Conda Environment</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 py-2">
                    <div className="space-y-2">
                      <Label>
                        Name <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        placeholder="my-env"
                        value={createName}
                        onChange={(e) => setCreateName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>
                        Python Version{" "}
                        <span className="text-muted-foreground">
                          (optional)
                        </span>
                      </Label>
                      <Input
                        placeholder="3.12"
                        value={createPython}
                        onChange={(e) => setCreatePython(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>
                        Initial Packages{" "}
                        <span className="text-muted-foreground">
                          (comma-separated, optional)
                        </span>
                      </Label>
                      <Input
                        placeholder="numpy, pandas, scipy"
                        value={createPackages}
                        onChange={(e) =>
                          setCreatePackages(e.target.value)
                        }
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <DialogClose asChild>
                      <Button variant="outline">Cancel</Button>
                    </DialogClose>
                    <Button
                      onClick={handleCreate}
                      disabled={!createName.trim() || conda.loading}
                    >
                      {conda.loading && (
                        <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                      )}
                      Create
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {conda.environments.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Prefix</TableHead>
                    <TableHead>Python</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {conda.environments.map((env) => (
                    <TableRow
                      key={env.prefix}
                      className={cn(env.isActive && "bg-accent/50")}
                    >
                      <TableCell className="font-medium">
                        {env.name}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground max-w-50 truncate">
                        {env.prefix}
                      </TableCell>
                      <TableCell className="text-sm">
                        {env.pythonVersion ?? "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {env.isActive && (
                            <Badge variant="default" className="text-xs">
                              Active
                            </Badge>
                          )}
                          {env.isBase && (
                            <Badge
                              variant="secondary"
                              className="text-xs"
                            >
                              Base
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {/* Clone */}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => {
                              setCloneSource(env.name);
                              setCloneTarget(`${env.name}-copy`);
                              setCloneOpen(true);
                            }}
                            title="Clone"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </Button>

                          {/* Export */}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => handleExport(env.name)}
                            title="Export"
                          >
                            <Download className="h-3.5 w-3.5" />
                          </Button>

                          {/* Rename */}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            disabled={env.isBase}
                            onClick={() => {
                              setRenameOld(env.name);
                              setRenameNew("");
                              setRenameOpen(true);
                            }}
                            title="Rename"
                          >
                            <Edit className="h-3.5 w-3.5" />
                          </Button>

                          {/* Remove */}
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-destructive hover:text-destructive"
                                disabled={env.isBase}
                                title="Remove"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>
                                  Remove Environment
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to remove &quot;
                                  {env.name}&quot;? This action cannot be
                                  undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleRemove(env.name)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Remove
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8 text-sm text-muted-foreground">
              {conda.loading ? (
                <Loader2 className="h-5 w-5 animate-spin mx-auto" />
              ) : (
                "No conda environments found."
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Clone Dialog ── */}
      <Dialog open={cloneOpen} onOpenChange={setCloneOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clone Environment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Source Environment</Label>
              <Input value={cloneSource} readOnly className="bg-muted" />
            </div>
            <div className="space-y-2">
              <Label>
                New Name <span className="text-destructive">*</span>
              </Label>
              <Input
                placeholder="my-env-copy"
                value={cloneTarget}
                onChange={(e) => setCloneTarget(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button
              onClick={handleClone}
              disabled={!cloneTarget.trim() || conda.loading}
            >
              {conda.loading && (
                <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
              )}
              Clone
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Rename Dialog ── */}
      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Environment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Current Name</Label>
              <Input value={renameOld} readOnly className="bg-muted" />
            </div>
            <div className="space-y-2">
              <Label>
                New Name <span className="text-destructive">*</span>
              </Label>
              <Input
                placeholder="new-name"
                value={renameNew}
                onChange={(e) => setRenameNew(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button
              onClick={handleRename}
              disabled={!renameNew.trim() || conda.loading}
            >
              {conda.loading && (
                <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
              )}
              Rename
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Export Dialog ── */}
      <Dialog open={exportOpen} onOpenChange={setExportOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Export: {exportEnvName}
            </DialogTitle>
          </DialogHeader>
          <pre className="rounded-md bg-muted p-4 text-xs font-mono overflow-auto max-h-96">
            {exportContent}
          </pre>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                navigator.clipboard.writeText(exportContent);
                toast.success("Copied to clipboard");
              }}
            >
              <Copy className="h-3.5 w-3.5 mr-1.5" />
              Copy
            </Button>
            <DialogClose asChild>
              <Button>Close</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Cleanup Section ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Trash2 className="h-4 w-4" />
            Cache Cleanup
          </CardTitle>
          <CardDescription>
            Free up disk space by removing cached packages and tarballs
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleClean(false)}
              disabled={conda.loading}
            >
              {conda.loading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
              ) : (
                <Trash2 className="h-3.5 w-3.5 mr-1.5" />
              )}
              Clean Packages & Tarballs
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={conda.loading}
                >
                  Clean All
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Clean All Caches</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will remove all cached packages, tarballs, and
                    index cache. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => handleClean(true)}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Clean All
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
