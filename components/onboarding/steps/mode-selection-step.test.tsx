import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ModeSelectionStep } from './mode-selection-step';

const mockT = (key: string) => {
  const translations: Record<string, string> = {
    'onboarding.modeSelectionTitle': 'Choose your setup style',
    'onboarding.modeSelectionDesc': 'Pick the onboarding depth that fits you best.',
    'onboarding.modeSelectionQuickTitle': 'Quick setup',
    'onboarding.modeSelectionQuickDesc': 'Essential setup with fewer explanations.',
    'onboarding.modeSelectionQuickPoint1': 'Skip extra background',
    'onboarding.modeSelectionQuickPoint2': 'Reach the app faster',
    'onboarding.modeSelectionDetailedTitle': 'Detailed setup',
    'onboarding.modeSelectionDetailedDesc': 'Guided setup with recommendations.',
    'onboarding.modeSelectionDetailedPoint1': 'Learn what each step changes',
    'onboarding.modeSelectionDetailedPoint2': 'Get extra follow-up guidance',
    'onboarding.modeSelectionHint': 'You can change this later by rerunning onboarding from Settings.',
  };

  return translations[key] || key;
};

describe('ModeSelectionStep', () => {
  it('renders both onboarding mode choices', () => {
    render(<ModeSelectionStep t={mockT} selectedMode={null} onSelectMode={jest.fn()} />);

    expect(screen.getByText('Quick setup')).toBeInTheDocument();
    expect(screen.getByText('Detailed setup')).toBeInTheDocument();
    expect(screen.getByText('Choose your setup style')).toBeInTheDocument();
  });

  it('calls onSelectMode when a mode is clicked', async () => {
    const onSelectMode = jest.fn();
    render(<ModeSelectionStep t={mockT} selectedMode={null} onSelectMode={onSelectMode} />);

    await userEvent.click(screen.getByLabelText('Detailed setup'));

    expect(onSelectMode).toHaveBeenCalledWith('detailed');
  });

  it('reflects the selected mode', () => {
    render(<ModeSelectionStep t={mockT} selectedMode="quick" onSelectMode={jest.fn()} />);

    expect(screen.getByLabelText('Quick setup')).toHaveAttribute('data-state', 'checked');
  });
});
