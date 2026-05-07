/**
 * Renders a vocabulary list to a PDF buffer using pdfkit.
 *
 * Layout: title block with the lesson name, a short subtitle, then each entry
 * as a bold term followed by its definition. An optional example sentence is
 * rendered in italic when present.
 */
import PDFDocument from "pdfkit";
import type { VocabularyEntry } from "./vocabulary";

export type VocabularyPdfOptions = {
  lessonName: string;
  entries: VocabularyEntry[];
  generatedAt?: Date;
};

export function renderVocabularyPdf(opts: VocabularyPdfOptions): Promise<Buffer> {
  const { lessonName, entries } = opts;
  const generatedAt = opts.generatedAt ?? new Date();

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "LETTER",
        margins: { top: 64, bottom: 64, left: 64, right: 64 },
        info: {
          Title: `Vocabulary: ${lessonName}`,
          Subject: "Lesson vocabulary",
          Creator: "Workplace Edge AI Lesson Coach",
          Producer: "Workplace Edge AI Lesson Coach",
          CreationDate: generatedAt,
        },
      });

      const chunks: Buffer[] = [];
      doc.on("data", (chunk: Buffer) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", (err) => reject(err));

      // Header
      doc
        .fillColor("#1c2750")
        .font("Helvetica-Bold")
        .fontSize(20)
        .text("Lesson Vocabulary", { align: "left" });

      doc
        .moveDown(0.25)
        .fillColor("#3a4366")
        .font("Helvetica")
        .fontSize(12)
        .text(stripDocxExtension(lessonName));

      doc
        .moveDown(0.25)
        .fillColor("#7a849d")
        .fontSize(9)
        .text(`Generated ${generatedAt.toLocaleDateString()} - Workplace Edge`);

      // Divider
      const dividerY = doc.y + 8;
      doc
        .moveTo(doc.page.margins.left, dividerY)
        .lineTo(doc.page.width - doc.page.margins.right, dividerY)
        .strokeColor("#d6dbe7")
        .lineWidth(1)
        .stroke();
      doc.moveDown(1);

      if (entries.length === 0) {
        doc
          .fillColor("#3a4366")
          .font("Helvetica")
          .fontSize(11)
          .text(
            "No glossary terms were found in this lesson. If you expected vocabulary here, please contact the lesson author.",
          );
      } else {
        for (const entry of entries) {
          renderEntry(doc, entry);
        }
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

function renderEntry(doc: PDFKit.PDFDocument, entry: VocabularyEntry): void {
  // Page-break safety: keep the term + first line of its definition together.
  const minSpace = 60;
  if (doc.y + minSpace > doc.page.height - doc.page.margins.bottom) {
    doc.addPage();
  }

  doc
    .fillColor("#1c2750")
    .font("Helvetica-Bold")
    .fontSize(12)
    .text(entry.term, { continued: false });

  doc
    .fillColor("#222a44")
    .font("Helvetica")
    .fontSize(11)
    .text(entry.definition, { paragraphGap: 2 });

  if (entry.example) {
    doc
      .fillColor("#525a78")
      .font("Helvetica-Oblique")
      .fontSize(10)
      .text(`Example: ${entry.example}`);
  }

  doc.moveDown(0.6);
}

function stripDocxExtension(name: string): string {
  return name.replace(/\.docx$/i, "");
}
