"use client";

import { useState, useEffect } from "react";
import { useRustup } from "@/hooks/use-rustup";
import { isTauri } from "@/lib/tauri";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Download,
  Trash2,
  RefreshCw,
  Check,
  X,
  Shield,
  Target,
  Package,
  FolderOpen,
  Loader2,
  Plus,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { RustComponent, RustTarget } from "@/types/tauri";

// ─── Filter type for component/target lists ────────────────────────────
type FilterMode = "all" | "installed" | "available";

// ─── Well-known targets worth highlighting ─────────────────────────────
const NOTABLE_TARGETS = new Set([
  "wasm32-unknown-unknown",
  "wasm32-wasip1",
  "x86_64-unknown-linux-gnu",
  "x86_64-unknown-linux-musl",
  "aarch64-unknown-linux-gnu",
  "x86_64-apple-darwin",
  "aarch64-apple-darwin",
  "x86_64-pc-windows-msvc",
  "x86_64-pc-windows-gnu",
  "aarch64-pc-windows-msvc",
]);

const PROFILES = ["minimal", "default", "complete"] as const;

// ─── Main panel ────────────────────────────────────────────────────────
export function RustToolchainPanel() {
  const {
    components,
    targets,
    overrides,
    showInfo,
    profile,
    loading,
    error,
    listComponents,
    addComponent,
    removeComponent,
    listTargets,
    addTarget,
    removeTarget,
    overrideSet,
    overrideUnset,
    overrideList,
    selfUpdate,
    updateAll,
    setProfile,
    refreshAll,
  } = useRustup();

  const [operationLoading, setOperationLoading] = useState<string | null>(null);
  const [componentFilter, setComponentFilter] = useState<FilterMode>("all");
  const [targetFilter, setTargetFilter] = useState<FilterMode>("all");
  const [targetSearch, setTargetSearch] = useState("");
  const [profileConfirmOpen, setProfileConfirmOpen] = useState(false);
  const [pendingProfile, setPendingProfile] = useState<string | null>(null);

  // Override addition state
  const [newOverridePath, setNewOverridePath] = useState("");
  const [newOverrideToolchain, setNewOverrideToolchain] = useState("");

  useEffect(() => {
    if (isTauri()) {
      refreshAll();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Guard: Tauri-only ─────────────────────────────────────────────
  if (!isTauri()) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Info className="h-10 w-10 mx-auto mb-3 opacity-50" />
        <p className="text-sm">
          Rustup management is only available in desktop mode.
        </p>
      </div>
    );
  }

  // ── Helpers ───────────────────────────────────────────────────────

  const withOp = async (key: string, fn: () => Promise<void>) => {
    setOperationLoading(key);
    try {
      await fn();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setOperationLoading(null);
    }
  };

  const handleSelfUpdate = () =>
    withOp("self-update", async () => {
      await selfUpdate();
      toast.success("Rustup updated successfully");
      await refreshAll();
    });

  const handleUpdateAll = () =>
    withOp("update-all", async () => {
      const output = await updateAll();
      toast.success(output || "All toolchains updated");
      await refreshAll();
    });

  const handleRefresh = () =>
    withOp("refresh", async () => {
      await refreshAll();
      toast.success("Refreshed");
    });

  // ── Profile handling ──────────────────────────────────────────────

  const requestProfileChange = (value: string) => {
    if (value === profile) return;
    // Downgrading from a more inclusive profile may remove components
    const currentIdx = PROFILES.indexOf(profile as typeof PROFILES[number]);
    const targetIdx = PROFILES.indexOf(value as typeof PROFILES[number]);
    if (targetIdx < currentIdx) {
      setPendingProfile(value);
      setProfileConfirmOpen(true);
    } else {
      commitProfileChange(value);
    }
  };

  const commitProfileChange = (value: string) =>
    withOp("profile", async () => {
      await setProfile(value);
      toast.success(`Profile set to "${value}"`);
      await refreshAll();
    });

  // ── Component actions ─────────────────────────────────────────────

  const handleAddComponent = (name: string) =>
    withOp(`comp-add-${name}`, async () => {
      await addComponent(name);
      toast.success(`Component "${name}" installed`);
      await listComponents();
    });

  const handleRemoveComponent = (name: string) =>
    withOp(`comp-rm-${name}`, async () => {
      await removeComponent(name);
      toast.success(`Component "${name}" removed`);
      await listComponents();
    });

  // ── Target actions ────────────────────────────────────────────────

  const handleAddTarget = (name: string) =>
    withOp(`tgt-add-${name}`, async () => {
      await addTarget(name);
      toast.success(`Target "${name}" added`);
      await listTargets();
    });

  const handleRemoveTarget = (name: string) =>
    withOp(`tgt-rm-${name}`, async () => {
      await removeTarget(name);
      toast.success(`Target "${name}" removed`);
      await listTargets();
    });

  // ── Override actions ──────────────────────────────────────────────

  const handleAddOverride = () => {
    const tc = newOverrideToolchain.trim();
    if (!tc) {
      toast.error("Please specify a toolchain");
      return;
    }
    const p = newOverridePath.trim() || undefined;
    withOp("override-add", async () => {
      await overrideSet(tc, p);
      toast.success("Override set");
      setNewOverridePath("");
      setNewOverrideToolchain("");
      await overrideList();
    });
  };

  const handleRemoveOverride = (path: string) =>
    withOp(`override-rm-${path}`, async () => {
      await overrideUnset(path);
      toast.success("Override removed");
      await overrideList();
    });

  // ── Filtered lists ────────────────────────────────────────────────

  const filteredComponents = components.filter((c) => {
    if (componentFilter === "installed") return c.installed;
    if (componentFilter === "available") return !c.installed;
    return true;
  });

  const filteredTargets = targets
    .filter((t) => {
      if (targetFilter === "installed") return t.installed;
      if (targetFilter === "available") return !t.installed;
      return true;
    })
    .filter(
      (t) =>
        !targetSearch ||
        t.name.toLowerCase().includes(targetSearch.toLowerCase()),
    );

  // ── Loading skeleton ──────────────────────────────────────────────

  if (loading && !components.length && !showInfo) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">
          Loading rustup data…
        </span>
      </div>
    );
  }

  if (error && !showInfo) {
    return (
      <Card className="border-destructive">
        <CardContent className="py-8 text-center">
          <X className="h-8 w-8 mx-auto text-destructive mb-2" />
          <p className="text-sm text-destructive">{error}</p>
          <Button variant="outline" size="sm" className="mt-4" onClick={handleRefresh}>
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── A. Rustup Info Card ──────────────────────────────────── */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
          <div>
            <CardTitle className="text-base">Rustup Overview</CardTitle>
            <CardDescription>Active toolchain and rustup status</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={operationLoading !== null}
            >
              {operationLoading === "refresh" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSelfUpdate}
              disabled={operationLoading !== null}
            >
              {operationLoading === "self-update" ? (
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              ) : (
                <Shield className="h-3.5 w-3.5 mr-1.5" />
              )}
              Self Update
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={handleUpdateAll}
              disabled={operationLoading !== null}
            >
              {operationLoading === "update-all" ? (
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              ) : (
                <Download className="h-3.5 w-3.5 mr-1.5" />
              )}
              Update All
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <InfoItem
              label="Active Toolchain"
              value={showInfo?.activeToolchain ?? "—"}
            />
            <InfoItem
              label="Default Toolchain"
              value={showInfo?.defaultToolchain ?? "—"}
            />
            <InfoItem
              label="Rustc Version"
              value={showInfo?.rustcVersion ?? "—"}
              mono
            />
            <div>
              <p className="text-xs text-muted-foreground mb-1">Profile</p>
              <Select
                value={profile ?? "default"}
                onValueChange={requestProfileChange}
                disabled={operationLoading !== null}
              >
                <SelectTrigger className="h-8 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROFILES.map((p) => (
                    <SelectItem key={p} value={p}>
                      <span className="capitalize">{p}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {showInfo?.installedToolchains &&
            showInfo.installedToolchains.length > 0 && (
              <div className="mt-4">
                <p className="text-xs text-muted-foreground mb-1.5">
                  Installed Toolchains
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {showInfo.installedToolchains.map((tc) => (
                    <Badge
                      key={tc}
                      variant={
                        tc === showInfo.activeToolchain ? "default" : "secondary"
                      }
                      className="font-mono text-xs"
                    >
                      {tc}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
        </CardContent>
      </Card>

      {/* ── Tabbed sections ──────────────────────────────────────── */}
      <Tabs defaultValue="components" className="w-full">
        <TabsList>
          <TabsTrigger value="components" className="gap-1.5">
            <Package className="h-3.5 w-3.5" />
            Components
            <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">
              {components.filter((c) => c.installed).length}/{components.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="targets" className="gap-1.5">
            <Target className="h-3.5 w-3.5" />
            Targets
            <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">
              {targets.filter((t) => t.installed).length}/{targets.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="overrides" className="gap-1.5">
            <FolderOpen className="h-3.5 w-3.5" />
            Overrides
            {overrides.length > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">
                {overrides.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ── B. Components Tab ─────────────────────────────────── */}
        <TabsContent value="components" className="mt-4">
          <div className="flex items-center gap-2 mb-3">
            <Select
              value={componentFilter}
              onValueChange={(v) => setComponentFilter(v as FilterMode)}
            >
              <SelectTrigger className="h-8 w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="installed">Installed</SelectItem>
                <SelectItem value="available">Available</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-xs text-muted-foreground ml-auto">
              {filteredComponents.length} component{filteredComponents.length !== 1 && "s"}
            </span>
          </div>

          <ScrollArea className="max-h-120">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-70">Name</TableHead>
                  <TableHead className="w-30">Status</TableHead>
                  <TableHead className="text-right w-25">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredComponents.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-sm text-muted-foreground py-8">
                      No components match the current filter.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredComponents.map((comp) => (
                    <ComponentRow
                      key={comp.name}
                      component={comp}
                      operationLoading={operationLoading}
                      onAdd={handleAddComponent}
                      onRemove={handleRemoveComponent}
                    />
                  ))
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </TabsContent>

        {/* ── C. Targets Tab ────────────────────────────────────── */}
        <TabsContent value="targets" className="mt-4">
          <div className="flex items-center gap-2 mb-3">
            <Select
              value={targetFilter}
              onValueChange={(v) => setTargetFilter(v as FilterMode)}
            >
              <SelectTrigger className="h-8 w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="installed">Installed</SelectItem>
                <SelectItem value="available">Available</SelectItem>
              </SelectContent>
            </Select>
            <Input
              className="h-8 max-w-xs"
              placeholder="Search targets…"
              value={targetSearch}
              onChange={(e) => setTargetSearch(e.target.value)}
            />
            <span className="text-xs text-muted-foreground ml-auto">
              {filteredTargets.length} target{filteredTargets.length !== 1 && "s"}
            </span>
          </div>

          <ScrollArea className="max-h-120">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-90">Target Triple</TableHead>
                  <TableHead className="w-30">Status</TableHead>
                  <TableHead className="text-right w-25">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTargets.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-sm text-muted-foreground py-8">
                      No targets match the current filter.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTargets.map((tgt) => (
                    <TargetRow
                      key={tgt.name}
                      target={tgt}
                      notable={NOTABLE_TARGETS.has(tgt.name)}
                      operationLoading={operationLoading}
                      onAdd={handleAddTarget}
                      onRemove={handleRemoveTarget}
                    />
                  ))
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </TabsContent>

        {/* ── D. Overrides Tab ──────────────────────────────────── */}
        <TabsContent value="overrides" className="mt-4 space-y-4">
          {/* Add override form */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Add Override</CardTitle>
              <CardDescription className="text-xs">
                Pin a directory to a specific toolchain
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <label className="text-xs text-muted-foreground mb-1 block">
                    Directory Path (blank = current dir)
                  </label>
                  <Input
                    className="h-8 font-mono text-xs"
                    placeholder="/path/to/project"
                    value={newOverridePath}
                    onChange={(e) => setNewOverridePath(e.target.value)}
                  />
                </div>
                <div className="w-52">
                  <label className="text-xs text-muted-foreground mb-1 block">
                    Toolchain
                  </label>
                  {showInfo?.installedToolchains &&
                  showInfo.installedToolchains.length > 0 ? (
                    <Select
                      value={newOverrideToolchain}
                      onValueChange={setNewOverrideToolchain}
                    >
                      <SelectTrigger className="h-8">
                        <SelectValue placeholder="Select toolchain" />
                      </SelectTrigger>
                      <SelectContent>
                        {showInfo.installedToolchains.map((tc) => (
                          <SelectItem key={tc} value={tc}>
                            {tc}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      className="h-8 font-mono text-xs"
                      placeholder="stable / nightly / 1.78.0"
                      value={newOverrideToolchain}
                      onChange={(e) => setNewOverrideToolchain(e.target.value)}
                    />
                  )}
                </div>
                <Button
                  size="sm"
                  className="h-8"
                  onClick={handleAddOverride}
                  disabled={
                    operationLoading !== null || !newOverrideToolchain.trim()
                  }
                >
                  {operationLoading === "override-add" ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Plus className="h-3.5 w-3.5 mr-1" />
                  )}
                  Set
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Override list */}
          {overrides.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              No directory overrides configured.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Path</TableHead>
                  <TableHead className="w-50">Toolchain</TableHead>
                  <TableHead className="text-right w-20">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {overrides.map((ov) => (
                  <TableRow key={ov.path}>
                    <TableCell className="font-mono text-xs truncate max-w-100">
                      {ov.path}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono text-xs">
                        {ov.toolchain}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        disabled={operationLoading !== null}
                        onClick={() => handleRemoveOverride(ov.path)}
                      >
                        {operationLoading === `override-rm-${ov.path}` ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TabsContent>
      </Tabs>

      {/* ── Profile downgrade confirmation ────────────────────────── */}
      <AlertDialog open={profileConfirmOpen} onOpenChange={setProfileConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Change profile to &ldquo;{pendingProfile}&rdquo;?</AlertDialogTitle>
            <AlertDialogDescription>
              Downgrading the profile may prevent some components from being
              installed in future toolchain updates. Existing components will not
              be removed immediately, but newly installed toolchains will use the
              new profile.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingProfile(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingProfile) {
                  commitProfileChange(pendingProfile);
                }
                setPendingProfile(null);
                setProfileConfirmOpen(false);
              }}
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────

function InfoItem({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
      <p
        className={cn(
          "text-sm font-medium truncate",
          mono && "font-mono",
        )}
        title={value}
      >
        {value}
      </p>
    </div>
  );
}

function ComponentRow({
  component,
  operationLoading,
  onAdd,
  onRemove,
}: {
  component: RustComponent;
  operationLoading: string | null;
  onAdd: (name: string) => void;
  onRemove: (name: string) => void;
}) {
  const busy =
    operationLoading === `comp-add-${component.name}` ||
    operationLoading === `comp-rm-${component.name}`;

  return (
    <TableRow>
      <TableCell>
        <span className="font-mono text-xs">{component.name}</span>
        {component.default && (
          <Badge variant="outline" className="ml-2 text-[10px] h-4 px-1">
            default
          </Badge>
        )}
      </TableCell>
      <TableCell>
        {component.installed ? (
          <Badge
            variant="default"
            className="gap-1 text-[10px] h-5"
          >
            <Check className="h-3 w-3" />
            Installed
          </Badge>
        ) : (
          <Badge variant="secondary" className="text-[10px] h-5">
            Available
          </Badge>
        )}
      </TableCell>
      <TableCell className="text-right">
        {component.installed ? (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            disabled={component.default || operationLoading !== null}
            onClick={() => onRemove(component.name)}
            title={component.default ? "Default components cannot be removed" : "Remove"}
          >
            {busy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Trash2
                className={cn(
                  "h-3.5 w-3.5",
                  component.default
                    ? "text-muted-foreground"
                    : "text-destructive",
                )}
              />
            )}
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            disabled={operationLoading !== null}
            onClick={() => onAdd(component.name)}
          >
            {busy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
          </Button>
        )}
      </TableCell>
    </TableRow>
  );
}

function TargetRow({
  target,
  notable,
  operationLoading,
  onAdd,
  onRemove,
}: {
  target: RustTarget;
  notable: boolean;
  operationLoading: string | null;
  onAdd: (name: string) => void;
  onRemove: (name: string) => void;
}) {
  const busy =
    operationLoading === `tgt-add-${target.name}` ||
    operationLoading === `tgt-rm-${target.name}`;

  return (
    <TableRow className={cn(notable && !target.installed && "bg-muted/30")}>
      <TableCell>
        <span className="font-mono text-xs">{target.name}</span>
        {target.default && (
          <Badge variant="outline" className="ml-2 text-[10px] h-4 px-1">
            host
          </Badge>
        )}
        {notable && !target.default && (
          <Badge variant="secondary" className="ml-2 text-[10px] h-4 px-1">
            popular
          </Badge>
        )}
      </TableCell>
      <TableCell>
        {target.installed ? (
          <Badge
            variant="default"
            className="gap-1 text-[10px] h-5"
          >
            <Check className="h-3 w-3" />
            Installed
          </Badge>
        ) : (
          <Badge variant="secondary" className="text-[10px] h-5">
            Available
          </Badge>
        )}
      </TableCell>
      <TableCell className="text-right">
        {target.installed ? (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            disabled={target.default || operationLoading !== null}
            onClick={() => onRemove(target.name)}
            title={target.default ? "Host target cannot be removed" : "Remove"}
          >
            {busy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Trash2
                className={cn(
                  "h-3.5 w-3.5",
                  target.default
                    ? "text-muted-foreground"
                    : "text-destructive",
                )}
              />
            )}
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            disabled={operationLoading !== null}
            onClick={() => onAdd(target.name)}
          >
            {busy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
          </Button>
        )}
      </TableCell>
    </TableRow>
  );
}
