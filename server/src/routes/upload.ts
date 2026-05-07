import { Router } from "express";
import multer from "multer";
import mammoth from "mammoth";
import { prisma } from "../lib/db";
import { encodeHandouts, parseHandoutsFromContent } from "../lib/handouts";
import { stripDesignerSections } from "../lib/lessonCleanup";
import { scrubLessonText, sanitizeFilename } from "../lib/sanitize";
import { invalidateLessons } from "../lib/lessonCache";

// D-08: Three-layer file validation.
// Layer 1 (fileFilter): MIME AND extension must both be correct — changed from
// the previous OR-logic that let an attacker bypass with either MIME or extension.
// Layer 2 (magic bytes): checked in the route handler after the buffer is
// available; fileFilter runs pre-buffer.
// Layer 3 (size cap): lowered from 25 MB to 10 MB — current lessons are well
// under 25 MB and a lower cap reduces zip-bomb attack surface.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    const mimeOk =
      file.mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    const extOk = file.originalname.toLowerCase().endsWith(".docx");
    cb(null, mimeOk && extOk);
  },
});

export const uploadRouter = Router();

uploadRouter.post("/", upload.single("file"), async (req, res) => {
  try {
    if (!req.file?.buffer) {
      res.status(400).json({ error: "Invalid file type" });
      return;
    }

    // D-08: Magic byte check. .docx files are ZIP archives — first 4 bytes
    // must be PK\x03\x04 (the ZIP local file header signature). A generic 400
    // message is returned — no hint about which validation layer rejected, to
    // avoid leaking information to attackers probing the upload surface.
    const magic = req.file.buffer.subarray(0, 4);
    const isZip =
      magic[0] === 0x50 && magic[1] === 0x4b && magic[2] === 0x03 && magic[3] === 0x04;
    if (!isZip) {
      res.status(400).json({ error: "Invalid file type" });
      return;
    }

    // D-09: Sanitize filename before persisting. Strips newlines (header
    // injection), backticks (markdown escape), bidi overrides, and markdown
    // structural characters. Empty fallback to "lesson.docx".
    const name = sanitizeFilename(req.file.originalname) || "lesson.docx";

    const { value: extractedText } = await mammoth.extractRawText({ buffer: req.file.buffer });

    // Strip internal authoring sections ("Instructions for the designer",
    // "Designer Prompt", "Add-on for Designers", etc.) so they never reach
    // the learner-facing AI grounding context. See lib/lessonCleanup.ts.
    const cleanedContent = stripDesignerSections(extractedText);

    // D-10: Strip prompt-injection control sequences + null/zero-width/bidi
    // chars + 2MB cap. Runs AFTER lessonCleanup so designer-section patterns
    // can be matched on the original (pre-scrub) text. This removes XML-style
    // sentinel tags an attacker might embed to escape the per-call UUID wrapper
    // in gemini.ts (e.g., `</lesson_content_UUID>SYSTEM OVERRIDE: ...`).
    const scrubbedContent = scrubLessonText(cleanedContent);

    // Parse handouts from the scrubbed content so an attacker cannot smuggle
    // a poisoned handout title via the same injection bypass. Note:
    // handouts.ts (Task 2 of this plan) also validates URL scheme as
    // defense-in-depth.
    const handouts = parseHandoutsFromContent(scrubbedContent);

    const lesson = await prisma.lesson.create({
      data: {
        name,
        content: scrubbedContent,
        handouts: encodeHandouts(handouts),
      },
    });

    // D-06: Invalidate lesson cache so the next chat request re-reads the
    // post-scrub content. Phase 1 ships a no-op stub; Phase 2 DATA-06 wires
    // the real cache clear + TTL reset behind the same export.
    invalidateLessons();

    res.status(201).json(lesson);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to process document";
    res.status(500).json({ error: message });
  }
});
