import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TerminalTemplatePicker } from './terminal-template-picker';
import type { TerminalProfileTemplate } from '@/types/tauri';

jest.mock('@/components/providers/locale-provider', () => ({
  useLocale: () => ({ t: (key: string) => key }),
}));

const templates: TerminalProfileTemplate[] = [
  {
    id: 'builtin-node',
    name: 'Node.js Dev',
    description: 'Built-in template',
    icon: 'code',
    category: 'development',
    shellType: 'bash',
    args: [],
    envVars: {},
    cwd: null,
    startupCommand: 'npm test',
    envType: 'node',
    envVersion: '20',
    isBuiltin: true,
  },
];

describe('TerminalTemplatePicker', () => {
  it('creates a custom template from the picker workflow', async () => {
    const user = userEvent.setup();
    const onCreateCustom = jest.fn().mockResolvedValue('custom-template-id');

    render(
      <TerminalTemplatePicker
        open
        onOpenChange={jest.fn()}
        templates={templates}
        onSelect={jest.fn()}
        onCreateCustom={onCreateCustom}
      />,
    );

    await user.click(screen.getByRole('button', { name: /terminal\.createCustomTemplate/i }));
    await user.type(screen.getByLabelText(/terminal\.templateName/i), 'Custom Shell');
    await user.click(screen.getByRole('combobox'));
    await user.click(screen.getByRole('option', { name: 'bash' }));
    await user.click(screen.getByRole('button', { name: /terminal\.saveTemplate/i }));

    await waitFor(() => {
      expect(onCreateCustom).toHaveBeenCalledWith(expect.objectContaining({
        name: 'Custom Shell',
        category: 'custom',
        shellType: 'bash',
      }));
    });

    expect(screen.getByText('terminal.templateActionSuccessTitle')).toBeInTheDocument();
  });

  it('validates required metadata before creating a custom template', async () => {
    const user = userEvent.setup();
    const onCreateCustom = jest.fn();

    render(
      <TerminalTemplatePicker
        open
        onOpenChange={jest.fn()}
        templates={templates}
        onSelect={jest.fn()}
        onCreateCustom={onCreateCustom}
      />,
    );

    await user.click(screen.getByRole('button', { name: /terminal\.createCustomTemplate/i }));
    await user.click(screen.getByRole('button', { name: /terminal\.saveTemplate/i }));

    expect(onCreateCustom).not.toHaveBeenCalled();
    expect(screen.getByText('terminal.templateValidationNameRequired')).toBeInTheDocument();
  });
});
