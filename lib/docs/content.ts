import fs from "fs";
import path from "path";
import { extractMarkdownHeadings } from "./headings";
import type { DocPageData } from "@/types/docs";

const DOCS_ROOT = path.join(process.cwd(), "docs");

export type DocLocale = "zh" | "en";

function getDocsDir(locale: DocLocale = "zh"): string {
  return path.join(DOCS_ROOT, locale);
}

export function resolveDocPath(
  slug?: string[],
  locale: DocLocale = "zh",
): string {
  const docsDir = getDocsDir(locale);
  if (!slug || slug.length === 0) {
    return path.join(docsDir, "index.md");
  }
  const direct = path.join(docsDir, ...slug) + ".md";
  if (fs.existsSync(direct)) {
    return direct;
  }
  const indexPath = path.join(docsDir, ...slug, "index.md");
  if (fs.existsSync(indexPath)) {
    return indexPath;
  }
  return direct;
}

export function getDocContent(
  slug?: string[],
  locale: DocLocale = "zh",
): string | null {
  const docsDir = getDocsDir(locale);
  if (!slug || slug.length === 0) {
    try {
      return fs.readFileSync(path.join(docsDir, "index.md"), "utf-8");
    } catch {
      return null;
    }
  }

  const directPath = path.join(docsDir, ...slug) + ".md";
  if (fs.existsSync(directPath)) {
    try {
      return fs.readFileSync(directPath, "utf-8");
    } catch {
      return null;
    }
  }

  try {
    return fs.readFileSync(path.join(docsDir, ...slug, "index.md"), "utf-8");
  } catch {
    return null;
  }
}

export function getDocContentBilingual(slug?: string[]): {
  zh: string | null;
  en: string | null;
} {
  return {
    zh: getDocContent(slug, "zh"),
    en: getDocContent(slug, "en"),
  };
}

function toRepoRelativePath(filePath: string): string {
  return path.relative(process.cwd(), filePath).replace(/\\/g, "/");
}

function getFileLastModified(filePath: string): string | null {
  try {
    return fs.statSync(filePath).mtime.toISOString();
  } catch {
    return null;
  }
}

export function getDocPageData(
  slug?: string[],
  locale: DocLocale = "zh",
): DocPageData | null {
  const content = getDocContent(slug, locale);
  if (!content) {
    return null;
  }

  const filePath = resolveDocPath(slug, locale);
  return {
    locale,
    content,
    sourcePath: toRepoRelativePath(filePath),
    lastModified: getFileLastModified(filePath),
  };
}

export function getDocPageDataBilingual(slug?: string[]): {
  zh: DocPageData | null;
  en: DocPageData | null;
} {
  return {
    zh: getDocPageData(slug, "zh"),
    en: getDocPageData(slug, "en"),
  };
}

export function getDocBasePath(
  slug?: string[],
  locale: DocLocale = "zh",
): string | undefined {
  if (!slug || slug.length === 0) return undefined;
  const docsDir = getDocsDir(locale);
  const filePath = resolveDocPath(slug, locale);
  const relative = path.relative(docsDir, filePath);
  const dir = path.dirname(relative).replace(/\\/g, "/");
  return dir === "." ? undefined : dir;
}

export interface DocSearchEntry {
  slug: string;
  pageSlug: string;
  anchorId: string;
  sectionTitle: string;
  locale: DocLocale;
  excerpt: string;
}

function extractExcerpt(content: string, maxLen = 200): string {
  const lines = content.split("\n");
  let inCode = false;
  const paragraphs: string[] = [];
  for (const line of lines) {
    if (line.startsWith("```")) {
      inCode = !inCode;
      continue;
    }
    if (inCode) continue;
    if (
      line.startsWith("#") ||
      line.startsWith("|") ||
      line.startsWith("---") ||
      line.startsWith("- ")
    )
      continue;
    const trimmed = line.trim();
    if (trimmed.length > 0) {
      paragraphs.push(trimmed);
      if (paragraphs.join(" ").length >= maxLen) break;
    }
  }
  const text = paragraphs.join(" ");
  return text.length > maxLen ? text.slice(0, maxLen) + "..." : text;
}

export function buildSearchIndex(): DocSearchEntry[] {
  const slugs = getAllDocSlugs();
  const entries: DocSearchEntry[] = [];

  function buildLocaleEntries(
    slug: string,
    content: string,
    locale: DocLocale,
  ): DocSearchEntry[] {
    const headings = extractMarkdownHeadings(content, {
      minLevel: 1,
      maxLevel: 4,
    });
    const excerpt = extractExcerpt(content);

    if (headings.length === 0) {
      return [
        {
          slug,
          pageSlug: slug,
          anchorId: "",
          sectionTitle: slug,
          locale,
          excerpt,
        },
      ];
    }

    return headings.map((heading) => ({
      slug,
      pageSlug: slug,
      anchorId: heading.id,
      sectionTitle: heading.text,
      locale,
      excerpt,
    }));
  }

  for (const slugArr of slugs) {
    const slug = slugArr.length === 0 ? "index" : slugArr.join("/");
    const zh = getDocContent(slugArr, "zh");
    const en = getDocContent(slugArr, "en");
    if (zh) {
      entries.push(...buildLocaleEntries(slug, zh, "zh"));
    }
    if (en) {
      entries.push(...buildLocaleEntries(slug, en, "en"));
    }
  }
  return entries;
}

export function getAllDocSlugs(): string[][] {
  const slugs: string[][] = [];
  const docsDir = getDocsDir("zh");

  function scanDir(dir: string, prefix: string[]) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        scanDir(path.join(dir, entry.name), [...prefix, entry.name]);
      } else if (entry.isFile() && entry.name.endsWith(".md")) {
        const name = entry.name.replace(/\.md$/, "");
        if (name === "index" && prefix.length === 0) {
          slugs.push([]);
        } else if (name === "index") {
          slugs.push(prefix);
        } else {
          slugs.push([...prefix, name]);
        }
      }
    }
  }

  scanDir(docsDir, []);
  return slugs;
}
