"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useLocale } from "@/components/providers/locale-provider";
import type { ConflictInfo, ConflictResolutionStrategy } from "@/lib/tauri";

interface ConflictResolutionDialogProps {
  open: boolean;
  conflict: ConflictInfo | null;
  onOpenChange: (open: boolean) => void;
  onResolve: (
    strategy: ConflictResolutionStrategy,
    manualVersion?: string,
  ) => void | Promise<void>;
}

export function ConflictResolutionDialog({
  open,
  conflict,
  onOpenChange,
  onResolve,
}: ConflictResolutionDialogProps) {
  const { t } = useLocale();
  const [strategy, setStrategy] =
    useState<ConflictResolutionStrategy>("latest_compatible");
  const [manualVersion, setManualVersion] = useState("");

  const packageName = conflict?.package_name ?? conflict?.package ?? "";
  const requiredBy = useMemo(() => conflict?.required_by ?? [], [conflict]);
  const versions = useMemo(() => conflict?.versions ?? [], [conflict]);

  if (!conflict) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {t("packages.conflictDialog.title", { name: packageName })}
          </DialogTitle>
          <DialogDescription>
            {t("packages.conflictDialog.description")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <div className="text-sm font-medium">{packageName}</div>
            <div className="flex flex-wrap gap-2">
              {requiredBy.map((item) => (
                <Badge key={item} variant="secondary">
                  {item}
                </Badge>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {versions.map((version) => (
                <Badge key={version} variant="outline">
                  {version}
                </Badge>
              ))}
            </div>
          </div>

          <RadioGroup
            value={strategy}
            onValueChange={(value) =>
              setStrategy(value as ConflictResolutionStrategy)
            }
            className="space-y-3"
          >
            <div className="flex items-center gap-2">
              <RadioGroupItem
                value="latest_compatible"
                id="conflict-strategy-latest"
              />
              <Label htmlFor="conflict-strategy-latest">
                {t("packages.conflictDialog.latestCompatible")}
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem
                value="minimal_upgrade"
                id="conflict-strategy-minimal"
              />
              <Label htmlFor="conflict-strategy-minimal">
                {t("packages.conflictDialog.minimalUpgrade")}
              </Label>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <RadioGroupItem value="manual" id="conflict-strategy-manual" />
                <Label htmlFor="conflict-strategy-manual">
                  {t("packages.conflictDialog.manual")}
                </Label>
              </div>
              {strategy === "manual" ? (
                <Input
                  placeholder={t("packages.conflictDialog.manualVersion")}
                  value={manualVersion}
                  onChange={(event) => setManualVersion(event.target.value)}
                />
              ) : null}
            </div>
          </RadioGroup>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("packages.conflictDialog.cancel")}
          </Button>
          <Button
            onClick={() =>
              void onResolve(
                strategy,
                strategy === "manual" ? manualVersion || undefined : undefined,
              )
            }
          >
            {t("packages.conflictDialog.resolve")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
