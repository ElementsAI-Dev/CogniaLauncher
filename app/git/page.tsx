'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { useGit } from '@/hooks/use-git';
import { useLocale } from '@/components/providers/locale-provider';
import { isTauri } from '@/lib/tauri';
import {
  GitStatusCard,
  GitConfigCard,
  GitRepoSelector,
  GitBranchCard,
  GitRemoteCard,
  GitStashList,
  GitTagList,
  GitCommitLog,
  GitContributorsChart,
  GitFileHistory,
  GitBlameView,
  GitEmptyState,
  GitNotAvailable,
  GitRepoInfoCard,
  GitCommitDetail,
  GitStatusFiles,
  GitSearchCommits,
  GitCommitGraph,
  GitVisualFileHistory,
  GitActivityHeatmap,
} from '@/components/git';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, FileText } from 'lucide-react';
import { toast } from 'sonner';
import type { GitCommitDetail as GitCommitDetailType } from '@/types/tauri';

export default function GitPage() {
  const { t } = useLocale();
  const isDesktop = isTauri();
  const git = useGit();

  const initializedRef = useRef(false);
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [selectedCommitHash, setSelectedCommitHash] = useState<string | null>(null);
  const [commitDetail, setCommitDetail] = useState<GitCommitDetailType | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    if (!initializedRef.current && isDesktop) {
      initializedRef.current = true;
      git.refreshAll();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDesktop]);

  const handleSelectCommit = useCallback(async (hash: string) => {
    setSelectedCommitHash(hash);
    setDetailLoading(true);
    try {
      const detail = await git.getCommitDetail(hash);
      setCommitDetail(detail);
    } finally {
      setDetailLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [git.getCommitDetail]);

  if (!isDesktop) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <PageHeader title={t('git.title')} description={t('git.description')} />
        <GitNotAvailable />
      </div>
    );
  }

  const handleInstall = async () => {
    try {
      const msg = await git.installGit();
      toast.success(t('git.status.installSuccess'), { description: msg });
    } catch (e) {
      toast.error(String(e));
    }
  };

  const handleUpdate = async () => {
    try {
      const msg = await git.updateGit();
      toast.success(t('git.status.updateSuccess'), { description: msg });
    } catch (e) {
      toast.error(String(e));
    }
  };

  const handleSelectRepo = async (path: string) => {
    try {
      await git.setRepoPath(path);
    } catch (e) {
      toast.error(String(e));
    }
  };

  const handleSetConfig = async (key: string, value: string) => {
    try {
      await git.setConfigValue(key, value);
      toast.success(t('git.config.saved'));
    } catch (e) {
      toast.error(String(e));
    }
  };

  const handleRemoveConfig = async (key: string) => {
    try {
      await git.removeConfigKey(key);
      toast.success(t('git.config.removed'));
    } catch (e) {
      toast.error(String(e));
    }
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader title={t('git.title')} description={t('git.description')} />

      {git.error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{git.error}</AlertDescription>
        </Alert>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">{t('git.tabs.overview')}</TabsTrigger>
          <TabsTrigger value="repository" disabled={!git.available}>
            {t('git.tabs.repository')}
          </TabsTrigger>
          <TabsTrigger value="graph" disabled={!git.available || !git.repoPath}>
            {t('git.tabs.graph')}
          </TabsTrigger>
          <TabsTrigger value="history" disabled={!git.available || !git.repoPath}>
            {t('git.tabs.history')}
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4 mt-4">
          <GitStatusCard
            available={git.available}
            version={git.version}
            executablePath={git.executablePath}
            loading={git.loading}
            onInstall={handleInstall}
            onUpdate={handleUpdate}
            onRefresh={() => git.refreshAll()}
          />
          {git.available && (
            <GitConfigCard
              config={git.config}
              onSet={handleSetConfig}
              onRemove={handleRemoveConfig}
            />
          )}
          {git.available === false && <GitEmptyState />}
        </TabsContent>

        {/* Repository Tab */}
        <TabsContent value="repository" className="space-y-4 mt-4">
          <GitRepoSelector
            repoPath={git.repoPath}
            onSelect={handleSelectRepo}
            loading={git.loading}
          />
          {git.repoInfo ? (
            <>
              <GitRepoInfoCard repoInfo={git.repoInfo} />
              <GitStatusFiles
                files={git.statusFiles}
                loading={git.loading}
                onRefresh={() => git.refreshStatus()}
              />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <GitBranchCard branches={git.branches} />
                <GitRemoteCard remotes={git.remotes} />
                <GitStashList stashes={git.stashes} />
                <GitTagList tags={git.tags} />
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <FileText className="h-10 w-10 text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground">{t('git.repo.noRepo')}</p>
            </div>
          )}
        </TabsContent>

        {/* Graph Tab */}
        <TabsContent value="graph" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <div className="xl:col-span-2">
              <GitCommitGraph
                onLoadGraph={git.getGraphLog}
                onSelectCommit={handleSelectCommit}
                selectedHash={selectedCommitHash}
              />
            </div>
            <div>
              <GitCommitDetail
                hash={selectedCommitHash}
                detail={commitDetail}
                loading={detailLoading}
                onClose={() => {
                  setSelectedCommitHash(null);
                  setCommitDetail(null);
                }}
              />
              {!selectedCommitHash && (
                <GitContributorsChart contributors={git.contributors} />
              )}
            </div>
          </div>
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2">
              <GitCommitLog
                commits={git.commits}
                onLoadMore={(opts) => git.getLog(opts)}
                onSelectCommit={handleSelectCommit}
                selectedHash={selectedCommitHash}
              />
            </div>
            <div className="space-y-4">
              <GitContributorsChart contributors={git.contributors} />
              <GitActivityHeatmap onGetActivity={git.getActivity} />
            </div>
          </div>
          <GitSearchCommits
            onSearch={git.searchCommits}
            onSelectCommit={handleSelectCommit}
          />
          <GitVisualFileHistory
            repoPath={git.repoPath}
            onGetFileStats={git.getFileStats}
          />
          <GitFileHistory
            repoPath={git.repoPath}
            onGetHistory={git.getFileHistory}
          />
          <GitBlameView
            repoPath={git.repoPath}
            onGetBlame={git.getBlame}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
