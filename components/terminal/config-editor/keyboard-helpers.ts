export interface EditorSelectionResult {
  nextEnd: number;
  nextStart: number;
  nextValue: string;
}

export function applyTabIndent(
  currentValue: string,
  selectionStart: number,
  selectionEnd: number,
): EditorSelectionResult {
  const indent = '  ';
  const nextValue =
    currentValue.slice(0, selectionStart) + indent + currentValue.slice(selectionEnd);
  const caret = selectionStart + indent.length;
  return { nextValue, nextStart: caret, nextEnd: caret };
}

export function applyPairInsert(
  currentValue: string,
  selectionStart: number,
  selectionEnd: number,
  left: string,
  right: string,
): EditorSelectionResult {
  const selected = currentValue.slice(selectionStart, selectionEnd);
  const wrapped = `${left}${selected}${right}`;
  const nextValue =
    currentValue.slice(0, selectionStart) + wrapped + currentValue.slice(selectionEnd);
  const caret =
    selectionStart + left.length + (selectionStart === selectionEnd ? 0 : selected.length);
  return { nextValue, nextStart: caret, nextEnd: caret };
}

export const EDITOR_PAIR_MAP: Record<string, [string, string]> = {
  '(': ['(', ')'],
  '{': ['{', '}'],
  '[': ['[', ']'],
  '"': ['"', '"'],
  '\'': ['\'', '\''],
};
