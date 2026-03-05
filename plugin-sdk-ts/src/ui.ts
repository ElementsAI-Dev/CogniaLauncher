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
  | { type: 'number'; id: string; label: string; placeholder?: string; defaultValue?: number; min?: number; max?: number; step?: number; required?: boolean }
  | { type: 'password'; id: string; label: string; placeholder?: string; defaultValue?: string; required?: boolean }
  | { type: 'textarea'; id: string; label: string; placeholder?: string; rows?: number }
  | { type: 'select'; id: string; label: string; options: { label: string; value: string }[]; defaultValue?: string }
  | { type: 'radio-group'; id: string; label: string; options: { label: string; value: string }[]; defaultValue?: string; required?: boolean }
  | { type: 'switch'; id: string; label: string; defaultChecked?: boolean }
  | { type: 'date-time'; id: string; label: string; defaultValue?: string; min?: string; max?: string; required?: boolean }
  | { type: 'multi-select'; id: string; label: string; options: { label: string; value: string }[]; defaultValues?: string[]; required?: boolean }
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

export interface UiTabsBlock {
  type: 'tabs';
  tabs: { id: string; label: string; children: UiBlock[] }[];
  defaultTab?: string;
}

export interface UiAccordionBlock {
  type: 'accordion';
  items: { id: string; title: string; children: UiBlock[] }[];
  collapsible?: boolean;
}

export interface UiCopyButtonBlock {
  type: 'copy-button';
  content: string;
  label?: string;
}

export interface UiFileInputBlock {
  type: 'file-input';
  id: string;
  label: string;
  accept?: string;
  multiple?: boolean;
  includeDataUrl?: boolean;
}

export interface UiJsonViewBlock {
  type: 'json-view';
  data: unknown;
  label?: string;
  expanded?: boolean;
}

export interface UiDescriptionListBlock {
  type: 'description-list';
  items: { term: string; description: string }[];
}

export interface UiStatCardsBlock {
  type: 'stat-cards';
  stats: {
    id: string;
    label: string;
    value: string | number;
    helpText?: string;
    status?: 'default' | 'success' | 'warning' | 'error';
  }[];
}

export interface UiResultBlock {
  type: 'result';
  message: string;
  title?: string;
  details?: string;
  status?: 'info' | 'success' | 'warning' | 'error';
}

export type UiBlock =
  | UiTextBlock | UiHeadingBlock | UiMarkdownBlock | UiDividerBlock
  | UiAlertBlock | UiBadgeBlock | UiProgressBlock | UiImageBlock
  | UiCodeBlock | UiTableBlock | UiKeyValueBlock
  | UiFormBlock | UiActionsBlock | UiGroupBlock
  | UiTabsBlock | UiAccordionBlock | UiCopyButtonBlock | UiFileInputBlock
  | UiJsonViewBlock | UiDescriptionListBlock | UiStatCardsBlock | UiResultBlock;

// ============================================================================
// Action Payload (parsed from input when user interacts)
// ============================================================================

export interface UiAction {
  action: 'button_click' | 'form_submit' | 'file_selected' | 'tab_change' | string;
  version?: 1 | 2;
  sourceType?: string;
  sourceId?: string;
  buttonId?: string;
  formId?: string;
  formData?: Record<string, unknown>;
  formDataTypes?: Record<string, string>;
  fileInputId?: string;
  files?: { name: string; size: number; type: string; dataUrl?: string; lastModified?: number }[];
  tabId?: string;
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

export function form(
  id: string,
  fields: FormField[],
  submitLabel?: string,
): UiFormBlock {
  const block: UiFormBlock = { type: 'form', id, fields };
  if (submitLabel) block.submitLabel = submitLabel;
  return block;
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

export function tabs(
  tabItems: { id: string; label: string; children: UiBlock[] }[],
  defaultTab?: string,
): UiTabsBlock {
  const block: UiTabsBlock = { type: 'tabs', tabs: tabItems };
  if (defaultTab) block.defaultTab = defaultTab;
  return block;
}

export function accordion(
  items: { id: string; title: string; children: UiBlock[] }[],
  collapsible?: boolean,
): UiAccordionBlock {
  const block: UiAccordionBlock = { type: 'accordion', items };
  if (collapsible !== undefined) block.collapsible = collapsible;
  return block;
}

export function copyButton(content: string, label?: string): UiCopyButtonBlock {
  const block: UiCopyButtonBlock = { type: 'copy-button', content };
  if (label) block.label = label;
  return block;
}

export function fileInput(
  id: string,
  label: string,
  accept?: string,
  multiple?: boolean,
  includeDataUrl?: boolean,
): UiFileInputBlock {
  const block: UiFileInputBlock = { type: 'file-input', id, label };
  if (accept) block.accept = accept;
  if (multiple !== undefined) block.multiple = multiple;
  if (includeDataUrl !== undefined) block.includeDataUrl = includeDataUrl;
  return block;
}

export function jsonView(
  data: unknown,
  label?: string,
  expanded?: boolean,
): UiJsonViewBlock {
  const block: UiJsonViewBlock = { type: 'json-view', data };
  if (label) block.label = label;
  if (expanded !== undefined) block.expanded = expanded;
  return block;
}

export function descriptionList(
  items: { term: string; description: string }[],
): UiDescriptionListBlock {
  return { type: 'description-list', items };
}

export function statCards(
  stats: {
    id: string;
    label: string;
    value: string | number;
    helpText?: string;
    status?: 'default' | 'success' | 'warning' | 'error';
  }[],
): UiStatCardsBlock {
  return { type: 'stat-cards', stats };
}

export function result(
  message: string,
  status?: 'info' | 'success' | 'warning' | 'error',
  title?: string,
  details?: string,
): UiResultBlock {
  const block: UiResultBlock = { type: 'result', message };
  if (status) block.status = status;
  if (title) block.title = title;
  if (details) block.details = details;
  return block;
}

export function numberField(
  id: string,
  label: string,
  options?: {
    placeholder?: string;
    defaultValue?: number;
    min?: number;
    max?: number;
    step?: number;
    required?: boolean;
  },
): FormField {
  return { type: 'number', id, label, ...(options ?? {}) };
}

export function passwordField(
  id: string,
  label: string,
  options?: { placeholder?: string; defaultValue?: string; required?: boolean },
): FormField {
  return { type: 'password', id, label, ...(options ?? {}) };
}

export function radioGroupField(
  id: string,
  label: string,
  options: { label: string; value: string }[],
  defaultValue?: string,
  required?: boolean,
): FormField {
  return {
    type: 'radio-group',
    id,
    label,
    options,
    ...(defaultValue !== undefined ? { defaultValue } : {}),
    ...(required !== undefined ? { required } : {}),
  };
}

export function switchField(
  id: string,
  label: string,
  defaultChecked?: boolean,
): FormField {
  return {
    type: 'switch',
    id,
    label,
    ...(defaultChecked !== undefined ? { defaultChecked } : {}),
  };
}

export function dateTimeField(
  id: string,
  label: string,
  options?: { defaultValue?: string; min?: string; max?: string; required?: boolean },
): FormField {
  return { type: 'date-time', id, label, ...(options ?? {}) };
}

export function multiSelectField(
  id: string,
  label: string,
  options: { label: string; value: string }[],
  defaultValues?: string[],
  required?: boolean,
): FormField {
  return {
    type: 'multi-select',
    id,
    label,
    options,
    ...(defaultValues ? { defaultValues } : {}),
    ...(required !== undefined ? { required } : {}),
  };
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
