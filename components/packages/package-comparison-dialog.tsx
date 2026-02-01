'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { 
  GitCompare, Check, X, ExternalLink, 
  Package, AlertCircle, Scale
} from 'lucide-react';
import type { PackageComparison } from '@/lib/tauri';

interface PackageComparisonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  packageIds: string[];
  onCompare: (packageIds: string[]) => Promise<PackageComparison>;
}

interface ComparisonFeature {
  name: string;
  key: string;
  type: 'boolean' | 'string' | 'array' | 'size';
}

const COMPARISON_FEATURES: ComparisonFeature[] = [
  { name: 'Version', key: 'version', type: 'string' },
  { name: 'Provider', key: 'provider', type: 'string' },
  { name: 'License', key: 'license', type: 'string' },
  { name: 'Size', key: 'size', type: 'size' },
  { name: 'Last Updated', key: 'updated_at', type: 'string' },
  { name: 'Homepage', key: 'homepage', type: 'string' },
  { name: 'Dependencies', key: 'dependencies', type: 'array' },
  { name: 'Platforms', key: 'platforms', type: 'array' },
];

export function PackageComparisonDialog({
  open,
  onOpenChange,
  packageIds,
  onCompare,
}: PackageComparisonDialogProps) {
  const [comparison, setComparison] = useState<PackageComparison | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadComparison = useCallback(async () => {
    if (packageIds.length < 2) return;

    setLoading(true);
    setError(null);

    try {
      const result = await onCompare(packageIds);
      setComparison(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to compare packages');
    } finally {
      setLoading(false);
    }
  }, [packageIds, onCompare]);

  useEffect(() => {
    if (open && packageIds.length >= 2) {
      loadComparison();
    }
  }, [open, loadComparison, packageIds.length]);

  const formatSize = (bytes?: number) => {
    if (!bytes) return 'Unknown';
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    return `${size.toFixed(1)} ${units[unitIndex]}`;
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'Unknown';
    try {
      return new Date(dateStr).toLocaleDateString();
    } catch {
      return dateStr;
    }
  };

  const renderFeatureValue = (pkg: Record<string, unknown>, feature: ComparisonFeature) => {
    const value = pkg[feature.key];

    if (value === undefined || value === null) {
      return <span className="text-muted-foreground">—</span>;
    }

    switch (feature.type) {
      case 'boolean':
        return value ? (
          <Check className="h-4 w-4 text-green-500" />
        ) : (
          <X className="h-4 w-4 text-red-500" />
        );
      
      case 'size':
        return formatSize(value as number);
      
      case 'array':
        const arr = value as string[];
        if (arr.length === 0) return <span className="text-muted-foreground">None</span>;
        return (
          <div className="flex flex-wrap gap-1">
            {arr.slice(0, 3).map((item, i) => (
              <Badge key={i} variant="secondary" className="text-xs">
                {item}
              </Badge>
            ))}
            {arr.length > 3 && (
              <Badge variant="outline" className="text-xs">
                +{arr.length - 3}
              </Badge>
            )}
          </div>
        );
      
      case 'string':
      default:
        if (feature.key === 'homepage' && typeof value === 'string') {
          return (
            <a 
              href={value} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-primary hover:underline inline-flex items-center gap-1"
            >
              Link <ExternalLink className="h-3 w-3" />
            </a>
          );
        }
        if (feature.key === 'updated_at') {
          return formatDate(value as string);
        }
        return <span className="truncate max-w-[150px]">{String(value)}</span>;
    }
  };

  const getHighlightClass = (feature: ComparisonFeature, value: unknown, allValues: unknown[]) => {
    // Highlight differences
    const uniqueValues = new Set(allValues.map(v => JSON.stringify(v)));
    if (uniqueValues.size > 1) {
      return 'bg-yellow-500/5';
    }
    return '';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitCompare className="h-5 w-5" />
            Compare Packages
          </DialogTitle>
          <DialogDescription>
            Side-by-side comparison of {packageIds.length} packages
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              {packageIds.map((_, i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
            <Skeleton className="h-48 w-full" />
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 text-destructive py-8 justify-center">
            <AlertCircle className="h-5 w-5" />
            <span>{error}</span>
          </div>
        )}

        {comparison && !loading && (
          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-6 pr-4">
              {/* Package Headers */}
              <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${comparison.packages.length}, 1fr)` }}>
                {comparison.packages.map((pkg, i) => (
                  <div 
                    key={i}
                    className="p-4 border rounded-lg bg-card"
                  >
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-primary/10 rounded">
                        <Package className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold truncate">{pkg.name}</h3>
                        <p className="text-sm text-muted-foreground truncate">
                          {pkg.description || 'No description'}
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          <Badge variant="outline">{pkg.provider}</Badge>
                          <Badge>{pkg.version || pkg.latest_version}</Badge>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Differences Summary */}
              {comparison.differences && comparison.differences.length > 0 && (
                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
                  <h4 className="font-medium flex items-center gap-2 mb-2">
                    <Scale className="h-4 w-4 text-yellow-600" />
                    Key Differences
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {comparison.differences.map((diff, i) => (
                      <Badge key={i} variant="secondary">
                        {diff}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Comparison Table */}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[150px]">Feature</TableHead>
                    {comparison.packages.map((pkg, i) => (
                      <TableHead key={i}>{pkg.name}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {COMPARISON_FEATURES.map((feature) => {
                    const allValues = comparison.packages.map(pkg => pkg[feature.key]);
                    
                    return (
                      <TableRow key={feature.key}>
                        <TableCell className="font-medium">
                          {feature.name}
                        </TableCell>
                        {comparison.packages.map((pkg, i) => (
                          <TableCell 
                            key={i}
                            className={getHighlightClass(feature, pkg[feature.key], allValues)}
                          >
                            {renderFeatureValue(pkg as Record<string, unknown>, feature)}
                          </TableCell>
                        ))}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              {/* Common Features */}
              {comparison.common_features && comparison.common_features.length > 0 && (
                <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
                  <h4 className="font-medium flex items-center gap-2 mb-2">
                    <Check className="h-4 w-4 text-green-600" />
                    Common Features
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {comparison.common_features.map((feature, i) => (
                      <Badge key={i} variant="outline" className="border-green-500/30">
                        {feature}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Recommendation */}
              {comparison.recommendation && (
                <div className="bg-primary/10 border border-primary/20 rounded-lg p-4">
                  <h4 className="font-medium mb-2">Recommendation</h4>
                  <p className="text-sm text-muted-foreground">
                    {comparison.recommendation}
                  </p>
                </div>
              )}
            </div>
          </ScrollArea>
        )}

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
