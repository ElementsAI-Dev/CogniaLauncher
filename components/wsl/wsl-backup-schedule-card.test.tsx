import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WslBackupScheduleCard } from './wsl-backup-schedule-card';
import type { WslBackupSchedule } from '@/types/wsl';

const mockT = (key: string) => {
  const translations: Record<string, string> = {
    'wsl.backupSchedule.title': 'Backup Schedule',
    'wsl.backupSchedule.description': 'Automate recurring distro backups.',
    'wsl.backupSchedule.distro': 'Distro',
    'wsl.backupSchedule.interval': 'Interval',
    'wsl.backupSchedule.time': 'Time',
    'wsl.backupSchedule.retention': 'Retention',
    'wsl.backupSchedule.add': 'Save Schedule',
    'wsl.backupSchedule.edit': 'Edit',
    'wsl.backupSchedule.delete': 'Delete',
    'wsl.backupSchedule.noSchedules': 'No backup schedules yet.',
    'wsl.backupSchedule.daily': 'Daily',
    'wsl.backupSchedule.weekly': 'Weekly',
    'common.cancel': 'Cancel',
  };

  return translations[key] || key;
};

describe('WslBackupScheduleCard', () => {
  const onUpsert = jest.fn<void, [WslBackupSchedule]>();
  const onDelete = jest.fn<void, [WslBackupSchedule]>();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders empty state when no schedules exist', () => {
    render(
      <WslBackupScheduleCard
        distroNames={['Ubuntu']}
        schedules={[]}
        onUpsert={onUpsert}
        onDelete={onDelete}
        t={mockT}
      />,
    );

    expect(screen.getByText('Backup Schedule')).toBeInTheDocument();
    expect(screen.getByText('No backup schedules yet.')).toBeInTheDocument();
  });

  it('creates a new backup schedule', async () => {
    const user = userEvent.setup();
    render(
      <WslBackupScheduleCard
        distroNames={['Ubuntu', 'Debian']}
        schedules={[]}
        onUpsert={onUpsert}
        onDelete={onDelete}
        t={mockT}
      />,
    );

    await user.selectOptions(screen.getByLabelText('Distro'), 'Debian');
    await user.selectOptions(screen.getByLabelText('Interval'), 'weekly');
    await user.clear(screen.getByLabelText('Time'));
    await user.type(screen.getByLabelText('Time'), '10:30');
    await user.clear(screen.getByLabelText('Retention'));
    await user.type(screen.getByLabelText('Retention'), '5');
    await user.click(screen.getByRole('button', { name: 'Save Schedule' }));

    await waitFor(() => {
      expect(onUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          distro_name: 'Debian',
          interval: 'weekly',
          time: '10:30',
          retention: 5,
        }),
      );
    });
  });

  it('loads an existing schedule for editing and deletes it', async () => {
    const user = userEvent.setup();
    const schedules: WslBackupSchedule[] = [
      {
        distro_name: 'Ubuntu',
        interval: 'daily',
        time: '09:00',
        retention: 3,
        last_run: null,
        next_run: '2026-03-30T01:00:00.000Z',
      },
    ];

    render(
      <WslBackupScheduleCard
        distroNames={['Ubuntu']}
        schedules={schedules}
        onUpsert={onUpsert}
        onDelete={onDelete}
        t={mockT}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Edit' }));
    expect(screen.getByLabelText('Time')).toHaveValue('09:00');

    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onDelete).toHaveBeenCalledWith(schedules[0]);
  });
});
