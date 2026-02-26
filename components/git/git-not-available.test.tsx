import { render, screen } from '@testing-library/react';
import { GitNotAvailable } from './git-not-available';

jest.mock('@/components/providers/locale-provider', () => ({
  useLocale: () => ({ t: (key: string) => key }),
}));

describe('GitNotAvailable', () => {
  it('renders not available message', () => {
    render(<GitNotAvailable />);
    expect(screen.getByText('git.notAvailable')).toBeInTheDocument();
  });
});
