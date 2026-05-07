/**
 * scrubLessonText — strip prompt-injection control sequences from lesson text
 * before DB write (D-10, SEC-04).
 *
 * Removes XML-style sentinel tags an attacker might pre-author in a .docx body
 * to escape our `<lesson_content_${uuid}>` wrapper in gemini.ts. Also strips
 * null bytes, zero-width characters, and Unicode bidi overrides (which can be
 * used to visually obscure injection payloads).
 *
 * Caps at 2,000,000 chars (~2-4 MB UTF-16 in V8) per D-10. The cap is applied
 * AFTER scrubbing so the size reflects post-clean content.
 */
export function scrubLessonText(raw: string): string {
  return raw
    .replace(/<\/?(lesson_content|system|user|model|assistant)[^>]*>/gi, "")
    .replace(/\x00/g, "")
    .replace(/[​-‍﻿]/g, "")  // zero-width chars
    .replace(/[‪-‮⁦-⁩]/g, "") // bidi overrides
    .slice(0, 2_000_000);
}

/**
 * sanitizeFilename — normalize and strip dangerous chars from upload originalname
 * before persisting as Lesson.name and surfacing in the Gemini system prompt
 * header (D-09, SEC-04).
 *
 * NFC normalization collapses Unicode ambiguity (e.g., precomposed vs combining
 * accents). Stripped: newlines (header injection), backticks (markdown code
 * block escape), `#`/`*`/`-`/`>` (markdown structure markers), bidi overrides.
 *
 * Capped at 255 chars (typical filesystem max).
 */
export function sanitizeFilename(raw: string): string {
  return raw
    .normalize("NFC")
    .replace(/[\n\r]/g, "")
    .replace(/[`]/g, "")
    .replace(/[#*\->]/g, "")
    .replace(/[‪-‮⁦-⁩]/g, "")
    .trim()
    .slice(0, 255);
}
