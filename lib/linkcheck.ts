import { CHECK_CONFIG } from './config'

export interface LinkProbeResult {
  href: string
  status: number | null
  finalUrl: string | null
  /** 2xx response. */
  ok: boolean
  /** True if the response was a redirect chain. */
  redirected: boolean
  /** 401 / 403 / 429 — likely bot-blocking (Cloudflare etc.), not a true break. */
  blocked: boolean
  /** 4xx (except blocked codes) or 5xx or network error. */
  broken: boolean
  error?: string
}

const USER_AGENT = 'Mozilla/5.0 (compatible; ArticleQC/1.0; SEO link checker)'

function passThroughResult(href: string): LinkProbeResult {
  return {
    href,
    status: null,
    finalUrl: null,
    ok: true,
    redirected: false,
    blocked: false,
    broken: false,
  }
}

/**
 * Probe a single external link for reachability.
 *
 * Strategy: HEAD first (cheap), fall back to GET if the server doesn't
 * support HEAD (405 / 501) — many CDNs do this. Treats 401/403/429 as
 * "blocked" rather than "broken" so we don't false-positive on
 * Cloudflare / Akamai bot detection. Internal anchors / mailto / tel are
 * passed through as ok.
 */
// WHY: Checks if a link is reachable. HEAD requests are faster, but some sites
// refuse them with a 405, so we fall back to GET when that happens. Also, a
// 401, 403, or 429 usually means a bot detector blocked us — not that the
// link is dead — so we mark those as "blocked", not "broken".
export async function probeLink(
  href: string,
  timeoutMs: number = CHECK_CONFIG.linkCheck.probeTimeoutMs,
): Promise<LinkProbeResult> {
  if (!/^https?:/i.test(href)) return passThroughResult(href)

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  const tryFetch = (method: 'HEAD' | 'GET') =>
    fetch(href, {
      method,
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent': USER_AGENT,
        Accept: '*/*',
      },
    })

  try {
    let res = await tryFetch('HEAD')
    if (res.status === 405 || res.status === 501 || res.status === 400) {
      // Server doesn't support HEAD — try GET. Drain the body so we don't
      // hold the socket open longer than necessary.
      res = await tryFetch('GET')
      try {
        await res.body?.cancel()
      } catch {
        /* ignore */
      }
    }

    const status = res.status
    const blocked = status === 401 || status === 403 || status === 429
    const broken = !res.ok && !blocked

    return {
      href,
      status,
      finalUrl: res.url,
      ok: res.ok,
      redirected: res.redirected,
      blocked,
      broken,
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return {
      href,
      status: null,
      finalUrl: null,
      ok: false,
      redirected: false,
      blocked: false,
      broken: true,
      error: msg,
    }
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Probe many links in parallel and return a Map keyed by href. Uses a Set
 * upstream to deduplicate so the same href across multiple anchors is only
 * hit once.
 */
export async function probeLinks(hrefs: string[]): Promise<Map<string, LinkProbeResult>> {
  const unique = Array.from(new Set(hrefs))
  const results = await Promise.allSettled(unique.map((h) => probeLink(h)))
  const map = new Map<string, LinkProbeResult>()
  results.forEach((r, i) => {
    const href = unique[i]
    if (r.status === 'fulfilled') {
      map.set(href, r.value)
    } else {
      map.set(href, {
        href,
        status: null,
        finalUrl: null,
        ok: false,
        redirected: false,
        blocked: false,
        broken: true,
        error: String(r.reason),
      })
    }
  })
  return map
}
