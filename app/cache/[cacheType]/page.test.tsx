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
      searchParams: Promise.resolve({}),
    });
    render(el);
    expect(screen.getByTestId('cache-detail')).toHaveTextContent('download:none:none');
  });

  it('passes external drilldown target query params through to the client page', async () => {
    const el = await CacheDetailPage({
      params: Promise.resolve({ cacheType: 'external' }),
      searchParams: Promise.resolve({
        target: 'custom_docs',
        targetType: 'custom',
      }),
    });
    render(el);
    expect(screen.getByTestId('cache-detail')).toHaveTextContent('external:custom_docs:custom');
  });
});
