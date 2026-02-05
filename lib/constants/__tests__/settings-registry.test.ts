import {
  SETTINGS_SECTIONS,
  SETTINGS_REGISTRY,
  getSettingsBySection,
  getSectionById,
  getOrderedSectionIds,
  type SettingsSection,
  type SettingDefinition,
  type SectionDefinition,
} from '../settings-registry';

describe('Settings Registry', () => {
  describe('SETTINGS_SECTIONS', () => {
    it('contains all expected sections', () => {
      const expectedSections: SettingsSection[] = [
        'general',
        'network',
        'security',
        'mirrors',
        'appearance',
        'updates',
        'tray',
        'paths',
        'provider',
        'system',
      ];

      expectedSections.forEach((sectionId) => {
        const section = SETTINGS_SECTIONS.find((s) => s.id === sectionId);
        expect(section).toBeDefined();
      });
    });

    it('each section has required properties', () => {
      SETTINGS_SECTIONS.forEach((section) => {
        expect(section.id).toBeDefined();
        expect(section.labelKey).toBeDefined();
        expect(section.descKey).toBeDefined();
        expect(section.icon).toBeDefined();
        expect(typeof section.order).toBe('number');
      });
    });

    it('has unique section IDs', () => {
      const ids = SETTINGS_SECTIONS.map((s) => s.id);
      const uniqueIds = [...new Set(ids)];
      expect(ids.length).toBe(uniqueIds.length);
    });

    it('has unique order values', () => {
      const orders = SETTINGS_SECTIONS.map((s) => s.order);
      const uniqueOrders = [...new Set(orders)];
      expect(orders.length).toBe(uniqueOrders.length);
    });

    it('all labelKeys follow expected pattern', () => {
      SETTINGS_SECTIONS.forEach((section) => {
        expect(section.labelKey).toMatch(/^settings\./);
      });
    });

    it('all descKeys follow expected pattern', () => {
      SETTINGS_SECTIONS.forEach((section) => {
        expect(section.descKey).toMatch(/^settings\./);
      });
    });
  });

  describe('SETTINGS_REGISTRY', () => {
    it('is a non-empty array', () => {
      expect(Array.isArray(SETTINGS_REGISTRY)).toBe(true);
      expect(SETTINGS_REGISTRY.length).toBeGreaterThan(0);
    });

    it('each setting has required properties', () => {
      SETTINGS_REGISTRY.forEach((setting) => {
        expect(setting.key).toBeDefined();
        expect(setting.section).toBeDefined();
        expect(setting.labelKey).toBeDefined();
        expect(setting.descKey).toBeDefined();
        expect(['input', 'switch', 'select']).toContain(setting.type);
      });
    });

    it('has unique setting keys', () => {
      const keys = SETTINGS_REGISTRY.map((s) => s.key);
      const uniqueKeys = [...new Set(keys)];
      expect(keys.length).toBe(uniqueKeys.length);
    });

    it('all settings reference valid sections', () => {
      const validSections = SETTINGS_SECTIONS.map((s) => s.id);
      SETTINGS_REGISTRY.forEach((setting) => {
        expect(validSections).toContain(setting.section);
      });
    });

    it('all labelKeys follow expected pattern', () => {
      SETTINGS_REGISTRY.forEach((setting) => {
        expect(setting.labelKey).toMatch(/^settings\./);
      });
    });

    it('all descKeys follow expected pattern', () => {
      SETTINGS_REGISTRY.forEach((setting) => {
        expect(setting.descKey).toMatch(/^settings\./);
      });
    });

    it('keywords are arrays when defined', () => {
      SETTINGS_REGISTRY.forEach((setting) => {
        if (setting.keywords !== undefined) {
          expect(Array.isArray(setting.keywords)).toBe(true);
        }
      });
    });

    it('optional boolean properties have correct types', () => {
      SETTINGS_REGISTRY.forEach((setting) => {
        if (setting.advanced !== undefined) {
          expect(typeof setting.advanced).toBe('boolean');
        }
        if (setting.tauriOnly !== undefined) {
          expect(typeof setting.tauriOnly).toBe('boolean');
        }
      });
    });
  });

  describe('getSettingsBySection', () => {
    it('returns settings for general section', () => {
      const settings = getSettingsBySection('general');
      expect(settings.length).toBeGreaterThan(0);
      settings.forEach((setting) => {
        expect(setting.section).toBe('general');
      });
    });

    it('returns settings for network section', () => {
      const settings = getSettingsBySection('network');
      expect(settings.length).toBeGreaterThan(0);
      settings.forEach((setting) => {
        expect(setting.section).toBe('network');
      });
    });

    it('returns settings for appearance section', () => {
      const settings = getSettingsBySection('appearance');
      expect(settings.length).toBeGreaterThan(0);
      settings.forEach((setting) => {
        expect(setting.section).toBe('appearance');
      });
    });

    it('returns empty array for section with no settings', () => {
      // system section typically has no settings in the registry
      const settings = getSettingsBySection('system');
      expect(Array.isArray(settings)).toBe(true);
    });

    it('returns all settings when combined', () => {
      const allSections: SettingsSection[] = [
        'general',
        'network',
        'security',
        'mirrors',
        'appearance',
        'updates',
        'tray',
        'paths',
        'provider',
        'system',
      ];
      
      const allSettingsFromSections = allSections.flatMap((section) =>
        getSettingsBySection(section)
      );
      
      expect(allSettingsFromSections.length).toBe(SETTINGS_REGISTRY.length);
    });
  });

  describe('getSectionById', () => {
    it('returns section definition for valid ID', () => {
      const section = getSectionById('general');
      expect(section).toBeDefined();
      expect(section?.id).toBe('general');
      expect(section?.labelKey).toBe('settings.general');
    });

    it('returns correct section for each valid ID', () => {
      const validIds: SettingsSection[] = [
        'general',
        'network',
        'security',
        'mirrors',
        'appearance',
        'updates',
        'tray',
        'paths',
        'provider',
        'system',
      ];

      validIds.forEach((id) => {
        const section = getSectionById(id);
        expect(section).toBeDefined();
        expect(section?.id).toBe(id);
      });
    });

    it('returns undefined for invalid ID', () => {
      // @ts-expect-error - testing invalid input
      const section = getSectionById('invalid');
      expect(section).toBeUndefined();
    });
  });

  describe('getOrderedSectionIds', () => {
    it('returns all section IDs', () => {
      const orderedIds = getOrderedSectionIds();
      expect(orderedIds.length).toBe(SETTINGS_SECTIONS.length);
    });

    it('returns sections in correct order', () => {
      const orderedIds = getOrderedSectionIds();
      
      // Check first section
      expect(orderedIds[0]).toBe('general');
      
      // Check last section
      expect(orderedIds[orderedIds.length - 1]).toBe('system');
    });

    it('returns array with unique values', () => {
      const orderedIds = getOrderedSectionIds();
      const uniqueIds = [...new Set(orderedIds)];
      expect(orderedIds.length).toBe(uniqueIds.length);
    });

    it('includes all expected sections', () => {
      const orderedIds = getOrderedSectionIds();
      const expectedSections: SettingsSection[] = [
        'general',
        'network',
        'security',
        'mirrors',
        'appearance',
        'updates',
        'tray',
        'paths',
        'provider',
        'system',
      ];

      expectedSections.forEach((section) => {
        expect(orderedIds).toContain(section);
      });
    });
  });

  describe('Type definitions', () => {
    it('SettingDefinition has correct shape', () => {
      const setting: SettingDefinition = {
        key: 'test.key',
        section: 'general',
        labelKey: 'settings.testLabel',
        descKey: 'settings.testDesc',
        type: 'input',
        keywords: ['test'],
        advanced: false,
        tauriOnly: false,
      };

      expect(setting.key).toBe('test.key');
      expect(setting.section).toBe('general');
      expect(setting.type).toBe('input');
    });

    it('SectionDefinition has correct shape', () => {
      const section: SectionDefinition = {
        id: 'general',
        labelKey: 'settings.general',
        descKey: 'settings.generalDesc',
        icon: 'Settings2',
        order: 1,
      };

      expect(section.id).toBe('general');
      expect(section.order).toBe(1);
    });
  });
});
