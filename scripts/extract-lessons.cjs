#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const mammoth = require("../server/node_modules/mammoth");

const REPO = path.resolve(__dirname, "..");
const SRC = path.join(REPO, "resources");
const OUT = path.join(REPO, "resources-md");

const LESSONS = [
  { character: "Bodi",   name: "Feedback That Builds",      folder: "Bodi" },
  { character: "Cassy",  name: "Beyond the Breakroom",      folder: "Cassy" },
  { character: "Helen",  name: "Bridge Across Roles",       folder: "Helen/Bridge Across Roles" },
  { character: "Helen",  name: "Celebrate Small Wins",      folder: "Helen/Celebrate Small Wins" },
  { character: "Helen",  name: "Close the Loop",            folder: "Helen/Close the Loop" },
  { character: "Helen",  name: "Conflict Isn't a Threat",   folder: "Helen/Conflict isnt a Threat" },
  { character: "Helen",  name: "Culture in the Team",       folder: "Helen/Culture in the Team" },
  { character: "Helen",  name: "Did I Get It Right",        folder: "Helen/Did I get it Right_" },
  { character: "Helen",  name: "Signal Shared Ownership",   folder: "Helen/Signal Shared Ownership" },
  { character: "Helen",  name: "The Pause That Builds",     folder: "Helen/The Pause that Builds" },
  { character: "Helen",  name: "Trust in Translation (Helen folder)", folder: "Helen/Trust in Translation" },
  { character: "Liz",    name: "From Listener to Ally",     folder: "Liz/From Listener to Ally" },
  { character: "Liz",    name: "Tone Without Apology",      folder: "Liz/Tone Without Apology" },
  { character: "Liz",    name: "Trust in Translation",      folder: "Liz/Trust In Translation" },
  { character: "Nori",   name: "Emotions Are Data",         folder: "Nori/Emotions Are Data" },
  { character: "Nori",   name: "Everyday Interruptions",    folder: "Nori/Everyday Interruptions" },
  { character: "Nori",   name: "Presence in Motion",        folder: "Nori/Presence In Motion" },
  { character: "Shawna", name: "Read the Room",             folder: "Shawna/Read The Room" },
  { character: "Shawna", name: "Speak Less, Say More",      folder: "Shawna/Speak Less Say More" },
  { character: "Tara",   name: "Boundary Language",         folder: "Tara" },
];

const SKIP_DIRS = new Set([".DS_Store", "Originals", "Videos", "beyond-the-breakroom-scorm12-Gzs9Mvv9"]);
const SKIP_FILE_PREFIXES = ["Original-", "Copy of "];

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    if (entry.name === ".DS_Store") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walk(full));
    } else {
      out.push(full);
    }
  }
  return out;
}

function classify(filePath) {
  const lower = path.basename(filePath).toLowerCase();
  if (lower.includes("facilitator")) return { section: "Facilitator Notes", order: 30 };
  if (lower.includes("blueprint")) return { section: "Lesson Blueprint", order: 20 };
  if (lower.includes("podcast")) return { section: "Podcast Script", order: 60 };
  if (lower.includes("scenario") || lower.includes("branching")) return { section: "Scenarios", order: 40 };
  if (lower.includes("worksheet") || lower.includes("download") || lower.includes("downloadable") || lower.includes("activity") || lower.includes("stretch") || lower.includes("spark") || lower.includes("reflection") || lower.includes("phrase bank") || lower.includes("checklist") || lower.includes("planner") || lower.includes("answer key")) {
    return { section: "Activities & Downloadables", order: 50 };
  }
  if (lower.includes("glossary") || lower.includes("vocabulary") || lower.includes("true-false") || lower.includes("true_false")) return { section: "Glossary & Vocabulary", order: 70 };
  if (lower.includes("video") || lower.includes("script")) return { section: "Video Scripts", order: 80 };
  return { section: "Lesson Content", order: 10 };
}

