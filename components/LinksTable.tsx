"use client";

import type { ParsedLink, LinkHealth } from "@/lib/types";

const TYPE_COLOR: Record<ParsedLink["type"], string> = {
  product: "var(--color-pass)",
  external: "var(--color-muted)",
  "internal-anchor": "var(--color-accent)",
  mailto: "var(--color-accent)",
  tel: "var(--color-accent)",
};

function healthBadge(h: LinkHealth | undefined): { color: string; text: string; title: string } | null {
  if (!h) return null;
  if (h.broken) {
    return {
      color: "var(--color-fail)",
      text: h.status ? `${h.status}` : "net err",
      title: h.error || `HTTP ${h.status} — broken`,
    };
  }
  if (h.blocked) {
    return {
      color: "var(--color-warn)",
      text: h.status ? `${h.status}` : "blocked",
      title: `HTTP ${h.status} — bot-blocked (verify manually)`,
    };
  }
  if (h.ok) {
    return {
      color: "var(--color-pass)",
      text: h.status ? `${h.status}` : "ok",
      title: h.finalUrl && h.finalUrl !== "" ? `Resolved to ${h.finalUrl}` : "Reachable",
    };
  }
  return null;
}

export function LinksTable({ links }: { links: ParsedLink[] }) {
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
      <div className="p-3 border-b border-[var(--color-border)] text-sm font-semibold">
        Links ({links.length})
      </div>
      {links.length === 0 ? (
        <div className="p-3 text-xs text-[var(--color-muted)]">No links in article.</div>
      ) : (
        <div className="max-h-72 overflow-auto">
          <table className="w-full text-xs">
            <thead className="bg-[var(--color-surface-2)] sticky top-0">
              <tr>
                <th className="text-left p-2 font-medium">Type</th>
                <th className="text-left p-2 font-medium">Status</th>
                <th className="text-left p-2 font-medium">Text</th>
                <th className="text-left p-2 font-medium">URL</th>
              </tr>
            </thead>
            <tbody>
              {links.map((l, i) => {
                const badge = healthBadge(l.health);
                return (
                  <tr key={i} className="border-t border-[var(--color-border)] align-top">
                    <td className="p-2">
                      <span
                        className="inline-block px-1.5 py-0.5 rounded border text-[0.65rem] uppercase tracking-wider"
                        style={{ color: TYPE_COLOR[l.type], borderColor: TYPE_COLOR[l.type] }}
                      >
                        {l.type === "internal-anchor" ? "anchor" : l.type}
                      </span>
                    </td>
                    <td className="p-2">
                      {badge ? (
                        <span
                          title={badge.title}
                          className="inline-block px-1.5 py-0.5 rounded border text-[0.65rem]"
                          style={{ color: badge.color, borderColor: badge.color }}
                        >
                          {badge.text}
                        </span>
                      ) : (
                        <span className="text-[var(--color-muted)]">—</span>
                      )}
                    </td>
                    <td className="p-2 max-w-[160px] truncate" title={l.text}>
                      {l.text || <em className="text-[var(--color-muted)]">(empty)</em>}
                    </td>
                    <td className="p-2 max-w-[240px] truncate">
                      <a
                        href={l.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[var(--color-accent)] hover:underline"
                        title={l.href}
                      >
                        {l.host || l.href}
                      </a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
