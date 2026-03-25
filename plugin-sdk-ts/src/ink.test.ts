import {
  buildInkAuthoringSnapshot,
  createInkAuthoringHostAdapter,
  createHeadlessInkHarness,
} from './ink';

describe('plugin-sdk-ts ink authoring helpers', () => {
  it('marks snapshot as blocked when any prerequisite is unsatisfied', () => {
    expect(
      buildInkAuthoringSnapshot({
        pluginId: 'com.example.hello',
        workflowId: 'hello-preview',
        title: 'Hello Preview',
        summary: 'Authoring preview for hello-world.',
        preview: { greeting: 'Hello trainer' },
        prerequisites: [
          { id: 'node', label: 'Node.js', satisfied: true },
          { id: 'ink', label: 'Ink dependencies', satisfied: false, detail: 'Run pnpm install.' },
        ],
      }),
    ).toEqual(
      expect.objectContaining({
        status: 'blocked',
        missingPrerequisiteIds: ['ink'],
      }),
    );
  });

  it('runs the headless harness with normalized input and timestamps the result', async () => {
    const harness = createHeadlessInkHarness({
      pluginId: 'com.example.hello',
      workflowId: 'hello-preview',
      title: 'Hello Preview',
      summary: 'Headless preview',
      prerequisites: [{ id: 'node', label: 'Node.js', satisfied: true }],
      simulate: async (input: { name: string }) => ({
        greeting: `Hello ${input.name}`,
      }),
    });

    await expect(harness.run({ name: 'Trainer' })).resolves.toEqual(
      expect.objectContaining({
        status: 'ready',
        preview: { greeting: 'Hello Trainer' },
        updatedAt: expect.any(String),
      }),
    );
  });

  it('creates a shared host adapter with normalized defaults for authoring flows', () => {
    expect(
      createInkAuthoringHostAdapter({
        pluginId: 'com.example.hello',
        services: { mode: 'preview' },
        prerequisites: [
          { id: ' node ', label: ' Node.js ', satisfied: true },
          { id: 'node', label: 'Duplicate', satisfied: false },
        ],
      }),
    ).toEqual(
      expect.objectContaining({
        pluginId: 'com.example.hello',
        platform: expect.objectContaining({
          hostname: 'authoring-host',
        }),
        uiContext: expect.objectContaining({
          theme: 'system',
        }),
        prerequisites: [{ id: 'node', label: 'Node.js', satisfied: true }],
        services: { mode: 'preview' },
      }),
    );
  });
});
