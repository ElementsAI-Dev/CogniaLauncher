import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PluginUiRenderer } from './plugin-ui-renderer';
import type { UiBlock } from '@/types/plugin-ui';

jest.mock('@/components/providers/locale-provider', () => ({
  useLocale: () => ({ t: (k: string) => k, locale: 'en' }),
}));

jest.mock('@/components/docs/markdown-renderer', () => ({
  MarkdownRenderer: ({ content }: { content: string }) => (
    <div data-testid="markdown-renderer">{content}</div>
  ),
}));

describe('PluginUiRenderer', () => {
  const mockOnAction = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders empty when no blocks', () => {
    const { container } = render(
      <PluginUiRenderer blocks={[]} onAction={mockOnAction} />,
    );
    expect(container.querySelector('.space-y-4')).toBeInTheDocument();
    expect(container.querySelector('.space-y-4')?.children).toHaveLength(0);
  });

  it('renders text block', () => {
    const blocks: UiBlock[] = [{ type: 'text', content: 'Hello world' }];
    render(<PluginUiRenderer blocks={blocks} onAction={mockOnAction} />);
    expect(screen.getByText('Hello world')).toBeInTheDocument();
  });

  it('renders text block with muted variant', () => {
    const blocks: UiBlock[] = [
      { type: 'text', content: 'Muted text', variant: 'muted' },
    ];
    render(<PluginUiRenderer blocks={blocks} onAction={mockOnAction} />);
    const el = screen.getByText('Muted text');
    expect(el).toHaveClass('text-muted-foreground');
  });

  it('renders text block with code variant', () => {
    const blocks: UiBlock[] = [
      { type: 'text', content: 'code text', variant: 'code' },
    ];
    render(<PluginUiRenderer blocks={blocks} onAction={mockOnAction} />);
    const el = screen.getByText('code text');
    expect(el).toHaveClass('font-mono');
  });

  it('renders heading block level 1', () => {
    const blocks: UiBlock[] = [
      { type: 'heading', content: 'Title', level: 1 },
    ];
    render(<PluginUiRenderer blocks={blocks} onAction={mockOnAction} />);
    const el = screen.getByText('Title');
    expect(el.tagName).toBe('H1');
  });

  it('renders heading block level 2 by default', () => {
    const blocks: UiBlock[] = [{ type: 'heading', content: 'Subtitle' }];
    render(<PluginUiRenderer blocks={blocks} onAction={mockOnAction} />);
    const el = screen.getByText('Subtitle');
    expect(el.tagName).toBe('H2');
  });

  it('renders heading block level 3', () => {
    const blocks: UiBlock[] = [
      { type: 'heading', content: 'Small', level: 3 },
    ];
    render(<PluginUiRenderer blocks={blocks} onAction={mockOnAction} />);
    const el = screen.getByText('Small');
    expect(el.tagName).toBe('H3');
  });

  it('renders markdown block using MarkdownRenderer', () => {
    const blocks: UiBlock[] = [
      { type: 'markdown', content: '**bold**' },
    ];
    render(<PluginUiRenderer blocks={blocks} onAction={mockOnAction} />);
    expect(screen.getByTestId('markdown-renderer')).toHaveTextContent('**bold**');
  });

  it('renders divider block', () => {
    const blocks: UiBlock[] = [{ type: 'divider' }];
    const { container } = render(
      <PluginUiRenderer blocks={blocks} onAction={mockOnAction} />,
    );
    expect(container.querySelector('[data-slot="separator"]')).toBeInTheDocument();
  });

  it('renders alert block', () => {
    const blocks: UiBlock[] = [
      { type: 'alert', title: 'Warning', message: 'Be careful' },
    ];
    render(<PluginUiRenderer blocks={blocks} onAction={mockOnAction} />);
    expect(screen.getByText('Warning')).toBeInTheDocument();
    expect(screen.getByText('Be careful')).toBeInTheDocument();
  });

  it('renders alert block without title', () => {
    const blocks: UiBlock[] = [
      { type: 'alert', message: 'Just a message' },
    ];
    render(<PluginUiRenderer blocks={blocks} onAction={mockOnAction} />);
    expect(screen.getByText('Just a message')).toBeInTheDocument();
  });

  it('renders badge block', () => {
    const blocks: UiBlock[] = [{ type: 'badge', label: 'v1.0' }];
    render(<PluginUiRenderer blocks={blocks} onAction={mockOnAction} />);
    expect(screen.getByText('v1.0')).toBeInTheDocument();
  });

  it('renders progress block', () => {
    const blocks: UiBlock[] = [
      { type: 'progress', value: 50, max: 100, label: 'Loading...' },
    ];
    render(<PluginUiRenderer blocks={blocks} onAction={mockOnAction} />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('renders code block', () => {
    const blocks: UiBlock[] = [
      { type: 'code', code: 'console.log("hi")', language: 'js' },
    ];
    render(<PluginUiRenderer blocks={blocks} onAction={mockOnAction} />);
    expect(screen.getByText('console.log("hi")')).toBeInTheDocument();
    expect(screen.getByText('js')).toBeInTheDocument();
  });

  it('renders table block', () => {
    const blocks: UiBlock[] = [
      {
        type: 'table',
        headers: ['Name', 'Version'],
        rows: [['Node', '20.0'], ['Python', '3.12']],
      },
    ];
    render(<PluginUiRenderer blocks={blocks} onAction={mockOnAction} />);
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Version')).toBeInTheDocument();
    expect(screen.getByText('Node')).toBeInTheDocument();
    expect(screen.getByText('20.0')).toBeInTheDocument();
    expect(screen.getByText('Python')).toBeInTheDocument();
    expect(screen.getByText('3.12')).toBeInTheDocument();
  });

  it('renders key-value block', () => {
    const blocks: UiBlock[] = [
      {
        type: 'key-value',
        items: [
          { key: 'OS', value: 'Windows' },
          { key: 'Arch', value: 'x64' },
        ],
      },
    ];
    render(<PluginUiRenderer blocks={blocks} onAction={mockOnAction} />);
    expect(screen.getByText('OS')).toBeInTheDocument();
    expect(screen.getByText('Windows')).toBeInTheDocument();
    expect(screen.getByText('Arch')).toBeInTheDocument();
    expect(screen.getByText('x64')).toBeInTheDocument();
  });

  it('renders action buttons and triggers callback on click', async () => {
    const user = userEvent.setup();
    const blocks: UiBlock[] = [
      {
        type: 'actions',
        buttons: [
          { id: 'refresh', label: 'Refresh' },
          { id: 'delete', label: 'Delete', variant: 'destructive' },
        ],
      },
    ];
    render(<PluginUiRenderer blocks={blocks} onAction={mockOnAction} />);
    expect(screen.getByText('Refresh')).toBeInTheDocument();
    expect(screen.getByText('Delete')).toBeInTheDocument();

    await user.click(screen.getByText('Refresh'));
    expect(mockOnAction).toHaveBeenCalledWith({
      action: 'button_click',
      buttonId: 'refresh',
      state: undefined,
    });
  });

  it('passes state through action callback', async () => {
    const user = userEvent.setup();
    const state = { counter: 42 };
    const blocks: UiBlock[] = [
      {
        type: 'actions',
        buttons: [{ id: 'inc', label: 'Increment' }],
      },
    ];
    render(
      <PluginUiRenderer blocks={blocks} onAction={mockOnAction} state={state} />,
    );
    await user.click(screen.getByText('Increment'));
    expect(mockOnAction).toHaveBeenCalledWith({
      action: 'button_click',
      buttonId: 'inc',
      state: { counter: 42 },
    });
  });

  it('renders form block with input field', () => {
    const blocks: UiBlock[] = [
      {
        type: 'form',
        id: 'settings',
        fields: [
          { type: 'input', id: 'name', label: 'Name', placeholder: 'Enter name' },
        ],
        submitLabel: 'Save',
      },
    ];
    render(<PluginUiRenderer blocks={blocks} onAction={mockOnAction} />);
    expect(screen.getByLabelText('Name')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Enter name')).toBeInTheDocument();
    expect(screen.getByText('Save')).toBeInTheDocument();
  });

  it('submits form with field data', async () => {
    const user = userEvent.setup();
    const blocks: UiBlock[] = [
      {
        type: 'form',
        id: 'login',
        fields: [
          { type: 'input', id: 'username', label: 'Username' },
        ],
        submitLabel: 'Login',
      },
    ];
    render(<PluginUiRenderer blocks={blocks} onAction={mockOnAction} />);
    await user.type(screen.getByLabelText('Username'), 'admin');
    await user.click(screen.getByText('Login'));
    expect(mockOnAction).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'form_submit',
        formId: 'login',
        formData: expect.objectContaining({ username: 'admin' }),
      }),
    );
  });

  it('renders checkbox field and toggles', async () => {
    const user = userEvent.setup();
    const blocks: UiBlock[] = [
      {
        type: 'form',
        id: 'prefs',
        fields: [
          { type: 'checkbox', id: 'agree', label: 'I agree', defaultChecked: false },
        ],
      },
    ];
    render(<PluginUiRenderer blocks={blocks} onAction={mockOnAction} />);
    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).not.toBeChecked();
    await user.click(checkbox);
    expect(checkbox).toBeChecked();
  });

  it('renders select field with options', () => {
    const blocks: UiBlock[] = [
      {
        type: 'form',
        id: 'config',
        fields: [
          {
            type: 'select',
            id: 'theme',
            label: 'Theme',
            options: [
              { label: 'Light', value: 'light' },
              { label: 'Dark', value: 'dark' },
            ],
            defaultValue: 'light',
          },
        ],
      },
    ];
    render(<PluginUiRenderer blocks={blocks} onAction={mockOnAction} />);
    expect(screen.getByText('Theme')).toBeInTheDocument();
  });

  it('renders group block horizontally', () => {
    const blocks: UiBlock[] = [
      {
        type: 'group',
        direction: 'horizontal',
        children: [
          { type: 'badge', label: 'A' },
          { type: 'badge', label: 'B' },
        ],
      },
    ];
    render(<PluginUiRenderer blocks={blocks} onAction={mockOnAction} />);
    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.getByText('B')).toBeInTheDocument();
  });

  it('renders nested group blocks', () => {
    const blocks: UiBlock[] = [
      {
        type: 'group',
        direction: 'vertical',
        children: [
          { type: 'heading', content: 'Section' },
          {
            type: 'group',
            direction: 'horizontal',
            children: [
              { type: 'text', content: 'Left' },
              { type: 'text', content: 'Right' },
            ],
          },
        ],
      },
    ];
    render(<PluginUiRenderer blocks={blocks} onAction={mockOnAction} />);
    expect(screen.getByText('Section')).toBeInTheDocument();
    expect(screen.getByText('Left')).toBeInTheDocument();
    expect(screen.getByText('Right')).toBeInTheDocument();
  });

  it('renders multiple mixed blocks', () => {
    const blocks: UiBlock[] = [
      { type: 'heading', content: 'Dashboard', level: 1 },
      { type: 'divider' },
      { type: 'text', content: 'Status: OK' },
      { type: 'progress', value: 75 },
      {
        type: 'table',
        headers: ['Key', 'Value'],
        rows: [['uptime', '24h']],
      },
      {
        type: 'actions',
        buttons: [{ id: 'refresh', label: 'Refresh' }],
      },
    ];
    render(<PluginUiRenderer blocks={blocks} onAction={mockOnAction} />);
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Status: OK')).toBeInTheDocument();
    expect(screen.getByText('uptime')).toBeInTheDocument();
    expect(screen.getByText('Refresh')).toBeInTheDocument();
  });

  it('silently ignores unknown block types', () => {
    const blocks = [
      { type: 'text', content: 'Known' },
      { type: 'unknown_block_type' as 'text', content: 'x' },
      { type: 'text', content: 'Also known' },
    ];
    render(<PluginUiRenderer blocks={blocks as UiBlock[]} onAction={mockOnAction} />);
    expect(screen.getByText('Known')).toBeInTheDocument();
    expect(screen.getByText('Also known')).toBeInTheDocument();
  });

  it('renders image block', () => {
    const blocks: UiBlock[] = [
      { type: 'image', src: 'data:image/png;base64,abc', alt: 'Test image', width: 100 },
    ];
    render(<PluginUiRenderer blocks={blocks} onAction={mockOnAction} />);
    const img = screen.getByAltText('Test image');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', 'data:image/png;base64,abc');
  });
});
