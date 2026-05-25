import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

interface UploadRequest {
  platform?: 'wordpress' | 'shopify'
  payload?: {
    metaTitle?: string
    metaDescription?: string
    articleTitle?: string
    articleHtml?: string
  }
}

// WHY: This is the placeholder upload. The brief said not to build a real
// integration, just a button that triggers it. So we echo the payload back so
// the editor can see exactly what would be sent. The real version would POST
// this to WordPress's REST API or Shopify's admin API.
/**
 * Placeholder publisher. In production this would forward to:
 *   WordPress: POST {site}/wp-json/wp/v2/posts (with App Password auth)
 *   Shopify:   POST {shop}/admin/api/2024-07/articles.json
 *
 * For the interview demo we just echo back the payload so the UI can show
 * exactly what would be sent.
 */
export async function POST(req: Request) {
  let body: UploadRequest
  try {
    body = (await req.json()) as UploadRequest
  } catch {
    return NextResponse.json({ error: 'Request body must be JSON.' }, { status: 400 })
  }

  const platform = body.platform ?? 'wordpress'
  const payload = body.payload ?? {}

  if (!payload.articleTitle || !payload.articleHtml) {
    return NextResponse.json(
      { error: 'articleTitle and articleHtml are required.' },
      { status: 400 },
    )
  }

  // Simulate network latency so the UI loading state is visible.
  await new Promise((r) => setTimeout(r, 400))

  return NextResponse.json({
    status: 'ok',
    platform,
    mockPostId: Math.floor(Math.random() * 100000),
    sentAt: new Date().toISOString(),
    payload,
    note: `This is a placeholder. A real ${platform} integration would POST this payload to the platform's REST API.`,
  })
}
