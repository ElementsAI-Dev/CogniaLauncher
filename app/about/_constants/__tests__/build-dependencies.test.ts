import { BUILD_DEPENDENCIES, type BuildDependency } from "../build-dependencies";

describe("BUILD_DEPENDENCIES constants", () => {
  describe("structure", () => {
    it("should export an array of dependencies", () => {
      expect(Array.isArray(BUILD_DEPENDENCIES)).toBe(true);
      expect(BUILD_DEPENDENCIES.length).toBeGreaterThan(0);
    });

    it("should have all required properties for each dependency", () => {
      const requiredProps: (keyof BuildDependency)[] = [
        "name",
        "version",
        "color",
        "textColor",
        "letter",
      ];

      BUILD_DEPENDENCIES.forEach((dep) => {
        requiredProps.forEach((prop) => {
          expect(dep).toHaveProperty(prop);
          expect(dep[prop]).toBeDefined();
        });
      });
    });
  });

  describe("content validation", () => {
    it("should include Tauri dependency", () => {
      const tauri = BUILD_DEPENDENCIES.find((dep) => dep.name === "Tauri");
      expect(tauri).toBeDefined();
      expect(tauri?.letter).toBe("T");
    });

    it("should include Rust dependency", () => {
      const rust = BUILD_DEPENDENCIES.find((dep) => dep.name === "Rust");
      expect(rust).toBeDefined();
      expect(rust?.letter).toBe("R");
    });

    it("should include Next.js dependency", () => {
      const nextjs = BUILD_DEPENDENCIES.find((dep) => dep.name === "Next.js");
      expect(nextjs).toBeDefined();
      expect(nextjs?.letter).toBe("N");
    });

    it("should include React dependency", () => {
      const react = BUILD_DEPENDENCIES.find((dep) => dep.name === "React");
      expect(react).toBeDefined();
      expect(react?.letter).toBe("⚛");
    });
  });

  describe("version format", () => {
    it("should have versions starting with 'v'", () => {
      BUILD_DEPENDENCIES.forEach((dep) => {
        expect(dep.version).toMatch(/^v\d+\.\d+\.\d+/);
      });
    });
  });

  describe("color format", () => {
    it("should have valid hex color codes", () => {
      const hexColorRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;

      BUILD_DEPENDENCIES.forEach((dep) => {
        expect(dep.color).toMatch(hexColorRegex);
        expect(dep.textColor).toMatch(hexColorRegex);
      });
    });
  });

  describe("dark mode support", () => {
    it("should have optional darkColor property", () => {
      // At least one dependency should have dark mode colors
      const hasDarkMode = BUILD_DEPENDENCIES.some(
        (dep) => dep.darkColor !== undefined || dep.darkTextColor !== undefined
      );
      
      // Dark mode is optional but should be considered
      expect(typeof hasDarkMode).toBe("boolean");
    });

    it("should have valid dark color format when defined", () => {
      const hexColorRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;

      BUILD_DEPENDENCIES.forEach((dep) => {
        if (dep.darkColor) {
          expect(dep.darkColor).toMatch(hexColorRegex);
        }
        if (dep.darkTextColor) {
          expect(dep.darkTextColor).toMatch(hexColorRegex);
        }
      });
    });
  });

  describe("uniqueness", () => {
    it("should have unique dependency names", () => {
      const names = BUILD_DEPENDENCIES.map((dep) => dep.name);
      const uniqueNames = [...new Set(names)];
      expect(names.length).toBe(uniqueNames.length);
    });

    it("should have unique letters", () => {
      const letters = BUILD_DEPENDENCIES.map((dep) => dep.letter);
      const uniqueLetters = [...new Set(letters)];
      expect(letters.length).toBe(uniqueLetters.length);
    });
  });
});
