'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Shield, FileText, Pencil, RefreshCw, Save, Eye } from 'lucide-react';
import type { PSProfileInfo } from '@/types/tauri';
import { useLocale } from '@/components/providers/locale-provider';
import { PS_VALID_POLICIES, PS_ALLOWED_SCOPES } from '@/lib/constants/terminal';

interface TerminalPsManagementProps {
  psProfiles: PSProfileInfo[];
  executionPolicy: [string, string][];
  onFetchPSProfiles: () => Promise<void>;
  onReadPSProfile: (scope: string) => Promise<string>;
  onWritePSProfile: (scope: string, content: string) => Promise<void>;
  onFetchExecutionPolicy: () => Promise<void>;
  onSetExecutionPolicy: (policy: string, scope: string) => Promise<void>;
  loading?: boolean;
}


export function TerminalPsManagement({
  psProfiles,
  executionPolicy,
  onFetchPSProfiles,
  onReadPSProfile,
  onWritePSProfile,
  onFetchExecutionPolicy,
  onSetExecutionPolicy,
  loading,
}: TerminalPsManagementProps) {
  const { t } = useLocale();
  const [selectedScope, setSelectedScope] = useState<string>('');
  const [profileContent, setProfileContent] = useState<string>('');
  const [editing, setEditing] = useState(false);
  const [loadingContent, setLoadingContent] = useState(false);
  const [policyScope, setPolicyScope] = useState<string>('CurrentUser');
  const [policyValue, setPolicyValue] = useState<string>('');

  const handleLoadProfile = async (scope: string) => {
    setSelectedScope(scope);
    setLoadingContent(true);
    try {
      const content = await onReadPSProfile(scope);
      setProfileContent(content);
      setEditing(false);
    } finally {
      setLoadingContent(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!selectedScope) return;
    await onWritePSProfile(selectedScope, profileContent);
    setEditing(false);
  };

  const handleRefresh = async () => {
    await Promise.all([onFetchPSProfiles(), onFetchExecutionPolicy()]);
  };

  const handleSetPolicy = async () => {
    if (!policyValue || !policyScope) return;
    await onSetExecutionPolicy(policyValue, policyScope);
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-60" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* PS Profiles */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">{t('terminal.psProfiles')}</CardTitle>
              <CardDescription>{t('terminal.psProfilesDesc')}</CardDescription>
            </div>
            <Button size="sm" variant="outline" onClick={handleRefresh}>
              <RefreshCw className="h-3.5 w-3.5 mr-1" />
              {t('common.refresh')}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {psProfiles.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              {t('terminal.noPsProfiles')}
            </p>
          ) : (
            <div className="rounded-md border divide-y">
              {psProfiles.map((profile) => (
                <div
                  key={profile.scope}
                  className="flex items-center justify-between px-3 py-2.5"
                >
                  <div className="flex items-center gap-3">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <span className="text-sm font-medium">{profile.scope}</span>
                      <p className="text-xs text-muted-foreground font-mono truncate max-w-[300px]">
                        {profile.path}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={profile.exists ? 'default' : 'outline'}>
                      {profile.exists ? t('terminal.exists') : t('terminal.notExists')}
                    </Badge>
                    {profile.exists && (
                      <span className="text-xs text-muted-foreground">
                        {(profile.sizeBytes / 1024).toFixed(1)} KB
                      </span>
                    )}
                    {profile.exists && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleLoadProfile(profile.scope)}
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {selectedScope && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium">
                  {selectedScope}
                </h4>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setEditing(!editing)}
                  >
                    <Pencil className="h-3.5 w-3.5 mr-1" />
                    {editing ? t('terminal.cancelEdit') : t('terminal.edit')}
                  </Button>
                  {editing && (
                    <Button size="sm" onClick={handleSaveProfile}>
                      <Save className="h-3.5 w-3.5 mr-1" />
                      {t('terminal.save')}
                    </Button>
                  )}
                </div>
              </div>
              {loadingContent ? (
                <Skeleton className="h-32 w-full" />
              ) : (
                <Textarea
                  value={profileContent}
                  onChange={(e) => setProfileContent(e.target.value)}
                  readOnly={!editing}
                  className="font-mono text-xs min-h-[200px]"
                  placeholder={t('terminal.psProfileEmpty')}
                />
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Execution Policy */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-4 w-4" />
            {t('terminal.executionPolicy')}
          </CardTitle>
          <CardDescription>{t('terminal.executionPolicyDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {executionPolicy.length > 0 && (
            <div className="rounded-md border divide-y">
              {executionPolicy.map(([scope, policy]) => (
                <div
                  key={scope}
                  className="flex items-center justify-between px-3 py-2"
                >
                  <span className="text-sm">{scope}</span>
                  <Badge
                    variant={
                      policy === 'Undefined' ? 'outline'
                        : policy === 'Restricted' ? 'destructive'
                          : 'default'
                    }
                  >
                    {policy}
                  </Badge>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center gap-3">
            <Select value={policyScope} onValueChange={setPolicyScope}>
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PS_ALLOWED_SCOPES.map((scope) => (
                  <SelectItem key={scope} value={scope}>
                    {scope}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={policyValue} onValueChange={setPolicyValue}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder={t('terminal.selectPolicy')} />
              </SelectTrigger>
              <SelectContent>
                {PS_VALID_POLICIES.map((policy) => (
                  <SelectItem key={policy} value={policy}>
                    {policy}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              onClick={handleSetPolicy}
              disabled={!policyValue}
            >
              {t('terminal.applyPolicy')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
