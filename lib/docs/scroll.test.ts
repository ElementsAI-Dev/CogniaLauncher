import { scrollToHeading, handleAnchorClick } from './scroll';

describe('scrollToHeading', () => {
  it('scrolls to element and updates URL hash', () => {
    const scrollMock = jest.fn();
    const replaceStateMock = jest.fn();
    const origReplace = history.replaceState;
    history.replaceState = replaceStateMock;

    const el = document.createElement('div');
    el.id = 'test-heading';
    el.scrollIntoView = scrollMock;
    document.body.appendChild(el);

    scrollToHeading('test-heading');

    expect(scrollMock).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
    expect(replaceStateMock).toHaveBeenCalledWith(null, '', '#test-heading');

    document.body.removeChild(el);
    history.replaceState = origReplace;
  });

  it('does nothing when element not found', () => {
    const replaceStateMock = jest.fn();
    const origReplace = history.replaceState;
    history.replaceState = replaceStateMock;

    scrollToHeading('nonexistent-id');

    expect(replaceStateMock).not.toHaveBeenCalled();

    history.replaceState = origReplace;
  });
});

describe('handleAnchorClick', () => {
  it('prevents default and scrolls for # links', () => {
    const scrollMock = jest.fn();
    const replaceStateMock = jest.fn();
    const origReplace = history.replaceState;
    history.replaceState = replaceStateMock;

    const el = document.createElement('div');
    el.id = 'section';
    el.scrollIntoView = scrollMock;
    document.body.appendChild(el);

    const event = {
      currentTarget: { getAttribute: () => '#section' },
      preventDefault: jest.fn(),
    } as unknown as React.MouseEvent<HTMLAnchorElement>;

    handleAnchorClick(event);

    expect(event.preventDefault).toHaveBeenCalled();
    expect(scrollMock).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });

    document.body.removeChild(el);
    history.replaceState = origReplace;
  });

  it('does nothing for non-anchor links', () => {
    const event = {
      currentTarget: { getAttribute: () => 'https://example.com' },
      preventDefault: jest.fn(),
    } as unknown as React.MouseEvent<HTMLAnchorElement>;

    handleAnchorClick(event);

    expect(event.preventDefault).not.toHaveBeenCalled();
  });

  it('does nothing when href is null', () => {
    const event = {
      currentTarget: { getAttribute: () => null },
      preventDefault: jest.fn(),
    } as unknown as React.MouseEvent<HTMLAnchorElement>;

    handleAnchorClick(event);

    expect(event.preventDefault).not.toHaveBeenCalled();
  });
});
