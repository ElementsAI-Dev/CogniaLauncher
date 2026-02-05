import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { UpdateSettings } from './update-settings';
import type { AppSettings } from '@/lib/stores/settings';

const mockT = (key: string) => {
  const translations: Record<string, string> = {
    'settings.updates': 'Updates',
    'settings.updatesDesc': 'Configure update checks and notifications',
    'settings.checkUpdatesOnStart': 'Check on Start',
    'settings.checkUpdatesOnStartDesc': 'Auto check',
    'settings.autoInstallUpdates': 'Auto Install Updates',
    'settings.autoInstallUpdatesDesc': 'Auto install',
    'settings.notifyOnUpdates': 'Notify on Updates',
    'settings.notifyOnUpdatesDesc': 'Notify on updates',
  };
  return translations[key] || key;
};

describe('UpdateSettings', () => {
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

  it('should render update settings card', () => {
    render(
      <UpdateSettings
        appSettings={appSettings}
        onValueChange={jest.fn()}
        t={mockT}
      />
    );

    expect(screen.getByText('Updates')).toBeInTheDocument();
    expect(screen.getByText('Configure update checks and notifications')).toBeInTheDocument();
  });

  it('should call onValueChange when toggles change', () => {
    const onValueChange = jest.fn();
    render(
      <UpdateSettings
        appSettings={appSettings}
        onValueChange={onValueChange}
        t={mockT}
      />
    );

    const switches = screen.getAllByRole('switch');
    fireEvent.click(switches[0]);
    fireEvent.click(switches[1]);
    fireEvent.click(switches[2]);

    expect(onValueChange).toHaveBeenCalledWith('checkUpdatesOnStart', false);
    expect(onValueChange).toHaveBeenCalledWith('autoInstallUpdates', true);
    expect(onValueChange).toHaveBeenCalledWith('notifyOnUpdates', false);
  });
});
