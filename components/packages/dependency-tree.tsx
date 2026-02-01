'use client';

import { useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { 
  GitBranch, ChevronRight, ChevronDown, Package, 
  Search, AlertCircle, Check, AlertTriangle,
  Layers, ArrowRight, Loader2
} from 'lucide-react';
import { useLocale } from '@/components/providers/locale-provider';

interface DependencyNode {
  name: string;
  version: string;
  constraint?: string;
  provider?: string | null;
  is_installed: boolean;
  is_conflict: boolean;
  conflict_reason?: string | null;
  dependencies: DependencyNode[];
  depth: number;
  is_direct?: boolean;
}

interface ResolutionResult {
  success: boolean;
  tree: DependencyNode[];
  packages: { name: string; version: string; provider: string }[];
  conflicts: ConflictInfo[];
  install_order: string[];
  total_packages: number;
  total_size: number | null;
}

interface ConflictInfo {
  package_name: string;
  required_by: string[];
  versions: string[];
  resolution?: string;
}

interface DependencyTreeProps {
  packageId?: string;
  resolution?: ResolutionResult;
  loading: boolean;
  onResolve: (packageId: string) => Promise<ResolutionResult>;
}

function DependencyNodeItem({ 
  node, 
  isExpanded, 
  onToggle,
  searchTerm,
}: { 
  node: DependencyNode; 
  isExpanded: boolean;
  onToggle: () => void;
  searchTerm: string;
}) {
  const { t } = useLocale();
  const hasChildren = node.dependencies.length > 0;
  const isMatch = searchTerm && node.name.toLowerCase().includes(searchTerm.toLowerCase());
  
  const depthColors = [
    'border-l-primary',
    'border-l-blue-500',
    'border-l-green-500',
    'border-l-yellow-500',
    'border-l-purple-500',
    'border-l-pink-500',
  ];
  
  const borderColor = depthColors[node.depth % depthColors.length];

  return (
    <div 
      className={`
        pl-4 border-l-2 ${borderColor}
        ${isMatch ? 'bg-yellow-500/10 rounded' : ''}
      `}
      style={{ marginLeft: node.depth > 0 ? '1rem' : 0 }}
    >
      <Collapsible open={isExpanded} onOpenChange={onToggle}>
        <div className="flex items-center gap-2 py-1.5">
          {hasChildren ? (
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="icon" className="h-5 w-5">
                {isExpanded ? (
                  <ChevronDown className="h-3 w-3" />
                ) : (
                  <ChevronRight className="h-3 w-3" />
                )}
              </Button>
            </CollapsibleTrigger>
          ) : (
            <div className="w-5 h-5 flex items-center justify-center">
              <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground" />
            </div>
          )}

          <Package className={`h-4 w-4 ${node.is_conflict ? 'text-destructive' : 'text-muted-foreground'}`} />

          <span className={`font-medium ${node.is_conflict ? 'text-destructive' : ''}`}>
            {node.name}
          </span>

          <Badge variant="secondary" className="text-xs">
            {node.version}
          </Badge>

          {node.provider && (
            <Badge variant="outline" className="text-xs">
              {node.provider}
            </Badge>
          )}

          {node.is_installed ? (
            <Check className="h-4 w-4 text-green-500" />
          ) : (
            <Badge variant="default" className="text-xs">
              {t('packages.toInstall')}
            </Badge>
          )}

          {node.is_conflict && (
            <Badge variant="destructive" className="gap-1">
              <AlertTriangle className="h-3 w-3" />
              {t('packages.conflict')}
            </Badge>
          )}

          {hasChildren && (
            <span className="text-xs text-muted-foreground">
              ({node.dependencies.length})
            </span>
          )}
        </div>

        {node.conflict_reason && (
          <div className="ml-7 text-xs text-destructive mb-1">
            {node.conflict_reason}
          </div>
        )}

        <CollapsibleContent>
          {node.dependencies.map((child, i) => (
            <DependencyNodeItem
              key={`${child.name}-${i}`}
              node={child}
              isExpanded={false}
              onToggle={() => {}}
              searchTerm={searchTerm}
            />
          ))}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

export function DependencyTree({
  packageId,
  resolution,
  loading,
  onResolve,
}: DependencyTreeProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [inputPackage, setInputPackage] = useState(packageId || '');
  const { t } = useLocale();

  const toggleNode = useCallback((nodeId: string) => {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    if (!resolution) return;
    const allNodes = new Set<string>();
    const collectNodes = (nodes: DependencyNode[]) => {
      nodes.forEach(node => {
        allNodes.add(node.name);
        collectNodes(node.dependencies);
      });
    };
    collectNodes(resolution.tree);
    setExpandedNodes(allNodes);
  }, [resolution]);

  const collapseAll = useCallback(() => {
    setExpandedNodes(new Set());
  }, []);

  const handleResolve = useCallback(async () => {
    if (inputPackage) {
      await onResolve(inputPackage);
    }
  }, [inputPackage, onResolve]);

  const formatSize = (bytes?: number) => {
    if (!bytes) return null;
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    return `${size.toFixed(1)} ${units[unitIndex]}`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <GitBranch className="h-5 w-5" />
          {t('packages.dependencyTree')}
        </CardTitle>
        <CardDescription>
          {t('packages.dependencyTreeDesc')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Package Input */}
        <div className="flex gap-2">
          <Input
            placeholder={t('packages.enterPackageName')}
            value={inputPackage}
            onChange={(e) => setInputPackage(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleResolve()}
          />
          <Button onClick={handleResolve} disabled={loading || !inputPackage}>
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
            <span className="ml-2">{t('packages.resolve')}</span>
          </Button>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="space-y-3 py-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
              {t('packages.resolvingDependencies')}
            </div>
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-8 ml-4" style={{ width: `${100 - i * 15}%` }} />
            ))}
          </div>
        )}

        {/* Resolution Summary */}
        {resolution && !loading && (
          <div className="space-y-4">
            {/* Stats */}
            <div className="grid grid-cols-4 gap-4">
              <div className="p-3 border rounded-lg text-center">
                <div className="text-2xl font-bold">{resolution.total_packages}</div>
                <div className="text-xs text-muted-foreground">{t('packages.totalPackages')}</div>
              </div>
              <div className="p-3 border rounded-lg text-center">
                <div className="text-2xl font-bold text-green-600">
                  {resolution.tree.filter(n => n.is_installed).length}
                </div>
                <div className="text-xs text-muted-foreground">{t('packages.installed')}</div>
              </div>
              <div className="p-3 border rounded-lg text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {resolution.tree.filter(n => !n.is_installed).length}
                </div>
                <div className="text-xs text-muted-foreground">{t('packages.toInstall')}</div>
              </div>
              <div className="p-3 border rounded-lg text-center">
                <div className="text-2xl font-bold text-destructive">
                  {resolution.conflicts.length}
                </div>
                <div className="text-xs text-muted-foreground">{t('packages.conflicts')}</div>
              </div>
            </div>

            {/* Status Banner */}
            {resolution.success ? (
              <div className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/20 rounded-lg text-green-700 dark:text-green-400">
                <Check className="h-5 w-5" />
                <span>{t('packages.resolutionSuccessful')}</span>
                {resolution.total_size && (
                  <span className="ml-auto text-sm">
                    {t('packages.totalDownload')} {formatSize(resolution.total_size)}
                  </span>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-700 dark:text-red-400">
                <AlertCircle className="h-5 w-5" />
                <span>{t('packages.resolutionFailed')}</span>
              </div>
            )}

            {/* Conflicts */}
            {resolution.conflicts.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-yellow-600" />
                  {t('packages.dependencyConflicts')}
                </h4>
                {resolution.conflicts.map((conflict, i) => (
                  <div key={i} className="p-3 border border-destructive/30 bg-destructive/5 rounded-lg">
                    <div className="font-medium">{conflict.package_name}</div>
                    <div className="text-sm text-muted-foreground mt-1">
                      {t('packages.requiredVersions')} {conflict.versions.join(', ')}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {t('packages.requiredBy')} {conflict.required_by.join(', ')}
                    </div>
                    {conflict.resolution && (
                      <div className="text-sm text-primary mt-2">
                        {t('packages.suggestion')} {conflict.resolution}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Search & Controls */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t('packages.searchDependencies')}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
              <Button variant="outline" size="sm" onClick={expandAll}>
                {t('packages.expandAll')}
              </Button>
              <Button variant="outline" size="sm" onClick={collapseAll}>
                {t('packages.collapseAll')}
              </Button>
            </div>

            {/* Dependency Tree */}
            <ScrollArea className="h-[400px] border rounded-lg p-4">
              {resolution.tree.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Layers className="h-12 w-12 mb-4 opacity-50" />
                  <span>{t('packages.noDependenciesFound')}</span>
                </div>
              ) : (
                <div className="space-y-1">
                  {resolution.tree.map((node, i) => (
                    <DependencyNodeItem
                      key={`${node.name}-${i}`}
                      node={node}
                      isExpanded={expandedNodes.has(node.name)}
                      onToggle={() => toggleNode(node.name)}
                      searchTerm={searchTerm}
                    />
                  ))}
                </div>
              )}
            </ScrollArea>

            {/* Install Order */}
            {resolution.install_order.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium flex items-center gap-2">
                  <ArrowRight className="h-4 w-4" />
                  {t('packages.installationOrder')}
                </h4>
                <div className="flex flex-wrap items-center gap-1">
                  {resolution.install_order.map((pkg, i) => (
                    <div key={pkg} className="flex items-center">
                      <Badge variant="outline">{pkg}</Badge>
                      {i < resolution.install_order.length - 1 && (
                        <ChevronRight className="h-4 w-4 text-muted-foreground mx-1" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Empty State */}
        {!resolution && !loading && (
          <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
            <GitBranch className="h-12 w-12 mb-4 opacity-50" />
            <span>Enter a package name to resolve dependencies</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
