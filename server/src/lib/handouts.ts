/**
 * Handout discovery + per-session deduplication helpers (issue #37).
 *
 * Handouts are practice materials referenced inside lesson .docx files. We
 * extract them at upload time (so the chat path stays cheap) and store the
 * structured list as JSON on the Lesson row. The chat route then surfaces a
 * matching handout to the learner at most once per session per handout.
 */

export type Handout = {
  /** Human-readable name shown in the UI (e.g. "Feedback Practice Worksheet"). */
  title: string;
  /** Optional link/URL. If absent, the UI shows the title as a non-link tag. */
  url?: string;
};

/**
 * The marker the model never produces — the server appends it to the response
 * after the model returns. The frontend strips and renders it as a button.
 *
 * Format: `[HANDOUT] {"title":"...","url":"..."}`
 *
 * Keeping this server-appended (not model-emitted) means the LLM cannot
 * hallucinate handouts that don't exist in the lesson library.
 */
export const HANDOUT_MARKER = "[HANDOUT]";

const URL_REGEX = /https?:\/\/[^\s)\]<>"']+/i;

/**
 * Match lines that look like handout references inside extracted .docx text.
 *
 * Matches several common authoring patterns:
 *   - "Handout: Some Title"
 *   - "Handouts:" followed by a newline-delimited bullet list
 *   - "Practice handout — Some Title (https://...)"
 *   - "See the X handout: https://..."
 *
 * The parser is deliberately lenient — handout authoring conventions vary
 * across .docx files, so we'd rather over-extract candidates than miss them.
 * The chat dedup logic ensures we never show duplicates.
 */
export function parseHandoutsFromContent(content: string): Handout[] {
  if (!content || typeof content !== "string") return [];

  const handouts: Handout[] = [];
  const seenTitles = new Set<string>();

  const lines = content.split(/\r?\n/);

  // Pattern A: explicit "Handout: <title>" or "Handout — <title>" line
  const inlineHandout = /^\s*handouts?\s*[:\-—]\s*(.+?)\s*$/i;
  // Pattern B: "Handouts" header line followed by a bullet list
  const handoutsHeader = /^\s*handouts?\s*:?\s*$/i;
  const bulletLine = /^\s*(?:[-*•]|\d+[.)])\s+(.+?)\s*$/;
  // Pattern C: parenthesized handout mention "(see the X handout: URL)"
  const seeHandout = /(?:see|use|practice with)\s+(?:the\s+)?(.+?)\s+handout/i;

  let inHandoutsList = false;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line || !line.trim()) {
      // blank line ends a handouts bullet list
      inHandoutsList = false;
      continue;
    }

    if (handoutsHeader.test(line)) {
      inHandoutsList = true;
      continue;
    }

    const inlineMatch = line.match(inlineHandout);
    if (inlineMatch) {
      const candidate = extractTitleAndUrl(inlineMatch[1]);
      addCandidate(candidate, handouts, seenTitles);
      inHandoutsList = false;
      continue;
    }

    if (inHandoutsList) {
      const bulletMatch = line.match(bulletLine);
      if (bulletMatch) {
        const candidate = extractTitleAndUrl(bulletMatch[1]);
        addCandidate(candidate, handouts, seenTitles);
        continue;
      }
      // Non-bullet, non-blank line ends the handouts section.
      inHandoutsList = false;
    }

    const seeMatch = line.match(seeHandout);
    if (seeMatch) {
      const candidate = extractTitleAndUrl(`${seeMatch[1]} handout${restOfLine(line, seeMatch)}`);
      addCandidate(candidate, handouts, seenTitles);
    }
  }

  return handouts;
}

function restOfLine(line: string, match: RegExpMatchArray): string {
  const idx = match.index ?? -1;
  if (idx < 0) return "";
  const tail = line.slice(idx + match[0].length);
  // Pull a URL from the tail if present so callers can attach it.
  const u = tail.match(URL_REGEX);
  return u ? ` ${u[0]}` : "";
}

