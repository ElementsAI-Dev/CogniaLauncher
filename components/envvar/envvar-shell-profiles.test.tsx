import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EnvVarShellProfiles } from './envvar-shell-profiles';
import type { ShellProfileInfo } from '@/types/tauri';

import React from 'react';

const CollapsibleCtx = React.createContext(false);

jest.mock('@/components/ui/collapsible', () => ({
  Collapsible: ({ children, open }: { children: React.ReactNode; open: boolean }) => (
    <CollapsibleCtx.Provider value={open}>
      <div data-testid="collapsible" data-open={String(open)}>{children}</div>
    </CollapsibleCtx.Provider>
  ),
  CollapsibleTrigger: ({ children }: { children: React.ReactNode; asChild?: boolean }) => (
    <div data-testid="collapsible-trigger">{children}</div>
  ),
  CollapsibleContent: ({ children }: { children: React.ReactNode }) => {
    const open = React.useContext(CollapsibleCtx);
    return open ? <div data-testid="collapsible-content">{children}</div> : null;
  },
}));

const mockT = (key: string) => {
  const translations: Record<string, string> = {
    'envvar.shellProfiles.current': 'Current',
    'envvar.shellProfiles.noContent': 'No content',
    'envvar.shellProfiles.viewConfig': 'View Config',
    'common.close': 'Close',
    'common.loading': 'Loading',
  };
  return translations[key] || key;
};

const bashProfile: ShellProfileInfo = {
  shell: 'bash',
  configPath: '/home/user/.bashrc',
  exists: true,
  isCurrent: true,
};

const zshProfile: ShellProfileInfo = {
  shell: 'zsh',
  configPath: '/home/user/.zshrc',
  exists: true,
  isCurrent: false,
};

const missingProfile: ShellProfileInfo = {
  shell: 'fish',
  configPath: '/home/user/.config/fish/config.fish',
  exists: false,
  isCurrent: false,
};

describe('EnvVarShellProfiles', () => {
  const defaultProps = {
    profiles: [bashProfile, zshProfile, missingProfile],
    onReadProfile: jest.fn().mockResolvedValue('export PATH="/usr/bin:$PATH"'),
    t: mockT,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders empty state when no profiles', () => {
    render(<EnvVarShellProfiles {...defaultProps} profiles={[]} />);
    expect(screen.getByText('No content')).toBeInTheDocument();
  });

  it('renders profile cards with shell names', () => {
    render(<EnvVarShellProfiles {...defaultProps} />);
    expect(screen.getByText('bash')).toBeInTheDocument();
    expect(screen.getByText('zsh')).toBeInTheDocument();
    expect(screen.getByText('fish')).toBeInTheDocument();
  });

  it('shows Current badge for current shell', () => {
    render(<EnvVarShellProfiles {...defaultProps} />);
    expect(screen.getByText('Current')).toBeInTheDocument();
  });

  it('shows No content badge for non-existent profile', () => {
    render(<EnvVarShellProfiles {...defaultProps} />);
    // The fish profile has exists=false, so it shows "No content" badge
    // Note: empty state also uses "No content" but we have profiles so empty state won't show
    const badges = screen.getAllByText('No content');
    expect(badges.length).toBeGreaterThanOrEqual(1);
  });

  it('shows config path', () => {
    render(<EnvVarShellProfiles {...defaultProps} />);
    expect(screen.getByText('/home/user/.bashrc')).toBeInTheDocument();
    expect(screen.getByText('/home/user/.zshrc')).toBeInTheDocument();
  });

  it('shows view button only for existing profiles', () => {
    render(<EnvVarShellProfiles {...defaultProps} />);
    const viewButtons = screen.getAllByRole('button', { name: /view config/i });
    // bash and zsh exist, fish does not
    expect(viewButtons).toHaveLength(2);
  });

  it('expands profile content on view click', async () => {
    const onReadProfile = jest.fn().mockResolvedValue('export PATH="/usr/bin:$PATH"');
    render(<EnvVarShellProfiles {...defaultProps} onReadProfile={onReadProfile} />);

    const viewButtons = screen.getAllByRole('button', { name: /view config/i });
    await userEvent.click(viewButtons[0]);

    await waitFor(() => {
      expect(onReadProfile).toHaveBeenCalledWith('/home/user/.bashrc');
      expect(screen.getByText('export PATH="/usr/bin:$PATH"')).toBeInTheDocument();
    });
  });

  it('collapses profile on second click', async () => {
    const onReadProfile = jest.fn().mockResolvedValue('some content');
    render(<EnvVarShellProfiles {...defaultProps} onReadProfile={onReadProfile} />);

    const viewButtons = screen.getAllByRole('button', { name: /view config/i });
    await userEvent.click(viewButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('some content')).toBeInTheDocument();
    });

    // Now click Close button (the button text changes to "Close" when expanded)
    const closeButton = screen.getByRole('button', { name: /close/i });
    await userEvent.click(closeButton);

    expect(screen.queryByText('some content')).not.toBeInTheDocument();
  });
});
