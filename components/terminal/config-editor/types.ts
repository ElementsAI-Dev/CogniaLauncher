import type { ComponentType } from 'react';
import type {
  ShellConfigEntries,
  ShellType,
  TerminalConfigEditorCapability,
  TerminalConfigDiagnostic,
  TerminalEditorLanguage,
} from '@/types/tauri';

export interface TerminalConfigEditorSurfaceProps {
  capability?: TerminalConfigEditorCapability | null;
  value: string;
  language: TerminalEditorLanguage;
  diagnostics?: TerminalConfigDiagnostic[];
  onChange: (value: string) => void;
}

export type TerminalConfigEditorSurfaceComponent = ComponentType<TerminalConfigEditorSurfaceProps>;

export type TerminalConfigEditorView = 'editor' | 'structured' | 'diagnostics' | 'changes';

export interface TerminalConfigEditorProps extends TerminalConfigEditorSurfaceProps {
  baselineValue?: string | null;
  shellType?: ShellType | null;
  configPath?: string | null;
  snapshotPath?: string | null;
  fingerprint?: string | null;
  capability?: TerminalConfigEditorCapability | null;
  structuredEntries?: ShellConfigEntries | null;
  structuredFallbackReason?: string | null;
  onStructuredEntriesChange?: (next: ShellConfigEntries) => void;
}

export interface TerminalConfigEditorToolbarProps {
  configPath?: string | null;
  fingerprint?: string | null;
  hasDiagnostics: boolean;
  hasPendingChanges: boolean;
  language: TerminalEditorLanguage;
  lineCount: number;
  shellType?: ShellType | null;
  snapshotPath?: string | null;
}

export interface TerminalConfigEditorDiagnosticsPanelProps {
  diagnostics: TerminalConfigDiagnostic[];
}

export interface TerminalConfigEditorDiffPreviewProps {
  baselineValue: string;
  value: string;
}

export interface TerminalConfigEditorWorkspaceProps extends TerminalConfigEditorProps {
  SurfaceComponent: TerminalConfigEditorSurfaceComponent;
}
