import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LanguageToggle } from './language-toggle';

const mockSetLocale = jest.fn();

jest.mock('@/components/providers/locale-provider', () => ({
  useLocale: () => ({
    locale: 'en',
    setLocale: mockSetLocale,
    t: (key: string) => {
      const translations: Record<string, string> = {
        'language.toggle': 'Toggle language',
      };
      return translations[key] || key;
    },
  }),
}));

jest.mock('@/lib/i18n', () => ({
  locales: ['en', 'zh'],
  localeNames: {
    en: 'English',
    zh: '中文',
  },
}));

describe('LanguageToggle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders language toggle button', () => {
    render(<LanguageToggle />);

    const button = screen.getByRole('button');
    expect(button).toBeInTheDocument();
  });

  it('has accessible label', () => {
    render(<LanguageToggle />);

    expect(screen.getByText('Toggle language')).toBeInTheDocument();
  });

  it('opens dropdown menu on click', async () => {
    const user = userEvent.setup();
    render(<LanguageToggle />);

    await user.click(screen.getByRole('button'));

    expect(screen.getByText('English')).toBeInTheDocument();
    expect(screen.getByText('中文')).toBeInTheDocument();
  });

  it('calls setLocale when language option is clicked', async () => {
    const user = userEvent.setup();
    render(<LanguageToggle />);

    await user.click(screen.getByRole('button'));
    await user.click(screen.getByText('中文'));

    expect(mockSetLocale).toHaveBeenCalledWith('zh');
  });

  it('highlights current locale in dropdown', async () => {
    const user = userEvent.setup();
    render(<LanguageToggle />);

    await user.click(screen.getByRole('button'));

    const englishOption = screen.getByText('English').closest('[role="menuitem"]');
    expect(englishOption).toHaveClass('bg-accent');
  });
});
