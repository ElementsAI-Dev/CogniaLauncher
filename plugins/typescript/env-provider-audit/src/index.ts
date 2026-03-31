import { cognia } from '@cognia/plugin-sdk';

import {
  buildEnvProviderFailure,
  buildEnvProviderRecommendations,
  buildEnvProviderAuditSuccess,
  emitEnvProviderAuditCompletion,
  notifyEnvProviderAuditIssues,
  parseEnvProviderAuditInput,
  runEnvProviderAudit,
  summarizeEnvProviderIssues,
} from './core';

type GuidedActionPayload = {
  action?: string;
  buttonId?: string;
  formId?: string;
  formData?: Record<string, unknown>;
  state?: Record<string, unknown>;
};

function env_provider_audit(): number {
  const raw = Host.inputString();
  try {
    const input = parseEnvProviderAuditInput(raw);
    const result = runEnvProviderAudit(input, cognia);
    Host.outputString(JSON.stringify(result));
    return 0;
  } catch (error) {
    Host.outputString(JSON.stringify(buildEnvProviderFailure(error)));
    return 1;
  }
}

function env_provider_audit_guided(): number {
  const raw = Host.inputString();
  const response = renderGuidedEnvProviderAudit(raw);
  Host.outputString(JSON.stringify(response));
  return 0;
}

