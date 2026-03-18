import type { EnvVarScope } from '@/types/tauri';
import {
  handleApplyImportPreviewAction,
  handleApplyPathRepairAction,
  handleExportAction,
  handleImportAction,
  handlePathDeduplicateAction,
  handlePreviewImportAction,
  handlePreviewPathRepairAction,
  handleRefreshAction,
  handleResolveConflictAction,
  handleScopeFilterChangeAction,
  runPathMutationAction,
  runVarMutationAction,
} from './page-action-handlers';

function createContext() {
  return {
    setActionError: jest.fn(),
    setActionNotice: jest.fn(),
    setActiveAction: jest.fn(),
    formatActionError: (action: string, message: string) => `${action}: ${message}`,
    t: (key: string) => key,
    toastApi: {
      success: jest.fn(),
      warning: jest.fn(),
      error: jest.fn(),
    },
  };
}

describe('page action handlers', () => {
  it('runs scoped refresh handlers and clears state after success', async () => {
    const context = createContext();
    const refreshVariables = jest.fn().mockResolvedValue(undefined);
    const setScopeFilter = jest.fn();

    await handleScopeFilterChangeAction({
      scope: 'user',
      refreshVariables,
      setScopeFilter,
      ...context,
    });

    expect(setScopeFilter).toHaveBeenCalledWith('user');
    expect(refreshVariables).toHaveBeenCalledWith('user');
    expect(context.setActiveAction).toHaveBeenNthCalledWith(1, 'refresh');
    expect(context.setActiveAction).toHaveBeenLastCalledWith(null);

    await handleRefreshAction({
      scopeFilter: 'all',
      refreshVariables,
      ...context,
    });

    expect(refreshVariables).toHaveBeenLastCalledWith('all', { forceRefresh: true });
  });

  it('surfaces refresh errors from scope changes and explicit refreshes', async () => {
    const context = createContext();
    const refreshVariables = jest
      .fn()
      .mockRejectedValueOnce(new Error('scope refresh failed'))
      .mockRejectedValueOnce(new Error('button refresh failed'));

    await handleScopeFilterChangeAction({
      scope: 'system',
      refreshVariables,
      setScopeFilter: jest.fn(),
      ...context,
    });

    expect(context.setActionError).toHaveBeenCalledWith('scope refresh failed');

    await handleRefreshAction({
      scopeFilter: 'system',
      refreshVariables,
      ...context,
    });

    expect(context.setActionError).toHaveBeenLastCalledWith('button refresh failed');
  });

  it('handles variable mutations across success, manual follow-up, failure, and thrown errors', async () => {
    const context = createContext();
    const refreshVariables = jest.fn().mockResolvedValue(undefined);

    await runVarMutationAction({
      action: 'add',
      scope: 'user',
      mutate: jest.fn().mockResolvedValue({
        success: true,
        status: 'manual_followup_required',
        message: 'manual follow-up required',
      }),
      successMessage: 'saved',
      scopeFilter: 'all',
      refreshVariables,
      ...context,
    });

    expect(refreshVariables).toHaveBeenCalledWith('all', { forceRefresh: true });
    expect(context.setActionNotice).toHaveBeenCalledWith('manual follow-up required');
    expect(context.toastApi.warning).toHaveBeenCalledWith('manual follow-up required');

    await runVarMutationAction({
      action: 'edit',
      scope: 'process',
      mutate: jest.fn().mockResolvedValue(true),
      successMessage: 'saved',
      scopeFilter: 'process',
      refreshVariables,
      ...context,
    });

    expect(context.toastApi.success).toHaveBeenCalledWith('saved');

    const failedResult = await runVarMutationAction({
      action: 'delete',
      scope: 'process',
      mutate: jest.fn().mockResolvedValue({ success: false, status: 'verification_failed', message: 'not deleted' }),
      successMessage: 'deleted',
      scopeFilter: 'process',
      refreshVariables,
      ...context,
    });

    expect(failedResult).toBe(false);
    expect(context.setActionError).toHaveBeenLastCalledWith('delete: not deleted');

    const thrownResult = await runVarMutationAction({
      action: 'delete',
      scope: 'process',
      mutate: jest.fn().mockRejectedValue(new Error('mutation exploded')),
      successMessage: 'deleted',
      scopeFilter: 'process',
      refreshVariables,
      ...context,
    });

    expect(thrownResult).toBe(false);
    expect(context.setActionError).toHaveBeenLastCalledWith('delete: mutation exploded');
    expect(context.toastApi.error).toHaveBeenCalledWith('mutation exploded');
  });

  it('falls back to generic messages for null and boolean-false variable mutations', async () => {
    const context = createContext();
    const refreshVariables = jest.fn().mockResolvedValue(undefined);

    const nullResult = await runVarMutationAction({
      action: 'add',
      scope: 'process',
      mutate: jest.fn().mockResolvedValue(null),
      successMessage: 'saved',
      scopeFilter: 'process',
      refreshVariables,
      toastApi: context.toastApi,
      ...context,
    });

    expect(nullResult).toBe(false);
    expect(context.setActionError).toHaveBeenCalledWith('add: common.error');

    const falseResult = await runVarMutationAction({
      action: 'edit',
      scope: 'process',
      mutate: jest.fn().mockResolvedValue(false),
      successMessage: 'saved',
      scopeFilter: 'process',
      refreshVariables,
      toastApi: context.toastApi,
      ...context,
    });

    expect(falseResult).toBe(false);
    expect(context.setActionError).toHaveBeenLastCalledWith('edit: envvar.workflow.verificationFailed');
  });

  it('handles path mutations and deduplicate follow-up states', async () => {
    const context = createContext();

    await runPathMutationAction({
      action: 'path-add',
      mutation: jest.fn().mockResolvedValue({ success: true, status: 'manual_followup_required', message: 'update shell profile' }),
      ...context,
    });

    expect(context.setActionNotice).toHaveBeenCalledWith('update shell profile');

    const failedResult = await runPathMutationAction({
      action: 'path-remove',
      mutation: jest.fn().mockResolvedValue(null),
      ...context,
    });

    expect(failedResult).toBe(false);
    expect(context.setActionError).toHaveBeenLastCalledWith('path-remove: common.error');

    const deduplicateResult = await handlePathDeduplicateAction({
      pathScope: 'user',
      deduplicatePath: jest.fn().mockResolvedValue({
        removedCount: 2,
        status: 'manual_followup_required',
        message: 'restart shell',
      }),
      ...context,
    });

    expect(deduplicateResult).toBe(2);
    expect(context.setActionNotice).toHaveBeenLastCalledWith('restart shell');
  });

  it('falls back to default path mutation messages and deduplicate errors', async () => {
    const context = createContext();

    const falseResult = await runPathMutationAction({
      action: 'path-reorder',
      mutation: jest.fn().mockResolvedValue(false),
      ...context,
    });

    expect(falseResult).toBe(false);
    expect(context.setActionError).toHaveBeenCalledWith('path-reorder: envvar.workflow.verificationFailed');

    const thrownResult = await runPathMutationAction({
      action: 'path-remove',
      mutation: jest.fn().mockRejectedValue(new Error('path mutation exploded')),
      ...context,
    });

    expect(thrownResult).toBe(false);
    expect(context.setActionError).toHaveBeenLastCalledWith('path-remove: path mutation exploded');

    const deduplicateResult = await handlePathDeduplicateAction({
      pathScope: 'process',
      deduplicatePath: jest.fn().mockRejectedValue(new Error('deduplicate exploded')),
      ...context,
    });

    expect(deduplicateResult).toBe(0);
    expect(context.setActionError).toHaveBeenLastCalledWith('deduplicate exploded');
  });

  it('surfaces preview and apply import errors, including stale previews', async () => {
    const context = createContext();

    const previewResult = await handlePreviewImportAction({
      content: 'FOO=bar',
      scope: 'user',
      previewImportEnvFile: jest.fn().mockResolvedValue(null),
      ...context,
    });

    expect(previewResult).toBeNull();
    expect(context.setActionError).toHaveBeenCalledWith('import-preview: common.error');

    const staleApplyResult = await handleApplyImportPreviewAction({
      content: 'FOO=bar',
      scope: 'user',
      fingerprint: 'fp',
      importPreviewStale: true,
      applyImportPreview: jest.fn().mockResolvedValue(null),
      ...context,
    });

    expect(staleApplyResult).toBeNull();
    expect(context.setActionError).toHaveBeenLastCalledWith('import: envvar.importExport.previewStale');

    const manualResult = await handleApplyImportPreviewAction({
      content: 'FOO=bar',
      scope: 'user',
      fingerprint: 'fp',
      importPreviewStale: false,
      applyImportPreview: jest.fn().mockResolvedValue({
        success: true,
        status: 'manual_followup_required',
        message: 'run shell sync',
      }),
      ...context,
    });

    expect(manualResult).toMatchObject({ status: 'manual_followup_required' });
    expect(context.setActionNotice).toHaveBeenLastCalledWith('run shell sync');
  });

  it('handles thrown import preview and apply preview errors', async () => {
    const context = createContext();

    const previewResult = await handlePreviewImportAction({
      content: 'FOO=bar',
      scope: 'user',
      previewImportEnvFile: jest.fn().mockRejectedValue(new Error('preview exploded')),
      ...context,
    });

    expect(previewResult).toBeNull();
    expect(context.setActionError).toHaveBeenCalledWith('import-preview: preview exploded');

    const applyResult = await handleApplyImportPreviewAction({
      content: 'FOO=bar',
      scope: 'user',
      fingerprint: 'fp',
      importPreviewStale: false,
      applyImportPreview: jest.fn().mockRejectedValue(new Error('apply preview exploded')),
      ...context,
    });

    expect(applyResult).toBeNull();
    expect(context.setActionError).toHaveBeenLastCalledWith('import: apply preview exploded');
  });

  it('surfaces path repair preview and apply errors, including stale previews', async () => {
    const context = createContext();

    const previewResult = await handlePreviewPathRepairAction({
      pathScope: 'user',
      previewPathRepair: jest.fn().mockRejectedValue(new Error('repair preview failed')),
      ...context,
    });

    expect(previewResult).toBeNull();
    expect(context.setActionError).toHaveBeenCalledWith('path-repair: repair preview failed');

    const staleApplyResult = await handleApplyPathRepairAction({
      fingerprint: 'repair-fp',
      pathScope: 'user',
      pathRepairPreviewStale: true,
      applyPathRepair: jest.fn().mockResolvedValue(null),
      ...context,
    });

    expect(staleApplyResult).toBeNull();
    expect(context.setActionError).toHaveBeenLastCalledWith('path-repair: envvar.pathEditor.repairPreviewStale');

    const manualResult = await handleApplyPathRepairAction({
      fingerprint: 'repair-fp',
      pathScope: 'user',
      pathRepairPreviewStale: false,
      applyPathRepair: jest.fn().mockResolvedValue({
        removedCount: 1,
        status: 'manual_followup_required',
        message: 'repair requires restart',
      }),
      ...context,
    });

    expect(manualResult).toBe(1);
    expect(context.setActionNotice).toHaveBeenLastCalledWith('repair requires restart');
  });

  it('handles null and thrown path repair branches', async () => {
    const context = createContext();

    const previewResult = await handlePreviewPathRepairAction({
      pathScope: 'process',
      previewPathRepair: jest.fn().mockResolvedValue(null),
      ...context,
    });

    expect(previewResult).toBeNull();
    expect(context.setActionError).toHaveBeenCalledWith('path-repair: common.error');

    const applyResult = await handleApplyPathRepairAction({
      fingerprint: 'repair-fp',
      pathScope: 'process',
      pathRepairPreviewStale: false,
      applyPathRepair: jest.fn().mockRejectedValue(new Error('apply repair exploded')),
      ...context,
    });

    expect(applyResult).toBeNull();
    expect(context.setActionError).toHaveBeenLastCalledWith('path-repair: apply repair exploded');
  });

  it('handles conflict resolution outcomes', async () => {
    const context = createContext();

    const nullResult = await handleResolveConflictAction({
      key: 'JAVA_HOME',
      sourceScope: 'system',
      targetScope: 'user',
      resolveConflict: jest.fn().mockResolvedValue(null),
      ...context,
    });

    expect(nullResult).toBe(false);
    expect(context.setActionError).toHaveBeenCalledWith('conflict-resolve: common.error');

    await handleResolveConflictAction({
      key: 'JAVA_HOME',
      sourceScope: 'system',
      targetScope: 'user',
      resolveConflict: jest.fn().mockResolvedValue({
        success: true,
        status: 'manual_followup_required',
        message: 'conflict follow-up',
      }),
      ...context,
    });

    expect(context.setActionNotice).toHaveBeenLastCalledWith('conflict follow-up');

    await handleResolveConflictAction({
      key: 'JAVA_HOME',
      sourceScope: 'system',
      targetScope: 'user',
      resolveConflict: jest.fn().mockResolvedValue({
        success: true,
        status: 'verified',
      }),
      ...context,
    });

    expect(context.toastApi.success).toHaveBeenCalledWith('common.saved');
  });

  it('handles thrown conflict resolution errors', async () => {
    const context = createContext();

    const result = await handleResolveConflictAction({
      key: 'JAVA_HOME',
      sourceScope: 'system',
      targetScope: 'user',
      resolveConflict: jest.fn().mockRejectedValue(new Error('conflict exploded')),
      ...context,
    });

    expect(result).toBe(false);
    expect(context.setActionError).toHaveBeenCalledWith('conflict-resolve: conflict exploded');
  });

  it('handles direct import workflows across success, failure, and thrown errors', async () => {
    const context = createContext();
    const refreshVariables = jest.fn().mockResolvedValue(undefined);

    await handleImportAction({
      content: 'FOO=bar',
      scope: 'user',
      scopeFilter: 'all',
      importEnvFile: jest.fn().mockResolvedValue({
        success: true,
        status: 'manual_followup_required',
        message: 'manual import follow-up',
      }),
      refreshVariables,
      ...context,
    });

    expect(refreshVariables).toHaveBeenCalledWith('all', { forceRefresh: true });
    expect(context.setActionNotice).toHaveBeenLastCalledWith('manual import follow-up');

    const failedResult = await handleImportAction({
      content: 'FOO=bar',
      scope: 'user',
      scopeFilter: 'user',
      importEnvFile: jest.fn().mockResolvedValue({
        success: false,
        status: 'verification_failed',
        message: 'import failed',
      }),
      refreshVariables,
      ...context,
    });

    expect(failedResult).toMatchObject({ success: false });
    expect(context.setActionError).toHaveBeenLastCalledWith('import: import failed');

    const thrownResult = await handleImportAction({
      content: 'FOO=bar',
      scope: 'user',
      scopeFilter: 'user',
      importEnvFile: jest.fn().mockRejectedValue(new Error('import exploded')),
      refreshVariables,
      ...context,
    });

    expect(thrownResult).toBeNull();
    expect(context.setActionError).toHaveBeenLastCalledWith('import: import exploded');
  });

  it('handles export workflows across null and thrown results', async () => {
    const context = createContext();

    const nullResult = await handleExportAction({
      scope: 'process',
      format: 'dotenv',
      exportEnvFile: jest.fn().mockResolvedValue(null),
      ...context,
    });

    expect(nullResult).toBeNull();
    expect(context.setActionError).toHaveBeenCalledWith('export: common.error');

    const thrownResult = await handleExportAction({
      scope: 'process',
      format: 'dotenv',
      includeSensitive: true,
      exportEnvFile: jest.fn().mockRejectedValue(new Error('export exploded')),
      ...context,
    });

    expect(thrownResult).toBeNull();
    expect(context.setActionError).toHaveBeenLastCalledWith('export: export exploded');
  });

  it('covers default fallback branches for action handlers', async () => {
    const context = createContext();
    const refreshVariables = jest
      .fn()
      .mockRejectedValueOnce('scope string failure')
      .mockRejectedValueOnce('refresh string failure');

    await handleScopeFilterChangeAction({
      scope: 'all',
      refreshVariables,
      setScopeFilter: jest.fn(),
      setActionError: context.setActionError,
      setActionNotice: context.setActionNotice,
      setActiveAction: context.setActiveAction,
    });
    expect(context.setActionError).toHaveBeenLastCalledWith('scope string failure');

    await handleRefreshAction({
      scopeFilter: 'all',
      refreshVariables,
      setActionError: context.setActionError,
      setActionNotice: context.setActionNotice,
      setActiveAction: context.setActiveAction,
    });
    expect(context.setActionError).toHaveBeenLastCalledWith('refresh string failure');

    await runVarMutationAction({
      action: 'add',
      scope: 'user',
      mutate: jest.fn().mockResolvedValue({ success: true, status: 'manual_followup_required' }),
      successMessage: 'saved',
      scopeFilter: 'all',
      refreshVariables: jest.fn().mockResolvedValue(undefined),
      toastApi: context.toastApi,
      ...context,
    });
    expect(context.setActionNotice).toHaveBeenLastCalledWith('envvar.workflow.manualFollowup');

    await runVarMutationAction({
      action: 'delete',
      scope: 'process',
      mutate: jest.fn().mockRejectedValue('delete string failure'),
      successMessage: 'deleted',
      scopeFilter: 'process',
      refreshVariables: jest.fn().mockResolvedValue(undefined),
      toastApi: context.toastApi,
      ...context,
    });
    expect(context.setActionError).toHaveBeenLastCalledWith('delete: delete string failure');

    await runPathMutationAction({
      action: 'path-add',
      mutation: jest.fn().mockResolvedValue({ success: true, status: 'manual_followup_required' }),
      ...context,
    });
    expect(context.setActionNotice).toHaveBeenLastCalledWith('envvar.workflow.manualFollowup');

    await runPathMutationAction({
      action: 'path-remove',
      mutation: jest.fn().mockRejectedValue('path string failure'),
      ...context,
    });
    expect(context.setActionError).toHaveBeenLastCalledWith('path-remove: path string failure');

    await handlePathDeduplicateAction({
      pathScope: 'user',
      deduplicatePath: jest.fn().mockResolvedValue({ status: 'manual_followup_required', removedCount: 0 }),
      ...context,
    });
    expect(context.setActionNotice).toHaveBeenLastCalledWith('envvar.workflow.manualFollowup');

    await handlePreviewImportAction({
      content: 'A=1',
      scope: 'process',
      previewImportEnvFile: jest.fn().mockRejectedValue('preview string failure'),
      ...context,
    });
    expect(context.setActionError).toHaveBeenLastCalledWith('import-preview: preview string failure');

    await handleApplyImportPreviewAction({
      content: 'A=1',
      scope: 'process',
      fingerprint: 'fp',
      importPreviewStale: false,
      applyImportPreview: jest.fn().mockResolvedValue(null),
      ...context,
    });
    expect(context.setActionError).toHaveBeenLastCalledWith('import: common.error');

    await handlePreviewPathRepairAction({
      pathScope: 'process',
      previewPathRepair: jest.fn().mockResolvedValue(null),
      ...context,
    });
    expect(context.setActionError).toHaveBeenLastCalledWith('path-repair: common.error');

    await handleApplyPathRepairAction({
      fingerprint: 'fp',
      pathScope: 'process',
      pathRepairPreviewStale: false,
      applyPathRepair: jest.fn().mockResolvedValue({ removedCount: 0, status: 'manual_followup_required' }),
      ...context,
    });
    expect(context.setActionNotice).toHaveBeenLastCalledWith('envvar.workflow.manualFollowup');

    await handleResolveConflictAction({
      key: 'JAVA_HOME',
      sourceScope: 'system',
      targetScope: 'user',
      resolveConflict: jest.fn().mockResolvedValue({ status: 'manual_followup_required' }),
      ...context,
    });
    expect(context.setActionNotice).toHaveBeenLastCalledWith('envvar.workflow.manualFollowup');

    await handleResolveConflictAction({
      key: 'JAVA_HOME',
      sourceScope: 'system',
      targetScope: 'user',
      resolveConflict: jest.fn().mockRejectedValue('conflict string failure'),
      ...context,
    });
    expect(context.setActionError).toHaveBeenLastCalledWith('conflict-resolve: conflict string failure');

    await handleImportAction({
      content: 'A=1',
      scope: 'user',
      scopeFilter: 'all',
      importEnvFile: jest.fn().mockResolvedValue({ success: true, status: 'manual_followup_required' } as never),
      refreshVariables: jest.fn().mockResolvedValue(undefined),
      ...context,
    });
    expect(context.setActionNotice).toHaveBeenLastCalledWith('envvar.workflow.manualFollowup');

    await handleImportAction({
      content: 'A=1',
      scope: 'user',
      scopeFilter: 'all',
      importEnvFile: jest.fn().mockResolvedValue({ success: false, status: 'verification_failed' } as never),
      refreshVariables: jest.fn().mockResolvedValue(undefined),
      ...context,
    });
    expect(context.setActionError).toHaveBeenLastCalledWith('import: envvar.workflow.verificationFailed');

    await handleImportAction({
      content: 'A=1',
      scope: 'user',
      scopeFilter: 'all',
      importEnvFile: jest.fn().mockRejectedValue('import string failure'),
      refreshVariables: jest.fn().mockResolvedValue(undefined),
      ...context,
    });
    expect(context.setActionError).toHaveBeenLastCalledWith('import: import string failure');

    await handleExportAction({
      scope: 'process',
      format: 'dotenv',
      exportEnvFile: jest.fn().mockRejectedValue('export string failure'),
      ...context,
    });
    expect(context.setActionError).toHaveBeenLastCalledWith('export: export string failure');
  });
});
