"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import { useLocale } from "@/components/providers/locale-provider";
import { useFeedbackStore } from "@/lib/stores/feedback";
import { useFeedback } from "@/hooks/use-feedback";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Bug,
  Lightbulb,
  Gauge,
  AlertTriangle,
  HelpCircle,
  MoreHorizontal,
  Send,
  Camera,
  Loader2,
  ExternalLink,
  X,
  Upload,
  Info,
  CheckCircle2,
  History,
  Trash2,
  Download,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { openExternal } from "@/lib/tauri";
import { isTauri } from "@/lib/platform";
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type {
  FeedbackCategory,
  FeedbackSeverity,
  FeedbackFormData,
  FeedbackItem,
} from "@/types/feedback";
import {
  FEEDBACK_CATEGORIES,
  FEEDBACK_SEVERITIES,
  SEVERITY_CATEGORIES,
} from "@/types/feedback";

const CATEGORY_ICONS: Record<FeedbackCategory, React.ElementType> = {
  bug: Bug,
  feature: Lightbulb,
  performance: Gauge,
  crash: AlertTriangle,
  question: HelpCircle,
  other: MoreHorizontal,
};

export function FeedbackDialog() {
  const { t } = useLocale();
  const {
    dialogOpen,
    preSelectedCategory,
    preFilledErrorContext,
    closeDialog,
    saveDraft,
    clearDraft,
    draft,
  } = useFeedbackStore();
  const { submitFeedback, submitting } = useFeedback();

  const [category, setCategory] = useState<FeedbackCategory>("bug");
  const [severity, setSeverity] = useState<FeedbackSeverity>("medium");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [includeDiagnostics, setIncludeDiagnostics] = useState(true);
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [capturingScreenshot, setCapturingScreenshot] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Optimization 2/3: validation states
  const [titleTouched, setTitleTouched] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  // Optimization 4: draft restoration banner
  const [restoredFromDraft, setRestoredFromDraft] = useState(false);
  // Optimization 5: drag-drop & preview
  const [dragOver, setDragOver] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  // Optimization 6: success confirmation
  const [submitted, setSubmitted] = useState(false);
  // Optimization 7: history dialog
  const [historyOpen, setHistoryOpen] = useState(false);

  // Initialize form with pre-selected values or draft
  useEffect(() => {
    if (!dialogOpen) return;

    if (preSelectedCategory) {
      setCategory(preSelectedCategory);
    } else if (draft?.category) {
      setCategory(draft.category);
    }

    if (preFilledErrorContext) {
      const errMsg = preFilledErrorContext.message || "";
      const errStack = preFilledErrorContext.stack || "";
      setTitle(errMsg.slice(0, 120));
      setDescription(
        [
          errMsg,
          preFilledErrorContext.component
            ? `Component: ${preFilledErrorContext.component}`
            : "",
          errStack ? `\nStack trace:\n${errStack}` : "",
        ]
          .filter(Boolean)
          .join("\n"),
      );
      if (preSelectedCategory === "crash" || preSelectedCategory === "bug") {
        setSeverity("high");
      }
    } else if (draft) {
      if (draft.title) setTitle(draft.title);
      if (draft.description) setDescription(draft.description);
      if (draft.contactEmail) setContactEmail(draft.contactEmail);
      if (draft.severity) setSeverity(draft.severity);
      if (typeof draft.includeDiagnostics === "boolean")
        setIncludeDiagnostics(draft.includeDiagnostics);
      setRestoredFromDraft(true);
    }
  }, [dialogOpen, preSelectedCategory, preFilledErrorContext, draft]);

  const resetForm = useCallback(() => {
    setCategory("bug");
    setSeverity("medium");
    setTitle("");
    setDescription("");
    setContactEmail("");
    setIncludeDiagnostics(true);
    setScreenshot(null);
    setTitleTouched(false);
    setEmailError(null);
    setRestoredFromDraft(false);
    setSubmitted(false);
  }, []);

  const handleClose = useCallback(() => {
    // Save draft if there's content
    if (title.trim() || description.trim()) {
      saveDraft({
        category,
        severity: SEVERITY_CATEGORIES.includes(category) ? severity : undefined,
        title,
        description,
        contactEmail: contactEmail || undefined,
        includeDiagnostics,
      });
    }
    closeDialog();
  }, [
    title,
    description,
    category,
    severity,
    contactEmail,
    includeDiagnostics,
    saveDraft,
    closeDialog,
  ]);

  const handleSubmit = useCallback(async () => {
    if (!title.trim()) return;

    const data: FeedbackFormData = {
      category,
      severity: SEVERITY_CATEGORIES.includes(category) ? severity : undefined,
      title: title.trim(),
      description: description.trim(),
      contactEmail: contactEmail.trim() || undefined,
      screenshot: screenshot || undefined,
      includeDiagnostics,
      errorContext: preFilledErrorContext || undefined,
    };

    const result = await submitFeedback(data, t);
    if (result !== undefined) {
      clearDraft();
      resetForm();
      setSubmitted(true);
      setTimeout(() => {
        setSubmitted(false);
        closeDialog();
      }, 1800);
    }
  }, [
    category,
    severity,
    title,
    description,
    contactEmail,
    screenshot,
    includeDiagnostics,
    preFilledErrorContext,
    submitFeedback,
    clearDraft,
    resetForm,
    closeDialog,
    t,
  ]);

  const handleCaptureScreenshot = useCallback(async () => {
    setCapturingScreenshot(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(document.body, {
        useCORS: true,
        scale: 1,
        logging: false,
        ignoreElements: (el) => {
          // Ignore the dialog overlay itself
          return (
            el.getAttribute("role") === "dialog" ||
            el.getAttribute("data-radix-portal") !== null
          );
        },
      });
      setScreenshot(canvas.toDataURL("image/png", 0.8));
    } catch {
      // Fallback: let user upload a file
      fileInputRef.current?.click();
    } finally {
      setCapturingScreenshot(false);
    }
  }, []);

  const handleFileUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (!file.type.startsWith("image/")) {
        toast.error(t("feedback.screenshotInvalidType"));
        e.target.value = "";
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast.error(t("feedback.screenshotTooLarge"));
        e.target.value = "";
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        setScreenshot(reader.result as string);
      };
      reader.readAsDataURL(file);
      e.target.value = "";
    },
    [t],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (!file) return;
      if (!file.type.startsWith("image/")) {
        toast.error(t("feedback.screenshotInvalidType"));
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast.error(t("feedback.screenshotTooLarge"));
        return;
      }
      const reader = new FileReader();
      reader.onload = () => setScreenshot(reader.result as string);
      reader.readAsDataURL(file);
    },
    [t],
  );

  const validateEmail = useCallback(
    (v: string) =>
      v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
        ? t("feedback.invalidEmail")
        : null,
    [t],
  );

  const handleOpenGitHub = useCallback(() => {
    const baseUrl =
      category === "feature"
        ? "https://github.com/ElementAstro/CogniaLauncher/discussions/new?category=ideas"
        : `https://github.com/ElementAstro/CogniaLauncher/issues/new?template=bug_report.md&title=${encodeURIComponent(title)}`;
    void openExternal(baseUrl);
  }, [category, title]);

  const showSeverity = SEVERITY_CATEGORIES.includes(category);
  const canSubmit = title.trim().length > 0 && !submitting && !emailError;
  const CategoryIcon = CATEGORY_ICONS[category];

  return (
    <>
      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!open) handleClose();
        }}
      >
        <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
          {/* Optimization 6: Success confirmation screen */}
          {submitted ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <p className="text-lg font-semibold">{t("feedback.thankYou")}</p>
              <p className="text-sm text-muted-foreground text-center">
                {t("feedback.thankYouDesc")}
              </p>
            </div>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {/* Optimization 1: Dynamic category icon */}
                  <CategoryIcon className="h-5 w-5" />
                  {t("feedback.title")}
                </DialogTitle>
                <DialogDescription>
                  {t("feedback.description")}
                </DialogDescription>
              </DialogHeader>

              <ScrollArea className="flex-1 -mx-6 px-6">
                <div className="space-y-4 py-1">
                  {/* Optimization 4: Draft restoration banner */}
                  {restoredFromDraft && (
                    <Alert className="mb-1">
                      <Info className="h-4 w-4" />
                      <AlertDescription className="flex items-center justify-between">
                        <span>{t("feedback.draftRestored")}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-xs ml-2"
                          onClick={() => {
                            clearDraft();
                            resetForm();
                          }}
                        >
                          {t("feedback.clearDraft")}
                        </Button>
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* Category */}
                  <div className="space-y-2">
                    <Label>{t("feedback.category")}</Label>
                    <div className="flex flex-wrap gap-2">
                      {FEEDBACK_CATEGORIES.map((cat) => {
                        const Icon = CATEGORY_ICONS[cat];
                        const isSelected = category === cat;
                        return (
                          <Button
                            key={cat}
                            variant={isSelected ? "default" : "outline"}
                            size="sm"
                            onClick={() => setCategory(cat)}
                            className="gap-1.5"
                          >
                            <Icon className="h-3.5 w-3.5" />
                            {t(`feedback.categories.${cat}`)}
                          </Button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Severity (only for bug/crash/performance) */}
                  {showSeverity && (
                    <div className="space-y-2">
                      <Label>{t("feedback.severity")}</Label>
                      <Select
                        value={severity}
                        onValueChange={(v) =>
                          setSeverity(v as FeedbackSeverity)
                        }
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {FEEDBACK_SEVERITIES.map((s) => (
                            <SelectItem key={s} value={s}>
                              {t(`feedback.severities.${s}`)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Title — Optimization 2: char counter + Optimization 3: validation */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <Label htmlFor="feedback-title">
                        {t("feedback.titleLabel")}{" "}
                        <span className="text-destructive">*</span>
                      </Label>
                      <span
                        className={cn(
                          "text-xs tabular-nums",
                          title.length > 180
                            ? "text-destructive"
                            : "text-muted-foreground",
                        )}
                      >
                        {title.length}/200
                      </span>
                    </div>
                    <Input
                      id="feedback-title"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      onBlur={() => setTitleTouched(true)}
                      placeholder={t("feedback.titlePlaceholder")}
                      maxLength={200}
                      aria-required
                      aria-invalid={titleTouched && !title.trim()}
                      aria-describedby={
                        titleTouched && !title.trim()
                          ? "feedback-title-error"
                          : undefined
                      }
                    />
                    {titleTouched && !title.trim() && (
                      <p
                        id="feedback-title-error"
                        className="text-sm text-destructive"
                        role="alert"
                      >
                        {t("feedback.titleRequired")}
                      </p>
                    )}
                  </div>

                  {/* Description — Optimization 2: char counter */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <Label htmlFor="feedback-desc">
                        {t("feedback.descriptionLabel")}
                      </Label>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {description.length}/5000
                      </span>
                    </div>
                    <Textarea
                      id="feedback-desc"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder={t("feedback.descriptionPlaceholder")}
                      rows={5}
                      maxLength={5000}
                      className="resize-y min-h-[100px]"
                    />
                  </div>

                  {/* Error context badge */}
                  {preFilledErrorContext?.message && (
                    <div className="flex items-center gap-2">
                      <Badge variant="destructive" className="text-xs">
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        {t("feedback.errorAttached")}
                      </Badge>
                    </div>
                  )}

                  {/* Screenshot — Optimization 5: upload button + drag-drop + preview */}
                  <div className="space-y-2">
                    <Label>{t("feedback.screenshot")}</Label>
                    <div
                      onDragOver={(e) => {
                        e.preventDefault();
                        setDragOver(true);
                      }}
                      onDragLeave={() => setDragOver(false)}
                      onDrop={handleDrop}
                      className={cn(
                        "rounded-lg border-2 border-dashed p-3 transition-colors",
                        dragOver
                          ? "border-primary bg-primary/5"
                          : "border-muted-foreground/25",
                      )}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleCaptureScreenshot}
                          disabled={capturingScreenshot}
                        >
                          {capturingScreenshot ? (
                            <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                          ) : (
                            <Camera className="h-3.5 w-3.5 mr-1.5" />
                          )}
                          {t("feedback.captureScreenshot")}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => fileInputRef.current?.click()}
                        >
                          <Upload className="h-3.5 w-3.5 mr-1.5" />
                          {t("feedback.uploadScreenshot")}
                        </Button>
                        <span className="text-xs text-muted-foreground">
                          {t("feedback.dragDropHint")}
                        </span>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleFileUpload}
                        />
                      </div>
                      {screenshot && (
                        <div className="relative group mt-2 inline-block">
                          <button
                            type="button"
                            onClick={() => setPreviewOpen(true)}
                            className="cursor-zoom-in"
                          >
                            <Image
                              src={screenshot}
                              alt="Screenshot preview"
                              width={160}
                              height={96}
                              unoptimized
                              className="h-16 w-auto rounded border object-cover"
                            />
                          </button>
                          <button
                            type="button"
                            onClick={() => setScreenshot(null)}
                            aria-label={t("feedback.removeScreenshot")}
                            className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="h-2.5 w-2.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Contact email — Optimization 3: validation */}
                  <div className="space-y-2">
                    <Label htmlFor="feedback-email">
                      {t("feedback.contactEmail")}
                    </Label>
                    <Input
                      id="feedback-email"
                      type="email"
                      value={contactEmail}
                      onChange={(e) => {
                        setContactEmail(e.target.value);
                        if (emailError)
                          setEmailError(validateEmail(e.target.value));
                      }}
                      onBlur={() => setEmailError(validateEmail(contactEmail))}
                      placeholder={t("feedback.contactEmailPlaceholder")}
                      aria-invalid={!!emailError}
                      aria-describedby={
                        emailError ? "feedback-email-error" : undefined
                      }
                    />
                    {emailError && (
                      <p
                        id="feedback-email-error"
                        className="text-sm text-destructive"
                        role="alert"
                      >
                        {emailError}
                      </p>
                    )}
                  </div>

                  {/* Include diagnostics */}
                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <Label className="text-sm font-medium">
                        {t("feedback.includeDiagnostics")}
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        {t("feedback.includeDiagnosticsDesc")}
                      </p>
                    </div>
                    <Switch
                      checked={includeDiagnostics}
                      onCheckedChange={setIncludeDiagnostics}
                    />
                  </div>
                </div>
              </ScrollArea>

              <DialogFooter className="flex-row justify-between sm:justify-between gap-2 pt-2">
                <div className="flex gap-1.5">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleOpenGitHub}
                    className="gap-1.5 text-muted-foreground"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    {t("feedback.openOnGitHub")}
                  </Button>
                  {/* Optimization 7: History button */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setHistoryOpen(true)}
                    className="gap-1.5 text-muted-foreground"
                  >
                    <History className="h-3.5 w-3.5" />
                    {t("feedback.viewHistory")}
                  </Button>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={handleClose}>
                    {t("common.cancel")}
                  </Button>
                  <Button onClick={handleSubmit} disabled={!canSubmit}>
                    {submitting ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4 mr-2" />
                    )}
                    {t("feedback.submit")}
                  </Button>
                </div>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Optimization 5: Screenshot preview dialog */}
      {screenshot && (
        <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
          <DialogContent className="max-w-3xl p-2">
            <DialogHeader className="sr-only">
              <DialogTitle>Screenshot preview</DialogTitle>
              <DialogDescription>
                Preview of the selected feedback screenshot.
              </DialogDescription>
            </DialogHeader>
            <Image
              src={screenshot}
              alt="Screenshot full preview"
              width={1920}
              height={1080}
              unoptimized
              className="w-full h-auto rounded"
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Optimization 7: Feedback history dialog */}
      <FeedbackHistoryDialog open={historyOpen} onOpenChange={setHistoryOpen} />
    </>
  );
}

// ---------------------------------------------------------------------------
// Optimization 7: Feedback History Dialog (co-located, uses existing hook)
// ---------------------------------------------------------------------------

interface FeedbackHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function FeedbackHistoryDialog({
  open,
  onOpenChange,
}: FeedbackHistoryDialogProps) {
  const { t } = useLocale();
  const { listFeedbacks, deleteFeedback, exportFeedbackJson } = useFeedback();
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    const load = async () => {
      try {
        const result = await listFeedbacks();
        if (!cancelled) {
          setItems(result);
        }
      } catch (err) {
        console.error("Failed to load feedback history:", err);
        toast.error(t("feedback.historyLoadFailed"));
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [open, listFeedbacks, t]);

  const handleDelete = async (id: string) => {
    try {
      await deleteFeedback(id);
      setItems((prev) => prev.filter((i) => i.id !== id));
    } catch (err) {
      console.error("Failed to delete feedback:", err);
      toast.error(t("feedback.historyDeleteFailed"));
    }
  };

  const handleExport = async (id: string) => {
    try {
      const json = await exportFeedbackJson(id);
      if (!json) return;
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `feedback-${id}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Failed to export feedback:", err);
      toast.error(t("feedback.historyExportFailed"));
    }
  };

  const filtered = query
    ? items.filter((i) => i.title.toLowerCase().includes(query.toLowerCase()))
    : items;

  const categoryVariant = (cat: string) => {
    if (cat === "bug" || cat === "crash") return "destructive" as const;
    return "secondary" as const;
  };

  if (!isTauri()) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("feedback.history")}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-4">
            {t("feedback.historyDesc")}
          </p>
          <p className="text-xs text-muted-foreground">
            {t("feedback.historyWebLimited")}
          </p>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between gap-4">
            <DialogTitle>{t("feedback.history")}</DialogTitle>
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("feedback.historyDesc")}
              className="w-56 h-8"
            />
          </div>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <History className="h-12 w-12 mb-4 opacity-50" />
            <p className="text-sm font-medium">{t("feedback.noHistory")}</p>
            <p className="text-xs">{t("feedback.noHistoryDesc")}</p>
          </div>
        ) : (
          <ScrollArea className="flex-1">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("feedback.titleLabel")}</TableHead>
                  <TableHead>{t("feedback.category")}</TableHead>
                  <TableHead>{t("feedback.severity")}</TableHead>
                  <TableHead className="text-right">
                    {t("common.actions")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="min-w-[200px]">
                      <div className="space-y-0.5">
                        <p className="font-medium truncate" title={item.title}>
                          {item.title}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(item.createdAt).toLocaleString()}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={categoryVariant(item.category)}>
                        {t(`feedback.categories.${item.category}`)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {item.severity
                        ? t(`feedback.severities.${item.severity}`)
                        : "\u2014"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => handleExport(item.id)}
                            >
                              <Download className="h-3.5 w-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            {t("feedback.exportJson")}
                          </TooltipContent>
                        </Tooltip>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>
                                {t("feedback.deleteConfirm")}
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                {t("feedback.deleteConfirmDesc")}
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>
                                {t("common.cancel")}
                              </AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDelete(item.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                {t("common.delete")}
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
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
