import type { ComponentType } from 'react';
import type {
  ShellType,
  TerminalConfigDiagnostic,
  TerminalEditorLanguage,
} from '@/types/tauri';

export interface TerminalConfigEditorSurfaceProps {
  value: string;
  language: TerminalEditorLanguage;
  diagnostics?: TerminalConfigDiagnostic[];
  onChange: (value: string) => void;
}

export type TerminalConfigEditorSurfaceComponent = ComponentType<TerminalConfigEditorSurfaceProps>;

export type TerminalConfigEditorView = 'editor' | 'diagnostics' | 'changes';

export interface TerminalConfigEditorProps extends TerminalConfigEditorSurfaceProps {
  baselineValue?: string | null;
  shellType?: ShellType | null;
  configPath?: string | null;
  snapshotPath?: string | null;
  fingerprint?: string | null;
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
