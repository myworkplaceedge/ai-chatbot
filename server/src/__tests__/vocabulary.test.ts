import { describe, it, expect } from "vitest";
import {
  extractVocabulary,
  findGlossarySection,
  parseEntryLine,
} from "../lib/vocabulary";

const TARA_GLOSSARY_SAMPLE = `
Some lesson content here.

Glossary:

● Tight on time: I don't have enough time available.
● Drop from my plate: Remove a responsibility.
● Offline: Outside this meeting or conversation.
● Bandwidth: The time, energy, or mental capacity someone has available to take on more work.
● Stretched too thin: Having too many responsibilities or tasks, making it hard to do any of them well

7. References (APA format)

Gallup. (2020, March 13). Employee burnout.
`;

describe("findGlossarySection", () => {
  it("extracts glossary content between header and references", () => {
    const block = findGlossarySection(TARA_GLOSSARY_SAMPLE);
    expect(block).not.toBeNull();
    expect(block!).toContain("Tight on time");
    expect(block!).toContain("Bandwidth");
    expect(block!).not.toContain("Gallup");
  });

  it("returns null when no glossary header is present", () => {
    const block = findGlossarySection("Just regular lesson content with no glossary anywhere.");
    expect(block).toBeNull();
  });

  it("handles empty input", () => {
    expect(findGlossarySection("")).toBeNull();
  });

  it("stops at facilitator notes section", () => {
    const text = `Glossary:\n\n● Term: Definition.\n\nFacilitator Notes\n\nDo not include this.`;
    const block = findGlossarySection(text);
    expect(block).toContain("Term: Definition");
    expect(block).not.toContain("Do not include");
  });
});

describe("parseEntryLine", () => {
  it("parses a standard 'Term: Definition' bullet", () => {
    const entry = parseEntryLine("● Bandwidth: The time and energy available.");
    expect(entry).toEqual({
      term: "Bandwidth",
      definition: "The time and energy available.",
    });
  });

  it("parses a hyphen-prefixed bullet", () => {
    const entry = parseEntryLine("- Offline: Outside this meeting.");
    expect(entry).toEqual({
      term: "Offline",
      definition: "Outside this meeting.",
    });
  });

  it("parses an em-dash separator", () => {
    const entry = parseEntryLine("● Juggling — Managing multiple tasks at once.");
    expect(entry?.term).toBe("Juggling");
    expect(entry?.definition).toBe("Managing multiple tasks at once.");
  });

  it("captures an example clause when present", () => {
    const entry = parseEntryLine(
      "● Push back: To negotiate a request. Example: I had to push back on the deadline.",
    );
    expect(entry?.term).toBe("Push back");
    expect(entry?.definition).toBe("To negotiate a request");
    expect(entry?.example).toBe("I had to push back on the deadline.");
  });

  it("returns null for lines without a separator", () => {
    expect(parseEntryLine("● Just some bullet text with no colon")).toBeNull();
  });

  it("returns null for empty or whitespace-only lines", () => {
    expect(parseEntryLine("")).toBeNull();
    expect(parseEntryLine("   ")).toBeNull();
    expect(parseEntryLine("●")).toBeNull();
  });

  it("rejects entries where the term portion is excessively long", () => {
    const longTerm = "x".repeat(120);
    expect(parseEntryLine(`● ${longTerm}: definition`)).toBeNull();
  });
});

describe("extractVocabulary", () => {
  it("extracts a full glossary into structured entries", () => {
    const entries = extractVocabulary(TARA_GLOSSARY_SAMPLE);
    expect(entries.length).toBeGreaterThanOrEqual(5);
    const terms = entries.map((e) => e.term);
    expect(terms).toContain("Tight on time");
    expect(terms).toContain("Bandwidth");
    expect(terms).toContain("Stretched too thin");
  });

  it("returns an empty array when no glossary is present", () => {
    expect(extractVocabulary("Plain lesson without a glossary section.")).toEqual([]);
  });

  it("returns an empty array for empty content", () => {
    expect(extractVocabulary("")).toEqual([]);
  });

  it("deduplicates entries by term (case-insensitive)", () => {
    const text = `Glossary:\n● Term: First definition.\n● term: Second definition.`;
    const entries = extractVocabulary(text);
    expect(entries.length).toBe(1);
    expect(entries[0].definition).toBe("First definition.");
  });

  it("handles inline-bullet content (multiple entries on one line)", () => {
    // Mammoth sometimes collapses bullets onto the same wrapped line.
    const text = `Glossary:\n● Alpha: first ● Beta: second ● Gamma: third\n\nReferences\n`;
    const entries = extractVocabulary(text);
    const terms = entries.map((e) => e.term);
    expect(terms).toContain("Alpha");
    expect(terms).toContain("Beta");
    expect(terms).toContain("Gamma");
  });

  it("ignores reference-style URLs after the glossary block", () => {
    const text = `Glossary:\n● Bandwidth: capacity.\n\nReferences\n● https://example.com: a link\n`;
    const entries = extractVocabulary(text);
    expect(entries).toHaveLength(1);
    expect(entries[0].term).toBe("Bandwidth");
  });
});
