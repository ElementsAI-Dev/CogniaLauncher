import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CollapsibleSection } from '../collapsible-section';

const mockT = (key: string) => {
  const translations: Record<string, string> = {
    'settings.section.modified': 'Modified',
    'settings.section.moreActions': 'More actions',
    'settings.section.resetToDefaults': 'Reset to defaults',
  };
  return translations[key] || key;
};

describe('CollapsibleSection', () => {
  const defaultProps = {
    id: 'general' as const,
    title: 'General Settings',
    description: 'Configure general settings',
    t: mockT,
    children: <div data-testid="section-content">Content</div>,
  };

  it('renders section title and description', () => {
    render(<CollapsibleSection {...defaultProps} />);

    expect(screen.getByText('General Settings')).toBeInTheDocument();
    expect(screen.getByText('Configure general settings')).toBeInTheDocument();
  });

  it('renders children content when open', () => {
    render(<CollapsibleSection {...defaultProps} defaultOpen={true} />);

    expect(screen.getByTestId('section-content')).toBeInTheDocument();
  });

  it('hides children content when collapsed', async () => {
    const user = userEvent.setup();
    render(<CollapsibleSection {...defaultProps} defaultOpen={true} />);

    // Click header to collapse
    await user.click(screen.getByText('General Settings'));

    // Content should be hidden
    expect(screen.queryByTestId('section-content')).not.toBeVisible();
  });

  it('shows modified badge when hasChanges is true', () => {
    render(<CollapsibleSection {...defaultProps} hasChanges={true} />);

    expect(screen.getByText('Modified')).toBeInTheDocument();
  });

  it('shows reset option in dropdown menu', async () => {
    const user = userEvent.setup();
    const onResetSection = jest.fn();

    render(
      <CollapsibleSection
        {...defaultProps}
        onResetSection={onResetSection}
      />
    );

    // Click the more actions button
    await user.click(screen.getByLabelText('More actions'));

    // Should show reset option
    expect(screen.getByText('Reset to defaults')).toBeInTheDocument();
  });

  it('calls onResetSection when reset option is clicked', async () => {
    const user = userEvent.setup();
    const onResetSection = jest.fn();

    render(
      <CollapsibleSection
        {...defaultProps}
        onResetSection={onResetSection}
      />
    );

    // Click the more actions button
    await user.click(screen.getByLabelText('More actions'));

    // Click reset option
    await user.click(screen.getByText('Reset to defaults'));

    expect(onResetSection).toHaveBeenCalledWith('general');
  });

  it('calls onOpenChange when collapsed/expanded', async () => {
    const user = userEvent.setup();
    const onOpenChange = jest.fn();

    render(
      <CollapsibleSection
        {...defaultProps}
        defaultOpen={true}
        onOpenChange={onOpenChange}
      />
    );

    // Click header to collapse
    await user.click(screen.getByText('General Settings'));

    expect(onOpenChange).toHaveBeenCalledWith('general', false);
  });

  it('renders with custom icon', () => {
    render(<CollapsibleSection {...defaultProps} icon="Network" />);

    // The icon should be rendered (we can't easily test SVG content, but we can verify render doesn't fail)
    expect(screen.getByText('General Settings')).toBeInTheDocument();
  });

  it('applies correct section ID for navigation', () => {
    render(<CollapsibleSection {...defaultProps} />);

    const card = screen.getByText('General Settings').closest('[id^="section-"]');
    expect(card).toHaveAttribute('id', 'section-general');
  });
});
