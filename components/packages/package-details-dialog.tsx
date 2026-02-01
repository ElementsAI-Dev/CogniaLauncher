'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { PackageInfo, PackageSummary } from '@/lib/tauri';
import { ExternalLink, Download, Globe, FileCode, Scale, Calendar } from 'lucide-react';
import { toast } from 'sonner';

interface PackageDetailsDialogProps {
  pkg: PackageSummary | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInstall: (name: string, version?: string) => Promise<void>;
  fetchPackageInfo: (name: string, provider?: string) => Promise<PackageInfo | null>;
}

export function PackageDetailsDialog({
  pkg,
  open,
  onOpenChange,
  onInstall,
  fetchPackageInfo,
}: PackageDetailsDialogProps) {
  const [packageInfo, setPackageInfo] = useState<PackageInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<string>('');
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    if (open && pkg) {
      setLoading(true);
      setPackageInfo(null);
      setSelectedVersion('');
      
      fetchPackageInfo(pkg.name, pkg.provider)
        .then((info) => {
          setPackageInfo(info);
          if (info?.versions?.length) {
            setSelectedVersion(info.versions[0].version);
          }
        })
        .finally(() => setLoading(false));
    }
  }, [open, pkg, fetchPackageInfo]);

  const handleInstall = async () => {
    if (!pkg) return;
    setInstalling(true);
    try {
      await onInstall(pkg.name, selectedVersion || undefined);
      toast.success(`Installing ${pkg.name}${selectedVersion ? `@${selectedVersion}` : ''}`);
      onOpenChange(false);
    } catch (err) {
      toast.error(`Failed to install: ${err}`);
    } finally {
      setInstalling(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {pkg?.name}
            {pkg?.provider && (
              <Badge variant="secondary" className="ml-2">
                {pkg.provider}
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            {loading ? (
              <Skeleton className="h-4 w-3/4" />
            ) : (
              packageInfo?.description || pkg?.description || 'No description available'
            )}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[50vh]">
          {loading ? (
            <div className="space-y-4 p-4">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : packageInfo ? (
            <div className="space-y-4 pr-4">
              <div className="grid grid-cols-2 gap-4">
                {packageInfo.homepage && (
                  <div className="flex items-center gap-2 text-sm">
                    <Globe className="h-4 w-4 text-muted-foreground" />
                    <a
                      href={packageInfo.homepage}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-500 hover:underline flex items-center gap-1"
                    >
                      Homepage
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                )}
                {packageInfo.repository && (
                  <div className="flex items-center gap-2 text-sm">
                    <FileCode className="h-4 w-4 text-muted-foreground" />
                    <a
                      href={packageInfo.repository}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-500 hover:underline flex items-center gap-1"
                    >
                      Repository
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                )}
                {packageInfo.license && (
                  <div className="flex items-center gap-2 text-sm">
                    <Scale className="h-4 w-4 text-muted-foreground" />
                    <span>{packageInfo.license}</span>
                  </div>
                )}
              </div>

              <Separator />

              <div className="space-y-2">
                <h4 className="text-sm font-medium">Select Version</h4>
                <Select value={selectedVersion} onValueChange={setSelectedVersion}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a version" />
                  </SelectTrigger>
                  <SelectContent>
                    {packageInfo.versions.map((v) => (
                      <SelectItem key={v.version} value={v.version}>
                        <div className="flex items-center gap-2">
                          <span>{v.version}</span>
                          {v.deprecated && (
                            <Badge variant="destructive" className="text-xs">
                              Deprecated
                            </Badge>
                          )}
                          {v.yanked && (
                            <Badge variant="secondary" className="text-xs">
                              Yanked
                            </Badge>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <h4 className="text-sm font-medium">Version History</h4>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {packageInfo.versions.slice(0, 10).map((v) => (
                    <div
                      key={v.version}
                      className="flex items-center justify-between py-1 px-2 rounded hover:bg-muted text-sm"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-mono">{v.version}</span>
                        {v.deprecated && (
                          <Badge variant="outline" className="text-xs">deprecated</Badge>
                        )}
                      </div>
                      {v.release_date && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(v.release_date).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  ))}
                  {packageInfo.versions.length > 10 && (
                    <p className="text-xs text-muted-foreground text-center py-2">
                      +{packageInfo.versions.length - 10} more versions
                    </p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Failed to load package details
            </div>
          )}
        </ScrollArea>

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleInstall}
            disabled={installing || loading || !packageInfo}
          >
            <Download className="h-4 w-4 mr-2" />
            {installing ? 'Installing...' : `Install ${selectedVersion || 'Latest'}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
