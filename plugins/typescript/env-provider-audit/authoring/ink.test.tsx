import React from 'react';

jest.mock('ink', () => {
  const ReactLocal = require('react');
  return {
    Box: ({ children }: { children: React.ReactNode }) =>
      ReactLocal.createElement(ReactLocal.Fragment, null, children),
    Text: ({ children }: { children: React.ReactNode }) =>
      ReactLocal.createElement(ReactLocal.Fragment, null, children),
  };
});

import {
  EnvProviderAuditInkApp,
  createEnvProviderAuditInkSnapshot,
} from './ink-app';

describe('env-provider-audit ink companion', () => {
  it('builds a ready snapshot that reports issues from the shared audit flow', () => {
    expect(
      createEnvProviderAuditInkSnapshot({
        envTypes: ['node', 'python'],
      }),
    ).toEqual(
      expect.objectContaining({
        status: 'ready',
        preview: expect.objectContaining({
          ok: true,
          environments: expect.arrayContaining([
            expect.objectContaining({ envType: 'node' }),
            expect.objectContaining({ envType: 'python' }),
          ]),
        }),
      }),
    );
  });

  it('creates a renderable ink component for the maintained audit workflow', () => {
    const element = (
      <EnvProviderAuditInkApp
        snapshot={createEnvProviderAuditInkSnapshot({
          envTypes: ['node'],
        })}
      />
    );

    expect(element).toBeTruthy();
    expect(element.props.snapshot.title).toBe('Environment Audit Preview');
  });
});
