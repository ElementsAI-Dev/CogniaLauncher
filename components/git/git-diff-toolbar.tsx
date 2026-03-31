"use client";

import { useLocale } from "@/components/providers/locale-provider";
import { ToolbarRow, ToolbarCluster, denseToolbarControl } from "@/components/ui/toolbar";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export interface GitDiffToolbarProps {
  repoPath: string | null;
  diffLoading: boolean;
  compareFrom: string;
  compareTo: string;
  contextLines: number | undefined;
  onCompareFromChange: (value: string) => void;
  onCompareToChange: (value: string) => void;
  onContextLinesChange: (value: number | undefined) => void;
  onShowUnstaged: () => void;
  onShowStaged: () => void;
  onCompare: () => void;
}

export function GitDiffToolbar({
  repoPath,
  diffLoading,
  compareFrom,
  compareTo,
  contextLines,
  onCompareFromChange,
  onCompareToChange,
  onContextLinesChange,
  onShowUnstaged,
  onShowStaged,
  onCompare,
}: GitDiffToolbarProps) {
  const { t } = useLocale();

  return (
    <ToolbarRow>
      <ToolbarCluster>
        <Button
          variant="outline"
          size="sm"
          className={denseToolbarControl.button}
          onClick={onShowUnstaged}
          disabled={!repoPath}
        >
          {t("git.diffView.unstaged")}
        </Button>
        <Button
          variant="outline"
          size="sm"
          className={denseToolbarControl.button}
          onClick={onShowStaged}
          disabled={!repoPath}
        >
          {t("git.diffView.staged")}
        </Button>
      </ToolbarCluster>
      <ToolbarCluster>
        <input
          type="text"
          placeholder={t("git.diffView.fromCommit")}
          value={compareFrom}
          onChange={(e) => onCompareFromChange(e.target.value)}
          className={cn(
            denseToolbarControl.input,
            "w-28 rounded-md border border-input bg-background px-2 text-xs font-mono placeholder:text-muted-foreground",
          )}
        />
        <span className="self-center text-xs text-muted-foreground">..</span>
        <input
          type="text"
          placeholder={t("git.diffView.toCommit")}
          value={compareTo}
          onChange={(e) => onCompareToChange(e.target.value)}
          className={cn(
            denseToolbarControl.input,
            "w-28 rounded-md border border-input bg-background px-2 text-xs font-mono placeholder:text-muted-foreground",
          )}
        />
        <Button
          variant="outline"
          size="sm"
          className={denseToolbarControl.button}
          disabled={
            !repoPath ||
            !compareFrom.trim() ||
            !compareTo.trim() ||
            diffLoading
          }
          onClick={onCompare}
        >
          {t("git.diffView.compare")}
        </Button>
      </ToolbarCluster>
      <ToolbarCluster>
        <Select
          value={
            contextLines === undefined ? "default" : String(contextLines)
          }
          onValueChange={(v) =>
            onContextLinesChange(v === "default" ? undefined : Number(v))
          }
        >
          <SelectTrigger
            className={cn(denseToolbarControl.selectTrigger, "w-[100px] text-xs")}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="default">
              {t("git.diffView.contextDefault")}
            </SelectItem>
            <SelectItem value="5">
              5 {t("git.diffView.contextLines")}
            </SelectItem>
            <SelectItem value="10">
              10 {t("git.diffView.contextLines")}
            </SelectItem>
            <SelectItem value="20">
              20 {t("git.diffView.contextLines")}
            </SelectItem>
            <SelectItem value="50">
              {t("git.diffView.contextAll")}
            </SelectItem>
          </SelectContent>
        </Select>
      </ToolbarCluster>
    </ToolbarRow>
  );
}