function renderGuidedEnvProviderAudit(raw: string) {
  const action = parseGuidedAction(raw);

  if (action?.action === 'button_click' && action.buttonId === 'reset-env-provider-audit') {
    const input = parseEnvProviderAuditInput('');
    return buildEnvProviderGuidedResponse({
      input,
      summary: {
        status: 'info',
        title: 'Guided audit ready',
        message: 'Adjust the audit scope and run the workflow.',
      },
      stream: [
        { level: 'info', message: 'Waiting for guided audit input.' },
      ],
    });
  }

  const inputSource = action?.action === 'button_click'
    ? action.state?.lastInput
    : action?.formData;
  const input = normalizeGuidedAuditInput(inputSource);

  if (!action || (action.action === 'button_click' && action.buttonId !== 'rerun-last-env-provider-audit')) {
    return buildEnvProviderGuidedResponse({
      input,
      summary: {
        status: 'info',
        title: 'Guided audit ready',
        message: 'Adjust the audit scope and run the workflow.',
      },
      stream: [
        { level: 'info', message: 'Waiting for guided audit input.' },
      ],
    });
  }

  try {
    const result = buildEnvProviderAuditSuccess(input, cognia);
    const degradedCapabilities: Array<{ capability: string; message: string }> = [];
    const stream = [
      {
        level: 'info',
        message: `Audited ${result.environments.length} environment target(s).`,
      },
    ];

    if (input.emitEvent) {
      try {
        emitEnvProviderAuditCompletion(input, result, cognia);
        stream.push({
          level: 'info',
          message: 'Completion event emitted for the audit workflow.',
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

    if (input.notifyOnIssues && result.issues.length > 0) {
      try {
        notifyEnvProviderAuditIssues(input, result, cognia);
        stream.push({
          level: 'info',
          message: 'Issue notification was sent successfully.',
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

    return buildEnvProviderGuidedResponse({
      input,
      result,
      degradedCapabilities,
      summary: {
        status:
          degradedCapabilities.length > 0 || result.issues.length > 0 ? 'warning' : 'success',
        title: 'Environment provider audit',
        message: result.message,
        details: `Providers: ${result.providers.length}; environments: ${result.environments.length}.`,
      },
      stream,
    });
  } catch (error) {
    const failure = buildEnvProviderFailure(error);
    return buildEnvProviderGuidedResponse({
      input,
      failure,
      summary: {
        status: 'error',
        title: 'Environment provider audit blocked',
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

function normalizeGuidedAuditInput(candidate: unknown) {
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
    return parseEnvProviderAuditInput('');
  }
  return parseEnvProviderAuditInput(JSON.stringify(candidate));
}

function buildEnvProviderGuidedResponse(options: {
  input: ReturnType<typeof parseEnvProviderAuditInput>;
  result?: ReturnType<typeof buildEnvProviderAuditSuccess>;
  failure?: ReturnType<typeof buildEnvProviderFailure>;
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
    { type: 'heading', content: 'Env Provider Audit Workflow', level: 1 },
    {
      type: 'text',
      content: 'Run the built-in audit with guided defaults, structured diagnostics, and follow-up recovery hints.',
      variant: 'muted',
    },
    buildEnvProviderAuditForm(options.input),
  ];

  const degradedCapabilities = options.degradedCapabilities ?? [];

  if (options.failure) {
    blocks.push({
      type: 'alert',
      title: 'Audit blocked',
      message: options.failure.recommendations.join(' '),
      variant: 'destructive',
    });
  }

  if (options.result) {
    blocks.push({
      type: 'stat-cards',
      stats: [
        {
          id: 'issues',
          label: 'Issues',
          value: options.result.issues.length,
          status: options.result.issues.length > 0 ? 'warning' : 'success',
        },
        {
          id: 'providers',
          label: 'Providers',
          value: options.result.providers.length,
        },
        {
          id: 'environments',
          label: 'Environments',
          value: options.result.environments.length,
        },
      ],
    });
    if (options.result.issues.length > 0 || degradedCapabilities.length > 0) {
      blocks.push({
        type: 'alert',
        title: degradedCapabilities.length > 0 ? 'Partial follow-up degradation' : 'Issues detected',
        message: [
          ...options.result.issues,
          ...degradedCapabilities.map((entry) => `${entry.capability}: ${entry.message}`),
        ].join(' | '),
      });
    }
    blocks.push({
      type: 'table',
      headers: ['Environment', 'Available', 'Current Version', 'Installed Versions'],
      rows: options.result.environments.map((environment) => [
        environment.envType,
        environment.available ? 'Yes' : 'No',
        environment.currentVersion ?? 'None',
        environment.installedVersions.join(', ') || 'None',
      ]),
    });
    if (options.input.includeProviders) {
      blocks.push({
        type: 'table',
        headers: ['Provider', 'Enabled', 'Priority', 'Capabilities'],
        rows: options.result.providers.map((provider) => [
          provider.displayName,
          provider.enabled ? 'Yes' : 'No',
          String(provider.priority),
          provider.capabilities.join(', ') || 'None',
        ]),
      });
    }
    blocks.push({
      type: 'markdown',
      content: options.result.recommendations.map((item) => `- ${item}`).join('\n'),
    });
    blocks.push({
      type: 'actions',
      buttons: [
        {
          id: 'rerun-last-env-provider-audit',
          label: 'Run Previous Input',
          variant: 'default',
        },
        {
          id: 'reset-env-provider-audit',
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
      ...(degradedCapabilities.length > 0
        ? { degradedCapabilities }
        : {}),
      ...(options.failure ? { lastFailure: options.failure } : {}),
    },
    outputChannels: {
      summary: options.summary,
      stream: options.stream,
      ...(options.result
        ? {
            artifacts: [
              {
                id: 'env-provider-audit-report',
                label: 'Copy audit report JSON',
                action: 'copy',
                content: JSON.stringify(options.result, null, 2),
              },
              {
                id: 'env-provider-audit-recommendations',
                label: 'Copy recommendations',
                action: 'copy',
                content: options.result.recommendations.join('\n'),
              },
            ],
          }
        : {}),
    },
  };
}

function buildEnvProviderAuditForm(
  input: ReturnType<typeof parseEnvProviderAuditInput>,
) {
  return {
    type: 'form',
    id: 'env-provider-audit-guided-form',
    submitLabel: 'Run Audit',
    fields: [
      {
        type: 'multi-select',
        id: 'envTypes',
        label: 'Environment Targets',
        options: [
          { label: 'Node.js', value: 'node' },
          { label: 'Python', value: 'python' },
          { label: 'Rust', value: 'rust' },
          { label: 'Go', value: 'go' },
        ],
        defaultValues: input.envTypes,
      },
      {
        type: 'switch',
        id: 'includeProviders',
        label: 'Include provider inventory',
        defaultChecked: input.includeProviders,
      },
      {
        type: 'switch',
        id: 'notifyOnIssues',
        label: 'Send notification when issues are found',
        defaultChecked: input.notifyOnIssues,
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
  env_provider_audit,
  env_provider_audit_guided,
  __test: {
    parseInput: parseEnvProviderAuditInput,
    runAudit: (input: ReturnType<typeof parseEnvProviderAuditInput>) =>
      runEnvProviderAudit(input, cognia),
    summarizeIssues: summarizeEnvProviderIssues,
    buildRecommendations: buildEnvProviderRecommendations,
    renderGuided: renderGuidedEnvProviderAudit,
  },
};
