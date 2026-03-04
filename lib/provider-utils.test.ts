import { getStatusColor, getAlertVariant, getActionColor, getSeverityIcon, getStatusTextColor, getStatusIcon } from './provider-utils';

describe('getStatusColor', () => {
  it('returns green classes for healthy', () => {
    expect(getStatusColor('healthy')).toContain('green');
  });

  it('returns yellow classes for warning', () => {
    expect(getStatusColor('warning')).toContain('yellow');
  });

  it('returns red classes for error', () => {
    expect(getStatusColor('error')).toContain('red');
  });

  it('returns gray classes for unknown status', () => {
    expect(getStatusColor('unknown' as never)).toContain('gray');
  });
});

describe('getAlertVariant', () => {
  it('returns destructive for critical', () => {
    expect(getAlertVariant('critical')).toBe('destructive');
  });

  it('returns destructive for error', () => {
    expect(getAlertVariant('error')).toBe('destructive');
  });

  it('returns default for warning', () => {
    expect(getAlertVariant('warning')).toBe('default');
  });

  it('returns default for info', () => {
    expect(getAlertVariant('info' as never)).toBe('default');
  });
});

describe('getActionColor', () => {
  it('returns green for install', () => {
    expect(getActionColor('install')).toContain('green');
  });

  it('returns red for uninstall', () => {
    expect(getActionColor('uninstall')).toContain('red');
  });

  it('returns red for remove', () => {
    expect(getActionColor('remove')).toContain('red');
  });

  it('returns blue for update', () => {
    expect(getActionColor('update')).toContain('blue');
  });

  it('returns blue for upgrade', () => {
    expect(getActionColor('upgrade')).toContain('blue');
  });

  it('returns yellow for rollback', () => {
    expect(getActionColor('rollback')).toContain('yellow');
  });

  it('returns gray for unknown action', () => {
    expect(getActionColor('something')).toContain('gray');
  });

  it('is case-insensitive', () => {
    expect(getActionColor('Install')).toContain('green');
    expect(getActionColor('UNINSTALL')).toContain('red');
  });
});

describe('getSeverityIcon', () => {
  it('returns AlertCircle for critical', () => {
    const icon = getSeverityIcon('critical');
    expect(icon.displayName).toBe('CircleAlert');
  });

  it('returns AlertCircle for error', () => {
    const icon = getSeverityIcon('error');
    expect(icon.displayName).toBe('CircleAlert');
  });

  it('returns AlertTriangle for warning', () => {
    const icon = getSeverityIcon('warning');
    expect(icon.displayName).toBe('TriangleAlert');
  });

  it('returns Info for info', () => {
    const icon = getSeverityIcon('info');
    expect(icon.displayName).toBe('Info');
  });

  it('returns Info for unknown severity', () => {
    const icon = getSeverityIcon('unknown' as never);
    expect(icon.displayName).toBe('Info');
  });
});

describe('getStatusTextColor', () => {
  it('returns green for healthy', () => {
    expect(getStatusTextColor('healthy')).toContain('green');
  });

  it('returns yellow for warning', () => {
    expect(getStatusTextColor('warning')).toContain('yellow');
  });

  it('returns red for error', () => {
    expect(getStatusTextColor('error')).toContain('red');
  });

  it('returns gray for unknown', () => {
    expect(getStatusTextColor('unknown')).toContain('gray');
  });
});

describe('getStatusIcon', () => {
  it('returns CheckCircle2 for healthy', () => {
    const icon = getStatusIcon('healthy');
    expect(icon.displayName).toBe('CircleCheck');
  });

  it('returns AlertTriangle for warning', () => {
    const icon = getStatusIcon('warning');
    expect(icon.displayName).toBe('TriangleAlert');
  });

  it('returns AlertCircle for error', () => {
    const icon = getStatusIcon('error');
    expect(icon.displayName).toBe('CircleAlert');
  });

  it('returns HelpCircle for unknown', () => {
    const icon = getStatusIcon('unknown');
    expect(icon.displayName).toBe('CircleQuestionMark');
  });
});
