/**
 * Parses the sample doc and writes the deliverable output HTML to
 * `output/sample-article.html`. Runs through `tsx`:
 *   npm run export-sample
 */

import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { parseDoc } from "../lib/parser";
import { runChecks } from "../lib/checks";
import { DEFAULT_THRESHOLDS } from "../lib/types";

const SAMPLE_DOC_URL =
  "https://docs.google.com/document/d/1s0fZsDcXJtiwrqUT1fVInS6q1yCZwVKkyCEGcxUiIYY/edit";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function main() {
  const url = process.argv[2] ?? SAMPLE_DOC_URL;
  console.log(`Parsing: ${url}`);
  const article = await parseDoc(url);
  const thresholds = { ...DEFAULT_THRESHOLDS, productDomain: article.productDomainSuggestion ?? "" };
  const checks = runChecks(article, thresholds);

  const passCount = checks.filter((c) => c.severity === "pass").length;
  const warnCount = checks.filter((c) => c.severity === "warn").length;
  const failCount = checks.filter((c) => c.severity === "fail").length;

  const checksHtml = checks
    .map(
      (c) =>
        `<li class="check check-${c.severity}"><strong>${escapeHtml(c.label)}:</strong> ${escapeHtml(c.detail)}</li>`
    )
    .join("\n");

  const wrapped = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(article.articleTitle || "Article")}</title>
  <meta name="title" content="${escapeHtml(article.metaTitle)}">
  <meta name="description" content="${escapeHtml(article.metaDescription)}">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", sans-serif; max-width: 760px; margin: 2rem auto; padding: 0 1rem; line-height: 1.6; color: #1a1a1a; }
    header { border-bottom: 1px solid #e5e7eb; padding-bottom: 1rem; margin-bottom: 1.5rem; }
    .meta { font-size: 0.875rem; color: #6b7280; margin: 0.25rem 0; }
    .meta strong { color: #1a1a1a; }
    .checks { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 0.5rem; padding: 1rem; margin: 1.5rem 0; }
    .checks h2 { margin-top: 0; font-size: 1rem; }
    .checks ul { list-style: none; padding: 0; margin: 0; }
    .check { padding: 0.4rem 0; border-top: 1px solid #e5e7eb; font-size: 0.9rem; }
    .check:first-child { border-top: none; }
    .check-pass { color: #047857; }
    .check-warn { color: #b45309; }
    .check-fail { color: #b91c1c; }
    img { max-width: 100%; height: auto; border-radius: 0.5rem; }
    h1 { font-size: 2rem; }
    h2 { font-size: 1.4rem; margin-top: 2rem; }
    h3 { font-size: 1.15rem; margin-top: 1.5rem; }
    table { border-collapse: collapse; width: 100%; margin: 1rem 0; }
    td, th { border: 1px solid #e5e7eb; padding: 0.5rem; }
    a { color: #2563eb; }
  </style>
</head>
<body>
  <header>
    <p class="meta"><strong>Meta title:</strong> ${escapeHtml(article.metaTitle)}</p>
    <p class="meta"><strong>Meta description:</strong> ${escapeHtml(article.metaDescription)}</p>
    <p class="meta"><strong>Source:</strong> <a href="${escapeHtml(article.docUrl)}">${escapeHtml(article.docUrl)}</a></p>
  </header>

  <section class="checks">
    <h2>QC report — ${passCount} pass · ${warnCount} warn · ${failCount} fail</h2>
    <ul>
${checksHtml}
    </ul>
  </section>

  <article>
    <h1>${escapeHtml(article.articleTitle)}</h1>
    ${article.articleHtml}
  </article>
</body>
</html>
`;

  const outDir = join(process.cwd(), "output");
  await mkdir(outDir, { recursive: true });
  const outPath = join(outDir, "sample-article.html");
  await writeFile(outPath, wrapped, "utf8");

  // Also dump the structured data as JSON for the deliverable.
  const jsonPath = join(outDir, "sample-article.json");
  await writeFile(
    jsonPath,
    JSON.stringify({ article, checks }, null, 2),
    "utf8"
  );

  console.log(`Wrote ${outPath}`);
  console.log(`Wrote ${jsonPath}`);
  console.log(
    `Summary: ${article.images.length} images, ${article.links.length} links, ${article.wordCount} words.`
  );
  console.log(`Checks: ${passCount} pass, ${warnCount} warn, ${failCount} fail.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
