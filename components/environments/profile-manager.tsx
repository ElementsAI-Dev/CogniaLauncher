"use client";

import { useState, useCallback, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Bookmark,
  Plus,
  Play,
  Download,
  Upload,
  Trash2,
  Save,
  Loader2,
  Check,
  X,
  AlertTriangle,
  SkipForward,
  Copy,
  FileDown,
} from "lucide-react";
import { useProfiles } from "@/hooks/use-profiles";
import { useLocale } from "@/components/providers/locale-provider";
import type { EnvironmentProfile, ProfileApplyResult } from "@/lib/tauri";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface ProfileManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProfileManager({ open, onOpenChange }: ProfileManagerProps) {
  const { t } = useLocale();
  const {
    profiles,
    loading,
    error,
    refresh,
    createFromCurrent,
    applyProfile,
    deleteProfile,
    exportProfile,
    importProfile,
  } = useProfiles();

  const [newProfileName, setNewProfileName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [applyResult, setApplyResult] = useState<ProfileApplyResult | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [importJson, setImportJson] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleCreateFromCurrent = useCallback(async () => {
    if (!newProfileName.trim()) return;
    setIsCreating(true);
    try {
      const result = await createFromCurrent(newProfileName.trim());
      if (result) {
        toast.success(t("environments.profiles.created"));
        setNewProfileName("");
      }
    } catch (err) {
      toast.error(String(err));
    } finally {
      setIsCreating(false);
    }
  }, [newProfileName, createFromCurrent, t]);

  const handleApply = useCallback(
    async (profile: EnvironmentProfile) => {
      setApplyingId(profile.id);
      setApplyResult(null);
      try {
        const result = await applyProfile(profile.id);
        if (result) {
          setApplyResult(result);
          if (result.failed.length === 0) {
            toast.success(
              t("environments.profiles.applied", { name: profile.name })
            );
          } else {
            toast.warning(
              t("environments.profiles.partiallyApplied", {
                name: profile.name,
                failed: result.failed.length,
              })
            );
          }
        }
      } catch (err) {
        toast.error(String(err));
      } finally {
        setApplyingId(null);
      }
    },
    [applyProfile, t]
  );

  const handleDelete = useCallback(
    async (id: string) => {
      const success = await deleteProfile(id);
      if (success) {
        toast.success(t("environments.profiles.deleted"));
        if (applyResult?.profile_id === id) {
          setApplyResult(null);
        }
      }
    },
    [deleteProfile, applyResult, t]
  );

  const handleExport = useCallback(
    async (profile: EnvironmentProfile) => {
      const json = await exportProfile(profile.id);
      if (json) {
        try {
          await navigator.clipboard.writeText(json);
          toast.success(t("environments.profiles.exported"));
        } catch {
          const blob = new Blob([json], { type: "application/json" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `${profile.name.replace(/\s+/g, "-").toLowerCase()}.json`;
          a.click();
          URL.revokeObjectURL(url);
          toast.success(t("environments.profiles.exportedFile"));
        }
      }
    },
    [exportProfile, t]
  );

  const handleImport = useCallback(async () => {
    if (!importJson.trim()) return;
    try {
      const result = await importProfile(importJson.trim());
      if (result) {
        toast.success(
          t("environments.profiles.imported", { name: result.name })
        );
        setImportJson("");
        setShowImport(false);
      }
    } catch (err) {
      toast.error(String(err));
    }
  }, [importJson, importProfile, t]);

  const handleFileImport = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const content = ev.target?.result;
        if (typeof content === "string") {
          setImportJson(content);
          setShowImport(true);
        }
      };
      reader.readAsText(file);
      e.target.value = "";
    },
    []
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px] max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bookmark className="h-5 w-5" />
            {t("environments.profiles.title")}
          </DialogTitle>
          <DialogDescription>
            {t("environments.profiles.description")}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden space-y-4">
          {/* Save Current */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Save className="h-4 w-4" />
                {t("environments.profiles.saveCurrentTitle")}
              </CardTitle>
              <CardDescription className="text-xs">
                {t("environments.profiles.saveCurrentDesc")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Input
                  placeholder={t("environments.profiles.namePlaceholder")}
                  value={newProfileName}
                  onChange={(e) => setNewProfileName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCreateFromCurrent();
                  }}
                  className="flex-1 h-9"
                />
                <Button
                  size="sm"
                  onClick={handleCreateFromCurrent}
                  disabled={!newProfileName.trim() || isCreating || loading}
                  className="gap-1.5"
                >
                  {isCreating ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Plus className="h-3.5 w-3.5" />
                  )}
                  {t("environments.profiles.save")}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Import */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowImport(!showImport)}
              className="gap-1.5"
            >
              <Upload className="h-3.5 w-3.5" />
              {t("environments.profiles.importJson")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              className="gap-1.5"
            >
              <FileDown className="h-3.5 w-3.5" />
              {t("environments.profiles.importFile")}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleFileImport}
              className="hidden"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={refresh}
              disabled={loading}
              className="gap-1.5 ml-auto"
            >
              {loading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Download className="h-3.5 w-3.5" />
              )}
              {t("environments.refresh")}
            </Button>
          </div>

          {showImport && (
            <Card>
              <CardContent className="pt-4 space-y-2">
                <Textarea
                  className="h-24 font-mono text-xs resize-none bg-muted/50"
                  placeholder={t("environments.profiles.pasteJson")}
                  value={importJson}
                  onChange={(e) => setImportJson(e.target.value)}
                />
                <div className="flex gap-2 justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setShowImport(false);
                      setImportJson("");
                    }}
                  >
                    {t("common.cancel")}
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleImport}
                    disabled={!importJson.trim() || loading}
                    className="gap-1.5"
                  >
                    <Upload className="h-3.5 w-3.5" />
                    {t("environments.profiles.import")}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Apply Result */}
          {applyResult && (
            <Card
              className={cn(
                "border",
                applyResult.failed.length > 0
                  ? "border-yellow-300 dark:border-yellow-700 bg-yellow-50/50 dark:bg-yellow-950/30"
                  : "border-green-300 dark:border-green-700 bg-green-50/50 dark:bg-green-950/30"
              )}
            >
              <CardContent className="pt-4 space-y-2">
                <p className="text-sm font-medium flex items-center gap-2">
                  {applyResult.failed.length > 0 ? (
                    <AlertTriangle className="h-4 w-4 text-yellow-600" />
                  ) : (
                    <Check className="h-4 w-4 text-green-600" />
                  )}
                  {t("environments.profiles.applyResultTitle", {
                    name: applyResult.profile_name,
                  })}
                </p>
                {applyResult.successful.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {applyResult.successful.map((s) => (
                      <Badge
                        key={`${s.env_type}-${s.version}`}
                        variant="default"
                        className="text-xs gap-1"
                      >
                        <Check className="h-3 w-3" />
                        {s.env_type}@{s.version}
                      </Badge>
                    ))}
                  </div>
                )}
                {applyResult.failed.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {applyResult.failed.map((f) => (
                      <Badge
                        key={`${f.env_type}-${f.version}`}
                        variant="destructive"
                        className="text-xs gap-1"
                      >
                        <X className="h-3 w-3" />
                        {f.env_type}@{f.version}: {f.error}
                      </Badge>
                    ))}
                  </div>
                )}
                {applyResult.skipped.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {applyResult.skipped.map((s) => (
                      <Badge
                        key={`${s.env_type}-${s.version}`}
                        variant="secondary"
                        className="text-xs gap-1"
                      >
                        <SkipForward className="h-3 w-3" />
                        {s.env_type}@{s.version}
                      </Badge>
                    ))}
                  </div>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setApplyResult(null)}
                  className="mt-1"
                >
                  {t("common.dismiss")}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Profile List */}
          <ScrollArea className="h-[300px]">
            {profiles.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Bookmark className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">
                  {t("environments.profiles.noProfiles")}
                </p>
                <p className="text-xs mt-1">
                  {t("environments.profiles.noProfilesHint")}
                </p>
              </div>
            ) : (
              <div className="space-y-2 pr-3">
                {profiles.map((profile) => (
                  <ProfileCard
                    key={profile.id}
                    profile={profile}
                    isApplying={applyingId === profile.id}
                    onApply={() => handleApply(profile)}
                    onExport={() => handleExport(profile)}
                    onDelete={() => handleDelete(profile.id)}
                    t={t}
                  />
                ))}
              </div>
            )}
          </ScrollArea>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.close")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface ProfileCardProps {
  profile: EnvironmentProfile;
  isApplying: boolean;
  onApply: () => void;
  onExport: () => void;
  onDelete: () => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

