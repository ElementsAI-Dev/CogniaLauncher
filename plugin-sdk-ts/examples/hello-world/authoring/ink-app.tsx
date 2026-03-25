import React from 'react';
import { Box, Text } from 'ink';
import {
  buildInkAuthoringSnapshot,
  createInkAuthoringHostAdapter,
  type InkAuthoringSnapshot,
  type PlatformInfo,
  type PluginUiContext,
} from '@cognia/plugin-sdk';

export interface HelloWorldInkSnapshotOptions {
  input?: string;
  platform?: PlatformInfo;
  uiContext?: PluginUiContext;
  pluginId?: string;
}

const DEFAULT_PLATFORM: PlatformInfo = {
  os: 'windows',
  arch: 'x64',
  hostname: 'dev-host',
  osVersion: '11',
};

const DEFAULT_UI_CONTEXT: PluginUiContext = {
  locale: 'en',
  theme: 'system',
  windowEffect: 'mica',
  desktop: true,
  inAppEffects: true,
};

export type HelloWorldPreview = {
  greeting: string;
  pluginId: string | null;
  uiContext: PluginUiContext;
  platform: {
    os: string;
    arch: string;
    osVersion: string;
  };
};

function buildGreeting(name: string) {
  return `Hello from ${name}!`;
}

export function createHelloWorldInkSnapshot(
  options: HelloWorldInkSnapshotOptions = {},
): InkAuthoringSnapshot<HelloWorldPreview> {
  const adapter = createInkAuthoringHostAdapter({
    pluginId: options.pluginId ?? 'com.cognia.example.hello-world',
    services: {},
    platform: options.platform ?? DEFAULT_PLATFORM,
    uiContext: options.uiContext ?? DEFAULT_UI_CONTEXT,
    prerequisites: [
      { id: 'node', label: 'Node.js 20+', satisfied: true },
      { id: 'ink', label: 'Ink authoring dependencies', satisfied: true },
    ],
  });
  const platform = adapter.platform;
  const uiContext = adapter.uiContext;
  const name = options.input?.trim() || platform.hostname;

  return buildInkAuthoringSnapshot({
    pluginId: adapter.pluginId,
    workflowId: 'hello-preview',
    title: 'Hello Preview',
    summary: 'Preview the maintained hello-world output without changing the production WASM entrypoint.',
    prerequisites: adapter.prerequisites,
    preview: {
      greeting: buildGreeting(name),
      pluginId: adapter.pluginId,
      uiContext,
      platform: {
        os: platform.os,
        arch: platform.arch,
        osVersion: platform.osVersion,
      },
    },
  });
}

export function HelloWorldInkApp(props: {
  snapshot: InkAuthoringSnapshot<HelloWorldPreview>;
}) {
  const { snapshot } = props;

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold>{snapshot.title}</Text>
      <Text>{snapshot.summary}</Text>
      <Text>
        Status: {snapshot.status} | Workflow: {snapshot.workflowId}
      </Text>
      <Text>{snapshot.preview.greeting}</Text>
      <Text>
        Platform: {snapshot.preview.platform.os} {snapshot.preview.platform.arch}
      </Text>
      <Text>Theme: {snapshot.preview.uiContext.theme}</Text>
      <Text>Plugin ID: {snapshot.preview.pluginId ?? 'n/a'}</Text>
    </Box>
  );
}
