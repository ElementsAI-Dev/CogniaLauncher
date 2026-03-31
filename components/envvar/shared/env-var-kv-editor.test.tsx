import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EnvVarKvEditor } from './env-var-kv-editor';

jest.mock('@/lib/clipboard', () => ({
  writeClipboard: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

describe('EnvVarKvEditor', () => {
  const defaultLabels = {
    empty: 'No environment variables',
    keyPlaceholder: 'Key',
    valuePlaceholder: 'Value',
    add: 'Add',
    copy: 'Copy',
    edit: 'Edit',
    delete: 'Delete',
    reveal: 'Reveal',
    enabled: 'Enabled',
  };

  it('supports add, edit, and delete operations', async () => {
    const onAdd = jest.fn();
    const onEdit = jest.fn();
    const onDelete = jest.fn();

    render(
      <EnvVarKvEditor
        items={[{ key: 'NODE_ENV', value: 'development', enabled: true }]}
        onAdd={onAdd}
        onEdit={onEdit}
        onDelete={onDelete}
        labels={defaultLabels}
      />,
    );

    await userEvent.type(screen.getByPlaceholderText('Key'), 'JAVA_HOME');
    await userEvent.type(screen.getByPlaceholderText('Value'), '/jdk');
    await userEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(onAdd).toHaveBeenCalledWith({ key: 'JAVA_HOME', value: '/jdk' });

    await userEvent.click(screen.getByRole('button', { name: 'Edit' }));
    const editInput = screen.getByDisplayValue('development');
    await userEvent.clear(editInput);
    await userEvent.type(editInput, 'production{Enter}');
    expect(onEdit).toHaveBeenCalledWith('NODE_ENV', 'production');

    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onDelete).toHaveBeenCalledWith('NODE_ENV');
  });

  it('hides mutating controls in read-only mode', () => {
    render(
      <EnvVarKvEditor
        items={[{ key: 'NODE_ENV', value: 'development' }]}
        readOnly
        labels={defaultLabels}
      />,
    );

    expect(screen.queryByPlaceholderText('Key')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
    expect(screen.getByText('NODE_ENV')).toBeInTheDocument();
  });

  it('masks sensitive values and reveals them on demand', async () => {
    const onReveal = jest.fn().mockResolvedValue('super-secret-token');

    render(
      <EnvVarKvEditor
        items={[{ key: 'API_TOKEN', value: 'super-secret-token' }]}
        revealable
        sensitiveKeys={['API_TOKEN']}
        onReveal={onReveal}
        labels={defaultLabels}
      />,
    );

    expect(screen.getByText('••••••')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Reveal' }));

    await waitFor(() => {
      expect(onReveal).toHaveBeenCalledWith('API_TOKEN');
    });
    expect(screen.getByText('super-secret-token')).toBeInTheDocument();
  });
});
