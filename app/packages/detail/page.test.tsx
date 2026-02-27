import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PackageDetailRoute from './page';

const mockPush = jest.fn();
const mockGet = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => ({ get: mockGet }),
}));

jest.mock('@/components/providers/locale-provider', () => ({
  useLocale: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'packages.detail.packageNotSpecified': 'No package specified',
        'packages.detail.packageNotSpecifiedDesc': 'Please select a package to view its details.',
        'packages.detail.goToPackages': 'Go to Packages',
      };
      return translations[key] || key;
    },
  }),
}));

jest.mock('@/components/packages/detail/package-detail-page', () => ({
  PackageDetailPage: ({ packageName, providerId }: { packageName: string; providerId?: string }) => (
    <div data-testid="package-detail">
      <span data-testid="pkg-name">{packageName}</span>
      <span data-testid="pkg-provider">{providerId ?? ''}</span>
    </div>
  ),
}));

jest.mock('@/components/layout/page-loading-skeleton', () => ({
  PageLoadingSkeleton: () => <div data-testid="loading-skeleton">Loading...</div>,
}));

describe('PackageDetailRoute', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows empty state when no package name in search params', () => {
    mockGet.mockReturnValue(null);
    render(<PackageDetailRoute />);
    expect(screen.getByText('No package specified')).toBeInTheDocument();
  });

  it('shows go to packages button in empty state', async () => {
    const user = userEvent.setup();
    mockGet.mockReturnValue(null);
    render(<PackageDetailRoute />);

    const button = screen.getByRole('button', { name: /go to packages/i });
    expect(button).toBeInTheDocument();
    await user.click(button);
    expect(mockPush).toHaveBeenCalledWith('/packages');
  });

  it('renders PackageDetailPage when name is provided', () => {
    mockGet.mockImplementation((key: string) => {
      if (key === 'name') return 'typescript';
      if (key === 'provider') return 'npm';
      return null;
    });
    render(<PackageDetailRoute />);
    expect(screen.getByTestId('pkg-name')).toHaveTextContent('typescript');
    expect(screen.getByTestId('pkg-provider')).toHaveTextContent('npm');
  });

  it('renders PackageDetailPage without provider when not specified', () => {
    mockGet.mockImplementation((key: string) => {
      if (key === 'name') return 'lodash';
      return null;
    });
    render(<PackageDetailRoute />);
    expect(screen.getByTestId('pkg-name')).toHaveTextContent('lodash');
    expect(screen.getByTestId('pkg-provider')).toHaveTextContent('');
  });
});
