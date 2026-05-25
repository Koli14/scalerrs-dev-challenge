"use client";

import { useState, useEffect, useRef } from "react";
import { MetaFields } from "@/components/MetaFields";
import { ChecksPanel } from "@/components/ChecksPanel";
import { ImageChecklist } from "@/components/ImageChecklist";
import { LinksTable } from "@/components/LinksTable";
import { ThresholdsBar } from "@/components/ThresholdsBar";
import { ArticlePreview } from "@/components/ArticlePreview";
import { PublishBar } from "@/components/PublishBar";
import {
  DEFAULT_THRESHOLDS,
  type ParseResponse,
  type Thresholds,
  type CheckResult,
  type ParsedArticle,
} from "@/lib/types";
import { runChecks } from "@/lib/checks";

const SAMPLE_DOC_URL =
  "https://docs.google.com/document/d/1s0fZsDcXJtiwrqUT1fVInS6q1yCZwVKkyCEGcxUiIYY/edit";

type Tab = "checks" | "images" | "links";

export default function Page() {
  const [docUrl, setDocUrl] = useState(SAMPLE_DOC_URL);
  const [thresholds, setThresholds] = useState<Thresholds>(DEFAULT_THRESHOLDS);
  const [data, setData] = useState<ParseResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("checks");
  const initialThresholdsApplied = useRef(false);

  const parse = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/parse", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ docUrl, thresholds }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Failed to parse article.");
        setData(null);
      } else {
        setData(json as ParseResponse);
        initialThresholdsApplied.current = false;
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  // After a successful parse, adopt the suggested product domain into thresholds
  // (if the user hasn't set one) so the threshold input reflects what we used.
  useEffect(() => {
    if (!data || initialThresholdsApplied.current) return;
    initialThresholdsApplied.current = true;
    if (!thresholds.productDomain && data.article.productDomainSuggestion) {
      setThresholds((t) => ({ ...t, productDomain: data.article.productDomainSuggestion ?? "" }));
    }
  }, [data, thresholds.productDomain]);

  // Recompute checks client-side whenever thresholds change, without re-fetching.
  const liveChecks: CheckResult[] = data ? runChecks(data.article, thresholds) : [];
  const failingCount = liveChecks.filter((c) => c.severity === "fail").length;
  const article: ParsedArticle | null = data?.article ?? null;

  return (
    <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold">Article QC</h1>
        <p className="text-sm text-[var(--color-muted)]">
          Parse a Google Doc, audit it against your editorial rules, and publish to WordPress or Shopify.
        </p>
      </header>

      <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3 flex gap-2 flex-wrap items-center">
        <input
          type="url"
          value={docUrl}
          onChange={(e) => setDocUrl(e.target.value)}
          placeholder="Paste a Google Doc URL"
          className="flex-1 min-w-[280px] rounded bg-[var(--color-bg)] border border-[var(--color-border)] px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-accent)]"
          onKeyDown={(e) => {
            if (e.key === "Enter") parse();
          }}
        />
        <button
          onClick={parse}
          disabled={loading || !docUrl}
          className="px-4 py-2 rounded bg-[var(--color-accent)] text-[#0b1020] font-semibold text-sm hover:opacity-90 disabled:opacity-50"
        >
          {loading ? "Parsing…" : "Parse article"}
        </button>
      </section>

      <ThresholdsBar
        thresholds={thresholds}
        onChange={setThresholds}
        productDomainSuggestion={article?.productDomainSuggestion ?? null}
      />

      {error && (
        <div className="rounded-lg border border-[var(--color-fail)] bg-[var(--color-surface)] p-3 text-sm">
          <span className="text-[var(--color-fail)] font-semibold">Error: </span>
          {error}
        </div>
      )}

      {article && (
        <>
          <PublishBar article={article} failingChecks={failingCount} />

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-6">
            <div className="space-y-4">
              <MetaFields
                metaTitle={article.metaTitle}
                metaDescription={article.metaDescription}
                articleTitle={article.articleTitle}
              />
              <ArticlePreview html={article.articleHtml} title={article.articleTitle} />
            </div>

            <aside className="space-y-4">
              <div className="flex gap-1 rounded border border-[var(--color-border)] bg-[var(--color-surface)] p-1 text-sm">
                {(["checks", "images", "links"] as Tab[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className={`flex-1 px-2 py-1.5 rounded capitalize ${
                      tab === t
                        ? "bg-[var(--color-accent)] text-[#0b1020] font-semibold"
                        : "text-[var(--color-muted)] hover:text-[var(--color-text)]"
                    }`}
                  >
                    {t === "checks"
                      ? `Checks (${liveChecks.length})`
                      : t === "images"
                        ? `Images (${article.images.length})`
                        : `Links (${article.links.length})`}
                  </button>
                ))}
              </div>

              {tab === "checks" && <ChecksPanel checks={liveChecks} />}
              {tab === "images" && <ImageChecklist images={article.images} />}
              {tab === "links" && <LinksTable links={article.links} />}

              <div className="text-xs text-[var(--color-muted)] px-1">
                Word count: {article.wordCount.toLocaleString()} · Headings: {article.headings.length}
              </div>
            </aside>
          </div>
        </>
      )}

      {!article && !loading && !error && (
        <div className="text-sm text-[var(--color-muted)] text-center py-12">
          Paste a Google Doc URL above and click <strong>Parse article</strong> to get started.
        </div>
      )}
    </main>
  );
}
