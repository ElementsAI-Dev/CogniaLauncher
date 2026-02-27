import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import NotFound from './not-found';

const mockBack = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ back: mockBack, push: jest.fn() }),
}));

describe('NotFound (404) Page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders 404 text', () => {
    render(<NotFound />);
    expect(screen.getByText('404')).toBeInTheDocument();
  });

  it('renders page not found heading', () => {
    render(<NotFound />);
    expect(screen.getByText('Page Not Found')).toBeInTheDocument();
  });

  it('renders description text', () => {
    render(<NotFound />);
    expect(
      screen.getByText(/the page you are looking for does not exist/i)
    ).toBeInTheDocument();
  });

  it('renders go back button and calls router.back()', async () => {
    const user = userEvent.setup();
    render(<NotFound />);

    const goBackButton = screen.getByRole('button', { name: /go back/i });
    expect(goBackButton).toBeInTheDocument();
    await user.click(goBackButton);
    expect(mockBack).toHaveBeenCalled();
  });

  it('renders dashboard link pointing to /', () => {
    render(<NotFound />);
    const dashboardLink = screen.getByRole('link', { name: /dashboard/i });
    expect(dashboardLink).toBeInTheDocument();
    expect(dashboardLink).toHaveAttribute('href', '/');
  });
});
