import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ProviderSettings } from '../provider-settings';

const mockT = (key: string) => {
  const translations: Record<string, string> = {
    'settings.providerSettings': 'Provider Settings',
    'settings.providerSettingsDesc': 'Control provider availability globally',
    'settings.disabledProviders': 'Disabled Providers',
    'settings.disabledProvidersDesc': 'Comma-separated provider IDs to disable',
    'settings.disabledProvidersPlaceholder': 'e.g., brew, apt',
    'settings.disabledProvidersHint': 'Changes apply after restarting the app',
  };
  return translations[key] || key;
};

describe('ProviderSettings', () => {
  const defaultProps = {
    localConfig: {
      'provider_settings.disabled_providers': 'brew, apt',
    },
    errors: {},
    onValueChange: jest.fn(),
    t: mockT,
  };

  it('should render provider settings card', () => {
    render(<ProviderSettings {...defaultProps} />);

    expect(screen.getByText('Provider Settings')).toBeInTheDocument();
    expect(screen.getByText('Control provider availability globally')).toBeInTheDocument();
  });

  it('should display current disabled providers', () => {
    render(<ProviderSettings {...defaultProps} />);

    expect(screen.getByLabelText('Disabled Providers')).toHaveValue('brew, apt');
  });

  it('should call onValueChange when input changes', () => {
    const onValueChange = jest.fn();
    render(<ProviderSettings {...defaultProps} onValueChange={onValueChange} />);

    fireEvent.change(screen.getByLabelText('Disabled Providers'), { target: { value: 'brew' } });

    expect(onValueChange).toHaveBeenCalledWith('provider_settings.disabled_providers', 'brew');
  });
});
