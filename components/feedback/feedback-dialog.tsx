"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import { useLocale } from "@/components/providers/locale-provider";
import { useFeedbackStore } from "@/lib/stores/feedback";
import { useFeedback } from "@/hooks/feedback/use-feedback";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSet,
} from "@/components/ui/field";
import {
  InputGroup,
  InputGroupInput,
  InputGroupTextarea,
} from "@/components/ui/input-group";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { openExternal } from "@/lib/tauri";
import type {
  FeedbackCategory,
  FeedbackSeverity,
  FeedbackFormData,
  FeedbackReleaseContext,
} from "@/types/feedback";
import {
  FEEDBACK_CATEGORIES,
  FEEDBACK_SEVERITIES,
  SEVERITY_CATEGORIES,
} from "@/types/feedback";
import { FeedbackHistoryDialog } from "./feedback-history-dialog";

const CATEGORY_ICONS: Record<FeedbackCategory, React.ElementType> = {
  bug: Bug,
  feature: Lightbulb,
  performance: Gauge,
  crash: AlertTriangle,
  question: HelpCircle,
  other: MoreHorizontal,
};

const SUCCESS_CLOSE_DELAY_MS = 1800;

function shouldPersistDraft(title: string, description: string) {
  return title.trim().length > 0 || description.trim().length > 0;
}

function buildDraftData({
  category,
  severity,
  title,
  description,
  contactEmail,
  includeDiagnostics,
}: {
  category: FeedbackCategory;
  severity: FeedbackSeverity;
  title: string;
  description: string;
  contactEmail: string;
  includeDiagnostics: boolean;
}): Partial<FeedbackFormData> {
  return {
    category,
    severity: SEVERITY_CATEGORIES.includes(category) ? severity : undefined,
    title,
    description,
    contactEmail: contactEmail || undefined,
    includeDiagnostics,
  };
}

interface FeedbackSubmitSuccessProps {
  thankYouLabel: string;
  thankYouDescription: string;
}

function FeedbackSubmitSuccess({
  thankYouLabel,
  thankYouDescription,
}: FeedbackSubmitSuccessProps) {
  return (
    <div className="flex min-h-80 flex-1 flex-col items-center justify-center gap-3 px-6 py-12">
      <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
        <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
      </div>
      <p className="text-lg font-semibold">{thankYouLabel}</p>
      <p className="text-sm text-muted-foreground text-center">{thankYouDescription}</p>
    </div>
  );
}

