"use client";

import { useCallback, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { useLocale } from "@/components/providers/locale-provider";
import { DestinationPicker } from "./destination-picker";
import { inferNameFromUrl, isValidUrl, joinDestinationPath } from "@/lib/downloads";
import { isTauri } from "@/lib/tauri";
import type { DownloadRequest } from "@/lib/stores/download";
import { FileDown, Trash2 } from "lucide-react";

interface BatchImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (requests: DownloadRequest[]) => Promise<void>;
}

interface ParsedUrl {
  url: string;
  name: string;
  valid: boolean;
}

export function BatchImportDialog({
  open,
  onOpenChange,
  onSubmit,
}: BatchImportDialogProps) {
  const { t } = useLocale();
  const [rawText, setRawText] = useState("");
  const [destination, setDestination] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const parsedUrls = useMemo<ParsedUrl[]>(() => {
    if (!rawText.trim()) return [];
    return rawText
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((line) => ({
        url: line,
        name: inferNameFromUrl(line),
        valid: isValidUrl(line),
      }));
  }, [rawText]);

  const validCount = parsedUrls.filter((p) => p.valid).length;
  const invalidCount = parsedUrls.length - validCount;

  const handleSubmit = useCallback(async () => {
    if (validCount === 0 || !destination.trim()) return;

    setIsSubmitting(true);
    try {
      const requests: DownloadRequest[] = parsedUrls
        .filter((p) => p.valid)
        .map((p) => ({
          url: p.url,
          destination: joinDestinationPath(destination, p.name),
          name: p.name,
        }));
      await onSubmit(requests);
      onOpenChange(false);
      setRawText("");
      setDestination("");
    } finally {
      setIsSubmitting(false);
    }
  }, [validCount, destination, parsedUrls, onSubmit, onOpenChange]);

  const handleClear = useCallback(() => {
    setRawText("");
  }, []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="text-xl">
            {t("downloads.batchImport")}
          </DialogTitle>
          <DialogDescription>
            {t("downloads.batchImportDesc")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="batch-urls">
                {t("downloads.batchImportUrls")}
              </Label>
              {parsedUrls.length > 0 && (
                <div className="flex items-center gap-2">
                  <Badge variant="default" className="text-xs">
                    {validCount} {t("downloads.batchValid")}
                  </Badge>
                  {invalidCount > 0 && (
                    <Badge variant="destructive" className="text-xs">
                      {invalidCount} {t("downloads.batchInvalid")}
                    </Badge>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={handleClear}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </div>
            <Textarea
              id="batch-urls"
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder={t("downloads.batchImportPlaceholder")}
              rows={6}
              className="font-mono text-xs"
            />
          </div>

          {parsedUrls.length > 0 && (
            <ScrollArea className="h-[140px] rounded-md border p-2">
              <div className="space-y-1">
                {parsedUrls.map((p, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 text-xs py-0.5"
                  >
                    <FileDown
                      className={`h-3 w-3 flex-shrink-0 ${
                        p.valid
                          ? "text-green-500"
                          : "text-destructive"
                      }`}
                    />
                    <span
                      className={`truncate ${
                        p.valid
                          ? "text-foreground"
                          : "text-destructive line-through"
                      }`}
                      title={p.url}
                    >
                      {p.name}
                    </span>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}

          <DestinationPicker
            value={destination}
            onChange={setDestination}
            placeholder={t("downloads.batchDestPlaceholder")}
            label={t("downloads.batchDestination")}
            isDesktop={isTauri()}
            browseTooltip={t("downloads.browseFolder")}
            manualPathMessage={t("downloads.manualPathRequired")}
            errorMessage={t("downloads.dialogError")}
            mode="directory"
            dialogTitle={t("downloads.selectDestination")}
          />
        </div>

        <DialogFooter className="pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={validCount === 0 || !destination.trim() || isSubmitting}
          >
            {isSubmitting
              ? t("common.loading")
              : t("downloads.batchImportSubmit", { count: validCount })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
