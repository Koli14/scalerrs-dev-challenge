/**
 * Centralised tuning constants for the quality checks.
 *
 * Threshold values that are common across clients live here. Per-article /
 * per-client values that the editor can change in the UI live in
 * `DEFAULT_THRESHOLDS` (in ./types.ts). When we move to multi-client config
 * later, this file is the natural spot to load client-specific overrides
 * (e.g. read from a per-client JSON, fall back to these defaults).
 */
export const CHECK_CONFIG = {
  metaTitle: {
    /** Recommended minimum character count for the meta title. */
    minLength: 30,
    /** Recommended maximum character count for the meta title. */
    maxLength: 65,
  },
  metaDescription: {
    /** Recommended minimum character count for the meta description. */
    minLength: 110,
    /** Recommended maximum character count for the meta description. */
    maxLength: 160,
  },
  paragraph: {
    /** Warn for any paragraph longer than this (rough wall-of-text guard). */
    maxWords: 150,
  },
  drive: {
    /** Per-image probe timeout against Drive (ms). */
    probeTimeoutMs: 6000,
  },
  linkCheck: {
    /** Per-link probe timeout when checking external link reachability (ms). */
    probeTimeoutMs: 5000,
  },
} as const
