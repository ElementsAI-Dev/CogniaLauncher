import { render, screen } from '@testing-library/react';
import { PackageComparisonDialog } from './package-comparison-dialog';

jest.mock('@/components/providers/locale-provider', () => ({
  useLocale: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'packages.compareVersions': 'Compare Versions',
        'packages.currentVersion': 'Current',
        'packages.newVersion': 'New',
        'packages.close': 'Close',
      };
      return translations[key] || key;
    },
  }),
}));

const defaultProps = {
  open: true,
  onOpenChange: jest.fn(),
  packageIds: ['pip:numpy', 'pip:pandas'],
  onCompare: jest.fn().mockResolvedValue({ packages: [], features: [] }),
};

describe('PackageComparisonDialog', () => {
  it('renders dialog when open', () => {
    render(<PackageComparisonDialog {...defaultProps} />);
    // Component uses "Compare Packages" as the title
    expect(screen.getByText('Compare Packages')).toBeInTheDocument();
  });

  it('calls onCompare when dialog opens', () => {
    render(<PackageComparisonDialog {...defaultProps} />);
    expect(defaultProps.onCompare).toHaveBeenCalledWith(['pip:numpy', 'pip:pandas']);
  });

  it('does not render when closed', () => {
    render(<PackageComparisonDialog {...defaultProps} open={false} />);
    expect(screen.queryByText('Compare Versions')).not.toBeInTheDocument();
  });
});
