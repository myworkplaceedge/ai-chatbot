/**
 * Lesson content cleanup (issue #41).
 *
 * Uploaded `.docx` lesson files are authored by instructional designers and
 * contain internal sections that were never meant to reach the learner — e.g.
 * "Instructions for the designer", "DESIGNER PROMPT", "Add-on for Designers".
 * These sections leak into the AI's grounding context (and potentially into
 * responses) when fed verbatim to Gemini.
 *
 * `stripDesignerSections` is a pure function that runs over the raw text from
 * `mammoth.extractRawText` at upload time and removes those internal blocks
 * while preserving facilitator + student content intact.
 *
 * Patterns stripped (block-level, line-anchored):
 *   - "Instructions for the designer[:|—|-]"
 *   - "Instructions to the designer..."
 *   - "Note(s) for designer(s)..."
 *   - "Note(s) to designer(s)..."
 *   - "For the designer..."
 *   - "Add-on for Designer(s)..."
 *   - "Designer Prompt..." / "DESIGNER PROMPT..."
 *   - "Designer Note(s)..." / "Designer Instructions..."
 *   - "[DESIGNER]" / "(DESIGNER)" prefixes
 *   - "Internal note(s):" / "Internal use only" / "Authoring note(s):"
 *
 * Block extent: the heading line and every following line up to (but not
 * including) the next recognized terminator — a blank line followed by a
 * heading-like label (e.g. `Facilitator Tip:`, `Learner Instructions:`,
 * `Cultural Note:`, any Title-Case-words ending in `:`), a markdown rule
 * (`---`, `—`, `***`), or end-of-document. Conservative on purpose: we'd
 * rather keep one extra paragraph than swallow facilitator content.
 *
 * Inline parenthetical asides like `(designer: ...)` / `[designer note: ...]`
 * are also stripped, since they're authoring artifacts.
 *
 * The function is idempotent — running it twice produces the same output as
 * running it once. When no designer content is detected, the input is
 * returned verbatim (no whitespace churn).
 */

