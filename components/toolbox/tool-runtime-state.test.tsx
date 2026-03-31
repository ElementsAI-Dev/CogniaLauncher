import { fireEvent, render, screen } from '@testing-library/react';
import { ToolRuntimeState } from './tool-runtime-state';

jest.mock('@/components/providers/locale-provider', () => ({
  useLocale: () => ({
    t: (key: string) => key,
  }),
}));

describe('ToolRuntimeState', () => {
  it('renders determinate progress and cancel affordance', () => {
    const onCancel = jest.fn();

    render(
      <ToolRuntimeState
        title="Running"
        description="Tool is executing"
        progressValue={42}
        progressLabel="Downloading"
        onCancel={onCancel}
      />,
    );

    expect(screen.getByText('Downloading')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'common.cancel' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'common.cancel' }));
    expect(onCancel).toHaveBeenCalled();
  });

  it('renders structured error details and provided actions', () => {
    render(
      <ToolRuntimeState
        title="Failed"
        description="Tool execution failed"
        error={{
          kind: 'timeout',
          message: 'request timed out',
        }}
        actions={<button type="button">Retry</button>}
      />,
    );

    expect(screen.getByText('timeout')).toBeInTheDocument();
    expect(screen.getByText('request timed out')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });
});
