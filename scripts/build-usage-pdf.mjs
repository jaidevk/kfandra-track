#!/usr/bin/env node
/**
 * Regenerate docs/usage-guide.pdf from docs/usage-guide.md.
 *
 * The markdown file is the single source of truth — edit that, then run:
 *
 *   npm run docs:pdf
 *
 * Pipeline: markdown -> styled HTML (marked) -> PDF (headless Chrome's
 * --print-to-pdf). We use Chrome because it's already on most dev machines and
 * needs no LaTeX/wkhtmltopdf toolchain. Set CHROME_BIN to override the binary.
 */
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { marked } from "marked";

const here = dirname(fileURLToPath(import.meta.url));
const docs = join(here, "..", "docs");
const mdPath = join(docs, "usage-guide.md");
const pdfPath = join(docs, "usage-guide.pdf");

// Inline the club logo as a data URI so it travels with the temp HTML (no
// dependency on a file path resolving from Chrome's sandbox). It's placed with
// `position: fixed`, which headless Chrome repaints on every printed page.
const logoPath = join(here, "..", "public", "icons", "kfandra-logo.png");
const logoUri = `data:image/png;base64,${readFileSync(logoPath).toString("base64")}`;

const CHROME_CANDIDATES = [
  process.env.CHROME_BIN,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "google-chrome",
  "chromium",
  "chromium-browser",
].filter(Boolean);

function findChrome() {
  for (const bin of CHROME_CANDIDATES) {
    try {
      execFileSync(bin, ["--version"], { stdio: "ignore" });
      return bin;
    } catch {
      /* try next */
    }
  }
  throw new Error(
    "No Chrome/Chromium found. Set CHROME_BIN to a Chrome binary and retry.",
  );
}

const body = marked.parse(readFileSync(mdPath, "utf8"));

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>The Jacaranda App — Player Guide</title>
<style>
  @page { size: A4; margin: 14mm 16mm 16mm; }
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    color: #1f2937; line-height: 1.55; font-size: 11.5pt; margin: 0;
  }
  h1 {
    font-size: 22pt; color: #1d4ed8; margin: 0 0 2pt; letter-spacing: -0.5px;
  }
  h1 + p { color: #6b7280; margin-top: 0; }
  h2 {
    font-size: 14pt; color: #111827; margin: 22pt 0 6pt;
    padding-bottom: 4pt; border-bottom: 2px solid #e5e7eb; page-break-after: avoid;
  }
  h3 { font-size: 12pt; color: #1d4ed8; margin: 14pt 0 4pt; page-break-after: avoid; }
  p, li { margin: 4pt 0; }
  ul, ol { padding-left: 18pt; }
  hr { border: none; border-top: 1px solid #e5e7eb; margin: 16pt 0; }
  strong { color: #111827; }
  code {
    background: #f3f4f6; padding: 1px 5px; border-radius: 4px;
    font-family: "SF Mono", Menlo, Consolas, monospace; font-size: 10pt;
  }
  blockquote {
    margin: 8pt 0; padding: 6pt 12pt; border-left: 3px solid #3b82f6;
    background: #eff6ff; color: #1e3a8a; border-radius: 0 6px 6px 0;
  }
  blockquote p { margin: 2pt 0; }
  a { color: #1d4ed8; text-decoration: none; }
  h2, h3, li { page-break-inside: avoid; }
  /* Repeating letterhead. Wrapping the document in a table makes the THEAD
     reprint at the top of every printed page, with body content flowing below
     it -- so the club logo appears on each page and never overlaps text. */
  table.sheet { width: 100%; border-collapse: collapse; }
  thead { display: table-header-group; }
  .sheet-header th {
    padding: 0 0 7pt; border-bottom: 1px solid #e5e7eb;
  }
  .sheet-header img {
    height: 11mm; width: auto; display: block; margin-left: auto;
  }
  .sheet-body td { padding-top: 12pt; vertical-align: top; }
  /* The first heading sits right under the header rule -- trim its top gap. */
  .sheet-body td > :first-child { margin-top: 0; }
</style>
</head>
<body>
<table class="sheet">
  <thead class="sheet-header">
    <tr><th><img src="${logoUri}" alt="KFANDRA" /></th></tr>
  </thead>
  <tbody class="sheet-body">
    <tr><td>${body}</td></tr>
  </tbody>
</table>
</body>
</html>`;

const tmp = mkdtempSync(join(tmpdir(), "jacaranda-pdf-"));
const htmlPath = join(tmp, "usage-guide.html");
writeFileSync(htmlPath, html, "utf8");

try {
  const chrome = findChrome();
  execFileSync(
    chrome,
    [
      "--headless=new",
      "--disable-gpu",
      "--no-pdf-header-footer",
      `--print-to-pdf=${pdfPath}`,
      `file://${htmlPath}`,
    ],
    { stdio: "ignore" },
  );
  console.log(`Wrote ${pdfPath}`);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
