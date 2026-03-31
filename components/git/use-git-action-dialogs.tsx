"use client";

import { useCallback, useRef, useState } from "react";

import { useLocale } from "@/components/providers/locale-provider";
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
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface GitConfirmDialogOptions {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
}

interface GitPromptDialogOptions {
  title: string;
  description?: string;
  label?: string;
  placeholder?: string;
  defaultValue?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  requireValue?: boolean;
}

export function useGitActionDialogs() {
  const { t } = useLocale();
  const [confirmOptions, setConfirmOptions] =
    useState<GitConfirmDialogOptions | null>(null);
  const [promptOptions, setPromptOptions] =
    useState<GitPromptDialogOptions | null>(null);
  const [promptValue, setPromptValue] = useState("");
  const confirmResolverRef = useRef<((value: boolean) => void) | null>(null);
  const promptResolverRef = useRef<((value: string | null) => void) | null>(null);
  const promptInputId = "git-action-dialog-input";

  const resolveConfirm = useCallback((value: boolean) => {
    const resolver = confirmResolverRef.current;
    confirmResolverRef.current = null;
    setConfirmOptions(null);
    resolver?.(value);
  }, []);

  const resolvePrompt = useCallback((value: string | null) => {
    const resolver = promptResolverRef.current;
    promptResolverRef.current = null;
    setPromptOptions(null);
    setPromptValue("");
    resolver?.(value);
  }, []);

  const confirm = useCallback((options: GitConfirmDialogOptions) => {
    return new Promise<boolean>((resolve) => {
      confirmResolverRef.current = resolve;
      setConfirmOptions(options);
    });
  }, []);

  const prompt = useCallback((options: GitPromptDialogOptions) => {
    return new Promise<string | null>((resolve) => {
      promptResolverRef.current = resolve;
      setPromptValue(options.defaultValue ?? "");
      setPromptOptions(options);
    });
  }, []);

  const promptRequiresValue = promptOptions?.requireValue ?? true;
  const promptConfirmDisabled =
    !!promptOptions && promptRequiresValue && !promptValue.trim();

  const dialogs = (
    <>
      <AlertDialog
        open={!!confirmOptions}
        onOpenChange={(open) => {
          if (!open) {
            resolveConfirm(false);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmOptions?.title}</AlertDialogTitle>
            {confirmOptions?.description ? (
              <AlertDialogDescription>
                {confirmOptions.description}
              </AlertDialogDescription>
            ) : null}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{confirmOptions?.cancelLabel ?? t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                resolveConfirm(true);
              }}
            >
              {confirmOptions?.confirmLabel ?? t("common.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={!!promptOptions}
        onOpenChange={(open) => {
          if (!open) {
            resolvePrompt(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{promptOptions?.title}</DialogTitle>
            {promptOptions?.description ? (
              <DialogDescription>{promptOptions.description}</DialogDescription>
            ) : null}
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor={promptInputId}>
              {promptOptions?.label ?? promptOptions?.title}
            </Label>
            <Input
              id={promptInputId}
              autoFocus
              value={promptValue}
              placeholder={promptOptions?.placeholder}
              onChange={(event) => setPromptValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !promptConfirmDisabled) {
                  event.preventDefault();
                  resolvePrompt(promptValue);
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => resolvePrompt(null)}
            >
              {promptOptions?.cancelLabel ?? t("common.cancel")}
            </Button>
            <Button
              type="button"
              onClick={() => resolvePrompt(promptValue)}
              disabled={promptConfirmDisabled}
            >
              {promptOptions?.confirmLabel ?? t("common.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );

  return {
    confirm,
    prompt,
    dialogs,
  };
}
