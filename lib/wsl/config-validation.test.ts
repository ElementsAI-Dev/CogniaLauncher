import {
  hasWslConfigKey,
  normalizeWslCustomConfigInput,
  validateWslCustomConfigInput,
} from './config-validation';

describe('wsl config validation helpers', () => {
  it('normalizes section/key/value with trimming', () => {
    expect(
      normalizeWslCustomConfigInput({
        section: ' wsl2 ',
        key: ' memory ',
        value: ' 4GB ',
      }),
    ).toEqual({
      section: 'wsl2',
      key: 'memory',
      value: '4GB',
    });
  });

  it('detects duplicate keys in a section map', () => {
    expect(hasWslConfigKey({ memory: '4GB' }, 'memory')).toBe(true);
    expect(hasWslConfigKey({ memory: '4GB' }, 'processors')).toBe(false);
  });

  it('validates required fields and token format', () => {
    expect(validateWslCustomConfigInput({ section: '', key: 'memory', value: '4GB' })).toBe(
      'wsl.config.validation.sectionRequired',
    );
    expect(validateWslCustomConfigInput({ section: 'wsl2', key: '', value: '4GB' })).toBe(
      'wsl.config.validation.keyRequired',
    );
    expect(
      validateWslCustomConfigInput({ section: 'wsl2', key: 'bad key', value: '4GB' }),
    ).toBe('wsl.config.validation.invalidKey');
    expect(
      validateWslCustomConfigInput(
        { section: 'wsl2', key: 'memory', value: '' },
        { requireValue: true },
      ),
    ).toBe('wsl.config.validation.valueRequired');
  });

  it('validates duplicate keys when section entries are provided', () => {
    expect(
      validateWslCustomConfigInput(
        { section: 'wsl2', key: 'memory', value: '6GB' },
        {
          requireValue: true,
          existingEntries: { memory: '4GB' },
        },
      ),
    ).toBe('wsl.config.validation.duplicateKey');
  });

  it('returns null for valid custom add input', () => {
    expect(
      validateWslCustomConfigInput(
        { section: 'experimental', key: 'swapFile', value: 'C:\\temp\\swap.vhdx' },
        { requireValue: true, existingEntries: { memory: '4GB' } },
      ),
    ).toBeNull();
  });
});
