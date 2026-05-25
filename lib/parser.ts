import * as cheerio from 'cheerio'
import type { Element } from 'domhandler'
import { unwrapGoogleRedirect, buildLink, suggestProductDomain } from './links'
import { extractDriveFileId, isDriveUrl, probeDriveAccess } from './drive'
import { probeLinks } from './linkcheck'
import type { ParsedArticle, ParsedImage, ParsedHeading, ParsedLink } from './types'

const DOC_ID_RE = /\/document\/d\/([a-zA-Z0-9_-]+)/

export function extractDocId(docUrl: string): string {
  const m = docUrl.match(DOC_ID_RE)
  if (!m) {
    throw new Error(
      'Could not find a document ID in that URL. Expected a Google Docs link like https://docs.google.com/document/d/<id>/edit',
    )
  }
  return m[1]
}

export async function fetchDocHtml(docId: string): Promise<string> {
  const url = `https://docs.google.com/document/d/${encodeURIComponent(docId)}/export?format=html`
  const res = await fetch(url, {
    redirect: 'follow',
    headers: { 'User-Agent': 'Mozilla/5.0 (ArticleQC/1.0)' },
  })
  if (!res.ok) {
    throw new Error(
      `Could not fetch the Google Doc (HTTP ${res.status}). Make sure the doc is shared as "Anyone with the link can view".`,
    )
  }
  const ct = res.headers.get('content-type') ?? ''
  // If we got bounced to an HTML sign-in page rather than the doc export, fail explicitly.
  if (!ct.includes('text/html')) {
    throw new Error(`Unexpected content type from Google Docs: ${ct}`)
  }
  return res.text()
}

interface ExtractOptions {
  /** Optional product domain to classify links against. */
  productDomain?: string
}

/**
 * Parse the exported HTML and return a structured article. Image "publiclyShared"
 * is left null here — fill it in by calling `validateImages` afterwards.
 */
