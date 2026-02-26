import { render, screen } from '@testing-library/react';
import EnvVarPage from './page';

// Mock hooks and modules
jest.mock('@/hooks/use-envvar', () => ({
  useEnvVar: () => ({
    envVars: {},
    pathEntries: [],
    shellProfiles: [],
    loading: false,
    error: null,
    fetchAllVars: jest.fn().mockResolvedValue({}),
    getVar: jest.fn(),
    setVar: jest.fn().mockResolvedValue(true),
    removeVar: jest.fn().mockResolvedValue(true),
    fetchPath: jest.fn().mockResolvedValue([]),
    addPathEntry: jest.fn().mockResolvedValue(true),
    removePathEntry: jest.fn().mockResolvedValue(true),
    reorderPath: jest.fn().mockResolvedValue(true),
    fetchShellProfiles: jest.fn().mockResolvedValue([]),
    readShellProfile: jest.fn().mockResolvedValue(''),
    importEnvFile: jest.fn().mockResolvedValue(null),
    exportEnvFile: jest.fn().mockResolvedValue(null),
  }),
}));

jest.mock('@/components/providers/locale-provider', () => ({
  useLocale: () => ({ t: (key: string) => key, locale: 'en', setLocale: jest.fn() }),
}));

jest.mock('@/lib/tauri', () => ({
  isTauri: () => false,
}));

jest.mock('sonner', () => ({
  toast: { success: jest.fn(), error: jest.fn(), warning: jest.fn(), info: jest.fn() },
}));

describe('EnvVarPage', () => {
  it('should render desktop-required empty state in web mode', () => {
    render(<EnvVarPage />);
    expect(screen.getByText('envvar.emptyState.title')).toBeInTheDocument();
    expect(screen.getByText('envvar.emptyState.description')).toBeInTheDocument();
  });

  it('should render page header', () => {
    render(<EnvVarPage />);
    expect(screen.getByText('envvar.title')).toBeInTheDocument();
  });
});
