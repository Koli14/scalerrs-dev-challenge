import { NextResponse } from "next/server";
import { parseDoc } from "@/lib/parser";
import { runChecks } from "@/lib/checks";
import { DEFAULT_THRESHOLDS, type ParseResponse, type Thresholds } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ParseRequest {
  docUrl?: string;
  thresholds?: Partial<Thresholds>;
}

export async function POST(req: Request) {
  let body: ParseRequest;
  try {
    body = (await req.json()) as ParseRequest;
  } catch {
    return NextResponse.json({ error: "Request body must be JSON." }, { status: 400 });
  }

  const docUrl = (body.docUrl ?? "").trim();
  if (!docUrl) {
    return NextResponse.json({ error: "docUrl is required." }, { status: 400 });
  }

  const thresholds: Thresholds = { ...DEFAULT_THRESHOLDS, ...(body.thresholds ?? {}) };

  try {
    const article = await parseDoc(docUrl, thresholds.productDomain || undefined);

    // If the user hasn't picked a product domain yet, classify links against
    // the suggested one so the dashboard has something useful to show on
    // the first render.
    const effectiveDomain = thresholds.productDomain || article.productDomainSuggestion || "";
    const finalThresholds: Thresholds = { ...thresholds, productDomain: effectiveDomain };

    const checks = runChecks(article, finalThresholds);
    const response: ParseResponse = { article, checks };
    return NextResponse.json(response);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
