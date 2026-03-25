import React from 'react';
import { Box, Text } from 'ink';
import {
  buildInkAuthoringSnapshot,
  createInkAuthoringHostAdapter,
  type InkAuthoringSnapshot,
} from '@cognia/plugin-sdk';

import {
  runPackageUpdateAdvisor,
  type PackageUpdateAdvisorHost,
  type PackageUpdateAdvisorSuccess,
} from '../src/core';

export interface PkgUpdateAdvisorInkSnapshotOptions {
  provider?: string;
  packages?: string[];
}

function createAuthoringHost(): PackageUpdateAdvisorHost {
  return {
    pkg: {
      listInstalled: () => [
        { name: 'react', version: '18.2.0', provider: 'npm' },
        { name: 'next', version: '16.0.0', provider: 'npm' },
      ],
      checkUpdates: (packages: string[]) =>
        packages.includes('react')
          ? [
              {
                name: 'react',
                currentVersion: '18.2.0',
                latestVersion: '19.0.0',
              },
            ]
          : [],
    },
    clipboard: {
      write: () => undefined,
    },
    notification: {
      send: () => undefined,
    },
    event: {
      emit: () => undefined,
    },
  };
}

export function createPkgUpdateAdvisorInkSnapshot(
  options: PkgUpdateAdvisorInkSnapshotOptions = {},
): InkAuthoringSnapshot<PackageUpdateAdvisorSuccess> {
  const adapter = createInkAuthoringHostAdapter({
    pluginId: 'com.cognia.builtin.pkg-update-advisor',
    services: {},
    prerequisites: [
      { id: 'node', label: 'Node.js 20+', satisfied: true },
      { id: 'ink', label: 'Ink authoring dependencies', satisfied: true },
    ],
  });
  const preview = runPackageUpdateAdvisor(
    {
      provider: options.provider ?? 'npm',
      packages: options.packages ?? ['react'],
      limit: 30,
      copySummary: false,
      notifyOnUpdates: false,
      emitEvent: false,
    },
    createAuthoringHost(),
  );

  return buildInkAuthoringSnapshot({
    pluginId: adapter.pluginId,
    workflowId: 'pkg-update-advisor-preview',
    title: 'Package Update Preview',
    summary:
      'Preview the maintained package advisor summary using the same shared advisor core as the production plugin.',
    prerequisites: adapter.prerequisites,
    preview,
  });
}

export function PkgUpdateAdvisorInkApp(props: {
  snapshot: InkAuthoringSnapshot<PackageUpdateAdvisorSuccess>;
}) {
  const { snapshot } = props;

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold>{snapshot.title}</Text>
      <Text>{snapshot.summary}</Text>
      <Text>
        Provider: {snapshot.preview.provider} | Updates:{' '}
        {snapshot.preview.updateCount}
      </Text>
      <Text>{snapshot.preview.message}</Text>
      {snapshot.preview.targetPackages.map((pkg) => (
        <Text key={pkg}>- {pkg}</Text>
      ))}
    </Box>
  );
}
