'use client'

import type { CheckResult } from '@/lib/types'

const ICONS = {
  pass: '✓',
  warn: '!',
  fail: '✕',
}

const COLORS = {
  pass: 'var(--color-pass)',
  warn: 'var(--color-warn)',
  fail: 'var(--color-fail)',
}

export function ChecksPanel({ checks }: { checks: CheckResult[] }) {
  const counts = checks.reduce(
    (acc, c) => {
      acc[c.severity]++
      return acc
    },
    { pass: 0, warn: 0, fail: 0 },
  )

  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
      <div className="flex items-center justify-between p-3 border-b border-[var(--color-border)]">
        <div className="text-sm font-semibold">Quality checks</div>
        <div className="flex items-center gap-3 text-xs">
          <span style={{ color: COLORS.pass }}>{counts.pass} pass</span>
          <span style={{ color: COLORS.warn }}>{counts.warn} warn</span>
          <span style={{ color: COLORS.fail }}>{counts.fail} fail</span>
        </div>
      </div>
      <ul className="divide-y divide-[var(--color-border)]">
        {checks.map((c) => (
          <li key={c.id} className="p-3 flex items-start gap-3">
            <span
              className="flex-none w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold mt-0.5"
              style={{ backgroundColor: COLORS[c.severity], color: '#0b1020' }}
              aria-label={c.severity}
            >
              {ICONS[c.severity]}
            </span>
            <div className="flex-1">
              <div className="text-sm font-medium">{c.label}</div>
              <div className="text-xs text-[var(--color-muted)] mt-0.5">{c.detail}</div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
