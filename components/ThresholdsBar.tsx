'use client'

import type { Thresholds } from '@/lib/types'

interface Props {
  thresholds: Thresholds
  onChange: (next: Thresholds) => void
  productDomainSuggestion: string | null
}

function NumberInput({
  label,
  value,
  onChange,
  min = 0,
  max,
}: {
  label: string
  value: number
  onChange: (n: number) => void
  min?: number
  max?: number
}) {
  return (
    <label className="flex flex-col gap-1 text-xs">
      <span className="text-[var(--color-muted)] uppercase tracking-wider">{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value || 0))}
        className="w-20 rounded bg-[var(--color-surface)] border border-[var(--color-border)] px-2 py-1 text-sm focus:outline-none focus:border-[var(--color-accent)]"
      />
    </label>
  )
}

export function ThresholdsBar({ thresholds, onChange, productDomainSuggestion }: Props) {
  // WHY: I could set min-images to 20 with max still at 8 — an impossible
  // state where the check would always fail. Now if min goes above max, max
  // bumps up to match. Auto-clamp instead of showing an error because if you
  // type 20, you mean at least 20 — the max should follow, not block you.
  // Patch the thresholds while enforcing the monotonic constraint min ≤ max
  // on each paired range. If the user raises the min above the current max
  // (or lowers the max below the current min) we move the other side to
  // match, so the editor never lands in an inconsistent state where the
  // check would always fail no matter what the article looks like.
  const set = (patch: Partial<Thresholds>) => {
    const next = { ...thresholds, ...patch }
    if (patch.minImages !== undefined && next.minImages > next.maxImages) {
      next.maxImages = next.minImages
    }
    if (patch.maxImages !== undefined && next.maxImages < next.minImages) {
      next.minImages = next.maxImages
    }
    if (patch.minProductLinks !== undefined && next.minProductLinks > next.maxProductLinks) {
      next.maxProductLinks = next.minProductLinks
    }
    if (patch.maxProductLinks !== undefined && next.maxProductLinks < next.minProductLinks) {
      next.minProductLinks = next.maxProductLinks
    }
    onChange(next)
  }
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
      <div className="text-xs uppercase tracking-wider text-[var(--color-muted)] mb-2">
        Quality thresholds
      </div>
      <div className="flex flex-wrap gap-4 items-end">
        <NumberInput
          label="Min images"
          value={thresholds.minImages}
          max={thresholds.maxImages}
          onChange={(n) => set({ minImages: n })}
        />
        <NumberInput
          label="Max images"
          value={thresholds.maxImages}
          min={thresholds.minImages}
          onChange={(n) => set({ maxImages: n })}
        />
        <NumberInput
          label="Min product links"
          value={thresholds.minProductLinks}
          max={thresholds.maxProductLinks}
          onChange={(n) => set({ minProductLinks: n })}
        />
        <NumberInput
          label="Max product links"
          value={thresholds.maxProductLinks}
          min={thresholds.minProductLinks}
          onChange={(n) => set({ maxProductLinks: n })}
        />
        <label className="flex flex-col gap-1 text-xs flex-1 min-w-[200px]">
          <span className="text-[var(--color-muted)] uppercase tracking-wider">
            Product domain
            {productDomainSuggestion && !thresholds.productDomain && (
              <button
                type="button"
                onClick={() => set({ productDomain: productDomainSuggestion })}
                className="ml-2 normal-case tracking-normal text-[var(--color-accent)] hover:underline"
              >
                use {productDomainSuggestion}
              </button>
            )}
          </span>
          <input
            type="text"
            placeholder={productDomainSuggestion ?? 'e.g. andar.com'}
            value={thresholds.productDomain}
            onChange={(e) => set({ productDomain: e.target.value.trim() })}
            className="rounded bg-[var(--color-surface)] border border-[var(--color-border)] px-2 py-1 text-sm focus:outline-none focus:border-[var(--color-accent)]"
          />
        </label>
      </div>
    </div>
  )
}
