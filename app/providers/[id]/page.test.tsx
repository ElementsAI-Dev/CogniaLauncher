import { render, screen } from '@testing-library/react';
import ProviderDetailPage, { generateStaticParams } from './page';
import { ALL_PROVIDER_IDS } from '@/lib/constants/providers';

jest.mock('@/components/provider-management/detail', () => ({
  ProviderDetailPageClient: ({ providerId }: { providerId: string }) => (
    <div data-testid="provider-detail">{providerId}</div>
  ),
}));

describe('ProviderDetailPage', () => {
  it('generateStaticParams returns all known provider IDs', () => {
    const params = generateStaticParams();
    expect(params).toHaveLength(ALL_PROVIDER_IDS.length);
    ALL_PROVIDER_IDS.forEach((id) => {
      expect(params).toContainEqual({ id });
    });
  });

  it('generateStaticParams returns objects with id property', () => {
    const params = generateStaticParams();
    params.forEach((p) => {
      expect(p).toHaveProperty('id');
      expect(typeof p.id).toBe('string');
    });
  });

  it('renders ProviderDetailPageClient with correct providerId prop', async () => {
    const el = await ProviderDetailPage({ params: Promise.resolve({ id: 'npm' }) });
    render(el);
    expect(screen.getByTestId('provider-detail')).toHaveTextContent('npm');
  });
});
