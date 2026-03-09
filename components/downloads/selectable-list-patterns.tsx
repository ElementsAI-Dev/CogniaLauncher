"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SelectableCardButtonProps {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
}

export function SelectableCardButton({
  selected,
  onClick,
  children,
  className,
  disabled,
}: SelectableCardButtonProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      data-state={selected ? "selected" : "unselected"}
      aria-pressed={selected}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "h-auto w-full justify-start rounded-md border px-3 py-2 text-left font-normal whitespace-normal transition-colors",
        selected
          ? "border-primary bg-primary/10 hover:bg-primary/15"
          : "border-transparent hover:border-border hover:bg-muted",
        className,
      )}
    >
      {children}
    </Button>
  );
}

type SelectionTone = "default" | "success";

interface SelectableCheckboxRowClassOptions {
  selected: boolean;
  disabled?: boolean;
  tone?: SelectionTone;
  className?: string;
}

export function selectableCheckboxRowClass({
  selected,
  disabled = false,
  tone = "default",
  className,
}: SelectableCheckboxRowClassOptions) {
  const selectedClass =
    tone === "success"
      ? "border-green-500/20 bg-green-500/5 hover:bg-green-500/10"
      : "border-primary bg-primary/10 hover:bg-primary/15";

  return cn(
    "flex items-center gap-2 rounded-md border p-2 transition-colors",
    selected
      ? selectedClass
      : "border-transparent hover:border-border hover:bg-muted",
    disabled && "opacity-60",
    className,
  );
}