function ProfileCard({
  profile,
  isApplying,
  onApply,
  onExport,
  onDelete,
  t,
}: ProfileCardProps) {
  const createdDate = new Date(profile.created_at).toLocaleDateString();

  return (
    <div className="flex items-start justify-between p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Bookmark className="h-4 w-4 text-primary shrink-0" />
          <span className="font-medium text-sm truncate">{profile.name}</span>
          <Badge variant="secondary" className="text-xs shrink-0">
            {profile.environments.length} {t("environments.profiles.envCount")}
          </Badge>
        </div>
        {profile.description && (
          <p className="text-xs text-muted-foreground mt-1 ml-6 truncate">
            {profile.description}
          </p>
        )}
        <div className="flex flex-wrap gap-1 mt-1.5 ml-6">
          {profile.environments.slice(0, 5).map((env) => (
            <Badge
              key={`${env.env_type}-${env.version}`}
              variant="outline"
              className="text-xs font-mono"
            >
              {env.env_type}@{env.version}
            </Badge>
          ))}
          {profile.environments.length > 5 && (
            <Badge variant="outline" className="text-xs">
              +{profile.environments.length - 5}
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-1 ml-6">
          {t("environments.profiles.createdAt", { date: createdDate })}
        </p>
      </div>
      <div className="flex items-center gap-1 shrink-0 ml-2">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={onApply}
          disabled={isApplying}
          title={t("environments.profiles.apply")}
        >
          {isApplying ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Play className="h-3.5 w-3.5" />
          )}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={onExport}
          title={t("environments.profiles.export")}
        >
          <Copy className="h-3.5 w-3.5" />
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:text-destructive"
              title={t("common.delete")}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("common.confirm")}</AlertDialogTitle>
              <AlertDialogDescription>
                {t("environments.profiles.deleteConfirm", {
                  name: profile.name,
                })}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
              <AlertDialogAction
                onClick={onDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {t("common.delete")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
