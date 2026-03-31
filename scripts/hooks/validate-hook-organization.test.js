let fs;
let path;
let repoRoot;
let hookRoot;
const scanRoots = [
  "app",
  "components",
  "hooks",
  "lib",
  "types",
  "scripts",
  "package.json",
];

beforeAll(async () => {
  ({ default: fs } = await import("node:fs"));
  ({ default: path } = await import("node:path"));
  repoRoot = path.resolve(__dirname, "..", "..");
  hookRoot = path.join(repoRoot, "hooks");
});

function collectFiles(relativePath) {
  const absolutePath = path.join(repoRoot, relativePath);
  if (!fs.existsSync(absolutePath)) {
    return [];
  }

  const stats = fs.statSync(absolutePath);
  if (stats.isFile()) {
    return [absolutePath];
  }

  return fs.readdirSync(absolutePath, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(absolutePath, entry.name);
    if (entry.isDirectory()) {
      return collectFiles(path.relative(repoRoot, entryPath));
    }
    return [entryPath];
  });
}

describe("hook organization guard", () => {
  it("does not allow root-level hook implementation files", () => {
    const rootLevelHookImplementations = fs
      .readdirSync(hookRoot, { withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      .filter((name) => /^use-.*\.tsx?$/.test(name))
      .filter((name) => !/\.test\.tsx?$/.test(name));

    expect(rootLevelHookImplementations).toEqual([]);
  });

  it("does not allow flat hook import or file references", () => {
    const staleReferences = [];
    const matcher = /@\/hooks\/use-[\w-]+|(?:^|[("'`\s])hooks\/use-[\w.-]+/g;

    for (const scanRoot of scanRoots) {
      for (const filePath of collectFiles(scanRoot)) {
        const source = fs.readFileSync(filePath, "utf8");
        const matches = source.match(matcher);
        if (!matches) {
          continue;
        }

        staleReferences.push({
          file: path.relative(repoRoot, filePath),
          matches: Array.from(new Set(matches.map((value) => value.trim()))),
        });
      }
    }

    expect(staleReferences).toEqual([]);
  });
});
