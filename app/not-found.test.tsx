import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import NotFound from './not-found';

const mockBack = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ back: mockBack, push: jest.fn() }),
}));

jest.mock('@/components/providers/locale-provider', () => ({
  useLocale: () => ({ t: (key: string) => key }),
}));

describe('NotFound (404) Page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders 404 code via i18n key', () => {
    render(<NotFound />);
    expect(screen.getByText('notFoundPage.code')).toBeInTheDocument();
  });

  it('renders page not found heading via i18n key', () => {
    render(<NotFound />);
    expect(screen.getByText('notFoundPage.title')).toBeInTheDocument();
  });

  it('renders description text via i18n key', () => {
    render(<NotFound />);
    expect(screen.getByText('notFoundPage.description')).toBeInTheDocument();
  });

  it('renders go back button and calls router.back()', async () => {
    const user = userEvent.setup();
    render(<NotFound />);

    const goBackButton = screen.getByRole('button', { name: /notFoundPage\.goBack/i });
    expect(goBackButton).toBeInTheDocument();
    await user.click(goBackButton);
    expect(mockBack).toHaveBeenCalled();
  });

  it('renders dashboard link pointing to /', () => {
    render(<NotFound />);
    const dashboardLink = screen.getByRole('link', { name: /notFoundPage\.dashboard/i });
    expect(dashboardLink).toBeInTheDocument();
    expect(dashboardLink).toHaveAttribute('href', '/');
  });
});
