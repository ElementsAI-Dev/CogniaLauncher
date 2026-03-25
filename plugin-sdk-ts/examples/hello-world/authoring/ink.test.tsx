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
  HelloWorldInkApp,
  createHelloWorldInkSnapshot,
} from './ink-app';

describe('hello-world ink companion', () => {
  it('builds a ready snapshot that mirrors the hello tool contract shape', () => {
    expect(
      createHelloWorldInkSnapshot({
        input: 'Trainer',
        platform: {
          os: 'windows',
          arch: 'x64',
          hostname: 'stable-host',
          osVersion: '11',
        },
        uiContext: {
          locale: 'en',
          theme: 'system',
          windowEffect: 'mica',
          desktop: true,
          inAppEffects: true,
        },
        pluginId: 'com.cognia.hello-world',
      }),
    ).toEqual(
      expect.objectContaining({
        status: 'ready',
        preview: expect.objectContaining({
          greeting: 'Hello from Trainer!',
          pluginId: 'com.cognia.hello-world',
          platform: expect.objectContaining({
            os: 'windows',
            arch: 'x64',
          }),
        }),
      }),
    );
  });

  it('creates a renderable ink component for the maintained workflow', () => {
    const element = (
      <HelloWorldInkApp
        snapshot={createHelloWorldInkSnapshot({
          input: 'Trainer',
          platform: {
            os: 'windows',
            arch: 'x64',
            hostname: 'stable-host',
            osVersion: '11',
          },
          uiContext: {
            locale: 'en',
            theme: 'system',
            windowEffect: 'mica',
            desktop: true,
            inAppEffects: true,
          },
          pluginId: 'com.cognia.hello-world',
        })}
      />
    );

    expect(element).toBeTruthy();
    expect(element.props.snapshot.title).toBe('Hello Preview');
  });
});
