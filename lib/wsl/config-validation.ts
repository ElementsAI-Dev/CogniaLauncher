export interface WslCustomConfigInput {
  section: string;
  key: string;
  value: string;
}

export interface ValidateWslCustomConfigInputOptions {
  requireValue?: boolean;
  existingEntries?: Record<string, string> | null;
}

const WSL_CONFIG_TOKEN_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.-]*$/;

export function normalizeWslCustomConfigInput(
  input: Partial<WslCustomConfigInput>,
): WslCustomConfigInput {
  return {
    section: (input.section ?? '').trim(),
    key: (input.key ?? '').trim(),
    value: (input.value ?? '').trim(),
  };
}

export function hasWslConfigKey(
  entries: Record<string, string> | null | undefined,
  key: string,
): boolean {
  if (!entries) return false;
  return Object.prototype.hasOwnProperty.call(entries, key);
}

export function validateWslCustomConfigInput(
  input: WslCustomConfigInput,
  options: ValidateWslCustomConfigInputOptions = {},
): string | null {
  if (!input.section) return 'wsl.config.validation.sectionRequired';
  if (!WSL_CONFIG_TOKEN_PATTERN.test(input.section)) {
    return 'wsl.config.validation.invalidSection';
  }

  if (!input.key) return 'wsl.config.validation.keyRequired';
  if (!WSL_CONFIG_TOKEN_PATTERN.test(input.key)) {
    return 'wsl.config.validation.invalidKey';
  }

  if (options.requireValue && !input.value) {
    return 'wsl.config.validation.valueRequired';
  }

  if (hasWslConfigKey(options.existingEntries, input.key)) {
    return 'wsl.config.validation.duplicateKey';
  }

  return null;
}
