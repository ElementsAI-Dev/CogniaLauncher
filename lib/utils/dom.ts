/**
 * DOM utility functions
 * Shared across components and hooks
 */

/** Check if an input element is currently focused */
export function isInputFocused(): boolean {
  const activeElement = document.activeElement;
  if (!activeElement) return false;
  const tagName = activeElement.tagName.toLowerCase();
  return (
    tagName === "input" ||
    tagName === "textarea" ||
    (activeElement as HTMLElement).isContentEditable
  );
}
