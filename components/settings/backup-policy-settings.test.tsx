import { fireEvent, render, screen } from '@testing-library/react';
import { BackupPolicySettings } from './backup-policy-settings';

const mockT = (key: string) => {
  const translations: Record<string, string> = {
    'settings.backupAutoBackupEnabled': 'Auto Backup Enabled',
    'settings.backupAutoBackupEnabledDesc': 'Enable scheduled backups',
    'settings.backupAutoBackupIntervalHours': 'Backup Interval (Hours)',
    'settings.backupAutoBackupIntervalHoursDesc': 'How often to create backups',
    'settings.backupMaxBackups': 'Max Backups',
    'settings.backupMaxBackupsDesc': 'Maximum number of backups to keep',
    'settings.backupRetentionDays': 'Retention Days',
    'settings.backupRetentionDaysDesc': 'How many days backups are kept',
  };

  return translations[key] || key;
};

describe('BackupPolicySettings', () => {
  const defaultProps = {
    localConfig: {
      'backup.auto_backup_enabled': 'true',
      'backup.auto_backup_interval_hours': '24',
      'backup.max_backups': '10',
      'backup.retention_days': '30',
    },
    errors: {},
    onValueChange: jest.fn(),
    t: mockT,
  };

  it('renders backup policy fields and calls onValueChange for each control', () => {
    const onValueChange = jest.fn();
    render(
      <BackupPolicySettings
        {...defaultProps}
        onValueChange={onValueChange}
      />,
    );

    fireEvent.click(screen.getByRole('switch'));
    const spinbuttons = screen.getAllByRole('spinbutton');
    fireEvent.change(spinbuttons[0], { target: { value: '48' } });
    fireEvent.change(spinbuttons[1], { target: { value: '12' } });
    fireEvent.change(spinbuttons[2], { target: { value: '45' } });

    expect(onValueChange).toHaveBeenCalledWith('backup.auto_backup_enabled', 'false');
    expect(onValueChange).toHaveBeenCalledWith('backup.auto_backup_interval_hours', '48');
    expect(onValueChange).toHaveBeenCalledWith('backup.max_backups', '12');
    expect(onValueChange).toHaveBeenCalledWith('backup.retention_days', '45');
  });

  it('renders inline policy errors and boundary notes together', () => {
    render(
      <BackupPolicySettings
        {...defaultProps}
        localConfig={{
          'backup.auto_backup_enabled': 'true',
          'backup.auto_backup_interval_hours': '0',
          'backup.max_backups': '1001',
          'backup.retention_days': '0',
        }}
        errors={{
          'backup.max_backups': 'Too many backups',
        }}
      />,
    );

    expect(screen.getAllByText('Too many backups')).toHaveLength(2);
    expect(screen.getByText(/clamped to 1000/i)).toBeInTheDocument();
    expect(screen.getByText(/no age limit/i)).toBeInTheDocument();
    expect(screen.getByText(/scheduled automatic backup loop is disabled/i)).toBeInTheDocument();
  });
});
