import { render, screen } from '@testing-library/react';
import WslDistroPage from './page';

const mockGet = jest.fn();

jest.mock('next/navigation', () => ({
  useSearchParams: () => ({ get: mockGet }),
}));

jest.mock('@/components/wsl/wsl-distro-detail-page', () => ({
  WslDistroDetailPage: ({ distroName }: { distroName: string }) => (
    <div data-testid="distro-detail">{distroName}</div>
  ),
}));

jest.mock('@/components/layout/page-loading-skeleton', () => ({
  PageLoadingSkeleton: () => <div data-testid="loading-skeleton">Loading...</div>,
}));

describe('WslDistroPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows fallback message when no distro name is specified', () => {
    mockGet.mockReturnValue(null);
    render(<WslDistroPage />);
    expect(screen.getByText('No distribution specified.')).toBeInTheDocument();
  });

  it('renders WslDistroDetailPage when name is provided', () => {
    mockGet.mockReturnValue('Ubuntu');
    render(<WslDistroPage />);
    expect(screen.getByTestId('distro-detail')).toHaveTextContent('Ubuntu');
  });

  it('renders WslDistroDetailPage with correct distro name', () => {
    mockGet.mockReturnValue('Debian');
    render(<WslDistroPage />);
    expect(screen.getByTestId('distro-detail')).toHaveTextContent('Debian');
  });
});
