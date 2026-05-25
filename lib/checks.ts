import type { CheckResult, ParsedArticle, Thresholds } from './types'
import { CHECK_CONFIG } from './config'

function range(
  label: string,
  value: number,
  min: number,
  max: number,
): { severity: 'pass' | 'warn'; detail: string } {
  if (value < min)
    return {
      severity: 'warn',
      detail: `${label} is ${value} characters — recommended ${min}–${max}.`,
    }
  if (value > max)
    return {
      severity: 'warn',
      detail: `${label} is ${value} characters — recommended ${min}–${max}.`,
    }
  return { severity: 'pass', detail: `${value} characters (recommended ${min}–${max}).` }
}

// WHY: This is a plain function — same code runs on the server when we parse,
// and on the client when the editor changes a threshold. So tweaking a
// threshold updates the result instantly, no API call needed.
export function runChecks(article: ParsedArticle, thresholds: Thresholds): CheckResult[] {
  const checks: CheckResult[] = []

  // Meta title
  if (!article.metaTitle) {
    checks.push({
      id: 'meta-title-present',
      label: 'Meta title present',
      severity: 'fail',
      detail: 'Could not find a "Meta Title:" line at the top of the doc.',
    })
  } else {
    const r = range(
      'Meta title',
      article.metaTitle.length,
      CHECK_CONFIG.metaTitle.minLength,
      CHECK_CONFIG.metaTitle.maxLength,
    )
    checks.push({ id: 'meta-title-length', label: 'Meta title length', ...r })
  }

  // Meta description
  if (!article.metaDescription) {
    checks.push({
      id: 'meta-description-present',
      label: 'Meta description present',
      severity: 'fail',
      detail: 'Could not find a "Meta Description:" line at the top of the doc.',
    })
  } else {
    const r = range(
      'Meta description',
      article.metaDescription.length,
      CHECK_CONFIG.metaDescription.minLength,
      CHECK_CONFIG.metaDescription.maxLength,
    )
    checks.push({ id: 'meta-description-length', label: 'Meta description length', ...r })
  }

  // Article title
  checks.push(
    article.articleTitle
      ? {
          id: 'article-title-present',
          label: 'Article title (H1)',
          severity: 'pass',
          detail: `"${article.articleTitle}"`,
        }
      : {
          id: 'article-title-present',
          label: 'Article title (H1)',
          severity: 'fail',
          detail: 'No H1 heading found in the document.',
        },
  )

  // Image count
  const imageCount = article.images.length
  let imageCountSeverity: CheckResult['severity'] = 'pass'
  let imageCountDetail = `${imageCount} image${imageCount === 1 ? '' : 's'} (target ${thresholds.minImages}–${thresholds.maxImages}).`
  if (imageCount < thresholds.minImages) {
    imageCountSeverity = 'fail'
    imageCountDetail = `Only ${imageCount} image${imageCount === 1 ? '' : 's'} — minimum is ${thresholds.minImages}.`
  } else if (imageCount > thresholds.maxImages) {
    imageCountSeverity = 'fail'
    imageCountDetail = `${imageCount} images — maximum is ${thresholds.maxImages}.`
  }
  checks.push({
    id: 'image-count',
    label: 'Image count',
    severity: imageCountSeverity,
    detail: imageCountDetail,
  })

  // Images on Drive
  const notOnDrive = article.images.filter((i) => !i.onDrive)
  checks.push(
    notOnDrive.length === 0 && imageCount > 0
      ? {
          id: 'images-on-drive',
          label: 'Images hosted on Google Drive',
          severity: 'pass',
          detail: 'All images are linked to Google Drive.',
        }
      : imageCount === 0
        ? {
            id: 'images-on-drive',
            label: 'Images hosted on Google Drive',
            severity: 'warn',
            detail: 'No images to check.',
          }
        : {
            id: 'images-on-drive',
            label: 'Images hosted on Google Drive',
            severity: 'fail',
            detail: `${notOnDrive.length} image${notOnDrive.length === 1 ? '' : 's'} not hosted on Google Drive.`,
          },
  )

  // Images publicly shared
  const driveImages = article.images.filter((i) => i.onDrive)
  const notPublic = driveImages.filter((i) => i.publiclyShared === false)
  const unknown = driveImages.filter((i) => i.publiclyShared === null)
  if (driveImages.length === 0) {
    checks.push({
      id: 'images-public',
      label: 'Images publicly shared',
      severity: 'warn',
      detail: 'No Drive-hosted images to verify.',
    })
  } else if (notPublic.length === 0 && unknown.length === 0) {
    checks.push({
      id: 'images-public',
      label: 'Images publicly shared',
      severity: 'pass',
      detail: `All ${driveImages.length} Drive images are publicly accessible.`,
    })
  } else if (notPublic.length > 0) {
    checks.push({
      id: 'images-public',
      label: 'Images publicly shared',
      severity: 'fail',
      detail: `${notPublic.length} Drive image${notPublic.length === 1 ? ' is' : 's are'} not publicly shared (will not render for readers).`,
    })
  } else {
    checks.push({
      id: 'images-public',
      label: 'Images publicly shared',
      severity: 'warn',
      detail: `Could not verify ${unknown.length} image${unknown.length === 1 ? '' : 's'}.`,
    })
  }

  // Alt tags
  const missingAlt = article.images.filter((i) => !i.alt)
  checks.push(
    missingAlt.length === 0 && imageCount > 0
      ? {
          id: 'images-alt',
          label: 'Images have alt text',
          severity: 'pass',
          detail: 'Every image has alt text.',
        }
      : imageCount === 0
        ? {
            id: 'images-alt',
            label: 'Images have alt text',
            severity: 'warn',
            detail: 'No images present.',
          }
        : {
            id: 'images-alt',
            label: 'Images have alt text',
            severity: 'warn',
            detail: `${missingAlt.length} image${missingAlt.length === 1 ? '' : 's'} missing alt text.`,
          },
  )

  // Product link count
  const productLinks = article.links.filter((l) => l.type === 'product')
  let plSeverity: CheckResult['severity'] = 'pass'
  let plDetail = `${productLinks.length} product link${productLinks.length === 1 ? '' : 's'} (target ${thresholds.minProductLinks}–${thresholds.maxProductLinks}).`
  if (!thresholds.productDomain && !article.productDomainSuggestion) {
    plSeverity = 'warn'
    plDetail = 'Set a product domain in the thresholds bar to count product links.'
  } else if (productLinks.length < thresholds.minProductLinks) {
    plSeverity = 'fail'
    plDetail = `Only ${productLinks.length} product link${productLinks.length === 1 ? '' : 's'} — minimum is ${thresholds.minProductLinks}.`
  } else if (productLinks.length > thresholds.maxProductLinks) {
    plSeverity = 'fail'
    plDetail = `${productLinks.length} product links — maximum is ${thresholds.maxProductLinks}.`
  }
  checks.push({
    id: 'product-link-count',
    label: 'Product link count',
    severity: plSeverity,
    detail: plDetail,
    meta: { productDomain: thresholds.productDomain || article.productDomainSuggestion },
  })

  // WHY: Broken product links cost the client real money — those are "fail".
  // Broken non-product links and bot-blocked ones are just "warn". On the
  // sample doc this catches 6 broken product links out of 11.
  // Link reachability — only run if we have probe results.
  const checkedLinks = article.links.filter((l) => l.health)
  if (checkedLinks.length > 0) {
    const brokenProduct = checkedLinks.filter((l) => l.type === 'product' && l.health!.broken)
    const brokenOther = checkedLinks.filter((l) => l.type !== 'product' && l.health!.broken)
    const blocked = checkedLinks.filter((l) => l.health!.blocked)
    const issues: string[] = []
    if (brokenProduct.length > 0) {
      issues.push(
        `${brokenProduct.length} broken product link${brokenProduct.length === 1 ? '' : 's'} (${brokenProduct
          .map((l) => l.health!.status ?? 'net err')
          .join(', ')})`,
      )
    }
    if (brokenOther.length > 0) {
      issues.push(
        `${brokenOther.length} broken non-product link${brokenOther.length === 1 ? '' : 's'} (${brokenOther
          .map((l) => l.health!.status ?? 'net err')
          .join(', ')})`,
      )
    }
    if (blocked.length > 0) {
      issues.push(
        `${blocked.length} link${blocked.length === 1 ? '' : 's'} blocked our probe (403/429) — verify manually`,
      )
    }
    let severity: CheckResult['severity'] = 'pass'
    if (brokenProduct.length > 0) severity = 'fail'
    else if (brokenOther.length > 0 || blocked.length > 0) severity = 'warn'
    checks.push({
      id: 'links-reachable',
      label: 'Link reachability',
      severity,
      detail:
        issues.length > 0
          ? issues.join('; ') + '.'
          : `All ${checkedLinks.length} external links reachable.`,
    })
  }

  // WHY: We fix the H1 mistake silently in the parser, but we still want the
  // writer to know — otherwise they'll keep doing it.
  // Extra H1s in the body. The article title is already the H1; any other
  // H1 left in the body is a writer mistake (typically a paragraph that
  // got "Heading 1" styling applied by accident). Multiple H1s confuse
  // search-engine ranking and screen-reader landmarks.
  const extraH1s = article.headings.filter((h) => h.level === 1)
  if (extraH1s.length > 0) {
    const sample = extraH1s[0].text.slice(0, 70)
    checks.push({
      id: 'extra-h1',
      label: 'Multiple H1 tags',
      severity: 'fail',
      detail: `Body contains ${extraH1s.length} extra H1 heading${extraH1s.length === 1 ? '' : 's'} (e.g., "${sample}${extraH1s[0].text.length > 70 ? '…' : ''}"). The article title is already H1 — fix the source doc so body content uses H2+.`,
    })
  }

  // Heading hierarchy: no skipping levels.
  const skipped: string[] = []
  let previous = 0
  for (const h of article.headings) {
    if (previous > 0 && h.level > previous + 1) {
      skipped.push(`Skipped from H${previous} to H${h.level} at "${h.text}"`)
    }
    previous = h.level
  }
  checks.push(
    skipped.length === 0
      ? {
          id: 'heading-hierarchy',
          label: 'Heading hierarchy',
          severity: 'pass',
          detail: 'Headings progress without skipping levels.',
        }
      : {
          id: 'heading-hierarchy',
          label: 'Heading hierarchy',
          severity: 'warn',
          detail: skipped.join('; '),
        },
  )

  // Paragraph length — quick scan of plain text by approximating paragraph breaks.
  // We use double-newline-ish boundaries by splitting on sentence-cluster boundaries.
  const paragraphs = article.plainText
    .split(/(?<=[.!?])\s+(?=[A-Z])/)
    .filter((p) => p.trim().length > 0)
  const maxParaWords = CHECK_CONFIG.paragraph.maxWords
  const longParas = paragraphs.filter((p) => p.split(/\s+/).length > maxParaWords)
  checks.push(
    longParas.length === 0
      ? {
          id: 'paragraph-length',
          label: 'Paragraph length',
          severity: 'pass',
          detail: `No paragraphs over ${maxParaWords} words.`,
        }
      : {
          id: 'paragraph-length',
          label: 'Paragraph length',
          severity: 'warn',
          detail: `${longParas.length} long passage${longParas.length === 1 ? '' : 's'} (> ${maxParaWords} words) — consider splitting.`,
        },
  )

  return checks
}
