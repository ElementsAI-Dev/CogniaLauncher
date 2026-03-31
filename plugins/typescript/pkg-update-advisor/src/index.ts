import { cognia } from '@cognia/plugin-sdk';

import {
  buildPackageUpdateFailure,
  buildPackageUpdateRecommendations,
  buildPackageUpdateAdvisorSuccess,
  buildPackageUpdateSummary,
  copyPackageUpdateSummary,
  emitPackageUpdateCompletion,
  notifyPackageUpdates,
  parsePackageUpdateAdvisorInput,
  runPackageUpdateAdvisor,
  selectTargetPackages,
} from './core';

type GuidedActionPayload = {
  action?: string;
  buttonId?: string;
  formId?: string;
  formData?: Record<string, unknown>;
  state?: Record<string, unknown>;
};

function pkg_update_advisor(): number {
  const raw = Host.inputString();
  try {
    const input = parsePackageUpdateAdvisorInput(raw);
    const result = runPackageUpdateAdvisor(input, cognia);
    Host.outputString(JSON.stringify(result));
    return 0;
  } catch (error) {
    Host.outputString(JSON.stringify(buildPackageUpdateFailure(error)));
    return 1;
  }
}

function pkg_update_advisor_guided(): number {
  const raw = Host.inputString();
  const response = renderGuidedPackageUpdateAdvisor(raw);
  Host.outputString(JSON.stringify(response));
  return 0;
}

