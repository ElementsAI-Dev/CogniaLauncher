import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardEmptyState } from "@/components/dashboard/dashboard-primitives";

interface WidgetEmptyCardProps {
  title: string;
  message: string;
  icon?: React.ReactNode;
  className?: string;
}

export function WidgetEmptyCard({ title, message, icon, className }: WidgetEmptyCardProps) {
  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <DashboardEmptyState className="h-[200px] p-0" icon={icon} message={message} />
      </CardContent>
    </Card>
  );
}
