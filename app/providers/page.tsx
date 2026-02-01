'use client';

import { useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { usePackages } from '@/lib/hooks/use-packages';
import { useLocale } from '@/components/providers/locale-provider';
import { AlertCircle } from 'lucide-react';

export default function ProvidersPage() {
  const { providers, loading, error, fetchProviders } = usePackages();
  const { t } = useLocale();

  useEffect(() => {
    fetchProviders();
  }, [fetchProviders]);

  const getCapabilityBadge = (capability: string) => {
    const colors: Record<string, string> = {
      install: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
      uninstall: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
      search: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
      update: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
      list: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
      version_switch: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-300',
      multi_version: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
      lock_version: 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-300',
      rollback: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300',
      project_local: 'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-300',
    };
    return colors[capability] || 'bg-gray-100 text-gray-800';
  };

  const getProviderIcon = (providerId: string) => {
    const icons: Record<string, string> = {
      npm: '📦',
      pnpm: '⚡',
      uv: '🐍',
      cargo: '🦀',
      chocolatey: '🍫',
      scoop: '🥄',
      winget: '🪟',
      brew: '🍺',
      apt: '🐧',
      vcpkg: '📚',
      docker: '🐳',
      psgallery: '💠',
      github: '🐙',
      nvm: '💚',
      pyenv: '🐍',
      rustup: '🦀',
    };
    return icons[providerId] || '📦';
  };

  const getPlatformIcon = (platform: string) => {
    switch (platform.toLowerCase()) {
      case 'windows':
        return '🪟';
      case 'linux':
        return '🐧';
      case 'macos':
      case 'darwin':
        return '🍎';
      default:
        return '💻';
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">{t('providers.title')}</h1>
        <p className="text-muted-foreground">
          {t('providers.description')}
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading && providers.length === 0 ? (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-4 w-48" />
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : providers.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          {t('providers.noProviders')}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {providers.map((provider) => (
            <Card key={provider.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{getProviderIcon(provider.id)}</span>
                    <CardTitle className="text-lg">{provider.display_name}</CardTitle>
                  </div>
                  <div className="flex items-center gap-2">
                    {provider.is_environment_provider && (
                      <Badge variant="outline" className="text-xs">
                        Environment
                      </Badge>
                    )}
                    <Badge variant="secondary">Priority: {provider.priority}</Badge>
                  </div>
                </div>
                <CardDescription className="flex items-center gap-2">
                  <span className="font-mono text-xs">{provider.id}</span>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-xs text-muted-foreground mb-2 block">
                    Supported Platforms
                  </Label>
                  <div className="flex gap-2">
                    {provider.platforms.map((platform) => (
                      <span
                        key={platform}
                        className="text-sm"
                        title={platform}
                      >
                        {getPlatformIcon(platform)} {platform}
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <Label className="text-xs text-muted-foreground mb-2 block">
                    Capabilities
                  </Label>
                  <div className="flex flex-wrap gap-1">
                    {provider.capabilities.map((cap) => (
                      <Badge
                        key={cap}
                        variant="secondary"
                        className={`text-xs ${getCapabilityBadge(cap)}`}
                      >
                        {cap.replace('_', ' ')}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t">
                  <div className="flex items-center gap-2">
                    <Label htmlFor={`enabled-${provider.id}`} className="text-sm">
                      Enabled
                    </Label>
                  </div>
                  <Switch
                    id={`enabled-${provider.id}`}
                    defaultChecked={true}
                    disabled
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Provider Information</CardTitle>
          <CardDescription>
            Understanding providers in CogniaLauncher
          </CardDescription>
        </CardHeader>
        <CardContent className="prose prose-sm dark:prose-invert max-w-none">
          <p className="text-sm text-muted-foreground">
            Providers are adapters that connect CogniaLauncher to various package managers
            and environment tools. Each provider handles specific functionality:
          </p>
          <ul className="text-sm text-muted-foreground mt-2 space-y-1">
            <li>
              <strong>Environment Providers</strong> (nvm, pyenv, rustup): Manage runtime
              versions with multi-version support and project-local configuration.
            </li>
            <li>
              <strong>JavaScript Package Providers</strong> (npm, pnpm): Manage Node.js
              packages globally with version locking and update checking.
            </li>
            <li>
              <strong>Python Package Providers</strong> (uv): Fast Python package management
              with virtual environment support.
            </li>
            <li>
              <strong>Rust Package Providers</strong> (Cargo): Install and manage Rust
              crates and binary packages.
            </li>
            <li>
              <strong>System Package Providers</strong> (apt, Homebrew, winget, Scoop, Chocolatey):
              Interface with OS-level package managers for system software.
            </li>
            <li>
              <strong>C++ Package Providers</strong> (vcpkg): Manage C/C++ libraries
              across platforms.
            </li>
            <li>
              <strong>Container Providers</strong> (Docker): Manage container images
              with pull, list, and update functionality.
            </li>
            <li>
              <strong>PowerShell Providers</strong> (PSGallery): Install and manage
              PowerShell modules from the gallery.
            </li>
            <li>
              <strong>Custom Source Providers</strong> (GitHub): Fetch and install
              packages from GitHub releases.
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
