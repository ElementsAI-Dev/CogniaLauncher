import { isInputFocused } from './dom';

describe('isInputFocused', () => {
  afterEach(() => {
    (document.activeElement as HTMLElement)?.blur?.();
  });

  it('returns true when input is focused', () => {
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();
    expect(isInputFocused()).toBe(true);
    document.body.removeChild(input);
  });

  it('returns true when textarea is focused', () => {
    const textarea = document.createElement('textarea');
    document.body.appendChild(textarea);
    textarea.focus();
    expect(isInputFocused()).toBe(true);
    document.body.removeChild(textarea);
  });

  it('detects contentEditable via isContentEditable property', () => {
    // jsdom doesn't properly reflect contentEditable='true' as isContentEditable=true,
    // so we explicitly set the property on the mock element
    const div = document.createElement('div');
    Object.defineProperty(div, 'isContentEditable', { value: true, configurable: true });
    Object.defineProperty(document, 'activeElement', { value: div, configurable: true, writable: true });
    expect(isInputFocused()).toBeTruthy();
    // Restore
    Object.defineProperty(document, 'activeElement', { value: document.body, configurable: true, writable: true });
  });

  it('returns falsy when body is the activeElement', () => {
    // Blur everything - in jsdom, body becomes activeElement
    (document.activeElement as HTMLElement)?.blur?.();
    // body.isContentEditable is false and body tagName is not input/textarea
    const result = isInputFocused();
    expect(result).toBeFalsy();
  });

  it('returns false when activeElement is null', () => {
    // Simulate no activeElement by checking the function handles it
    const originalActiveElement = Object.getOwnPropertyDescriptor(document, 'activeElement');
    Object.defineProperty(document, 'activeElement', { value: null, configurable: true });
    expect(isInputFocused()).toBe(false);
    if (originalActiveElement) {
      Object.defineProperty(document, 'activeElement', originalActiveElement);
    }
  });
});
