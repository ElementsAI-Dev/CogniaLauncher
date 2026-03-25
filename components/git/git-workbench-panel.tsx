"use client";

import type { ReactNode } from "react";
import { ChevronDown, ChevronUp, EyeOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import type { GitWorkbenchPanelPreference } from "@/lib/stores/git";
import { cn } from "@/lib/utils";

interface GitWorkbenchPanelProps {
  panelId: string;
  title: string;
  description?: string;
  state: GitWorkbenchPanelPreference;
  onToggleCollapsed: () => void;
  onHide: () => void;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
}

export function GitWorkbenchPanel({
  panelId,
  title,
  description,
  state,
  onToggleCollapsed,
  onHide,
  children,
  className,
  contentClassName,
}: GitWorkbenchPanelProps) {
  return (
    <Card
      data-testid={`git-workbench-panel-${panelId}`}
      className={cn("gap-0 py-0", className)}
    >
      <CardHeader className={state.collapsed ? "py-3" : "pb-3 pt-5"}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="text-base">{title}</CardTitle>
            {description ? <CardDescription>{description}</CardDescription> : null}
          </div>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              size="icon-xs"
              variant="ghost"
              data-testid={`git-workbench-toggle-${panelId}`}
              onClick={onToggleCollapsed}
            >
              {state.collapsed ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronUp className="h-3.5 w-3.5" />
              )}
            </Button>
            <Button
              type="button"
              size="icon-xs"
              variant="ghost"
              data-testid={`git-workbench-hide-${panelId}`}
              onClick={onHide}
            >
              <EyeOff className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <Collapsible open={!state.collapsed}>
        <CollapsibleContent>
          <CardContent className={cn("pt-0", contentClassName)}>
            {children}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
