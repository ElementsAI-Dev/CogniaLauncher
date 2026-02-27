import { render, screen } from '@testing-library/react';
import CacheDetailPage, { generateStaticParams } from './page';

jest.mock('@/components/cache/detail/cache-detail-page', () => ({
  CacheDetailPageClient: ({ cacheType }: { cacheType: string }) => (
    <div data-testid="cache-detail">{cacheType}</div>
  ),
}));

describe('CacheDetailPage', () => {
  it('generateStaticParams returns all 3 cache types', () => {
    const params = generateStaticParams();
    expect(params).toEqual([
      { cacheType: 'download' },
      { cacheType: 'metadata' },
      { cacheType: 'external' },
    ]);
  });

  it('generateStaticParams has correct length', () => {
    const params = generateStaticParams();
    expect(params).toHaveLength(3);
  });

  it('renders CacheDetailPageClient with correct cacheType prop', async () => {
    const el = await CacheDetailPage({ params: Promise.resolve({ cacheType: 'download' }) });
    render(el);
    expect(screen.getByTestId('cache-detail')).toHaveTextContent('download');
  });
});
