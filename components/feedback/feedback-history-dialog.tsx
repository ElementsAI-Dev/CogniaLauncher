"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale } from "@/components/providers/locale-provider";
import { useFeedback } from "@/hooks/use-feedback";
import { isTauri } from "@/lib/platform";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  InputGroup,
  InputGroupInput,
} from "@/components/ui/input-group";
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
import { Download, History, Loader2, Trash2 } from "lucide-react";
import type { FeedbackItem } from "@/types/feedback";

interface FeedbackHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function categoryVariant(category: string) {
  if (category === "bug" || category === "crash") {
    return "destructive" as const;
  }
  return "secondary" as const;
}

export function FeedbackHistoryDialog({
  open,
  onOpenChange,
}: FeedbackHistoryDialogProps) {
  const { t } = useLocale();
  const { listFeedbacks, deleteFeedback, exportFeedbackJson } = useFeedback();
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const tauriMode = isTauri();

  const loadItems = async () => {
    setLoading(true);
    setLoadError(null);

    try {
      const result = await listFeedbacks();
      setItems(result);
    } catch (err) {
      console.error("Failed to load feedback history:", err);
      setLoadError(t("feedback.historyLoadFailed"));
      toast.error(t("feedback.historyLoadFailed"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open || !tauriMode) return;

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setLoadError(null);

      try {
        const result = await listFeedbacks();
        if (!cancelled) {
          setItems(result);
        }
      } catch (err) {
        console.error("Failed to load feedback history:", err);
        if (!cancelled) {
          setLoadError(t("feedback.historyLoadFailed"));
        }
        toast.error(t("feedback.historyLoadFailed"));
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [listFeedbacks, open, t, tauriMode]);

  const filteredItems = useMemo(
    () =>
      query
        ? items.filter((item) =>
            item.title.toLowerCase().includes(query.toLowerCase()),
          )
        : items,
    [items, query],
  );

  const handleDelete = async (id: string) => {
    try {
      await deleteFeedback(id);
      setItems((prev) => prev.filter((item) => item.id !== id));
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
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `feedback-${id}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Failed to export feedback:", err);
      toast.error(t("feedback.historyExportFailed"));
    }
  };

  if (!tauriMode) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("feedback.history")}</DialogTitle>
            <DialogDescription>{t("feedback.historyDesc")}</DialogDescription>
          </DialogHeader>
          <Empty className="min-h-453 border border-dashed p-6">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <History className="size-5" />
              </EmptyMedia>
              <EmptyDescription>{t("feedback.historyWebLimited")}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <DialogTitle>{t("feedback.history")}</DialogTitle>
            <DialogDescription>{t("feedback.historyDesc")}</DialogDescription>
          </div>
          <InputGroup className="h-8 w-full sm:w-64">
            <InputGroupInput
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("feedback.historyDesc")}
              aria-label={t("feedback.historyDesc")}
              className="h-8 text-sm"
            />
          </InputGroup>
        </DialogHeader>

        {loadError && (
          <Alert>
            <AlertDescription className="flex items-center justify-between gap-2">
              <span>{loadError}</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void loadItems()}
                disabled={loading}
              >
                {t("common.retry")}
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {loading ? (
          <div className="flex min-h-55 flex-1 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filteredItems.length === 0 ? (
          <Empty className="min-h-55 gap-3 border border-dashed p-6">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <History className="size-5" />
              </EmptyMedia>
              <EmptyTitle>{t("feedback.noHistory")}</EmptyTitle>
              <EmptyDescription>{t("feedback.noHistoryDesc")}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <ScrollArea className="flex-1">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("feedback.titleLabel")}</TableHead>
                  <TableHead>{t("feedback.category")}</TableHead>
                  <TableHead>{t("feedback.severity")}</TableHead>
                  <TableHead className="text-right">{t("common.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="min-w-50">
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
                      {item.severity ? t(`feedback.severities.${item.severity}`) : "\u2014"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              aria-label={t("feedback.exportJson")}
                              onClick={() => handleExport(item.id)}
                            >
                              <Download className="h-3.5 w-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>{t("feedback.exportJson")}</TooltipContent>
                        </Tooltip>

                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive"
                              aria-label={t("common.delete")}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>{t("feedback.deleteConfirm")}</AlertDialogTitle>
                              <AlertDialogDescription>
                                {t("feedback.deleteConfirmDesc")}
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
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
