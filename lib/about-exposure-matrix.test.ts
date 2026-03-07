import {
  ABOUT_COLLECTED_FIELD_PATHS,
  ABOUT_EXPOSURE_INDEX,
  ABOUT_EXPOSURE_MATRIX,
  getUnmappedAboutFields,
} from './about-exposure-matrix';

describe('about-exposure-matrix', () => {
  it('maps every collected About field to at least one surface', () => {
    expect(getUnmappedAboutFields()).toEqual([]);
  });

  it('keeps matrix and collected list in sync', () => {
    expect(Object.keys(ABOUT_EXPOSURE_INDEX).length).toBe(
      ABOUT_COLLECTED_FIELD_PATHS.length,
    );
  });

  it('requires explicit rationale for intentionally hidden fields', () => {
    for (const entry of ABOUT_EXPOSURE_MATRIX) {
      if (entry.surfaces.includes('intentional_hide')) {
        expect(entry.rationale?.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it('requires every matrix entry to expose at least one surface', () => {
    for (const entry of ABOUT_EXPOSURE_MATRIX) {
      expect(entry.surfaces.length).toBeGreaterThan(0);
    }
  });
});
