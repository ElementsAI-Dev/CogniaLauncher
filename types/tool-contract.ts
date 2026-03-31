export const DEFAULT_TOOL_CONTRACT_VERSION = '1.0.0' as const;

export type ToolOrigin = 'builtIn' | 'plugin';

export interface ToolContractMetadata {
  contractVersion: string;
  origin: ToolOrigin;
  capabilityDeclarations: string[];
}

export interface ToolCompatibility {
  compatible: boolean;
  reason: string | null;
  hostVersion: string;
  declaredContractVersion: string;
  supportedContractVersion: string;
  requiredHostRange: string | null;
  minHostVersion: string | null;
}

export type ToolLifecyclePhase =
  | 'idle'
  | 'prepare'
  | 'validate'
  | 'execute'
  | 'postProcess'
  | 'success'
  | 'cancelled'
  | 'failure';

export interface ToolLifecycleSnapshot {
  phase: ToolLifecyclePhase;
  updatedAt: number;
  message?: string;
}