function renderGuidedPackageUpdateAdvisor(raw: string) {
  const action = parseGuidedAction(raw);

  if (action?.action === 'button_click' && action.buttonId === 'reset-pkg-update-advisor') {
    const input = parsePackageUpdateAdvisorInput('');
    return buildPackageUpdateGuidedResponse({
      input,
      summary: {
        status: 'info',
        title: 'Guided update review ready',
        message: 'Set provider, package filters, and run the advisor.',
      },
      stream: [
        { level: 'info', message: 'Waiting for guided package input.' },
      ],
    });
  }

  const inputSource = action?.action === 'button_click'
    ? action.state?.lastInput
    : action?.formData;
  const input = normalizeGuidedAdvisorInput(inputSource);

  if (!action || (action.action === 'button_click' && action.buttonId !== 'rerun-last-pkg-update-advisor')) {
    return buildPackageUpdateGuidedResponse({
      input,
      summary: {
        status: 'info',
        title: 'Guided update review ready',
        message: 'Set provider, package filters, and run the advisor.',
      },
      stream: [
        { level: 'info', message: 'Waiting for guided package input.' },
      ],
    });
  }

  try {
    const result = buildPackageUpdateAdvisorSuccess(input, cognia);
    const degradedCapabilities: Array<{ capability: string; message: string }> = [];
    const stream = [
      {
        level: 'info',
        message: `Checked ${result.targetPackages.length} package target(s) for provider ${result.provider}.`,
      },
    ];

    if (input.copySummary) {
      try {
        copyPackageUpdateSummary(input, result, cognia);
        stream.push({
          level: 'info',
          message: 'Update summary copied successfully.',
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        degradedCapabilities.push({
          capability: 'clipboard',
          message,
        });
        stream.push({
          level: 'warning',
          message: `clipboard follow-up degraded: ${message}`,
        });
      }
    }

    if (input.notifyOnUpdates && result.updates.length > 0) {
      try {
        notifyPackageUpdates(input, result, cognia);
        stream.push({
          level: 'info',
          message: 'Update notification sent successfully.',
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        degradedCapabilities.push({
          capability: 'notification',
          message,
        });
        stream.push({
          level: 'warning',
          message: `notification follow-up degraded: ${message}`,
        });
      }
    }

    if (input.emitEvent) {
      try {
        emitPackageUpdateCompletion(input, result, cognia);
        stream.push({
          level: 'info',
          message: 'Completion event emitted for the advisor workflow.',
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        degradedCapabilities.push({
          capability: 'event',
          message,
        });
        stream.push({
          level: 'warning',
          message: `event follow-up degraded: ${message}`,
        });
      }
    }

    return buildPackageUpdateGuidedResponse({
      input,
      result,
      degradedCapabilities,
      summary: {
        status:
          degradedCapabilities.length > 0 || result.updateCount > 0 ? 'warning' : 'success',
        title: 'Package update advisor',
        message: result.message,
        details: `Checked ${result.targetPackages.length} package(s) out of ${result.totalInstalled} installed.`,
      },
      stream,
    });
  } catch (error) {
    const failure = buildPackageUpdateFailure(error);
    return buildPackageUpdateGuidedResponse({
      input,
      failure,
      summary: {
        status: 'error',
        title: 'Package update advisor blocked',
        message: failure.message,
      },
      stream: [
        {
          level: 'error',
          message: failure.message,
        },
      ],
    });
  }
}

function parseGuidedAction(raw: string): GuidedActionPayload | null {
  if (!raw.trim()) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as GuidedActionPayload;
    if (!parsed || typeof parsed !== 'object' || typeof parsed.action !== 'string') {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function normalizeGuidedAdvisorInput(candidate: unknown) {
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
    return parsePackageUpdateAdvisorInput('');
  }
  return parsePackageUpdateAdvisorInput(JSON.stringify(candidate));
}

function buildPackageUpdateGuidedResponse(options: {
  input: ReturnType<typeof parsePackageUpdateAdvisorInput>;
  result?: ReturnType<typeof buildPackageUpdateAdvisorSuccess>;
  failure?: ReturnType<typeof buildPackageUpdateFailure>;
  degradedCapabilities?: Array<{ capability: string; message: string }>;
  summary: {
    status: 'info' | 'success' | 'warning' | 'error';
    title: string;
    message: string;
    details?: string;
  };
  stream: Array<{ level: 'info' | 'warning' | 'error'; message: string }>;
}) {
  const blocks: Array<Record<string, unknown>> = [
    { type: 'heading', content: 'Package Update Advisor Workflow', level: 1 },
    {
      type: 'text',
      content: 'Run the advisor with guided filters, export-ready summaries, and partial follow-up recovery hints.',
      variant: 'muted',
    },
    buildPackageUpdateForm(options.input),
  ];

  const degradedCapabilities = options.degradedCapabilities ?? [];

  if (options.failure) {
    blocks.push({
      type: 'alert',
      title: 'Advisor blocked',
      message: options.failure.recommendations.join(' '),
      variant: 'destructive',
    });
  }

  if (options.result) {
    blocks.push({
      type: 'stat-cards',
      stats: [
        {
          id: 'targets',
          label: 'Targets',
          value: options.result.targetPackages.length,
        },
        {
          id: 'updates',
          label: 'Updates',
          value: options.result.updateCount,
          status: options.result.updateCount > 0 ? 'warning' : 'success',
        },
        {
          id: 'installed',
          label: 'Installed',
          value: options.result.totalInstalled,
        },
      ],
    });
    if (options.result.updateCount > 0 || degradedCapabilities.length > 0) {
      blocks.push({
        type: 'alert',
        title: degradedCapabilities.length > 0 ? 'Partial follow-up degradation' : 'Updates detected',
        message: [
          ...degradedCapabilities.map((entry) => `${entry.capability}: ${entry.message}`),
          ...options.result.recommendations,
        ].join(' | '),
      });
    }
    blocks.push({
      type: 'table',
      headers: ['Package', 'Current', 'Latest'],
      rows: options.result.updates.map((item) => [
        item.name,
        item.currentVersion,
        item.latestVersion,
      ]),
    });
    blocks.push({
      type: 'code',
      language: 'text',
      code: options.result.summary,
    });
    blocks.push({
      type: 'markdown',
      content: options.result.recommendations.map((item) => `- ${item}`).join('\n'),
    });
    blocks.push({
      type: 'actions',
      buttons: [
        {
          id: 'rerun-last-pkg-update-advisor',
          label: 'Run Previous Input',
          variant: 'default',
        },
        {
          id: 'reset-pkg-update-advisor',
          label: 'Reset',
          variant: 'outline',
        },
      ],
    });
  }

  return {
    ui: blocks,
    state: {
      lastInput: options.input,
      ...(options.result ? { lastSuccess: options.result } : {}),
      ...(degradedCapabilities.length > 0 ? { degradedCapabilities } : {}),
      ...(options.failure ? { lastFailure: options.failure } : {}),
    },
    outputChannels: {
      summary: options.summary,
      stream: options.stream,
      ...(options.result
        ? {
            artifacts: [
              {
                id: 'pkg-update-summary',
                label: 'Copy update summary',
                action: 'copy',
                content: options.result.summary,
              },
              {
                id: 'pkg-update-report',
                label: 'Copy update report JSON',
                action: 'copy',
                content: JSON.stringify(options.result, null, 2),
              },
            ],
          }
        : {}),
    },
  };
}

function buildPackageUpdateForm(
  input: ReturnType<typeof parsePackageUpdateAdvisorInput>,
) {
  return {
    type: 'form',
    id: 'pkg-update-advisor-guided-form',
    submitLabel: 'Run Advisor',
    fields: [
      {
        type: 'input',
        id: 'provider',
        label: 'Provider',
        defaultValue: input.provider,
        required: true,
      },
      {
        type: 'array',
        id: 'packages',
        label: 'Packages',
        itemLabel: 'Package name',
        defaultValues: input.packages,
      },
      {
        type: 'number',
        id: 'limit',
        label: 'Limit',
        defaultValue: input.limit,
        min: 1,
        max: 500,
        step: 1,
        required: true,
      },
      {
        type: 'switch',
        id: 'copySummary',
        label: 'Copy summary to clipboard',
        defaultChecked: input.copySummary,
      },
      {
        type: 'switch',
        id: 'notifyOnUpdates',
        label: 'Send notification when updates exist',
        defaultChecked: input.notifyOnUpdates,
      },
      {
        type: 'switch',
        id: 'emitEvent',
        label: 'Emit completion event',
        defaultChecked: input.emitEvent,
      },
    ],
  };
}

declare const module: { exports: unknown };

module.exports = {
  pkg_update_advisor,
  pkg_update_advisor_guided,
  __test: {
    parseInput: parsePackageUpdateAdvisorInput,
    runAdvisor: (input: ReturnType<typeof parsePackageUpdateAdvisorInput>) =>
      runPackageUpdateAdvisor(input, cognia),
    selectTargetPackages,
    buildSummary: buildPackageUpdateSummary,
    buildRecommendations: buildPackageUpdateRecommendations,
    renderGuided: renderGuidedPackageUpdateAdvisor,
  },
};
