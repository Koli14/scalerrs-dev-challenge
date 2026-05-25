export interface DriveProbeResult {
  fileId: string;
  publiclyShared: boolean;
  contentType?: string;
  error?: string;
}

const DRIVE_FILE_ID_RE = /\/file\/d\/([a-zA-Z0-9_-]+)/;
const DRIVE_QUERY_ID_RE = /[?&]id=([a-zA-Z0-9_-]+)/;
const DRIVE_OPEN_ID_RE = /\/open\?id=([a-zA-Z0-9_-]+)/;

export function extractDriveFileId(url: string | null | undefined): string | null {
  if (!url) return null;
  const m =
    url.match(DRIVE_FILE_ID_RE) ||
    url.match(DRIVE_OPEN_ID_RE) ||
    url.match(DRIVE_QUERY_ID_RE);
  return m ? m[1] : null;
}

export function isDriveUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const host = new URL(url).hostname;
    return host === "drive.google.com" || host.endsWith(".googleusercontent.com");
  } catch {
    return false;
  }
}

/**
 * Probe Drive to see whether a file is publicly accessible.
 *
 * Strategy: fetch the unauthenticated direct-download endpoint. If Drive
 * returns image bytes (or even an HTML "confirm download" page for large
 * files), the file is public. If it returns a "request access" / sign-in
 * page or a 401/403/404, treat it as private/inaccessible.
 */
export async function probeDriveAccess(fileId: string, timeoutMs = 6000): Promise<DriveProbeResult> {
  const url = `https://drive.google.com/uc?id=${encodeURIComponent(fileId)}&export=download`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (ArticleQC/1.0)" },
    });
    if (!res.ok) {
      return { fileId, publiclyShared: false, error: `HTTP ${res.status}` };
    }
    const contentType = res.headers.get("content-type") ?? "";
    if (contentType.startsWith("image/")) {
      return { fileId, publiclyShared: true, contentType };
    }
    // For HTML responses, check whether it's a "you need permission" / sign-in page
    // or a legitimate "scan-warning / confirm download" interstitial that Drive
    // serves for large public files.
    if (contentType.includes("text/html")) {
      const body = await res.text();
      const lower = body.toLowerCase();
      const isSignInOrDenied =
        lower.includes("accounts.google.com/signin") ||
        lower.includes("you need access") ||
        lower.includes("request access") ||
        lower.includes("sign in to continue") ||
        lower.includes("you don&#39;t have access") ||
        lower.includes("you don't have access");
      if (isSignInOrDenied) {
        return { fileId, publiclyShared: false, contentType, error: "private or unshared" };
      }
      // Anything else from Drive on a successful GET is treated as accessible.
      return { fileId, publiclyShared: true, contentType };
    }
    // Some other binary type (zip, etc.) — still served, so it's accessible.
    return { fileId, publiclyShared: true, contentType };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { fileId, publiclyShared: false, error: msg };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Convert a Drive file ID into a stable thumbnail URL we can show in the UI
 * without needing the original Drive page to embed.
 */
export function driveThumbnailUrl(fileId: string, width = 480): string {
  return `https://drive.google.com/thumbnail?id=${encodeURIComponent(fileId)}&sz=w${width}`;
}