export function FeedbackDialog() {
  const { t } = useLocale();
  const {
    dialogOpen,
    preSelectedCategory,
    preFilledErrorContext,
    preFilledReleaseContext,
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
  const [titleTouched, setTitleTouched] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [restoredFromDraft, setRestoredFromDraft] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [releaseContext, setReleaseContext] = useState<FeedbackReleaseContext | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const successTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearSuccessTimeout = useCallback(() => {
    if (successTimeoutRef.current) {
      clearTimeout(successTimeoutRef.current);
      successTimeoutRef.current = null;
    }
  }, []);

  const resetForm = useCallback(() => {
    clearSuccessTimeout();
    setCategory("bug");
    setSeverity("medium");
    setTitle("");
    setDescription("");
    setContactEmail("");
    setIncludeDiagnostics(true);
    setScreenshot(null);
    setCapturingScreenshot(false);
    setTitleTouched(false);
    setEmailError(null);
    setRestoredFromDraft(false);
    setDragOver(false);
    setPreviewOpen(false);
    setSubmitted(false);
    setReleaseContext(null);
  }, [clearSuccessTimeout]);

  useEffect(() => {
    if (!dialogOpen) return;

    resetForm();

    const initialCategory = preSelectedCategory ?? draft?.category ?? "bug";
    setCategory(initialCategory);
    setReleaseContext(preFilledReleaseContext ?? null);

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
      if (initialCategory === "crash" || initialCategory === "bug") {
        setSeverity("high");
      }
      return;
    }

    if (draft) {
      if (draft.title) setTitle(draft.title);
      if (draft.description) setDescription(draft.description);
      if (draft.contactEmail) setContactEmail(draft.contactEmail);
      if (draft.severity) setSeverity(draft.severity);
      if (typeof draft.includeDiagnostics === "boolean") {
        setIncludeDiagnostics(draft.includeDiagnostics);
      }
      setRestoredFromDraft(true);
    }
  }, [dialogOpen, preSelectedCategory, preFilledErrorContext, draft, resetForm]);

  useEffect(() => {
    return () => {
      clearSuccessTimeout();
    };
  }, [clearSuccessTimeout]);

  const handleClose = useCallback(() => {
    clearSuccessTimeout();
    if (shouldPersistDraft(title, description)) {
      saveDraft(
        buildDraftData({
          category,
          severity,
          title,
          description,
          contactEmail,
          includeDiagnostics,
        }),
      );
    }
    closeDialog();
  }, [
    title,
    description,
    category,
    severity,
    contactEmail,
    includeDiagnostics,
    clearSuccessTimeout,
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
      releaseContext: releaseContext || undefined,
    };

    const outcome = await submitFeedback(data, t);
    if (outcome.success) {
      clearDraft();
      resetForm();
      setSubmitted(true);
      clearSuccessTimeout();
      successTimeoutRef.current = setTimeout(() => {
        setSubmitted(false);
        successTimeoutRef.current = null;
        closeDialog();
      }, SUCCESS_CLOSE_DELAY_MS);
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
    releaseContext,
    submitFeedback,
    clearDraft,
    clearSuccessTimeout,
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
          return (
            el.getAttribute("role") === "dialog" ||
            el.getAttribute("data-radix-portal") !== null
          );
        },
      });
      setScreenshot(canvas.toDataURL("image/png", 0.8));
    } catch {
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
    (value: string) =>
      value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
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
  const titleInvalid = titleTouched && !title.trim();
  const CategoryIcon = CATEGORY_ICONS[category];
  const releaseSourceLabel = releaseContext
    ? t(`feedback.releaseSource.${releaseContext.source}`)
    : null;
  const releaseTriggerLabel = releaseContext
    ? t(`feedback.releaseTrigger.${releaseContext.trigger}`)
    : null;

  return (
    <>
      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!open) handleClose();
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col overflow-hidden p-0">
          {submitted ? (
            <FeedbackSubmitSuccess
              thankYouLabel={t("feedback.thankYou")}
              thankYouDescription={t("feedback.thankYouDesc")}
            />
          ) : (
            <>
              <DialogHeader className="border-b px-6 py-4">
                <DialogTitle className="flex items-center gap-2">
                  <CategoryIcon className="h-5 w-5" />
                  {t("feedback.title")}
                </DialogTitle>
                <DialogDescription>{t("feedback.description")}</DialogDescription>
              </DialogHeader>

              <ScrollArea className="flex-1 px-6">
                <FieldGroup className="py-4 gap-5">
                  {releaseContext ? (
                    <Alert className="mb-1">
                      <Info className="h-4 w-4" />
                      <AlertDescription className="space-y-2">
                        <p className="font-medium">{t("feedback.releaseContextTitle")}</p>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <span>{t("feedback.releaseContextVersion")}:</span>
                          <Badge variant="outline">{releaseContext.version}</Badge>
                          {releaseSourceLabel ? (
                            <>
                              <span>{t("feedback.releaseContextSource")}:</span>
                              <Badge variant="outline">{releaseSourceLabel}</Badge>
                            </>
                          ) : null}
                          {releaseTriggerLabel ? (
                            <>
                              <span>{t("feedback.releaseContextTrigger")}:</span>
                              <Badge variant="outline">{releaseTriggerLabel}</Badge>
                            </>
                          ) : null}
                        </div>
                      </AlertDescription>
                    </Alert>
                  ) : null}

                  {restoredFromDraft && (
                    <Alert className="mb-1">
                      <Info className="h-4 w-4" />
                      <AlertDescription className="flex items-center justify-between gap-2">
                        <span>{t("feedback.draftRestored")}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-xs"
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

                  <FieldSet className="gap-4">
                    <Field>
                      <FieldLabel>{t("feedback.category")}</FieldLabel>
                      <FieldContent>
                        <ToggleGroup
                          type="single"
                          value={category}
                          onValueChange={(value) => {
                            if (value) {
                              setCategory(value as FeedbackCategory);
                            }
                          }}
                          className="grid w-full grid-cols-2 gap-2 sm:grid-cols-3"
                          spacing={2}
                          aria-label={t("feedback.category")}
                        >
                          {FEEDBACK_CATEGORIES.map((cat) => {
                            const Icon = CATEGORY_ICONS[cat];
                            return (
                              <ToggleGroupItem
                                key={cat}
                                value={cat}
                                className="h-9 justify-start gap-1.5 rounded-md border bg-background px-2.5 text-xs data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                                aria-label={t(`feedback.categories.${cat}`)}
                              >
                                <Icon className="h-3.5 w-3.5" />
                                <span className="truncate">{t(`feedback.categories.${cat}`)}</span>
                              </ToggleGroupItem>
                            );
                          })}
                        </ToggleGroup>
                      </FieldContent>
                    </Field>

                    {showSeverity && (
                      <Field>
                        <FieldLabel>{t("feedback.severity")}</FieldLabel>
                        <FieldContent>
                          <ToggleGroup
                            type="single"
                            value={severity}
                            onValueChange={(value) => {
                              if (value) {
                                setSeverity(value as FeedbackSeverity);
                              }
                            }}
                            className="grid w-full grid-cols-2 gap-2 sm:grid-cols-4"
                            spacing={2}
                            aria-label={t("feedback.severity")}
                          >
                            {FEEDBACK_SEVERITIES.map((item) => (
                              <ToggleGroupItem
                                key={item}
                                value={item}
                                className="h-9 justify-center rounded-md border bg-background px-2 text-xs data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                                aria-label={t(`feedback.severities.${item}`)}
                              >
                                {t(`feedback.severities.${item}`)}
                              </ToggleGroupItem>
                            ))}
                          </ToggleGroup>
                        </FieldContent>
                      </Field>
                    )}

                    <Field data-invalid={titleInvalid || undefined}>
                      <div className="flex items-center justify-between gap-3">
                        <FieldLabel htmlFor="feedback-title">
                          {t("feedback.titleLabel")} <span className="text-destructive">*</span>
                        </FieldLabel>
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
                      <FieldContent>
                        <InputGroup>
                          <InputGroupInput
                            id="feedback-title"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            onBlur={() => setTitleTouched(true)}
                            placeholder={t("feedback.titlePlaceholder")}
                            maxLength={200}
                            aria-required
                            aria-invalid={titleInvalid}
                            aria-describedby={
                              titleInvalid ? "feedback-title-error" : undefined
                            }
                          />
                        </InputGroup>
                        {titleInvalid && (
                          <FieldError id="feedback-title-error">
                            {t("feedback.titleRequired")}
                          </FieldError>
                        )}
                      </FieldContent>
                    </Field>

                    <Field>
                      <div className="flex items-center justify-between gap-3">
                        <FieldLabel htmlFor="feedback-desc">
                          {t("feedback.descriptionLabel")}
                        </FieldLabel>
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {description.length}/5000
                        </span>
                      </div>
                      <FieldContent>
                        <InputGroup className="min-h-30 items-stretch">
                          <InputGroupTextarea
                            id="feedback-desc"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder={t("feedback.descriptionPlaceholder")}
                            rows={5}
                            maxLength={5000}
                            className="min-h-30 resize-y"
                          />
                        </InputGroup>
                      </FieldContent>
                    </Field>

                    {preFilledErrorContext?.message && (
                      <div className="flex items-center gap-2">
                        <Badge variant="destructive" className="text-xs">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          {t("feedback.errorAttached")}
                        </Badge>
                      </div>
                    )}

                    <Field>
                      <FieldLabel>{t("feedback.screenshot")}</FieldLabel>
                      <FieldContent>
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
                      </FieldContent>
                    </Field>

                    <Field data-invalid={!!emailError || undefined}>
                      <FieldLabel htmlFor="feedback-email">
                        {t("feedback.contactEmail")}
                      </FieldLabel>
                      <FieldContent>
                        <InputGroup>
                          <InputGroupInput
                            id="feedback-email"
                            type="email"
                            value={contactEmail}
                            onChange={(e) => {
                              setContactEmail(e.target.value);
                              if (emailError) {
                                setEmailError(validateEmail(e.target.value));
                              }
                            }}
                            onBlur={() => setEmailError(validateEmail(contactEmail))}
                            placeholder={t("feedback.contactEmailPlaceholder")}
                            aria-invalid={!!emailError}
                            aria-describedby={
                              emailError ? "feedback-email-error" : undefined
                            }
                          />
                        </InputGroup>
                        {emailError && (
                          <FieldError id="feedback-email-error">{emailError}</FieldError>
                        )}
                      </FieldContent>
                    </Field>

                    <Field orientation="responsive" className="rounded-lg border p-3">
                      <FieldContent className="gap-0.5">
                        <FieldLabel htmlFor="feedback-diagnostics" className="text-sm font-medium">
                          {t("feedback.includeDiagnostics")}
                        </FieldLabel>
                        <FieldDescription className="text-xs">
                          {t("feedback.includeDiagnosticsDesc")}
                        </FieldDescription>
                      </FieldContent>
                      <Switch
                        id="feedback-diagnostics"
                        checked={includeDiagnostics}
                        onCheckedChange={setIncludeDiagnostics}
                      />
                    </Field>
                  </FieldSet>
                </FieldGroup>
              </ScrollArea>

              <DialogFooter className="border-t px-6 py-4">
                <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-wrap gap-1.5">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleOpenGitHub}
                      className="gap-1.5 text-muted-foreground"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      {t("feedback.openOnGitHub")}
                    </Button>
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
                  <div className="flex flex-wrap justify-end gap-2">
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
                </div>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

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

      <FeedbackHistoryDialog open={historyOpen} onOpenChange={setHistoryOpen} />
    </>
  );
}
