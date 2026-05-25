import type { ParsedArticle } from './types'

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// WHY: Two things needed the standalone HTML wrapper — the export script that
// produces the deliverable file, and the Download button in the dashboard.
// Pulled the wrapping into one function so they can't drift apart. Also worth
// noting: the <title> tag uses the meta title (what shows in Google search),
// not the article title. I had those flipped originally; the editor caught
// it when opening the downloaded file.
/**
 * Wrap a parsed article's body fragment into a standalone HTML document
 * suitable for opening in a browser, archiving, or sharing with a client.
 *
 * NOT for sending to WordPress / Shopify — those APIs expect a body
 * fragment in their `content` / `body_html` field. Use `article.articleHtml`
 * directly for that.
 *
 * Pure string assembly with no Node-only deps so it's safe to import from
 * both server code (the export script) and client components (the Download
 * button in PublishBar).
 */
export function wrapAsStandaloneHtml(article: ParsedArticle, extraBodyHtml = ''): string {
  // For SEO, <title> is the meta title (what shows in the SERP / browser tab).
  // The article title lives in the body <h1>.
  const docTitle = article.metaTitle || article.articleTitle || 'Article'
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(docTitle)}</title>
  <meta name="description" content="${escapeHtml(article.metaDescription)}">
  <meta property="og:title" content="${escapeHtml(article.metaTitle)}">
  <meta property="og:description" content="${escapeHtml(article.metaDescription)}">
  <meta property="og:type" content="article">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", sans-serif; max-width: 760px; margin: 2rem auto; padding: 0 1rem; line-height: 1.6; color: #1a1a1a; }
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
${extraBodyHtml}
  <article>
    <h1>${escapeHtml(article.articleTitle)}</h1>
    ${article.articleHtml}
  </article>
</body>
</html>
`
}

export { escapeHtml }