export function extractArticle(
  html: string,
  docId: string,
  opts: ExtractOptions = {},
): ParsedArticle {
  const $ = cheerio.load(html)
  const $body = $('body')

  // 1. Pull meta fields out of the leading paragraphs.
  let metaTitle = ''
  let metaDescription = ''
  $body.find('p').each((_, el) => {
    const $p = $(el)
    const text = $p.text().replace(/ /g, ' ').trim()
    if (!text) return
    const titleMatch = text.match(/^meta\s*title\s*:\s*(.+)$/i)
    const descMatch = text.match(/^meta\s*description\s*:\s*(.+)$/i)
    if (titleMatch && !metaTitle) {
      metaTitle = titleMatch[1].trim()
      $p.remove()
    } else if (descMatch && !metaDescription) {
      metaDescription = descMatch[1].trim()
      $p.remove()
    }
  })

  // 2. Article title = first h1; remove from body.
  let articleTitle = ''
  const $h1 = $body.find('h1').first()
  if ($h1.length) {
    articleTitle = $h1.text().trim()
    $h1.remove()
  }

  // 3. Normalize links: unwrap Google redirector, drop tracking attrs.
  $body.find('a').each((_, el) => {
    const $a = $(el)
    const original = $a.attr('href') ?? ''
    const unwrapped = unwrapGoogleRedirect(original)
    if (unwrapped !== original) $a.attr('href', unwrapped)
    $a.removeAttr('data-saferedirecturl')
    $a.removeAttr('onmousedown')
    if (unwrapped && /^https?:/i.test(unwrapped)) {
      $a.attr('target', '_blank')
      $a.attr('rel', 'noopener noreferrer')
    }
  })

  // 4. Collect images. This client's writers use a documented convention:
  //    images are represented as placeholder hyperlinks whose link text is
  //    "IMAGE 1", "IMAGE 2", etc., pointing at a Drive share URL — followed
  //    in the same paragraph by an `Alt tag: "..."` annotation. We support
  //    both that convention AND real embedded <img> elements.
  const images: ParsedImage[] = []
  const consumedAnchors = new Set<Element>()

  // 4a. Placeholder-link convention: <a>IMAGE N</a> ... Alt tag: "..."
  const IMAGE_PLACEHOLDER_RE = /^image\s*\d+$/i
  // Curly or straight quotes around the alt value.
  const ALT_TAG_RE = /alt\s*tag\s*:?\s*[“"']([^”"']+)[”"']/i

  $body.find('a').each((_, el) => {
    const $a = $(el)
    const linkText = $a.text().trim()
    if (!IMAGE_PLACEHOLDER_RE.test(linkText)) return
    const href = $a.attr('href') ?? ''
    if (!href) return
    const driveFileId = extractDriveFileId(href)
    const driveUrl = isDriveUrl(href)
      ? href
      : driveFileId
        ? `https://drive.google.com/file/d/${driveFileId}/view`
        : null

    // Look for "Alt tag: "..."" anywhere in the containing paragraph.
    const $paragraph = $a.closest('p, div, li').first()
    const paragraphText = $paragraph.length ? $paragraph.text() : ''
    const altMatch = paragraphText.match(ALT_TAG_RE)
    const alt = altMatch ? altMatch[1].trim() : ''

    images.push({
      imgSrc: driveFileId ? `https://drive.google.com/thumbnail?id=${driveFileId}&sz=w1000` : '',
      driveUrl,
      driveFileId,
      alt,
      onDrive: Boolean(driveFileId),
      publiclyShared: null,
    })
    consumedAnchors.add(el as Element)
  })

  // 4b. Real embedded <img> elements (in case a doc has them too).
  $body.find('img').each((_, el) => {
    const $img = $(el)
    const imgSrc = $img.attr('src') ?? ''
    const alt = ($img.attr('alt') ?? '').trim()
    const $parentLink = $img.closest('a')
    const wrappingHref = $parentLink.attr('href') ?? null

    const driveUrl = isDriveUrl(wrappingHref) ? wrappingHref : null
    const driveFileId = extractDriveFileId(wrappingHref) ?? extractDriveFileId(imgSrc)

    images.push({
      imgSrc,
      driveUrl:
        driveUrl ?? (driveFileId ? `https://drive.google.com/file/d/${driveFileId}/view` : null),
      driveFileId,
      alt,
      onDrive: Boolean(driveFileId),
      publiclyShared: null,
    })
  })

  // 5. Collect links + headings before stripping styles, so we operate on the
  //    same DOM we'll serialise.
  const linksRaw: { href: string; text: string }[] = []
  $body.find('a').each((_, el) => {
    const $a = $(el)
    const href = ($a.attr('href') ?? '').trim()
    if (!href) return
    // Skip anchors that are just wrappers around images — those are the Drive
    // share links and aren't editorial product links.
    if ($a.children('img').length > 0 && !$a.text().trim()) return
    // Skip the "IMAGE N" placeholder anchors — they represent images, not links.
    if (consumedAnchors.has(el as Element)) return
    const text = $a.text().trim()
    linksRaw.push({ href, text })
  })

  const productDomain =
    opts.productDomain && opts.productDomain.length > 0
      ? opts.productDomain
      : (suggestProductDomain(linksRaw) ?? '')
  const links: ParsedLink[] = linksRaw.map((l) => buildLink(l.href, l.text, productDomain))

  const headings: ParsedHeading[] = []
  $body.find('h1, h2, h3, h4, h5, h6').each((_, el) => {
    const tag = (el as Element).tagName.toLowerCase()
    const level = Number(tag[1]) as ParsedHeading['level']
    const text = $(el).text().trim()
    if (text) headings.push({ level, text })
  })

  // 6. Strip Google Docs export styling that won't render outside the export
  //    context. Keep semantic markup.
  $body.find('[style]').removeAttr('style')
  $body.find('[class]').removeAttr('class')
  $body.find('[id]').removeAttr('id')
  $body.find('style, script, meta, link, head').remove()
  // Replace empty <span> wrappers with their children.
  $body.find('span').each((_, el) => {
    const $s = $(el)
    $s.replaceWith($s.contents())
  })

  // 6a. Demote stray <h1> elements in the body to paragraphs. The article's
  //     real H1 was already extracted as `articleTitle` in step 2, so any
  //     H1 left in the body is a writer mistake — usually a paragraph that
  //     got "Heading 1" styling applied by accident in Google Docs.
  //     Multiple H1s are an SEO problem (confuses crawlers, breaks screen
  //     reader landmarks), so we don't ship them. The check in checks.ts
  //     still flags this so the writer fixes the source doc.
  $body.find('h1').each((_, el) => {
    const $el = $(el)
    const inner = $el.html() ?? $el.text()
    $el.replaceWith(`<p>${inner}</p>`)
  })

  // 6b. Google Docs exports include decorative empty <p> spacers (often
  //     originally `<p><span class="…"></span></p>` whose span we just
  //     unwrapped to nothing). Drop block elements that have no rendered
  //     content. Repeat a few passes because pruning a child can leave
  //     a now-empty parent.
  const BLOCKS_TO_PRUNE = 'p, div, li, ul, ol'
  for (let pass = 0; pass < 3; pass++) {
    let removed = 0
    $body.find(BLOCKS_TO_PRUNE).each((_, el) => {
      const $el = $(el)
      if ($el.find('img, picture, svg, iframe, video, hr, br').length > 0) return
      const text = $el.text().replace(/[\s ]+/g, '')
      if (text.length === 0) {
        $el.remove()
        removed++
      }
    })
    if (removed === 0) break
  }

  // 7a. Convert "IMAGE N" placeholder anchors into real <img> tags so the
  //     preview renders the image instead of a text link. We also drop the
  //     trailing `Alt tag: "..."` annotation from the same paragraph since
  //     it was an editorial scaffold, not part of the published article.
  $body.find('a').each((_, el) => {
    const $a = $(el)
    const linkText = $a.text().trim()
    if (!IMAGE_PLACEHOLDER_RE.test(linkText)) return
    const href = $a.attr('href') ?? ''
    const fileId = extractDriveFileId(href)
    if (!fileId) return

    // Capture alt from the surrounding paragraph before mutation.
    const $paragraph = $a.closest('p, div, li').first()
    const paragraphText = $paragraph.length ? $paragraph.text() : ''
    const altMatch = paragraphText.match(ALT_TAG_RE)
    const alt = altMatch ? altMatch[1].trim() : linkText

    // Replace the entire paragraph with a clean <p><img></p> block so the
    // rendered article looks production-ready (no "Alt tag: ..." scaffolding).
    if ($paragraph.length) {
      $paragraph.replaceWith(
        `<p><img src="https://drive.google.com/thumbnail?id=${fileId}&sz=w1000" alt="${alt.replace(/"/g, '&quot;')}"></p>`,
      )
    } else {
      $a.replaceWith(
        `<img src="https://drive.google.com/thumbnail?id=${fileId}&sz=w1000" alt="${alt.replace(/"/g, '&quot;')}">`,
      )
    }
  })

  // 7b. Convert any real Drive-wrapped <a><img></a> so the rendered preview
  //     points at a thumbnail URL we can actually display.
  $body.find('a').each((_, el) => {
    const $a = $(el)
    const href = $a.attr('href') ?? ''
    if (isDriveUrl(href) && $a.find('img').length > 0) {
      const fileId = extractDriveFileId(href)
      if (fileId) {
        $a.find('img').attr('src', `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`)
      }
    }
  })

  const articleHtml = $body.html()?.trim() ?? ''
  const plainText = $body.text().replace(/\s+/g, ' ').trim()
  const wordCount = plainText ? plainText.split(/\s+/).length : 0
  const productDomainSuggestion = suggestProductDomain(linksRaw)

  return {
    docId,
    docUrl: `https://docs.google.com/document/d/${docId}/edit`,
    metaTitle,
    metaDescription,
    articleTitle,
    articleHtml,
    plainText,
    images,
    links,
    headings,
    wordCount,
    productDomainSuggestion,
  }
}

