import { Badge } from "@/components/ui/badge";
import { Empty, EmptyDescription, EmptyMedia } from "@/components/ui/empty";
import { cn } from "@/lib/utils";

type DashboardMetricColumns = 2 | 3 | 4;

const METRIC_GRID_COLUMNS: Record<DashboardMetricColumns, string> = {
  2: "grid-cols-2",
  3: "grid-cols-3",
  4: "grid-cols-2 md:grid-cols-4",
};

interface DashboardMetricGridProps extends React.ComponentProps<"div"> {
  columns?: DashboardMetricColumns;
}

export function DashboardMetricGrid({
  className,
  columns = 2,
  ...props
}: DashboardMetricGridProps) {
  return (
    <div
      className={cn("grid gap-2 sm:gap-3", METRIC_GRID_COLUMNS[columns], className)}
      {...props}
    />
  );
}

interface DashboardMetricItemProps extends React.ComponentProps<"div"> {
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
  valueClassName?: string;
}

export function DashboardMetricItem({
  className,
  label,
  value,
  icon,
  valueClassName,
  ...props
}: DashboardMetricItemProps) {
  return (
    <div className={cn("rounded-lg border px-3 py-2.5", className)} {...props}>
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        {icon}
        <span className="truncate">{label}</span>
      </div>
      <div className={cn("mt-1 text-lg font-semibold leading-none", valueClassName)}>
        {value}
      </div>
    </div>
  );
}

export function DashboardSectionLabel({
  className,
  ...props
}: React.ComponentProps<"p">) {
  return (
    <p
      className={cn("mb-2 text-xs font-medium text-muted-foreground", className)}
      {...props}
    />
  );
}

interface DashboardEmptyStateProps extends React.ComponentProps<"div"> {
  message: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}

export function DashboardEmptyState({
  className,
  message,
  icon,
  action,
  ...props
}: DashboardEmptyStateProps) {
  return (
    <Empty className={cn("border-none px-0 py-6 md:py-8", className)} {...props}>
      {icon ? <EmptyMedia variant="icon">{icon}</EmptyMedia> : null}
      <EmptyDescription>{message}</EmptyDescription>
      {action}
    </Empty>
  );
}

export function DashboardClickableRow({
  className,
  type,
  ...props
}: React.ComponentProps<"button">) {
  return (
    <button
      type={type ?? "button"}
      className={cn(
        "flex w-full items-center justify-between rounded-lg border p-3 text-left",
        "transition-colors hover:bg-accent/50",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        className,
      )}
      {...props}
    />
  );
}

type DashboardBadgeTone = "default" | "success" | "warning" | "danger" | "muted";

const BADGE_TONE_CLASSES: Record<DashboardBadgeTone, string> = {
  default: "",
  success: "border-green-200 bg-green-50 text-green-700 dark:border-green-900 dark:bg-green-950/50 dark:text-green-300",
  warning: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-300",
  danger: "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300",
  muted: "border-muted bg-muted text-muted-foreground",
};

interface DashboardStatusBadgeProps extends Omit<React.ComponentProps<typeof Badge>, "variant"> {
  tone?: DashboardBadgeTone;
}

export function DashboardStatusBadge({
  tone = "default",
  className,
  ...props
}: DashboardStatusBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn("text-[10px] capitalize", BADGE_TONE_CLASSES[tone], className)}
      {...props}
    />
  );
}
