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
import { wrapAsStandaloneHtml, escapeHtml } from "../lib/render";

const SAMPLE_DOC_URL =
  "https://docs.google.com/document/d/1s0fZsDcXJtiwrqUT1fVInS6q1yCZwVKkyCEGcxUiIYY/edit";

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

  // The script output is the deliverable HTML *plus* a QC report header
  // for the interview reviewer. The Download button in the dashboard
  // produces the same standalone document without the report. Both use
  // wrapAsStandaloneHtml so head/body markup never drifts between the two.
  const extra = `  <header style="border-bottom:1px solid #e5e7eb;padding-bottom:1rem;margin-bottom:1.5rem;">
    <p style="font-size:0.875rem;color:#6b7280;margin:0.25rem 0;"><strong>Meta title:</strong> ${escapeHtml(article.metaTitle)}</p>
    <p style="font-size:0.875rem;color:#6b7280;margin:0.25rem 0;"><strong>Meta description:</strong> ${escapeHtml(article.metaDescription)}</p>
    <p style="font-size:0.875rem;color:#6b7280;margin:0.25rem 0;"><strong>Source:</strong> <a href="${escapeHtml(article.docUrl)}">${escapeHtml(article.docUrl)}</a></p>
  </header>

  <section style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:0.5rem;padding:1rem;margin:1.5rem 0;">
    <h2 style="margin-top:0;font-size:1rem;">QC report — ${passCount} pass · ${warnCount} warn · ${failCount} fail</h2>
    <ul style="list-style:none;padding:0;margin:0;">
${checksHtml}
    </ul>
  </section>`;

  const wrapped = wrapAsStandaloneHtml(article, extra);

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
