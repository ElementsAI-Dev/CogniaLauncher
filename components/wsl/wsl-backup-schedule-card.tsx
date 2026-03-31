'use client';

import { useMemo, useState } from 'react';
import { CalendarClock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { WslBackupSchedule } from '@/types/wsl';

interface WslBackupScheduleCardProps {
  distroNames: string[];
  schedules: WslBackupSchedule[];
  onUpsert: (schedule: WslBackupSchedule) => void;
  onDelete: (schedule: WslBackupSchedule) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export function WslBackupScheduleCard({
  distroNames,
  schedules,
  onUpsert,
  onDelete,
  t,
}: WslBackupScheduleCardProps) {
  const sortedSchedules = useMemo(
    () => [...schedules].sort((left, right) => left.distro_name.localeCompare(right.distro_name) || left.time.localeCompare(right.time)),
    [schedules],
  );
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [distroName, setDistroName] = useState(distroNames[0] ?? '');
  const [interval, setInterval] = useState<'daily' | 'weekly'>('daily');
  const [time, setTime] = useState('09:00');
  const [retention, setRetention] = useState('3');

  const resetForm = () => {
    setEditingKey(null);
    setDistroName(distroNames[0] ?? '');
    setInterval('daily');
    setTime('09:00');
    setRetention('3');
  };

  const handleSave = () => {
    const parsedRetention = Number.parseInt(retention, 10);
    if (!distroName || !time || !parsedRetention) {
      return;
    }

    onUpsert({
      distro_name: distroName,
      interval,
      time,
      retention: parsedRetention,
      last_run: null,
      next_run: null,
    });
    resetForm();
  };

  const handleEdit = (schedule: WslBackupSchedule) => {
    setEditingKey(`${schedule.distro_name}:${schedule.interval}:${schedule.time}`);
    setDistroName(schedule.distro_name);
    setInterval(schedule.interval);
    setTime(schedule.time);
    setRetention(String(schedule.retention));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <CalendarClock className="h-4 w-4 text-muted-foreground" />
          {t('wsl.backupSchedule.title')}
        </CardTitle>
        <CardDescription>{t('wsl.backupSchedule.description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {sortedSchedules.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('wsl.backupSchedule.noSchedules')}</p>
        ) : (
          <div className="space-y-2">
            {sortedSchedules.map((schedule) => (
              <div
                key={`${schedule.distro_name}:${schedule.interval}:${schedule.time}`}
                className="flex items-center justify-between rounded-md border px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {schedule.distro_name} · {t(`wsl.backupSchedule.${schedule.interval}`)} · {schedule.time}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t('wsl.backupSchedule.retention')}: {schedule.retention}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => handleEdit(schedule)}>
                    {t('wsl.backupSchedule.edit')}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => onDelete(schedule)}>
                    {t('wsl.backupSchedule.delete')}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="grid gap-3 md:grid-cols-4">
          <div className="space-y-1">
            <Label htmlFor="wsl-backup-schedule-distro">{t('wsl.backupSchedule.distro')}</Label>
            <select
              id="wsl-backup-schedule-distro"
              className="h-9 rounded-md border bg-background px-3 text-sm"
              value={distroName}
              onChange={(event) => setDistroName(event.target.value)}
              aria-label={t('wsl.backupSchedule.distro')}
            >
              {distroNames.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="wsl-backup-schedule-interval">{t('wsl.backupSchedule.interval')}</Label>
            <select
              id="wsl-backup-schedule-interval"
              className="h-9 rounded-md border bg-background px-3 text-sm"
              value={interval}
              onChange={(event) => setInterval(event.target.value as 'daily' | 'weekly')}
              aria-label={t('wsl.backupSchedule.interval')}
            >
              <option value="daily">{t('wsl.backupSchedule.daily')}</option>
              <option value="weekly">{t('wsl.backupSchedule.weekly')}</option>
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="wsl-backup-schedule-time">{t('wsl.backupSchedule.time')}</Label>
            <Input
              id="wsl-backup-schedule-time"
              type="time"
              value={time}
              onChange={(event) => setTime(event.target.value)}
              aria-label={t('wsl.backupSchedule.time')}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="wsl-backup-schedule-retention">{t('wsl.backupSchedule.retention')}</Label>
            <Input
              id="wsl-backup-schedule-retention"
              type="number"
              min={1}
              value={retention}
              onChange={(event) => setRetention(event.target.value)}
              aria-label={t('wsl.backupSchedule.retention')}
            />
          </div>
        </div>

        <div className="flex gap-2">
          <Button onClick={handleSave}>{t('wsl.backupSchedule.add')}</Button>
          {editingKey ? (
            <Button variant="ghost" onClick={resetForm}>
              {t('common.cancel')}
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
