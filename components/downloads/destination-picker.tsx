"use client";

import { useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { FolderOpen } from "lucide-react";
import { toast } from "sonner";

interface DestinationPickerProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  label: string;
  isDesktop: boolean;
  browseTooltip: string;
  manualPathMessage?: string;
  errorMessage?: string;
  /** Use "save" for file destination, "directory" for folder selection */
  mode?: "save" | "directory";
  defaultFileName?: string;
  dialogTitle?: string;
}

export function DestinationPicker({
  value,
  onChange,
  placeholder,
  label,
  isDesktop,
  browseTooltip,
  manualPathMessage,
  errorMessage,
  mode = "directory",
  defaultFileName,
  dialogTitle,
}: DestinationPickerProps) {
  const handleBrowse = useCallback(async () => {
    if (!isDesktop) {
      if (manualPathMessage) {
        toast.info(manualPathMessage);
      }
      return;
    }

    try {
      const dialogModule = await import("@tauri-apps/plugin-dialog");
      if (mode === "save") {
        const selected = await dialogModule.save({
          defaultPath: defaultFileName || "download",
          title: dialogTitle,
        });
        if (selected && typeof selected === "string") {
          onChange(selected);
        }
      } else {
        const selected = await dialogModule.open({
          directory: true,
          multiple: false,
        });
        if (selected && typeof selected === "string") {
          onChange(selected);
        }
      }
    } catch (err) {
      console.error("Failed to open dialog:", err);
      if (errorMessage) {
        toast.error(errorMessage);
      }
    }
  }, [
    isDesktop,
    manualPathMessage,
    errorMessage,
    mode,
    defaultFileName,
    dialogTitle,
    onChange,
  ]);

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex gap-2">
        <Input
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1"
        />
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={handleBrowse}
            >
              <FolderOpen className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{browseTooltip}</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
