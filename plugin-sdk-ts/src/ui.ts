/**
 * UI Module — Declarative UI block builders for CogniaLauncher plugins.
 *
 * Plugins with `ui_mode = "declarative"` return JSON matching these types.
 *
 * @example
 * ```typescript
 * import { cognia } from '@cognia/plugin-sdk';
 *
 * function my_dashboard(): number {
 *   const blocks = [
 *     cognia.ui.heading('Dashboard', 1),
 *     cognia.ui.text('System status', 'muted'),
 *     cognia.ui.divider(),
 *     cognia.ui.table(['Env', 'Version'], [['Node', '20.0'], ['Python', '3.12']]),
 *     cognia.ui.actions([cognia.ui.button('refresh', 'Refresh')]),
 *   ];
 *   Host.outputString(cognia.ui.render(blocks));
 *   return 0;
 * }
 * ```
 */

// ============================================================================
// Block Types
// ============================================================================

export interface UiTextBlock {
  type: 'text';
  content: string;
  variant?: string;
}

export interface UiHeadingBlock {
  type: 'heading';
  content: string;
  level?: number;
}

export interface UiMarkdownBlock {
  type: 'markdown';
  content: string;
}

export interface UiDividerBlock {
  type: 'divider';
}

export interface UiAlertBlock {
  type: 'alert';
  title?: string;
  message: string;
  variant?: string;
}

export interface UiBadgeBlock {
  type: 'badge';
  label: string;
  variant?: string;
}

export interface UiProgressBlock {
  type: 'progress';
  value: number;
  max?: number;
  label?: string;
}

export interface UiImageBlock {
  type: 'image';
  src: string;
  alt?: string;
  width?: number;
  height?: number;
}

export interface UiCodeBlock {
  type: 'code';
  code: string;
  language?: string;
}

export interface UiTableBlock {
  type: 'table';
  headers: string[];
  rows: string[][];
}

export interface UiKeyValueBlock {
  type: 'key-value';
  items: { key: string; value: string }[];
}

export interface UiFormBlock {
  type: 'form';
  id: string;
  fields: FormField[];
  submitLabel?: string;
}

export type FormField =
  | { type: 'input'; id: string; label: string; placeholder?: string; defaultValue?: string; required?: boolean }
  | { type: 'textarea'; id: string; label: string; placeholder?: string; rows?: number }
  | { type: 'select'; id: string; label: string; options: { label: string; value: string }[]; defaultValue?: string }
  | { type: 'checkbox'; id: string; label: string; defaultChecked?: boolean }
  | { type: 'slider'; id: string; label: string; min: number; max: number; step?: number; defaultValue?: number };

export interface UiActionsBlock {
  type: 'actions';
  buttons: ActionButton[];
}

export interface ActionButton {
  id: string;
  label: string;
  variant?: string;
  icon?: string;
}

export interface UiGroupBlock {
  type: 'group';
  direction?: string;
  gap?: number;
  children: UiBlock[];
}

export type UiBlock =
  | UiTextBlock | UiHeadingBlock | UiMarkdownBlock | UiDividerBlock
  | UiAlertBlock | UiBadgeBlock | UiProgressBlock | UiImageBlock
  | UiCodeBlock | UiTableBlock | UiKeyValueBlock
  | UiFormBlock | UiActionsBlock | UiGroupBlock;

// ============================================================================
// Action Payload (parsed from input when user interacts)
// ============================================================================

export interface UiAction {
  action: string;
  buttonId?: string;
  formId?: string;
  formData?: Record<string, unknown>;
  state?: Record<string, unknown>;
}

// ============================================================================
// Builder Functions
// ============================================================================

export function text(content: string, variant?: string): UiTextBlock {
  const block: UiTextBlock = { type: 'text', content };
  if (variant) block.variant = variant;
  return block;
}

export function heading(content: string, level?: number): UiHeadingBlock {
  const block: UiHeadingBlock = { type: 'heading', content };
  if (level) block.level = level;
  return block;
}

export function markdown(content: string): UiMarkdownBlock {
  return { type: 'markdown', content };
}

export function divider(): UiDividerBlock {
  return { type: 'divider' };
}

export function alert(message: string, title?: string, variant?: string): UiAlertBlock {
  const block: UiAlertBlock = { type: 'alert', message };
  if (title) block.title = title;
  if (variant) block.variant = variant;
  return block;
}

export function badge(label: string, variant?: string): UiBadgeBlock {
  const block: UiBadgeBlock = { type: 'badge', label };
  if (variant) block.variant = variant;
  return block;
}

export function progress(value: number, max?: number, label?: string): UiProgressBlock {
  const block: UiProgressBlock = { type: 'progress', value };
  if (max !== undefined) block.max = max;
  if (label) block.label = label;
  return block;
}

export function code(codeStr: string, language?: string): UiCodeBlock {
  const block: UiCodeBlock = { type: 'code', code: codeStr };
  if (language) block.language = language;
  return block;
}

export function table(headers: string[], rows: string[][]): UiTableBlock {
  return { type: 'table', headers, rows };
}

export function keyValue(items: [string, string][]): UiKeyValueBlock {
  return {
    type: 'key-value',
    items: items.map(([key, value]) => ({ key, value })),
  };
}

export function actions(buttons: ActionButton[]): UiActionsBlock {
  return { type: 'actions', buttons };
}

export function button(id: string, label: string, variant?: string, icon?: string): ActionButton {
  const btn: ActionButton = { id, label };
  if (variant) btn.variant = variant;
  if (icon) btn.icon = icon;
  return btn;
}

export function group(direction: string, children: UiBlock[], gap?: number): UiGroupBlock {
  const block: UiGroupBlock = { type: 'group', direction, children };
  if (gap !== undefined) block.gap = gap;
  return block;
}

// ============================================================================
// Render Functions
// ============================================================================

export function render(blocks: UiBlock[]): string {
  return JSON.stringify({ ui: blocks });
}

export function renderWithState(blocks: UiBlock[], state: Record<string, unknown>): string {
  return JSON.stringify({ ui: blocks, state });
}

export function parseAction(input: string): UiAction | null {
  try {
    return JSON.parse(input) as UiAction;
  } catch {
    return null;
  }
}
