'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { useGit } from '@/hooks/use-git';
import { useLocale } from '@/components/providers/locale-provider';
import { isTauri } from '@/lib/tauri';
import { useGitRepoStore } from '@/lib/stores/git';
import {
  GitStatusCard,
  GitConfigCard,
  GitGlobalSettingsCard,
  GitAliasCard,
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
  GitCommitDialog,
  GitDiffViewer,
  GitCloneDialog,
  GitMergeDialog,
  GitReflogCard,
  GitRepoActionBar,
} from '@/components/git';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertCircle, FileText } from 'lucide-react';
import { toast } from 'sonner';
import type { GitCommitDetail as GitCommitDetailType, GitAheadBehind } from '@/types/tauri';

export default function GitPage() {
  const { t } = useLocale();
  const isDesktop = isTauri();
  const git = useGit();
  const repoStore = useGitRepoStore();

  const initializedRef = useRef(false);
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [selectedCommitHash, setSelectedCommitHash] = useState<string | null>(null);
  const [commitDetail, setCommitDetail] = useState<GitCommitDetailType | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [diffContent, setDiffContent] = useState<string>('');
  const [diffLoading, setDiffLoading] = useState(false);
  const [aheadBehind, setAheadBehind] = useState<GitAheadBehind>({ ahead: 0, behind: 0 });
  const [compareFrom, setCompareFrom] = useState('');
  const [compareTo, setCompareTo] = useState('');
  const [contextLines, setContextLines] = useState<number | undefined>(undefined);
  const [configFilePath, setConfigFilePath] = useState<string | null>(null);

  // Restore last repo on mount
  useEffect(() => {
    if (!initializedRef.current && isDesktop) {
      initializedRef.current = true;
      git.refreshAll().then(() => {
        git.getConfigFilePath().then(setConfigFilePath).catch(() => {});
        if (repoStore.lastRepoPath) {
          git.setRepoPath(repoStore.lastRepoPath).catch(() => {});
        }
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDesktop]);

  // Fetch ahead/behind when repo info changes
  useEffect(() => {
    if (git.repoInfo?.currentBranch && git.repoPath) {
      git.getAheadBehind(git.repoInfo.currentBranch).then(setAheadBehind).catch(() => {});
    } else {
      setAheadBehind({ ahead: 0, behind: 0 });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [git.repoInfo?.currentBranch, git.repoPath]);

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

  // --- Event Handlers ---

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
      repoStore.addRecentRepo(path);
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

  const handleSetAlias = async (name: string, command: string) => {
    try {
      await git.setConfigValue(`alias.${name}`, command);
      toast.success(t('git.alias.saved'));
    } catch (e) {
      toast.error(String(e));
    }
  };

  const handleRemoveAlias = async (name: string) => {
    try {
      await git.removeConfigKey(`alias.${name}`);
      toast.success(t('git.alias.removed'));
    } catch (e) {
      toast.error(String(e));
    }
  };

  const handleOpenInEditor = async (): Promise<string> => {
    try {
      return await git.openConfigInEditor();
    } catch (e) {
      toast.error(String(e));
      return '';
    }
  };

  const handleViewDiff = async (file: string, staged?: boolean) => {
    setDiffLoading(true);
    try {
      const d = await git.getDiff(staged, file);
      setDiffContent(d);
      if (activeTab !== 'changes') {
        setActiveTab('changes');
      }
    } finally {
      setDiffLoading(false);
    }
  };

  const refreshRepoData = () => {
    git.refreshRepoInfo();
    git.refreshStatus();
    git.refreshBranches();
    git.refreshRemotes();
    git.refreshTags();
    git.refreshStashes();
    git.refreshContributors();
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
          <TabsTrigger value="changes" disabled={!git.available || !git.repoPath}>
            {t('git.tabs.changes')}
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
            <>
              <GitGlobalSettingsCard
                onGetConfigValue={git.getConfigValue}
                onSetConfig={handleSetConfig}
              />
              <GitAliasCard
                onListAliases={git.listAliases}
                onSetAlias={handleSetAlias}
                onRemoveAlias={handleRemoveAlias}
              />
              <GitConfigCard
                config={git.config}
                onSet={handleSetConfig}
                onRemove={handleRemoveConfig}
                configFilePath={configFilePath}
                onOpenInEditor={handleOpenInEditor}
              />
            </>
          )}
          {git.available === false && <GitEmptyState />}
        </TabsContent>

        {/* Repository Tab */}
        <TabsContent value="repository" className="space-y-4 mt-4">
          <GitRepoSelector
            repoPath={git.repoPath}
            onSelect={handleSelectRepo}
            onInit={git.initRepo}
            loading={git.loading}
          />
          {git.repoInfo ? (
            <>
              <GitRepoInfoCard repoInfo={git.repoInfo} />
              <GitRepoActionBar
                repoPath={git.repoPath}
                currentBranch={git.repoInfo.currentBranch}
                aheadBehind={aheadBehind}
                loading={git.loading}
                onPush={git.push}
                onPull={git.pull}
                onFetch={git.fetch}
                onClean={git.cleanUntracked}
                onRefresh={refreshRepoData}
              />
              <GitStatusFiles
                files={git.statusFiles}
                loading={git.loading}
                onRefresh={() => git.refreshStatus()}
                onStage={git.stageFiles}
                onUnstage={git.unstageFiles}
                onStageAll={git.stageAll}
                onDiscard={git.discardChanges}
                onViewDiff={handleViewDiff}
              />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <GitBranchCard
                  branches={git.branches}
                  currentBranch={git.repoInfo.currentBranch}
                  aheadBehind={aheadBehind}
                  onCheckout={git.checkoutBranch}
                  onCreate={git.createBranch}
                  onDelete={git.deleteBranch}
                  onRename={git.branchRename}
                />
                <GitRemoteCard
                  remotes={git.remotes}
                  onAdd={git.remoteAdd}
                  onRemove={git.remoteRemove}
                  onRename={git.remoteRename}
                  onSetUrl={git.remoteSetUrl}
                />
                <GitStashList
                  stashes={git.stashes}
                  onApply={git.stashApply}
                  onPop={git.stashPop}
                  onDrop={git.stashDrop}
                  onSave={git.stashSave}
                  onShowDiff={git.stashShowDiff}
                />
                <GitTagList
                  tags={git.tags}
                  onCreateTag={git.createTag}
                  onDeleteTag={git.deleteTag}
                  onPushTags={git.pushTags}
                />
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <FileText className="h-10 w-10 text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground">{t('git.repo.noRepo')}</p>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <GitCloneDialog
              onClone={async (url, destPath, options) => {
                try {
                  const msg = await git.cloneRepo(url, destPath, options);
                  toast.success(t('git.cloneAction.success'), { description: msg });
                  repoStore.addCloneHistory({ url, destPath, timestamp: Date.now(), status: 'success' });
                  return msg;
                } catch (e) {
                  repoStore.addCloneHistory({ url, destPath, timestamp: Date.now(), status: 'failed', errorMessage: String(e) });
                  throw e;
                }
              }}
              onExtractRepoName={git.extractRepoName}
              onValidateUrl={git.validateGitUrl}
              onOpenRepo={(path) => handleSelectRepo(path)}
              onCancelClone={git.cancelClone}
              cloneHistory={repoStore.cloneHistory}
              onClearCloneHistory={repoStore.clearCloneHistory}
            />
            {git.repoInfo && (
              <GitMergeDialog
                branches={git.branches}
                currentBranch={git.repoInfo.currentBranch}
                onMerge={async (branch, noFf) => {
                  const msg = await git.merge(branch, noFf);
                  toast.success(t('git.mergeAction.success'), { description: msg });
                  return msg;
                }}
              />
            )}
          </div>
        </TabsContent>

        {/* Graph Tab */}
        <TabsContent value="graph" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <div className="xl:col-span-2">
              <GitCommitGraph
                onLoadGraph={git.getGraphLog}
                onSelectCommit={handleSelectCommit}
                selectedHash={selectedCommitHash}
                branches={git.branches}
                onCopyHash={(hash) => {
                  navigator.clipboard.writeText(hash);
                  toast.success(t('git.graph.copyHash'));
                }}
                onCreateBranch={async (hash) => {
                  const name = prompt(t('git.graph.createBranch'));
                  if (name) {
                    try {
                      const msg = await git.createBranch(name, hash);
                      toast.success(msg);
                    } catch (e) { toast.error(String(e)); }
                  }
                }}
                onCreateTag={async (hash) => {
                  const name = prompt(t('git.graph.createTag'));
                  if (name) {
                    try {
                      const msg = await git.createTag(name, hash);
                      toast.success(msg);
                    } catch (e) { toast.error(String(e)); }
                  }
                }}
                onCherryPick={async (hash) => {
                  try {
                    const msg = await git.cherryPick(hash);
                    toast.success(msg);
                  } catch (e) { toast.error(String(e)); }
                }}
                onRevert={async (hash) => {
                  try {
                    const msg = await git.revertCommit(hash);
                    toast.success(msg);
                  } catch (e) { toast.error(String(e)); }
                }}
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
                onGetCommitDiff={git.getCommitDiff}
              />
              {!selectedCommitHash && (
                <GitContributorsChart contributors={git.contributors} />
              )}
            </div>
          </div>
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <div className="xl:col-span-2">
              <GitCommitLog
                commits={git.commits}
                onLoadMore={(opts) => git.getLog(opts)}
                onSelectCommit={handleSelectCommit}
                selectedHash={selectedCommitHash}
              />
            </div>
            <div className="space-y-4">
              <GitCommitDetail
                hash={selectedCommitHash}
                detail={commitDetail}
                loading={detailLoading}
                onClose={() => {
                  setSelectedCommitHash(null);
                  setCommitDetail(null);
                }}
                onGetCommitDiff={git.getCommitDiff}
              />
              {!selectedCommitHash && (
                <>
                  <GitContributorsChart contributors={git.contributors} />
                  <GitActivityHeatmap onGetActivity={git.getActivity} />
                </>
              )}
              {selectedCommitHash && (
                <GitActivityHeatmap onGetActivity={git.getActivity} />
              )}
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
            onGetCommitDiff={git.getCommitDiff}
          />
          <GitBlameView
            repoPath={git.repoPath}
            onGetBlame={git.getBlame}
          />
          <GitReflogCard
            onGetReflog={git.getReflog}
            onResetTo={async (hash, mode) => {
              const msg = await git.resetHead(mode, hash);
              toast.success(t('git.resetAction.success'), { description: msg });
              return msg;
            }}
          />
        </TabsContent>

        {/* Changes Tab */}
        <TabsContent value="changes" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <GitStatusFiles
              files={git.statusFiles}
              loading={git.loading}
              onRefresh={() => git.refreshStatus()}
              onStage={git.stageFiles}
              onUnstage={git.unstageFiles}
              onStageAll={git.stageAll}
              onDiscard={git.discardChanges}
              onViewDiff={handleViewDiff}
            />
            <GitCommitDialog
              stagedCount={git.statusFiles.filter((f) => f.indexStatus !== " " && f.indexStatus !== "?").length}
              onCommit={async (message, amend) => {
                const msg = await git.commit(message, amend);
                toast.success(t('git.commit.success'), { description: msg });
                return msg;
              }}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                setDiffLoading(true);
                try {
                  const d = await git.getDiff(false, undefined, contextLines);
                  setDiffContent(d);
                } finally {
                  setDiffLoading(false);
                }
              }}
              disabled={!git.repoPath}
            >
              {t('git.diffView.unstaged')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                setDiffLoading(true);
                try {
                  const d = await git.getDiff(true, undefined, contextLines);
                  setDiffContent(d);
                } finally {
                  setDiffLoading(false);
                }
              }}
              disabled={!git.repoPath}
            >
              {t('git.diffView.staged')}
            </Button>
            <span className="w-px h-6 bg-border self-center mx-1" />
            <input
              type="text"
              placeholder={t('git.diffView.fromCommit')}
              value={compareFrom}
              onChange={(e) => setCompareFrom(e.target.value)}
              className="h-8 w-28 rounded-md border border-input bg-background px-2 text-xs font-mono placeholder:text-muted-foreground"
            />
            <span className="self-center text-xs text-muted-foreground">..</span>
            <input
              type="text"
              placeholder={t('git.diffView.toCommit')}
              value={compareTo}
              onChange={(e) => setCompareTo(e.target.value)}
              className="h-8 w-28 rounded-md border border-input bg-background px-2 text-xs font-mono placeholder:text-muted-foreground"
            />
            <Button
              variant="outline"
              size="sm"
              disabled={!git.repoPath || !compareFrom.trim() || !compareTo.trim() || diffLoading}
              onClick={async () => {
                setDiffLoading(true);
                try {
                  const d = await git.getDiffBetween(compareFrom.trim(), compareTo.trim(), undefined, contextLines);
                  setDiffContent(d);
                } catch (e) {
                  toast.error(String(e));
                } finally {
                  setDiffLoading(false);
                }
              }}
            >
              {t('git.diffView.compare')}
            </Button>
            <span className="w-px h-6 bg-border self-center mx-1" />
            <Select
              value={contextLines === undefined ? 'default' : String(contextLines)}
              onValueChange={(v) => setContextLines(v === 'default' ? undefined : Number(v))}
            >
              <SelectTrigger className="h-8 w-[100px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default">{t('git.diffView.contextDefault')}</SelectItem>
                <SelectItem value="5">5 {t('git.diffView.contextLines')}</SelectItem>
                <SelectItem value="10">10 {t('git.diffView.contextLines')}</SelectItem>
                <SelectItem value="20">20 {t('git.diffView.contextLines')}</SelectItem>
                <SelectItem value="50">{t('git.diffView.contextAll')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <GitDiffViewer
            diff={diffContent}
            loading={diffLoading}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
