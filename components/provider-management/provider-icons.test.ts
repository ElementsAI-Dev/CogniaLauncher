import {
  CAPABILITY_COLORS,
  getCapabilityColor,
  getCapabilityLabel,
} from "./provider-icons";

describe("provider-icons", () => {
  describe("CAPABILITY_COLORS", () => {
    it("has entries for all known capabilities", () => {
      const expectedKeys = [
        "install",
        "uninstall",
        "search",
        "update",
        "list",
        "upgrade",
        "update_index",
        "version_switch",
        "multi_version",
        "lock_version",
        "rollback",
        "project_local",
      ];
      for (const key of expectedKeys) {
        expect(CAPABILITY_COLORS[key]).toBeDefined();
      }
    });

    it("values contain Tailwind CSS classes", () => {
      for (const value of Object.values(CAPABILITY_COLORS)) {
        expect(value).toMatch(/bg-/);
        expect(value).toMatch(/text-/);
      }
    });
  });

  describe("getCapabilityColor", () => {
    it("returns correct color for known capability", () => {
      expect(getCapabilityColor("install")).toBe(CAPABILITY_COLORS.install);
      expect(getCapabilityColor("uninstall")).toBe(CAPABILITY_COLORS.uninstall);
      expect(getCapabilityColor("search")).toBe(CAPABILITY_COLORS.search);
    });

    it("returns gray fallback for unknown capability", () => {
      const result = getCapabilityColor("unknown_capability");
      expect(result).toBe(
        "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
      );
    });

    it("returns gray fallback for empty string", () => {
      const result = getCapabilityColor("");
      expect(result).toBe(
        "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
      );
    });
  });

  describe("getCapabilityLabel", () => {
    it("returns translated label when translation exists", () => {
      const mockT = (key: string) => {
        if (key === "providers.capability.install") return "Install";
        return key;
      };
      expect(getCapabilityLabel("install", mockT)).toBe("Install");
    });

    it("falls back to formatted name when translation returns the key", () => {
      const mockT = (key: string) => key;
      expect(getCapabilityLabel("update_index", mockT)).toBe("update index");
    });

    it("replaces underscores with spaces in fallback", () => {
      const mockT = (key: string) => key;
      expect(getCapabilityLabel("multi_version", mockT)).toBe("multi version");
      expect(getCapabilityLabel("lock_version", mockT)).toBe("lock version");
      expect(getCapabilityLabel("project_local", mockT)).toBe("project local");
    });

    it("handles single-word capability without underscores", () => {
      const mockT = (key: string) => key;
      expect(getCapabilityLabel("install", mockT)).toBe("install");
    });
  });
});
