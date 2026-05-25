import type { ParsedLink, LinkType } from './types'

/**
 * Google Docs exports wrap every external link in a redirector:
 *   https://www.google.com/url?q=REAL_URL&sa=D&source=editors&ust=...
 * Unwrap it to recover the actual destination.
 */
export function unwrapGoogleRedirect(href: string): string {
  if (!href) return href
  try {
    const url = new URL(href)
    const isGoogleRedirect =
      (url.hostname === 'www.google.com' || url.hostname === 'google.com') &&
      url.pathname === '/url' &&
      url.searchParams.has('q')
    if (isGoogleRedirect) {
      const q = url.searchParams.get('q')
      if (q) return q
    }
  } catch {
    // Not a parseable URL — return as-is.
  }
  return href
}

function safeHost(href: string): string {
  try {
    return new URL(href).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

export function classifyLink(href: string, productDomain: string): LinkType {
  if (!href) return 'external'
  if (href.startsWith('#')) return 'internal-anchor'
  if (href.startsWith('mailto:')) return 'mailto'
  if (href.startsWith('tel:')) return 'tel'
  const host = safeHost(href)
  if (productDomain && host && host.endsWith(productDomain.replace(/^www\./, ''))) {
    return 'product'
  }
  return 'external'
}

export function suggestProductDomain(links: { href: string }[]): string | null {
  const counts = new Map<string, number>()
  for (const link of links) {
    const host = safeHost(link.href)
    if (!host) continue
    if (host === 'google.com' || host === 'docs.google.com' || host === 'drive.google.com') continue
    counts.set(host, (counts.get(host) ?? 0) + 1)
  }
  let best: string | null = null
  let bestCount = 0
  for (const [host, count] of counts) {
    if (count > bestCount) {
      best = host
      bestCount = count
    }
  }
  return best
}

export function buildLink(href: string, text: string, productDomain: string): ParsedLink {
  return {
    href,
    text,
    type: classifyLink(href, productDomain),
    host: safeHost(href),
  }
}
