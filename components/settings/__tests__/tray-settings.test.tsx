import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { TraySettings } from '../tray-settings';
import type { AppSettings } from '@/lib/stores/settings';

const mockT = (key: string) => {
  const translations: Record<string, string> = {
    'settings.tray': 'System Tray',
    'settings.trayDesc': 'Configure system tray behavior',
    'settings.minimizeToTray': 'Minimize to Tray',
    'settings.minimizeToTrayDesc': 'Minimize to system tray instead of closing',
    'settings.startMinimized': 'Start Minimized',
    'settings.startMinimizedDesc': 'Start the application minimized to system tray',
  };
  return translations[key] || key;
};

describe('TraySettings', () => {
  const appSettings: AppSettings = {
    checkUpdatesOnStart: true,
    autoInstallUpdates: false,
    notifyOnUpdates: true,
    minimizeToTray: true,
    startMinimized: false,
    autostart: false,
    trayClickBehavior: 'toggle_window',
    showNotifications: true,
  };

  it('should render tray settings card', () => {
    render(
      <TraySettings
        appSettings={appSettings}
        onValueChange={jest.fn()}
        t={mockT}
      />
    );

    expect(screen.getByText('System Tray')).toBeInTheDocument();
    expect(screen.getByText('Configure system tray behavior')).toBeInTheDocument();
  });

  it('should render minimize to tray setting', () => {
    render(
      <TraySettings
        appSettings={appSettings}
        onValueChange={jest.fn()}
        t={mockT}
      />
    );

    expect(screen.getByText('Minimize to Tray')).toBeInTheDocument();
    expect(screen.getByText('Minimize to system tray instead of closing')).toBeInTheDocument();
  });

  it('should render start minimized setting', () => {
    render(
      <TraySettings
        appSettings={appSettings}
        onValueChange={jest.fn()}
        t={mockT}
      />
    );

    expect(screen.getByText('Start Minimized')).toBeInTheDocument();
    expect(screen.getByText('Start the application minimized to system tray')).toBeInTheDocument();
  });

  it('should call onValueChange when minimizeToTray toggle changes', () => {
    const onValueChange = jest.fn();
    render(
      <TraySettings
        appSettings={appSettings}
        onValueChange={onValueChange}
        t={mockT}
      />
    );

    const switches = screen.getAllByRole('switch');
    fireEvent.click(switches[0]);

    expect(onValueChange).toHaveBeenCalledWith('minimizeToTray', false);
  });

  it('should call onValueChange when startMinimized toggle changes', () => {
    const onValueChange = jest.fn();
    render(
      <TraySettings
        appSettings={appSettings}
        onValueChange={onValueChange}
        t={mockT}
      />
    );

    const switches = screen.getAllByRole('switch');
    fireEvent.click(switches[1]);

    expect(onValueChange).toHaveBeenCalledWith('startMinimized', true);
  });

  it('should reflect correct initial switch states', () => {
    render(
      <TraySettings
        appSettings={appSettings}
        onValueChange={jest.fn()}
        t={mockT}
      />
    );

    const switches = screen.getAllByRole('switch');
    expect(switches[0]).toBeChecked();
    expect(switches[1]).not.toBeChecked();
  });

  it('should reflect updated switch states when appSettings change', () => {
    const updatedSettings: AppSettings = {
      ...appSettings,
      minimizeToTray: false,
      startMinimized: true,
    };

    render(
      <TraySettings
        appSettings={updatedSettings}
        onValueChange={jest.fn()}
        t={mockT}
      />
    );

    const switches = screen.getAllByRole('switch');
    expect(switches[0]).not.toBeChecked();
    expect(switches[1]).toBeChecked();
  });
});
