'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Shield, FileText, Pencil, RefreshCw, Save, Eye } from 'lucide-react';
import type { PSProfileInfo } from '@/types/tauri';
import { useLocale } from '@/components/providers/locale-provider';
import { PS_VALID_POLICIES, PS_ALLOWED_SCOPES } from '@/lib/constants/terminal';

function getPolicyDescription(policy: string): string | null {
  switch (policy) {
    case 'Restricted': return 'No scripts can run. Only interactive commands.';
    case 'AllSigned': return 'Only scripts signed by a trusted publisher can run.';
    case 'RemoteSigned': return 'Downloaded scripts must be signed. Local scripts can run.';
    case 'Unrestricted': return 'All scripts can run. Shows warning for downloaded scripts.';
    case 'Bypass': return 'Nothing is blocked. No warnings or prompts.';
    case 'Undefined': return 'No policy set at this scope.';
    default: return null;
  }
}

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
  const [policyConfirmOpen, setPolicyConfirmOpen] = useState(false);

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
          <CardTitle className="text-base">{t('terminal.psProfiles')}</CardTitle>
          <CardDescription>{t('terminal.psProfilesDesc')}</CardDescription>
          <CardAction>
            <Button size="sm" variant="outline" onClick={handleRefresh}>
              <RefreshCw className="h-3.5 w-3.5 mr-1" />
              {t('common.refresh')}
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="space-y-4">
          {psProfiles.length === 0 ? (
            <Empty className="border-dashed py-6">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <FileText />
                </EmptyMedia>
                <EmptyTitle className="text-sm font-normal text-muted-foreground">
                  {t('terminal.noPsProfiles')}
                </EmptyTitle>
              </EmptyHeader>
            </Empty>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden sm:block rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('terminal.scope')}</TableHead>
                      <TableHead>{t('terminal.path')}</TableHead>
                      <TableHead className="w-[100px]">{t('terminal.status')}</TableHead>
                      <TableHead className="w-[80px] text-right" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {psProfiles.map((profile) => (
                      <TableRow key={profile.scope}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                            <span className="text-sm font-medium">{profile.scope}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="text-xs text-muted-foreground font-mono truncate max-w-[300px] inline-block">
                                {profile.path}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="max-w-sm font-mono text-xs break-all">
                              {profile.path}
                            </TooltipContent>
                          </Tooltip>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Badge variant={profile.exists ? 'default' : 'outline'}>
                              {profile.exists ? t('terminal.exists') : t('terminal.notExists')}
                            </Badge>
                            {profile.exists && (
                              <span className="text-xs text-muted-foreground">
                                {(profile.sizeBytes / 1024).toFixed(1)} KB
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          {profile.exists && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7"
                                  onClick={() => handleLoadProfile(profile.scope)}
                                  aria-label={`${t('terminal.viewProfile')} ${profile.scope}`}
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="top">{t('terminal.viewProfile')}</TooltipContent>
                            </Tooltip>
                          )}
                          {!profile.exists && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7"
                                  onClick={() => {
                                    setSelectedScope(profile.scope);
                                    setProfileContent('');
                                    setEditing(true);
                                  }}
                                  aria-label={`Create ${profile.scope} profile`}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="top">{t('terminal.create')}</TooltipContent>
                            </Tooltip>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile layout */}
              <div className="sm:hidden space-y-2">
                {psProfiles.map((profile) => (
                  <div key={profile.scope} className="rounded-md border p-3 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{profile.scope}</span>
                      <Badge variant={profile.exists ? 'default' : 'outline'}>
                        {profile.exists ? t('terminal.exists') : t('terminal.notExists')}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground font-mono truncate">{profile.path}</p>
                    <div className="flex gap-2">
                      {profile.exists && (
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleLoadProfile(profile.scope)}>
                          <Eye className="h-3 w-3 mr-1" />{t('terminal.viewProfile')}
                        </Button>
                      )}
                      {!profile.exists && (
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setSelectedScope(profile.scope); setProfileContent(''); setEditing(true); }}>
                          <Pencil className="h-3 w-3 mr-1" />{t('terminal.create')}
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
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
                <div className="flex rounded-md border overflow-hidden">
                  <div className="bg-muted/50 text-muted-foreground text-xs font-mono text-right py-2 px-2 select-none leading-6.5 min-w-12 border-r">
                    {profileContent.split('\n').map((_, i) => (
                      <div key={i}>{i + 1}</div>
                    ))}
                  </div>
                  <Textarea
                    value={profileContent}
                    onChange={(e) => setProfileContent(e.target.value)}
                    readOnly={!editing}
                    className="font-mono text-xs min-h-50 border-0 rounded-none focus-visible:ring-0 resize-none leading-6.5"
                    placeholder={t('terminal.psProfileEmpty')}
                  />
                </div>
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
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('terminal.scope')}</TableHead>
                    <TableHead className="text-right">{t('terminal.policy')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {executionPolicy.map(([scope, policy]) => (
                    <TableRow key={scope}>
                      <TableCell className="text-sm">{scope}</TableCell>
                      <TableCell className="text-right">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge
                              variant={
                                policy === 'Undefined' ? 'outline'
                                  : policy === 'Restricted' ? 'destructive'
                                    : 'default'
                              }
                            >
                              {policy}
                            </Badge>
                          </TooltipTrigger>
                          {getPolicyDescription(policy) && (
                            <TooltipContent side="top" className="max-w-60 text-xs">{getPolicyDescription(policy)}</TooltipContent>
                          )}
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
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
              onClick={() => setPolicyConfirmOpen(true)}
              disabled={!policyValue}
            >
              {t('terminal.applyPolicy')}
            </Button>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={policyConfirmOpen} onOpenChange={setPolicyConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('terminal.executionPolicy')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('terminal.confirmPolicyChange', { policy: policyValue, scope: policyScope })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('terminal.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={() => { handleSetPolicy(); setPolicyConfirmOpen(false); }}>
              {t('terminal.applyPolicy')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
