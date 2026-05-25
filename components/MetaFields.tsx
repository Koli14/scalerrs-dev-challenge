'use client'

import { useState } from 'react'

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value)
          setCopied(true)
          setTimeout(() => setCopied(false), 1200)
        } catch {
          // clipboard might be unavailable; no-op
        }
      }}
      className="text-xs px-2 py-1 rounded border border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-text)] hover:border-[var(--color-accent)] transition"
    >
      {copied ? 'Copied' : 'Copy'}
    </button>
  )
}

interface Props {
  metaTitle: string
  metaDescription: string
  articleTitle: string
}

export function MetaFields({ metaTitle, metaDescription, articleTitle }: Props) {
  const items = [
    { label: 'Meta title', value: metaTitle, hint: `${metaTitle.length} chars` },
    { label: 'Meta description', value: metaDescription, hint: `${metaDescription.length} chars` },
    { label: 'Article title (H1)', value: articleTitle, hint: '' },
  ]
  return (
    <div className="space-y-3">
      {items.map((it) => (
        <div
          key={it.label}
          className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3"
        >
          <div className="flex items-start justify-between gap-3 mb-1">
            <div className="text-xs uppercase tracking-wider text-[var(--color-muted)]">
              {it.label}
              {it.hint && <span className="ml-2 normal-case tracking-normal">· {it.hint}</span>}
            </div>
            {it.value && <CopyButton value={it.value} />}
          </div>
          <div className="text-sm break-words">
            {it.value || <span className="italic text-[var(--color-muted)]">(missing)</span>}
          </div>
        </div>
      ))}
    </div>
  )
}
