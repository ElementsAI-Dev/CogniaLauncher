import fs from "fs";
import path from "path";

function readMessages(locale: "en" | "zh") {
  return JSON.parse(
    fs.readFileSync(path.join(process.cwd(), "messages", `${locale}.json`), "utf8"),
  ) as Record<string, unknown>;
}

describe("dashboard preset copy", () => {
  it.each(["en", "zh"] as const)("includes homepage style preset strings in %s", (locale) => {
    const messages = readMessages(locale) as {
      dashboard?: {
        stylePresets?: Record<string, unknown>;
      };
    };

    expect(messages.dashboard?.stylePresets).toEqual(
      expect.objectContaining({
        currentLabel: expect.any(String),
        diverged: expect.any(String),
        customizeShortcut: expect.any(String),
        active: expect.any(String),
        apply: expect.any(String),
        restoreActive: expect.any(String),
        balancedWorkbench: expect.objectContaining({
          title: expect.any(String),
          description: expect.any(String),
        }),
        focusFlow: expect.objectContaining({
          title: expect.any(String),
          description: expect.any(String),
        }),
        analyticsDeck: expect.objectContaining({
          title: expect.any(String),
          description: expect.any(String),
        }),
        custom: expect.objectContaining({
          title: expect.any(String),
          description: expect.any(String),
        }),
      }),
    );
  });
});
