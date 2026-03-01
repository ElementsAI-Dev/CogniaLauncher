"use client";

import { Switch } from "@/components/ui/switch";
import { FileCode } from "lucide-react";
import type { DetectionFileConfig } from "@/lib/stores/environment";

interface DetectionFilesListProps {
  files: DetectionFileConfig[];
  onToggle: (fileName: string, enabled: boolean) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export function DetectionFilesList({
  files,
  onToggle,
  t,
}: DetectionFilesListProps) {
  if (files.length === 0) {
    return (
      <div className="text-center py-4 text-muted-foreground text-sm">
        {t("environments.detail.noDetectionFiles")}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {files.map((file) => (
        <div
          key={file.fileName}
          className="flex items-center justify-between p-3 rounded-lg bg-muted/30"
        >
          <div className="flex items-center gap-2">
            <FileCode className="h-4 w-4 text-muted-foreground" />
            <code className="font-mono text-sm">{file.fileName}</code>
          </div>
          <Switch
            checked={file.enabled}
            onCheckedChange={(checked) => onToggle(file.fileName, checked)}
          />
        </div>
      ))}
    </div>
  );
}
