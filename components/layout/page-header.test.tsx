import { render, screen } from '@testing-library/react';
import { PageHeader } from './page-header';

describe('PageHeader', () => {
  it('renders title and description', () => {
    render(<PageHeader title="Page Title" description="Page description" />);

    expect(screen.getByRole('heading', { name: /page title/i })).toBeInTheDocument();
    expect(screen.getByText(/page description/i)).toBeInTheDocument();
  });

  it('renders actions when provided', () => {
    render(
      <PageHeader
        title="Actions Title"
        actions={<button type="button">Action</button>}
      />
    );

    expect(screen.getByRole('button', { name: /action/i })).toBeInTheDocument();
  });
});
