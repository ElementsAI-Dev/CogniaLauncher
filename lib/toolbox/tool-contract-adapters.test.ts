import type { PluginToolInfo } from '@/types/plugin';
import type { ToolDefinitionWithMeta } from '@/types/toolbox';
import { DEFAULT_TOOL_CONTRACT_VERSION } from '@/types/tool-contract';
import {
  buildBuiltInCompatibility,
  buildBuiltInToolContractMetadata,
  buildPluginCompatibility,
  buildPluginToolContractMetadata,
} from './tool-contract-adapters';

function createBuiltInTool(overrides?: Partial<ToolDefinitionWithMeta>): ToolDefinitionWithMeta {
  return {
    id: 'json-formatter',
    nameKey: 'toolbox.json.name',
    descriptionKey: 'toolbox.json.description',
    icon: 'Braces',
    category: 'formatters',
    keywords: ['json'],
    component: async () => ({ default: () => null }),
    isNew: false,
    ...overrides,
  };
}

function createPluginTool(overrides?: Partial<PluginToolInfo>): PluginToolInfo {
  return {
    pluginId: 'plugin.demo',
    pluginName: 'Demo Plugin',
    toolId: 'tool.demo',
    nameEn: 'Demo',
    nameZh: null,
    descriptionEn: 'Demo tool',
    descriptionZh: null,
    category: 'developer',
    keywords: [],
    icon: 'Wrench',
    entry: 'tools/demo',
    uiMode: 'text',
    ...overrides,
  };
}

describe('tool-contract-adapters', () => {
  it('builds built-in tool metadata with default contract and copied capabilities', () => {
    const tool = createBuiltInTool({ capabilityDeclarations: ['settings.read'] });
    const metadata = buildBuiltInToolContractMetadata(tool);

    expect(metadata.contractVersion).toBe(DEFAULT_TOOL_CONTRACT_VERSION);
    expect(metadata.origin).toBe('builtIn');
    expect(metadata.capabilityDeclarations).toEqual(['settings.read']);
    expect(metadata.capabilityDeclarations).not.toBe(tool.capabilityDeclarations);
  });

  it('builds plugin metadata with plugin contract override', () => {
    const tool = createPluginTool({
      contractVersion: '2.1.0',
      origin: 'plugin',
      capabilityDeclarations: ['http.request', 'fs.read'],
    });

    const metadata = buildPluginToolContractMetadata(tool);
    expect(metadata.contractVersion).toBe('2.1.0');
    expect(metadata.origin).toBe('plugin');
    expect(metadata.capabilityDeclarations).toEqual(['http.request', 'fs.read']);
  });

  it('falls back to defaults for missing plugin metadata fields', () => {
    const metadata = buildPluginToolContractMetadata(createPluginTool());
    expect(metadata.contractVersion).toBe(DEFAULT_TOOL_CONTRACT_VERSION);
    expect(metadata.origin).toBe('plugin');
    expect(metadata.capabilityDeclarations).toEqual([]);
  });

  it('returns built-in compatibility baseline', () => {
    const compatibility = buildBuiltInCompatibility();
    expect(compatibility.compatible).toBe(true);
    expect(compatibility.reason).toBeNull();
    expect(compatibility.declaredContractVersion).toBe(DEFAULT_TOOL_CONTRACT_VERSION);
    expect(compatibility.supportedContractVersion).toBe(DEFAULT_TOOL_CONTRACT_VERSION);
  });

  it('returns plugin compatibility passthrough when provided', () => {
    const expected = {
      compatible: false,
      reason: 'Host too old',
      hostVersion: '0.1.0',
      declaredContractVersion: '2.0.0',
      supportedContractVersion: DEFAULT_TOOL_CONTRACT_VERSION,
      requiredHostRange: '>=0.2.0',
      minHostVersion: '0.2.0',
    };

    const compatibility = buildPluginCompatibility(createPluginTool({ compatibility: expected }));
    expect(compatibility).toEqual(expected);
  });

  it('builds default plugin compatibility when missing', () => {
    const compatibility = buildPluginCompatibility(createPluginTool({ contractVersion: '1.2.3' }));
    expect(compatibility.compatible).toBe(true);
    expect(compatibility.declaredContractVersion).toBe('1.2.3');
    expect(compatibility.supportedContractVersion).toBe(DEFAULT_TOOL_CONTRACT_VERSION);
    expect(compatibility.reason).toBeNull();
  });
});
