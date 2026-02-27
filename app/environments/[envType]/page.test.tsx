import { render, screen } from '@testing-library/react';
import EnvironmentDetailPage, { generateStaticParams } from './page';
import { LANGUAGES } from '@/lib/constants/environments';

jest.mock('@/components/environments/detail/env-detail-page', () => ({
  EnvDetailPageClient: ({ envType }: { envType: string }) => (
    <div data-testid="env-detail">{envType}</div>
  ),
}));

describe('EnvironmentDetailPage', () => {
  it('generateStaticParams returns all language IDs', () => {
    const params = generateStaticParams();
    expect(params).toHaveLength(LANGUAGES.length);
    LANGUAGES.forEach((lang) => {
      expect(params).toContainEqual({ envType: lang.id });
    });
  });

  it('generateStaticParams returns objects with envType property', () => {
    const params = generateStaticParams();
    params.forEach((p) => {
      expect(p).toHaveProperty('envType');
      expect(typeof p.envType).toBe('string');
    });
  });

  it('renders EnvDetailPageClient with correct envType prop', async () => {
    const el = await EnvironmentDetailPage({ params: Promise.resolve({ envType: 'node' }) });
    render(el);
    expect(screen.getByTestId('env-detail')).toHaveTextContent('node');
  });
});
