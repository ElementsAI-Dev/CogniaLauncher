import React from 'react';
import { render, screen } from '@testing-library/react';
import { SystemInfo } from '../system-info';

const mockT = (key: string) => {
  const translations: Record<string, string> = {
    'settings.systemInfo': 'System Information',
    'settings.systemInfoDesc': 'Current system details',
    'settings.operatingSystem': 'Operating System',
    'settings.architecture': 'Architecture',
    'common.unknown': 'Unknown',
  };
  return translations[key] || key;
};

describe('SystemInfo', () => {
  const defaultProps = {
    loading: false,
    platformInfo: {
      os: 'Windows 11',
      arch: 'x86_64',
    },
    t: mockT,
  };

  it('should render system info card', () => {
    render(<SystemInfo {...defaultProps} />);

    expect(screen.getByText('System Information')).toBeInTheDocument();
    expect(screen.getByText('Current system details')).toBeInTheDocument();
  });

  it('should display platform information', () => {
    render(<SystemInfo {...defaultProps} />);

    expect(screen.getByText('Windows 11')).toBeInTheDocument();
    expect(screen.getByText('x86_64')).toBeInTheDocument();
  });

  it('should display operating system label', () => {
    render(<SystemInfo {...defaultProps} />);

    expect(screen.getByText('Operating System')).toBeInTheDocument();
  });

  it('should display architecture label', () => {
    render(<SystemInfo {...defaultProps} />);

    expect(screen.getByText('Architecture')).toBeInTheDocument();
  });

  it('should show skeleton when loading', () => {
    const { container } = render(<SystemInfo {...defaultProps} loading={true} />);

    // Check for skeleton elements
    const skeletons = container.querySelectorAll('[class*="animate-pulse"]');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('should show unknown when platform info is null', () => {
    render(<SystemInfo {...defaultProps} platformInfo={null} />);

    const unknownElements = screen.getAllByText('Unknown');
    expect(unknownElements.length).toBe(2);
  });

  it('should show unknown for missing os', () => {
    render(
      <SystemInfo
        {...defaultProps}
        platformInfo={{ os: undefined as unknown as string, arch: 'x86_64' }}
      />
    );

    expect(screen.getByText('Unknown')).toBeInTheDocument();
  });

  it('should show unknown for missing arch', () => {
    render(
      <SystemInfo
        {...defaultProps}
        platformInfo={{ os: 'Windows 11', arch: undefined as unknown as string }}
      />
    );

    expect(screen.getByText('Unknown')).toBeInTheDocument();
  });
});
