"use client";

interface Props {
  html: string;
  title: string;
}

export function ArticlePreview({ html, title }: Props) {
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <div className="text-xs uppercase tracking-wider text-[var(--color-muted)] mb-1">
        Article preview
      </div>
      <h1 className="text-2xl font-bold mb-3">{title || <em className="text-[var(--color-muted)]">(no title)</em>}</h1>
      <div
        className="article-preview"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
