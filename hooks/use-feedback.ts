'use client';

import { useState, useCallback } from 'react';
import { isTauri, getOsLabel, getOsVersion, getArch } from '@/lib/platform';
import * as tauri from '@/lib/tauri';
import { APP_VERSION } from '@/lib/app-version';
import { toast } from 'sonner';
import { useFeedbackStore } from '@/lib/stores/feedback';
import type {
  FeedbackFormData,
  FeedbackItem,
  FeedbackSaveResult,
  FeedbackCategory,
  FeedbackErrorContext,
} from '@/types/feedback';

export interface UseFeedbackReturn {
  submitting: boolean;
  submitFeedback: (
    data: FeedbackFormData,
    t: (key: string) => string,
  ) => Promise<FeedbackSaveResult | null>;
  openFeedbackDialog: (options?: {
    category?: FeedbackCategory;
    errorContext?: FeedbackErrorContext;
  }) => void;
  closeFeedbackDialog: () => void;
  listFeedbacks: () => Promise<FeedbackItem[]>;
  deleteFeedback: (id: string) => Promise<void>;
  exportFeedbackJson: (id: string) => Promise<string | null>;
  feedbackCount: () => Promise<number>;
}

export function useFeedback(): UseFeedbackReturn {
  const [submitting, setSubmitting] = useState(false);
  const { openDialog, closeDialog } = useFeedbackStore();

  const submitFeedback = useCallback(
    async (
      data: FeedbackFormData,
      t: (key: string) => string,
    ): Promise<FeedbackSaveResult | null> => {
      setSubmitting(true);
      try {
        const systemInfo = await getBasicSystemInfo();

        if (isTauri()) {
          const result = await tauri.feedbackSave({
            category: data.category,
            severity: data.severity,
            title: data.title,
            description: data.description,
            contactEmail: data.contactEmail,
            screenshot: data.screenshot,
            includeDiagnostics: data.includeDiagnostics,
            appVersion: systemInfo.appVersion,
            os: systemInfo.os,
            arch: systemInfo.arch,
            currentPage: systemInfo.currentPage,
            errorContext: data.errorContext
              ? {
                  message: data.errorContext.message,
                  stack: data.errorContext.stack,
                  component: data.errorContext.component,
                  digest: data.errorContext.digest,
                }
              : undefined,
          });

          if (data.includeDiagnostics && result.diagnosticPath) {
            toast.success(t('feedback.submitSuccess'), {
              description: t('feedback.submitSuccessWithDiagnostics'),
            });
          } else if (data.includeDiagnostics && result.diagnosticError) {
            toast.warning(t('feedback.submitSuccess'), {
              description: t('feedback.submitSuccessDiagnosticsWarning'),
            });
          } else {
            toast.success(t('feedback.submitSuccess'), {
              description: t('feedback.submitSuccessDesc'),
            });
          }

          return result;
        }

        // Web mode: download as JSON
        const feedbackData = {
          ...data,
          ...systemInfo,
          status: 'exported',
          createdAt: new Date().toISOString(),
        };

        const json = JSON.stringify(feedbackData, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const ts = new Date()
          .toISOString()
          .replace(/[:.]/g, '-')
          .slice(0, 19);
        const a = document.createElement('a');
        a.href = url;
        a.download = `cognia-feedback-${ts}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        toast.success(t('feedback.submitSuccessWeb'));

        return null;
      } catch (err) {
        console.error('Failed to submit feedback:', err);
        toast.error(t('feedback.submitFailed'));
        return null;
      } finally {
        setSubmitting(false);
      }
    },
    [],
  );

  const openFeedbackDialog = useCallback(
    (options?: {
      category?: FeedbackCategory;
      errorContext?: FeedbackErrorContext;
    }) => {
      openDialog(options);
    },
    [openDialog],
  );

  const closeFeedbackDialog = useCallback(() => {
    closeDialog();
  }, [closeDialog]);

  const listFeedbacks = useCallback(async (): Promise<FeedbackItem[]> => {
    if (!isTauri()) return [];
    const result = await tauri.feedbackList();
    return result.items;
  }, []);

  const deleteFeedback = useCallback(async (id: string): Promise<void> => {
    if (!isTauri()) return;
    await tauri.feedbackDelete(id);
  }, []);

  const exportFeedbackJson = useCallback(
    async (id: string): Promise<string | null> => {
      if (!isTauri()) return null;
      return await tauri.feedbackExport(id);
    },
    [],
  );

  const feedbackCountFn = useCallback(async (): Promise<number> => {
    if (!isTauri()) return 0;
    try {
      return await tauri.feedbackCount();
    } catch {
      return 0;
    }
  }, []);

  return {
    submitting,
    submitFeedback,
    openFeedbackDialog,
    closeFeedbackDialog,
    listFeedbacks,
    deleteFeedback,
    exportFeedbackJson,
    feedbackCount: feedbackCountFn,
  };
}

function getBasicSystemInfo() {
  const currentPage =
    typeof window !== 'undefined' ? window.location.pathname : '/';

  if (isTauri()) {
    const version = getOsVersion();
    const osLabel = getOsLabel();
    return {
      appVersion: APP_VERSION,
      os: version ? `${osLabel} ${version}` : osLabel,
      arch: getArch(),
      currentPage,
    };
  }

  return {
    appVersion: APP_VERSION,
    os:
      typeof navigator !== 'undefined'
        ? navigator.platform
        : 'Unknown',
    arch: 'Unknown',
    currentPage,
  };
}
