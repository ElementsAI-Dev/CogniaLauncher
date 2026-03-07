import type { ToolDefinitionWithMeta } from '@/types/toolbox';
import type { PluginToolInfo } from '@/types/plugin';
import {
  DEFAULT_TOOL_CONTRACT_VERSION,
  type ToolCompatibility,
  type ToolContractMetadata,
} from '@/types/tool-contract';

const BUILTIN_COMPATIBILITY: ToolCompatibility = {
  compatible: true,
  reason: null,
  hostVersion: '',
  declaredContractVersion: DEFAULT_TOOL_CONTRACT_VERSION,
  supportedContractVersion: DEFAULT_TOOL_CONTRACT_VERSION,
  requiredHostRange: null,
  minHostVersion: null,
};

export function buildBuiltInToolContractMetadata(
  tool: ToolDefinitionWithMeta,
): ToolContractMetadata {
  return {
    contractVersion: DEFAULT_TOOL_CONTRACT_VERSION,
    origin: 'builtIn',
    capabilityDeclarations: [...(tool.capabilityDeclarations ?? [])],
  };
}

export function buildPluginToolContractMetadata(tool: PluginToolInfo): ToolContractMetadata {
  return {
    contractVersion: tool.contractVersion ?? DEFAULT_TOOL_CONTRACT_VERSION,
    origin: tool.origin ?? 'plugin',
    capabilityDeclarations: [...(tool.capabilityDeclarations ?? [])],
  };
}

export function buildBuiltInCompatibility(): ToolCompatibility {
  return BUILTIN_COMPATIBILITY;
}

export function buildPluginCompatibility(tool: PluginToolInfo): ToolCompatibility {
  return (
    tool.compatibility ?? {
      compatible: true,
      reason: null,
      hostVersion: '',
      declaredContractVersion: tool.contractVersion ?? DEFAULT_TOOL_CONTRACT_VERSION,
      supportedContractVersion: DEFAULT_TOOL_CONTRACT_VERSION,
      requiredHostRange: null,
      minHostVersion: null,
    }
  );
}
