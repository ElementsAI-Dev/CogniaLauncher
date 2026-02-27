import { fireEvent, render, screen } from '@testing-library/react';
import { TerminalPsModulesTable } from './terminal-ps-modules-table';
import type { PSModuleInfo, PSScriptInfo } from '@/types/tauri';

jest.mock('@/components/providers/locale-provider', () => ({
  useLocale: () => ({ t: (key: string) => key }),
}));

const modules: PSModuleInfo[] = [
  {
    name: 'PSReadLine',
    version: '2.3.4',
    moduleType: 'Script',
    path: 'C:/Modules/PSReadLine',
    description: 'A readline implementation for PowerShell',
    exportedCommandsCount: 5,
  },
  {
    name: 'Pester',
    version: '5.5.0',
    moduleType: 'Script',
    path: 'C:/Modules/Pester',
    description: 'Testing framework for PowerShell',
    exportedCommandsCount: 20,
  },
];

const scripts: PSScriptInfo[] = [
  {
    name: 'Test-Script',
    version: '1.0.0',
    author: 'Test Author',
    description: 'A test script',
    installPath: 'C:/Scripts',
  },
];

describe('TerminalPsModulesTable', () => {
  it('renders module list with names and versions', () => {
    render(
      <TerminalPsModulesTable
        modules={modules}
        scripts={scripts}
        onFetchModules={jest.fn()}
        onFetchScripts={jest.fn()}
      />,
    );

    expect(screen.getByText('PSReadLine')).toBeInTheDocument();
    expect(screen.getByText('Pester')).toBeInTheDocument();
    expect(screen.getByText('2.3.4')).toBeInTheDocument();
  });

  it('filters modules by search', () => {
    render(
      <TerminalPsModulesTable
        modules={modules}
        scripts={scripts}
        onFetchModules={jest.fn()}
        onFetchScripts={jest.fn()}
      />,
    );

    const searchInput = screen.getByPlaceholderText('terminal.searchModules');
    fireEvent.change(searchInput, { target: { value: 'Pester' } });

    expect(screen.getByText('Pester')).toBeInTheDocument();
    expect(screen.queryByText('PSReadLine')).not.toBeInTheDocument();
  });

  it('shows empty state for modules', () => {
    render(
      <TerminalPsModulesTable
        modules={[]}
        scripts={[]}
        onFetchModules={jest.fn()}
        onFetchScripts={jest.fn()}
      />,
    );

    expect(screen.getByText('terminal.noModules')).toBeInTheDocument();
  });

  it('shows loading skeleton', () => {
    render(
      <TerminalPsModulesTable
        modules={[]}
        scripts={[]}
        onFetchModules={jest.fn()}
        onFetchScripts={jest.fn()}
        loading
      />,
    );

    expect(screen.queryByText('terminal.noModules')).not.toBeInTheDocument();
  });

  it('opens module detail dialog on click', () => {
    render(
      <TerminalPsModulesTable
        modules={modules}
        scripts={scripts}
        onFetchModules={jest.fn()}
        onFetchScripts={jest.fn()}
      />,
    );

    fireEvent.click(screen.getByText('PSReadLine'));
    expect(screen.getByText('terminal.moduleDetail')).toBeInTheDocument();
  });

  it('calls both fetch callbacks when refresh clicked', () => {
    const onFetchModules = jest.fn().mockResolvedValue(undefined);
    const onFetchScripts = jest.fn().mockResolvedValue(undefined);

    render(
      <TerminalPsModulesTable
        modules={modules}
        scripts={scripts}
        onFetchModules={onFetchModules}
        onFetchScripts={onFetchScripts}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /common\.refresh/i }));
    expect(onFetchModules).toHaveBeenCalledTimes(1);
    expect(onFetchScripts).toHaveBeenCalledTimes(1);
  });

  it('calls onUninstallModule when uninstall button clicked', () => {
    const onUninstallModule = jest.fn().mockResolvedValue(undefined);

    render(
      <TerminalPsModulesTable
        modules={modules}
        scripts={scripts}
        onFetchModules={jest.fn()}
        onFetchScripts={jest.fn()}
        onUninstallModule={onUninstallModule}
      />,
    );

    const uninstallButtons = screen.getAllByTitle('terminal.uninstallModule');
    expect(uninstallButtons.length).toBeGreaterThanOrEqual(1);
    fireEvent.click(uninstallButtons[0]);
    expect(onUninstallModule).toHaveBeenCalledWith('PSReadLine');
  });

  it('calls onUpdateModule when update button clicked', () => {
    const onUpdateModule = jest.fn().mockResolvedValue(undefined);

    render(
      <TerminalPsModulesTable
        modules={modules}
        scripts={scripts}
        onFetchModules={jest.fn()}
        onFetchScripts={jest.fn()}
        onUpdateModule={onUpdateModule}
      />,
    );

    const updateButtons = screen.getAllByTitle('terminal.updateModule');
    expect(updateButtons.length).toBeGreaterThanOrEqual(1);
    fireEvent.click(updateButtons[0]);
    expect(onUpdateModule).toHaveBeenCalledWith('PSReadLine');
  });

  it('shows noSearchResults when search matches nothing', () => {
    render(
      <TerminalPsModulesTable
        modules={modules}
        scripts={scripts}
        onFetchModules={jest.fn()}
        onFetchScripts={jest.fn()}
      />,
    );

    const searchInput = screen.getByPlaceholderText('terminal.searchModules');
    fireEvent.change(searchInput, { target: { value: 'nonexistent-xyz' } });

    expect(screen.getByText('terminal.noSearchResults')).toBeInTheDocument();
  });
});
