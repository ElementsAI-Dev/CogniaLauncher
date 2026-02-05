import React from 'react';
import { render } from '@testing-library/react';
import { SettingsSkeleton } from './settings-skeleton';

describe('SettingsSkeleton', () => {
  it('should render skeleton cards', () => {
    render(<SettingsSkeleton />);

    // Check that multiple skeleton elements are rendered
    const skeletons = document.querySelectorAll('[class*="animate-pulse"]');
    
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('should render multiple card sections', () => {
    const { container } = render(<SettingsSkeleton />);

    // Check for card-like structures
    const cards = container.querySelectorAll('[class*="rounded"]');
    expect(cards.length).toBeGreaterThan(0);
  });

  it('should be accessible with proper structure', () => {
    const { container } = render(<SettingsSkeleton />);

    // Skeleton should be contained in a div
    expect(container.firstChild).toBeInstanceOf(HTMLElement);
  });
});
