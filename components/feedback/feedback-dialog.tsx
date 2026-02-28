"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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
} from "lucide-react";
import { openExternal } from "@/lib/tauri";
import type {
  FeedbackCategory,
  FeedbackSeverity,
  FeedbackFormData,
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
      if (
        preSelectedCategory === "crash" ||
        preSelectedCategory === "bug"
      ) {
        setSeverity("high");
      }
    } else if (draft) {
      if (draft.title) setTitle(draft.title);
      if (draft.description) setDescription(draft.description);
      if (draft.contactEmail) setContactEmail(draft.contactEmail);
      if (draft.severity) setSeverity(draft.severity);
      if (typeof draft.includeDiagnostics === "boolean")
        setIncludeDiagnostics(draft.includeDiagnostics);
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
  }, []);

  const handleClose = useCallback(() => {
    // Save draft if there's content
    if (title.trim() || description.trim()) {
      saveDraft({
        category,
        severity: SEVERITY_CATEGORIES.includes(category)
          ? severity
          : undefined,
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
      closeDialog();
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
          return el.getAttribute("role") === "dialog" ||
            el.getAttribute("data-radix-portal") !== null;
        },
      });
      setScreenshot(canvas.toDataURL("image/png", 0.8));
    } catch (err) {
      console.error("Failed to capture screenshot:", err);
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
      const reader = new FileReader();
      reader.onload = () => {
        setScreenshot(reader.result as string);
      };
      reader.readAsDataURL(file);
      e.target.value = "";
    },
    [],
  );

  const handleOpenGitHub = useCallback(() => {
    const baseUrl =
      category === "feature"
        ? "https://github.com/ElementAstro/CogniaLauncher/discussions/new?category=ideas"
        : `https://github.com/ElementAstro/CogniaLauncher/issues/new?template=bug_report.md&title=${encodeURIComponent(title)}`;
    void openExternal(baseUrl);
  }, [category, title]);

  const showSeverity = SEVERITY_CATEGORIES.includes(category);
  const canSubmit = title.trim().length > 0 && !submitting;

  return (
    <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) handleClose(); }}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bug className="h-5 w-5" />
            {t("feedback.title")}
          </DialogTitle>
          <DialogDescription>{t("feedback.description")}</DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-4 py-1">
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
                  onValueChange={(v) => setSeverity(v as FeedbackSeverity)}
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

            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="feedback-title">{t("feedback.titleLabel")}</Label>
              <Input
                id="feedback-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t("feedback.titlePlaceholder")}
                maxLength={200}
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="feedback-desc">
                {t("feedback.descriptionLabel")}
              </Label>
              <Textarea
                id="feedback-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t("feedback.descriptionPlaceholder")}
                rows={5}
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

            {/* Screenshot */}
            <div className="space-y-2">
              <Label>{t("feedback.screenshot")}</Label>
              <div className="flex items-center gap-2">
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
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileUpload}
                />
                {screenshot && (
                  <div className="relative group">
                    <img
                      src={screenshot}
                      alt="Screenshot preview"
                      className="h-12 w-auto rounded border object-cover"
                    />
                    <button
                      onClick={() => setScreenshot(null)}
                      className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Contact email */}
            <div className="space-y-2">
              <Label htmlFor="feedback-email">
                {t("feedback.contactEmail")}
              </Label>
              <Input
                id="feedback-email"
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                placeholder={t("feedback.contactEmailPlaceholder")}
              />
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
          <Button
            variant="ghost"
            size="sm"
            onClick={handleOpenGitHub}
            className="gap-1.5 text-muted-foreground"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            {t("feedback.openOnGitHub")}
          </Button>
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
      </DialogContent>
    </Dialog>
  );
}
