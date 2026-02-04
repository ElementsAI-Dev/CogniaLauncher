'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface StatsCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon?: React.ReactNode;
  className?: string;
  href?: string;
  onClick?: () => void;
  loading?: boolean;
  trend?: {
    direction: 'up' | 'down' | 'stable';
    label?: string;
  };
}

export function StatsCard({ 
  title, 
  value, 
  description, 
  icon, 
  className,
  href,
  onClick,
  loading = false,
  trend,
}: StatsCardProps) {
  const router = useRouter();

  const handleClick = useCallback(() => {
    if (onClick) {
      onClick();
    } else if (href) {
      router.push(href);
    }
  }, [onClick, href, router]);

  const isClickable = Boolean(href || onClick);

  if (loading) {
    return (
      <Card className={cn('', className)}>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-4 rounded" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-8 w-16 mb-1" />
          <Skeleton className="h-3 w-32" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card 
      className={cn(
        'transition-all duration-200',
        isClickable && [
          'cursor-pointer',
          'hover:shadow-md hover:border-primary/20',
          'hover:scale-[1.02]',
          'active:scale-[0.98]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        ],
        className
      )}
      onClick={isClickable ? handleClick : undefined}
      tabIndex={isClickable ? 0 : undefined}
      role={isClickable ? 'button' : undefined}
      onKeyDown={isClickable ? (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      } : undefined}
    >
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        {icon && (
          <div className={cn(
            'text-muted-foreground transition-colors',
            isClickable && 'group-hover:text-primary'
          )}>
            {icon}
          </div>
        )}
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold">{value}</span>
          {trend && (
            <TrendIndicator direction={trend.direction} label={trend.label} />
          )}
        </div>
        {description && (
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        )}
      </CardContent>
    </Card>
  );
}

interface TrendIndicatorProps {
  direction: 'up' | 'down' | 'stable';
  label?: string;
}

function TrendIndicator({ direction, label }: TrendIndicatorProps) {
  const colors = {
    up: 'text-green-500',
    down: 'text-red-500',
    stable: 'text-muted-foreground',
  };

  const icons = {
    up: '↑',
    down: '↓',
    stable: '→',
  };

  return (
    <span className={cn('text-xs font-medium', colors[direction])}>
      {icons[direction]}
      {label && <span className="ml-0.5">{label}</span>}
    </span>
  );
}

export function StatsCardSkeleton({ className }: { className?: string }) {
  return (
    <Card className={cn('', className)}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-4 rounded" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-8 w-16 mb-1" />
        <Skeleton className="h-3 w-32" />
      </CardContent>
    </Card>
  );
}