/**
 * Probe Drive for every image with a known fileId, in parallel.
 * Mutates and returns the article.
 */
export async function validateImages(article: ParsedArticle): Promise<ParsedArticle> {
  const probes = article.images.map(async (img) => {
    if (!img.driveFileId) {
      img.publiclyShared = null
      img.driveError = img.onDrive ? undefined : 'Image is not hosted on Google Drive'
      return
    }
    const result = await probeDriveAccess(img.driveFileId)
    img.publiclyShared = result.publiclyShared
    if (result.error) img.driveError = result.error
  })
  await Promise.allSettled(probes)
  return article
}

/**
 * Probe every external link for reachability and stamp the result onto
 * the corresponding ParsedLink entries. Internal anchors / mailto / tel
 * are skipped.
 */
export async function validateLinks(article: ParsedArticle): Promise<ParsedArticle> {
  const probeTargets = article.links.filter(
    (l) =>
      l.type !== 'internal-anchor' &&
      l.type !== 'mailto' &&
      l.type !== 'tel' &&
      /^https?:/i.test(l.href),
  )
  if (probeTargets.length === 0) return article
  const results = await probeLinks(probeTargets.map((l) => l.href))
  for (const link of article.links) {
    const r = results.get(link.href)
    if (r) {
      link.health = {
        status: r.status,
        ok: r.ok,
        blocked: r.blocked,
        broken: r.broken,
        finalUrl: r.finalUrl,
        error: r.error,
      }
    }
  }
  return article
}

export async function parseDoc(docUrl: string, productDomain?: string): Promise<ParsedArticle> {
  const docId = extractDocId(docUrl)
  const html = await fetchDocHtml(docId)
  const article = extractArticle(html, docId, { productDomain })
  // Both validators do parallel network work; run them concurrently so the
  // total wait is max(images, links) instead of images + links.
  await Promise.all([validateImages(article), validateLinks(article)])
  return article
}

// Re-exports so callers don't need to import from cheerio types.
export type { ParsedArticle } from './types'
