"use client";

import { useState } from "react";
import type { ParsedArticle } from "@/lib/types";
import { wrapAsStandaloneHtml } from "@/lib/render";

interface UploadResult {
  status: string;
  platform: string;
  mockPostId: number;
  sentAt: string;
  payload: Record<string, unknown>;
  note: string;
}

interface Props {
  article: ParsedArticle;
  failingChecks: number;
}

type Platform = "wordpress" | "shopify";

export function PublishBar({ article, failingChecks }: Props) {
  const [platform, setPlatform] = useState<Platform>("wordpress");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const payload = {
    metaTitle: article.metaTitle,
    metaDescription: article.metaDescription,
    articleTitle: article.articleTitle,
    articleHtml: article.articleHtml,
  };

  const publish = async () => {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ platform, payload }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Upload failed");
      } else {
        setResult(data as UploadResult);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const downloadHtml = () => {
    // The API payload uses the body fragment (WordPress / Shopify expect it
    // that way). The download is for human consumption — wrap it in a
    // standalone HTML document with the meta tags in <head>.
    const standalone = wrapAsStandaloneHtml(article);
    const blob = new Blob([standalone], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const slug = (article.articleTitle || article.docId)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 60);
    a.href = url;
    a.download = `${slug || "article"}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3 flex items-center gap-3 flex-wrap">
        <div className="text-sm font-semibold mr-2">Publish</div>

        <div className="flex rounded border border-[var(--color-border)] overflow-hidden text-sm">
          {(["wordpress", "shopify"] as Platform[]).map((p) => (
            <button
              key={p}
              onClick={() => setPlatform(p)}
              className={`px-3 py-1.5 capitalize ${
                platform === p
                  ? "bg-[var(--color-accent)] text-[#0b1020]"
                  : "text-[var(--color-muted)] hover:text-[var(--color-text)]"
              }`}
            >
              {p}
            </button>
          ))}
        </div>

        <button
          onClick={publish}
          disabled={busy}
          className="px-4 py-1.5 rounded bg-[var(--color-accent)] text-[#0b1020] text-sm font-semibold hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "Publishing…" : `Publish to ${platform}`}
        </button>

        <button
          onClick={downloadHtml}
          className="px-3 py-1.5 rounded border border-[var(--color-border)] text-sm text-[var(--color-muted)] hover:text-[var(--color-text)] hover:border-[var(--color-accent)]"
        >
          Download article HTML
        </button>

        {failingChecks > 0 && (
          <span className="text-xs text-[var(--color-warn)] ml-auto">
            ⚠ {failingChecks} failing check{failingChecks === 1 ? "" : "s"} — publish anyway?
          </span>
        )}
      </div>

      {(result || error) && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-6 z-50">
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg w-full max-w-2xl max-h-[80vh] overflow-auto">
            <div className="p-4 border-b border-[var(--color-border)] flex justify-between items-center">
              <div className="text-sm font-semibold">
                {error ? "Upload error" : `Published to ${result?.platform} (placeholder)`}
              </div>
              <button
                onClick={() => {
                  setResult(null);
                  setError(null);
                }}
                className="text-[var(--color-muted)] hover:text-[var(--color-text)]"
              >
                Close
              </button>
            </div>
            <div className="p-4 text-sm">
              {error ? (
                <div className="text-[var(--color-fail)]">{error}</div>
              ) : (
                <>
                  <div className="text-[var(--color-muted)] mb-2">{result?.note}</div>
                  <div className="text-xs mb-1 text-[var(--color-muted)]">
                    Payload sent (this is the JSON a real {result?.platform} API call would receive):
                  </div>
                  <pre className="json-block">{JSON.stringify(result, null, 2)}</pre>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
