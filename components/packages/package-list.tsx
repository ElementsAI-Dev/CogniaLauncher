'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Download, Trash2, Info, Loader2 } from 'lucide-react';
import { usePackageStore } from '@/lib/stores/packages';
import type { PackageSummary, InstalledPackage } from '@/lib/tauri';

interface PackageListProps {
  packages: (PackageSummary | InstalledPackage)[];
  type: 'search' | 'installed';
  installing?: string[];
  onInstall?: (name: string) => void;
  onUninstall?: (name: string) => void;
  onSelect?: (pkg: PackageSummary | InstalledPackage) => void;
  selectable?: boolean;
}

export function PackageList({ 
  packages, 
  type, 
  installing = [], 
  onInstall, 
  onUninstall, 
  onSelect,
  selectable = true,
}: PackageListProps) {
  const { selectedPackages, togglePackageSelection } = usePackageStore();

  if (packages.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        {type === 'search' ? 'No packages found' : 'No packages installed'}
      </div>
    );
  }

  return (
    <ScrollArea className="h-[500px]">
      <div className="space-y-2 pr-4">
        {packages.map((pkg) => {
          const isInstalled = type === 'installed';
          const isInstalling = installing.includes(pkg.name);
          const version = isInstalled ? (pkg as InstalledPackage).version : (pkg as PackageSummary).latest_version;
          const isSelected = selectedPackages.includes(pkg.name);

          return (
            <div
              key={pkg.name}
              className="flex items-center justify-between p-4 bg-card border border-border rounded-lg cursor-pointer hover:bg-accent/50 transition-colors"
              onClick={() => onSelect?.(pkg)}
            >
              {/* Left side - checkbox and info */}
              <div className="flex items-center gap-3 flex-1 min-w-0">
                {selectable && (
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => togglePackageSelection(pkg.name)}
                    onClick={(e) => e.stopPropagation()}
                    className="shrink-0"
                  />
                )}
                <div className="flex flex-col gap-1 min-w-0">
                  <span className="text-base font-medium text-foreground truncate">
                    {pkg.name}
                  </span>
                  {'description' in pkg && pkg.description && (
                    <span className="text-sm text-muted-foreground truncate">
                      {pkg.description}
                    </span>
                  )}
                </div>
              </div>

              {/* Right side - badges and actions */}
              <div className="flex items-center gap-2 ml-4 shrink-0">
                {version && (
                  <Badge 
                    variant="outline" 
                    className="font-mono text-xs px-2 py-1"
                  >
                    {version}
                  </Badge>
                )}
                <Badge 
                  variant="secondary" 
                  className="text-xs px-2 py-1"
                >
                  {pkg.provider}
                </Badge>
                
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelect?.(pkg);
                  }}
                >
                  <Info className="h-4 w-4 text-muted-foreground" />
                </Button>
                
                {isInstalled ? (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        size="icon"
                        variant="destructive"
                        className="h-8 w-8"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Uninstall Package</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to uninstall {pkg.name}? This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => onUninstall?.(pkg.name)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Uninstall
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                ) : (
                  <Button
                    size="icon"
                    className="h-8 w-8"
                    disabled={isInstalling}
                    onClick={(e) => {
                      e.stopPropagation();
                      onInstall?.(pkg.name);
                    }}
                  >
                    {isInstalling ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4" />
                    )}
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}
