/**
 * Declarative UI Block Types for CogniaLauncher Plugin System
 *
 * Plugins with ui_mode="declarative" return JSON matching these types.
 * The host renders them using native shadcn/ui React components.
 */

// ============================================================================
// Display Blocks
// ============================================================================

export interface UiTextBlock {
  type: 'text';
  content: string;
  variant?: 'default' | 'muted' | 'code';
}

export interface UiHeadingBlock {
  type: 'heading';
  content: string;
  level?: 1 | 2 | 3;
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
  variant?: 'default' | 'destructive';
}

export interface UiBadgeBlock {
  type: 'badge';
  label: string;
  variant?: 'default' | 'secondary' | 'outline' | 'destructive';
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

// ============================================================================
// Interactive Blocks
// ============================================================================

export interface UiFormBlock {
  type: 'form';
  id: string;
  fields: FormField[];
  submitLabel?: string;
}

export type FormField =
  | FormInputField
  | FormNumberField
  | FormPasswordField
  | FormTextareaField
  | FormSelectField
  | FormRadioGroupField
  | FormSwitchField
  | FormDateTimeField
  | FormMultiSelectField
  | FormCheckboxField
  | FormSliderField
  | FormArrayField;

export interface FormInputField {
  type: 'input';
  id: string;
  label: string;
  placeholder?: string;
  defaultValue?: string;
  required?: boolean;
}

export interface FormNumberField {
  type: 'number';
  id: string;
  label: string;
  placeholder?: string;
  defaultValue?: number;
  min?: number;
  max?: number;
  step?: number;
  required?: boolean;
}

export interface FormPasswordField {
  type: 'password';
  id: string;
  label: string;
  placeholder?: string;
  defaultValue?: string;
  required?: boolean;
}

export interface FormTextareaField {
  type: 'textarea';
  id: string;
  label: string;
  placeholder?: string;
  defaultValue?: string;
  rows?: number;
}

export interface FormSelectField {
  type: 'select';
  id: string;
  label: string;
  options: { label: string; value: string }[];
  defaultValue?: string;
}

export interface FormRadioGroupField {
  type: 'radio-group';
  id: string;
  label: string;
  options: { label: string; value: string }[];
  defaultValue?: string;
  required?: boolean;
}

export interface FormSwitchField {
  type: 'switch';
  id: string;
  label: string;
  defaultChecked?: boolean;
}

export interface FormDateTimeField {
  type: 'date-time';
  id: string;
  label: string;
  defaultValue?: string;
  min?: string;
  max?: string;
  required?: boolean;
}

export interface FormMultiSelectField {
  type: 'multi-select';
  id: string;
  label: string;
  options: { label: string; value: string }[];
  defaultValues?: string[];
  required?: boolean;
}

export interface FormCheckboxField {
  type: 'checkbox';
  id: string;
  label: string;
  defaultChecked?: boolean;
}

export interface FormSliderField {
  type: 'slider';
  id: string;
  label: string;
  min: number;
  max: number;
  step?: number;
  defaultValue?: number;
}

export interface FormArrayField {
  type: 'array';
  id: string;
  label: string;
  itemLabel?: string;
  placeholder?: string;
  defaultValues?: string[];
  minItems?: number;
  maxItems?: number;
}

export interface UiActionsBlock {
  type: 'actions';
  buttons: ActionButton[];
}

export interface ActionButton {
  id: string;
  label: string;
  variant?: 'default' | 'secondary' | 'outline' | 'destructive' | 'ghost';
  icon?: string;
}

// ============================================================================
// Extended Blocks
// ============================================================================

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

export interface UiConditionalGroupBlock {
  type: 'conditional-group';
  when: {
    path: string;
    equals?: unknown;
    notEquals?: unknown;
    exists?: boolean;
  };
  children: UiBlock[];
}

export interface UiStepperBlock {
  type: 'stepper';
  id: string;
  steps: {
    id: string;
    label: string;
    children: UiBlock[];
  }[];
  defaultStepId?: string;
}

export interface UiLogStreamBlock {
  type: 'log-stream';
  entries: {
    level?: 'debug' | 'info' | 'warning' | 'error';
    message: string;
    timestamp?: string;
  }[];
}

export interface UiArtifactActionsBlock {
  type: 'artifact-actions';
  artifacts: {
    id: string;
    label: string;
    href?: string;
    content?: string;
    action?: 'open' | 'copy';
  }[];
}

export type UiLogStreamEntry = UiLogStreamBlock['entries'][number];
export type UiArtifactAction = UiArtifactActionsBlock['artifacts'][number];

export interface PluginUiOutputChannels {
  structured?: UiBlock[];
  stream?: UiLogStreamEntry[];
  artifacts?: UiArtifactAction[];
  summary?:
    | string
    | {
      status?: 'info' | 'success' | 'warning' | 'error';
      title?: string;
      message: string;
      details?: string;
    };
}

// ============================================================================
// Layout Block
// ============================================================================

export interface UiGroupBlock {
  type: 'group';
  direction?: 'horizontal' | 'vertical';
  gap?: number;
  children: UiBlock[];
}

// ============================================================================
// Union Type
// ============================================================================

export type UiBlock =
  | UiTextBlock
  | UiHeadingBlock
  | UiMarkdownBlock
  | UiDividerBlock
  | UiAlertBlock
  | UiBadgeBlock
  | UiProgressBlock
  | UiImageBlock
  | UiCodeBlock
  | UiTableBlock
  | UiKeyValueBlock
  | UiFormBlock
  | UiActionsBlock
  | UiTabsBlock
  | UiAccordionBlock
  | UiCopyButtonBlock
  | UiFileInputBlock
  | UiJsonViewBlock
  | UiDescriptionListBlock
  | UiStatCardsBlock
  | UiResultBlock
  | UiConditionalGroupBlock
  | UiStepperBlock
  | UiLogStreamBlock
  | UiArtifactActionsBlock
  | UiGroupBlock;

// ============================================================================
// Response & Action Payloads
// ============================================================================

export interface PluginUiResponse {
  ui?: UiBlock[];
  state?: Record<string, unknown>;
  outputChannels?: PluginUiOutputChannels;
  stream?: UiLogStreamEntry[];
  artifacts?: UiArtifactAction[];
}

export interface PluginUiAction {
  action: 'button_click' | 'form_submit' | 'file_selected' | 'tab_change' | string;
  version?: 1 | 2;
  sourceType?: string;
  sourceId?: string;
  correlationId?: string;
  runtimeContext?: Record<string, unknown>;
  buttonId?: string;
  formId?: string;
  formData?: Record<string, unknown>;
  formDataTypes?: Record<string, string>;
  fileInputId?: string;
  files?: { name: string; size: number; type: string; dataUrl?: string; lastModified?: number }[];
  tabId?: string;
  state?: Record<string, unknown>;
}
