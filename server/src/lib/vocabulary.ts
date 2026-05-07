/**
 * Vocabulary extraction from lesson content.
 *
 * Lesson .docx files (parsed via mammoth) commonly include a "Glossary" section
 * formatted as bulleted "Term: Definition" entries, sometimes with an optional
 * example sentence. This module locates that section and parses entries into a
 * structured list usable by the vocabulary PDF endpoint.
 */

export type VocabularyEntry = {
  term: string;
  definition: string;
  example?: string;
};

const BULLET_CHARS = /[•●◦⁃∙\-\*]/u;
// Match a line whose content (after optional numbering and trim) begins with
// the word "glossary". Use a non-newline whitespace class so we never bleed
// across into following lines (which would swallow the first entry).
const GLOSSARY_HEADER = /(?:^|\n)[ \t]*(?:\d+\.[ \t]*)?glossary[ \t]*[:\-]?[^\n]{0,80}\n/i;

/**
 * Locate the glossary section within free-form lesson text. Returns the
 * substring covering glossary content, or null if no glossary header is found.
 *
 * Heuristic: find the first "Glossary" header, then take everything until the
 * next obvious section break (References, Transcript, Facilitator Notes,
 * Appendix).
 */
export function findGlossarySection(content: string): string | null {
  if (!content) return null;
  const match = content.match(GLOSSARY_HEADER);
  if (!match || match.index === undefined) return null;

  const start = match.index + match[0].length;
  const rest = content.slice(start);

  const stopMarkers = [
    /\n\s*(\d+\.\s*)?references?\b/i,
    /\n\s*transcript\s*[\/:]/i,
    /\n\s*facilitator notes?\b/i,
    /\n\s*appendix\b/i,
  ];

  let stopIdx = rest.length;
  for (const re of stopMarkers) {
    const m = rest.match(re);
    if (m && m.index !== undefined && m.index < stopIdx) {
      stopIdx = m.index;
    }
  }

  return rest.slice(0, stopIdx).trim();
}

/**
 * Split a glossary block into raw entry lines. Bullet markers may be inline
 * (multiple entries on one wrapped line in the docx output), so we split on
 * the bullet character as well as on newlines.
 */
function splitEntries(block: string): string[] {
  const normalized = block
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n");

  const parts = normalized.split(/(?:^|\n|\s)(?=[•●◦⁃∙])/u);
  const expanded: string[] = [];
  for (const p of parts) {
    if (/^\s*[-*]\s+/.test(p)) {
      expanded.push(p);
    } else {
      const sub = p.split(/\n(?=\s*[-*]\s+)/);
      expanded.push(...sub);
    }
  }
  return expanded.map((s) => s.trim()).filter(Boolean);
}

function stripBullet(line: string): string {
  let out = line.trim();
  while (out.length > 0 && BULLET_CHARS.test(out[0])) {
    out = out.slice(1).trim();
  }
  return out;
}

/**
 * Parse a single entry line ("Term: Definition" or "Term — Definition") into a
 * structured entry. Returns null if no recognizable separator is present.
 */
export function parseEntryLine(line: string): VocabularyEntry | null {
  const cleaned = stripBullet(line).replace(/\s+/g, " ").trim();
  if (cleaned.length < 3) return null;

  // Prefer the first colon, em-dash, or en-dash as the term/definition split.
  const sepMatch = cleaned.match(/^(.{1,80}?)\s*[:—–]\s+(.+)$/);
  if (!sepMatch) return null;

  const term = sepMatch[1].trim().replace(/[.,;]+$/, "");
  const rest = sepMatch[2].trim();
  if (!term || !rest) return null;
  if (term.length > 80) return null;

  const exampleMatch = rest.match(/(?:^|\s)(?:e\.g\.|ex\.|example)[:\s]+(.+)$/i);
  if (exampleMatch && exampleMatch.index !== undefined) {
    const definition = rest.slice(0, exampleMatch.index).trim().replace(/[.,;]+$/, "");
    const example = exampleMatch[1].trim();
    if (definition) {
      return { term, definition, example };
    }
  }

  return { term, definition: rest };
}

/**
 * Extract a deduplicated list of vocabulary entries from raw lesson text.
 * Returns an empty array when no glossary section or recognizable entries exist.
 */
export function extractVocabulary(content: string): VocabularyEntry[] {
  const block = findGlossarySection(content);
  if (!block) return [];

  const lines = splitEntries(block);
  const entries: VocabularyEntry[] = [];
  const seen = new Set<string>();

  for (const line of lines) {
    const entry = parseEntryLine(line);
    if (!entry) continue;
    const key = entry.term.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    entries.push(entry);
  }

  return entries;
}
