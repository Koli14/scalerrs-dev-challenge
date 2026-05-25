"use client";

import type { Thresholds } from "@/lib/types";

interface Props {
  thresholds: Thresholds;
  onChange: (next: Thresholds) => void;
  productDomainSuggestion: string | null;
}

function NumberInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs">
      <span className="text-[var(--color-muted)] uppercase tracking-wider">{label}</span>
      <input
        type="number"
        min={0}
        value={value}
        onChange={(e) => onChange(Number(e.target.value || 0))}
        className="w-20 rounded bg-[var(--color-surface)] border border-[var(--color-border)] px-2 py-1 text-sm focus:outline-none focus:border-[var(--color-accent)]"
      />
    </label>
  );
}

export function ThresholdsBar({ thresholds, onChange, productDomainSuggestion }: Props) {
  const set = (patch: Partial<Thresholds>) => onChange({ ...thresholds, ...patch });
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
      <div className="text-xs uppercase tracking-wider text-[var(--color-muted)] mb-2">
        Quality thresholds
      </div>
      <div className="flex flex-wrap gap-4 items-end">
        <NumberInput
          label="Min images"
          value={thresholds.minImages}
          onChange={(n) => set({ minImages: n })}
        />
        <NumberInput
          label="Max images"
          value={thresholds.maxImages}
          onChange={(n) => set({ maxImages: n })}
        />
        <NumberInput
          label="Min product links"
          value={thresholds.minProductLinks}
          onChange={(n) => set({ minProductLinks: n })}
        />
        <NumberInput
          label="Max product links"
          value={thresholds.maxProductLinks}
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
            placeholder={productDomainSuggestion ?? "e.g. andar.com"}
            value={thresholds.productDomain}
            onChange={(e) => set({ productDomain: e.target.value.trim() })}
            className="rounded bg-[var(--color-surface)] border border-[var(--color-border)] px-2 py-1 text-sm focus:outline-none focus:border-[var(--color-accent)]"
          />
        </label>
      </div>
    </div>
  );
}
