import {
  getAffectedSections,
  getSectionForConfigKey,
  pickSectionKeys,
} from './section-utils';

describe('section-utils provider mappings', () => {
  it('maps canonical provider keys to provider section', () => {
    expect(getSectionForConfigKey('providers.npm.enabled')).toBe('provider');
    expect(getSectionForConfigKey('providers.npm.priority')).toBe('provider');
  });

  it('includes canonical provider keys when picking provider section keys', () => {
    const source = {
      'providers.npm.enabled': 'true',
      'providers.npm.priority': '120',
      'network.timeout': '30',
    };

    expect(pickSectionKeys(source, 'provider')).toEqual([
      'providers.npm.enabled',
      'providers.npm.priority',
    ]);
  });

  it('reports provider section as affected for canonical provider keys', () => {
    expect(getAffectedSections(['providers.npm.enabled'])).toContain('provider');
  });
});
