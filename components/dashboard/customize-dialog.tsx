"use client";

import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Plus,
  RotateCcw,
  BarChart3,
  PieChart,
  BarChart,
  HardDrive,
  Activity,
  Monitor,
  Download,
  Search,
  Layers,
  Package,
  Zap,
  Terminal,
  ShieldCheck,
  ArrowUpCircle,
  Sparkles,
} from "lucide-react";
import { useLocale } from "@/components/providers/locale-provider";
import { cn } from "@/lib/utils";
import {
  useDashboardStore,
  WIDGET_DEFINITIONS,
  type WidgetType,
} from "@/lib/stores/dashboard";

const ICON_MAP: Record<string, React.ReactNode> = {
  BarChart3: <BarChart3 className="h-5 w-5" />,
  PieChart: <PieChart className="h-5 w-5" />,
  BarChart: <BarChart className="h-5 w-5" />,
  HardDrive: <HardDrive className="h-5 w-5" />,
  Activity: <Activity className="h-5 w-5" />,
  Monitor: <Monitor className="h-5 w-5" />,
  Download: <Download className="h-5 w-5" />,
  Search: <Search className="h-5 w-5" />,
  Layers: <Layers className="h-5 w-5" />,
  Package: <Package className="h-5 w-5" />,
  Zap: <Zap className="h-5 w-5" />,
  Terminal: <Terminal className="h-5 w-5" />,
  ShieldCheck: <ShieldCheck className="h-5 w-5" />,
  ArrowUpCircle: <ArrowUpCircle className="h-5 w-5" />,
  Sparkles: <Sparkles className="h-5 w-5" />,
};

interface CustomizeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CustomizeDialog({ open, onOpenChange }: CustomizeDialogProps) {
  const { t } = useLocale();
  const widgets = useDashboardStore((s) => s.widgets);
  const addWidget = useDashboardStore((s) => s.addWidget);
  const resetToDefault = useDashboardStore((s) => s.resetToDefault);

  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  const categories = useMemo(
    () => [
      { id: "all", label: t("dashboard.widgets.allCategories") },
      { id: "overview", label: t("dashboard.widgets.categoryOverview") },
      { id: "charts", label: t("dashboard.widgets.categoryCharts") },
      { id: "lists", label: t("dashboard.widgets.categoryLists") },
      { id: "tools", label: t("dashboard.widgets.categoryTools") },
    ],
    [t],
  );

  const filteredDefinitions = useMemo(() => {
    const defs = Object.values(WIDGET_DEFINITIONS);
    if (selectedCategory === "all") return defs;
    return defs.filter((d) => d.category === selectedCategory);
  }, [selectedCategory]);

  const existingTypes = useMemo(
    () => new Set(widgets.map((w) => w.type)),
    [widgets],
  );

  const handleAddWidget = (type: WidgetType) => {
    addWidget(type);
  };

  const handleReset = () => {
    resetToDefault();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("dashboard.widgets.customizeTitle")}</DialogTitle>
          <DialogDescription>
            {t("dashboard.widgets.customizeDesc")}
          </DialogDescription>
        </DialogHeader>

        <ToggleGroup
          type="single"
          value={selectedCategory}
          onValueChange={(value) => {
            if (value) setSelectedCategory(value);
          }}
          className="flex-wrap justify-start"
          variant="outline"
          size="sm"
        >
          {categories.map((cat) => (
            <ToggleGroupItem key={cat.id} value={cat.id}>
              {cat.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>

        <Separator />

        <ScrollArea className="h-[360px] pr-4">
          <div className="space-y-2">
            {filteredDefinitions.map((def) => {
              const isAdded = existingTypes.has(def.type);
              return (
                <div
                  key={def.type}
                  className={cn(
                    "flex items-center gap-3 rounded-lg border p-3 transition-colors",
                    isAdded ? "bg-muted/50" : "hover:bg-accent/50",
                  )}
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                    {ICON_MAP[def.icon] || <BarChart3 className="h-5 w-5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">
                        {t(def.titleKey)}
                      </span>
                      <Badge variant="secondary" className="text-[10px]">
                        {t(`dashboard.widgets.category_${def.category}`)}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                      {t(def.descriptionKey)}
                    </p>
                  </div>
                  <Button
                    variant={isAdded ? "outline" : "default"}
                    size="sm"
                    onClick={() => handleAddWidget(def.type)}
                    disabled={false}
                    className="shrink-0"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    {isAdded
                      ? t("dashboard.widgets.addAnother")
                      : t("common.add")}
                  </Button>
                </div>
              );
            })}
          </div>
        </ScrollArea>

        <Separator />

        <div className="flex items-center justify-between">
          <Button variant="outline" size="sm" onClick={handleReset}>
            <RotateCcw className="h-4 w-4 mr-1" />
            {t("dashboard.widgets.resetDefault")}
          </Button>
          <Button size="sm" onClick={() => onOpenChange(false)}>
            {t("common.close")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
