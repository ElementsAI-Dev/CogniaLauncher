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
  PkgUpdateAdvisorInkApp,
  createPkgUpdateAdvisorInkSnapshot,
} from './ink-app';

describe('pkg-update-advisor ink companion', () => {
  it('builds a ready snapshot that mirrors the shared advisor summary contract', () => {
    expect(
      createPkgUpdateAdvisorInkSnapshot({
        provider: 'npm',
        packages: ['react'],
      }),
    ).toEqual(
      expect.objectContaining({
        status: 'ready',
        preview: expect.objectContaining({
          ok: true,
          provider: 'npm',
          targetPackages: ['react'],
        }),
      }),
    );
  });

  it('creates a renderable ink component for the maintained advisor workflow', () => {
    const element = (
      <PkgUpdateAdvisorInkApp
        snapshot={createPkgUpdateAdvisorInkSnapshot({
          provider: 'npm',
          packages: ['react'],
        })}
      />
    );

    expect(element).toBeTruthy();
    expect(element.props.snapshot.title).toBe('Package Update Preview');
  });
});
