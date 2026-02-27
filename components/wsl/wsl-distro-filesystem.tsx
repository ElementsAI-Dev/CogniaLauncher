'use client';

import React, { useState, useCallback } from 'react';
import { writeClipboard } from '@/lib/clipboard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Breadcrumb as BreadcrumbRoot,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import {
  FolderOpen,
  File,
  Folder,
  ArrowUp,
  RefreshCw,
  Home,
  Copy,
  FileSymlink,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { parseFileEntries } from '@/lib/wsl';
import type { FileEntry, WslDistroFilesystemProps } from '@/types/wsl';

export function WslDistroFilesystem({ distroName, onExec, t }: WslDistroFilesystemProps) {
  const [currentPath, setCurrentPath] = useState('/');
  const [pathInput, setPathInput] = useState('/');
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDirectory = useCallback(async (path: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await onExec(distroName, `ls -la --time-style=long-iso ${JSON.stringify(path)}`);
      if (result.exitCode !== 0) {
        setError(result.stderr || `Exit code ${result.exitCode}`);
        setEntries([]);
      } else {
        const parsed = parseFileEntries(result.stdout);
        setEntries(parsed);
        setCurrentPath(path);
        setPathInput(path);
      }
      setLoaded(true);
    } catch (err) {
      setError(String(err));
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [distroName, onExec]);

  const navigateTo = useCallback((name: string) => {
    let newPath: string;
    if (name === '..') {
      const parts = currentPath.split('/').filter(Boolean);
      parts.pop();
      newPath = '/' + parts.join('/');
    } else {
      newPath = currentPath === '/' ? `/${name}` : `${currentPath}/${name}`;
    }
    loadDirectory(newPath);
  }, [currentPath, loadDirectory]);

  const handleNavigate = () => {
    if (pathInput.trim()) {
      loadDirectory(pathInput.trim());
    }
  };

  const handleCopyPath = async (name: string) => {
    const fullPath = currentPath === '/' ? `/${name}` : `${currentPath}/${name}`;
    await writeClipboard(fullPath);
    toast.success(t('common.copied'));
  };

  const getIcon = (entry: FileEntry) => {
    if (entry.type === 'dir') return <Folder className="h-4 w-4 text-blue-500" />;
    if (entry.type === 'link') return <FileSymlink className="h-4 w-4 text-cyan-500" />;
    return <File className="h-4 w-4 text-muted-foreground" />;
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <FolderOpen className="h-4 w-4 text-muted-foreground" />
          {t('wsl.detail.filesystem')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Path navigation */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={() => loadDirectory('/')}
            disabled={loading}
            title="Home"
          >
            <Home className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={() => navigateTo('..')}
            disabled={loading || currentPath === '/'}
            title="Up"
          >
            <ArrowUp className="h-3.5 w-3.5" />
          </Button>
          <Input
            className="h-8 text-xs font-mono flex-1"
            value={pathInput}
            onChange={(e) => setPathInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleNavigate()}
            placeholder="/"
          />
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1"
            onClick={handleNavigate}
            disabled={loading}
          >
            <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
            {loaded ? t('wsl.detail.refresh') : t('wsl.detail.browse')}
          </Button>
        </div>

        {/* Breadcrumb */}
        <BreadcrumbRoot>
          <BreadcrumbList>
            <BreadcrumbItem>
              {currentPath === '/' ? (
                <BreadcrumbPage>/</BreadcrumbPage>
              ) : (
                <BreadcrumbLink asChild>
                  <button onClick={() => loadDirectory('/')}>/</button>
                </BreadcrumbLink>
              )}
            </BreadcrumbItem>
            {currentPath.split('/').filter(Boolean).map((part, i, arr) => {
              const path = '/' + arr.slice(0, i + 1).join('/');
              const isLast = i === arr.length - 1;
              return (
                <React.Fragment key={path}>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    {isLast ? (
                      <BreadcrumbPage>{part}</BreadcrumbPage>
                    ) : (
                      <BreadcrumbLink asChild>
                        <button onClick={() => loadDirectory(path)}>{part}</button>
                      </BreadcrumbLink>
                    )}
                  </BreadcrumbItem>
                </React.Fragment>
              );
            })}
          </BreadcrumbList>
        </BreadcrumbRoot>

        {/* Error */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Loading */}
        {loading && (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        )}

        {/* File list */}
        {!loading && loaded && entries.length === 0 && !error && (
          <Empty className="border-none py-4">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <FolderOpen />
              </EmptyMedia>
              <EmptyTitle className="text-sm font-normal text-muted-foreground">
                {t('wsl.detail.emptyDir')}
              </EmptyTitle>
            </EmptyHeader>
          </Empty>
        )}

        {!loading && entries.length > 0 && (
          <ScrollArea className="max-h-[500px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40%]">{t('wsl.detail.fileName')}</TableHead>
                  <TableHead>{t('wsl.detail.filePermissions')}</TableHead>
                  <TableHead className="text-right">{t('wsl.detail.fileSize')}</TableHead>
                  <TableHead className="text-right hidden lg:table-cell">{t('wsl.detail.fileModified')}</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* Parent directory */}
                {currentPath !== '/' && (
                  <TableRow className="cursor-pointer" onClick={() => navigateTo('..')}>
                    <TableCell className="font-mono">
                      <span className="flex items-center gap-2">
                        <Folder className="h-4 w-4 text-blue-500 shrink-0" />
                        ..
                      </span>
                    </TableCell>
                    <TableCell />
                    <TableCell />
                    <TableCell className="hidden lg:table-cell" />
                    <TableCell />
                  </TableRow>
                )}

                {/* Sort: directories first, then files */}
                {[...entries]
                  .sort((a, b) => {
                    if (a.type === 'dir' && b.type !== 'dir') return -1;
                    if (a.type !== 'dir' && b.type === 'dir') return 1;
                    return a.name.localeCompare(b.name);
                  })
                  .map((entry) => (
                    <TableRow key={entry.name} className="group">
                      <TableCell className="font-mono text-sm">
                        {entry.type === 'dir' ? (
                          <button
                            className="flex items-center gap-2 min-w-0 text-left"
                            onClick={() => navigateTo(entry.name)}
                          >
                            {getIcon(entry)}
                            <span className="truncate text-blue-600 dark:text-blue-400 hover:underline">
                              {entry.name}
                            </span>
                          </button>
                        ) : (
                          <span className="flex items-center gap-2 min-w-0">
                            {getIcon(entry)}
                            <span className="truncate">{entry.name}</span>
                            {entry.linkTarget && (
                              <span className="text-xs text-muted-foreground truncate">
                                → {entry.linkTarget}
                              </span>
                            )}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px] font-mono">
                          {entry.permissions}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">
                        {entry.size}
                      </TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground hidden lg:table-cell">
                        {entry.modified}
                      </TableCell>
                      <TableCell>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => handleCopyPath(entry.name)}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>{t('common.copy')}</TooltipContent>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </ScrollArea>
        )}

        {/* Not loaded yet */}
        {!loaded && !loading && (
          <Empty className="border-none py-6">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <FolderOpen />
              </EmptyMedia>
              <EmptyTitle className="text-sm font-normal text-muted-foreground">
                {t('wsl.detail.filesystemHint')}
              </EmptyTitle>
            </EmptyHeader>
          </Empty>
        )}
      </CardContent>
    </Card>
  );
}
