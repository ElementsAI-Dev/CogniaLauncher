import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyMedia, EmptyDescription } from "@/components/ui/empty";

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
        <Empty className="h-[200px] border-none p-0">
          {icon && <EmptyMedia variant="icon">{icon}</EmptyMedia>}
          <EmptyDescription>{message}</EmptyDescription>
        </Empty>
      </CardContent>
    </Card>
  );
}
