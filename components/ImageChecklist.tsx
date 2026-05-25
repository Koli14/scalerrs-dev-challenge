"use client";

import type { ParsedImage } from "@/lib/types";

function Badge({ ok, label, neutralLabel }: { ok: boolean | null; label: string; neutralLabel?: string }) {
  let color = "var(--color-fail)";
  let text = `✕ ${label}`;
  if (ok === true) {
    color = "var(--color-pass)";
    text = `✓ ${label}`;
  } else if (ok === null) {
    color = "var(--color-muted)";
    text = `? ${neutralLabel ?? label}`;
  }
  return (
    <span
      className="inline-block text-xs px-2 py-0.5 rounded border"
      style={{ color, borderColor: color }}
    >
      {text}
    </span>
  );
}

export function ImageChecklist({ images }: { images: ParsedImage[] }) {
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
      <div className="p-3 border-b border-[var(--color-border)] text-sm font-semibold">
        Images ({images.length})
      </div>
      {images.length === 0 ? (
        <div className="p-3 text-xs text-[var(--color-muted)]">No images in article.</div>
      ) : (
        <ul className="divide-y divide-[var(--color-border)]">
          {images.map((img, i) => {
            const thumb = img.driveFileId
              ? `https://drive.google.com/thumbnail?id=${img.driveFileId}&sz=w200`
              : img.imgSrc;
            return (
              <li key={i} className="p-3 flex gap-3">
                <div className="flex-none w-20 h-20 rounded bg-[var(--color-surface-2)] overflow-hidden">
                  {thumb ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={thumb}
                      alt={img.alt || `Image ${i + 1}`}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : null}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">
                    {img.alt || <span className="italic text-[var(--color-muted)]">no alt text</span>}
                  </div>
                  {img.driveUrl && (
                    <a
                      href={img.driveUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-[var(--color-accent)] truncate block hover:underline"
                    >
                      {img.driveUrl}
                    </a>
                  )}
                  <div className="flex gap-1 mt-2 flex-wrap">
                    <Badge ok={img.onDrive} label="On Drive" />
                    <Badge ok={img.publiclyShared} label="Public" neutralLabel="Public unknown" />
                    <Badge ok={Boolean(img.alt)} label="Alt text" />
                  </div>
                  {img.driveError && (
                    <div className="text-xs text-[var(--color-fail)] mt-1">{img.driveError}</div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
