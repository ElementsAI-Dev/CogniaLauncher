import { render, screen } from '@testing-library/react';
import CacheDetailPage, { generateStaticParams } from './page';

jest.mock('@/components/cache/detail/cache-detail-page', () => ({
  CacheDetailPageClient: ({
    cacheType,
    targetId,
    targetType,
  }: {
    cacheType: string;
    targetId?: string | null;
    targetType?: string | null;
  }) => (
    <div data-testid="cache-detail">
      {cacheType}:{targetId ?? 'none'}:{targetType ?? 'none'}
    </div>
  ),
}));

describe('CacheDetailPage', () => {
  it('generateStaticParams returns all 4 cache types', () => {
    const params = generateStaticParams();
    expect(params).toEqual([
      { cacheType: 'download' },
      { cacheType: 'metadata' },
      { cacheType: 'default_downloads' },
      { cacheType: 'external' },
    ]);
  });

  it('generateStaticParams has correct length', () => {
    const params = generateStaticParams();
    expect(params).toHaveLength(4);
  });

  it('renders CacheDetailPageClient with correct cacheType prop', async () => {
    const el = await CacheDetailPage({
      params: Promise.resolve({ cacheType: 'download' }),
    });
    render(el);
    expect(screen.getByTestId('cache-detail')).toHaveTextContent('download:none:none');
  });

  it('renders the external cache detail route without resolving search params on the server', async () => {
    const el = await CacheDetailPage({
      params: Promise.resolve({ cacheType: 'external' }),
    });
    render(el);
    expect(screen.getByTestId('cache-detail')).toHaveTextContent('external:none:none');
  });
});
