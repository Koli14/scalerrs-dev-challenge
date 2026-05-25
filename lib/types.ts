export type LinkType = "product" | "external" | "internal-anchor" | "mailto" | "tel";

export interface ParsedImage {
  imgSrc: string;
  driveUrl: string | null;
  driveFileId: string | null;
  alt: string;
  onDrive: boolean;
  publiclyShared: boolean | null;
  driveError?: string;
}

export interface LinkHealth {
  status: number | null;
  /** 2xx response. */
  ok: boolean;
  /** 401 / 403 / 429 — likely bot-blocking, not a true break. */
  blocked: boolean;
  /** 4xx (non-blocking) / 5xx / network error. */
  broken: boolean;
  finalUrl: string | null;
  error?: string;
}

export interface ParsedLink {
  href: string;
  text: string;
  type: LinkType;
  host: string;
  health?: LinkHealth;
}

export interface ParsedHeading {
  level: 1 | 2 | 3 | 4 | 5 | 6;
  text: string;
}

export interface ParsedArticle {
  docId: string;
  docUrl: string;
  metaTitle: string;
  metaDescription: string;
  articleTitle: string;
  articleHtml: string;
  plainText: string;
  images: ParsedImage[];
  links: ParsedLink[];
  headings: ParsedHeading[];
  wordCount: number;
  productDomainSuggestion: string | null;
}

export type CheckSeverity = "pass" | "warn" | "fail";

export interface CheckResult {
  id: string;
  label: string;
  severity: CheckSeverity;
  detail: string;
  meta?: Record<string, unknown>;
}

export interface Thresholds {
  minImages: number;
  maxImages: number;
  minProductLinks: number;
  maxProductLinks: number;
  productDomain: string;
}

export const DEFAULT_THRESHOLDS: Thresholds = {
  minImages: 2,
  maxImages: 8,
  minProductLinks: 3,
  maxProductLinks: 15,
  productDomain: "",
};

export interface ParseResponse {
  article: ParsedArticle;
  checks: CheckResult[];
}
