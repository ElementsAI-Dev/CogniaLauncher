"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const toolbarRowVariants = cva("flex flex-wrap items-center gap-2", {
  variants: {
    density: {
      default: "min-h-10",
      dense: "min-h-9",
    },
  },
  defaultVariants: {
    density: "dense",
  },
});

const toolbarClusterVariants = cva(
  "inline-flex min-h-9 items-center rounded-lg border border-border/60 bg-muted/30 p-1 shadow-xs",
  {
    variants: {
      compact: {
        false: "gap-1",
        true: "gap-0.5 p-0.5",
      },
      wrap: {
        false: "flex-nowrap",
        true: "flex-wrap",
      },
    },
    defaultVariants: {
      compact: false,
      wrap: false,
    },
  },
);

function ToolbarRow({
  className,
  density,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof toolbarRowVariants>) {
  return (
    <div
      data-slot="toolbar-row"
      data-density={density}
      className={cn(toolbarRowVariants({ density }), className)}
      {...props}
    />
  );
}

function ToolbarCluster({
  className,
  compact,
  wrap,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof toolbarClusterVariants>) {
  return (
    <div
      data-slot="toolbar-cluster"
      data-compact={compact ? "true" : "false"}
      data-wrap={wrap ? "true" : "false"}
      className={cn(toolbarClusterVariants({ compact, wrap }), className)}
      {...props}
    />
  );
}

const denseToolbarControl = {
  input: "h-9",
  selectTrigger: "h-9",
  button: "h-9",
  iconButton: "h-9 w-9 p-0",
  iconButtonInset: "h-8 w-8 p-0",
  toggleIconItem: "h-9 w-9 px-0",
} as const;

export { ToolbarCluster, ToolbarRow, denseToolbarControl };
