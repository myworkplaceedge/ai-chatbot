import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

// docs/SERVICES.md lives at the repo root. This test file is at
// server/src/__tests__/servicesDoc.test.ts, so the doc is three levels up.
const DOC_PATH = path.resolve(__dirname, "..", "..", "..", "docs", "SERVICES.md");

function readDoc(): string {
  return fs.readFileSync(DOC_PATH, "utf8");
}

/**
 * Extract markdown table blocks from the doc. A "table block" is a contiguous
 * run of lines that start with `|`, with a header row, a separator row, and
 * one or more data rows.
 */
function extractTables(md: string): string[][][] {
  const lines = md.split("\n");
  const tables: string[][][] = [];
  let current: string[] = [];

  const flush = () => {
    if (current.length >= 2) {
      // Drop the separator row (the |---|---| line) before exposing rows.
      const rows = current
        .filter((line, idx) => !(idx === 1 && /^\s*\|\s*[-:|\s]+\s*$/.test(line)))
        .map((line) =>
          line
            .trim()
            .replace(/^\|/, "")
            .replace(/\|$/, "")
            .split("|")
            .map((cell) => cell.trim()),
        );
      tables.push(rows);
    }
    current = [];
  };

  for (const line of lines) {
    if (line.trim().startsWith("|")) {
      current.push(line);
    } else if (current.length > 0) {
      flush();
    }
  }
  flush();
  return tables;
}

describe("docs/SERVICES.md", () => {
  it("exists at the repo root under docs/", () => {
    expect(fs.existsSync(DOC_PATH)).toBe(true);
  });

  it("is non-empty", () => {
    const md = readDoc();
    expect(md.trim().length).toBeGreaterThan(0);
  });

  it("has a top-level # heading", () => {
    const md = readDoc();
    expect(md).toMatch(/^#\s+\S+/m);
  });

  it("contains a 'Last updated' line with a YYYY-MM-DD date", () => {
    const md = readDoc();
    const match = md.match(/Last updated:?\s*\**\s*(\d{4}-\d{2}-\d{2})/i);
    expect(match, "Doc must include a 'Last updated' YYYY-MM-DD entry").not.toBeNull();
    // Sanity-check the date components are plausible.
    const [, dateStr] = match!;
    const parsed = new Date(dateStr + "T00:00:00Z");
    expect(Number.isNaN(parsed.getTime())).toBe(false);
    expect(parsed.getUTCFullYear()).toBeGreaterThanOrEqual(2024);
  });

  it("has at least one markdown table", () => {
    const tables = extractTables(readDoc());
    expect(tables.length).toBeGreaterThan(0);
  });

  it("has a header row covering Service, Purpose, Tier, Pricing, Owner, and Upgrade columns", () => {
    const tables = extractTables(readDoc());
    // The inventory table is the first (and primary) table in the doc.
    const header = tables[0][0].map((h) => h.toLowerCase());
    expect(header.some((h) => h.includes("service"))).toBe(true);
    expect(header.some((h) => h.includes("use") || h.includes("purpose"))).toBe(true);
    expect(header.some((h) => h.includes("tier") || h.includes("plan"))).toBe(true);
    expect(header.some((h) => h.includes("pricing") || h.includes("price"))).toBe(true);
    expect(header.some((h) => h.includes("owner") || h.includes("account") || h.includes("credentials"))).toBe(true);
    expect(header.some((h) => h.includes("upgrade"))).toBe(true);
  });

  it("inventory table rows have a column count consistent with the header", () => {
    const tables = extractTables(readDoc());
    const inventory = tables[0];
    const expectedCols = inventory[0].length;
    expect(expectedCols).toBeGreaterThanOrEqual(5);
    for (let i = 1; i < inventory.length; i++) {
      expect(
        inventory[i].length,
        `Row ${i} of the inventory table has ${inventory[i].length} cells, expected ${expectedCols}`,
      ).toBe(expectedCols);
    }
  });

  it("lists every paid service the code currently imports (Gemini, Turso, Vercel)", () => {
    const md = readDoc();
    // These are the paid third-party services the codebase actually depends on
    // (per @google/generative-ai, @prisma/adapter-libsql + TURSO_* env vars,
    // and vercel.json). If any of these go missing from the doc, fail loudly.
    expect(md).toMatch(/Gemini/);
    expect(md).toMatch(/Turso/);
    expect(md).toMatch(/Vercel/);
  });

  it("has a 'How to keep this current' (or equivalent) maintenance section", () => {
    const md = readDoc();
    expect(md).toMatch(/##\s+How to (keep this current|update)/i);
  });

  it("the maintenance section mentions .env.example and package.json as triggers", () => {
    const md = readDoc();
    const idx = md.search(/##\s+How to (keep this current|update)/i);
    expect(idx).toBeGreaterThan(-1);
    const tail = md.slice(idx);
    expect(tail).toMatch(/\.env\.example/);
    expect(tail).toMatch(/package\.json/);
  });

  it("every markdown link has a non-empty href", () => {
    const md = readDoc();
    const linkRe = /\[([^\]]+)\]\(([^)]*)\)/g;
    let match: RegExpExecArray | null;
    let linkCount = 0;
    while ((match = linkRe.exec(md)) !== null) {
      linkCount++;
      const [, text, href] = match;
      expect(href.trim().length, `Empty href for link with text '${text}'`).toBeGreaterThan(0);
    }
    // The doc should have several links (at least one pricing link per provider row).
    expect(linkCount).toBeGreaterThanOrEqual(5);
  });

  it("all http(s) links are well-formed URLs", () => {
    const md = readDoc();
    const linkRe = /\[[^\]]+\]\((https?:\/\/[^)]+)\)/g;
    let match: RegExpExecArray | null;
    while ((match = linkRe.exec(md)) !== null) {
      const href = match[1].trim();
      expect(() => new URL(href)).not.toThrow();
    }
  });

  it("references the env vars the server actually requires", () => {
    const md = readDoc();
    // These are the runtime secrets the server reads. If the doc forgets any,
    // operators won't know which provider needs which key.
    expect(md).toMatch(/GEMINI_API_KEY/);
    expect(md).toMatch(/TURSO_DATABASE_URL/);
    expect(md).toMatch(/TURSO_AUTH_TOKEN/);
  });

  it("has no obviously unclosed ``` code fences", () => {
    const md = readDoc();
    const fenceCount = (md.match(/^```/gm) || []).length;
    expect(fenceCount % 2).toBe(0);
  });

  it("does not leave a TODO/TBD/FIXME placeholder in the doc body", () => {
    const md = readDoc();
    // 'verify on provider dashboard' is intentional and used as a sentinel
    // for values that depend on the live account; that's fine. Generic
    // engineering placeholders are not.
    expect(md).not.toMatch(/\bTODO\b/);
    expect(md).not.toMatch(/\bTBD\b/);
    expect(md).not.toMatch(/\bFIXME\b/);
  });
});
