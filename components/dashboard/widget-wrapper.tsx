"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, X, Eye, EyeOff, Maximize2, Minimize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useLocale } from "@/components/providers/locale-provider";
import { WIDGET_SIZE_CLASSES } from "@/lib/constants/dashboard";
import { nextWidgetSize, prevWidgetSize } from "@/lib/dashboard-utils";
import type { WidgetConfig, WidgetSize } from "@/lib/stores/dashboard";

interface WidgetWrapperProps {
  widget: WidgetConfig;
  isEditMode: boolean;
  onRemove: (id: string) => void;
  onToggleVisibility: (id: string) => void;
  onResize: (id: string, size: WidgetSize) => void;
  children: React.ReactNode;
}

export function WidgetWrapper({
  widget,
  isEditMode,
  onRemove,
  onToggleVisibility,
  onResize,
  children,
}: WidgetWrapperProps) {
  const { t } = useLocale();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: widget.id, disabled: !isEditMode });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  if (!widget.visible && !isEditMode) {
    return null;
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        WIDGET_SIZE_CLASSES[widget.size],
        "relative group/widget transition-all duration-200 [&>*]:h-full",
        isDragging && "z-50 opacity-80 scale-[1.02] shadow-xl",
        !widget.visible && isEditMode && "opacity-50",
        isEditMode && "ring-1 ring-dashed ring-border rounded-xl",
      )}
    >
      {isEditMode && (
        <div className="absolute -top-2 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1 rounded-full border bg-background px-1.5 py-0.5 shadow-sm opacity-0 group-hover/widget:opacity-100 transition-opacity !h-auto">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 cursor-grab active:cursor-grabbing"
                {...attributes}
                {...listeners}
              >
                <GripVertical className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              {t("dashboard.widgets.dragToReorder")}
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5"
                onClick={() => onResize(widget.id, prevWidgetSize(widget.size))}
              >
                <Minimize2 className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              {t("dashboard.widgets.shrink")}
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5"
                onClick={() => onResize(widget.id, nextWidgetSize(widget.size))}
              >
                <Maximize2 className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              {t("dashboard.widgets.expand")}
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5"
                onClick={() => onToggleVisibility(widget.id)}
              >
                {widget.visible ? (
                  <EyeOff className="h-3 w-3" />
                ) : (
                  <Eye className="h-3 w-3" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              {widget.visible
                ? t("dashboard.widgets.hide")
                : t("dashboard.widgets.show")}
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 text-destructive hover:text-destructive"
                onClick={() => onRemove(widget.id)}
              >
                <X className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              {t("dashboard.widgets.remove")}
            </TooltipContent>
          </Tooltip>
        </div>
      )}

      {children}
    </div>
  );
}
