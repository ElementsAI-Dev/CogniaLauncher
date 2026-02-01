'use client';

import { useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  RefreshCw, AlertCircle, Package, 
  ChevronRight, ArrowUp, 
  CheckCircle, Loader2, Pin
} from 'lucide-react';
import type { BatchResult } from '@/lib/tauri';

interface UpdateInfo {
  package_id: string;
  name: string;
  provider: string;
  current_version: string;
  latest_version: string;
  is_pinned: boolean;
  is_breaking: boolean;
  change_type: 'major' | 'minor' | 'patch' | 'unknown';
  changelog_url?: string;
}

interface UpdateManagerProps {
  updates: UpdateInfo[];
  loading: boolean;
  onCheckUpdates: () => Promise<void>;
  onUpdateSelected: (packageIds: string[]) => Promise<BatchResult>;
  onUpdateAll: () => Promise<BatchResult>;
  onPinPackage: (packageId: string) => Promise<void>;
  onUnpinPackage: (packageId: string) => Promise<void>;
}

export function UpdateManager({
  updates,
  loading,
  onCheckUpdates,
  onUpdateSelected,
  onUpdateAll,
  onPinPackage,
  onUnpinPackage,
}: UpdateManagerProps) {
  const [selectedUpdates, setSelectedUpdates] = useState<Set<string>>(new Set());
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateResult, setUpdateResult] = useState<BatchResult | null>(null);

  const availableUpdates = updates.filter(u => !u.is_pinned);
  const pinnedUpdates = updates.filter(u => u.is_pinned);

  const toggleSelection = useCallback((packageId: string) => {
    setSelectedUpdates(prev => {
      const next = new Set(prev);
      if (next.has(packageId)) {
        next.delete(packageId);
      } else {
        next.add(packageId);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedUpdates(new Set(availableUpdates.map(u => u.package_id)));
  }, [availableUpdates]);

  const deselectAll = useCallback(() => {
    setSelectedUpdates(new Set());
  }, []);

  const handleUpdateSelected = useCallback(async () => {
    if (selectedUpdates.size === 0) return;

    setIsUpdating(true);
    setUpdateResult(null);

    try {
      const result = await onUpdateSelected(Array.from(selectedUpdates));
      setUpdateResult(result);
      
      // Clear selections for successful updates
      const successfulIds = new Set(result.successful.map(s => s.name));
      setSelectedUpdates(prev => {
        const next = new Set(prev);
        successfulIds.forEach(id => next.delete(id));
        return next;
      });
    } catch (error) {
      console.error('Update failed:', error);
    } finally {
      setIsUpdating(false);
    }
  }, [selectedUpdates, onUpdateSelected]);

  const handleUpdateAll = useCallback(async () => {
    setIsUpdating(true);
    setUpdateResult(null);

    try {
      const result = await onUpdateAll();
      setUpdateResult(result);
      setSelectedUpdates(new Set());
    } catch (error) {
      console.error('Update all failed:', error);
    } finally {
      setIsUpdating(false);
    }
  }, [onUpdateAll]);

  const getChangeTypeBadge = (type: UpdateInfo['change_type']) => {
    switch (type) {
      case 'major':
        return <Badge variant="destructive">Major</Badge>;
      case 'minor':
        return <Badge variant="default">Minor</Badge>;
      case 'patch':
        return <Badge variant="secondary">Patch</Badge>;
      default:
        return <Badge variant="outline">Update</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ArrowUp className="h-5 w-5" />
              Updates Available
            </CardTitle>
            <CardDescription>
              {loading ? 'Checking for updates...' : `${updates.length} update(s) available`}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={onCheckUpdates}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
              Check Now
            </Button>
            {availableUpdates.length > 0 && (
              <Button 
                size="sm" 
                onClick={handleUpdateAll}
                disabled={isUpdating}
              >
                {isUpdating ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <ArrowUp className="h-4 w-4 mr-1" />
                )}
                Update All
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Loading State */}
        {loading && (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex items-center gap-4 p-3 border rounded-lg">
                <Skeleton className="h-5 w-5 rounded" />
                <Skeleton className="h-5 w-5 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-[200px]" />
                  <Skeleton className="h-3 w-[150px]" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* No Updates */}
        {!loading && updates.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="p-3 bg-green-500/10 rounded-full mb-4">
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
            <h3 className="font-medium mb-1">All packages are up to date!</h3>
            <p className="text-sm text-muted-foreground">
              Last checked: just now
            </p>
          </div>
        )}

        {/* Update Result */}
        {updateResult && (
          <Alert className="mb-4">
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              Updated {updateResult.successful.length} package(s).
              {updateResult.failed.length > 0 && (
                <span className="text-destructive ml-1">
                  {updateResult.failed.length} failed.
                </span>
              )}
            </AlertDescription>
          </Alert>
        )}

        {/* Available Updates */}
        {!loading && availableUpdates.length > 0 && (
          <div className="space-y-4">
            {/* Selection Controls */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Checkbox 
                  checked={selectedUpdates.size === availableUpdates.length}
                  onCheckedChange={(checked) => {
                    if (checked) selectAll();
                    else deselectAll();
                  }}
                />
                <span className="text-sm text-muted-foreground">
                  {selectedUpdates.size} of {availableUpdates.length} selected
                </span>
              </div>
              {selectedUpdates.size > 0 && (
                <Button 
                  size="sm" 
                  onClick={handleUpdateSelected}
                  disabled={isUpdating}
                >
                  {isUpdating ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <ArrowUp className="h-4 w-4 mr-1" />
                  )}
                  Update Selected ({selectedUpdates.size})
                </Button>
              )}
            </div>

            {/* Update List */}
            <ScrollArea className="h-[300px]">
              <div className="space-y-2 pr-4">
                {availableUpdates.map((update) => (
                  <div 
                    key={update.package_id}
                    className={`
                      flex items-center gap-4 p-3 border rounded-lg
                      hover:bg-accent/50 transition-colors cursor-pointer
                      ${selectedUpdates.has(update.package_id) ? 'bg-accent border-primary' : ''}
                    `}
                    onClick={() => toggleSelection(update.package_id)}
                  >
                    <Checkbox 
                      checked={selectedUpdates.has(update.package_id)}
                      onCheckedChange={() => toggleSelection(update.package_id)}
                      onClick={(e) => e.stopPropagation()}
                    />
                    
                    <div className="p-2 bg-muted rounded">
                      <Package className="h-4 w-4" />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">{update.name}</span>
                        <Badge variant="outline" className="text-xs">
                          {update.provider}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span>{update.current_version}</span>
                        <ChevronRight className="h-3 w-3" />
                        <span className="text-foreground">{update.latest_version}</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {getChangeTypeBadge(update.change_type)}
                      {update.is_breaking && (
                        <Badge variant="destructive" className="gap-1">
                          <AlertCircle className="h-3 w-3" />
                          Breaking
                        </Badge>
                      )}
                    </div>
                    
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        onPinPackage(update.package_id);
                      }}
                      title="Pin version"
                    >
                      <Pin className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        {/* Pinned Packages */}
        {!loading && pinnedUpdates.length > 0 && (
          <div className="mt-6 pt-6 border-t">
            <div className="flex items-center gap-2 mb-3">
              <Pin className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Pinned Packages</span>
              <Badge variant="secondary">{pinnedUpdates.length}</Badge>
            </div>
            <div className="space-y-2">
              {pinnedUpdates.map((update) => (
                <div 
                  key={update.package_id}
                  className="flex items-center gap-4 p-3 border rounded-lg bg-muted/30"
                >
                  <div className="p-2 bg-muted rounded">
                    <Package className="h-4 w-4" />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{update.name}</span>
                      <Badge variant="secondary">Pinned at {update.current_version}</Badge>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Available: {update.latest_version}
                    </div>
                  </div>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onUnpinPackage(update.package_id)}
                  >
                    Unpin
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