function tidy(md) {
  return md
    // Mammoth escapes punctuation that markdown might interpret. Unescape it.
    .replace(/\\([\\`*_{}\[\]()#+\-.!?;:'"<>~|@$&^=,/])/g, "$1")
    // Convert __bold__ to **bold** for consistency
    .replace(/(^|[^_])__([^_\n][^_]*?)__(?!_)/g, "$1**$2**")
    // Trim trailing whitespace on every line
    .replace(/[ \t]+$/gm, "")
    // Collapse 3+ blank lines
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function extractDocx(filePath) {
  const r = await mammoth.convertToMarkdown({ path: filePath });
  return tidy(r.value);
}

function extractPdf(filePath) {
  const out = execFileSync("pdftotext", ["-layout", "-nopgbrk", filePath, "-"], { encoding: "utf8" });
  return out
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function relName(p) {
  return path.relative(SRC, p);
}

async function processLesson(lesson) {
  const folderAbs = path.join(SRC, lesson.folder);
  if (!fs.existsSync(folderAbs)) {
    console.warn(`  ! Missing folder: ${folderAbs}`);
    return null;
  }
  const allFiles = walk(folderAbs).filter(f => {
    const base = path.basename(f);
    if (SKIP_FILE_PREFIXES.some(p => base.startsWith(p))) return false;
    if (base === ".DS_Store") return false;
    const ext = path.extname(f).toLowerCase();
    return ext === ".docx" || ext === ".pdf";
  });

  // De-dupe: prefer .docx over identically-named .pdf
  const byStem = new Map();
  for (const f of allFiles) {
    const base = path.basename(f).toLowerCase();
    const stem = base.replace(/\.(docx|pdf)$/, "");
    const ext = path.extname(f).toLowerCase();
    const cur = byStem.get(stem);
    if (!cur) { byStem.set(stem, f); continue; }
    const curExt = path.extname(cur).toLowerCase();
    if (curExt === ".pdf" && ext === ".docx") byStem.set(stem, f);
  }
  const files = [...byStem.values()].sort();

  // Group by section
  const sections = new Map();
  for (const f of files) {
    const c = classify(f);
    let body = "";
    try {
      body = path.extname(f).toLowerCase() === ".docx" ? await extractDocx(f) : extractPdf(f);
    } catch (e) {
      body = `_(extraction failed: ${e.message})_`;
    }
    if (!body || body.length < 20) continue;
    const arr = sections.get(c.section) || [];
    arr.push({ file: f, body, order: c.order });
    sections.set(c.section, arr);
  }

  // Order sections by canonical order
  const SECTION_ORDER = [
    "Lesson Content",
    "Lesson Blueprint",
    "Facilitator Notes",
    "Scenarios",
    "Activities & Downloadables",
    "Podcast Script",
    "Glossary & Vocabulary",
    "Video Scripts",
  ];

  const md = [];
  md.push(`# ${lesson.name}`);
  md.push("");
  md.push(`> **Character:** ${lesson.character}  `);
  md.push(`> **Source folder:** \`resources/${lesson.folder}\``);
  md.push("");
  md.push("---");
  md.push("");

  // Build TOC of source files
  md.push("## Source files included");
  md.push("");
  for (const f of files) {
    md.push(`- \`${relName(f)}\``);
  }
  md.push("");
  md.push("---");
  md.push("");

  let extracted = 0;
  for (const section of SECTION_ORDER) {
    const items = sections.get(section);
    if (!items || items.length === 0) continue;
    md.push(`## ${section}`);
    md.push("");
    for (const it of items) {
      md.push(`### ${path.basename(it.file)}`);
      md.push("");
      md.push(it.body);
      md.push("");
      extracted++;
    }
    md.push("---");
    md.push("");
  }

  return { lesson, files, extracted, md: md.join("\n") };
}

function slug(s) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const indexLines = [
    "# Workplace Edge Lesson Library",
    "",
    "Cleaned, readable Markdown extracted from the originals in `resources/`.",
    "",
    "| Character | Lesson | File |",
    "|-----------|--------|------|",
  ];

  for (const lesson of LESSONS) {
    console.log(`Processing: ${lesson.character} / ${lesson.name}`);
    const result = await processLesson(lesson);
    if (!result) continue;
    const charDir = path.join(OUT, slug(lesson.character));
    fs.mkdirSync(charDir, { recursive: true });
    const filename = `${slug(lesson.name)}.md`;
    const outPath = path.join(charDir, filename);
    fs.writeFileSync(outPath, result.md, "utf8");
    console.log(`  -> ${path.relative(REPO, outPath)} (${result.extracted} sections, ${result.files.length} files)`);
    indexLines.push(`| ${lesson.character} | [${lesson.name}](${slug(lesson.character)}/${filename}) | \`resources/${lesson.folder}\` |`);
  }

  fs.writeFileSync(path.join(OUT, "README.md"), indexLines.join("\n") + "\n", "utf8");
  console.log("\nDone. See resources-md/README.md for the index.");
}

main().catch(e => { console.error(e); process.exit(1); });
