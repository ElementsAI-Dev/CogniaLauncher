import * as constantsIndex from './index';
import * as environmentsModule from './environments';

describe('constants/index', () => {
  it('re-exports the environments module surface', () => {
    expect(constantsIndex).toMatchObject(environmentsModule);
    expect(constantsIndex.LANGUAGES).toBe(environmentsModule.LANGUAGES);
    expect(constantsIndex.DEFAULT_PROVIDERS).toBe(environmentsModule.DEFAULT_PROVIDERS);
    expect(constantsIndex.DEFAULT_DETECTION_FILES).toBe(
      environmentsModule.DEFAULT_DETECTION_FILES,
    );
    expect(constantsIndex.VERSION_FILTERS).toBe(environmentsModule.VERSION_FILTERS);
    expect(constantsIndex.INSTALLATION_STEPS).toBe(
      environmentsModule.INSTALLATION_STEPS,
    );
  });
});
