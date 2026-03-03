import React from 'react';
import { render, waitFor } from '@testing-library/react';
import PluginsPage from './page';

let mockIsDesktop = true;
let mockFetchPlugins = jest.fn();
let mockGetAllHealth = jest.fn();

jest.mock('@/components/providers/locale-provider', () => ({
  useLocale: () => ({
    locale: 'en',
    t: (key: string) => key,
  }),
}));

jest.mock('@/lib/tauri', () => ({
  isTauri: () => mockIsDesktop,
}));

jest.mock('@/hooks/use-plugins', () => ({
  usePlugins: () => ({
    plugins: [],
    pluginTools: [],
    loading: false,
    fetchPlugins: mockFetchPlugins,
    installPlugin: jest.fn(),
    importLocalPlugin: jest.fn(),
    uninstallPlugin: jest.fn(),
    enablePlugin: jest.fn(),
    disablePlugin: jest.fn(),
    reloadPlugin: jest.fn(),
    getPermissions: jest.fn(),
    grantPermission: jest.fn(),
    revokePermission: jest.fn(),
    scaffoldPlugin: jest.fn(),
    checkUpdate: jest.fn(),
    updatePlugin: jest.fn(),
    getHealth: jest.fn(),
    getAllHealth: mockGetAllHealth,
    resetHealth: jest.fn(),
    getSettingsSchema: jest.fn(),
    getSettingsValues: jest.fn(),
    setSetting: jest.fn(),
    exportData: jest.fn(),
    checkAllUpdates: jest.fn().mockResolvedValue([]),
    updateAll: jest.fn(),
    pendingUpdates: [],
    healthMap: {},
  }),
}));

jest.mock('@/components/layout/page-header', () => ({
  PageHeader: ({
    title,
    description,
    actions,
  }: {
    title: string;
    description?: string;
    actions?: React.ReactNode;
  }) => (
    <header>
      <h1>{title}</h1>
      <p>{description}</p>
      {actions}
    </header>
  ),
}));

jest.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    disabled,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
  }) => (
    <button onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
}));

jest.mock('@/components/ui/input', () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}));

jest.mock('@/components/ui/label', () => ({
  Label: ({
    children,
    ...props
  }: React.LabelHTMLAttributes<HTMLLabelElement>) => <label {...props}>{children}</label>,
}));

jest.mock('@/components/ui/card', () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

jest.mock('@/components/ui/switch', () => ({
  Switch: ({ checked }: { checked?: boolean }) => <input type="checkbox" checked={checked} readOnly />,
}));

jest.mock('@/components/ui/dialog', () => ({
  Dialog: ({ open, children }: { open?: boolean; children: React.ReactNode }) => (open ? <div>{children}</div> : null),
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock('@/components/ui/alert-dialog', () => ({
  AlertDialog: ({ open, children }: { open?: boolean; children: React.ReactNode }) => (open ? <div>{children}</div> : null),
  AlertDialogAction: ({ children }: { children: React.ReactNode }) => <button>{children}</button>,
  AlertDialogCancel: ({ children }: { children: React.ReactNode }) => <button>{children}</button>,
  AlertDialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDialogTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock('@/components/ui/separator', () => ({
  Separator: () => <hr />,
}));

jest.mock('@/components/ui/tabs', () => ({
  Tabs: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TabsContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TabsList: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TabsTrigger: ({ children }: { children: React.ReactNode }) => <button>{children}</button>,
}));

jest.mock('@/components/downloads/destination-picker', () => ({
  DestinationPicker: () => <div />,
}));

jest.mock('@/components/ui/select', () => ({
  Select: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectValue: () => <div />,
}));

jest.mock('@/components/ui/checkbox', () => ({
  Checkbox: () => <input type="checkbox" readOnly />,
}));

jest.mock('next/link', () => {
  const MockLink = ({ children, ...props }: { children: React.ReactNode; href: string }) => (
    <a {...props}>{children}</a>
  );
  MockLink.displayName = 'MockLink';
  return MockLink;
});

describe('PluginsPage plugin bootstrap', () => {
  beforeEach(() => {
    mockIsDesktop = true;
    mockFetchPlugins = jest.fn();
    mockGetAllHealth = jest.fn();
    jest.clearAllMocks();
  });

  it('fetches plugins and health only once in desktop mode across rerenders', async () => {
    const firstFetch = jest.fn();
    const firstHealth = jest.fn();
    const secondFetch = jest.fn();
    const secondHealth = jest.fn();
    mockFetchPlugins = firstFetch;
    mockGetAllHealth = firstHealth;

    const { rerender } = render(<PluginsPage />);
    await waitFor(() => {
      expect(firstFetch).toHaveBeenCalledTimes(1);
      expect(firstHealth).toHaveBeenCalledTimes(1);
    });

    mockFetchPlugins = secondFetch;
    mockGetAllHealth = secondHealth;
    rerender(<PluginsPage />);

    expect(firstFetch).toHaveBeenCalledTimes(1);
    expect(firstHealth).toHaveBeenCalledTimes(1);
    expect(secondFetch).not.toHaveBeenCalled();
    expect(secondHealth).not.toHaveBeenCalled();
  });

  it('does not auto-fetch plugins outside desktop mode', () => {
    mockIsDesktop = false;
    render(<PluginsPage />);
    expect(mockFetchPlugins).not.toHaveBeenCalled();
    expect(mockGetAllHealth).not.toHaveBeenCalled();
  });
});
