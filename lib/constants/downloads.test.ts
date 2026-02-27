import {
  DEFAULT_DOWNLOAD_FORM,
  PRIORITY_OPTIONS,
  EMPTY_QUEUE_STATS,
  GITHUB_ARCHIVE_FORMATS,
  GITLAB_ARCHIVE_FORMATS,
} from './downloads';

describe('DEFAULT_DOWNLOAD_FORM', () => {
  it('has all required fields', () => {
    expect(DEFAULT_DOWNLOAD_FORM).toHaveProperty('url');
    expect(DEFAULT_DOWNLOAD_FORM).toHaveProperty('destination');
    expect(DEFAULT_DOWNLOAD_FORM).toHaveProperty('name');
    expect(DEFAULT_DOWNLOAD_FORM).toHaveProperty('checksum');
    expect(DEFAULT_DOWNLOAD_FORM).toHaveProperty('priority');
    expect(DEFAULT_DOWNLOAD_FORM).toHaveProperty('provider');
  });

  it('has all empty string defaults', () => {
    Object.values(DEFAULT_DOWNLOAD_FORM).forEach((value) => {
      expect(value).toBe('');
    });
  });
});

describe('PRIORITY_OPTIONS', () => {
  it('has 4 options', () => {
    expect(PRIORITY_OPTIONS).toHaveLength(4);
  });

  it('options are ordered from highest to lowest priority', () => {
    const values = PRIORITY_OPTIONS.map((o) => Number(o.value));
    for (let i = 0; i < values.length - 1; i++) {
      expect(values[i]).toBeGreaterThan(values[i + 1]);
    }
  });

  it('each option has value and label', () => {
    PRIORITY_OPTIONS.forEach((option) => {
      expect(option.value).toBeDefined();
      expect(option.label).toBeDefined();
      expect(typeof option.value).toBe('string');
      expect(typeof option.label).toBe('string');
    });
  });

  it('contains critical, high, normal, low labels', () => {
    const labels = PRIORITY_OPTIONS.map((o) => o.label);
    expect(labels).toContain('critical');
    expect(labels).toContain('high');
    expect(labels).toContain('normal');
    expect(labels).toContain('low');
  });
});

describe('EMPTY_QUEUE_STATS', () => {
  it('has all zero numeric fields', () => {
    expect(EMPTY_QUEUE_STATS.totalTasks).toBe(0);
    expect(EMPTY_QUEUE_STATS.queued).toBe(0);
    expect(EMPTY_QUEUE_STATS.downloading).toBe(0);
    expect(EMPTY_QUEUE_STATS.paused).toBe(0);
    expect(EMPTY_QUEUE_STATS.completed).toBe(0);
    expect(EMPTY_QUEUE_STATS.failed).toBe(0);
    expect(EMPTY_QUEUE_STATS.cancelled).toBe(0);
    expect(EMPTY_QUEUE_STATS.totalBytes).toBe(0);
    expect(EMPTY_QUEUE_STATS.downloadedBytes).toBe(0);
    expect(EMPTY_QUEUE_STATS.overallProgress).toBe(0);
  });

  it('has human-readable zero strings', () => {
    expect(EMPTY_QUEUE_STATS.totalHuman).toBe('0 B');
    expect(EMPTY_QUEUE_STATS.downloadedHuman).toBe('0 B');
  });
});

describe('GITHUB_ARCHIVE_FORMATS', () => {
  it('has 2 formats', () => {
    expect(GITHUB_ARCHIVE_FORMATS).toHaveLength(2);
  });

  it('includes zip and tar.gz', () => {
    const values = GITHUB_ARCHIVE_FORMATS.map((f) => f.value);
    expect(values).toContain('zip');
    expect(values).toContain('tar.gz');
  });

  it('each format has value and label', () => {
    GITHUB_ARCHIVE_FORMATS.forEach((fmt) => {
      expect(typeof fmt.value).toBe('string');
      expect(typeof fmt.label).toBe('string');
    });
  });
});

describe('GITLAB_ARCHIVE_FORMATS', () => {
  it('has 3 formats', () => {
    expect(GITLAB_ARCHIVE_FORMATS).toHaveLength(3);
  });

  it('includes zip, tar.gz, and tar.bz2', () => {
    const values = GITLAB_ARCHIVE_FORMATS.map((f) => f.value);
    expect(values).toContain('zip');
    expect(values).toContain('tar.gz');
    expect(values).toContain('tar.bz2');
  });

  it('is a superset of GitHub formats', () => {
    const ghValues = GITHUB_ARCHIVE_FORMATS.map((f) => f.value);
    const glValues = GITLAB_ARCHIVE_FORMATS.map((f) => f.value);
    ghValues.forEach((v) => {
      expect(glValues).toContain(v);
    });
  });
});
