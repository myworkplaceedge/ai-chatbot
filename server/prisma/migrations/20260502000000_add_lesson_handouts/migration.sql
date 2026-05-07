-- Add `handouts` column to Lesson. Stores a JSON-encoded array of
-- { title, url? } objects parsed from the uploaded .docx. Nullable so
-- legacy rows without handouts stay clean.
ALTER TABLE "Lesson" ADD COLUMN "handouts" TEXT;
