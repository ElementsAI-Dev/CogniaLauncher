import React from 'react';
import { Box, Text } from 'ink';
import {
  buildInkAuthoringSnapshot,
  createInkAuthoringHostAdapter,
  type InkAuthoringSnapshot,
} from '@cognia/plugin-sdk';

import {
  runEnvProviderAudit,
  type EnvProviderAuditSuccess,
  type EnvProviderAuditHost,
} from '../src/core';

export interface EnvProviderAuditInkSnapshotOptions {
  envTypes?: string[];
}

function createAuthoringHost(): EnvProviderAuditHost {
  const adapter = createInkAuthoringHostAdapter({
    pluginId: 'com.cognia.builtin.env-provider-audit',
    services: {},
    prerequisites: [
      { id: 'node', label: 'Node.js 20+', satisfied: true },
      { id: 'ink', label: 'Ink authoring dependencies', satisfied: true },
    ],
  });

  return {
    platform: {
      info: () => adapter.platform,
    },
    env: {
      list: () => [
        { id: 'node', displayName: 'Node.js' },
        { id: 'python', displayName: 'Python' },
        { id: 'rust', displayName: 'Rust' },
      ],
      providerList: () => [
        {
          id: 'npm',
          displayName: 'npm',
          capabilities: ['pkg_search', 'pkg_install'],
          platforms: ['windows', 'linux'],
          priority: 100,
          isEnvironmentProvider: true,
          enabled: true,
        },
      ],
      detect: (envType: string) => {
        if (envType === 'python') {
          return {
            available: true,
            currentVersion: null,
            installedVersions: [],
          };
        }
        return {
          available: true,
          currentVersion: '1.0.0',
          installedVersions: ['1.0.0'],
        };
      },
    },
    event: {
      emit: () => undefined,
      getPluginId: () => 'com.cognia.builtin.env-provider-audit',
    },
    notification: {
      send: () => undefined,
    },
  };
}

export function createEnvProviderAuditInkSnapshot(
  options: EnvProviderAuditInkSnapshotOptions = {},
): InkAuthoringSnapshot<EnvProviderAuditSuccess> {
  const adapter = createInkAuthoringHostAdapter({
    pluginId: 'com.cognia.builtin.env-provider-audit',
    services: {},
    prerequisites: [
      { id: 'node', label: 'Node.js 20+', satisfied: true },
      { id: 'ink', label: 'Ink authoring dependencies', satisfied: true },
    ],
  });
  const preview = runEnvProviderAudit(
    {
      envTypes: options.envTypes ?? ['node', 'python', 'rust'],
      includeProviders: true,
      notifyOnIssues: false,
      emitEvent: false,
    },
    createAuthoringHost(),
  );

  return buildInkAuthoringSnapshot({
    pluginId: adapter.pluginId,
    workflowId: 'env-provider-audit-preview',
    title: 'Environment Audit Preview',
    summary:
      'Preview the maintained audit result using the same shared audit core as the production plugin.',
    prerequisites: adapter.prerequisites,
    preview,
  });
}

export function EnvProviderAuditInkApp(props: {
  snapshot: InkAuthoringSnapshot<EnvProviderAuditSuccess>;
}) {
  const { snapshot } = props;

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold>{snapshot.title}</Text>
      <Text>{snapshot.summary}</Text>
      <Text>
        Issues: {snapshot.preview.issues.length} | Providers:{' '}
        {snapshot.preview.providers.length}
      </Text>
      <Text>{snapshot.preview.message}</Text>
      {snapshot.preview.environments.map((environment) => (
        <Text key={environment.envType}>
          - {environment.envType}: {environment.currentVersion ?? 'no current'}
        </Text>
      ))}
    </Box>
  );
}