function extractTitleAndUrl(raw: string): Handout | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Pull the URL out (anywhere in the string), then clean the title.
  const urlMatch = trimmed.match(URL_REGEX);
  const url = urlMatch ? urlMatch[0].replace(/[.,;)\]]+$/, "") : undefined;

  // Defense-in-depth: even though URL_REGEX restricts to https?://, validate
  // the parsed URL's scheme explicitly. Drops URLs that would fail `new URL()`
  // (truncated, malformed) and any non-http/https schemes that slipped through
  // (shouldn't happen, but cheap to check). Keeps the handout title if present
  // so the learner still sees the reference even if the URL is invalid.
  let validatedUrl: string | undefined = undefined;
  if (url) {
    try {
      const parsedProtocol = new URL(url).protocol;
      if (parsedProtocol === "https:" || parsedProtocol === "http:") {
        validatedUrl = url;
      }
    } catch {
      validatedUrl = undefined;
    }
  }

  let title = trimmed;
  if (urlMatch) {
    title = title.replace(urlMatch[0], "").trim();
  }
  // Strip surrounding markdown/parentheses and trailing punctuation. The
  // closing-paren-only case can happen when the URL was inside `(...)` and the
  // url match ate the trailing `)` but left the leading `(`.
  title = title
    .replace(/^[\[(\s"'“”‘’*_-]+/, "")
    .replace(/[\])(\s"'“”‘’*_:.,;-]+$/, "")
    .trim();

  if (!title) {
    // No title text — fall back to the URL host as a label.
    if (validatedUrl) {
      try {
        const host = new URL(validatedUrl).hostname.replace(/^www\./, "");
        title = host;
      } catch {
        return null;
      }
    } else {
      return null;
    }
  }

  // Reject obvious non-titles — avoids matching "and" or single-letter words.
  if (title.length < 3) return null;

  return validatedUrl ? { title, url: validatedUrl } : { title };
}

function addCandidate(candidate: Handout | null, out: Handout[], seen: Set<string>) {
  if (!candidate) return;
  const key = candidate.title.toLowerCase();
  if (seen.has(key)) return;
  seen.add(key);
  out.push(candidate);
}

/**
 * Stable JSON encoding for storage on the Lesson row. Returns `null` when
 * there are no handouts so the column stays empty for lessons that don't have
 * any — keeps the DB clean and lets callers cheaply skip the parse on the
 * read path.
 */
export function encodeHandouts(handouts: Handout[]): string | null {
  if (!handouts || handouts.length === 0) return null;
  return JSON.stringify(handouts);
}

export function decodeHandouts(encoded: string | null | undefined): Handout[] {
  if (!encoded) return [];
  try {
    const parsed = JSON.parse(encoded);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((h): h is Handout => h && typeof h === "object" && typeof (h as Handout).title === "string")
      .map((h) => ({ title: h.title, ...(h.url ? { url: h.url } : {}) }));
  } catch {
    return [];
  }
}

/**
 * Pick the first handout from `candidates` whose title hasn't already been
 * suggested in this session. Returns `null` when every candidate has already
 * been shown — so the chat route can skip appending a marker.
 *
 * `alreadySuggestedTitles` is sourced from prior IntentLog rows and is matched
 * case-insensitively (the same comparison key used during extraction).
 */
export function pickHandoutToSuggest(
  candidates: Handout[],
  alreadySuggestedTitles: Iterable<string>,
): Handout | null {
  if (!candidates || candidates.length === 0) return null;
  const seen = new Set<string>();
  for (const t of alreadySuggestedTitles) {
    if (typeof t === "string") seen.add(t.toLowerCase());
  }
  for (const candidate of candidates) {
    if (!seen.has(candidate.title.toLowerCase())) return candidate;
  }
  return null;
}

/** Build the marker line the server appends to the assistant response. */
export function buildHandoutMarker(handout: Handout): string {
  // Only persist title + url so a malformed parse can never inject extra fields.
  const payload: Handout = handout.url ? { title: handout.title, url: handout.url } : { title: handout.title };
  return `${HANDOUT_MARKER} ${JSON.stringify(payload)}`;
}

/**
 * Encode a handout title into the `IntentLog.intent` column so we can detect
 * it in subsequent turns of the same session. We use a `handout_suggested:`
 * prefix — same shape as the existing `filtered:` and `escalated:` prefixes.
 */
export const HANDOUT_INTENT_PREFIX = "handout_suggested:";

export function buildHandoutIntent(handout: Handout): string {
  return `${HANDOUT_INTENT_PREFIX}${handout.title}`;
}

export function extractTitleFromHandoutIntent(intent: string): string | null {
  if (!intent.startsWith(HANDOUT_INTENT_PREFIX)) return null;
  return intent.slice(HANDOUT_INTENT_PREFIX.length);
}
