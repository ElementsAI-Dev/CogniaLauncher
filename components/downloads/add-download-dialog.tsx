"use client";

import { useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { useLocale } from "@/components/providers/locale-provider";
import { DestinationPicker } from "./destination-picker";
import type { DownloadRequest } from "@/lib/stores/download";
import { isTauri } from "@/lib/tauri";
import { isValidUrl, inferNameFromUrl } from "@/lib/downloads";
import { DEFAULT_DOWNLOAD_FORM, SEGMENT_OPTIONS, POST_ACTION_OPTIONS } from "@/lib/constants/downloads";

interface AddDownloadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (request: DownloadRequest) => Promise<void>;
  initialUrl?: string;
}


export function AddDownloadDialog({
  open,
  onOpenChange,
  onSubmit,
  initialUrl,
}: AddDownloadDialogProps) {
  const { t } = useLocale();
  const [form, setForm] = useState(DEFAULT_DOWNLOAD_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const nameManuallyEdited = useRef(false);

  useEffect(() => {
    if (!open) {
      setForm(DEFAULT_DOWNLOAD_FORM);
      nameManuallyEdited.current = false;
    } else if (initialUrl) {
      setForm((prev) => ({ ...prev, url: initialUrl }));
    }
  }, [open, initialUrl]);

  useEffect(() => {
    if (!nameManuallyEdited.current && !form.name.trim() && form.url.trim()) {
      setForm((prev) => ({
        ...prev,
        name: inferNameFromUrl(prev.url),
      }));
    }
  }, [form.url, form.name]);

  const urlTrimmed = form.url.trim();
  const urlValid = !urlTrimmed || isValidUrl(urlTrimmed);
  const isValid =
    urlTrimmed && urlValid && form.destination.trim() && form.name.trim();

  const handleSubmit = async () => {
    if (!isValid) return;

    setIsSubmitting(true);
    try {
      await onSubmit({
        url: form.url.trim(),
        destination: form.destination.trim(),
        name: form.name.trim(),
        checksum: form.checksum.trim() || undefined,
        priority: form.priority ? Number(form.priority) : undefined,
        provider: form.provider.trim() || undefined,
        autoExtract: form.autoExtract || undefined,
        extractDest: form.extractDest.trim() || undefined,
        segments: form.segments !== "1" ? Number(form.segments) : undefined,
        mirrorUrls: form.mirrorUrls.length > 0 ? form.mirrorUrls : undefined,
        postAction: form.postAction !== "none" ? form.postAction as DownloadRequest['postAction'] : undefined,
      });
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="text-xl">
            {t("downloads.addDownload")}
          </DialogTitle>
          <DialogDescription>
            {t("downloads.description")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="download-url">{t("downloads.url")}</Label>
            <Input
              id="download-url"
              value={form.url}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, url: event.target.value }))
              }
              placeholder="https://example.com/file.zip"
            />
            {urlTrimmed && !urlValid && (
              <p className="text-xs text-destructive">
                {t('downloads.validation.invalidUrl')}
              </p>
            )}
          </div>

          <DestinationPicker
            value={form.destination}
            onChange={(val) =>
              setForm((prev) => ({ ...prev, destination: val }))
            }
            placeholder="/path/to/file.zip"
            label={t("downloads.destination")}
            isDesktop={isTauri()}
            browseTooltip={t("downloads.browseFolder")}
            manualPathMessage={t("downloads.manualPathRequired")}
            errorMessage={t("downloads.dialogError")}
            mode="save"
            defaultFileName={form.name || "download"}
            dialogTitle={t("downloads.selectDestination")}
          />

          <div className="space-y-2">
            <Label htmlFor="download-name">{t("downloads.name")}</Label>
            <Input
              id="download-name"
              value={form.name}
              onChange={(event) => {
                nameManuallyEdited.current = true;
                setForm((prev) => ({ ...prev, name: event.target.value }));
              }}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="download-provider">{t("downloads.provider")}</Label>
            <Input
              id="download-provider"
              value={form.provider}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, provider: event.target.value }))
              }
              placeholder={t("downloads.providerPlaceholder")}
            />
          </div>

          <Separator />

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="download-priority">
                {t("downloads.priority")}
              </Label>
              <Select
                value={form.priority}
                onValueChange={(val) =>
                  setForm((prev) => ({ ...prev, priority: val }))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t("downloads.priorityPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">{t("downloads.priorityCritical")}</SelectItem>
                  <SelectItem value="8">{t("downloads.priorityHigh")}</SelectItem>
                  <SelectItem value="5">{t("downloads.priorityNormal")}</SelectItem>
                  <SelectItem value="1">{t("downloads.priorityLow")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="download-checksum">
                {t("downloads.checksum")}
              </Label>
              <Input
                id="download-checksum"
                value={form.checksum}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, checksum: event.target.value }))
                }
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>{t("downloads.mirrors")}</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() =>
                  setForm((prev) => ({
                    ...prev,
                    mirrorUrls: [...prev.mirrorUrls, ""],
                  }))
                }
              >
                + {t("downloads.addMirror")}
              </Button>
            </div>
            {form.mirrorUrls.map((mirror, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <Input
                  value={mirror}
                  onChange={(e) => {
                    const updated = [...form.mirrorUrls];
                    updated[idx] = e.target.value;
                    setForm((prev) => ({ ...prev, mirrorUrls: updated }));
                  }}
                  placeholder={`https://mirror${idx + 1}.example.com/file.zip`}
                  className="flex-1 text-xs"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 flex-shrink-0"
                  onClick={() => {
                    const updated = form.mirrorUrls.filter((_, i) => i !== idx);
                    setForm((prev) => ({ ...prev, mirrorUrls: updated }));
                  }}
                >
                  ×
                </Button>
              </div>
            ))}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="auto-extract"
                  checked={form.autoExtract}
                  onCheckedChange={(checked) =>
                    setForm((prev) => ({ ...prev, autoExtract: checked === true }))
                  }
                />
                <Label htmlFor="auto-extract" className="text-sm font-normal">
                  {t("downloads.settings.autoExtract")}
                </Label>
              </div>
              {form.autoExtract && (
                <DestinationPicker
                  value={form.extractDest}
                  onChange={(val) =>
                    setForm((prev) => ({ ...prev, extractDest: val }))
                  }
                  placeholder={t("downloads.extractDestPlaceholder")}
                  label={t("downloads.extractDest")}
                  isDesktop={isTauri()}
                  browseTooltip={t("downloads.browseFolder")}
                  manualPathMessage={t("downloads.manualPathRequired")}
                  errorMessage={t("downloads.dialogError")}
                  mode="directory"
                  dialogTitle={t("downloads.selectExtractDest")}
                />
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="download-segments">
                {t("downloads.segments")}
              </Label>
              <Select
                value={form.segments}
                onValueChange={(val) =>
                  setForm((prev) => ({ ...prev, segments: val }))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SEGMENT_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label} {opt.value === "1" ? t("downloads.segmentsSingle") : t("downloads.segmentsParallel")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t("downloads.postAction")}</Label>
            <Select
              value={form.postAction}
              onValueChange={(val) =>
                setForm((prev) => ({ ...prev, postAction: val }))
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {POST_ACTION_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {t(`downloads.postAction.${opt.label}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter className="pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button onClick={handleSubmit} disabled={!isValid || isSubmitting}>
            {isSubmitting ? t("common.loading") : t("common.add")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
