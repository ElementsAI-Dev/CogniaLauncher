import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SettingsSearch } from './settings-search';
import type { UseSettingsSearchReturn } from '@/hooks/use-settings-search';

const mockT = (key: string, params?: Record<string, string | number>) => {
  const translations: Record<string, string> = {
    'settings.search.placeholder': 'Search settings...',
    'settings.search.label': 'Search settings',
    'settings.search.clear': 'Clear search',
    'settings.search.resultsCount': `${params?.count} results found`,
    'settings.search.results': 'Search results',
    'settings.search.moreResults': `+${params?.count} more results`,
    'settings.search.noResults': 'No settings found matching your search',
    'settings.search.advanced': 'Advanced',
    'settings.sections.general': 'General',
    'settings.parallelDownloads': 'Parallel Downloads',
    'settings.parallelDownloadsDesc': 'Number of concurrent downloads',
  };
  return translations[key] || key;
};

const createMockSearch = (overrides: Partial<UseSettingsSearchReturn> = {}): UseSettingsSearchReturn => ({
  query: '',
  setQuery: jest.fn(),
  results: [],
  matchingSections: new Set(),
  matchingSectionDefinitions: [],
  isSearching: false,
  clearSearch: jest.fn(),
  totalResults: 0,
  highlightText: (text: string) => [{ text, highlighted: false }],
  ...overrides,
});

describe('SettingsSearch', () => {
  it('renders search input with placeholder', () => {
    const search = createMockSearch();
    render(<SettingsSearch search={search} t={mockT} />);

    expect(screen.getByPlaceholderText('Search settings...')).toBeInTheDocument();
  });

  it('calls setQuery when typing in input', async () => {
    const user = userEvent.setup();
    const setQuery = jest.fn();
    const search = createMockSearch({ setQuery });

    render(<SettingsSearch search={search} t={mockT} />);

    const input = screen.getByPlaceholderText('Search settings...');
    await user.type(input, 'proxy');

    expect(setQuery).toHaveBeenCalled();
  });

  it('shows clear button when searching', () => {
    const search = createMockSearch({
      query: 'test',
      isSearching: true,
    });

    render(<SettingsSearch search={search} t={mockT} />);

    expect(screen.getByLabelText('Clear search')).toBeInTheDocument();
  });

  it('calls clearSearch when clear button is clicked', async () => {
    const user = userEvent.setup();
    const clearSearch = jest.fn();
    const search = createMockSearch({
      query: 'test',
      isSearching: true,
      clearSearch,
    });

    render(<SettingsSearch search={search} t={mockT} />);

    await user.click(screen.getByLabelText('Clear search'));

    expect(clearSearch).toHaveBeenCalled();
  });

  it('displays search results when searching', () => {
    const search = createMockSearch({
      query: 'parallel',
      isSearching: true,
      totalResults: 1,
      results: [
        {
          setting: {
            key: 'general.parallel_downloads',
            section: 'general',
            labelKey: 'settings.parallelDownloads',
            descKey: 'settings.parallelDownloadsDesc',
            type: 'input',
          },
          matchedIn: ['label'],
        },
      ],
    });

    render(<SettingsSearch search={search} t={mockT} />);

    expect(screen.getByText('1 results found')).toBeInTheDocument();
    expect(screen.getByText('Parallel Downloads')).toBeInTheDocument();
  });

  it('shows no results message when no matches found', () => {
    const search = createMockSearch({
      query: 'nonexistent',
      isSearching: true,
      totalResults: 0,
      results: [],
    });

    render(<SettingsSearch search={search} t={mockT} />);

    expect(screen.getByText('No settings found matching your search')).toBeInTheDocument();
  });

  it('calls onNavigateToSetting when result is clicked', async () => {
    const user = userEvent.setup();
    const onNavigateToSetting = jest.fn();
    const search = createMockSearch({
      query: 'parallel',
      isSearching: true,
      totalResults: 1,
      results: [
        {
          setting: {
            key: 'general.parallel_downloads',
            section: 'general',
            labelKey: 'settings.parallelDownloads',
            descKey: 'settings.parallelDownloadsDesc',
            type: 'input',
          },
          matchedIn: ['label'],
        },
      ],
    });

    render(
      <SettingsSearch
        search={search}
        onNavigateToSetting={onNavigateToSetting}
        t={mockT}
      />
    );

    await user.click(screen.getByText('Parallel Downloads'));

    expect(onNavigateToSetting).toHaveBeenCalledWith('general', 'general.parallel_downloads');
  });

  it('shows more results indicator when there are more than 8 results', () => {
    const results = Array(10).fill(null).map((_, i) => ({
      setting: {
        key: `general.setting_${i}`,
        section: 'general' as const,
        labelKey: `settings.setting${i}`,
        descKey: `settings.setting${i}Desc`,
        type: 'input' as const,
      },
      matchedIn: ['label' as const],
    }));

    const search = createMockSearch({
      query: 'test',
      isSearching: true,
      totalResults: 10,
      results,
    });

    render(<SettingsSearch search={search} t={mockT} />);

    expect(screen.getByText('+2 more results')).toBeInTheDocument();
  });

  it('shows advanced badge for advanced settings', () => {
    const search = createMockSearch({
      query: 'test',
      isSearching: true,
      totalResults: 1,
      results: [
        {
          setting: {
            key: 'general.advanced_setting',
            section: 'general',
            labelKey: 'settings.advancedSetting',
            descKey: 'settings.advancedSettingDesc',
            type: 'input',
            advanced: true,
          },
          matchedIn: ['label'],
        },
      ],
    });

    render(<SettingsSearch search={search} t={mockT} />);

    expect(screen.getByText('Advanced')).toBeInTheDocument();
  });
});