const DESIGNER_HEADING_PATTERNS: RegExp[] = [
  // "Instructions for/to the designer..."
  /^\s*instructions?\s+(?:for|to)\s+(?:the\s+)?designers?\b.*$/i,
  // "Note(s) for/to designer(s)..."
  /^\s*notes?\s+(?:for|to)\s+(?:the\s+)?designers?\b.*$/i,
  // "For (the) designer(s):"
  /^\s*for\s+(?:the\s+)?designers?\s*[:\-—].*$/i,
  // "Add-on for Designer(s):" / "Addon for designers"
  /^\s*add[-\s]?on\s+for\s+designers?\b.*$/i,
  // "Designer Prompt:" / "DESIGNER PROMPT:" / "Designer Note:" / "Designer Notes:" / "Designer Instructions:"
  /^\s*designer['’]?s?\s+(?:prompt|notes?|instructions?|tips?)\b.*$/i,
  // Bracketed/parenthesized designer headers at line start: "[DESIGNER]" "(Designer)"
  /^\s*[\[(]\s*designers?\s*[\])]\s*[:\-—]?.*$/i,
  // "Internal note(s)/use/only:" — generic non-learner authoring sections
  /^\s*internal\s+(?:notes?|use|only)\b.*$/i,
  // "Authoring note(s):"
  /^\s*authoring\s+notes?\b.*$/i,
];

/**
 * Lines that should terminate a designer block when reached. We treat any
 * "Title Case Heading:" line as a potential next-section boundary, but the
 * named entries below are common authoring labels we want to be sure we
 * don't accidentally strip past.
 */
const KNOWN_LEARNER_OR_FACILITATOR_HEADINGS: RegExp[] = [
  /^\s*facilitator\b/i,
  /^\s*learner\b/i,
  /^\s*student\b/i,
  /^\s*activity\b/i,
  /^\s*reflection\s+prompt\b/i,
  /^\s*cultural\s+note\b/i,
  /^\s*power\s*&?\s*culture\s+note\b/i,
  /^\s*before\s+you\s+practi[sc]e\b/i,
  /^\s*guided\s+practice\b/i,
  /^\s*self[-\s]guided\b/i,
  /^\s*scenario\b/i,
  /^\s*key\s+takeaways?\b/i,
  /^\s*summary\b/i,
  /^\s*introduction\b/i,
  /^\s*objectives?\b/i,
  /^\s*lesson\s+(?:overview|outline|plan)\b/i,
  /^\s*purpose\b/i,
  /^\s*example\b/i,
  /^\s*sample\b/i,
  /^\s*try\s+this\b/i,
  /^\s*why\s+this\s+matters\b/i,
];

/** Generic "Title Case Words:" heading detector (e.g. "Cultural Note:"). */
const GENERIC_TITLECASE_HEADING = /^\s*[A-Z][A-Za-z][A-Za-z0-9 &/'’\-]{0,60}:\s*$/;

/** Markdown / typographic rule lines used as section dividers. */
const RULE_LINE = /^\s*(?:[-—–_*]\s*){1,}\s*$/;

function looksLikeDesignerHeading(line: string): boolean {
  for (const p of DESIGNER_HEADING_PATTERNS) {
    if (p.test(line)) return true;
  }
  return false;
}

function looksLikeNextSectionHeading(line: string): boolean {
  if (!line || !line.trim()) return false;
  for (const p of KNOWN_LEARNER_OR_FACILITATOR_HEADINGS) {
    if (p.test(line)) return true;
  }
  if (GENERIC_TITLECASE_HEADING.test(line)) return true;
  return false;
}

/**
 * Strip inline `(designer: ...)` / `[designer note: ...]` asides from a line.
 * Conservative — only matches when the parenthetical starts with the word
 * "designer" so we don't accidentally remove lesson content.
 */
function stripInlineDesignerAsides(line: string): string {
  return line
    .replace(/\s*\(\s*designer(?:[ '’]s)?\s*(?:notes?|prompts?|instructions?|tips?)?\s*[:\-—][^)]*\)/gi, "")
    .replace(/\s*\[\s*designer(?:[ '’]s)?\s*(?:notes?|prompts?|instructions?|tips?)?\s*[:\-—][^\]]*\]/gi, "");
}

/**
 * Per-file audit record produced by `cleanLessonContentWithAudit`. Used by
 * the batch cleanup pipeline (issue #42) so we can log exactly *what* was
 * stripped from each lesson without diffing the full text.
 */
export interface LessonCleanupAudit {
  /** Whether any change was made. False === true no-op (idempotent re-run). */
  changed: boolean;
  /** input.length - cleaned.length, in characters. >= 0. */
  bytesRemoved: number;
  /** Newline-count delta. >= 0. */
  linesRemoved: number;
  /** Distinct designer-heading lines that triggered a block strip. */
  designerHeadingsMatched: string[];
  /** Count of inline `(designer: ...)` / `[designer: ...]` asides removed. */
  inlineAsidesRemoved: number;
}

/**
 * Cleaning helper that returns both the cleaned text and a structured audit
 * record describing what was stripped. Built on top of the same
 * `stripDesignerSections` pipeline used at upload time so the batch
 * reprocess pipeline (issue #42) and the upload path share one source of
 * truth for *what* counts as designer content.
 *
 * Idempotent: when called on already-cleaned content the returned audit has
 * `changed=false` and zeroed counters.
 */
export function cleanLessonContentWithAudit(input: string): {
  cleaned: string;
  audit: LessonCleanupAudit;
} {
  const safe = typeof input === "string" ? input : "";
  const cleaned = stripDesignerSections(safe);

  if (cleaned === safe) {
    return {
      cleaned,
      audit: {
        changed: false,
        bytesRemoved: 0,
        linesRemoved: 0,
        designerHeadingsMatched: [],
        inlineAsidesRemoved: 0,
      },
    };
  }

  const inputLines = safe.split(/\r?\n/);
  const cleanedLines = cleaned.split(/\r?\n/);

  // Walk the input and surface every designer heading we *would* strip.
  // (Re-using `looksLikeDesignerHeading` keeps the audit honest — it
  // matches exactly what the stripper acts on.)
  const designerHeadings: string[] = [];
  for (const line of inputLines) {
    if (looksLikeDesignerHeading(line)) {
      designerHeadings.push(line.trim());
    }
  }

  // Count inline `(designer: ...)` / `[designer: ...]` asides by replaying
  // the inline-strip rule over each input line that was *not* itself a
  // designer-block heading (block strip would have removed those wholesale,
  // so attributing inline matches to them would double-count).
  let inlineAsides = 0;
  for (const line of inputLines) {
    if (looksLikeDesignerHeading(line)) continue;
    const stripped = stripInlineDesignerAsides(line);
    if (stripped !== line) inlineAsides += 1;
  }

  return {
    cleaned,
    audit: {
      changed: true,
      bytesRemoved: Math.max(0, safe.length - cleaned.length),
      linesRemoved: Math.max(0, inputLines.length - cleanedLines.length),
      designerHeadingsMatched: dedupe(designerHeadings),
      inlineAsidesRemoved: inlineAsides,
    },
  };
}

function dedupe<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

/**
 * Remove designer / internal-authoring sections from raw extracted lesson
 * text. Returns the cleaned text. Idempotent and safe on empty input.
 */
export function stripDesignerSections(input: string): string {
  if (!input || typeof input !== "string") return "";

  const lines = input.split(/\r?\n/);
  const out: string[] = [];
  let strippedSomething = false;

  let i = 0;
  while (i < lines.length) {
    const raw = lines[i];

    if (looksLikeDesignerHeading(raw)) {
      strippedSomething = true;
      // Skip from the heading line until we find a terminator. Terminators:
      //   1. End of document
      //   2. A markdown/typographic rule line (---, —, ***)
      //   3. A blank line followed by a recognized next-section heading
      // We deliberately require the blank-line + heading combo to avoid
      // eating soft line breaks within the designer block.
      let j = i + 1;
      while (j < lines.length) {
        const cur = lines[j];

        // Rule line on its own — consume it as the terminator.
        if (cur.trim().length > 0 && RULE_LINE.test(cur)) {
          j += 1;
          break;
        }

        // Blank line then next-section heading
        if (!cur.trim()) {
          // peek ahead past blanks
          let k = j + 1;
          while (k < lines.length && !lines[k].trim()) k += 1;
          if (k >= lines.length) {
            // trailing blanks then EOF — drop them with the block
            j = lines.length;
            break;
          }
          if (looksLikeNextSectionHeading(lines[k]) || looksLikeDesignerHeading(lines[k])) {
            // Stop *before* the blank so the next-section's leading blank is
            // preserved (keeps spacing tidy).
            break;
          }
        }
        j += 1;
      }
      i = j;
      continue;
    }

    // Non-heading line — keep, but strip inline designer asides.
    const stripped = stripInlineDesignerAsides(raw);
    if (stripped !== raw) strippedSomething = true;
    out.push(stripped);
    i += 1;
  }

  // If we didn't actually remove anything, return the input verbatim so the
  // function is a true no-op for clean lessons (no whitespace churn).
  if (!strippedSomething) return input;

  // Collapse runs of >2 blank lines that the strip may have produced.
  return collapseBlankRuns(out.join("\n"));
}

function collapseBlankRuns(text: string): string {
  const collapsed = text.replace(/\n{3,}/g, "\n\n");
  // Trim leading blanks but preserve trailing newline if present.
  const trailing = /\n+$/.test(text) ? "\n" : "";
  return collapsed.replace(/^\n+/, "").replace(/\n+$/, "") + trailing;
}
